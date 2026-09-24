import { pixelNoise } from '../noise';
import type { StopmotionSettings } from './model';
import { stopmotionPose } from './timing';

export interface StopmotionVisualState {
  x: number; y: number; rotation: number; boil: number; texture: number; gain: number; seed: number; pose: number;
}
export function stopmotionAppearanceActive(e: StopmotionSettings | undefined): boolean {
  return !!e?.enabled && (e.jitter > 0 || e.rotation > 0 || e.boil > 0 || e.texture > 0 || e.exposure > 0);
}
/** New placement for each exposure, with restrained correlation to the previous
 * placement. This is not an accumulating random walk or a continuous wobble. */
export function stopmotionVisualState(e: StopmotionSettings | undefined, t: number, anchor = 0): StopmotionVisualState | null {
  if (!stopmotionAppearanceActive(e)) return null;
  const settings = e!, pose = stopmotionPose(t, settings, anchor);
  const hand = (channel: number) => .75 * (pixelNoise(pose, 0, settings.seed, channel) - pixelNoise(pose, 1, settings.seed, channel))
    + .25 * (pixelNoise(pose - 1, 0, settings.seed, channel) - pixelNoise(pose - 1, 1, settings.seed, channel));
  return { x: hand(0) * settings.jitter, y: hand(1) * settings.jitter, rotation: hand(2) * settings.rotation * Math.PI / 180,
    boil: settings.boil, texture: settings.texture, gain: 2 ** (hand(3) * settings.exposure), seed: settings.seed >>> 0, pose: pose >>> 0 };
}
function noise(x: number, y: number, seed: number, channel: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  const fx = tx * tx * (3 - 2 * tx), fy = ty * ty * (3 - 2 * ty);
  const a = pixelNoise(ix, iy, seed, channel), b = pixelNoise(ix + 1, iy, seed, channel);
  const c = pixelNoise(ix, iy + 1, seed, channel), d = pixelNoise(ix + 1, iy + 1, seed, channel);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
export type PremultSample = (u: number, v: number, channel: number) => number;
/** Inverse camera registration, followed by low-frequency hand reforming near
 * image/alpha edges. Quiet interiors are not made to swim. */
export function stopmotionUV(out: Float64Array, u: number, v: number, s: StopmotionVisualState, width: number, height: number, sample: PremultSample): void {
  const x = (u - .5) * width - s.x, y = (v - .5) * height - s.y, co = Math.cos(s.rotation), si = Math.sin(s.rotation);
  u = .5 + (co * x + si * y) / width; v = .5 + (-si * x + co * y) / height;
  if (s.boil > 0) {
    let edgeX = 0, edgeY = 0;
    for (let ch = 0; ch < 4; ch++) {
      const dx = sample(u + 1 / width, v, ch) - sample(u - 1 / width, v, ch);
      const dy = sample(u, v + 1 / height, ch) - sample(u, v - 1 / height, ch);
      edgeX += dx * dx; edgeY += dy * dy;
    }
    const edge = Math.min(1, 2 * Math.sqrt(edgeX + edgeY));
    const px = u * width, py = v * height, movingSeed = (s.seed ^ Math.imul(s.pose + 1, 2246822519)) >>> 0;
    const nx = .65 * (noise(px / 17, py / 17, s.seed, 4) * 2 - 1) + .35 * (noise(px / 31, py / 31, movingSeed, 5) * 2 - 1);
    const ny = .65 * (noise(px / 17, py / 17, s.seed, 6) * 2 - 1) + .35 * (noise(px / 31, py / 31, movingSeed, 7) * 2 - 1);
    u += nx * s.boil * edge / width; v += ny * s.boil * edge / height;
  }
  out[0] = u; out[1] = v;
}
/** Fine paper-like relief follows the sampled surface. It modulates midtones
 * without adding white paper, lifting black, or tinting the image. */
export function stopmotionGain(u: number, v: number, luma: number, s: StopmotionVisualState, width: number, height: number): number {
  if (s.texture === 0) return s.gain;
  const x = u * width, y = v * height;
  const relief = .65 * (noise(x * .52, y * 1.37, s.seed, 21) * 2 - 1) + .35 * (noise(x * .14, y * .52, s.seed, 22) * 2 - 1);
  return s.gain * (1 + s.texture * .12 * relief * Math.max(0, 4 * luma * (1 - luma)));
}
