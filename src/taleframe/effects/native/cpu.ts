/** Ordered Canvas fallback for the basic effects; material renderers use WebGL. */
import type { PostEffects } from '../types';
import { rgb } from './model';
import { BLUR_TAPS, chromaticBlurPlan } from './chromatic';
import { isolatePostEffect, postEffectPasses } from './passes';

import { pixelNoise as grainNoise } from './noise';
import { stopmotionUV, stopmotionGain, type StopmotionVisualState } from './stopmotion/visual';
export { grainNoise };
const mix = (a: number, b: number, x: number) => a + (b - a) * x;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export function grainBlend(base: number, noise: number, blend: PostEffects['grain']['blend']): number {
  if (blend === 'normal') return noise;
  if (blend === 'overlay') return base < 0.5 ? 2 * base * noise : 1 - 2 * (1 - base) * (1 - noise);
  const d = base <= 0.25 ? ((16 * base - 12) * base + 4) * base : Math.sqrt(base);
  return noise <= 0.5 ? base - (1 - 2 * noise) * base * (1 - base) : base + (2 * noise - 1) * (d - base);
}

/** Returns fresh RGBA bytes; never writes the source (neighbour sampling needs the whole input). */
export function processPixels(
  input: Uint8ClampedArray,
  width: number,
  height: number,
  projectWidth: number,
  projectHeight: number,
  e: PostEffects,
  tick: number,
  stop: StopmotionVisualState | null = null,
): Uint8ClampedArray {
  let result: Uint8ClampedArray = input;
  for (const key of postEffectPasses(e)) {
    if (key === 'watercolor' || key === 'pigment' || key === 'helios') continue;
    result = processPixelPass(result, width, height, projectWidth, projectHeight,
      isolatePostEffect(e, key), tick, key === 'stopmotion' ? stop : null);
  }
  return result === input ? new Uint8ClampedArray(input) : result;
}

