/** Ordered finishing passes, shared by viewer and export worker. */
import type { Ctx2D } from '../types';
import type { Affine } from '../types';
import type { Fps, PostEffects, Project } from '../types';
import { processPixels } from './cpu';
import { chromaticBlurPlan } from './chromatic';
import { stopmotionVisualState, type StopmotionVisualState } from './stopmotion/visual';
import { stopmotionFrame } from './stopmotion/timing';
import { STOPMOTION_SHADER } from './stopmotion/shader';
import { grainTick, postEffectsActive, rgb } from './model';
import { isolatePostEffect, postEffectPasses } from './passes';
import { applyPaintEffects, disposePaintEffects } from './paint/render';
import type { PaintRenderContext } from './paint/temporal/types';
import { applyHeliosEffect, disposeHeliosEffect } from './helios/render';
import { sharedWorkerContext, disposeSharedWorkerContext, resetPostContext } from './sharedWorkerContext';

type Canvas = HTMLCanvasElement | OffscreenCanvas;
const VERTEX = `#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;
const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_image,u_fringe;
uniform vec2 u_size, u_project;
uniform vec4 u_grain;
uniform uint u_tick;
uniform int u_blend;
uniform vec4 u_chromatic;
uniform vec2 u_lens;
uniform float u_duotone;
uniform vec3 u_shadows,u_highlights;
out vec4 outColor;
float noise(uvec2 p,uint channel){uint h=p.x*374761393u^p.y*668265263u^u_tick*2246822519u^(channel+1u)*3266489917u;h=(h^(h>>16))*2246822519u;h=(h^(h>>13))*3266489917u;return float(h^(h>>16))/4294967295.;}
vec4 sampleAt(vec2 uv){return texture(u_image,vec2(uv.x,1.-uv.y));}
${STOPMOTION_SHADER}
vec3 blendGrain(vec3 b,vec3 n){
 if(u_blend==0)return n;
 if(u_blend==1)return mix(2.*b*n,1.-2.*(1.-b)*(1.-n),step(vec3(.5),b));
 vec3 d=mix(((16.*b-12.)*b+4.)*b,sqrt(b),step(vec3(.25),b));
 return mix(b-(1.-2.*n)*b*(1.-b),b+(2.*n-1.)*(d-b),step(vec3(.5),n));
}
void main(){
 vec2 uv=vec2(gl_FragCoord.x/u_size.x,1.-gl_FragCoord.y/u_size.y);
 vec2 p=uv*2.-1.;
 vec2 source=.5+p*.5*(1.+u_lens.x*dot(p,p))/u_lens.y;
 source=handmadeUV(source);
 vec4 mid=sampleAt(source);
 float alpha=mid.a;
 vec3 color=mid.rgb;
 if(u_chromatic.x!=0.){
  // Only the separated edge field is soft. The source itself stays sharp.
  vec2 fringe=texture(u_fringe,vec2(uv.x,1.-uv.y)).rb;
  float signedEdge=fringe.x-fringe.y;
  float coverage=clamp(abs(signedEdge),0.,1.);
  // Opposite fringes cancel instead of forming a magenta/green third image.
  vec3 tint=signedEdge>=0.?vec3(1.,0.,0.):vec3(0.,0.,1.);
  tint=mix(vec3(.5),tint,u_chromatic.w);
  color=color*(1.-coverage)+tint*coverage;
  alpha=alpha+(1.-alpha)*coverage;
 }
 color=alpha>1e-6?color/alpha:vec3(0.);
 color=handmadeSurface(color,source);
 float luma=dot(color,vec3(.2126,.7152,.0722));
 color=mix(color,mix(u_shadows,u_highlights,luma),u_duotone);
 if(u_grain.x>0.){uvec2 cell=uvec2(floor(uv*u_project/u_grain.y+vec2(.001)));float n=noise(cell,0u);vec3 grain=u_grain.z>.5?vec3(n):vec3(n,noise(cell,1u),noise(cell,2u));color=mix(color,blendGrain(color,grain),u_grain.x);}
 outColor=vec4(clamp(color,0.,1.),alpha);
}`;

