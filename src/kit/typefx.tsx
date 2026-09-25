import React from 'react';
import {useStage} from './camera';
import {useTime} from './clock';
import {fontCss, measureFont, runStyle, useTextWidths, type KineticFont, type RevealLine, type TextRun} from './kinetic';
import {arrive, clamp, mix, progress} from './motion';
import {stagger, type StaggerOrder} from './moves';
import {poseAt, poseStyle, preset, unitOf, type PresetName} from './presets';
import {curves} from './scene/curves';
import {graphemes} from './typing';

/** Kinetic type built on motion presets, plus type effects: marks, echoes, marquees, shine, circular
 * text, split words, and variable-weight waves. Everything derives from time. */

export type KineticTextProps = KineticFont & {
  /** Each line is a string, or runs with their own family, weight, style, or color. */
  lines: readonly RevealLine[];
  /** Piece that moves: whole lines, words, or letters. */
  by?: 'line' | 'word' | 'character';
  /** Motion preset for the entrance (see PRESETS). Default 'rise'. */
  enter?: PresetName;
  /** Motion preset for the exit. Defaults to the entrance's. */
  exit?: PresetName;
  start?: number;
  /** Seconds between pieces. */
  stagger?: number;
  /** Which piece moves first: 'start', 'end', 'center' (outward), 'edges' (inward), or 'random'. */
  order?: StaggerOrder;
  /** Seconds per piece; defaults to the preset's. */
  duration?: number;
  /** Time the exit begins. Omit to stay. */
  exitAt?: number;
  exitDuration?: number;
  exitStagger?: number;
  exitOrder?: StaggerOrder;
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
  seed?: number;
  time?: number;
  style?: React.CSSProperties;
};

const isSpace = (piece: string) => /^\s+$/.test(piece);
const lineMask: React.CSSProperties = {overflow: 'hidden', padding: '.1em .06em .16em', margin: '-.1em -.06em -.16em'};

/** Any motion preset, applied to lines, words, or letters with a stagger order. Eighteen presets times
 * three piece sizes times five orders, with separate exits: most of a film's type vocabulary. */
export function KineticText({lines, by = 'word', enter = 'rise', exit, start = 0, stagger: each = .05, order = 'start', duration,
  exitAt, exitDuration, exitStagger, exitOrder, lineHeight = 1, align = 'left', seed = 1, time, style, ...font}: KineticTextProps) {
  const clock = useTime(), t = time ?? clock;
  const size = font.fontSize ?? 140, weight = font.fontWeight ?? 800, tracking = font.letterSpacing ?? -.035;
  const split = (text: string) => by === 'line' ? [text] : by === 'word' ? text.split(/(\s+)/).filter(Boolean) : graphemes(text);
  const structure = lines.map(line => (typeof line === 'string' ? [{text: line}] as TextRun[] : line).map(run => ({run, pieces: split(run.text)})));
  const count = structure.flat().reduce((n, r) => n + r.pieces.filter(p => !isSpace(p)).length, 0);
  const active = preset(exitAt !== undefined && t >= exitAt ? exit ?? enter : enter);
  let k = 0;
  return <div style={{...fontCss(font), lineHeight, textAlign: align, ...style}}>
    {structure.map((runs, li) => <div key={li} style={{whiteSpace: 'pre', ...(active.mask ? lineMask : null)}}>
      {runs.map(({run, pieces}, ri) => <span key={ri} style={runStyle(run)}>{pieces.map((piece, pi) => {
        if (isSpace(piece)) return <span key={pi}>{piece}</span>;
        const index = k++, u = unitOf(index, count, seed);
        const out = exitAt === undefined ? undefined : exitAt + stagger(index, count, exitStagger ?? each * .6, exitOrder ?? order, seed);
        const {pose, preset: p} = poseAt(t, u, {enter, exit, start: start + stagger(index, count, each, order, seed), duration,
          exitAt: out, exitDuration});
        return <span key={pi} style={poseStyle(pose, run.fontSize ?? size, {weight: run.fontWeight ?? weight,
          tracking: run.letterSpacing ?? tracking, origin: p.origin})}>{piece}</span>;
      })}</span>)}
    </div>)}
  </div>;
}

