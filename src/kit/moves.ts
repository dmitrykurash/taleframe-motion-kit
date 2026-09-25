import {mulberry32} from '../taleframe/transitions/kit';
import type {Camera} from './camera';
import {clamp, mix, progress} from './motion';
import {curves, type Curve} from './scene/curves';
import type {Point} from './scene/types';

/** Motion vocabulary: springs, handheld noise, hits, arcs, staggers, camera moves, and speed ramps.
 * Every function is pure and derives its value from time, so any frame can be rendered on its own. */

/** A damped spring from 0 to 1, `t` seconds after it starts. `duration` is the perceived length (about the
 * settling time; for bouncy springs, the period of one swing). `bounce` 0 settles without overshoot,
 * 0.25 overshoots gently, 0.5 is playful, 0.8 wobbles. Parameterized like SwiftUI's springs. */
export function spring(t: number, {duration = .6, bounce = .25}: {duration?: number; bounce?: number} = {}): number {
  if (!(duration > 0)) throw new Error('A spring needs a positive duration.');
  if (t <= 0) return 0;
  const zeta = 1 - Math.min(.95, Math.max(0, bounce)), w0 = 2 * Math.PI / duration;
  if (zeta >= 1) return 1 - (1 + w0 * t) * Math.exp(-w0 * t);
  const wd = w0 * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + zeta * w0 / wd * Math.sin(wd * t));
}

/** A spring as a 0–1 curve over a fixed window, for places that take progress (presets, transitions).
 * It lands exactly on 1 at the end of the window. */
export function springCurve(bounce = .3): Curve {
  // Bouncier springs ring longer, so they get a shorter period: each has settled within about 0.3% by
  // the end of the window, and the final snap to 1 is invisible.
  const duration = Math.min(.72, 1 - Math.min(.95, Math.max(0, bounce)));
  return p => p <= 0 ? 0 : p >= 1 ? 1 : spring(p, {duration, bounce});
}

/** Three incommensurate sines per axis: smooth, never repeating within a film, identical on every seek. */
function noise(t: number, seed: number, axis: number): number {
  const random = mulberry32((seed * 9173 + axis * 7919) >>> 0);
  let sum = 0;
  for (const [f, a] of [[1, .55], [2.31, .3], [4.73, .15]]) sum += a * Math.sin(2 * Math.PI * f * t + random() * 2 * Math.PI);
  return sum;
}

/** Handheld camera: a gentle, organic wander in logical px and degrees. Add it to a camera or a layer. */
export function shake(t: number, {amount = 6, frequency = .9, rotate = .25, seed = 1}: {amount?: number; frequency?: number; rotate?: number; seed?: number} = {}) {
  const u = t * frequency;
  return {x: amount * noise(u, seed, 0), y: amount * noise(u, seed, 1), rotate: rotate * noise(u, seed, 2)};
}

/** A slow float for holds, so a finished frame keeps breathing: a few px over several seconds. */
export function drift(t: number, {amount = 10, period = 7, seed = 2}: {amount?: number; period?: number; seed?: number} = {}) {
  return shake(t, {amount, frequency: 1 / period, rotate: .15, seed});
}

/** A hit: a sharp jolt at `at` that rings out over `decay` seconds. For slams, drops, and beats. */
export function impact(t: number, at: number, {amount = 26, decay = .45, frequency = 9, seed = 3}: {amount?: number; decay?: number; frequency?: number; seed?: number} = {}) {
  if (t < at) return {x: 0, y: 0, rotate: 0, scale: 1};
  const random = mulberry32(seed), angle = random() * 2 * Math.PI, s = t - at;
  const envelope = Math.exp(-s * 5 / decay), swing = Math.sin(2 * Math.PI * frequency * s + Math.PI / 2);
  return {x: amount * envelope * swing * Math.cos(angle), y: amount * envelope * swing * Math.sin(angle),
    rotate: amount * .035 * envelope * Math.sin(2 * Math.PI * frequency * .8 * s), scale: 1 + .018 * envelope};
}

/** A point along a curved path from `a` to `b`. `bend` bows the path sideways as a fraction of its length
 * (negative bends the other way). Motion on arcs reads as natural; straight lines read as mechanical. */
export function arc(p: number, a: Point, b: Point, bend = .25): Point {
  const dx = b.x - a.x, dy = b.y - a.y;
  const c = {x: (a.x + b.x) / 2 - dy * bend, y: (a.y + b.y) / 2 + dx * bend};
  const q = 1 - p;
  return {x: q * q * a.x + 2 * q * p * c.x + p * p * b.x, y: q * q * a.y + 2 * q * p * c.y + p * p * b.y};
}

export type StaggerOrder = 'start' | 'end' | 'center' | 'edges' | 'random';

/** Position of item `i` of `n` in a stagger, from 0 (first to move) upward. 'center' starts in the middle
 * and moves outward; 'edges' starts at both ends. Symmetric items share a position. */