const FRINGE_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform vec2 u_size,u_project;
uniform vec4 u_chromatic;
out vec4 outColor;
vec4 sampleAt(vec2 uv){return texture(u_image,vec2(uv.x,1.-uv.y));}
void main(){
 vec2 uv=vec2(gl_FragCoord.x/u_size.x,1.-gl_FragCoord.y/u_size.y);
 vec2 axis=mix(vec2(1.,0.),uv*2.-1.,u_chromatic.z);
 float co=cos(u_chromatic.y),si=sin(u_chromatic.y);
 vec2 shift=vec2(axis.x*co-axis.y*si,axis.x*si+axis.y*co)*u_chromatic.x/u_project;
 vec4 mid=sampleAt(uv),red=sampleAt(uv+shift),blue=sampleAt(uv-shift);
 vec3 luma=vec3(.2126,.7152,.0722);
 float light=dot(red.rgb+mid.rgb+blue.rgb,luma)/max(red.a+mid.a+blue.a,1e-6);
 // Remove opacity-driven luminance before adding an independent coverage
 // edge. Gray/colored transparent objects keep the same red/blue direction
 // as their brightness changes; invisible RGB never enters the field.
 float alphaDelta=red.a-blue.a;
 float edge=clamp(dot(red.rgb-blue.rgb,luma)-(light+1.)*alphaDelta,-1.,1.);
 outColor=vec4(max(edge,0.),0.,max(-edge,0.),1.);
}`;

const BLUR_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D u_image;
uniform vec2 u_size,u_step;
uniform float u_weights[7];
uniform int u_downsample;
out vec4 outColor;
void main(){
 vec2 uv=gl_FragCoord.xy/u_size;
 if(u_downsample==1){
  vec2 d=.25/u_size;
  outColor=(texture(u_image,uv-d)+texture(u_image,uv+d)+texture(u_image,uv+vec2(d.x,-d.y))+texture(u_image,uv+vec2(-d.x,d.y)))*.25;
 }else{
  vec4 c=texture(u_image,uv)*u_weights[0];
  for(int i=1;i<=6;i++)c+=(texture(u_image,uv+float(i)*u_step)+texture(u_image,uv-float(i)*u_step))*u_weights[i];
  outColor=c;
 }
}`;
type BlurTarget = { texture: WebGLTexture; framebuffer: WebGLFramebuffer; width: number; height: number };

