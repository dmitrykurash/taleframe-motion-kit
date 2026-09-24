import React, {createContext, useContext} from 'react';
import {useTime} from '../clock';
import {SCENE_TRANSITIONS, SceneTransition} from './SceneTransition';
import type {TransitionSpec} from './types';

export type Shot = {
  /** Film time (s) at which this shot cuts to the next one. Required on every shot except the last. */
  until?: number;
  /** A full-stage, opaque scene. Read time inside it with useTime() or useShot(). */
  content: React.ReactNode;
  /** How this shot arrives from the previous one. Omitted = hard cut, the default in launch films. */
  enter?: TransitionSpec;
  name?: string;
};
export type ShotWindow = {index: number; cut: number; start: number; end: number; spec: TransitionSpec};
export type ShotInfo = {index: number; name?: string; start: number; end: number};

/** Cut times and transition windows. Throws when shots overlap or a window does not fit between cuts. */
export function planShots(shots: readonly Shot[]): {cuts: number[]; windows: ShotWindow[]} {
  if (!shots.length) throw new Error('Shots needs at least one shot.');
  const cuts: number[] = [];
  shots.forEach((shot, i) => {
    if (i === shots.length - 1) return;
    if (typeof shot.until !== 'number' || !Number.isFinite(shot.until)) throw new Error(`Shot ${i + 1}${shot.name ? ` (${shot.name})` : ''} needs \`until\`, the time it cuts to the next shot.`);
    if (i > 0 && shot.until <= cuts[i - 1]) throw new Error(`Shot ${i + 1} ends at ${shot.until}s, before the previous cut at ${cuts[i - 1]}s.`);
    cuts.push(shot.until);
  });
  if (shots[0].enter) throw new Error('The first shot has nothing to transition from; remove its `enter`.');
  const windows: ShotWindow[] = [];
  shots.forEach((shot, i) => {
    if (!shot.enter) return;
    const meta = SCENE_TRANSITIONS[shot.enter.kind];
    if (!meta) throw new Error(`Shot ${i + 1} uses an unknown transition "${String((shot.enter as {kind: unknown}).kind)}".`);
    const duration = shot.enter.duration ?? meta.duration, align = shot.enter.align ?? meta.align;
    if (!(duration > 0)) throw new Error(`Shot ${i + 1}: transition duration must be positive.`);
    const cut = cuts[i - 1];
    const start = align === 'center' ? cut - duration / 2 : align === 'start' ? cut : cut - duration;
    windows.push({index: i, cut, start, end: start + duration, spec: shot.enter});
  });
  windows.forEach((w, k) => {
    const earliest = Math.max(w.index >= 2 ? cuts[w.index - 2] : 0, k > 0 ? windows[k - 1].end : -Infinity);
    const latest = w.index < cuts.length ? cuts[w.index] : Infinity;
    if (w.start < earliest - 1e-9) throw new Error(`The transition into shot ${w.index + 1} starts at ${w.start.toFixed(3)}s, before the previous shot is on screen (${earliest.toFixed(3)}s). Shorten it or move the cut.`);
    if (w.end > latest + 1e-9) throw new Error(`The transition into shot ${w.index + 1} ends at ${w.end.toFixed(3)}s, after that shot already cut away (${latest.toFixed(3)}s).`);
  });
  return {cuts, windows};
}

/** The transition window playing at time t, if any. Windows are [start, end). */
export function activeWindow(windows: readonly ShotWindow[], t: number): ShotWindow | undefined {
  return windows.find(w => t >= w.start && t < w.end);
}

/** Index of the shot on screen at time t when no transition window is playing. */
export function shotIndexAt(cuts: readonly number[], t: number): number {
  const index = cuts.findIndex(cut => t < cut);
  return index < 0 ? cuts.length : index;
}

const ShotContext = createContext<ShotInfo | null>(null);

/** The enclosing shot, with its local time in seconds (0 at its cut in). */
export function useShot(): ShotInfo & {local: number} {
  const info = useContext(ShotContext), time = useTime();
  if (!info) throw new Error('useShot() must be called inside <Shots>.');
  return {...info, local: time - info.start};
}

/** A film as a list of shots. Hard cuts by default; `enter` designs the arrival of a shot.
 * Both shots keep playing through a transition. Put it inside a LogicalStage. */
export function Shots({shots, time}: {shots: readonly Shot[]; time?: number}) {
  const clock = useTime(), t = time ?? clock;
  const {cuts, windows} = planShots(shots);
  const info = (i: number): ShotInfo => ({index: i, name: shots[i].name, start: i === 0 ? 0 : cuts[i - 1], end: cuts[i] ?? Infinity});
  const wrap = (i: number) => <ShotContext.Provider key={i} value={info(i)}>{shots[i].content}</ShotContext.Provider>;
  // Inclusive start: a window that begins exactly on its cut must still open on the outgoing shot.
  const active = activeWindow(windows, t);
  if (active) return <SceneTransition {...active.spec} key={`t${active.index}`} from={wrap(active.index - 1)} to={wrap(active.index)}
    start={active.start} duration={active.end - active.start} time={t}/>;
  return wrap(shotIndexAt(cuts, t));
}
