import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {useStage, type StageSize} from '../camera';
import {TimeShift} from '../clock';
import {samplesForStreak, shutterOffsets} from '../MotionBlur';
import {clamp01, curves, phase, slope} from './curves';
import {STAGE} from './layers';
import type {TiltOptions, TransitionRenderProps} from './types';

const OUT_END = .72, IN_START = .24;

export function tiltSettings(o: TiltOptions, stage: StageSize = STAGE) {
  const direction = o.direction ?? 'up';
  return {direction, vertical: direction === 'up' || direction === 'down', sign: direction === 'up' || direction === 'left' ? 1 : -1,
    angle: o.angle ?? 40, depth: Math.max(0, o.depth ?? 900), perspective: Math.max(300, o.perspective ?? 1500),
    radius: Math.max(0, o.radius ?? 40), shutter: o.shutter ?? .5, quality: o.quality ?? 14, backdrop: o.backdrop ?? '#000', stage};
}

/** Progress of the outgoing plane falling away and of the incoming plane swinging into place. */
export function tiltPose(p: number) {
  return {away: curves.punchIn(phase(p, 0, OUT_END)), arrive: curves.punchOut(phase(p, IN_START, 1))};
}

export function TiltTransition({from, to, time, start, duration, options}: TransitionRenderProps<TiltOptions>) {
  const {fps} = useVideoConfig();
  const s = tiltSettings(options, useStage());
  const span = s.vertical ? s.stage.height : s.stage.width;
  const u = phase((time - start) / duration, IN_START, 1);
  const speed = span * Math.abs(slope(curves.punchOut, u)) / ((1 - IN_START) * duration) / fps;
  const offsets = shutterOffsets(samplesForStreak(speed * s.shutter, s.quality), s.shutter, fps);
  // One axis turns the planes: rotateX for vertical moves, rotateY for horizontal ones (sign mirrored).
  const turn = (deg: number) => s.vertical ? `rotateX(${deg.toFixed(3)}deg)` : `rotateY(${(-deg).toFixed(3)}deg)`;
  const shift = (d: number) => s.vertical ? `translate3d(0px, ${d.toFixed(2)}px, 0px)` : `translate3d(${d.toFixed(2)}px, 0px, 0px)`;
  const plane = (content: React.ReactNode, transform: string, radius: number, shade: number, key: string) =>
    <AbsoluteFill key={key} style={{transform: `perspective(${s.perspective}px) ${transform}`, transformOrigin: '50% 50%'}}>
      <AbsoluteFill style={{clipPath: radius > .5 ? `inset(0px round ${radius.toFixed(2)}px)` : undefined, overflow: 'hidden'}}>
        {content}
        {shade > .005 && <AbsoluteFill style={{background: '#000', opacity: shade}}/>}
      </AbsoluteFill>
    </AbsoluteFill>;
  const sample = (offset: number) => {
    const {away, arrive} = tiltPose(clamp01((time + offset - start) / duration));
    const out = `${shift(-s.sign * span * .3 * away)} translateZ(${(-s.depth * away).toFixed(2)}px) ${turn(s.sign * s.angle * away)}`;
    const incoming = `${shift(s.sign * span * 1.02 * (1 - arrive))} translateZ(${(s.depth * .22 * (1 - arrive)).toFixed(2)}px) ${turn(-s.sign * s.angle * (1 - arrive))}`;
    return <AbsoluteFill style={{background: s.backdrop}}>
      {away < 1 && plane(from, out, s.radius * Math.min(1, away * 4), .55 * away, 'out')}
      {arrive > 0 && plane(to, incoming, s.radius * Math.min(1, (1 - arrive) * 4), 0, 'in')}
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