class PostRuntime {
  readonly gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private vao: WebGLVertexArrayObject;
  private blurProgram: WebGLProgram;
  private blurUniforms = new Map<string, WebGLUniformLocation | null>();
  private fringeProgram: WebGLProgram;
  private fringeUniforms = new Map<string, WebGLUniformLocation | null>();
  private targets: BlurTarget[];
  private floatTargets: boolean;
  private uniforms = new Map<string, WebGLUniformLocation | null>();
  private tw = 0;
  private th = 0;
  private idle: ReturnType<typeof setTimeout> | null = null;
  private readonly max: number;
  constructor(
    readonly canvas: Canvas,
    gl: WebGL2RenderingContext,
    private readonly shared = false,
  ) {
    this.gl = gl;
    const shader = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error(message ?? 'Postprocessing shader failed');
      }
      return s;
    };
    const program = (fragment: string) => {
      const vs = shader(gl.VERTEX_SHADER, VERTEX), fs = shader(gl.FRAGMENT_SHADER, fragment), result = gl.createProgram()!;
      gl.attachShader(result, vs); gl.attachShader(result, fs); gl.linkProgram(result);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result) ?? 'Postprocessing program failed');
      return result;
    };
    this.program = program(FRAGMENT);
    this.blurProgram = program(BLUR_FRAGMENT);
    this.fringeProgram = program(FRINGE_FRAGMENT);
    this.floatTargets = !!gl.getExtension('EXT_color_buffer_float');
    this.targets = [];
    for (const name of ['image', 'size', 'step', 'weights[0]', 'downsample']) this.blurUniforms.set(name, gl.getUniformLocation(this.blurProgram, `u_${name}`));
    for (const name of ['image', 'size', 'project', 'chromatic']) this.fringeUniforms.set(name, gl.getUniformLocation(this.fringeProgram, `u_${name}`));
    this.texture = gl.createTexture()!;
    this.vao = gl.createVertexArray()!;
    this.max = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    for (const name of ['image', 'fringe', 'size', 'project', 'grain', 'tick', 'blend', 'chromatic', 'lens', 'duotone', 'shadows', 'highlights', 'stop', 'stopMaterial', 'stopSeed', 'stopPose'])
      this.uniforms.set(name, gl.getUniformLocation(this.program, `u_${name}`));
    (canvas as unknown as EventTarget).addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      if (this.idle) clearTimeout(this.idle);
      if (runtime === this) { runtime = null; unavailable = false; }
    });
  }
  private target(index: number, width: number, height: number): BlurTarget {
    const gl = this.gl;
    const target = this.targets[index] ??= { texture: gl.createTexture()!, framebuffer: gl.createFramebuffer()!, width: 0, height: 0 };
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    if (target.width !== width || target.height !== height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, this.floatTargets ? gl.RGBA16F : gl.RGBA8, width, height, 0, gl.RGBA, this.floatTargets ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      target.width = width; target.height = height;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
    gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    gl.viewport(0, 0, width, height);
    return target;
  }
  private fringes(W: number, H: number, width: number, height: number, chromatic: PostEffects['chromatic']): WebGLTexture {
    const gl = this.gl, target = this.target(0, W, H);
    const u = (name: string) => this.fringeUniforms.get(name)!;
    gl.useProgram(this.fringeProgram);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1i(u('image'), 0);
    gl.uniform2f(u('size'), W, H); gl.uniform2f(u('project'), width, height);
    gl.uniform4f(u('chromatic'), chromatic.strength, chromatic.angle * Math.PI / 180, chromatic.radial ? 1 : 0, chromatic.redBlue);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.drawBuffers([gl.BACK]); gl.viewport(0, 0, W, H);
    return target.texture;
  }
  /** Only the fringe mask is filtered. A small pyramid keeps even a
   * manually entered large blur smooth without an unbounded shader loop. */
  private blur(input: WebGLTexture, W: number, H: number, width: number, height: number, radius: number): WebGLTexture {
    const gl = this.gl, plan = chromaticBlurPlan(W, H, width, height, radius);
    const u = (name: string) => this.blurUniforms.get(name)!;
    gl.useProgram(this.blurProgram);
    gl.uniform1i(u('image'), 0);
    let targetIndex = 1; // Slot zero retains the original full-size fringe field.
    const pass = (w: number, h: number, downsample: boolean, dx = 0, dy = 0, weights?: Float32Array) => {
      // One retained surface per level/pass. Reusing two surfaces across all
      // pyramid sizes would reallocate their GPU storage on every video frame.
      const index = targetIndex++;
      const target = this.target(index, w, h);
      gl.uniform2f(u('size'), w, h); gl.uniform2f(u('step'), dx, dy); gl.uniform1i(u('downsample'), downsample ? 1 : 0);
      if (weights) gl.uniform1fv(u('weights[0]'), weights);
      gl.bindTexture(gl.TEXTURE_2D, input);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      input = target.texture;
    };
    for (const level of plan.levels) pass(level.width, level.height, true);
    pass(plan.width, plan.height, false, plan.x.step / plan.width, 0, plan.x.weights);
    pass(plan.width, plan.height, false, 0, plan.y.step / plan.height, plan.y.weights);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.drawBuffers([gl.BACK]); gl.viewport(0, 0, W, H);
    return input;
  }
  draw(input: Canvas, e: PostEffects, width: number, height: number, tick: number, stop: StopmotionVisualState | null): Canvas | null {
    const gl = this.gl,
      W = input.width,
      H = input.height;
    if (gl.isContextLost() || W > this.max || H > this.max) return null;
    resetPostContext(gl, this.canvas, W, H);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    if (this.tw !== W || this.th !== H) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      this.tw = W;
      this.th = H;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, input);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    let fringe = this.texture;
    if (e.chromatic.enabled && e.chromatic.strength !== 0) {
      fringe = this.fringes(W, H, width, height, e.chromatic);
      if (e.chromatic.blur > 0) fringe = this.blur(fringe, W, H, width, height, e.chromatic.blur);
    }
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, fringe);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texture);
    const u = (name: string) => this.uniforms.get(name)!;
    gl.uniform1i(u('image'), 0);
    gl.uniform1i(u('fringe'), 1);
    gl.uniform2f(u('size'), W, H);
    gl.uniform2f(u('project'), width, height);
    gl.uniform4f(u('grain'), e.grain.enabled ? e.grain.amount : 0, e.grain.size, e.grain.monochrome ? 1 : 0, 0);
    gl.uniform1ui(u('tick'), tick);
    gl.uniform4f(u('stop'), stop?.x ?? 0, stop?.y ?? 0, stop?.rotation ?? 0, stop?.boil ?? 0);
    gl.uniform3f(u('stopMaterial'), stop?.texture ?? 0, stop?.gain ?? 1, stop ? 1 : 0);
    gl.uniform1ui(u('stopSeed'), stop?.seed ?? 0); gl.uniform1ui(u('stopPose'), stop?.pose ?? 0);
    gl.uniform1i(u('blend'), e.grain.blend === 'normal' ? 0 : e.grain.blend === 'overlay' ? 1 : 2);
    gl.uniform4f(u('chromatic'), e.chromatic.enabled ? e.chromatic.strength : 0, (e.chromatic.angle * Math.PI) / 180, e.chromatic.radial ? 1 : 0, e.chromatic.enabled ? e.chromatic.redBlue : 0);
    gl.uniform2f(u('lens'), e.lens.enabled ? e.lens.distortion : 0, e.lens.enabled ? e.lens.zoom : 1);
    gl.uniform1f(u('duotone'), e.duotone.enabled ? e.duotone.amount : 0);
    gl.uniform3fv(u('shadows'), rgb(e.duotone.shadows));
    gl.uniform3fv(u('highlights'), rgb(e.duotone.highlights));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (typeof window !== 'undefined') {
      if (this.idle) clearTimeout(this.idle);
      this.idle = setTimeout(() => {
        this.idle = null;
        this.canvas.width = 1;
        this.canvas.height = 1;
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        this.tw = 1;
        this.th = 1;
        for (const target of this.targets) {
          gl.bindTexture(gl.TEXTURE_2D, target.texture);
          gl.texImage2D(gl.TEXTURE_2D, 0, this.floatTargets ? gl.RGBA16F : gl.RGBA8, 1, 1, 0, gl.RGBA, this.floatTargets ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
          target.width = target.height = 1;
        }
      }, 5000);
    }
    return this.canvas;
  }
  dispose(): void {
    if (this.idle) clearTimeout(this.idle);
    this.gl.deleteTexture(this.texture);
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
    this.gl.deleteProgram(this.blurProgram);
    this.gl.deleteProgram(this.fringeProgram);
    for (const target of this.targets) { this.gl.deleteTexture(target.texture); this.gl.deleteFramebuffer(target.framebuffer); }
    if (!this.shared) {
      this.canvas.width = 1; this.canvas.height = 1;
      this.gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  }
}
let runtime: PostRuntime | null = null;
let unavailable = false;
function gpu(): PostRuntime | null {
  if (runtime) return runtime;
  if (unavailable) return null;
  try {
    const shared = sharedWorkerContext();
    const canvas =
      shared?.canvas ?? (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : typeof document !== 'undefined' ? document.createElement('canvas') : null);
    const gl = shared?.gl ?? canvas?.getContext('webgl2', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    }) as WebGL2RenderingContext | null;
    if (canvas && gl) return (runtime = new PostRuntime(canvas, gl, !!shared));
  } catch {
    /* The exact same effects remain available through the CPU fallback. */
  }
  unavailable = true;
  return null;
}
/** Release export-worker resources. Main-thread buffers shrink automatically after inactivity. */
export function disposePostEffects(): void {
  disposePaintEffects();
  disposeHeliosEffect();
  runtime?.dispose();
  runtime = null;
  unavailable = false;
  disposeSharedWorkerContext();
}