export type TextSwapProps = KineticFont & {
  /** Texts that replace each other in place. */
  texts: readonly string[];
  /** Time each text arrives; the first is the first entrance. */
  at: readonly number[];
  enter?: PresetName;
  exit?: PresetName;
  by?: 'word' | 'character';
  stagger?: number;
  order?: StaggerOrder;
  duration?: number;
  exitDuration?: number;
  align?: 'left' | 'center' | 'right';
  seed?: number;
  time?: number;
  style?: React.CSSProperties;
};

/** Type-to-type transitions: each text leaves with one preset while the next arrives with another,
 * and the slot's width follows. 'flip' by letter makes a split-flap board; 'blur' a soft morph;
 * 'scatter' a burst; 'glitch' a digital swap. */
export function TextSwap({texts, at, enter = 'flip', exit, by = 'character', stagger: each = .03, order = 'start', duration,
  exitDuration = .32, align = 'left', seed = 1, time, style, ...font}: TextSwapProps) {
  const clock = useTime(), t = time ?? clock;
  if (at.length !== texts.length) throw new Error('TextSwap needs one arrival time per text.');
  const widths = useTextWidths(texts, measureFont(font));
  if (!widths) return null;
  let current = -1;
  at.forEach((time, i) => {if (t >= time) current = i;});
  if (current < 0) return <div style={{...fontCss(font), height: '1em', ...style}}/>;
  const settle = curves.snap(progress(t, at[current], .5));
  const width = current > 0 ? mix(widths[current - 1], widths[current], settle) : widths[current];
  const left = (i: number) => align === 'center' ? (width - widths[i]) / 2 : align === 'right' ? width - widths[i] : 0;
  return <div style={{...fontCss(font), position: 'relative', display: 'inline-block', width, height: '1em', lineHeight: 1, whiteSpace: 'pre', ...style}}>
    {[current - 1, current].filter(i => i >= 0).map(i => <KineticText key={i} lines={[texts[i]]} by={by} enter={enter} exit={exit ?? enter}
      start={i === 0 ? at[0] : at[i] + .05} stagger={each} order={order} duration={duration} exitAt={at[i + 1]} exitDuration={exitDuration}
      exitStagger={each * .5} seed={seed + i} time={t} {...font} style={{position: 'absolute', left: left(i), top: 0}}/>)}
  </div>;
}

export type MarkKind = 'marker' | 'underline' | 'strike' | 'box' | 'circle';
export type MarkRun = TextRun & {mark?: boolean};
export type MarkProps = KineticFont & {
  /** Lines of text; runs with `mark: true` are marked. */
  lines: readonly (string | readonly MarkRun[])[];
  kind?: MarkKind;
  /** Time the first mark starts drawing; each next mark follows after `stagger`. */
  at?: number;
  duration?: number;
  stagger?: number;
  markColor?: string;
  /** Text color of marked runs once the mark is down, e.g. white on a dark marker. */
  markedColor?: string;
  lineHeight?: number;
  align?: 'left' | 'center' | 'right';
  time?: number;
  style?: React.CSSProperties;
};

/** Hand-drawn loop, a little more than one turn, in a 100 × 100 box. */
const LOOP = 'M8 58 C4 30 32 10 58 11 C84 12 98 32 95 55 C92 80 64 93 40 90 C16 87 3 70 9 48 C13 34 26 24 38 20';
const BOX = 'M3 4 L97 3 L98 96 L2 97 Z';

/** Emphasis drawn onto words: a marker sweep, an underline, a strike, a box, or a hand-drawn loop.
 * Wrap it in Enter or put a KineticText line beside it for the entrance. */
