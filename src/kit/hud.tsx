import React from 'react';
import {useVideoConfig} from 'remotion';
import {useStage} from './camera';
import {useTime} from './clock';
import {Scramble} from './kinetic';
import {arrive, clamp, mix, progress} from './motion';
import {spring} from './moves';
import {curves} from './scene/curves';

/** Design-tool overlays for motion reels: a camera viewfinder frame and a selection box with handles. */

const MONO = '"Geist Mono Variable", ui-monospace, monospace';

export type ViewfinderProps = {
  /** Top-left line, e.g. 'TALEFRAME — MOTION REEL'. */
  title?: string;
  /** Top-right line, e.g. '120 BPM · 60 FPS · 1920×1080'. */
  specs?: string;
  /** Bottom-right labels from their times, e.g. [{at: 0, label: '01 · TYPE'}]. */
  sections?: readonly {at: number; label: string}[];
  /** Film length in seconds, for the progress line. */
  duration?: number;
  color?: string;
  accent?: string;
  /** Distance of the frame from the stage edges. */
  inset?: number;
  /** Time the frame draws itself in. */
  start?: number;
  /** Colors per time, for films that switch between dark and light grounds: [{at, color}]. */
  tones?: readonly {at: number; color: string}[];
  time?: number;
};

const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');

/** A camera viewfinder over the whole film: corner brackets, a title and specs, a running timecode with a
 * recording dot, a progress line, and a section label that decodes when it changes. */
export function Viewfinder({title = 'MOTION REEL', specs = '', sections = [], duration, color = 'rgba(255,255,255,.72)', accent = '#ff5a1f',
  inset = 34, start = 0, tones = [], time}: ViewfinderProps) {
  const clock = useTime(), t = time ?? clock;
  const {fps, durationInFrames} = useVideoConfig();
  const stage = useStage();
  const tone = tones.reduce((found, k) => (t >= k.at ? k.color : found), color);
  const grow = curves.punchOut(progress(t, start, .6)), show = arrive(t, start + .15, .4);
  const arm = 30 * grow, W = stage.width, H = stage.height, i = inset;
  const bracket = (x: number, y: number, dx: number, dy: number) => <React.Fragment key={`${x}-${y}`}>
    <div style={{position: 'absolute', left: dx > 0 ? x : x - arm, top: y - .75, width: arm, height: 1.5, background: tone}}/>
    <div style={{position: 'absolute', left: x - .75, top: dy > 0 ? y : y - arm, width: 1.5, height: arm, background: tone}}/>
  </React.Fragment>;
  const total = duration ?? durationInFrames / fps;
  const frame = Math.max(0, Math.floor(t * fps + 1e-6));
  const code = `${pad(frame / (fps * 3600))}:${pad(frame / (fps * 60) % 60)}:${pad(frame / fps % 60)}:${pad(frame % fps)}`;
  const section = sections.reduce<{at: number; label: string} | null>((found, s) => (t >= s.at ? s : found), null);
  const label = {position: 'absolute' as const, fontFamily: MONO, fontSize: 14, letterSpacing: '.08em', color: tone, opacity: show, whiteSpace: 'pre' as const};
  return <div style={{position: 'absolute', inset: 0, pointerEvents: 'none'}}>
    {bracket(i, i, 1, 1)}{bracket(W - i, i, -1, 1)}{bracket(i, H - i, 1, -1)}{bracket(W - i, H - i, -1, -1)}
    <div style={{...label, left: i + 44, top: i - 7}}>
      <Scramble text={title} start={start + .1} duration={.6} fontFamily={MONO} fontSize={14} letterSpacing={.08} fontWeight={500} color={tone}/>
    </div>
    <div style={{...label, right: i + 44, top: i - 7, textAlign: 'right'}}>{specs}</div>
    <div style={{...label, left: i + 44, bottom: i - 9, display: 'flex', alignItems: 'center', gap: 10}}>
      <i style={{width: 7, height: 7, borderRadius: 4, background: accent, opacity: Math.floor(t * 2) % 2 === 0 ? 1 : .35}}/>{code}
    </div>
    <div style={{position: 'absolute', left: i + 210, right: i + 260, bottom: i - 1, height: 1.5, background: tone, opacity: show * .25}}>
      <div style={{width: `${clamp(t / total) * 100}%`, height: '100%', background: accent, opacity: 1 / .25 * .9}}/>
    </div>
    {section && <div key={section.at} style={{...label, right: i + 44, bottom: i - 9}}>
      <Scramble text={section.label} start={section.at} duration={.45} fontFamily={MONO} fontSize={14} letterSpacing={.08} fontWeight={500} color={tone}/>
    </div>}
  </div>;
}

export type SelectionBoxProps = {
  /** Box in the parent's coordinates. */
  rect: {x: number; y: number; width: number; height: number};
  start?: number;
  color?: string;
  /** Chip under the box. Default: the box size, e.g. '1080 × 320'. */
  label?: string;
  /** Small name above the top-left corner, e.g. 'Heading'. */
  name?: string;
  handles?: boolean;
  /** Time the selection clears. */
  exit?: number;
  time?: number;
};

/** A design-tool selection around an element: the outline draws on, handles pop in, and a size chip rises. */
export function SelectionBox({rect, start = 0, color = '#3d6bff', label, name, handles = true, exit, time}: SelectionBoxProps) {
  const clock = useTime(), t = time ?? clock;
  const {x, y, width: w, height: h} = rect;
  const draw = curves.punchOut(progress(t, start, .5));
  const gone = exit === undefined ? 0 : curves.punchIn(progress(t, exit, .25));
  if (t < start || gone >= 1) return null;
  const perimeter = 2 * (w + h);
  const points = [[0, 0], [.5, 0], [1, 0], [1, .5], [1, 1], [.5, 1], [0, 1], [0, .5]];
  const chip = label ?? `${Math.round(w)} × ${Math.round(h)}`;
  const rise = arrive(t, start + .3, .4);
  return <div style={{position: 'absolute', left: x, top: y, width: w, height: h, pointerEvents: 'none', opacity: 1 - gone}}>
    <svg width={w} height={h} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <rect x={0} y={0} width={w} height={h} fill="none" stroke={color} strokeWidth={1.5}
        strokeDasharray={perimeter} strokeDashoffset={perimeter * (1 - draw)}/>
    </svg>
    {handles && points.map(([u, v], k) => {
      const pop = spring(t - start - .15 - k * .035, {duration: .4, bounce: .3});
      return <div key={k} style={{position: 'absolute', left: u * w - 6, top: v * h - 6, width: 12, height: 12, background: '#fff',
        border: `1.5px solid ${color}`, boxSizing: 'border-box', transform: `scale(${Math.max(0, pop)})`}}/>;
    })}
    {name && <div style={{position: 'absolute', left: 0, top: -26, fontFamily: MONO, fontSize: 14, color, opacity: rise}}>{name}</div>}
    <div style={{position: 'absolute', left: '50%', top: h + 14, transform: `translate(-50%, ${mix(8, 0, rise)}px)`, opacity: rise, background: color, color: '#fff',
      fontFamily: MONO, fontSize: 14, padding: '4px 9px', borderRadius: 5, whiteSpace: 'pre'}}>{chip}</div>
  </div>;
}
