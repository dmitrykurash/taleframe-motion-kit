/** Deterministic paint reconstruction with optional pre-analysed material transport. */
import type { Ctx2D } from '../../types';
import type { Fps } from '../../types';
import type { Affine } from '../../types';
import { paintEffectsActive, pigmentActive, watercolorActive, type PigmentSettings, type WatercolorSettings } from './model';
import { INIT_PIGMENT, PAPER, RESOLVE, STEP_PIGMENT, VERTEX } from './shaders';
import { BRUSH_FRAGMENT, BRUSH_VERTEX, PAINT_BASE, PAINT_FINISH, PAINT_FLOW, PAINT_GUIDE, PAINT_TENSOR } from './painterly';
import { brushGrid } from './brushGrid';
import { paintMaterialTransform } from './material';
import type { PaintAnchor, PaintTransport, PreparedPaintFrame } from './temporal/types';

type Canvas = HTMLCanvasElement | OffscreenCanvas;
type Program = { object: WebGLProgram; uniform: Record<string, WebGLUniformLocation | null> };
type Surface = { mobile: WebGLTexture; deposit: WebGLTexture; framebuffer: WebGLFramebuffer };
type MaterialGrid = {
  width: number; height: number; paperKey: string;
  paper: WebGLTexture; paperFramebuffer: WebGLFramebuffer; surfaces: [Surface, Surface];
  flow: WebGLTexture; flowFramebuffer: WebGLFramebuffer;
  guide?: WebGLTexture; guideFramebuffer?: WebGLFramebuffer;
};
const UNIFORMS = ['uSource', 'uPaper', 'uMobile', 'uDeposit', 'uFlow', 'uGuide', 'uSize', 'uReference', 'uSettings', 'uSeed', 'uMode', 'uAmount', 'uGrid', 'uOrigin', 'uStroke', 'uMaterial', 'uEdgeScale', 'uPrepared', 'uGeneration', 'uTransport', 'uCurrentGuide', 'uCurrentFlow'];

