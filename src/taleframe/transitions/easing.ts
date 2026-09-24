/**
 * Deterministic easing (CSS Easing Functions Level 1/2 subset) for keyframes
 * and text animation. Pure arithmetic only (+ − × ÷, Math.abs, Math.floor), so
 * the results are bit-identical on the main thread, in workers, in preview and
 * in export. Ported from docs/research/animate-text-port/easing.ts.
 */
import type { Ease } from './types';

export type StepPosition = 'jump-start' | 'jump-end' | 'jump-none' | 'jump-both';

export type EasingSpec =
  | { kind: 'linear' }
  | { kind: 'cubic-bezier'; x1: number; y1: number; x2: number; y2: number }
  | { kind: 'steps'; n: number; position: StepPosition };

export type EasingFn = (x: number) => number;

const KEYWORDS: Record<string, EasingSpec> = {
  linear: { kind: 'linear' },
  ease: { kind: 'cubic-bezier', x1: 0.25, y1: 0.1, x2: 0.25, y2: 1 },
  'ease-in': { kind: 'cubic-bezier', x1: 0.42, y1: 0, x2: 1, y2: 1 },
  'ease-out': { kind: 'cubic-bezier', x1: 0, y1: 0, x2: 0.58, y2: 1 },
  'ease-in-out': { kind: 'cubic-bezier', x1: 0.42, y1: 0, x2: 0.58, y2: 1 },
  'step-start': { kind: 'steps', n: 1, position: 'jump-start' },
  'step-end': { kind: 'steps', n: 1, position: 'jump-end' },
};

/** Parses a CSS easing string. Throws on anything unsupported or invalid (x outside [0, 1]). */
export function parseEasing(css: string): EasingSpec {
  const s = css.trim().toLowerCase();
  const kw = KEYWORDS[s];
  if (kw) return kw;

  const cb = /^cubic-bezier\(\s*([^,]+),\s*([^,]+),\s*([^,]+),\s*([^)]+)\)$/.exec(s);
  if (cb) {
    const [x1, y1, x2, y2] = cb.slice(1, 5).map(Number);
    if ([x1, y1, x2, y2].some((v) => !Number.isFinite(v)) || x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
      throw new Error(`Invalid cubic-bezier: ${css}`); // CSS requires x in [0,1]
    }
    return { kind: 'cubic-bezier', x1, y1, x2, y2 };
  }

  const st = /^steps\(\s*(\d+)\s*(?:,\s*(start|end|jump-start|jump-end|jump-none|jump-both)\s*)?\)$/.exec(s);
  if (st) {
    const n = Number.parseInt(st[1], 10);
    const raw = st[2] ?? 'end';
    const position: StepPosition =
      raw === 'start' ? 'jump-start' : raw === 'end' ? 'jump-end' : (raw as StepPosition);
    if (n < 1 || (position === 'jump-none' && n < 2)) throw new Error(`Invalid steps(): ${css}`);
    return { kind: 'steps', n, position };
  }

  throw new Error(`Unsupported easing: ${css}`);
}

/**
 * Port of WebKit's UnitBezier (Source/WebCore/platform/graphics/UnitBezier.h):
 * Newton-Raphson (8 iterations) on x(t), falling back to bisection.
 * Endpoints are fixed at (0,0) and (1,1). Input outside [0,1] is linearly
 * extrapolated with the end tangents (Chromium gfx::CubicBezier behaviour).
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number, epsilon = 1e-7): EasingFn {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;

  // Tangents for extrapolation outside [0,1].
  const startGradient = x1 > 0 ? y1 / x1 : y1 === 0 && x2 > 0 ? y2 / x2 : y1 === 0 && y2 === 0 ? 1 : 0;
  const endGradient =
    x2 < 1 ? (y2 - 1) / (x2 - 1) : y2 === 1 && x1 < 1 ? (y1 - 1) / (x1 - 1) : y2 === 1 && y1 === 1 ? 1 : 0;

  const solveT = (x: number): number => {
    // Newton's method: fast in the common case.
    let t2 = x;
    for (let i = 0; i < 8; i += 1) {
      const x2v = sampleX(t2) - x;
      if (Math.abs(x2v) < epsilon) return t2;
      const d2 = sampleDX(t2);
      if (Math.abs(d2) < 1e-6) break;
      t2 -= x2v / d2;
    }
    // Bisection: guaranteed (x(t) is monotonic because x1, x2 are in [0,1]).
    let t0 = 0;
    let t1 = 1;
    t2 = x;
    for (let i = 0; i < 64 && t0 < t1; i += 1) {
      const x2v = sampleX(t2);
      if (Math.abs(x2v - x) < epsilon) return t2;
      if (x > x2v) t0 = t2;
      else t1 = t2;
      t2 = (t1 - t0) * 0.5 + t0;
    }
    return t2;
  };

  // Linear shortcut (cubic-bezier(a,a,b,b) is the identity).
  if (x1 === y1 && x2 === y2) return (x) => x;

  return (x: number) => {
    if (x <= 0) return x === 0 ? 0 : startGradient * x;
    if (x >= 1) return x === 1 ? 1 : 1 + endGradient * (x - 1);
    return sampleY(solveT(x));
  };
}

/** CSS steps(); the "before flag" is irrelevant because callers clamp progress to [0,1]. */
export function stepsEasing(n: number, position: StepPosition): EasingFn {
  const jumps = position === 'jump-none' ? n - 1 : position === 'jump-both' ? n + 1 : n;
  return (p: number) => {
    let step = Math.floor(p * n);
    if (position === 'jump-start' || position === 'jump-both') step += 1;
    if (p >= 0 && step < 0) step = 0;
    if (p <= 1 && step > jumps) step = jumps;
    return step / jumps;
  };
}

