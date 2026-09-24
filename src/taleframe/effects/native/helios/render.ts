import type { Ctx2D } from '../../types';
import type { Fps } from '../../types';
import { heliosActive, type HeliosSettings } from './model';
import * as shaders from './shaders';
import { sharedWorkerContext, resetPostContext } from '../sharedWorkerContext';

type Canvas = HTMLCanvasElement | OffscreenCanvas;
export class HeliosRenderError extends Error {
  readonly code = 'helios-gpu';
  constructor(detail?: string) {
    super(`Для эффекта Helios нужен WebGL 2 с поддержкой HDR. Отключите эффект или включите аппаратное ускорение браузера.${detail ? ` (${detail})` : ''}`);
    this.name = 'HeliosRenderError';
  }
}

type Program = { value: WebGLProgram; uniforms: Map<string, WebGLUniformLocation | null> };
class HeliosRuntime {
  private readonly programs: Program[] = [];
  private readonly textures: WebGLTexture[] = [];
  private readonly framebuffers: WebGLFramebuffer[] = [];
  private readonly vao: WebGLVertexArrayObject;
  private readonly max: number;
  private W = 0;
  private H = 0;
  private bw = 0;
  private bh = 0;
  private idle: ReturnType<typeof setTimeout> | null = null;

  constructor(readonly canvas: Canvas, readonly gl: WebGL2RenderingContext, private readonly shared = false) {
    if (!gl.getExtension('EXT_color_buffer_float')) throw new HeliosRenderError('HDR framebuffer недоступен');
    this.max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.vao = gl.createVertexArray()!;
    try {
      for (const fragment of [shaders.prepare, shaders.blur, shaders.composite]) this.programs.push(this.program(fragment));
      for (let i = 0; i < 3; i++) this.textures.push(gl.createTexture()!);
      for (let i = 0; i < 2; i++) this.framebuffers.push(gl.createFramebuffer()!);
      // Stable low-discrepancy pupil samples: no frame counter, random seed, or seek state.
      const points = new Float32Array(shaders.HELIOS_SAMPLES * 2);
      for (let i = 0; i < shaders.HELIOS_SAMPLES; i++) {
        const r = Math.sqrt((i + .5) / shaders.HELIOS_SAMPLES), a = i * 2.399963229728653;
        points[i * 2] = Math.cos(a) * r;
        points[i * 2 + 1] = Math.sin(a) * r;
      }
      gl.useProgram(this.programs[1].value);
      gl.uniform2fv(this.uniform(this.programs[1], 'pupil[0]'), points);
    } catch (error) {
      this.dispose();
      throw error;
    }
    (canvas as unknown as EventTarget).addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      if (this.idle) clearTimeout(this.idle);
      if (runtime === this) runtime = null;
      unavailable = null;
    });
  }

  private program(fragment: string): Program {
    const gl = this.gl;
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader); gl.deleteShader(shader);
        throw new HeliosRenderError(info ?? 'shader compilation');
      }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, shaders.vertex);
    let fs: WebGLShader | null = null;
    const value = gl.createProgram()!;
    try {
      fs = compile(gl.FRAGMENT_SHADER, fragment);
      gl.attachShader(value, vs); gl.attachShader(value, fs); gl.linkProgram(value);
      if (!gl.getProgramParameter(value, gl.LINK_STATUS)) throw new HeliosRenderError(gl.getProgramInfoLog(value) ?? 'shader linking');
      return { value, uniforms: new Map() };
    } catch (error) {
      gl.deleteProgram(value); throw error;
    } finally {
      gl.deleteShader(vs); if (fs) gl.deleteShader(fs);
    }
  }

  private uniform(program: Program, name: string): WebGLUniformLocation | null {
    if (!program.uniforms.has(name)) program.uniforms.set(name, this.gl.getUniformLocation(program.value, `u_${name}`));
    return program.uniforms.get(name)!;
  }

  private allocate(W: number, H: number): void {
    if (W === this.W && H === this.H) return;
    const gl = this.gl;
    if (W > this.max || H > this.max) throw new HeliosRenderError(`максимальный размер ${this.max} px`);
    this.canvas.width = W; this.canvas.height = H;
    const scale = Math.min(1, 540 / Math.min(W, H), 1280 / Math.max(W, H));
    this.bw = Math.max(1, Math.round(W * scale)); this.bh = Math.max(1, Math.round(H * scale));
    for (let i = 0; i < 3; i++) {
      gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, i === 0 ? gl.RGBA8 : gl.RGBA16F,
        i === 2 ? this.bw : W, i === 2 ? this.bh : H, 0, gl.RGBA, i === 0 ? gl.UNSIGNED_BYTE : gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, i < 2 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (i > 0) {
        if (i === 1) gl.generateMipmap(gl.TEXTURE_2D);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffers[i - 1]);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textures[i], 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new HeliosRenderError('HDR framebuffer неполон');
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.W = W; this.H = H;
  }

  draw(input: Canvas, e: HeliosSettings, width: number, height: number): Canvas {
    const gl = this.gl, W = input.width, H = input.height;
    if (gl.isContextLost()) throw new HeliosRenderError('контекст потерян');
    resetPostContext(gl, this.canvas, W, H);
    this.allocate(W, H);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
    // Texture and framebuffer coordinates both use bottom-left; invert only at upload.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, input);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.generateMipmap(gl.TEXTURE_2D);
    const short = Math.max(1, Math.min(width, height));
    for (let pass = 0; pass < 3; pass++) {
      const p = this.programs[pass], u = (name: string) => this.uniform(p, name);
      const pw = pass === 1 ? this.bw : W, ph = pass === 1 ? this.bh : H;
      gl.useProgram(p.value); gl.viewport(0, 0, pw, ph);
      gl.bindFramebuffer(gl.FRAMEBUFFER, pass < 2 ? this.framebuffers[pass] : null);
      gl.uniform2f(u('size'), pw, ph);
      gl.uniform2f(u('aspect'), width / short, height / short);
      gl.uniform2f(u('focus'), e.focusX, 1 - e.focusY);
      gl.uniform4f(u('lens'), e.focusRadius, e.focusFeather, e.aperture, e.blur / 1080);
      gl.uniform4f(u('character'), e.swirl, e.curvature, e.highlightBoost, e.vignette);
      gl.uniform1f(u('amount'), e.amount);
      if (pass === 1) {
        gl.bindTexture(gl.TEXTURE_2D, this.textures[1]);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.uniform1i(u('radiance'), 0);
        gl.uniform2f(u('sourceSize'), W, H);
      } else {
        gl.bindTexture(gl.TEXTURE_2D, this.textures[0]);
        gl.uniform1i(u('input'), 0);
        if (pass === 2) {
          gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.textures[2]);
          gl.uniform1i(u('blurred'), 1); gl.activeTexture(gl.TEXTURE0);
        }
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    if (typeof window !== 'undefined') {
      if (this.idle) clearTimeout(this.idle);
      this.idle = setTimeout(() => {
        this.idle = null;
        // Recreating textures releases every old mip level, not only level zero.
        for (let i = 0; i < this.textures.length; i++) {
          gl.deleteTexture(this.textures[i]);
          this.textures[i] = gl.createTexture()!;
        }
        this.W = 0; this.H = 0;
        this.allocate(1, 1);
      }, 5000);
    }
    return this.canvas;
  }

  dispose(): void {
    if (this.idle) clearTimeout(this.idle);
    for (const texture of this.textures) this.gl.deleteTexture(texture);
    for (const framebuffer of this.framebuffers) this.gl.deleteFramebuffer(framebuffer);
    for (const program of this.programs) this.gl.deleteProgram(program.value);
    this.gl.deleteVertexArray(this.vao);
    if (!this.shared) {
      this.canvas.width = 1; this.canvas.height = 1;
      this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  }
}

let runtime: HeliosRuntime | null = null;
let unavailable: HeliosRenderError | null = null;
function gpu(): HeliosRuntime {
  if (runtime) return runtime;
  if (unavailable) throw unavailable;
  try {
    const shared = sharedWorkerContext();
    const canvas = shared?.canvas ?? (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1)
      : typeof document !== 'undefined' ? document.createElement('canvas') : null);
    const gl = shared?.gl ?? canvas?.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: false }) as WebGL2RenderingContext | null;
    if (!canvas || !gl) throw new HeliosRenderError();
    runtime = new HeliosRuntime(canvas, gl, !!shared);
    return runtime;
  } catch (error) {
    unavailable = error instanceof HeliosRenderError ? error : new HeliosRenderError(error instanceof Error ? error.message : undefined);
    throw unavailable;
  }
}

/** The lens is time-invariant: arbitrary seeks and worker frames use the identical pupil. */
export function applyHeliosEffect(ctx: Ctx2D, settings: HeliosSettings, width: number, height: number, _t?: number, _fps?: Fps): void {
  if (!heliosActive(settings)) return;
  const canvas = ctx.canvas as Canvas;
  if (!canvas.width || !canvas.height) return;
  const output = gpu().draw(canvas, settings, width, height);
  ctx.save();
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(output, 0, 0);
  } finally { ctx.restore(); }
}

export function disposeHeliosEffect(): void {
  runtime?.dispose(); runtime = null; unavailable = null;
}