export class PaintEffectError extends Error {
  constructor(message: string) { super(`Эффекты краски: ${message}`); this.name = 'PaintEffectError'; }
}
class PaintRuntime {
  private readonly programs: Program[] = [];
  private readonly source: WebGLTexture;
  private readonly transport: WebGLTexture;
  private readonly anchors = new Map<string, {guide:WebGLTexture;flow:WebGLTexture}>();
  // Keep independent retained backing stores for each material. Switching
  // between effects must not churn the driver's pending allocations in export.
  private readonly grids: [MaterialGrid | undefined, MaterialGrid | undefined] = [undefined, undefined];
  private grid!: MaterialGrid;
  private readonly vao: WebGLVertexArrayObject;
  private readonly maximum: number;
  private sourceWidth = 0;
  private sourceHeight = 0;
  private get width(): number { return this.grid.width; }
  private get height(): number { return this.grid.height; }
  private get paper(): WebGLTexture { return this.grid.paper; }
  private get paperFramebuffer(): WebGLFramebuffer { return this.grid.paperFramebuffer; }
  private get surfaces(): [Surface, Surface] { return this.grid.surfaces; }
  private get paperKey(): string { return this.grid.paperKey; }
  private set paperKey(key: string) { this.grid.paperKey = key; }
  private idle: ReturnType<typeof setTimeout> | undefined;
  constructor(readonly canvas: Canvas, private readonly gl: WebGL2RenderingContext) {
    if (!gl.getExtension('EXT_color_buffer_float')) throw new PaintEffectError('нужны цветовые буферы WebGL2 с плавающей точкой.');
    this.maximum = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const shader = (kind: number, code: string): WebGLShader => {
      const result = gl.createShader(kind);
      if (!result) throw new PaintEffectError('не удалось выделить шейдер.');
      gl.shaderSource(result, code); gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
        const reason = gl.getShaderInfoLog(result); gl.deleteShader(result);
        throw new PaintEffectError(reason ?? 'не удалось собрать шейдер.');
      }
      return result;
    };
    const vertex = shader(gl.VERTEX_SHADER, VERTEX);
    const brushVertex = shader(gl.VERTEX_SHADER, BRUSH_VERTEX);
    try {
      for (const source of [PAPER, INIT_PIGMENT, STEP_PIGMENT, RESOLVE, PAINT_TENSOR, PAINT_FLOW, PAINT_BASE, PAINT_FINISH, BRUSH_FRAGMENT, PAINT_GUIDE]) {
        const fragment = shader(gl.FRAGMENT_SHADER, source), object = gl.createProgram();
        if (!object) { gl.deleteShader(fragment); throw new PaintEffectError('не удалось выделить программу.'); }
        gl.attachShader(object, source === BRUSH_FRAGMENT ? brushVertex : vertex); gl.attachShader(object, fragment); gl.linkProgram(object); gl.deleteShader(fragment);
        if (!gl.getProgramParameter(object, gl.LINK_STATUS)) {
          const reason = gl.getProgramInfoLog(object); gl.deleteProgram(object);
          throw new PaintEffectError(reason ?? 'не удалось связать шейдер.');
        }
        this.programs.push({ object, uniform: Object.fromEntries(UNIFORMS.map(name => [name, gl.getUniformLocation(object, name)])) });
      }
    } catch (error) {
      for (const program of this.programs) gl.deleteProgram(program.object);
      throw error;
    } finally { gl.deleteShader(vertex); gl.deleteShader(brushVertex); }
    this.source = this.texture();
    this.transport = this.texture();
    this.vao = gl.createVertexArray()!;
    (canvas as unknown as EventTarget).addEventListener('webglcontextlost', event => {
      event.preventDefault();
      if (this.idle) clearTimeout(this.idle);
      if (runtime === this) runtime = null;
    });
  }
  private texture(): WebGLTexture {
    const gl = this.gl, t = gl.createTexture();
    if (!t) throw new PaintEffectError('не удалось выделить текстуру.');
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  private framebuffer(): WebGLFramebuffer {
    const f = this.gl.createFramebuffer();
    if (!f) throw new PaintEffectError('не удалось выделить буфер.');
    return f;
  }
  private bind(texture: WebGLTexture, unit: number): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + unit); this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
  }
  private allocate(texture: WebGLTexture, width: number, height: number, float = false): void {
    const gl = this.gl; this.bind(texture, 0);
    gl.texImage2D(gl.TEXTURE_2D, 0, float ? gl.RGBA16F : gl.RGBA8, width, height, 0, gl.RGBA, float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  }
  private checkFramebuffer(): void {
    if (this.gl.checkFramebufferStatus(this.gl.FRAMEBUFFER) !== this.gl.FRAMEBUFFER_COMPLETE)
      throw new PaintEffectError('графический буфер недоступен; эффект не был применён.');
  }
  private resize(width: number, height: number, mode: 0 | 1): void {
    let grid = this.grids[mode];
    if (!grid) {
      grid = {
        width: 0, height: 0, paperKey: '', paper: this.texture(), paperFramebuffer: this.framebuffer(),
        flow: this.texture(), flowFramebuffer: this.framebuffer(),
        guide: mode === 0 ? this.texture() : undefined, guideFramebuffer: mode === 0 ? this.framebuffer() : undefined,
        surfaces: [0, 1].map(() => ({ mobile: this.texture(), deposit: this.texture(), framebuffer: this.framebuffer() })) as [Surface, Surface],
      };
      this.grids[mode] = grid;
    }
    this.grid = grid;
    if (width === grid.width && height === grid.height) return;
    const gl = this.gl;
    grid.width = width; grid.height = height; grid.paperKey = '';
    this.allocate(this.paper, width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.paperFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.paper, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]); this.checkFramebuffer();
    this.allocate(grid.flow, width, height, true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, grid.flowFramebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, grid.flow, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]); this.checkFramebuffer();
    if (grid.guide && grid.guideFramebuffer) {
      this.allocate(grid.guide, width, height, true);
      gl.bindFramebuffer(gl.FRAMEBUFFER, grid.guideFramebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, grid.guide, 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0]); this.checkFramebuffer();
    }
    for (const target of this.surfaces) {
      this.allocate(target.mobile, width, height, true); this.allocate(target.deposit, width, height, true);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.mobile, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D, target.deposit, 0);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]); this.checkFramebuffer();
    }
  }
  private use(index: number, reference: [number, number], values: [number, number, number, number], seed: number): Program {
    const gl = this.gl, p = this.programs[index];
    gl.useProgram(p.object);
    gl.uniform1i(p.uniform.uSource, 0); gl.uniform1i(p.uniform.uPaper, 1);
    gl.uniform1i(p.uniform.uMobile, 2); gl.uniform1i(p.uniform.uDeposit, 3);
    gl.uniform1i(p.uniform.uFlow, 4);
    gl.uniform1i(p.uniform.uGuide, 5);
    gl.uniform1i(p.uniform.uCurrentGuide, 6);gl.uniform1i(p.uniform.uCurrentFlow, 7);gl.uniform1i(p.uniform.uTransport, 8);
    gl.uniform1i(p.uniform.uPrepared, 0);gl.uniform1f(p.uniform.uGeneration,1);
    gl.uniform2f(p.uniform.uSize, this.width, this.height); gl.uniform2fv(p.uniform.uReference, reference);
    gl.uniform4fv(p.uniform.uSettings, values); gl.uniform1ui(p.uniform.uSeed, seed >>> 0);
    return p;
  }
  /** Anchor fields are immutable: no current-frame gradient can turn their ribbons. */
  private anchorFields(anchor:PaintAnchor, reference:[number,number], values:[number,number,number,number], seed:number):{guide:WebGLTexture;flow:WebGLTexture} {
    const key=anchor.id+'/'+values.join('/'),old=this.anchors.get(key);
    if(old){this.anchors.delete(key);this.anchors.set(key,old);return old;}
    const gl=this.gl,source=this.texture(),guide=this.texture(),tensor=this.texture(),flow=this.texture(),fb=this.framebuffer();
    const flipped=new Uint8Array(anchor.rgba.length),stride=anchor.width*4;
    for(let y=0;y<anchor.height;y++)flipped.set(anchor.rgba.subarray(y*stride,(y+1)*stride),(anchor.height-1-y)*stride);
    this.bind(source,0);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,anchor.width,anchor.height,0,gl.RGBA,gl.UNSIGNED_BYTE,flipped);
    for(const texture of [guide,tensor,flow])this.allocate(texture,anchor.width,anchor.height,true);
    this.bind(source,0);gl.viewport(0,0,anchor.width,anchor.height);gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    const pass=(index:number,texture:WebGLTexture)=>{
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);this.checkFramebuffer();
      const program=this.use(index,reference,values,seed);gl.uniform2f(program.uniform.uSize,anchor.width,anchor.height);gl.drawArrays(gl.TRIANGLES,0,3);
    };
    pass(9,guide);this.bind(guide,5);pass(4,tensor);this.bind(tensor,2);pass(5,flow);
    gl.deleteTexture(source);gl.deleteTexture(tensor);gl.deleteFramebuffer(fb);
    const result={guide,flow};this.anchors.set(key,result);
    while(this.anchors.size>6){const oldest=this.anchors.keys().next().value!;const v=this.anchors.get(oldest)!;this.anchors.delete(oldest);gl.deleteTexture(v.guide);gl.deleteTexture(v.flow);}
    this.bind(this.source,0);gl.viewport(0,0,this.width,this.height);return result;
  }
  private uploadTransport(map:PaintTransport):void {
    const gl=this.gl;this.bind(this.transport,8);
    // 32F + manual bilinear sampling retains subpixel motion at 4K. Half floats quantize UVs.
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,map.width,map.height,0,gl.RGBA,gl.FLOAT,map.data);
  }
  /** Brush colour is reconstructed before any paper texture is applied. */
  private watercolor(settings: WatercolorSettings, reference: [number, number], values: [number, number, number, number], width: number, height: number, material?: Affine, prepared?:PreparedPaintFrame): void {
    const gl = this.gl;
    // A separate, premultiplied linear-colour analysis image rejects sensor /
    // compression noise before it can change an entire brush's geometry.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.grid.guideFramebuffer!); gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    this.use(9, reference, values, settings.seed); gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.bind(this.grid.guide!, 5);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.surfaces[0].framebuffer); gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    this.use(4, reference, values, settings.seed); gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.bind(this.surfaces[0].mobile, 2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.grid.flowFramebuffer); gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    this.use(5, reference, values, settings.seed); gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.bind(this.grid.flow, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.surfaces[0].framebuffer); gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    const base = this.use(6, reference, values, settings.seed);
    gl.uniform1f(base.uniform.uEdgeScale, settings.edgeScale ?? 0); gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (settings.strokes > 0) {
      // Three fixed-cost stages: broad curved brush ribbons, secondary broken
      // planes, and fine accents guided by local contrast rather than noise.
      gl.enable(gl.BLEND); gl.blendEquation(gl.FUNC_ADD);
      // The alpha channel stores source coverage for subpixel detail recovery;
      // brush layering changes colour only. Final alpha comes from the source.
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      const generations=prepared ? [
        {anchor:prepared.a,map:prepared.fromA,weight:1-prepared.mix},
        {anchor:prepared.b,map:prepared.fromB,weight:prepared.mix},
      ] : [{anchor:undefined,map:undefined,weight:1}];
      this.bind(this.grid.guide!,6);this.bind(this.grid.flow,7);
      for(const generation of generations){
        if(generation.weight<=0)continue;
        if(generation.anchor&&generation.map){
          gl.disable(gl.BLEND);
          const fields=this.anchorFields(generation.anchor,reference,values,settings.seed);
          this.bind(fields.guide,5);this.bind(fields.flow,4);this.uploadTransport(generation.map);
          gl.bindFramebuffer(gl.FRAMEBUFFER,this.surfaces[0].framebuffer);gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
          gl.enable(gl.BLEND);
        }
        for (let level = 0; level < 3; level++) {
          // Prepared material identities and tessellation do not depend on viewer size.
          const gridMaterial=prepared?undefined:material;
          const { spacing, columns, rows, segments, originX, originY } = brushGrid(reference, prepared?reference[0]:this.width, prepared?reference[1]:this.height, settings.brushSize, level, gridMaterial, settings.edgeScale);
          const program = this.use(8, reference, values, (settings.seed + level * 977) >>> 0);
          gl.uniform1i(program.uniform.uPrepared,prepared?1:0);gl.uniform1f(program.uniform.uGeneration,generation.weight);
          gl.uniform3f(program.uniform.uGrid, columns, rows, spacing);
          gl.uniform2i(program.uniform.uOrigin, originX, originY);
          gl.uniform4f(program.uniform.uStroke, spacing, level, settings.strokes, segments);
          gl.uniform1f(program.uniform.uEdgeScale, settings.edgeScale ?? 0);
          gl.uniformMatrix3fv(program.uniform.uMaterial, false, gridMaterial
            ? [gridMaterial[0], gridMaterial[1], 0, gridMaterial[2], gridMaterial[3], 0, gridMaterial[4], gridMaterial[5], 1]
            : [1, 0, 0, 0, 1, 0, 0, 0, 1]);
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 2 * (segments + 1), columns * rows);
        }
      }
      this.bind(this.grid.guide!,5);this.bind(this.grid.flow,4);
      gl.disable(gl.BLEND);
    }
    this.bind(this.surfaces[0].mobile, 2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.drawBuffers([gl.BACK]); gl.viewport(0, 0, width, height);
    const program = this.use(7, reference, values, settings.seed);
    gl.uniform1f(program.uniform.uAmount, settings.amount); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  private effect(input: Canvas, settings: WatercolorSettings | PigmentSettings, mode: 0 | 1, projectWidth: number, projectHeight: number, previous: boolean, material?: Affine, prepared?:PreparedPaintFrame): void {
    const gl = this.gl, width = input.width, height = input.height;
    if (gl.isContextLost()) throw new PaintEffectError('графический контекст потерян. Повторите рендер.');
    if (width > this.maximum || height > this.maximum) throw new PaintEffectError(`размер кадра превышает ${this.maximum} пикселей.`);
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    this.bind(this.source, 0);
    if (width !== this.sourceWidth || height !== this.sourceHeight) {
      this.allocate(this.source, width, height); this.sourceWidth = width; this.sourceHeight = height;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (previous) gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, width, height);
    else {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, input);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }
    // A fixed maximum material grid bounds 4K cost. All material dimensions use
    // reference pixels, so paper does not change size with viewer zoom.
    const short = Math.min(width, height), scale = Math.min(1, 1080 / short);
    this.resize(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)), mode);
    gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.SCISSOR_TEST); gl.bindVertexArray(this.vao);
    const reference: [number, number] = [projectWidth * 1080 / Math.min(projectWidth, projectHeight), projectHeight * 1080 / Math.min(projectWidth, projectHeight)];
    const values: [number, number, number, number] = mode === 0
      ? [(settings as WatercolorSettings).wetness, (settings as WatercolorSettings).detail, settings.paper, (settings as WatercolorSettings).brushSize]
      : [(settings as PigmentSettings).granulation, (settings as PigmentSettings).settling, settings.paper, 0];
    const key = `${this.width}/${this.height}/${reference[0]}/${reference[1]}/${settings.seed}`;
    gl.viewport(0, 0, this.width, this.height);
    if (this.paperKey !== key) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.paperFramebuffer); gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
      this.use(0, reference, values, settings.seed); gl.drawArrays(gl.TRIANGLES, 0, 3); this.paperKey = key;
    }
    this.bind(this.source, 0); this.bind(this.paper, 1);
    if (mode === 0) this.watercolor(settings as WatercolorSettings, reference, values, width, height, material ? paintMaterialTransform(material, projectWidth, projectHeight) : undefined, prepared);
    else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.surfaces[0].framebuffer); gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      this.use(1, reference, values, settings.seed); gl.drawArrays(gl.TRIANGLES, 0, 3);
      const count = 8;
      for (let i = 0; i < count; i++) {
        const read = this.surfaces[i % 2], write = this.surfaces[(i + 1) % 2];
        this.bind(read.mobile, 2); this.bind(read.deposit, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, write.framebuffer);
        this.use(2, reference, values, settings.seed); gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      const read = this.surfaces[count % 2]; this.bind(read.mobile, 2); this.bind(read.deposit, 3);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.drawBuffers([gl.BACK]); gl.viewport(0, 0, width, height);
      const p = this.use(3, reference, values, settings.seed);
      gl.uniform1i(p.uniform.uMode, mode); gl.uniform1f(p.uniform.uAmount, settings.amount); gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    const error = gl.getError();
    if (error !== gl.NO_ERROR) throw new PaintEffectError(`ошибка WebGL ${error}; кадр не был заменён.`);
  }
  draw(input: Canvas, watercolor: WatercolorSettings | undefined, pigment: PigmentSettings | undefined, width: number, height: number, material?: Affine, prepared?:PreparedPaintFrame): Canvas {
    const a = watercolorActive(watercolor), b = pigmentActive(pigment);
    if (a) this.effect(input, watercolor!, 0, width, height, false, material, prepared);
    if (b) this.effect(a ? this.canvas : input, pigment!, 1, width, height, a);
    if (typeof window !== 'undefined') {
      if (this.idle) clearTimeout(this.idle);
      this.idle = setTimeout(() => { if (runtime === this) { runtime = null; this.dispose(); } }, 15_000);
    }
    return this.canvas;
  }
  dispose(): void {
    const gl = this.gl; if (this.idle) clearTimeout(this.idle);
    for (const p of this.programs) gl.deleteProgram(p.object);
    gl.deleteTexture(this.source);gl.deleteTexture(this.transport);
    for(const a of this.anchors.values()){gl.deleteTexture(a.guide);gl.deleteTexture(a.flow);}this.anchors.clear();
    for (const grid of this.grids) {
      if (!grid) continue;
      gl.deleteTexture(grid.paper); gl.deleteFramebuffer(grid.paperFramebuffer);
      gl.deleteTexture(grid.flow); gl.deleteFramebuffer(grid.flowFramebuffer);
      if (grid.guide) gl.deleteTexture(grid.guide);
      if (grid.guideFramebuffer) gl.deleteFramebuffer(grid.guideFramebuffer);
      for (const s of grid.surfaces) { gl.deleteTexture(s.mobile); gl.deleteTexture(s.deposit); gl.deleteFramebuffer(s.framebuffer); }
    }
    gl.deleteVertexArray(this.vao); this.canvas.width = 1; this.canvas.height = 1;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
let runtime: PaintRuntime | null = null;
function gpu(): PaintRuntime {
  if (runtime) return runtime;
  const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1)
    : typeof document !== 'undefined' ? document.createElement('canvas') : null;
  const gl = canvas?.getContext('webgl2', {
    alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false,
  }) as WebGL2RenderingContext | null;
  if (!canvas || !gl) throw new PaintEffectError('WebGL2 недоступен. Для акварели и грануляции нужен аппаратный графический рендер.');
  return runtime = new PaintRuntime(canvas, gl);
}
export function disposePaintEffects(): void { runtime?.dispose(); runtime = null; }

/** No mutable playback history: prepared data is explicit, so seeking cannot change paint. */
export function applyPaintEffects(ctx: Ctx2D, watercolor: WatercolorSettings | undefined, pigment: PigmentSettings | undefined,
  width: number, height: number, _t: number, _fps: Fps, material?: Affine, prepared?:PreparedPaintFrame): void {
  if (!paintEffectsActive(watercolor, pigment)) return;
  const input = ctx.canvas as Canvas;
  if (!input.width || !input.height) return;
  const result = gpu().draw(input, watercolor, pigment, width, height, material, prepared);
  ctx.save();
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'copy'; ctx.drawImage(result, 0, 0);
  } finally { ctx.restore(); }
}
