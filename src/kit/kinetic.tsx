import React, {useEffect, useMemo, useState} from 'react';
import {AbsoluteFill, cancelRender, continueRender, delayRender} from 'remotion';
import {mulberry32} from '../taleframe/transitions/kit';
import {useTime} from './clock';
import {clamp, mix, progress} from './motion';
import {curves} from './scene/curves';
import {graphemes} from './typing';
import {FontStyle, useTextMetrics} from './typography';

/** Kinetic typography. Every component derives its state from time; nothing uses timers or unseeded randomness.
 * Sizes are logical stage pixels. Letter spacing is in em here (display type is tracked relative to size).
 * Type is medium (500) unless a component is given a weight: go heavier only when the style calls for it. */
export type KineticFont = {fontFamily?: string; fontSize?: number; fontWeight?: number; letterSpacing?: number; color?: string};
const DEFAULT_FAMILY = '"DM Sans Variable", sans-serif';
export const fontCss = ({fontFamily = DEFAULT_FAMILY, fontSize = 140, fontWeight = 500, letterSpacing = -.035, color = 'currentColor'}: KineticFont): React.CSSProperties =>
  ({fontFamily, fontSize, fontWeight, letterSpacing: `${letterSpacing}em`, color, fontKerning: 'normal', fontSynthesis: 'none'});
export const measureFont = (f: KineticFont): FontStyle => ({fontFamily: f.fontFamily ?? DEFAULT_FAMILY, fontSize: f.fontSize ?? 140,
  fontWeight: f.fontWeight ?? 500, letterSpacing: (f.letterSpacing ?? -.035) * (f.fontSize ?? 140)});

/** Widths of several strings in one font, after the font has loaded. */
export function useTextWidths(texts: readonly string[], font: FontStyle): number[] | null {
  const key = JSON.stringify([texts, font]);
  const [result, setResult] = useState<{key: string; widths: number[]} | null>(null);
  const [handle] = useState(() => delayRender('Measure kinetic type'));
  useEffect(() => {
    let active = true, released = false;
    const update = delayRender('Measure changed kinetic type');
    const release = () => {if (!released) {released = true; continueRender(handle); continueRender(update);}};
    const {fontFamily = DEFAULT_FAMILY, fontSize = 140, fontWeight = 800, letterSpacing = 0} = font;
    document.fonts.load(`${fontWeight} ${fontSize}px ${fontFamily}`, texts.join('') || 'M').then(async () => {
      await document.fonts.ready;
      const ctx = document.createElement('canvas').getContext('2d');
      if (!ctx) throw new Error('Canvas text measurement is unavailable.');
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.fontKerning = 'normal';
      const widths = texts.map(text => ctx.measureText(text).width + graphemes(text).length * letterSpacing);
      if (active) setResult({key, widths});
      release();
    }).catch(error => {release(); if (active) cancelRender(error);});
    return () => {active = false; release();};
  }, [key, handle]);
  return result?.key === key ? result.widths : null;
}

/** A stretch of a line with its own style, e.g. one word in an italic serif inside a sans headline. */
export type TextRun = {text: string; fontFamily?: string; fontWeight?: number; fontStyle?: 'normal' | 'italic';
  color?: string; letterSpacing?: number; fontSize?: number};
export type RevealLine = string | readonly TextRun[];

export type MaskRevealProps = KineticFont & {
  /** Each line is a string, or runs with their own family, weight, style, or color. */
  lines: readonly RevealLine[];
  start?: number;
  /** Unit that moves: whole lines, words, or letters. */
  by?: 'line' | 'word' | 'character';
  /** Seconds between units. */
  stagger?: number;
  duration?: number;
  exit?: number;
  exitDuration?: number;
  exitStagger?: number;
  /** Side each unit enters from; it leaves through the opposite side. */
  from?: 'below' | 'above';
  /** Degrees a unit is tilted as it enters (a small value adds snap). */
  tilt?: number;
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
  time?: number;
  style?: React.CSSProperties;
};

export const runStyle = (run: TextRun): React.CSSProperties => ({fontFamily: run.fontFamily, fontWeight: run.fontWeight, fontStyle: run.fontStyle,
  color: run.color, fontSize: run.fontSize, letterSpacing: run.letterSpacing === undefined ? undefined : `${run.letterSpacing}em`});

/** The workhorse of launch typography: each line sits in a mask and its words (or letters) slide up
 * from behind the baseline, then leave upward. Nothing fades in place. */
