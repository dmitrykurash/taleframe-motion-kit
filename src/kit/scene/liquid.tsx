import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useStage} from '../camera';
import {bell} from '../moves';
import {clamp01, smoothstep} from './curves';
import {Layer, OVERSCAN, useSafeId} from './layers';
import type {LiquidOptions, TransitionRenderProps} from './types';

export function liquidSettings(o: LiquidOptions) {
  return {amount: Math.max(0, o.amount ?? 150), frequency: Math.max(.0005, o.frequency ?? .0045), flow: o.flow ?? 320,
    seed: o.seed ?? 3, backdrop: o.backdrop ?? '#000'};
}

/** Displacement (logical px) and the incoming shot's opacity at progress p: the distortion peaks at the
 * middle, and the swap happens there, hidden inside it. */
export function liquidPose(p: number, s: ReturnType<typeof liquidSettings>) {
  return {displace: s.amount * bell(p), alpha: smoothstep(.4, .6, p)};
}

export function LiquidTransition({from, to, time, start, duration, options}: TransitionRenderProps<LiquidOptions>) {
  const id = useSafeId('liquid');
  const s = liquidSettings(options);
  const stage = useStage();
  const p = clamp01((time - start) / duration);
  const {displace, alpha} = liquidPose(p, s);
  // The noise field flows by offsetting it; the filter region is widened so the shifted field still
  // covers the frame, and the pictures are scaled a little so displaced edges never pull in empty space.
  const flow = s.flow * (time - start), reach = Math.abs(s.flow) * duration + OVERSCAN;
  const cover = 1 + 2.2 * displace / Math.min(stage.width, stage.height);
  const on = displace > .5;
  return <AbsoluteFill style={{background: s.backdrop, overflow: 'hidden'}}>
    <AbsoluteFill style={{filter: on ? `url(#${id})` : undefined, transform: `scale(${cover.toFixed(4)})`}}>
      <Layer>{from}</Layer>
      {alpha > .001 && <Layer style={{opacity: alpha}}>{to}</Layer>}
    </AbsoluteFill>
    {on && <svg width="0" height="0" style={{position: 'absolute'}} aria-hidden>
      <filter id={id} filterUnits="userSpaceOnUse" x={-reach} y={-reach} width={stage.width + 2 * reach} height={stage.height + 2 * reach}
        colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency={`${s.frequency} ${s.frequency * 1.35}`} numOctaves={2} seed={s.seed} result="noise"/>
        <feOffset in="noise" dx={(flow * .8).toFixed(2)} dy={(flow * .45).toFixed(2)} result="flow"/>
        <feDisplacementMap in="SourceGraphic" in2="flow" scale={displace.toFixed(2)} xChannelSelector="R" yChannelSelector="G"/>
      </filter>
    </svg>}
  </AbsoluteFill>;
}
