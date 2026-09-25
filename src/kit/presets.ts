import type React from 'react';
import {mulberry32} from '../taleframe/transitions/kit';
import {clamp, mix} from './motion';
import {springCurve} from './moves';
import {curves, type Curve} from './scene/curves';

/** Motion presets: named ways for a piece of type or any element to arrive and leave. KineticText applies
 * them per line, word, or letter; Enter applies them to a block. Each preset is a pure pose function, so
 * any frame renders on its own and staggers, exits, and seeks all agree. */

/** One moving piece and its seeded randomness (0–1). */
export type Unit = {index: number; count: number; random: number; random2: number};

/** A pose relative to rest. Distances are in multiples of the piece's size (em for type). `weight` is the
 * fraction of the way from a hairline to the piece's own weight; `wipe` hides a fraction from the right
 * (negative: from the left); `split` separates red and cyan copies by that many em. */
export type Pose = {x?: number; y?: number; scale?: number; scaleX?: number; scaleY?: number; rotate?: number;
  rotateX?: number; rotateY?: number; skewX?: number; blur?: number; opacity?: number; weight?: number;
  tracking?: number; wipe?: number; split?: number};

export type Preset = {
  /** q: 0 hidden … 1 at rest. q is already eased and may overshoot 1 on springy presets. */
  enter: (q: number, u: Unit) => Pose;
  /** q: 0 at rest … 1 gone. */
  exit: (q: number, u: Unit) => Pose;
  curve: Curve;
  exitCurve: Curve;
  /** Pieces travel inside a line mask, appearing from behind the baseline. */
  mask?: boolean;
  origin?: string;
  /** Default seconds per piece. */
  duration: number;
  /** What it looks like and where it fits. */
  look: string;
};

const appear = (q: number, speed = 3) => clamp(q * speed);
const gone = (q: number, from = .4) => 1 - clamp((q - from) / (1 - from));
const gravity: Curve = p => p * p;
const linear: Curve = p => clamp(p);

/** Stepped, repeatable jitter for the glitch preset: the pattern only changes eight times per move. */
function jitter(q: number, u: Unit, seed: number) {
  const random = mulberry32((u.index * 7919 + Math.floor(q * 8) * 104729 + seed) >>> 0);
  return {a: random(), b: random(), c: random()};
}