export function MaskReveal({lines, start = 0, by = 'word', stagger = .055, duration = .8, exit = Infinity, exitDuration = .45,
  exitStagger = .03, from = 'below', tilt = 0, lineHeight = .98, align = 'left', time, style, ...font}: MaskRevealProps) {
  const clock = useTime(), t = time ?? clock;
  const dir = from === 'below' ? 1 : -1;
  let unit = 0;
  const offset = (k: number) => {
    const enter = curves.punchOut(progress(t, start + k * stagger, duration));
    const leave = curves.punchIn(progress(t, exit + k * exitStagger, exitDuration));
    return {y: dir * 120 * (1 - enter) - dir * 120 * leave, r: tilt * dir * (1 - enter)};
  };
  const pieces = (text: string) => by === 'line' ? [text] : by === 'word' ? text.split(/(\s+)/).filter(Boolean) : graphemes(text);
  return <div style={{...fontCss(font), lineHeight, textAlign: align, ...style}}>
    {lines.map((line, li) => {
      const runs: readonly TextRun[] = typeof line === 'string' ? [{text: line}] : line;
      return <div key={li} style={{overflow: 'hidden', padding: '.1em .06em .16em', margin: '-.1em -.06em -.16em', whiteSpace: 'pre'}}>
        {runs.map((run, ri) => <span key={ri} style={runStyle(run)}>{pieces(run.text).map((u, ui) => {
          if (/^\s+$/.test(u)) return <span key={ui}>{u}</span>;
          const {y, r} = offset(unit++);
          return <span key={ui} style={{display: 'inline-block', transform: `translateY(${y}%) rotate(${r}deg)`,
            transformOrigin: '0% 100%'}}>{u}</span>;
        })}</span>)}
      </div>;
    })}
  </div>;
}

export type WordRollProps = KineticFont & {
  /** Words that replace each other in place, e.g. ['designers.', 'developers.', 'everyone.']. */
  words: readonly string[];
  /** Time each word lands; the first entry is the first word's entrance. */
  at: readonly number[];
  /** Static text before the rolling word, on the same line. */
  prefix?: string;
  duration?: number;
  exit?: number;
  rollColor?: string;
  align?: 'left' | 'center' | 'right';
  time?: number;
  style?: React.CSSProperties;
};

/** A slot that rolls one word into the next while the line width follows smoothly. */
export function WordRoll({words, at, prefix, duration = .55, exit = Infinity, rollColor, align = 'left', time, style, ...font}: WordRollProps) {
  const clock = useTime(), t = time ?? clock;
  if (at.length !== words.length) throw new Error('WordRoll needs one landing time per word.');
  const widths = useTextWidths(words, measureFont(font));
  if (!widths) return null;
  let current = -1;
  at.forEach((time, i) => {if (t >= time) current = i;});
  const settle = current >= 0 ? curves.snap(progress(t, at[current], duration)) : 0;
  const previous = current - 1;
  const width = current < 0 ? 0 : mix(previous >= 0 ? widths[previous] : 0, widths[current], settle);
  const leave = curves.punchIn(progress(t, exit, .4));
  const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  // The line sits in its own mask, so `exit` carries it out of sight instead of just nudging it up.
  // `style` goes on the outer box so a caller's margin cannot undo the mask's compensating margins.
  return <div style={{...fontCss(font), lineHeight: 1, ...style}}><div style={{overflow: 'hidden', padding: '.1em .06em .16em', margin: '-.1em -.06em -.16em'}}>
    <div style={{display: 'flex', justifyContent: justify, whiteSpace: 'pre', transform: `translateY(${-130 * leave}%)`}}>
      {prefix && <span>{prefix}</span>}
      <span style={{position: 'relative', display: 'inline-block', width, height: '1em', overflow: 'hidden',
        padding: '.1em 0 .16em', margin: '-.1em 0 -.16em', color: rollColor ?? font.color}}>
        {words.map((word, i) => {
          if (i !== current && i !== previous) return null;
          const y = i === current ? 120 * (1 - settle) : -120 * settle;
          return <span key={i} style={{position: 'absolute', left: 0, top: '.1em', transform: `translateY(${y}%)`}}>{word}</span>;
        })}
      </span>
    </div>
  </div></div>;
}

export type SlamProps = KineticFont & {
  text: string;
  start?: number;
  /** Scale it punches in from; above 1 lands from the camera, below 1 pops out of the page. */
  scaleFrom?: number;
  duration?: number;
  exit?: number;
  /** Blur while moving, as a stand-in for motion blur on a text-only layer. */
  smear?: number;
  align?: 'left' | 'center' | 'right';
  time?: number;
  style?: React.CSSProperties;
};

/** A word or short line that hits the frame: fast scale into place with a speed-scaled blur. */
export function Slam({text, start = 0, scaleFrom = 1.7, duration = .38, exit = Infinity, smear = 1, align = 'center', time, style, ...font}: SlamProps) {
  const clock = useTime(), t = time ?? clock;
  const p = progress(t, start, duration), e = curves.punchOut(p);
  const speed = Math.abs(scaleFrom - 1) * (1 - e) * 6;
  const leave = curves.punchIn(progress(t, exit, .3));
  const scale = mix(scaleFrom, 1, e) * (1 - .25 * leave);
  return <div style={{...fontCss(font), lineHeight: 1, textAlign: align, whiteSpace: 'pre', opacity: clamp(p * 5) * (1 - leave),
    transform: `scale(${scale})`, filter: smear * speed > .15 ? `blur(${(smear * speed * 6).toFixed(2)}px)` : undefined, ...style}}>{text}</div>;
}

