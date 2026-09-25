import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {useStage, type StageSize} from '../camera';
import {TimeShift} from '../clock';
import {samplesForStreak, shutterOffsets} from '../MotionBlur';
import {clamp01, curves, extended, slope} from './curves';
import {Layer, STAGE, StreakFilter, centerOf, useSafeId} from './layers';
import type {TransitionRenderProps, WhipOptions} from './types';

const accelerate = extended(curves.punchIn), land = extended(curves.punchOut);

export function whipSettings(o: WhipOptions, stage: StageSize = STAGE) {
  const direction = o.direction ?? 'left';
  return {direction, horizontal: direction === 'left' || direction === 'right', sign: direction === 'left' || direction === 'up' ? -1 : 1,
    spin: o.spin ?? 0, bulge: Math.max(1, o.bulge ?? 1.05), shutter: o.shutter ?? .9, quality: o.quality ?? 20,
    backdrop: o.backdrop ?? '#000', stage};
}

/** Fraction of a frame the strip has travelled: a slow start, peak speed at the middle, a long landing.
 * Both halves meet at the middle with the same speed, so the move reads as one pan. */
export function whipTravel(p: number): number {
  return p < .5 ? .5 * accelerate(2 * p) : .5 + .5 * land(2 * p - 1);
}

/** Frames per unit of progress travelled at p (1 = one frame width over the whole window). */
export function whipRate(p: number): number {
  const q = clamp01(p);
  return q < .5 ? slope(curves.punchIn, 2 * q) : slope(curves.punchOut, 2 * q - 1);
}

export function WhipTransition({from, to, time, start, duration, options}: TransitionRenderProps<WhipOptions>) {
  const {fps} = useVideoConfig();
  const streakId = useSafeId('whip');
  const s = whipSettings(options, useStage());
  const span = s.horizontal ? s.stage.width : s.stage.height;
  const speed = span * whipRate((time - start) / duration) / duration / fps;
  const streak = speed * s.shutter;
  const offsets = shutterOffsets(samplesForStreak(streak, s.quality), s.shutter, fps);
  // At peak speed the copies sit tens of pixels apart; a blur along the move closes the gaps.
  const gap = offsets.length > 1 ? streak / offsets.length : 0;
  const smear = gap > 2 ? Math.min(48, gap * .55) : 0;
  const c = centerOf(s.stage);
  const sample = (offset: number) => {
    const travel = whipTravel((time + offset - start) / duration);
    const shift = s.sign * span * travel, incoming = shift - s.sign * span;
    const turn = s.spin * (travel < .5 ? travel : travel - 1);
    const bump = 1 + (s.bulge - 1) * Math.sin(Math.PI * clamp01(travel));
    const move = (d: number) => s.horizontal ? `translate(${d.toFixed(2)}px, 0px)` : `translate(0px, ${d.toFixed(2)}px)`;
    return <AbsoluteFill style={{background: s.backdrop, transformOrigin: '0 0',
      transform: `translate(${c.x}px, ${c.y}px) rotate(${turn.toFixed(3)}deg) scale(${bump.toFixed(4)}) translate(${-c.x}px, ${-c.y}px)`}}>
      {Math.abs(shift) < span && <Layer clip={false} transform={move(shift)}>{from}</Layer>}
      {Math.abs(incoming) < span && <Layer clip={false} transform={move(incoming)}>{to}</Layer>}
    </AbsoluteFill>;
  };
  return <AbsoluteFill style={{background: s.backdrop, overflow: 'hidden'}}>
    <AbsoluteFill style={{isolation: 'isolate', filter: smear > .4 ? `url(#${streakId})` : undefined}}>
      {offsets.map((offset, i) => <AbsoluteFill key={i} style={{opacity: 1 / (i + 1)}}>
        <TimeShift by={offset}>{sample(offset)}</TimeShift>
      </AbsoluteFill>)}
    </AbsoluteFill>
    {smear > .4 && <StreakFilter id={streakId} x={s.horizontal ? smear : 0} y={s.horizontal ? 0 : smear}/>}
  </AbsoluteFill>;
}