const identity: EasingFn = (x) => x;

export function toEasingFn(spec: EasingSpec): EasingFn {
  switch (spec.kind) {
    case 'linear':
      return identity;
    case 'cubic-bezier':
      return cubicBezier(spec.x1, spec.y1, spec.x2, spec.y2);
    case 'steps':
      return stepsEasing(spec.n, spec.position);
  }
}

const CACHE_CAP = 512;
const cssCache = new Map<string, EasingFn>();
/** Parse + compile once per distinct CSS string; safe to call per glyph per frame. Throws on invalid input. */
export function easing(css: string): EasingFn {
  let fn = cssCache.get(css);
  if (!fn) {
    fn = toEasingFn(parseEasing(css));
    if (cssCache.size >= CACHE_CAP) cssCache.clear();
    cssCache.set(css, fn);
  }
  return fn;
}

/** Like `easing`, but falls back (default: linear) instead of throwing — for user-supplied overrides. */
export function easingOr(css: string | undefined, fallback: string): EasingFn {
  if (css) {
    try {
      return easing(css);
    } catch {
      /* fall through */
    }
  }
  return easing(fallback);
}

/** Number formatting that round-trips cleanly: at most 4 decimals, no trailing zeros. */
function num(v: number): string {
  const r = Math.round(v * 1e4) / 1e4;
  return String(Object.is(r, -0) ? 0 : r);
}

export function formatEasing(spec: EasingSpec): string {
  switch (spec.kind) {
    case 'linear':
      return 'linear';
    case 'cubic-bezier':
      return `cubic-bezier(${num(spec.x1)}, ${num(spec.y1)}, ${num(spec.x2)}, ${num(spec.y2)})`;
    case 'steps':
      return `steps(${spec.n}, ${spec.position === 'jump-end' ? 'end' : spec.position === 'jump-start' ? 'start' : spec.position})`;
  }
}

/* --------------------------------------------------------------- model Ease */

/**
 * Range accepted for bezier y values (overshoot and back curves). A little
 * wider than the editor graph's −0.5..1.5 so the Overshoot preset (y1 = 1.56)
 * and pasted CSS survive; anything beyond is clamped.
 */
export const EASE_Y_MIN = -1;
export const EASE_Y_MAX = 2;

/** Default easing of a new keyframe segment: Smooth (0.4, 0, 0.2, 1). */
export const DEFAULT_KEY_EASE: Ease = [0.4, 0, 0.2, 1];

/** 'hold': the value stays until the next key, then jumps (steps(1, end)). */
const holdFn: EasingFn = (x) => (x >= 1 ? 1 : 0);

const easeCache = new Map<string, EasingFn>();

/** Compiled function of a model Ease. Bezier x values are clamped to [0, 1] (CSS rule). */
export function easeFn(e: Ease): EasingFn {
  if (e === 'linear') return identity;
  if (e === 'hold') return holdFn;
  const key = `${e[0]},${e[1]},${e[2]},${e[3]}`;
  let fn = easeCache.get(key);
  if (!fn) {
    const x1 = e[0] < 0 ? 0 : e[0] > 1 ? 1 : e[0];
    const x2 = e[2] < 0 ? 0 : e[2] > 1 ? 1 : e[2];
    fn = cubicBezier(x1, e[1], x2, e[3]);
    if (easeCache.size >= CACHE_CAP) easeCache.clear();
    easeCache.set(key, fn);
  }
  return fn;
}

/** CSS string of a model Ease ('hold' → 'steps(1, end)'). */
export function easeToCss(e: Ease): string {
  if (e === 'linear') return 'linear';
  if (e === 'hold') return 'steps(1, end)';
  return formatEasing({ kind: 'cubic-bezier', x1: e[0], y1: e[1], x2: e[2], y2: e[3] });
}

