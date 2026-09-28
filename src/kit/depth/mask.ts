// Watercolor-edged masks: the wet front of a wash is ragged at two scales (broad lobes and fine capillary fingers).
// Masks are built at low resolution and drawn scaled with smoothing, which keeps the front soft.
import {fbm, smooth} from './noise';

function canvas(w: number, h: number) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return c;
}

export type BloomOptions = {
  /** Mask resolution (small: 480 × 270 is plenty for a full frame). */
  width: number; height: number;
  /** Centre in 0..1 of the mask. */
  cx: number; cy: number;
  /** Radius in mask heights. */
  radius: number;
  /** Softness of the front, in radius units. */
  feather?: number;
  /** Raggedness of the front (radius units) and the lobe size (noise texels per mask height). */
  ragged?: number; scale?: number;
  /** Horizontal stretch (1 = round). */
  aspect?: number;
  seed?: number;
  /** 1 outside the bloom instead (the wash eats the picture away). */
  invert?: boolean;
};

/** A wet bloom spreading from a point: alpha 1 inside, a ragged soft front, 0 outside. */
export function bloomMask(o: BloomOptions): HTMLCanvasElement {
  const {width: w, height: h} = o;
  const c = canvas(w, h), ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h), d = img.data;
  const feather = o.feather ?? .08, ragged = o.ragged ?? .22, scale = (o.scale ?? 90) / h, aspect = o.aspect ?? 1;
  const seed = o.seed ?? 11, R = Math.max(1e-4, o.radius);
  for (let y = 0; y < h; y++) {
    const dy = (y / h - o.cy) / R;
    for (let x = 0; x < w; x++) {
      const dx = (x / h - o.cx * w / h) / (R * aspect);
      const dist = Math.sqrt(dx * dx + dy * dy);
      // Two octaves of front displacement: broad lobes and fine fingers, stronger far from the centre.
      const n = (fbm(x * scale, y * scale, seed) - .5) * 2 + (fbm(x * scale * 4.3, y * scale * 4.3, seed + 9) - .5) * .55;
      const v = dist + n * ragged * Math.min(1, dist * 1.4);
      let a = 1 - smooth(1 - feather, 1 + feather, v);
      if (o.invert) a = 1 - a;
      d[(y * w + x) * 4 + 3] = a * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export type SweepOptions = {
  width: number; height: number;
  /** 0 = nothing revealed, 1 = everything. */
  progress: number;
  /** Softness and raggedness of the front, as fractions of the width. */
  feather?: number; ragged?: number;
  /** Noise lobes per mask height. */
  scale?: number;
  seed?: number;
  /** 1 reveals left to right, -1 right to left. */
  direction?: 1 | -1;
};

/** A wash front sweeping across (inks words in): alpha 1 behind the front. */
export function sweepMask(o: SweepOptions): HTMLCanvasElement {
  const {width: w, height: h} = o;
  const c = canvas(w, h), ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h), d = img.data;
  const feather = o.feather ?? .12, ragged = o.ragged ?? .22, scale = (o.scale ?? 5) / h, seed = o.seed ?? 3;
  const span = 1 + 2 * (feather + ragged);
  const front = -feather - ragged + o.progress * span;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = o.direction === -1 ? 1 - x / w : x / w;
    const n = (fbm(x * scale * 10, y * scale * 10, seed) - .5) * 2 + (fbm(x * scale * 40, y * scale * 40, seed + 5) - .5) * .5;
    const v = u + n * ragged;
    d[(y * w + x) * 4 + 3] = (1 - smooth(front - feather, front + feather, v)) * 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export type DissolveOptions = {
  width: number; height: number;
  /** 0 = intact, 1 = gone. */
  progress: number;
  feather?: number;
  scale?: number;
  seed?: number;
  /** Bias the dissolve to start at the top (pigment lifting upward). */
  lift?: number;
};

/** Pigment lifting off: holes open in the noise and spread until nothing is left. */
export function dissolveMask(o: DissolveOptions): HTMLCanvasElement {
  const {width: w, height: h} = o;
  const c = canvas(w, h), ctx = c.getContext('2d')!;
  const img = ctx.createImageData(w, h), d = img.data;
  const feather = o.feather ?? .1, scale = (o.scale ?? 6) / h, seed = o.seed ?? 5, lift = o.lift ?? .35;
  const q = -feather + o.progress * (1 + 2 * feather + lift);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = fbm(x * scale * 10, y * scale * 10, seed) * .8 + fbm(x * scale * 34, y * scale * 34, seed + 3) * .2;
    const v = n + lift * (y / h);
    d[(y * w + x) * 4 + 3] = smooth(q - feather, q + feather, v) * 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Multiply a picture's alpha by a mask, stretched over the given rect (default: the whole canvas). */
export function applyMask(ctx: CanvasRenderingContext2D, mask: CanvasImageSource, x = 0, y = 0, w = ctx.canvas.width, h = ctx.canvas.height) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(mask, x, y, w, h);
  ctx.restore();
}

/** 0 in the middle of the frame, rising to 1 at the edges (u, v in 0..1): where wisps and near motes may pass
 * the lens without crossing the copy. */
export function peripheryWeight(u: number, v: number): number {
  const dx = (u - .5) * 1.25, dy = (v - .5) * 1.6, d = Math.sqrt(dx * dx + dy * dy);
  const a = Math.max(0, Math.min(1, (d - .42) / .3));
  return a * a * (3 - 2 * a);
}

let periphery: HTMLCanvasElement | null = null;
/** peripheryWeight as a small alpha mask, stretched over a plane with applyMask. */
export function peripheryMask(): HTMLCanvasElement {
  if (periphery) return periphery;
  const w = 480, h = 270, c = canvas(w, h);
  const ctx = c.getContext('2d')!, img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.data[(y * w + x) * 4 + 3] = peripheryWeight(x / w, y / h) * 255;
  ctx.putImageData(img, 0, 0);
  return periphery = c;
}
