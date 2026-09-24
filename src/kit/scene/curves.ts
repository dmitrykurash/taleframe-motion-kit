import {Easing} from 'remotion';

export type Curve = (p: number) => number;
export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const mix = (a: number, b: number, p: number) => a + (b - a) * p;
/** Progress of a sub-phase [a, b] of 0–1, clamped. */
export const phase = (p: number, a: number, b: number) => (b <= a ? (p >= b ? 1 : 0) : clamp01((p - a) / (b - a)));
export const smoothstep = (a: number, b: number, x: number) => {const t = phase(x, a, b); return t * t * (3 - 2 * t);};

/** Motion-design curves. Transitions accelerate into the cut and land with a long settle;
 * nothing moves linearly and nothing eases symmetrically unless it is a push between two rests. */
export const curves = {
  /** Accelerate hard into a cut (quartic-like, end slope ≈ 6). */
  punchIn: Easing.bezier(.7, 0, .84, 0),
  /** Arrive fast, settle long (the landing after a cut). */
  punchOut: Easing.bezier(.16, 1, .3, 1),
  /** Strong in–out for a push between two rests (bands, slides). */
  snap: Easing.bezier(.85, 0, .15, 1),
  /** Container opening: very fast start, long glide into place. */
  open: Easing.bezier(.2, .95, .1, 1),
  /** Gentle in–out for camera-like moves inside a hold. */
  glide: Easing.bezier(.45, .05, .15, 1),
} satisfies Record<string, Curve>;

/** A fast opening with overshoot; `bounce` 0 = none, 1 ≈ 8% overshoot. Ends exactly at 1. */
export function overshoot(bounce: number): Curve {
  const b = Math.max(0, Math.min(1, bounce));
  return b === 0 ? curves.open : Easing.bezier(.18, 1 + .9 * b, .3, 1);
}

/** Slope of a curve at p (per unit progress), by central difference inside 0–1. */
export function slope(curve: Curve, p: number, h = 1e-3): number {
  const a = Math.max(0, p - h), b = Math.min(1, p + h);
  return b > a ? (curve(b) - curve(a)) / (b - a) : 0;
}

/** Continue a curve past its ends with the end slopes, so motion samples taken just outside
 * a phase keep moving instead of piling up at the boundary. */
export function extended(curve: Curve): Curve {
  const s0 = slope(curve, 0, 1e-4), s1 = slope(curve, 1, 1e-4);
  return (p: number) => (p < 0 ? curve(0) + p * s0 : p > 1 ? curve(1) + (p - 1) * s1 : curve(p));
}