export function Mark({lines, kind = 'marker', at = 0, duration = .55, stagger: each = .25, markColor = '#ffd84d', markedColor, lineHeight = 1.05,
  align = 'left', time, style, ...font}: MarkProps) {
  const clock = useTime(), t = time ?? clock;
  let marks = 0;
  return <div style={{...fontCss(font), lineHeight, textAlign: align, ...style}}>
    {lines.map((line, li) => <div key={li} style={{whiteSpace: 'pre'}}>
      {(typeof line === 'string' ? [{text: line}] as MarkRun[] : line).map((run, ri) => {
        if (!run.mark) return <span key={ri} style={runStyle(run)}>{run.text}</span>;
        const q = curves.punchOut(progress(t, at + marks++ * each, duration));
        const color = markedColor ? `color-mix(in srgb, ${markedColor} ${(clamp((q - .35) / .4) * 100).toFixed(1)}%, ${run.color ?? font.color ?? 'currentColor'})` : run.color;
        const drawn = {strokeDasharray: 1, strokeDashoffset: 1 - q};
        return <span key={ri} style={{...runStyle(run), position: 'relative', display: 'inline-block', isolation: 'isolate', color}}>
          {kind === 'marker' && <span style={{position: 'absolute', zIndex: -1, left: '-.06em', right: '-.06em', top: '.14em', bottom: '.02em',
            background: markColor, borderRadius: '.08em', transform: `scaleX(${q}) skewX(-6deg)`, transformOrigin: '0 50%'}}/>}
          {(kind === 'underline' || kind === 'strike') && <span style={{position: 'absolute', left: '-.02em', right: '-.02em', height: '.075em',
            top: kind === 'underline' ? '.97em' : '.5em', background: markColor, borderRadius: '.04em', zIndex: kind === 'underline' ? -1 : 1,
            transform: `scaleX(${q}) rotate(${kind === 'strike' ? -2 : 0}deg)`, transformOrigin: '0 50%'}}/>}
          {(kind === 'box' || kind === 'circle') && <span aria-hidden style={{position: 'absolute', zIndex: -1,
            ...(kind === 'box' ? {left: '-.14em', right: '-.14em', top: '.02em', bottom: '-.1em'} : {left: '-.28em', right: '-.28em', top: '-.12em', bottom: '-.2em'})}}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible'}}>
              <path d={kind === 'box' ? BOX : LOOP} pathLength={1} fill="none" stroke={markColor} strokeWidth={kind === 'box' ? 5 : 6}
                strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={drawn}/>
            </svg>
          </span>}
          {run.text}
        </span>;
      })}
    </div>)}
  </div>;
}

export type EchoProps = KineticFont & {
  text: string;
  /** Copies behind the text. */
  copies?: number;
  /** Offset between neighboring copies, in em. */
  offset?: {x: number; y: number};
  start?: number;
  duration?: number;
  /** 'collapse': copies fold into the word; 'expand': they fan out and stay; 'pulse': they breathe. */
  mode?: 'collapse' | 'expand' | 'pulse';
  /** Draw the copies as outlines. */
  outline?: boolean;
  echoColor?: string;
  time?: number;
  style?: React.CSSProperties;
};

/** Stacked repeats of a word: a trail that folds into it, fans out, or breathes. Loud and graphic. */
export function Echo({text, copies = 5, offset = {x: 0, y: .16}, start = 0, duration = .9, mode = 'collapse', outline = true, echoColor,
  time, style, ...font}: EchoProps) {
  const clock = useTime(), t = time ?? clock;
  const q = mode === 'pulse' ? .5 - .5 * Math.cos(2 * Math.PI * Math.max(0, t - start) / duration)
    : mode === 'expand' ? curves.punchOut(progress(t, start, duration)) : 1 - curves.punchOut(progress(t, start, duration));
  const color = echoColor ?? font.color ?? 'currentColor';
  return <div style={{...fontCss(font), position: 'relative', lineHeight: 1, whiteSpace: 'pre', ...style}}>
    {Array.from({length: copies}, (_, k) => copies - k).map(i => <div key={i} aria-hidden style={{position: 'absolute', left: 0, top: 0,
      transform: `translate(${(offset.x * i * q).toFixed(4)}em, ${(offset.y * i * q).toFixed(4)}em)`, opacity: (1 - i / (copies + 1)) * Math.min(1, q * 4),
      color: outline ? 'transparent' : color, WebkitTextStroke: outline ? `${Math.max(1.2, (font.fontSize ?? 140) * .012)}px ${color}` : undefined}}>{text}</div>)}
    <div style={{position: 'relative'}}>{text}</div>
  </div>;
}

