import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {useStage, type StageSize} from '../camera';
import {TimeShift} from '../clock';
import {samplesForStreak, shutterOffsets} from '../MotionBlur';
import {clamp01, curves, extended, slope} from './curves';
import {ChromaFilter, Layer, STAGE, about, centerOf, farthestCorner, useSafeId} from './layers';
import type {TransitionRenderProps, ZoomOptions} from './types';

const pushCurve = extended(curves.punchIn), landCurve = extended(curves.punchOut);

export function zoomSettings(o: ZoomOptions, stage: StageSize = STAGE) {
  const cut = Math.min(.8, Math.max(.2, o.cut ?? .5));
  const push = Math.max(1.05, o.push ?? 2.4), land = Math.max(1.02, o.land ?? 1.6);
  return {cut, push, land, roll: o.roll ?? 0, focus: o.focus ?? centerOf(stage), landing: o.landing ?? centerOf(stage), stage,
    flash: clamp01(o.flash ?? .18), flashColor: o.flashColor ?? '#ffffff', chroma: clamp01(o.chroma ?? .35),
    shutter: o.shutter ?? .75, quality: o.quality ?? 24, backdrop: o.backdrop ?? '#000'};
}

/** Camera state of each half. Outside its own half a curve keeps its end velocity, so motion-blur
 * samples near the cut continue the move instead of mixing the two shots. */
export function zoomPose(p: number, s: ReturnType<typeof zoomSettings>) {
  const a = pushCurve(p / s.cut), b = landCurve((p - s.cut) / (1 - s.cut));
  return {
    outgoing: {scale: Math.exp(Math.log(s.push) * a), roll: s.roll * a},
    incoming: {scale: Math.exp(Math.log(s.land) * (1 - b)), roll: -s.roll * .6 * (1 - b)},
  };
}

/** Logical pixels the fastest visible point travels during one frame at progress p. */
export function zoomSpeed(p: number, s: ReturnType<typeof zoomSettings>, duration: number, fps: number) {
  const incoming = p >= s.cut;
  const u = incoming ? (p - s.cut) / (1 - s.cut) : p / s.cut;
  const rate = incoming
    ? (Math.log(s.land) + Math.abs(s.roll * .6) * Math.PI / 180) * slope(curves.punchOut, u) / (1 - s.cut)
    : (Math.log(s.push) + Math.abs(s.roll) * Math.PI / 180) * slope(curves.punchIn, u) / s.cut;
  return farthestCorner(incoming ? s.landing : s.focus, s.stage) * rate / duration / fps;
}

export function ZoomTransition({from, to, time, start, duration, options}: TransitionRenderProps<ZoomOptions>) {
  const {fps} = useVideoConfig();
  const chromaId = useSafeId('zoom-chroma');
  const s = zoomSettings(options, useStage());
  const p = clamp01((time - start) / duration);
  const incoming = p >= s.cut;
  const speed = zoomSpeed(p, s, duration, fps);
  const streak = speed * s.shutter;
  const offsets = shutterOffsets(samplesForStreak(streak, s.quality), s.shutter, fps);
  // When the streak outruns the sample budget, a small isotropic blur closes the gaps between copies.
  const gap = offsets.length > 1 ? streak / offsets.length : 0;
  const soften = gap > 3 ? Math.min(6, .45 * gap) : 0;
  const fringe = s.chroma * Math.min(1, speed / 90) * 22;
  const sample = (offset: number) => {
    const pose = zoomPose((time + offset - start) / duration, s);
    return incoming
      ? <Layer clip={false} transform={about(s.landing, pose.incoming.scale, pose.incoming.roll)}>{to}</Layer>
      : <Layer clip={false} transform={about(s.focus, pose.outgoing.scale, pose.outgoing.roll)}>{from}</Layer>;
  };
  const filters = [fringe > .4 ? `url(#${chromaId})` : '', soften > .2 ? `blur(${soften}px)` : ''].filter(Boolean).join(' ');
  const burst = s.flash * Math.exp(-(((time - start - s.cut * duration) / .055) ** 2));
  return <AbsoluteFill style={{background: s.backdrop, overflow: 'hidden'}}>
    <AbsoluteFill style={{isolation: 'isolate', filter: filters || undefined}}>
      {offsets.map((offset, i) => <AbsoluteFill key={i} style={{opacity: 1 / (i + 1)}}>
        <TimeShift by={offset}>{sample(offset)}</TimeShift>
      </AbsoluteFill>)}
    </AbsoluteFill>
    {burst > .004 && <AbsoluteFill style={{mixBlendMode: 'plus-lighter', opacity: burst,
      background: `radial-gradient(ellipse at ${(incoming ? s.landing : s.focus).x}px ${(incoming ? s.landing : s.focus).y}px, ${s.flashColor} 0%, color-mix(in srgb, ${s.flashColor} 60%, transparent) 35%, transparent 75%)`}}/>}
    {fringe > .4 && <ChromaFilter id={chromaId} amount={fringe} stage={s.stage}/>}
  </AbsoluteFill>;
}