export const PRESETS = {
  rise: {look: 'Slides up from behind the baseline and leaves upward. The launch-film workhorse.', mask: true, duration: .8,
    curve: curves.punchOut, exitCurve: curves.punchIn, enter: q => ({y: 1.2 * (1 - q)}), exit: q => ({y: -1.2 * q})},
  drop: {look: 'Falls in from above and bounces once; leaves by falling with a tumble. Playful.', duration: .8,
    curve: springCurve(.42), exitCurve: gravity,
    enter: q => ({y: -1.1 * (1 - q), opacity: appear(q, 4)}),
    exit: (q, u) => ({y: 2.6 * q, rotate: (u.random - .5) * 60 * q, opacity: gone(q, .45)})},
  soft: {look: 'A short rise with a fade. Calm, for quiet films and supporting lines.', duration: .7,
    curve: curves.punchOut, exitCurve: curves.glide,
    enter: q => ({y: .35 * (1 - q), opacity: q}), exit: q => ({y: -.25 * q, opacity: 1 - q})},
  blur: {look: 'Resolves out of focus while it settles in scale. Premium and cinematic.', duration: .9,
    curve: curves.punchOut, exitCurve: curves.glide,
    enter: q => ({blur: .2 * (1 - q), scale: 1 + .28 * (1 - q), opacity: appear(q, 1.6)}),
    exit: q => ({blur: .18 * q, scale: 1 - .06 * q, opacity: 1 - q})},
  flip: {look: 'Flips up on its baseline in 3D, like a split-flap board. Technical and crisp.', duration: .7, origin: '50% 100%',
    curve: springCurve(.22), exitCurve: curves.punchIn,
    enter: q => ({rotateX: -100 * (1 - q), opacity: appear(q, 5)}), exit: q => ({rotateX: 100 * q, opacity: gone(q, .5)})},
  turn: {look: 'Swings open around its left edge like a door.', duration: .75, origin: '0% 50%',
    curve: curves.punchOut, exitCurve: curves.punchIn,
    enter: q => ({rotateY: 95 * (1 - q), opacity: appear(q, 4)}), exit: q => ({rotateY: -95 * q, opacity: gone(q, .5)})},
  pop: {look: 'Scales up from nothing with a springy overshoot. Friendly.', duration: .6,
    curve: springCurve(.45), exitCurve: curves.punchIn,
    enter: q => ({scale: Math.max(0, q), opacity: appear(q, 6)}), exit: q => ({scale: 1 - q, opacity: gone(q, .6)})},
  stretch: {look: 'Shoots up tall and thin, then squashes into place. Squash and stretch for loud, fun films.', duration: .75,
    origin: '50% 100%', curve: springCurve(.5), exitCurve: curves.punchIn,
    enter: q => ({y: .9 * (1 - q), scaleY: 1 + 1.5 * (1 - q), scaleX: 1 - .45 * (1 - q), opacity: appear(q, 6)}),
    exit: q => ({y: -1.6 * q, scaleY: 1 + 1.5 * q, scaleX: 1 - .45 * q, opacity: gone(q, .5)})},
  slide: {look: 'Sweeps in from the right with a lean, as if it arrived at speed; leaves to the left.', duration: .7,
    curve: curves.punchOut, exitCurve: curves.punchIn,
    enter: q => ({x: 2.4 * (1 - q), skewX: -22 * (1 - q), opacity: appear(q, 3)}),
    exit: q => ({x: -2.4 * q, skewX: 22 * q, opacity: gone(q, .5)})},
  scatter: {look: 'Pieces fly in from seeded random places, spinning, and assemble; they leave by bursting apart.', duration: 1,
    curve: curves.punchOut, exitCurve: curves.punchIn,
    enter: (q, u) => ({x: (u.random - .5) * 7 * (1 - q), y: (u.random2 - .5) * 5 * (1 - q), rotate: (u.random - .5) * 240 * (1 - q),
      scale: mix(.4, 1, q), opacity: appear(q, 2.5)}),
    exit: (q, u) => ({x: (u.random - .5) * 7 * q, y: (u.random2 - .5) * 5 * q, rotate: (u.random2 - .5) * 240 * q,
      scale: mix(1, .4, q), opacity: gone(q, .3)})},
  wave: {look: 'Each piece bobs up on a spring, so a stagger rolls through the line like a wave.', duration: .85,
    curve: springCurve(.55), exitCurve: curves.punchIn,
    enter: q => ({y: .9 * (1 - q), opacity: appear(q, 5)}), exit: q => ({y: -.9 * q, opacity: gone(q, .3)})},
  zoom: {look: 'Flies in from the camera and lands with a soft blur. Loud.', duration: .55,
    curve: curves.punchOut, exitCurve: curves.punchIn,
    enter: q => ({scale: 1 + 3 * (1 - q), blur: .07 * (1 - q), opacity: appear(q, 2.5)}),
    exit: q => ({scale: 1 + 3 * q, blur: .07 * q, opacity: 1 - q})},
  spin: {look: 'Spins in from small while it grows. Playful.', duration: .85,
    curve: springCurve(.3), exitCurve: curves.punchIn,
    enter: q => ({rotate: -200 * (1 - q), scale: mix(.1, 1, q), opacity: appear(q, 4)}),
    exit: q => ({rotate: 200 * q, scale: 1 - .9 * q, opacity: gone(q, .5)})},
  weight: {look: 'Grows from a hairline to full weight on a variable font. Modern and typographic.', duration: 1,
    curve: curves.punchOut, exitCurve: curves.glide,
    enter: q => ({weight: q, opacity: appear(q, 2.5)}), exit: q => ({weight: 1 - q, opacity: 1 - q})},
  skew: {look: 'Shears into place from a hard italic lean.', duration: .65, origin: '0% 100%',
    curve: curves.punchOut, exitCurve: curves.punchIn,
    enter: q => ({skewX: -40 * (1 - q), x: .8 * (1 - q), opacity: appear(q, 3)}),
    exit: q => ({skewX: 40 * q, x: -.8 * q, opacity: gone(q, .4)})},
  wipe: {look: 'Revealed left to right by a moving edge; leaves the same way.', duration: .6,
    curve: curves.punchOut, exitCurve: curves.punchIn,
    enter: q => ({wipe: 1 - q, x: -.08 * (1 - q)}), exit: q => ({wipe: -q, x: .08 * q})},
  glitch: {look: 'Jitters in with a red and cyan split in stepped frames, then locks. Technical.', duration: .55,
    curve: linear, exitCurve: linear,
    enter: (q, u) => {
      if (q <= 0) return {opacity: 0};
      if (q >= 1) return {};
      const {a, b, c} = jitter(q, u, 11);
      return {x: (a - .5) * .5 * (1 - q), y: (b - .5) * .15 * (1 - q), split: .09 * (1 - q), opacity: c < .2 + .8 * q ? 1 : 0};
    },
    exit: (q, u) => {
      if (q <= 0) return {};
      const {a, b, c} = jitter(q, u, 29);
      return {x: (a - .5) * .5 * q, y: (b - .5) * .15 * q, split: .09 * q, opacity: q >= 1 || c < .8 - .8 * q ? 0 : 1};
    }},
  track: {look: 'Pulls together from wide tracking while it sharpens. Titles. Use by line or by word.', duration: 1.3,
    curve: curves.punchOut, exitCurve: curves.glide,
    enter: q => ({tracking: .5 * (1 - q), blur: .07 * (1 - q), opacity: appear(q, 1.5)}),
    exit: q => ({tracking: .3 * q, blur: .06 * q, opacity: 1 - q})},
} satisfies Record<string, Preset>;

