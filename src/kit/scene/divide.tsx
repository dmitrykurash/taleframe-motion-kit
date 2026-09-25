import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useStage, type StageSize} from '../camera';
import {clamp01, curves, phase} from './curves';
import {Layer, STAGE} from './layers';
import type {DivideOptions, TransitionRenderProps} from './types';

export function divideSettings(o: DivideOptions, stage: StageSize = STAGE) {
  return {side: o.side ?? 'right', hold: Math.min(.8, Math.max(0, o.hold ?? .4)), split: Math.min(.8, Math.max(.2, o.split ?? .5)),
    line: Math.max(0, o.line ?? 2), lineColor: o.lineColor ?? 'rgba(255,255,255,.9)', backdrop: o.backdrop ?? '#000', stage};
}

/** Position of the divider (logical px from the entering side's opposite edge) at progress p: it sweeps in
 * to the split, holds while both shots share the screen, then sweeps on so the new shot takes the frame. */
export function divideAt(p: number, s: ReturnType<typeof divideSettings>) {
  const W = s.stage.width, a = (1 - s.hold) / 2, rest = s.split * W;
  const enter = curves.snap(phase(p, 0, a)), leave = curves.snap(phase(p, 1 - a, 1));
  return W - (W - rest) * enter - rest * leave;
}

export function DivideTransition({from, to, time, start, duration, options}: TransitionRenderProps<DivideOptions>) {
  const s = divideSettings(options, useStage());
  const W = s.stage.width;
  const D = divideAt(clamp01((time - start) / duration), s);
  // Each panel shows the middle of its shot, so both stay composed while the divider moves.
  const mirror = s.side === 'left';
  const out = {left: 0, width: D, shift: (D - W) / 2}, inc = {left: D, width: W - D, shift: D / 2};
  const panel = (content: React.ReactNode, p: {left: number; width: number; shift: number}, key: string) => {
    const left = mirror ? W - p.left - p.width : p.left, shift = mirror ? -p.shift : p.shift;
    return <AbsoluteFill key={key} style={{clipPath: `inset(0px ${(W - left - p.width).toFixed(2)}px 0px ${left.toFixed(2)}px)`}}>
      <Layer clip={false} transform={`translate(${shift.toFixed(2)}px, 0px)`}>{content}</Layer>
    </AbsoluteFill>;
  };
  const lineX = mirror ? W - D : D;
  return <AbsoluteFill style={{background: s.backdrop, overflow: 'hidden'}}>
    {D > .5 && panel(from, out, 'out')}
    {D < W - .5 && panel(to, inc, 'in')}
    {s.line > 0 && D > .5 && D < W - .5 && <div style={{position: 'absolute', top: 0, bottom: 0, left: lineX - s.line / 2, width: s.line, background: s.lineColor}}/>}
  </AbsoluteFill>;
}
