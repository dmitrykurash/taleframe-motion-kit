import React from 'react';
import {AbsoluteFill, Easing, useVideoConfig} from 'remotion';
import {useStage, type StageSize} from '../camera';
import {TimeShift} from '../clock';
import {samplesForStreak, shutterOffsets} from '../MotionBlur';
import {clamp01, mix, overshoot, slope, type Curve} from './curves';
import {Layer, STAGE, about, centerOf} from './layers';
import type {StackOptions, TransitionRenderProps} from './types';

/** A sheet arriving: quick to start, a long, soft landing. */
const sheet = Easing.bezier(.32, .72, 0, 1);

export function stackSettings(o: StackOptions, stage: StageSize = STAGE) {
  const side = o.side ?? 'bottom';
  const curve: Curve = (o.bounce ?? 0) > 0 ? overshoot(o.bounce ?? 0) : sheet;
  return {side, horizontal: side === 'left' || side === 'right', sign: side === 'bottom' || side === 'right' ? 1 : -1,
    recede: Math.min(1, Math.max(.6, o.recede ?? .9)), dim: clamp01(o.dim ?? .45), defocus: Math.max(0, o.defocus ?? 6),
    radius: Math.max(0, o.radius ?? 44), curve, shutter: o.shutter ?? .5, quality: o.quality ?? 14, backdrop: o.backdrop ?? '#000', stage};
}

/** State at progress p: g is the card's arrival (0 off frame … 1 in place, may overshoot); offset is where
 * the card sits along its axis; corners flatten only in the last stretch of the landing. */
export function stackPose(p: number, s: ReturnType<typeof stackSettings>) {
  const g = s.curve(clamp01(p));
  const span = s.horizontal ? s.stage.width : s.stage.height;
  return {g, offset: s.sign * (span + 80) * (1 - g), radius: s.radius * clamp01((1 - g) * 5), cardScale: mix(.95, 1, clamp01(g))};
}

export function StackTransition({from, to, time, start, duration, options}: TransitionRenderProps<StackOptions>) {
  const {fps} = useVideoConfig();
  const s = stackSettings(options, useStage());
  const span = s.horizontal ? s.stage.width : s.stage.height;
  const speed = (span + 80) * Math.abs(slope(s.curve, clamp01((time - start) / duration))) / duration / fps;
  const offsets = shutterOffsets(samplesForStreak(speed * s.shutter, s.quality), s.shutter, fps);
  const c = centerOf(s.stage);
  const sample = (offset: number) => {
    const {g, offset: along, radius, cardScale} = stackPose((time + offset - start) / duration, s);
    const back = clamp01(g);
    const move = s.horizontal ? `translate(${along.toFixed(2)}px, 0px)` : `translate(0px, ${along.toFixed(2)}px)`;
    const card = `${move} ${about(c, cardScale)}`;
    return <AbsoluteFill style={{background: s.backdrop}}>
      <Layer transform={about(c, mix(1, s.recede, back), 0, 0, -s.stage.height * .02 * back)}
        style={{filter: s.defocus * back > .3 ? `blur(${(s.defocus * back).toFixed(2)}px)` : undefined}}>{from}</Layer>
      {s.dim > 0 && <AbsoluteFill style={{background: '#000', opacity: s.dim * back}}/>}
      <AbsoluteFill style={{transform: card, transformOrigin: '0 0'}}>
        {radius > .5 && <AbsoluteFill style={{borderRadius: radius, boxShadow: '0 -12px 48px rgba(0,0,0,.14), 0 -1px 6px rgba(0,0,0,.05)'}}/>}
        <AbsoluteFill style={{clipPath: radius > .5 ? `inset(0px round ${radius.toFixed(2)}px)` : undefined, overflow: 'hidden'}}>{to}</AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>;
  };
  return <AbsoluteFill style={{background: s.backdrop, overflow: 'hidden'}}>
    <AbsoluteFill style={{isolation: 'isolate'}}>
      {offsets.map((offset, i) => <AbsoluteFill key={i} style={{opacity: 1 / (i + 1)}}>
        <TimeShift by={offset}>{sample(offset)}</TimeShift>
      </AbsoluteFill>)}
    </AbsoluteFill>
  </AbsoluteFill>;
}
