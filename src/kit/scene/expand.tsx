import React from 'react';
import {AbsoluteFill, useVideoConfig} from 'remotion';
import {useStage, type StageSize} from '../camera';
import {TimeShift} from '../clock';
import {samplesForStreak, shutterOffsets} from '../MotionBlur';
import {clamp01, curves, mix, overshoot, phase, slope} from './curves';
import {Layer, STAGE, about, centerOf} from './layers';
import type {ExpandOptions, Rect, TransitionRenderProps} from './types';

const LANDSCAPE_STAGE = STAGE;
const DEFAULT_SOURCE: Rect = {x: 890, y: 470, width: 140, height: 140, radius: 36};
/** A soft lift under the growing window that fades as it becomes the frame. */
const lift = (g: number) => `0 ${Math.round(48 * (1 - g))}px ${Math.round(70 + 60 * g)}px rgba(0,0,0,${(.42 * (1 - g * g)).toFixed(3)})`;

export function expandSettings(o: ExpandOptions, stage: StageSize = STAGE) {
  const source = o.source ?? {...DEFAULT_SOURCE, x: stage.width / 2 - 70, y: stage.height / 2 - 70};
  if (!(source.width > 0 && source.height > 0)) throw new Error('Expand needs a source rect with positive size.');
  return {source, shape: o.shape ?? 'rect', color: o.color, colorHold: Math.min(.9, Math.max(0, o.colorHold ?? 0)), push: Math.min(1.3, Math.max(.8, o.push ?? 1.08)),
    dim: clamp01(o.dim ?? .4), defocus: Math.max(0, o.defocus ?? 8), curve: overshoot(o.bounce ?? 0),
    shutter: o.shutter ?? .45, quality: o.quality ?? 14, backdrop: o.backdrop ?? '#000', stage};
}

/** The window grows past the frame by this margin, so its edges cross the frame boundary at speed
 * instead of crawling toward it and reading as a border. */
const OVERGROW = 140;

/** The growing window at progress p: from the source element to a rect slightly larger than the frame. */
export function expandWindow(p: number, s: ReturnType<typeof expandSettings>) {
  const g = s.curve(clamp01(p));
  const src = s.source, STAGE = s.stage;
  if (s.shape === 'circle') {
    const cx = src.x + src.width / 2, cy = src.y + src.height / 2;
    const cover = Math.max(...[[0, 0], [STAGE.width, 0], [0, STAGE.height], [STAGE.width, STAGE.height]].map(([x, y]) => Math.hypot(x - cx, y - cy)));
    return {kind: 'circle' as const, x: cx, y: cy, radius: mix(Math.min(src.width, src.height) / 2, cover + OVERGROW, g), grow: g};
  }
  const x = mix(src.x, -OVERGROW, g), y = mix(src.y, -OVERGROW, g);
  const width = mix(src.width, STAGE.width + 2 * OVERGROW, g), height = mix(src.height, STAGE.height + 2 * OVERGROW, g);
  // Mid-growth the window keeps generous corners so it reads as a card; they flatten as it meets the frame.
  const gap = Math.max(0, x, y, STAGE.width - x - width, STAGE.height - y - height);
  const radius = Math.max(0, mix(src.radius ?? 0, 0, clamp01(g)) + 44 * 4 * clamp01(g) * (1 - clamp01(g))) * clamp01(gap / 48);
  return {kind: 'rect' as const, x, y, width, height, radius, grow: g};
}

/** Transform that makes the incoming shot cover the visible part of the window (identity once it covers the frame). */
export function expandContent(w: {x: number; y: number; width: number; height: number}, STAGE: StageSize = LANDSCAPE_STAGE): string {
  const x0 = Math.max(0, w.x), y0 = Math.max(0, w.y);
  const x1 = Math.min(STAGE.width, w.x + w.width), y1 = Math.min(STAGE.height, w.y + w.height);
  const scale = Math.max((x1 - x0) / STAGE.width, (y1 - y0) / STAGE.height);
  return `translate(${(x0 + x1) / 2}px, ${(y0 + y1) / 2}px) scale(${scale}) translate(${-STAGE.width / 2}px, ${-STAGE.height / 2}px)`;
}

export function ExpandTransition({from, to, time, start, duration, options}: TransitionRenderProps<ExpandOptions>) {
  const {fps} = useVideoConfig();
  const s = expandSettings(options, useStage());
  const p = clamp01((time - start) / duration);
  const src = s.source, STAGE = s.stage;
  // Fastest edge speed: the window corner farthest from its source travels about a frame diagonal.
  const speed = Math.hypot(STAGE.width, STAGE.height) * .6 * Math.abs(slope(s.curve, p)) / duration / fps;
  const offsets = shutterOffsets(samplesForStreak(speed * s.shutter, s.quality, 4), s.shutter, fps);

  const sample = (offset: number) => {
    const q = clamp01((time + offset - start) / duration);
    const w = expandWindow(q, s);
    const g = w.grow;
    const anchor = {x: src.x + src.width / 2, y: src.y + src.height / 2};
    const receding = about(anchor, mix(1, s.push, g));
    // The incoming shot is scaled to cover the window, so it seems to grow out of the element.
    const incoming = w.kind === 'rect' ? expandContent(w, STAGE) : about(centerOf(STAGE), mix(1.12, 1, curves.punchOut(q)));
    const clip = w.kind === 'rect'
      ? `inset(${w.y}px ${STAGE.width - w.x - w.width}px ${STAGE.height - w.y - w.height}px ${w.x}px round ${w.radius}px)`
      : `circle(${w.radius}px at ${w.x}px ${w.y}px)`;
    const tint = s.color ? 1 - curves.punchOut(phase(q, .04 + s.colorHold, .42 + s.colorHold * .6)) : 0;
    return <AbsoluteFill style={{background: s.backdrop}}>
      <Layer transform={receding} style={{filter: s.defocus * g > .3 ? `blur(${s.defocus * g}px)` : undefined}}>{from}</Layer>
      {s.dim > 0 && <AbsoluteFill style={{background: '#000', opacity: s.dim * g}}/>}
      {g < .98 && <div style={w.kind === 'rect'
        ? {position: 'absolute', left: w.x, top: w.y, width: w.width, height: w.height, borderRadius: w.radius, boxShadow: lift(g)}
        : {position: 'absolute', left: w.x - w.radius, top: w.y - w.radius, width: w.radius * 2, height: w.radius * 2, borderRadius: '50%', boxShadow: lift(g)}}/>}
      <AbsoluteFill style={{clipPath: clip}}>
        <Layer transform={incoming}>{to}</Layer>
        {tint > .002 && <AbsoluteFill style={{background: s.color, opacity: tint}}/>}
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
