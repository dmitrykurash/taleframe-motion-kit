import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {arrive, glide, progress, travel} from './motion';
import {graphemes, keystrokeSchedule, trackedWidth, typedAt} from './typing';
import {FontStyle, useTextMetrics} from './typography';

export type RevealProps = FontStyle & {
  text: string; start?: number; time?: number; stagger?: number; duration?: number;
  exit?: number; exitDuration?: number; blur?: number; rise?: number; color?: string;
  style?: React.CSSProperties;
};
export function useTime() { const {fps} = useVideoConfig(); return useCurrentFrame() / fps; }

/** A line whose characters reveal in an almost simultaneous, tightly staggered wave. */
export function CharacterReveal({text, start = 0, time, stagger = .008, duration = .50,
  exit = Infinity, exitDuration = .5, blur = 3, rise = 9, color = 'currentColor',
  fontFamily = 'Arial, sans-serif', fontSize = 64, fontWeight = 400, letterSpacing = 0, style,
}: RevealProps) {
  const clock = useTime(), t = time ?? clock;
  const metrics = useTextMetrics(text, {fontFamily, fontSize, fontWeight, letterSpacing});
  const out = travel(t, exit, exitDuration);
  if (!metrics) return null;
  return <div aria-label={text} style={{...style, position: 'relative', width: metrics.width,
    height: fontSize * 1.2, fontFamily, fontSize, fontWeight, color, whiteSpace: 'pre',
    lineHeight: 1.2, fontSynthesis: 'none', opacity: 1 - out, transform: `translateY(${-28 * out}px)`}}>
    {metrics.characters.map((character, i) => {
      const p = glide(progress(t, start + i * stagger, duration));
      return <span key={i} aria-hidden style={{position: 'absolute', left: metrics.positions[i], top: 0,
        opacity: p, transform: `translate(${4 * (1 - p)}px,${rise * (1 - p)}px)`,
        filter: p < .999 ? `blur(${blur * (1 - p)}px)` : undefined}}>{character}</span>;
    })}
  </div>;
}

/** A centered line expands as words enter. Split long copy into explicit lines. */
export function WordReveal({text, start = 0, time, stagger = .2, duration = .58,
  exit = Infinity, exitDuration = .5, blur = 5, rise = 16, color = 'currentColor',
  fontFamily = 'Georgia, serif', fontSize = 100, fontWeight = 400, letterSpacing = 0, style,
}: RevealProps) {
  const clock = useTime(), t = time ?? clock, out = travel(t, exit, exitDuration);
  const metrics = useTextMetrics(text, {fontFamily, fontSize, fontWeight, letterSpacing});
  const words = text.match(/\S+\s*/gu) ?? [];
  if (!metrics) return null;
  let characterIndex = 0;
  const entries = words.map((word, i) => {
    const length = graphemes(word).length;
    const end = characterIndex + length;
    const width = metrics.prefixWidths[end] - metrics.prefixWidths[characterIndex];
    characterIndex = end;
    return {word, width, enter: arrive(t, start + i * stagger, duration)};
  });
  const currentWidth = entries.reduce((width, item) => width + item.width * item.enter, 0);
  let left = 0;
  return <div aria-label={text} style={{...style, position: 'relative', width: currentWidth,
    height: fontSize * 1.2, fontFamily, fontSize, fontWeight, letterSpacing, lineHeight: 1.2,
    whiteSpace: 'pre', color, opacity: 1 - out, transform: `translateY(${-28 * out}px)`}}>
    {entries.map(({word, width, enter}, i) => {
      const x = left; left += width * enter;
      return <span key={i} aria-hidden style={{position: 'absolute', left: x, top: 0, opacity: enter,
        transform: `translateY(${rise * (1 - enter)}px)`, filter: enter < .999 ? `blur(${blur * (1 - enter)}px)` : undefined}}>{word}</span>;
    })}
  </div>;
}

export type TypingOptions = FontStyle & {text: string; start: number; end: number; seed?: number; time?: number};
/** Share trackedWidth with UI and background camera transforms. */
export function useTyping({text, start, end, seed = 7821, time, ...font}: TypingOptions) {
  const clock = useTime(), t = time ?? clock;
  const schedule = useMemo(() => keystrokeSchedule(text, start, end, seed), [text, start, end, seed]);
  const metrics = useTextMetrics(text, font);
  return {text: typedAt(text, schedule, t), schedule,
    width: metrics ? trackedWidth(t, schedule, metrics.prefixWidths) : 0,
    fullWidth: metrics?.width ?? 0, complete: t >= end, ready: metrics !== null};
}

export function TypedText({caret = true, color = 'currentColor', style, ...options}: TypingOptions & {
  caret?: boolean; color?: string; style?: React.CSSProperties;
}) {
  const result = useTyping(options), clock = useTime(), t = options.time ?? clock;
  const showCaret = caret && t >= options.start && (!result.complete || Math.floor(t * 2.2) % 2 === 0);
  return <span style={{...style, fontFamily: options.fontFamily ?? 'Arial, sans-serif', fontSize: options.fontSize ?? 64,
    fontWeight: options.fontWeight ?? 400, letterSpacing: options.letterSpacing ?? 0, whiteSpace: 'pre', color}}>
    {result.text}<span style={{display: 'inline-block', height: '1em', width: 2, marginLeft: 3, verticalAlign: '-.12em',
      background: color, opacity: showCaret ? 1 : 0}}/>
  </span>;
}