/** Disabled / zero-strength settings never allocate a buffer or read a pixel. */
export function applyPostEffects(ctx: Ctx2D, project: Project, t: number, fps: Fps, stopmotionAnchor = 0, paintTransform?: Affine, paint?: PaintRenderContext): void {
  const e = project.postEffects;
  if (!postEffectsActive(e)) return;
  const effects = e!;
  // Cadence changes the source pose and the entire stack's material clock;
  // reordering only moves Stopmotion's visible registration/material pass.
  const effectTime = effects.stopmotion?.enabled ? stopmotionFrame(t, effects.stopmotion, fps, stopmotionAnchor) : t;
  const tick = grainTick(effects, effectTime, fps), canvas = ctx.canvas as Canvas;
  for (const key of postEffectPasses(effects)) {
    if (key === 'watercolor' || key === 'pigment') {
      // Capture the actual ordered stack input, after any earlier effect and
      // the compositor's text/transition protection, using the root frame clock.
      const prepared = key === 'watercolor' && effects.watercolor.enabled && paint
        ? paint.provider.resolve({ site: paint.site, frame: paint.frame, canvas,
          projectWidth: project.width, projectHeight: project.height, settings: effects.watercolor }) : null;
      if (key === 'watercolor' && paint?.provider.discoverOnly) continue;
      applyPaintEffects(ctx, key === 'watercolor' ? effects.watercolor : undefined,
        key === 'pigment' ? effects.pigment : undefined, project.width, project.height, effectTime, fps, paintTransform, prepared ?? undefined);
      continue;
    }
    if (key === 'helios') {
      applyHeliosEffect(ctx, effects.helios, project.width, project.height, effectTime, fps);
      continue;
    }
    const single = isolatePostEffect(effects, key);
    const stop = key === 'stopmotion' ? stopmotionVisualState(effects.stopmotion, effectTime, stopmotionAnchor) : null;
    const out = gpu()?.draw(canvas, single, project.width, project.height, tick, stop);
    if (out) {
      ctx.save();
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'copy';
        ctx.drawImage(out, 0, 0);
      } finally { ctx.restore(); }
    } else {
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      frame.data.set(processPixels(frame.data, canvas.width, canvas.height, project.width, project.height, single, tick, stop));
      ctx.putImageData(frame, 0, 0);
    }
  }
}