export type PresetName = keyof typeof PRESETS;
export const PRESET_NAMES = Object.keys(PRESETS) as PresetName[];

export function preset(name: PresetName): Preset {
  const found = (PRESETS as Record<string, Preset>)[name];
  if (!found) throw new Error(`Unknown motion preset "${String(name)}". Use one of: ${PRESET_NAMES.join(', ')}.`);
  return found;
}

/** Seeded randomness for piece `index`, the same on every frame. */
export function unitOf(index: number, count: number, seed = 1): Unit {
  const random = mulberry32((seed * 997 + index * 7919) >>> 0);
  return {index, count, random: random(), random2: random()};
}

/** CSS for a pose. `size` converts pose distances to pixels (the font size for type); `weight` and
 * `tracking` are the piece's own values at rest. */
export function poseStyle(pose: Pose, size: number, {weight = 700, tracking = 0, origin}: {weight?: number; tracking?: number; origin?: string} = {}): React.CSSProperties {
  const {x = 0, y = 0, scale = 1, scaleX = 1, scaleY = 1, rotate = 0, rotateX = 0, rotateY = 0, skewX = 0, blur = 0, opacity = 1} = pose;
  const parts = [
    rotateX || rotateY ? `perspective(${Math.round(size * 6)}px)` : '',
    x || y ? `translate(${(x * size).toFixed(2)}px, ${(y * size).toFixed(2)}px)` : '',
    rotate ? `rotate(${rotate.toFixed(2)}deg)` : '',
    rotateX ? `rotateX(${rotateX.toFixed(2)}deg)` : '',
    rotateY ? `rotateY(${rotateY.toFixed(2)}deg)` : '',
    skewX ? `skewX(${skewX.toFixed(2)}deg)` : '',
    scale !== 1 || scaleX !== 1 || scaleY !== 1 ? `scale(${(scale * scaleX).toFixed(4)}, ${(scale * scaleY).toFixed(4)})` : '',
  ].filter(Boolean);
  const wipe = pose.wipe ?? 0, split = pose.split ?? 0;
  return {
    display: 'inline-block',
    transform: parts.length ? parts.join(' ') : undefined,
    transformOrigin: parts.length ? origin : undefined,
    filter: blur * size > .15 ? `blur(${(blur * size).toFixed(2)}px)` : undefined,
    opacity: opacity < .999 ? Math.max(0, opacity) : undefined,
    fontWeight: pose.weight !== undefined ? Math.round(mix(100, weight, clamp(pose.weight))) : undefined,
    letterSpacing: pose.tracking ? `${(tracking + pose.tracking).toFixed(4)}em` : undefined,
    clipPath: wipe > 0 ? `inset(-30% ${(wipe * 100).toFixed(2)}% -30% -10%)` : wipe < 0 ? `inset(-30% -10% -30% ${(-wipe * 100).toFixed(2)}%)` : undefined,
    textShadow: Math.abs(split) > .002 ? `${split.toFixed(3)}em 0 rgba(255,40,90,.85), ${(-split).toFixed(3)}em 0 rgba(0,210,255,.85)` : undefined,
  };
}

/** Pose of one piece at time `t`: entering from `start`, and leaving from `exitAt` when that has come. */
export function poseAt(t: number, u: Unit, o: {enter: PresetName; exit?: PresetName; start: number; duration?: number;
  exitAt?: number; exitDuration?: number}): {pose: Pose; phase: 'enter' | 'exit'; preset: Preset} {
  const a = preset(o.enter);
  if (o.exitAt !== undefined && t >= o.exitAt) {
    const b = preset(o.exit ?? o.enter);
    const q = b.exitCurve(clamp((t - o.exitAt) / (o.exitDuration ?? b.duration * .7)));
    return {pose: b.exit(q, u), phase: 'exit', preset: b};
  }
  const q = a.curve(clamp((t - o.start) / (o.duration ?? a.duration)));
  return {pose: a.enter(q, u), phase: 'enter', preset: a};
}
