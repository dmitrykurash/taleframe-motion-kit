/**
 * Optional helpers for transition modules (WebGL2 / GLSL ES 3.00), ported from
 * docs/research/transitions/harness/gl-kit.js with the same exports. Main
 * thread and workers alike (no DOM).
 *
 * Conventions (host.ts, contract §5.3 and §6):
 *   - GL-native bottom-left origin everywhere: uv = gl_FragCoord.xy / res,
 *     +y is UP. texA / texB are uploaded with UNPACK_FLIP_Y_WEBGL so
 *     texture(texA, uv) is upright with that uv.
 *   - texA / texB and the output hold sRGB-encoded 8-bit values: decode with
 *     toLinear() for light-correct maths, encode with toSrgb().
 */

/* ------------------------------------------------------------ programs */

/** Fullscreen triangle, no attributes: vUv in [0,1]² over the viewport (bottom-left origin). */
export const FULLSCREEN_VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export interface Program {
  program: WebGLProgram;
  /** Every active uniform by name (arrays by their base name). */
  u: Record<string, WebGLUniformLocation | null>;
}

/**
 * Compiles and links a program. Throws with the info log and the numbered
 * source lines around the error on failure.
 */
export function program(gl: WebGL2RenderingContext, fragSrc: string, vertSrc: string = FULLSCREEN_VS): Program {
  const compile = (type: number, src: string): WebGLShader => {
    const s = gl.createShader(type);
    if (!s) throw new Error('createShader failed (context lost?)');
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s) || '';
      const m = /ERROR: \d+:(\d+)/.exec(log);
      const line = m ? Number(m[1]) : 0;
      const around = src
        .split('\n')
        .map((l, i) => `${String(i + 1).padStart(4)}  ${l}`)
        .slice(Math.max(0, line - 4), line + 3)
        .join('\n');
      gl.deleteShader(s);
      throw new Error(`${type === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader: ${log}\n${around}`);
    }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, vertSrc);
  const fs = compile(gl.FRAGMENT_SHADER, fragSrc);
  const p = gl.createProgram();
  if (!p) throw new Error('createProgram failed (context lost?)');
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`link: ${gl.getProgramInfoLog(p)}`);
  const u: Record<string, WebGLUniformLocation | null> = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    if (!info) continue;
    u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
  }
  return { program: p, u };
}

const emptyVaos = new WeakMap<WebGL2RenderingContext, WebGLVertexArrayObject>();

/** Draws the fullscreen triangle (binds an attribute-less VAO, then unbinds it). */
export function fullscreen(gl: WebGL2RenderingContext): void {
  let vao = emptyVaos.get(gl);
  if (!vao) {
    vao = gl.createVertexArray()!;
    emptyVaos.set(gl, vao);
  }
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}

/** Forget the cached VAO of a context (after it was lost). */
export function forgetContext(gl: WebGL2RenderingContext): void {
  const vao = emptyVaos.get(gl);
  if (vao && !gl.isContextLost()) gl.deleteVertexArray(vao);
  emptyVaos.delete(gl);
}

/** Binds `tex` to texture unit `unit` and points sampler uniform `loc` at it. */
export function bindTex(gl: WebGL2RenderingContext, loc: WebGLUniformLocation | null, tex: WebGLTexture | null, unit: number): void {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(loc, unit);
}

/* ------------------------------------------------------------- targets */

export interface Target {
  tex: WebGLTexture;
  fb: WebGLFramebuffer;
  width: number;
  height: number;
  /** Reallocates only when the size changed; call every render. */
  ensure(w: number, h: number): Target;
  /** Binds the framebuffer and sets the viewport to its size. */
  bind(): Target;
  dispose(): void;
}

/**
 * An offscreen render target (texture + framebuffer): 'rgba8' (default) or
 * 'rgba16f' (EXT_color_buffer_float: linear-light intermediates, blur chains).
 */
export function target(
  gl: WebGL2RenderingContext,
  { format = 'rgba8', filter = 'linear', wrap = 'clamp' }: { format?: 'rgba8' | 'rgba16f'; filter?: 'linear' | 'nearest'; wrap?: 'clamp' | 'repeat' | 'mirror' } = {},
): Target {
  if (format === 'rgba16f') gl.getExtension('EXT_color_buffer_float');
  const t: Target = {
    tex: gl.createTexture()!,
    fb: gl.createFramebuffer()!,
    width: 0,
    height: 0,
    ensure(w: number, h: number) {
      w = Math.max(1, Math.round(w));
      h = Math.max(1, Math.round(h));
      if (w === t.width && h === t.height) return t;
      // Immutable storage is per size: a new texture when the size changes.
      gl.deleteTexture(t.tex);
      t.tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t.tex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, format === 'rgba16f' ? gl.RGBA16F : gl.RGBA8, w, h);
      const f = filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
      const wr = wrap === 'repeat' ? gl.REPEAT : wrap === 'mirror' ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t.tex, 0);
      const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (st !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`framebuffer incomplete: 0x${st.toString(16)}`);
      t.width = w;
      t.height = h;
      return t;
    },
    bind() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.viewport(0, 0, t.width, t.height);
      return t;
    },
    dispose() {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fb);
    },
  };
  return t;
}