export type WordSequenceProps = KineticFont & {
  /** One word (or two) per beat. */
  words: readonly string[];
  start?: number;
  /** Seconds per word, or explicit landing times. */
  beat?: number;
  times?: readonly number[];
  /** Background/foreground per word; cycles. Omit to keep the parent's background. */
  palettes?: readonly [string, string][];
  /** The word grows this much over its beat (a subtle push that keeps the hold alive). */
  push?: number;
  time?: number;
};

/** Rapid-fire type: each word owns the whole frame for one beat, hard cut to the next. */
export function WordSequence({words, start = 0, beat = .38, times, palettes, push = .05, time, ...font}: WordSequenceProps) {
  const clock = useTime(), t = time ?? clock;
  const landings = times ?? words.map((_, i) => start + i * beat);
  let i = -1;
  landings.forEach((time, k) => {if (t >= time) i = k;});
  if (i < 0) return null;
  const local = t - landings[i], hold = (landings[i + 1] ?? landings[i] + beat * 2) - landings[i];
  const [background, color] = palettes?.length ? palettes[i % palettes.length] : [undefined, font.color];
  const land = curves.punchOut(clamp(local / .16));
  return <AbsoluteFill style={{background, display: 'grid', placeItems: 'center'}}>
    <div style={{...fontCss({...font, color}), lineHeight: 1, whiteSpace: 'pre',
      transform: `scale(${(1 + push * clamp(local / hold)) * mix(1.08, 1, land)})`}}>{words[i]}</div>
  </AbsoluteFill>;
}

export type CounterProps = KineticFont & {
  to: number;
  from?: number;
  start?: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  /** Group thousands (en-US separators). */
  group?: boolean;
  time?: number;
  style?: React.CSSProperties;
};

/** A number that counts with tabular figures, so digits never jitter while they change. */
export function Counter({to, from = 0, start = 0, duration = 1.1, decimals = 0, prefix = '', suffix = '', group = true, time, style, ...font}: CounterProps) {
  const clock = useTime(), t = time ?? clock;
  const value = mix(from, to, curves.punchOut(progress(t, start, duration)));
  const text = value.toLocaleString('en-US', {minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: group});
  return <div style={{...fontCss(font), lineHeight: 1, whiteSpace: 'pre', fontVariantNumeric: 'tabular-nums', ...style}}>{prefix}{text}{suffix}</div>;
}

export type ScrambleProps = KineticFont & {
  text: string;
  start?: number;
  /** Seconds until the last character resolves. */
  duration?: number;
  characters?: string;
  /** Random changes per second before a character settles. */
  rate?: number;
  seed?: number;
  time?: number;
  style?: React.CSSProperties;
};

/** Decode effect for technical films: characters cycle, then resolve left to right into the text.
 * Each slot keeps the final character's width, so the line never reflows. */
export function Scramble({text, start = 0, duration = .9, characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#%&*+=<>', rate = 28,
  seed = 3, time, style, ...font}: ScrambleProps) {
  const clock = useTime(), t = time ?? clock;
  const metrics = useTextMetrics(text, measureFont(font));
  const pool = useMemo(() => graphemes(characters), [characters]);
  if (!metrics) return null;
  const step = Math.floor((t - start) * rate);
  const n = metrics.characters.length;
  return <div style={{...fontCss(font), position: 'relative', width: metrics.width, height: '1.2em', lineHeight: 1.2, whiteSpace: 'pre', ...style}}>
    {metrics.characters.map((character, i) => {
      if (t < start) return null;
      const settleAt = start + duration * Math.pow((i + 1) / n, .85);
      const shown = t >= settleAt || /\s/.test(character) ? character
        : pool[Math.floor(mulberry32((seed * 7919 + i * 131 + step * 3571) >>> 0)() * pool.length)];
      return <span key={i} style={{position: 'absolute', left: metrics.positions[i], top: 0, letterSpacing: 0,
        opacity: t >= settleAt ? 1 : .7}}>{shown}</span>;
    })}
  </div>;
}

export type TrackInProps = KineticFont & {
  text: string;
  start?: number;
  duration?: number;
  /** Tracking (em) the word starts from; it tightens to `letterSpacing`. */
  trackFrom?: number;
  exit?: number;
  time?: number;
  style?: React.CSSProperties;
};

/** Cinematic title move: wide tracking tightens while the word sharpens into place. */
export function TrackIn({text, start = 0, duration = 1.6, trackFrom = .45, exit = Infinity, time, style, ...font}: TrackInProps) {
  const clock = useTime(), t = time ?? clock;
  const e = curves.punchOut(progress(t, start, duration));
  const leave = curves.glide(progress(t, exit, .5));
  const tracking = mix(trackFrom, font.letterSpacing ?? -.02, e);
  return <div style={{...fontCss(font), letterSpacing: `${tracking}em`, lineHeight: 1, whiteSpace: 'pre', textAlign: 'center',
    opacity: clamp(e * 1.6) * (1 - leave), filter: e < .98 ? `blur(${(1 - e) * 10}px)` : undefined, ...style}}>{text}</div>;
}
