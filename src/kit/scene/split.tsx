import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {useStage, type StageSize} from '../camera';
import {TimeShift} from '../clock';
import {bell} from '../moves';
import {samplesForStreak, shutterOffsets} from '../MotionBlur';
import {clamp01, curves, mix, phase, slope} from './curves';
import {Layer, STAGE, about, centerOf} from './layers';
import type {SplitOptions, TransitionRenderProps} from './types';

const OPEN = .12;

export function splitSettings(o: SplitOptions, stage: StageSize = STAGE) {
  return {angle: o.angle ?? 90, at: o.at ?? centerOf(stage), depth: Math.max(1, o.depth ?? 1.12), seam: clamp01(o.seam ?? .7),
    seamColor: o.seamColor ?? '#ffffff', shutter: o.shutter ?? .6, quality: o.quality ?? 14, backdrop: o.backdrop ?? '#000', stage};
}

/** Direction along the split (v), across it (n), and how far each half travels to clear the frame. */
export function splitGeometry(s: ReturnType<typeof splitSettings>) {
  const a = s.angle * Math.PI / 180;
  const v = {x: Math.cos(a), y: Math.sin(a)}, n = {x: -Math.sin(a), y: Math.cos(a)};
  const {width: W, height: H} = s.stage;
  const reach = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.abs((x - s.at.x) * n.x + (y - s.at.y) * n.y)));
  return {v, n, travel: reach + 60};
}

/** Distance each half has moved at progress p. The seam lights first, then the halves open. */
export const splitOpen = (p: number, travel: number) => travel * curves.snap(phase(p, OPEN, 1));

export function SplitTransition({from, to, time, start, duration, options}: TransitionRenderProps<SplitOptions>) {
  const {fps} = useVideoConfig();
  const s = splitSettings(options, useStage());
  const g = splitGeometry(s);
  const p = clamp01((time - start) / duration);
  const u = phase(p, OPEN, 1);
  const speed = g.travel * Math.abs(slope(curves.snap, u)) / ((1 - OPEN) * duration) / fps;
  const offsets = shutterOffsets(samplesForStreak(speed * s.shutter, s.quality), s.shutter, fps);
  const L = 6000, {v, n} = g, c = centerOf(s.stage);
  const half = (side: 1 | -1) => {
    const pts = [[L, 0], [L, side * L], [-L, side * L], [-L, 0]].map(([a, b]) => `${(s.at.x + v.x * a + n.x * b).toFixed(1)}px ${(s.at.y + v.y * a + n.y * b).toFixed(1)}px`);
    return `polygon(${pts.join(', ')})`;
  };
  const clips = {plus: half(1), minus: half(-1)};
  const sample = (offset: number) => {
    const q = clamp01((time + offset - start) / duration);
    const d = splitOpen(q, g.travel);
    return <AbsoluteFill style={{background: s.backdrop}}>
      <Layer transform={about(c, mix(s.depth, 1, curves.punchOut(phase(q, OPEN * .5, 1))))}>{to}</Layer>
      {d < g.travel - 1 && ([1, -1] as const).map(side => <AbsoluteFill key={side} style={{clipPath: side > 0 ? clips.plus : clips.minus,
        transform: `translate(${(n.x * d * side).toFixed(2)}px, ${(n.y * d * side).toFixed(2)}px)`}}>{from}</AbsoluteFill>)}
    </AbsoluteFill>;
  };
  const glow = s.seam * bell(phase(p, 0, OPEN * 2.6));
  return <AbsoluteFill style={{background: s.backdrop, overflow: 'hidden'}}>
    <AbsoluteFill style={{isolation: 'isolate'}}>
      {offsets.map((offset, i) => <AbsoluteFill key={i} style={{opacity: 1 / (i + 1)}}>
        <TimeShift by={offset}>{sample(offset)}</TimeShift>
      </AbsoluteFill>)}
    </AbsoluteFill>
    {glow > .01 && <div style={{position: 'absolute', left: s.at.x - L, top: s.at.y - 2, width: 2 * L, height: 4, background: s.seamColor,
      opacity: glow, borderRadius: 2, boxShadow: `0 0 18px 4px ${s.seamColor}, 0 0 60px 12px ${s.seamColor}`, mixBlendMode: 'plus-lighter',
      transform: `rotate(${s.angle}deg)`, transformOrigin: `${L}px 2px`}}/>}
  </AbsoluteFill>;
}