/* ----------------------------------------------------- deterministic data */

/** Seeded PRNG (mulberry32): same seed → same sequence on every thread. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** size×size RGBA8 uniform noise per channel from `seed` (REPEAT wrap). Generate once in create(). */
export function noiseTexture(gl: WebGL2RenderingContext, size = 256, seed = 1, { filter = 'linear' }: { filter?: 'linear' | 'nearest' } = {}): WebGLTexture {
  const rnd = mulberry32(seed);
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(rnd() * 256);
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  const f = filter === 'nearest' ? gl.NEAREST : gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

/* ---------------------------------------------------------- param helpers */

/** '#rrggbb' → [r, g, b] in 0..1 (sRGB-encoded, as the picture). */
export function hexToRgb(hex: unknown): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  const n = m ? parseInt(m[1], 16) : 0;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** sRGB-encoded 0..1 → linear light (exact piecewise curve). */
export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** A 'direction' value → unit vector in GL space (+y up); names where the OUTGOING picture moves. */
export function dirVec(dir: unknown): [number, number] {
  const s = Math.SQRT1_2;
  switch (dir) {
    case 'left':
      return [-1, 0];
    case 'right':
      return [1, 0];
    case 'up':
      return [0, 1];
    case 'down':
      return [0, -1];
    case 'up-left':
      return [-s, s];
    case 'up-right':
      return [s, s];
    case 'down-left':
      return [-s, -s];
    case 'down-right':
      return [s, -s];
    default:
      return [-1, 0];
  }
}

/** A 'point' value ({x, y} frame fractions, top-left origin) → GL uv (bottom-left origin). */
export function pointToGl(p: unknown): [number, number] {
  const q = p as { x?: number; y?: number } | null | undefined;
  return [q?.x ?? 0.5, 1 - (q?.y ?? 0.5)];
}

/* ------------------------------------------------------ choreography (JS) */

export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
/** Progress of a sub-phase [a, b], clamped to 0..1. */
export const phase = (p: number, a: number, b: number): number => clamp01((p - a) / (b - a));
export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
export { cubicBezier as bezier } from './easing';

/* ------------------------------------------------------------- GLSL chunks */

/** Paste into shaders: `${GLSL.srgb}` etc. Each chunk is self-contained (noise needs hash). */
export const GLSL = {
  srgb: `
vec3 toLinear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
vec3 toSrgb(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
`,
  luma: `
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`,
  /** Integer hash (pcg-style), stable across GPUs; returns 0..1. Seed with a uniform. */
  hash: `
uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float hash11(float p) { return float(pcg(floatBitsToUint(p))) / 4294967295.0; }
float hash21(vec2 p) { return float(pcg(pcg(floatBitsToUint(p.x)) + floatBitsToUint(p.y))) / 4294967295.0; }
float hash2i(ivec2 p, uint seed) { return float(pcg(pcg(uint(p.x) + seed) + uint(p.y))) / 4294967295.0; }
vec2 hash22i(ivec2 p, uint seed) { uint h = pcg(pcg(uint(p.x) + seed) + uint(p.y)); return vec2(float(h), float(pcg(h))) / 4294967295.0; }
`,
  /** Value noise and fbm on an integer lattice (needs hash). */
  noise: `
float vnoise(vec2 p, uint seed) {
  ivec2 i = ivec2(floor(p)); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash2i(i, seed), b = hash2i(i + ivec2(1, 0), seed), c = hash2i(i + ivec2(0, 1), seed), d = hash2i(i + ivec2(1, 1), seed);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p, uint seed, int oct) {
  float s = 0.0, a = 0.5;
  for (int k = 0; k < 8; k++) { if (k >= oct) break; s += a * vnoise(p, seed + uint(k) * 1013u); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
`,
  /** Aspect-correct frame coordinates: centred, short side = 1 (circles stay round in 16:9, 9:16, 1:1). */
  frame: `
vec2 frameCoord(vec2 uv, vec2 res) { vec2 p = (uv - 0.5) * res; return p / min(res.x, res.y); }
`,
  /** Samples with a clamp that shows `outside` past the frame instead of stretching the edge. */
  sampleOr: `
vec4 sampleOr(sampler2D t, vec2 uv, vec4 outside) { return (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? outside : texture(t, uv); }
`,
  /** Anti-aliased step over about one pixel: aastep(edge, x) with fwidth. */
  aa: `
float aastep(float edge, float x) { float w = max(fwidth(x), 1e-5); return smoothstep(edge - 0.5 * w, edge + 0.5 * w, x); }
`,
} as const;
