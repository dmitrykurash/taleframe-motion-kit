// Anchors: where a lantern, a window or a doorway is on each held frame. Transitions centre on them, match cuts
// line up on them, and UI dives go through them. Tracks come from the preparation tools (one entry per measured
// frame, null where the subject was not found) or are measured by hand for a still.
import {affine, apply, type Affine} from './affine';
import type {DepthConfig} from './config';
import {planeToScreen, type DepthCamera} from './stage';

/** Measured values by film frame ("48": {...}); null marks a frame where nothing was found. */
export type Track<T> = Readonly<Record<string, T | null | undefined>>;

const lookups = new WeakMap<object, (frame: number) => unknown>();

/** A lookup that returns the value on `frame`, or the nearest measured frame's, or null for an empty track.
 * Built once per track object. */
export function trackLookup<T>(track: Track<T>): (frame: number) => T | null {
  const hit = lookups.get(track);
  if (hit) return hit as (frame: number) => T | null;
  const lookup = buildLookup(track);
  lookups.set(track, lookup);
  return lookup;
}

function buildLookup<T>(track: Track<T>): (frame: number) => T | null {
  const entries = Object.entries(track)
    .filter((e): e is [string, T] => e[1] !== null && e[1] !== undefined && Number.isFinite(Number(e[0])))
    .map(([k, v]) => [Number(k), v] as const)
    .sort((a, b) => a[0] - b[0]);
  return (frame: number) => {
    if (!entries.length) return null;
    const f = Math.round(frame);
    let lo = 0, hi = entries.length - 1;
    while (lo < hi) {const mid = (lo + hi) >> 1; if (entries[mid][0] < f) lo = mid + 1; else hi = mid;}
    // entries[lo] is the first measured frame at or after f; compare it with the one before.
    if (lo > 0 && Math.abs(entries[lo - 1][0] - f) <= Math.abs(entries[lo][0] - f)) return entries[lo - 1][1];
    return entries[lo][1];
  };
}

/** The anchor on `frame` (nearest measured frame), or `fallback` when the track has nothing. */
export function anchorAt<T>(track: Track<T>, frame: number, fallback: T): T {
  return trackLookup(track)(frame) ?? fallback;
}

/** A tracked point (frame fractions, r of the height, as the preparation tools write it) in stage px. */
export type AnchorPoint = {x: number; y: number; r?: number};
export function anchorPoint(track: Track<AnchorPoint>, frame: number, config: DepthConfig, fallback: AnchorPoint): AnchorPoint {
  const p = anchorAt(track, frame, fallback);
  return {x: p.x * config.width, y: p.y * config.height, r: p.r === undefined ? undefined : p.r * config.height};
}

/** Where an anchor on a plane at `depth` appears on screen through `cam`, in frame fractions: the centre for a
 * cut's shader. `point` is in stage px on the plane at rest (see anchorPoint). */
export function anchorOnScreen(point: {x: number; y: number}, depth: number, cam: DepthCamera, config: DepthConfig) {
  const p = planeToScreen(point.x, point.y, depth, cam, config);
  return {x: p.x / config.width, y: p.y / config.height};
}

/** Frame fractions (0..1) → stage px, and back. Tracks and shaders use fractions; planes use pixels. */
export const uvToStage = (p: {x: number; y: number}, config: DepthConfig) => ({x: p.x * config.width, y: p.y * config.height});
export const stageToUV = (p: {x: number; y: number}, config: DepthConfig) => ({x: p.x / config.width, y: p.y / config.height});

/** Interpolate two similarity placements of a plane through a pivot: the pivot travels in a straight line, scale
 * moves in log space, rotation takes the short way. Use it to hand a guest plane from one placement to another. */
export function blendPlacement(m0: Affine, m1: Affine, u: number, pivotX: number, pivotY: number): Affine {
  if (u <= 0) return m0;
  if (u >= 1) return m1;
  const p0 = apply(m0, pivotX, pivotY), p1 = apply(m1, pivotX, pivotY);
  const s0 = Math.hypot(m0.a, m0.b), s1 = Math.hypot(m1.a, m1.b);
  const r0 = Math.atan2(m0.b, m0.a);
  let r1 = Math.atan2(m1.b, m1.a);
  while (r1 - r0 > Math.PI) r1 -= 2 * Math.PI;
  while (r1 - r0 < -Math.PI) r1 += 2 * Math.PI;
  const s = Math.exp(Math.log(s0) + (Math.log(s1) - Math.log(s0)) * u), r = r0 + (r1 - r0) * u;
  const x = p0.x + (p1.x - p0.x) * u, y = p0.y + (p1.y - p0.y) * u;
  return affine().translate(x, y).rotate(r).scale(s).translate(-pivotX, -pivotY).done();
}