export type MarqueeProps = KineticFont & {
  text: string;
  rows?: number;
  /** Logical px per second. */
  speed?: number;
  /** Between repeats, e.g. ' — ' or ' ✦ '. */
  separator?: string;
  /** Degrees the band is tilted. */
  angle?: number;
  /** Rows run in alternating directions. */
  alternate?: boolean;
  /** Every other row as an outline. */
  outlineRows?: boolean;
  rowGap?: number;
  start?: number;
  time?: number;
  style?: React.CSSProperties;
};

/** Endless rows of repeating type, like a ticker or a poster band. For loud, brutalist, and event films. */
export function Marquee({text, rows = 3, speed = 260, separator = '  —  ', angle = 0, alternate = true, outlineRows = true, rowGap = .08,
  start = 0, time, style, ...font}: MarqueeProps) {
  const clock = useTime(), t = time ?? clock;
  const stage = useStage();
  const unit = text + separator;
  const widths = useTextWidths([unit], measureFont(font));
  if (!widths) return null;
  const w = widths[0], span = Math.hypot(stage.width, stage.height) * 1.1;
  const repeats = Math.ceil(span / w) + 2;
  const color = font.color ?? 'currentColor';
  return <div style={{position: 'absolute', left: '50%', top: '50%', width: span, transform: `translate(-50%, -50%) rotate(${angle}deg)`, ...style}}>
    {Array.from({length: rows}, (_, r) => {
      const dir = alternate && r % 2 ? 1 : -1;
      const shift = ((t - start) * speed + r * w * .37) % w;
      const outlined = outlineRows && r % 2 === 1;
      return <div key={r} style={{...fontCss(font), lineHeight: 1 + rowGap, whiteSpace: 'pre', overflow: 'hidden',
        color: outlined ? 'transparent' : color, WebkitTextStroke: outlined ? `${Math.max(1.2, (font.fontSize ?? 140) * .012)}px ${color}` : undefined}}>
        <div style={{transform: `translateX(${(dir < 0 ? -shift : shift - w).toFixed(2)}px)`}}>{unit.repeat(repeats)}</div>
      </div>;
    })}
  </div>;
}

export type ShineProps = KineticFont & {
  text: string;
  /** Time the light starts crossing. */
  at?: number;
  duration?: number;
  shineColor?: string;
  /** Width of the highlight as a fraction of the text. */
  width?: number;
  angle?: number;
  time?: number;
  style?: React.CSSProperties;
};

/** A sheen of light crossing the letters once. Premium titles and end cards. */
export function Shine({text, at = 0, duration = 1.1, shineColor = '#ffffff', width = .16, angle = 105, time, style, ...font}: ShineProps) {
  const clock = useTime(), t = time ?? clock;
  const color = font.color ?? '#111';
  const x = mix(-width * 100 - 10, 110 + width * 100, curves.glide(progress(t, at, duration)));
  const w = width * 100;
  return <div style={{...fontCss({...font, color: 'transparent'}), lineHeight: 1.1, whiteSpace: 'pre', display: 'inline-block',
    backgroundImage: `linear-gradient(${angle}deg, ${color} ${(x - w).toFixed(2)}%, ${shineColor} ${x.toFixed(2)}%, ${color} ${(x + w).toFixed(2)}%)`,
    WebkitBackgroundClip: 'text', backgroundClip: 'text', ...style}}>{text}</div>;
}

