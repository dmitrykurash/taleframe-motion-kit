import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {mulberry32} from '../../taleframe/transitions/kit';
import {useStage} from '../camera';
import {clamp01, curves, phase, slope} from './curves';
import {Layer, StreakFilter, useSafeId} from './layers';
import type {SliceOptions, TransitionRenderProps} from './types';

export function sliceSettings(o: SliceOptions) {
  const orientation = o.orientation ?? 'horizontal';
  const direction = o.direction ?? (orientation === 'horizontal' ? 'left' : 'up');
  if ((orientation === 'horizontal') !== (direction === 'left' || direction === 'right')) {
    throw new Error(`Slice direction "${direction}" does not match ${orientation} bands.`);
  }
  const bands = Math.max(1, Math.min(24, Math.round(o.bands ?? 5)));
  return {orientation, direction, bands, alternate: !!o.alternate, stagger: Math.max(0, Math.min(.5 / Math.max(1, bands - 1) * 2, o.stagger ?? .07)),
    order: o.order ?? 'sequence', lead: [...(o.lead ?? [])], leadWidth: Math.max(0, o.leadWidth ?? 150),
    seed: o.seed ?? 11, shutter: o.shutter ?? .5};
}

/** Start delay (fraction of the window) for every band. */
export function bandDelays(s: ReturnType<typeof sliceSettings>): number[] {
  const n = s.bands, rank = Array.from({length: n}, (_, i) => i);
  if (s.order === 'reverse') rank.reverse();
  if (s.order === 'center') {
    const mid = (n - 1) / 2;
    rank.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
  }
  if (s.order === 'random') {
    const random = mulberry32(s.seed);
    for (let i = n - 1; i > 0; i--) {const j = Math.floor(random() * (i + 1)); [rank[i], rank[j]] = [rank[j], rank[i]];}
  }
  const delays = new Array<number>(n);
  rank.forEach((band, position) => {delays[band] = position * s.stagger;});
  return delays;
}

/** Travel of one band at progress p: 0 = outgoing in place, 1 = incoming in place. */
export function bandTravel(p: number, delay: number, s: ReturnType<typeof sliceSettings>) {
  const length = 1 - (s.bands - 1) * s.stagger;
  return curves.snap(phase(p, delay, delay + length));
}

export function SliceTransition({from, to, time, start, duration, options}: TransitionRenderProps<SliceOptions>) {
  const {fps} = useVideoConfig();
  const baseId = useSafeId('slice');
  const s = sliceSettings(options);
  const STAGE = useStage();
  const p = clamp01((time - start) / duration);
  const delays = bandDelays(s);
  const horizontal = s.orientation === 'horizontal';
  const span = horizontal ? STAGE.width : STAGE.height, across = horizontal ? STAGE.height : STAGE.width;
  const leadTotal = s.lead.length * s.leadWidth;
  const length = 1 - (s.bands - 1) * s.stagger;
  return <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
    {delays.map((delay, i) => {
      const forward = (s.direction === 'left' || s.direction === 'up') ? -1 : 1;
      const sign = s.alternate && i % 2 ? -forward : forward;
      const travel = bandTravel(p, delay, s);
      const distance = span + leadTotal;
      const shift = sign * distance * travel; // outgoing moves this far; incoming follows `distance` behind
      const u = phase(p, delay, delay + length);
      const velocity = distance * Math.abs(slope(curves.snap, u)) / (length * duration) / fps;
      // Near rest a band's edge sits close to the frame edge; blurring past it would pull in empty
      // pixels. Velocity is low there anyway, so cap the blur by the distance to rest.
      const edge = Math.min(Math.abs(shift), Math.abs(shift - sign * distance));
      const streak = Math.min(velocity * s.shutter * .3, edge / 3);
      const a = i * across / s.bands, b = (i + 1) * across / s.bands;
      const clip = horizontal
        ? `inset(${Math.floor(a)}px 0 ${Math.ceil(STAGE.height - b)}px 0)`
        : `inset(0 ${Math.ceil(STAGE.width - b)}px 0 ${Math.floor(a)}px)`;
      const move = (offset: number) => horizontal ? `translateX(${offset}px)` : `translateY(${offset}px)`;
      const filterId = `${baseId}-${i}`;
      return <AbsoluteFill key={i} style={{clipPath: clip}}>
        <AbsoluteFill style={{filter: streak > .35 ? `url(#${filterId})` : undefined}}>
          {travel < 1 && <Layer clip={false} transform={move(shift)}>{from}</Layer>}
          {s.lead.map((color, k) => <div key={k} style={{position: 'absolute', background: color,
            ...(horizontal
              ? {top: 0, bottom: 0, width: s.leadWidth + 2, left: sign < 0 ? span + k * s.leadWidth - 1 : -(k + 1) * s.leadWidth - 1}
              : {left: 0, right: 0, height: s.leadWidth + 2, top: sign < 0 ? span + k * s.leadWidth - 1 : -(k + 1) * s.leadWidth - 1}),
            transform: move(shift)}}/>)}
          {travel > 0 && <Layer clip={false} transform={move(shift - sign * distance)}>{to}</Layer>}
        </AbsoluteFill>
        {streak > .35 && <StreakFilter id={filterId} x={horizontal ? streak : 0} y={horizontal ? 0 : streak}/>}
      </AbsoluteFill>;
    })}
  </AbsoluteFill>;
}
