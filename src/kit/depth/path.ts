// Camera paths: keyframed, monotone and eased, plus the two camera tricks that make travel-through cuts line up
// (a match on an anchor, and a passage that opens from one point and dives into another).
import type {DepthConfig} from './config';
import {REST_DEPTH_CAMERA, type DepthCamera} from './stage';

/** A camera key: any field left out keeps following its own keys (or the base camera). */
export type DepthKey = {t: number} & Partial<DepthCamera>;

const FIELDS = ['z', 'x', 'y', 'roll', 'fx', 'fy'] as const;

/** Monotone cubic (Fritsch–Carlson) through (t, v): no overshoot, continuous velocity through every key, so a
 * camera accelerates into a transition and keeps its speed through it instead of stopping at each key. Holds the
 * first and last values outside the keys. */
export function monotoneCurve(t: number, pts: readonly {t: number; v: number}[]): number {
  const n = pts.length;
  if (!n) throw new Error('A curve needs at least one key.');
  if (n === 1 || t <= pts[0].t) return pts[0].v;
  if (t >= pts[n - 1].t) return pts[n - 1].v;
  const h = pts.slice(1).map((p, i) => p.t - pts[i].t);
  const delta = pts.slice(1).map((p, i) => (p.v - pts[i].v) / h[i]);
  const m = pts.map((_, i) => i === 0 ? delta[0] : i === n - 1 ? delta[n - 2]
    : (delta[i - 1] * delta[i] <= 0 ? 0 : (delta[i - 1] + delta[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (delta[i] === 0) {m[i] = 0; m[i + 1] = 0; continue;}
    const a = m[i] / delta[i], b = m[i + 1] / delta[i], s = a * a + b * b;
    if (s > 9) {const k = 3 / Math.sqrt(s); m[i] = k * a * delta[i]; m[i + 1] = k * b * delta[i];}
  }
  let i = 0;
  while (i < n - 2 && t > pts[i + 1].t) i++;
  const u = (t - pts[i].t) / h[i], u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * pts[i].v + (u3 - 2 * u2 + u) * h[i] * m[i]
    + (-2 * u3 + 3 * u2) * pts[i + 1].v + (u3 - u2) * h[i] * m[i + 1];
}

/** A camera path through keys (film seconds). Each field is its own monotone curve through the keys that set it. */
export function cameraPath(keys: readonly DepthKey[], base: DepthCamera = REST_DEPTH_CAMERA): (t: number) => DepthCamera {
  const sorted = [...keys].sort((a, b) => a.t - b.t);
  for (let i = 1; i < sorted.length; i++) if (sorted[i].t === sorted[i - 1].t) throw new Error(`Two camera keys share t=${sorted[i].t}.`);
  const curves = FIELDS.map(field => ({field, pts: sorted.filter(k => k[field] !== undefined).map(k => ({t: k.t, v: k[field] as number}))}))
    .filter(c => c.pts.length);
  return (t: number) => {
    const out = {...base};
    for (const {field, pts} of curves) out[field] = monotoneCurve(t, pts);
    return out;
  };
}

export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
/** Smoothstep ease on 0..1 (clamped). */
export const easeInOut = (t: number) => {t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t);};

export function lerpCamera(a: DepthCamera, b: DepthCamera, u: number): DepthCamera {
  return {z: lerp(a.z, b.z, u), x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), roll: lerp(a.roll, b.roll, u),
    fx: lerp(a.fx, b.fx, u), fy: lerp(a.fy, b.fy, u)};
}

/** A point with an optional radius (stage px). */
export type DepthMark = {x: number; y: number; r?: number};

/** Match cut: the camera that puts `anchor` (a point on a plane at `depth`, stage px at rest) exactly on the screen
 * point `target`, grown so its radius matches target's. The incoming shot starts on this camera and eases to its
 * own path with lerpCamera, so its anchor sits on the outgoing anchor and then pulls back. Never scales below
 * 1.01 (the incoming shot starts pushed in, which keeps its planes covering the frame). */
export function matchCamera(target: DepthMark, anchor: DepthMark, depth: number, config: DepthConfig): DepthCamera {
  const s = target.r !== undefined && anchor.r !== undefined && anchor.r > 0 ? target.r / anchor.r : 1.01;
  const z = depth * (1 - 1 / Math.max(1.01, s)), gap = depth - z;
  return {z, x: -(target.x - anchor.x) * gap, y: -(target.y - anchor.y) * gap, roll: 0,
    fx: anchor.x / config.width, fy: anchor.y / config.height};
}

export type PassageOptions = {
  /** The shot opens out of this screen point (0..1): it starts pushed in there and eases back. */
  open?: {at: number; from: {x: number; y: number}; dur?: number; push?: number};
  /** The shot ends by diving into this screen point (0..1), read at every frame (it may move). */
  dive?: {at: number; to: () => {x: number; y: number}; dur?: number; push?: number};
};

/** Wrap a camera so the shot opens from where the previous one dived and dives into its own travel-through point.
 * Adds forward travel and steers the focus of expansion; everything else is the base camera's. */
export function passage(base: (t: number) => DepthCamera, o: PassageOptions): (t: number) => DepthCamera {
  return (t: number) => {
    const c = base(t);
    const u = o.open ? 1 - easeInOut((t - o.open.at) / (o.open.dur ?? 1.1)) : 0;
    const d = o.dive ? easeInOut((t - o.dive.at) / (o.dive.dur ?? .8)) : 0;
    let fx = c.fx, fy = c.fy;
    if (o.open) {fx = lerp(fx, o.open.from.x, u); fy = lerp(fy, o.open.from.y, u);}
    if (o.dive && d > 0) {const to = o.dive.to(); fx = lerp(fx, to.x, d); fy = lerp(fy, to.y, d);}
    return {...c, z: c.z + (o.open?.push ?? .32) * u * u + (o.dive?.push ?? .36) * d * d, fx, fy};
  };
}
