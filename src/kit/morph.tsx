import React from 'react';
import {useStage} from './camera';
import {useTime} from './clock';
import {clamp, mix, progress} from './motion';
import {springTo, type SpringOptions} from './moves';
import {curves} from './scene/curves';

/** One shape, never cut: a single element springs from UI state to UI state (a button, a loader, a player,
 * a card) while its content swaps with a short blur. Each state's content has its own enter and exit timing,
 * so text never overlaps inside the morphing container. */

export type MorphState = {
  /** Time the shape starts turning into this state. */
  at: number;
  width: number;
  height: number;
  /** Corner radius in logical px; defaults to fully round on the short side. */
  radius?: number;
  /** Fill as #rgb or #rrggbb. */
  color?: string;
  /** Offset of the shape's center from the Morph's center. */
  x?: number;
  y?: number;
  /** What the shape shows in this state, laid out at the state's full size. */
  content?: React.ReactNode;
  /** States that share an id keep one piece of content without a swap: a slider that stretches, a toggle that
   * changes color. Only the first state of such a run needs `content`. */
  id?: string;
  /** Lay the content out at the shape's current size, so it stretches with the shape. */
  fill?: boolean;
};

function rgb(color: string): [number, number, number] {
  const hex = color.trim().replace('#', '');
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) throw new Error(`Morph colors must be #rgb or #rrggbb, got "${color}".`);
  return [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** The shape's geometry and fill at time t (springs summed per state change, so it is a pure function of time). */
export function morphAt(t: number, states: readonly MorphState[], spring: SpringOptions = {duration: .55, bounce: .1}) {
  if (!states.length) throw new Error('Morph needs at least one state.');
  const keys = (value: (s: MorphState) => number) => states.map(s => ({at: s.at, value: value(s)}));
  const color = states.map(s => rgb(s.color ?? '#111111'));
  const channel = (i: number) => clamp(springTo(t, states.map((s, k) => ({at: s.at, value: color[k][i] / 255})), spring)) * 255;
  return {width: springTo(t, keys(s => s.width), spring), height: springTo(t, keys(s => s.height), spring),
    radius: springTo(t, keys(s => s.radius ?? Math.min(s.width, s.height) / 2), spring),
    x: springTo(t, keys(s => s.x ?? 0), spring), y: springTo(t, keys(s => s.y ?? 0), spring),
    color: `rgb(${channel(0).toFixed(1)}, ${channel(1).toFixed(1)}, ${channel(2).toFixed(1)})`};
}

export type MorphProps = {
  states: readonly MorphState[];
  /** Center of the shape in the parent's coordinates. Default: stage center. */
  center?: {x: number; y: number};
  spring?: SpringOptions;
  /** Content timing: enters `delay` s after its state begins over `duration` s; the old content leaves over `out` s. */
  swap?: {delay?: number; duration?: number; out?: number};
  /** Soft shadow under the shape, 0–1. */
  shadow?: number;
  time?: number;
  style?: React.CSSProperties;
};

export function Morph({states, center, spring = {duration: .55, bounce: .1}, swap = {}, shadow = .6, time, style}: MorphProps) {
  const clock = useTime(), t = time ?? clock;
  const stage = useStage();
  const c = center ?? {x: stage.width / 2, y: stage.height / 2};
  const m = morphAt(t, states, spring);
  const {delay = .1, duration = .3, out = .14} = swap;
  const lift = shadow * Math.min(1, m.height / 400);
  return <div style={{position: 'absolute', left: c.x + m.x - m.width / 2, top: c.y + m.y - m.height / 2, width: m.width, height: m.height,
    borderRadius: m.radius, background: m.color, overflow: 'hidden', isolation: 'isolate',
    boxShadow: lift > .01 ? `0 ${(6 + 18 * lift).toFixed(1)}px ${(22 + 40 * lift).toFixed(1)}px rgba(20,20,20,${(.05 + .07 * lift).toFixed(3)})` : undefined, ...style}}>
    {states.map((s, i) => {
      // A state continuing the previous one's id keeps that content on screen; it does not swap.
      if (!s.content || (s.id !== undefined && states[i - 1]?.id === s.id)) return null;
      const enter = curves.punchOut(progress(t, s.at + delay, duration));
      let n = i + 1;
      while (s.id !== undefined && states[n]?.id === s.id) n++;
      const next = states[n];
      const leave = next ? curves.punchIn(progress(t, next.at, out)) : 0;
      const shown = enter * (1 - leave);
      if (shown <= .002) return null;
      const blur = 10 * (1 - enter) + 10 * leave;
      const w = s.fill ? m.width : s.width, h = s.fill ? m.height : s.height;
      return <div key={i} style={{position: 'absolute', left: (m.width - w) / 2, top: (m.height - h) / 2, width: w, height: h,
        opacity: shown, filter: blur > .2 ? `blur(${blur.toFixed(2)}px)` : undefined,
        transform: `scale(${mix(.96, 1, enter) * mix(1, .98, leave)})`}}>{s.content}</div>;
    })}
  </div>;
}

/** Camera scale that makes a w × h element fill `fill` of the frame on its tighter side. */
export function fitScale(width: number, height: number, frame: {width: number; height: number}, fill = .6) {
  return Math.min(frame.width * fill / width, frame.height * fill / height);
}
