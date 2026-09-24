/**
 * The transition host (port of docs/research/transitions/harness/harness.js
 * TransitionHost): owns the two input textures of one WebGL2 context, uploads
 * the scene pictures, guarantees the GL state around module calls (contract
 * §5.3) and caches one module instance per kind.
 *
 * Inputs: immutable RGBA8 storage per size (texStorage2D), refreshed every
 * frame with texSubImage2D from the 2D picture canvases with
 * UNPACK_FLIP_Y_WEBGL, so every texture and framebuffer has GL's bottom-left
 * origin. sRGB-encoded values (no sRGB textures: 2× slower upload at 4K;
 * modules decode with toLinear()).
 */
import { bindTex, forgetContext, fullscreen, program, type Program } from './kit';
import type { TransitionEnv, TransitionInstance, TransitionModule, TransitionRenderArgs } from './types';

export const CONTEXT_ATTRS: WebGLContextAttributes = {
  alpha: true,
  antialias: false,
  depth: false,
  stencil: false,
  premultipliedAlpha: false,
  preserveDrawingBuffer: false,
  powerPreference: 'high-performance',
};

export type HostRenderArgs = Omit<TransitionRenderArgs, 'texA' | 'texB'>;

export class TransitionHost {
  readonly gl: WebGL2RenderingContext;
  readonly env: TransitionEnv;
  private texA: WebGLTexture | null = null;
  private texB: WebGLTexture | null = null;
  private width = 0;
  private height = 0;
  private mipmaps = false;
  private readonly instances = new Map<string, TransitionInstance>();
  private readonly failed = new Set<string>();
  private readonly px = new Uint8Array(4);
  private alphaProgram: Program | null = null;
  /** Texture units whose sampler binding resetState clears (modules use a handful). */
  private readonly samplerUnits: number;
  /** create() cost per kind (ms), for the log and the perf check. */
  readonly createMs = new Map<string, number>();

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const floatExt = gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    gl.getExtension('KHR_parallel_shader_compile');
    this.env = {
      worker: typeof window === 'undefined',
      floatTargets: !!floatExt,
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    };
    const units = Number(gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS));
    this.samplerUnits = Math.min(16, Number.isFinite(units) && units > 0 ? units : 16);
  }

  get size(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  /** Two W×H input textures (reallocated only when the size or the mipmap need changes). */
  ensureInputs(width: number, height: number, mipmaps = false): void {
    const gl = this.gl;
    if (this.texA && width === this.width && height === this.height && mipmaps === this.mipmaps) return;
    this.releaseInputs();
    const levels = mipmaps ? 1 + Math.floor(Math.log2(Math.max(width, height))) : 1;
    const make = (): WebGLTexture => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA8, width, height);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.texA = make();
    this.texB = make();
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.width = width;
    this.height = height;
    this.mipmaps = mipmaps;
  }

  /**
   * Upload a W×H 2D canvas into input 'A' or 'B' (GPU copy when the canvas is GPU-backed).
   * Canvases only: UNPACK_FLIP_Y_WEBGL is ignored for ImageBitmap / VideoFrame sources, which would land upside down.
   */
  upload(which: 'A' | 'B', source: TexImageSource): void {
    const gl = this.gl;
    const tex = which === 'A' ? this.texA : this.texB;
    if (!tex) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (this.mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  /**
   * The state every module can rely on at entry (and that the host restores
   * after). Beyond the contract's list (§5.3) it also clears what one module
   * could leave behind that silently breaks the next module or the host's own
   * uploads: RASTERIZER_DISCARD and the other capabilities (a leaked discard
   * drops every later draw, so the viewer would freeze on a stale picture),
   * sampler objects on the first texture units (a leaked REPEAT / NEAREST
   * sampler overrides texA / texB's parameters in modules that bind no
   * sampler), pixel pack / unpack buffers and the unpack rectangle.
   */
  resetState(): void {
    const gl = this.gl;
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.RASTERIZER_DISCARD);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    gl.disable(gl.SAMPLE_COVERAGE);
    gl.colorMask(true, true, true, true);
    gl.bindVertexArray(null);
    gl.useProgram(null);
    for (let u = 0; u < this.samplerUnits; u++) gl.bindSampler(u, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.pixelStorei(gl.UNPACK_ROW_LENGTH, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_ROWS, 0);
    gl.pixelStorei(gl.UNPACK_SKIP_PIXELS, 0);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 4);
  }

  /** The cached instance of a module (created on first use); null when its create() threw. */
  instance(mod: TransitionModule): TransitionInstance | null {
    const id = mod.meta.id;
    const have = this.instances.get(id);
    if (have) return have;
    if (this.failed.has(id)) return null;
    const t0 = performance.now();
    try {
      this.resetState();
      const inst = mod.create(this.gl, this.env);
      this.createMs.set(id, performance.now() - t0);
      this.instances.set(id, inst);
      return inst;
    } catch (e) {
      this.failed.add(id);
      throw new Error(`Transition ${id} failed to initialize`, {cause: e});
    } finally {
      this.resetState();
    }
  }

  /**
   * Renders one frame into `args.target` (null: the canvas). False when there
   * are no inputs or the module threw: a throwing module is dropped and marked
   * failed. The adapter surfaces the original error and cancels the export;
   * it never silently substitutes a different transition.
   */
  render(instance: TransitionInstance, args: HostRenderArgs): boolean {
    const gl = this.gl;
    if (!this.texA || !this.texB) return false;
    this.resetState();
    gl.bindFramebuffer(gl.FRAMEBUFFER, args.target ?? null);
    gl.viewport(0, 0, args.width, args.height);
    try {
      instance.render({ ...args, texA: this.texA, texB: this.texB, target: args.target ?? null });
      return true;
    } catch (e) {
      this.drop(instance, e);
      throw new Error('Transition failed to render', {cause: e});
    } finally {
      this.resetState();
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
  }

  /** Restore coverage from the same transition over black and white mattes.
   * This keeps existing transition materials (including white paper) while
   * allowing their empty regions to reveal layers below a transparent precomp.
   * Inputs contain the two completed opaque transition pictures.
   */
  reconstructAlpha(width: number, height: number): void {
    const gl = this.gl;
    this.alphaProgram ??= program(gl, `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uBlack, uWhite;
out vec4 outColor;
void main() {
  vec3 b = texture(uBlack,vUv).rgb, w = texture(uWhite,vUv).rgb;
  vec3 difference = clamp(w-b,0.0,1.0);
  float alpha = 1.0-max(difference.r,max(difference.g,difference.b));
  outColor = vec4(alpha > 0.001 ? clamp(b/alpha,0.0,1.0) : vec3(0),alpha);
}`);
    this.resetState();
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, width, height);
    gl.useProgram(this.alphaProgram.program);
    bindTex(gl, this.alphaProgram.u.uBlack, this.texA, 0);
    bindTex(gl, this.alphaProgram.u.uWhite, this.texB, 1);
    fullscreen(gl);
    this.resetState();
  }

  /** Forget an instance whose render threw: disposed, its kind marked failed until the context is renewed. */
  private drop(instance: TransitionInstance, error: unknown): void {
    for (const [id, inst] of this.instances) {
      if (inst !== instance) continue;
      this.instances.delete(id);
      this.failed.add(id);
      // Keep the original module error as the cause returned to the renderer.
      void error;
      try {
        inst.dispose();
      } catch {
        /* half-built */
      }
    }
  }

  /** Blocks until the GPU finished everything submitted (1×1 readPixels). */
  sync(): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.px);
  }

  /** RGBA8 pixels of the default framebuffer, bottom-up rows (tests, parity checks). */
  readAll(width = this.width, height = this.height): Uint8Array {
    const gl = this.gl;
    const out = new Uint8Array(width * height * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return out;
  }

  /** Free the input textures (idle release); they come back on the next ensureInputs. */
  releaseInputs(): void {
    const gl = this.gl;
    if (this.texA) gl.deleteTexture(this.texA);
    if (this.texB) gl.deleteTexture(this.texB);
    this.texA = this.texB = null;
    this.width = this.height = 0;
  }

  /** Drop everything (context lost or disposed). `lost`: the objects are gone already, skip GL calls. */
  dispose(lost = false): void {
    if (!lost) {
      if (this.alphaProgram) this.gl.deleteProgram(this.alphaProgram.program);
      for (const inst of this.instances.values()) {
        try {
          inst.dispose();
        } catch {
          /* already gone */
        }
      }
      this.releaseInputs();
    }
    this.instances.clear();
    this.alphaProgram = null;
    this.failed.clear();
    this.texA = this.texB = null;
    forgetContext(this.gl);
  }
}