export function staggerRank(i: number, n: number, order: StaggerOrder = 'start', seed = 1): number {
  if (!(n >= 1) || i < 0 || i >= n) throw new Error(`Stagger index ${i} is outside 0–${n - 1}.`);
  const mid = (n - 1) / 2;
  switch (order) {
    case 'start': return i;
    case 'end': return n - 1 - i;
    case 'center': return Math.abs(i - mid);
    case 'edges': return mid - Math.abs(i - mid);
    case 'random': {
      const rank = Array.from({length: n}, (_, k) => k), random = mulberry32(seed);
      for (let k = n - 1; k > 0; k--) {const j = Math.floor(random() * (k + 1)); [rank[k], rank[j]] = [rank[j], rank[k]];}
      return rank.indexOf(i);
    }
  }
}

/** Delay in seconds of item `i` of `n`: `each` seconds per stagger position. */
export const stagger = (i: number, n: number, each: number, order: StaggerOrder = 'start', seed = 1) => staggerRank(i, n, order, seed) * each;

export type GridPattern = 'diagonal' | 'radial' | 'rows' | 'columns' | 'random';

/** Delay of a grid cell as a fraction 0–1 of the spread: a wave from a corner, a ripple from `origin`
 * (in cells), rows, columns, or a seeded shuffle. */
export function gridDelay(col: number, row: number, cols: number, rows: number, pattern: GridPattern = 'diagonal',
  origin: Point = {x: (cols - 1) / 2, y: (rows - 1) / 2}, seed = 1): number {
  switch (pattern) {
    case 'diagonal': return (col + row) / Math.max(1, cols + rows - 2);
    case 'rows': return (row + col / Math.max(1, cols) * .35) / Math.max(1, rows - .65);
    case 'columns': return (col + row / Math.max(1, rows) * .35) / Math.max(1, cols - .65);
    case 'radial': {
      const far = Math.max(...[[0, 0], [cols - 1, 0], [0, rows - 1], [cols - 1, rows - 1]].map(([x, y]) => Math.hypot(x - origin.x, y - origin.y)));
      return far > 0 ? Math.hypot(col - origin.x, row - origin.y) / far : 0;
    }
    case 'random': return mulberry32((seed * 7919 + row * 131 + col * 31) >>> 0)();
  }
}

export type CameraMove = 'glide' | 'whip' | 'crash' | 'spring' | 'drift';

/** A camera moving from one framing to another. 'glide' is a smooth push, 'whip' snaps across at speed
 * (wrap the shot in MotionBlur), 'crash' punches in and overshoots a touch, 'spring' settles with bounce,
 * 'drift' eases in slowly and never stops abruptly. Scale interpolates in log space so zooms feel even. */
export function moveCamera(t: number, from: Camera, to: Camera, start: number, duration: number, move: CameraMove = 'glide'): Camera {
  const p = progress(t, start, duration);
  const curve: Curve = move === 'whip' ? curves.snap : move === 'crash' ? springCurve(.18)
    : move === 'spring' ? springCurve(.42) : move === 'drift' ? curves.open : curves.glide;
  const e = curve(p);
  return {x: mix(from.x, to.x, e), y: mix(from.y, to.y, e), scale: Math.exp(mix(Math.log(from.scale), Math.log(to.scale), e))};
}

/** Playback rate keys for a speed ramp: film time and the rate there (1 = real time, .2 = slow motion). */
export type RampKey = {at: number; rate: number};

/** Shot time for film time `t` under a speed ramp. The rate eases linearly between keys and holds outside
 * them; shot time equals film time at the first key. Integrated exactly, so every frame seeks correctly. */
export function rampTime(t: number, keys: readonly RampKey[]): number {
  if (!keys.length) return t;
  keys.forEach((k, i) => {
    if (!Number.isFinite(k.at) || !(k.rate >= 0)) throw new Error('Speed-ramp keys need finite times and rates of 0 or more.');
    if (i > 0 && k.at <= keys[i - 1].at) throw new Error('Speed-ramp keys need strictly increasing times.');
  });
  const first = keys[0];
  if (t <= first.at) return first.at - (first.at - t) * first.rate;
  let shot = first.at;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    const end = Math.min(t, b.at), span = end - a.at;
    // Area under a linear rate from a.at to `end`.
    const rateAtEnd = mix(a.rate, b.rate, span / (b.at - a.at));
    shot += span * (a.rate + rateAtEnd) / 2;
    if (t <= b.at) return shot;
  }
  return shot + (t - keys[keys.length - 1].at) * keys[keys.length - 1].rate;
}

/** Playback rate of a speed ramp at film time `t`. */
export function rampRate(t: number, keys: readonly RampKey[]): number {
  if (!keys.length) return 1;
  if (t <= keys[0].at) return keys[0].rate;
  for (let i = 1; i < keys.length; i++) if (t <= keys[i].at) return mix(keys[i - 1].rate, keys[i].rate, (t - keys[i - 1].at) / (keys[i].at - keys[i - 1].at));
  return keys[keys.length - 1].rate;
}

/** Bell curve 0 → 1 → 0 across p = 0–1, for anything that peaks mid-move (blur, bulge, bloom). */
export const bell = (p: number) => Math.sin(Math.PI * clamp(p)) ** 2;
