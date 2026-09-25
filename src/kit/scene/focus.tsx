import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useStage} from '../camera';
import {bell} from '../moves';
import {clamp01, curves, mix, phase, smoothstep} from './curves';
import {Layer, about, centerOf} from './layers';
import type {FocusOptions, TransitionRenderProps} from './types';

export function focusSettings(o: FocusOptions) {
  return {blur: Math.max(0, o.blur ?? 28), scale: Math.max(1, o.scale ?? 1.06), bloom: clamp01(o.bloom ?? .22), backdrop: o.backdrop ?? '#000'};
}

/** Blur and scale of both shots and the incoming shot's opacity at progress p. The swap happens only
 * while both are deep out of focus, so no sharp double image ever shows. */
export function focusPose(p: number, s: ReturnType<typeof focusSettings>) {
  return {outBlur: s.blur * smoothstep(0, .58, p), outScale: mix(1, s.scale, curves.glide(p)),
    inBlur: s.blur * (1 - smoothstep(.42, 1, p)), inScale: mix(s.scale, 1, curves.punchOut(phase(p, .3, 1))),
    alpha: smoothstep(.38, .62, p), bloom: s.bloom * bell(p)};
}

export function FocusTransition({from, to, time, start, duration, options}: TransitionRenderProps<FocusOptions>) {
  const s = focusSettings(options);
  const stage = useStage(), c = centerOf(stage);
  const f = focusPose(clamp01((time - start) / duration), s);
  // A blurred layer pulls in empty space at the frame edge; a little extra scale keeps the edge filled.
  const cover = (blur: number) => 1 + 2.4 * blur / Math.min(stage.width, stage.height);
  const blurred = (blur: number) => blur > .3 ? `blur(${blur.toFixed(2)}px)` : undefined;
  return <AbsoluteFill style={{background: s.backdrop, overflow: 'hidden', filter: f.bloom > .01 ? `brightness(${(1 + f.bloom).toFixed(3)})` : undefined}}>
    <Layer transform={about(c, f.outScale * cover(f.outBlur))} style={{filter: blurred(f.outBlur)}}>{from}</Layer>
    {f.alpha > .001 && <Layer transform={about(c, f.inScale * cover(f.inBlur))} style={{filter: blurred(f.inBlur), opacity: f.alpha}}>{to}</Layer>}
  </AbsoluteFill>;
}