function processPixelPass(
  input: Uint8ClampedArray,
  width: number,
  height: number,
  projectWidth: number,
  projectHeight: number,
  e: PostEffects,
  tick: number,
  stop: StopmotionVisualState | null = null,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(input.length);
  const shadows = rgb(e.duotone.shadows),
    highlights = rgb(e.duotone.highlights);
  const angle = (e.chromatic.angle * Math.PI) / 180,
    ca = Math.cos(angle),
    sa = Math.sin(angle);
  let pixels = new Float32Array(input.length), sw = width, sh = height;
  for (let i = 0; i < input.length; i += 4) {
    const alpha = input[i + 3] / 255;
    for (let ch = 0; ch < 3; ch++) pixels[i + ch] = input[i + ch] / 255 * alpha;
    pixels[i + 3] = alpha;
  }
  const sharp = pixels;
  const chromatic = e.chromatic.enabled && e.chromatic.strength !== 0;
  const sample = (u: number, v: number, ch: number) => {
    const x = Math.max(0, Math.min(sw - 1, u * sw - .5)), y = Math.max(0, Math.min(sh - 1, v * sh - .5));
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
    return mix(mix(pixels[(y0 * sw + x0) * 4 + ch], pixels[(y0 * sw + x1) * 4 + ch], x - x0),
      mix(pixels[(y1 * sw + x0) * 4 + ch], pixels[(y1 * sw + x1) * 4 + ch], x - x0), y - y0);
  };
  if (chromatic) {
    // Build a signed edge field from the original premultiplied image. Remove
    // opacity-driven luminance before adding coverage with a fixed polarity,
    // so changing a transparent mark's brightness never flips its fringe hue.
    // Only this field is softened; the underlying image always stays sharp.
    const field = new Float32Array(input.length);
    const middle = new Float64Array(4), red = new Float64Array(4), blue = new Float64Array(4);
    const light = (p: Float64Array) => p[0] * .2126 + p[1] * .7152 + p[2] * .0722;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const u = (x + .5) / width, v = (y + .5) / height;
      const px = e.chromatic.radial ? u * 2 - 1 : 1, py = e.chromatic.radial ? v * 2 - 1 : 0;
      const dx = (px * ca - py * sa) * e.chromatic.strength / projectWidth;
      const dy = (px * sa + py * ca) * e.chromatic.strength / projectHeight;
      for (let ch = 0; ch < 4; ch++) {
        middle[ch] = sample(u, v, ch);
        red[ch] = sample(u + dx, v + dy, ch);
        blue[ch] = sample(u - dx, v - dy, ch);
      }
      const tone = (light(red) + light(blue) + light(middle)) / Math.max(red[3] + blue[3] + middle[3], 1e-6);
      const alphaDelta = red[3] - blue[3];
      const signal = Math.max(-1, Math.min(1, light(red) - light(blue) - (tone + 1) * alphaDelta));
      const i = (y * width + x) * 4;
      field[i] = Math.max(signal, 0); field[i + 2] = Math.max(-signal, 0); field[i + 3] = 1;
    }
    pixels = field;
  }
  if (chromatic && e.chromatic.blur > 0) {
    const plan = chromaticBlurPlan(width, height, projectWidth, projectHeight, e.chromatic.blur);
    for (const level of plan.levels) {
      const next = new Float32Array(level.width * level.height * 4);
      for (let y = 0; y < level.height; y++) for (let x = 0; x < level.width; x++) {
        const u = (x + .5) / level.width, v = (y + .5) / level.height, dx = .25 / level.width, dy = .25 / level.height;
        for (let ch = 0; ch < 4; ch++) next[(y * level.width + x) * 4 + ch] =
          (sample(u - dx, v - dy, ch) + sample(u + dx, v - dy, ch) + sample(u - dx, v + dy, ch) + sample(u + dx, v + dy, ch)) * .25;
      }
      pixels = next; sw = level.width; sh = level.height;
    }
    for (const [axis, kernel] of [plan.x, plan.y].entries()) {
      const next = new Float32Array(pixels.length), dx = axis === 0 ? kernel.step / sw : 0, dy = axis === 1 ? kernel.step / sh : 0;
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
        const u = (x + .5) / sw, v = (y + .5) / sh;
        for (let ch = 0; ch < 4; ch++) {
          let value = sample(u, v, ch) * kernel.weights[0];
          for (let k = 1; k <= BLUR_TAPS; k++) value += (sample(u + k * dx, v + k * dy, ch) + sample(u - k * dx, v - k * dy, ch)) * kernel.weights[k];
          next[(y * sw + x) * 4 + ch] = value;
        }
      }
      pixels = next;
    }
  }
  const handUv = new Float64Array(2), middle = new Float64Array(4), c = new Float64Array(3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width,
        v = (y + 0.5) / height;
      let su = u,
        sv = v;
      if (e.lens.enabled) {
        const px = u * 2 - 1,
          py = v * 2 - 1;
        const k = (1 + e.lens.distortion * (px * px + py * py)) / e.lens.zoom;
        su = 0.5 + px * 0.5 * k;
        sv = 0.5 + py * 0.5 * k;
      }
      if (stop) { stopmotionUV(handUv, su, sv, stop, projectWidth, projectHeight, sample); su = handUv[0]; sv = handUv[1]; }
      const i = (y * width + x) * 4;
      for (let ch = 0; ch < 4; ch++) middle[ch] = chromatic ? sharp[i + ch] : sample(su, sv, ch);
      let alpha = middle[3];
      if (chromatic) {
        // Opposing fringes cancel before tinting, avoiding magenta/green bands
        // where a thin object's red and blue lobes overlap after softening.
        const signal = sample(u, v, 0) - sample(u, v, 2), coverage = clamp(Math.abs(signal));
        for (let ch = 0; ch < 3; ch++) {
          const tint = mix(.5, (signal >= 0 ? ch === 0 : ch === 2) ? 1 : 0, e.chromatic.redBlue);
          c[ch] = middle[ch] * (1 - coverage) + tint * coverage;
        }
        alpha += (1 - alpha) * coverage;
      } else for (let ch = 0; ch < 3; ch++) c[ch] = middle[ch];
      for (let ch = 0; ch < 3; ch++) c[ch] = alpha > 1e-6 ? c[ch] / alpha : 0;
      if (stop) {
        const gain = stopmotionGain(su, sv, c[0] * .2126 + c[1] * .7152 + c[2] * .0722, stop, projectWidth, projectHeight);
        for (let ch = 0; ch < 3; ch++) c[ch] *= gain;
      }
      if (e.duotone.enabled && e.duotone.amount > 0) {
        const luma = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
        for (let ch = 0; ch < 3; ch++) c[ch] = mix(c[ch], mix(shadows[ch], highlights[ch], luma), e.duotone.amount);
      }
      if (e.grain.enabled && e.grain.amount > 0) {
        const gx = Math.floor((u * projectWidth) / e.grain.size + 0.001),
          gy = Math.floor((v * projectHeight) / e.grain.size + 0.001);
        for (let ch = 0; ch < 3; ch++)
          c[ch] = mix(c[ch], grainBlend(c[ch], grainNoise(gx, gy, tick, e.grain.monochrome ? 0 : ch), e.grain.blend), e.grain.amount);
      }
      for (let ch = 0; ch < 3; ch++) out[i + ch] = Math.round(clamp(c[ch]) * 255);
      out[i + 3] = Math.round(alpha * 255);
    }
  return out;
}
