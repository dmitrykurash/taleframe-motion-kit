/** Project-wide finishing effects. Saved as plain data; absent on older projects. */
import { frameAt } from '../time';
import type { Fps, PostEffects } from '../types';
import { DEFAULT_WATERCOLOR, DEFAULT_PIGMENT, normalizeWatercolor, normalizePigment, paintEffectsActive } from './paint/model';
import { DEFAULT_HELIOS, normalizeHelios, heliosActive } from './helios/model';
import { DEFAULT_STOPMOTION, normalizeStopmotion, stopmotionActive } from './stopmotion/model';
import { DEFAULT_POST_EFFECT_ORDER, normalizePostEffectOrder } from './order';

export const DEFAULT_POST_EFFECTS: Readonly<PostEffects> = {
  order: [...DEFAULT_POST_EFFECT_ORDER],
  excludeText: false,
  excludeTransitions: false,
  watercolor: DEFAULT_WATERCOLOR,
  pigment: DEFAULT_PIGMENT,
  helios: DEFAULT_HELIOS,
  stopmotion: DEFAULT_STOPMOTION,
  grain: { enabled: false, amount: 0.18, size: 1.5, monochrome: true, animated: true, speed: 1, blend: 'soft-light' },
  chromatic: { enabled: false, strength: 6, angle: 0, radial: true, redBlue: 1, blur: 0 },
  lens: { enabled: false, distortion: 0.12, zoom: 1 },
  duotone: { enabled: false, amount: 1, shadows: '#17233d', highlights: '#f4cda2' },
};

/** Numerical/physical safety bounds, independent of the comfortable UI sliders.
 * Blend opacity stays in [0,1]; creative intensities can exceed their presets. */
export const POST_EFFECT_LIMITS = {
  grain: { amount: { min: 0, max: 4 }, size: { min: .05, max: 1024 }, speed: { min: 0, max: 120 } },
  chromatic: {
    strength: { min: -4096, max: 4096 }, angle: { min: -360000, max: 360000 },
    redBlue: { min: 0, max: 1 }, blur: { min: 0, max: 1024 },
  },
  lens: { distortion: { min: -8, max: 8 }, zoom: { min: .01, max: 20 } },
  duotone: { amount: { min: 0, max: 1 } },
} as const;

const object = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const number = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
const bounded = (v: unknown, fallback: number, range: { min: number; max: number }) => number(v, fallback, range.min, range.max);
const boolean = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const color = (v: unknown, fallback: string) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback);
/** Clamp untrusted saves and fill partial settings. Complete data retains its identity. */
export function normalizePostEffects(value: unknown): PostEffects {
  const raw = object(value),
    g = object(raw.grain),
    c = object(raw.chromatic),
    l = object(raw.lens),
    d = object(raw.duotone);
  const def = DEFAULT_POST_EFFECTS;
  const result: PostEffects = {
    order: normalizePostEffectOrder(raw.order),
    excludeText: boolean(raw.excludeText, false),
    excludeTransitions: boolean(raw.excludeTransitions, false),
    watercolor: normalizeWatercolor(raw.watercolor),
    pigment: normalizePigment(raw.pigment),
    helios: normalizeHelios(raw.helios),
    stopmotion: normalizeStopmotion(raw.stopmotion),
    grain: {
      enabled: boolean(g.enabled, false),
      amount: bounded(g.amount, def.grain.amount, POST_EFFECT_LIMITS.grain.amount),
      size: bounded(g.size, def.grain.size, POST_EFFECT_LIMITS.grain.size),
      monochrome: boolean(g.monochrome, true),
      animated: boolean(g.animated, true),
      speed: bounded(g.speed, 1, POST_EFFECT_LIMITS.grain.speed),
      blend: g.blend === 'normal' || g.blend === 'overlay' || g.blend === 'soft-light' ? g.blend : def.grain.blend,
    },
    chromatic: {
      enabled: boolean(c.enabled, false),
      strength: bounded(c.strength, def.chromatic.strength, POST_EFFECT_LIMITS.chromatic.strength),
      angle: bounded(c.angle, 0, POST_EFFECT_LIMITS.chromatic.angle),
      radial: boolean(c.radial, true),
      redBlue: bounded(c.redBlue, def.chromatic.redBlue, POST_EFFECT_LIMITS.chromatic.redBlue),
      blur: bounded(c.blur, def.chromatic.blur, POST_EFFECT_LIMITS.chromatic.blur),
    },
    lens: { enabled: boolean(l.enabled, false), distortion: bounded(l.distortion, def.lens.distortion, POST_EFFECT_LIMITS.lens.distortion), zoom: bounded(l.zoom, 1, POST_EFFECT_LIMITS.lens.zoom) },
    duotone: {
      enabled: boolean(d.enabled, false),
      amount: bounded(d.amount, 1, POST_EFFECT_LIMITS.duotone.amount),
      shadows: color(d.shadows, def.duotone.shadows),
      highlights: color(d.highlights, def.duotone.highlights),
    },
  };
  return JSON.stringify(result) === JSON.stringify(value) ? (value as PostEffects) : result;
}

/** Zero-strength effects take the same fast path as disabled effects. */
export function postEffectsActive(e: PostEffects | undefined): boolean {
  return (
    !!e &&
    (paintEffectsActive(e.watercolor, e.pigment) || heliosActive(e.helios) || stopmotionActive(e.stopmotion) || legacyPostEffectsActive(e))
  );
}
export function legacyPostEffectsActive(e: PostEffects): boolean {
  return ((e.grain.enabled && e.grain.amount > 0) ||
      (e.chromatic.enabled && e.chromatic.strength !== 0) ||
      (e.lens.enabled && (e.lens.distortion !== 0 || e.lens.zoom !== 1)) ||
      (e.duotone.enabled && e.duotone.amount > 0));
}
export function grainTick(e: PostEffects, t: number, fps: Fps): number {
  return e.grain.animated ? Math.floor(Math.max(0, frameAt(t, fps)) * e.grain.speed) >>> 0 : 0;
}
export function rgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];
}