/**
 * Model Ease from CSS text (paste field, text-slot overrides). Keywords become
 * their bezier numbers; 'steps(1, end)' / 'step-end' become 'hold'; y values are
 * clamped to the model range. Returns null for anything else (invalid, or other steps()).
 */
export function cssToEase(css: string): Ease | null {
  let spec: EasingSpec;
  try {
    spec = parseEasing(css);
  } catch {
    return null;
  }
  if (spec.kind === 'linear') return 'linear';
  if (spec.kind === 'steps') return spec.n === 1 && spec.position === 'jump-end' ? 'hold' : null;
  const cy = (v: number) => (v < EASE_Y_MIN ? EASE_Y_MIN : v > EASE_Y_MAX ? EASE_Y_MAX : v);
  if (spec.x1 === spec.y1 && spec.x2 === spec.y2) return 'linear';
  return [spec.x1, cy(spec.y1), spec.x2, cy(spec.y2)];
}

/** Bezier numbers of an Ease ('linear' → [0,0,1,1]; 'hold' → null). */
export function easeBezier(e: Ease): [number, number, number, number] | null {
  if (e === 'hold') return null;
  if (e === 'linear') return [0, 0, 1, 1];
  return [e[0], e[1], e[2], e[3]];
}

export function sameEase(a: Ease, b: Ease): boolean {
  if (a === b) return true;
  if (typeof a === 'string' || typeof b === 'string') {
    // 'linear' equals the identity bezier.
    const ba = easeBezier(a);
    const bb = easeBezier(b);
    if (!ba || !bb) return false;
    return ba[0] === ba[1] && ba[2] === ba[3] && bb[0] === bb[1] && bb[2] === bb[3];
  }
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

/** Named easing presets (inspector, key context menu, easing popover). Names: S.motion.easing[id]. */
export type EasePresetId =
  | 'linear'
  | 'smooth'
  | 'glide'
  | 'snappy'
  | 'expoOut'
  | 'emphasized'
  | 'accelerate'
  | 'strongAccelerate'
  | 'overshoot'
  | 'easyEase'
  | 'easeIn'
  | 'easeOut'
  | 'hold';

export interface EasePreset {
  id: EasePresetId;
  ease: Ease;
}

export const EASE_PRESETS: readonly EasePreset[] = [
  { id: 'linear', ease: 'linear' },
  { id: 'smooth', ease: [0.4, 0, 0.2, 1] },
  { id: 'glide', ease: [0.22, 1, 0.36, 1] },
  { id: 'snappy', ease: [0.2, 0.8, 0.2, 1] },
  { id: 'expoOut', ease: [0.16, 1, 0.3, 1] },
  { id: 'emphasized', ease: [0.2, 0, 0, 1] },
  { id: 'accelerate', ease: [0.64, 0, 0.78, 0] },
  { id: 'strongAccelerate', ease: [0.7, 0, 0.84, 0] },
  { id: 'overshoot', ease: [0.34, 1.56, 0.64, 1] },
  { id: 'easyEase', ease: [0.33, 0, 0.67, 1] },
  { id: 'easeIn', ease: [0.33, 0, 1, 1] },
  { id: 'easeOut', ease: [0, 0, 0.67, 1] },
  { id: 'hold', ease: 'hold' },
];

export function getEasePreset(id: string): EasePreset | undefined {
  return EASE_PRESETS.find((p) => p.id === id);
}

/** The preset an Ease equals (for showing its name), or null for a custom curve. */
export function easePresetId(e: Ease): EasePresetId | null {
  for (const p of EASE_PRESETS) if (sameEase(p.ease, e)) return p.id;
  return null;
}

/** Same, for CSS strings (text slot easing overrides). */
export function cssEasePresetId(css: string): EasePresetId | null {
  const e = cssToEase(css);
  return e ? easePresetId(e) : null;
}

/**
 * SVG path of an easing curve drawn in a w×h box: x → right, y = 0 at the
 * bottom edge and 1 at the top edge (inside `pad`); overshoot goes past them.
 */
export function easeSvgPath(e: Ease, w: number, h: number, pad = 0): string {
  const X = (x: number) => num(pad + x * (w - 2 * pad));
  const Y = (y: number) => num(h - pad - y * (h - 2 * pad));
  if (e === 'hold') return `M${X(0)},${Y(0)} H${X(1)} V${Y(1)}`;
  const b = easeBezier(e)!;
  return `M${X(0)},${Y(0)} C${X(b[0])},${Y(b[1])} ${X(b[2])},${Y(b[3])} ${X(1)},${Y(1)}`;
}
