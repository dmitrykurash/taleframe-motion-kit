// Deterministic noise for hand-made edges (ink fronts, wet blooms, dust). No Math.random anywhere: every value is a
// pure function of its coordinates and seed, so frames render the same in any order.

export function hash(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const SIZE = 256;
const fields = new Map<number, Float32Array>();
/** Tileable value-noise fBm, 256 × 256, values about 0..1. Built once per seed. */
function field(seed: number): Float32Array {
  let f = fields.get(seed);
  if (f) return f;
  f = new Float32Array(SIZE * SIZE);
  const octave = (period: number, s: number) => {
    const cells = SIZE / period;
    return (x: number, y: number) => {
      const gx = x / period, gy = y / period;
      const x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const v = (i: number, j: number) => hash(((i % cells) + cells) % cells, ((j % cells) + cells) % cells, s);
      const a = v(x0, y0), b = v(x0 + 1, y0), c = v(x0, y0 + 1), d = v(x0 + 1, y0 + 1);
      return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
  };
  const octaves = [octave(64, seed + 1), octave(32, seed + 2), octave(16, seed + 3), octave(8, seed + 4), octave(4, seed + 5)];
  const weights = [.5, .25, .13, .07, .05];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    let v = 0;
    for (let k = 0; k < octaves.length; k++) v += octaves[k](x, y) * weights[k];
    f[y * SIZE + x] = v;
  }
  fields.set(seed, f);
  return f;
}

/** Bilinear fBm lookup in noise texels (256 per tile), wrapping. */
export function fbm(x: number, y: number, seed = 7): number {
  const f = field(seed);
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const i0 = ((x0 % SIZE) + SIZE) % SIZE, j0 = ((y0 % SIZE) + SIZE) % SIZE;
  const i1 = (i0 + 1) % SIZE, j1 = (j0 + 1) % SIZE;
  const a = f[j0 * SIZE + i0], b = f[j0 * SIZE + i1], c = f[j1 * SIZE + i0], d = f[j1 * SIZE + i1];
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Smoothstep from e0 to e1. */
export const smooth = (e0: number, e1: number, v: number) => {const t = clamp01((v - e0) / (e1 - e0)); return t * t * (3 - 2 * t);};
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
export const easeInOutCubic = (t: number) => {t = clamp01(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;};
export const easeInQuad = (t: number) => Math.pow(clamp01(t), 2);