export type CircleTextProps = KineticFont & {
  text: string;
  radius?: number;
  /** Degrees per second; negative turns counterclockwise. */
  speed?: number;
  /** Starting rotation in degrees. */
  rotate?: number;
  start?: number;
  time?: number;
  style?: React.CSSProperties;
};

/** Type set on a circle that turns: badges, seals, and loops around a product. Letters spread evenly. */
export function CircleText({text, radius = 220, speed = 24, rotate = 0, start = 0, time, style, ...font}: CircleTextProps) {
  const clock = useTime(), t = time ?? clock;
  const size = font.fontSize ?? 40, box = radius * 2 + size * 2.4, c = box / 2;
  const id = React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const path = `M ${c} ${c - radius} a ${radius} ${radius} 0 1 1 0 ${radius * 2} a ${radius} ${radius} 0 1 1 0 ${-radius * 2}`;
  return <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden style={{overflow: 'visible',
    transform: `rotate(${(rotate + speed * (t - start)).toFixed(3)}deg)`, ...style}}>
    <defs><path id={`circle-${id}`} d={path}/></defs>
    <text style={{...fontCss(font), fill: font.color ?? 'currentColor'}}>
      <textPath href={`#circle-${id}`} textLength={2 * Math.PI * radius - size * .3} lengthAdjust="spacing">{text}</textPath>
    </text>
  </svg>;
}

export type SplitTextProps = KineticFont & {
  text: string;
  start?: number;
  duration?: number;
  /** How far each half travels, in em. */
  distance?: number;
  exitAt?: number;
  exitDuration?: number;
  time?: number;
  style?: React.CSSProperties;
};

/** A word cut along its middle: the halves slide in from opposite sides and lock; on exit they part. */
export function SplitText({text, start = 0, duration = .75, distance = 1.6, exitAt, exitDuration = .45, time, style, ...font}: SplitTextProps) {
  const clock = useTime(), t = time ?? clock;
  const q = exitAt !== undefined && t >= exitAt ? -curves.punchIn(progress(t, exitAt, exitDuration)) : 1 - curves.punchOut(progress(t, start, duration));
  const shift = distance * q, seen = exitAt !== undefined && t >= exitAt ? 1 + q : clamp((t - start) / .12);
  const half = (top: boolean): React.CSSProperties => ({clipPath: top ? 'inset(-20% -5% 50% -5%)' : 'inset(50% -5% -20% -5%)',
    transform: `translateX(${((top ? -1 : 1) * shift).toFixed(4)}em)`, opacity: seen});
  return <div style={{...fontCss(font), position: 'relative', lineHeight: 1, whiteSpace: 'pre', ...style}}>
    <div style={half(true)}>{text}</div>
    <div aria-hidden style={{position: 'absolute', inset: 0, ...half(false)}}>{text}</div>
  </div>;
}

export type BreatheProps = KineticFont & {
  text: string;
  /** Weight range of the wave (variable fonts: Inter 100–900, DM Sans 100–1000). */
  min?: number;
  max?: number;
  /** Waves per second. */
  speed?: number;
  /** Letters per wave. */
  wavelength?: number;
  start?: number;
  time?: number;
  style?: React.CSSProperties;
};

/** A weight wave running through the letters of a variable font; it fades in from the rest weight. */
export function Breathe({text, min = 150, max = 900, speed = .7, wavelength = 7, start = 0, time, style, ...font}: BreatheProps) {
  const clock = useTime(), t = time ?? clock;
  const rest = font.fontWeight ?? 700, amount = arrive(t, start, .8);
  return <div style={{...fontCss(font), lineHeight: 1, whiteSpace: 'pre', ...style}}>
    {graphemes(text).map((character, i) => {
      const wave = .5 - .5 * Math.cos(2 * Math.PI * (speed * Math.max(0, t - start) - i / wavelength));
      return <span key={i} style={{fontWeight: Math.round(mix(rest, mix(min, max, wave), amount))}}>{character}</span>;
    })}
  </div>;
}
