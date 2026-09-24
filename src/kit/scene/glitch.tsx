import React from 'react';
import {AbsoluteFill} from 'remotion';
import {mulberry32} from '../../taleframe/transitions/kit';
import {useStage, type StageSize} from '../camera';
import {TimeShift} from '../clock';
import {clamp01} from './curves';
import {Layer, STAGE, SplitFilter, useSafeId} from './layers';
import type {GlitchOptions, TransitionRenderProps} from './types';

const LANDSCAPE_STAGE = STAGE;

export function glitchSettings(o: GlitchOptions) {
  return {intensity: clamp01(o.intensity ?? .75), cut: Math.min(.85, Math.max(.15, o.cut ?? .5)), rate: Math.max(6, Math.min(60, o.rate ?? 24)),
    split: Math.max(0, o.split ?? 34), color: o.color ?? '#ffffff', stutter: o.stutter ?? true, seed: o.seed ?? 7, backdrop: o.backdrop ?? '#000'};
}

export type GlitchBand = {y: number; height: number; dx: number; other: boolean};
export type GlitchFrame = {energy: number; incoming: boolean; split: number; splitY: number; bands: GlitchBand[];
  smear: {y: number; height: number; stretch: number; other: boolean} | null;
  blocks: {x: number; y: number; width: number; height: number; tone: 'color' | 'black'}[];
  hiccup: number; scanlines: number};

/** The glitch pattern for one film time. It only changes `rate` times per second and depends on nothing
 * but its inputs, so every seek and every fps produce the same pattern. */
export function glitchFrame(time: number, start: number, duration: number, s: ReturnType<typeof glitchSettings>, STAGE: StageSize = LANDSCAPE_STAGE): GlitchFrame {
  const p = clamp01((time - start) / duration);
  const step = Math.floor((time - start) * s.rate + 1e-6);
  const random = mulberry32((s.seed * 7919 + step * 104729) >>> 0);
  // The pattern holds for a whole glitch step, like a real signal fault; only the cut is frame-exact.
  const held = clamp01((step + .5) / s.rate / duration);
  // Energy rises into the cut and falls away after it; zero at both ends of the window.
  const shape = held < s.cut ? Math.sin(Math.PI / 2 * held / s.cut) ** 2 : Math.cos(Math.PI / 2 * (held - s.cut) / (1 - s.cut)) ** 2;
  const energy = p <= 0 || p >= 1 ? 0 : s.intensity * shape * (.72 + .28 * random());
  const incoming = p >= s.cut;
  const crossover = 1 - Math.min(1, Math.abs(held - s.cut) / .22);
  const bandCount = Math.round(energy * (3 + 7 * random()));
  const bands: GlitchBand[] = Array.from({length: bandCount}, () => {
    const height = 6 + random() ** 2.2 * 190;
    return {y: random() * (STAGE.height - height), height, dx: (random() - .5) * 2 * (40 + 220 * energy),
      other: random() < .45 * crossover};
  });
  const smear = energy > .25 && random() < .55 ? {y: random() * STAGE.height, height: 3 + random() * 5,
    stretch: 30 + random() * 160 * energy, other: random() < .5 * crossover} : null;
  const blocks = energy > .35 ? Array.from({length: Math.round(random() * 4 * energy)}, () => ({
    x: random() * STAGE.width, y: random() * STAGE.height, width: 40 + random() * 360, height: 8 + random() * 60,
    tone: (random() < .6 ? 'color' : 'black') as 'color' | 'black'})) : [];
  const hiccup = s.stutter && energy > .3 && random() < .4 ? -Math.floor(1 + random() * 3) / s.rate : 0;
  return {energy, incoming, split: s.split * energy * (.6 + .4 * random()) * (random() < .5 ? -1 : 1),
    splitY: (random() - .5) * 6 * energy, bands, smear, blocks, hiccup, scanlines: .22 * energy};
}

export function GlitchTransition({from, to, time, start, duration, options}: TransitionRenderProps<GlitchOptions>) {
  const id = useSafeId('glitch');
  const s = glitchSettings(options);
  const STAGE = useStage();
  const g = glitchFrame(time, start, duration, s, STAGE);
  const main = g.incoming ? to : from, other = g.incoming ? from : to;
  const shot = (useOther: boolean) => <TimeShift by={g.hiccup}>{useOther ? other : main}</TimeShift>;
  const split = Math.abs(g.split) > .3;
  // Channels shift beyond the frame edge; a matching scale-up keeps every edge covered in all three.
  const cover = split ? 1 + (Math.abs(g.split) + 4) / (STAGE.width / 2) : 1;
  return <AbsoluteFill style={{background: s.backdrop, overflow: 'hidden'}}>
    <AbsoluteFill style={{filter: split ? `url(#${id})` : undefined, transform: cover > 1 ? `scale(${cover})` : undefined}}>
      <Layer>{shot(false)}</Layer>
      {g.bands.map((band, i) => <AbsoluteFill key={i} style={{clipPath: `inset(${band.y}px 0 ${STAGE.height - band.y - band.height}px 0)`}}>
        <Layer transform={`translateX(${band.dx}px)`}>{shot(band.other)}</Layer>
      </AbsoluteFill>)}
      {g.smear && <AbsoluteFill style={{clipPath: `inset(${g.smear.y - g.smear.stretch / 2}px 0 ${STAGE.height - g.smear.y - g.smear.stretch / 2}px 0)`}}>
        {/* A few rows of pixels stretched into a band. */}
        <Layer transform={`translateY(${g.smear.y}px) scaleY(${g.smear.stretch / g.smear.height}) translateY(${-g.smear.y}px)`}>{shot(g.smear.other)}</Layer>
      </AbsoluteFill>}
      {g.blocks.map((block, i) => <div key={i} style={{position: 'absolute', left: block.x, top: block.y, width: block.width,
        height: block.height, background: block.tone === 'color' ? s.color : '#000', mixBlendMode: block.tone === 'color' ? 'difference' : 'normal'}}/>)}
    </AbsoluteFill>
    {g.scanlines > .01 && <AbsoluteFill style={{opacity: g.scanlines,
      background: 'repeating-linear-gradient(0deg, rgba(0,0,0,.55) 0 2px, rgba(0,0,0,0) 2px 5px)'}}/>}
    {split && <SplitFilter id={id} dx={g.split} dy={g.splitY}/>}
  </AbsoluteFill>;
}
