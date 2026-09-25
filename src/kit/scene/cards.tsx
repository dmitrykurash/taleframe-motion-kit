import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {useStage, type StageSize} from '../camera';
import {TimeShift} from '../clock';
import {samplesForStreak, shutterOffsets} from '../MotionBlur';
import {clamp01, curves, phase, slope} from './curves';
import {STAGE} from './layers';
import type {CardsOptions, TransitionRenderProps} from './types';

const PAN = [.2, .8] as const;

export function cardsSettings(o: CardsOptions, stage: StageSize = STAGE) {
  const direction = o.direction ?? 'left';
  return {direction, horizontal: direction === 'left' || direction === 'right', sign: direction === 'left' || direction === 'up' ? 1 : -1,
    scale: Math.min(.95, Math.max(.3, o.scale ?? .66)), gap: Math.max(0, o.gap ?? 80), radius: Math.max(0, o.radius ?? 44),
    shutter: o.shutter ?? .6, quality: o.quality ?? 16, backdrop: o.backdrop ?? '#0c0c0f', stage};
}

/** Card scale, and where each card's center sits (offset from the stage center along the move), at
 * progress p. The three phases overlap so shrink, slide, and grow read as one gesture. Neighboring cards
 * keep a constant gap at any scale, so they never overlap. */
export function cardsPose(p: number, s: ReturnType<typeof cardsSettings>) {
  const shrink = curves.snap(phase(p, 0, .42)), pan = curves.snap(phase(p, PAN[0], PAN[1])), grow = curves.snap(phase(p, .58, 1));
  const scale = 1 - (1 - s.scale) * (shrink - grow);
  const along = s.horizontal ? s.stage.width : s.stage.height;
  const pitch = (along + s.gap / s.scale) * scale;
  return {scale, outgoing: -s.sign * pan * pitch, incoming: s.sign * (1 - pan) * pitch, corner: s.radius * (1 - scale) / (1 - s.scale)};
}

export function CardsTransition({from, to, time, start, duration, options}: TransitionRenderProps<CardsOptions>) {
  const {fps} = useVideoConfig();
  const s = cardsSettings(options, useStage());
  const along = s.horizontal ? s.stage.width : s.stage.height;
  const u = phase((time - start) / duration, PAN[0], PAN[1]);
  const speed = (along * s.scale + s.gap) * Math.abs(slope(curves.snap, u)) / ((PAN[1] - PAN[0]) * duration) / fps;
  const offsets = shutterOffsets(samplesForStreak(speed * s.shutter, s.quality), s.shutter, fps);
  const card = (content: React.ReactNode, center: number, scale: number, corner: number, key: string) => {
    const d = s.horizontal ? `${center.toFixed(2)}px, 0px` : `0px, ${center.toFixed(2)}px`;
    const inStage = corner / Math.max(.01, scale);
    return <AbsoluteFill key={key} style={{transform: `translate(${d}) scale(${scale.toFixed(4)})`, transformOrigin: '50% 50%'}}>
      {corner > .5 && <AbsoluteFill style={{borderRadius: inStage, boxShadow: `0 ${30 / scale}px ${90 / scale}px rgba(0,0,0,.45)`}}/>}
      <AbsoluteFill style={{clipPath: corner > .5 ? `inset(0px round ${inStage.toFixed(2)}px)` : undefined, overflow: 'hidden'}}>{content}</AbsoluteFill>
    </AbsoluteFill>;
  };
  const sample = (offset: number) => {
    const c = cardsPose(clamp01((time + offset - start) / duration), s);
    const visible = (center: number) => Math.abs(center) < along * (1 + c.scale) / 2;
    return <AbsoluteFill style={{background: s.backdrop}}>
      {visible(c.outgoing) && card(from, c.outgoing, c.scale, c.corner, 'out')}
      {visible(c.incoming) && card(to, c.incoming, c.scale, c.corner, 'in')}
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
