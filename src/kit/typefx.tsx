import React from 'react';
import {mulberry32} from '../taleframe/transitions/kit';
import {useStage} from './camera';
import {useTime} from './clock';
import {fontCss, measureFont, runStyle, useTextWidths, type KineticFont, type RevealLine, type TextRun} from './kinetic';
import {arrive, clamp, mix, progress} from './motion';
import {stagger, type StaggerOrder} from './moves';
import {poseAt, poseStyle, preset, unitOf, type PresetName} from './presets';
import {curves} from './scene/curves';
import {graphemes} from './typing';

/** Kinetic type built on motion presets, plus type effects: marks, marquees, shine, circular
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
  const size = font.fontSize ?? 140, weight = font.fontWeight ?? 500, tracking = font.letterSpacing ?? -.035;
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
 * and the slot's width follows. The default is the classic roll: the old text rolls up out of its mask as
 * the new one rises from the bottom. 'blur' makes a soft morph and 'glitch' a digital swap. The slot keeps a
 * real baseline, so it lines up with type beside it in a baseline-aligned row. */
export function TextSwap({texts, at, enter = 'rise', exit, by = 'word', stagger: each = .03, order = 'start', duration,
  exitDuration = .5, align = 'left', seed = 1, time, style, ...font}: TextSwapProps) {
  const clock = useTime(), t = time ?? clock;
  if (at.length !== texts.length) throw new Error('TextSwap needs one arrival time per text.');
  const widths = useTextWidths(texts, measureFont(font));
  if (!widths) return null;
  let current = -1;
  at.forEach((time, i) => {if (t >= time) current = i;});
  if (current < 0) return <div style={{...fontCss(font), lineHeight: 1, whiteSpace: 'pre', visibility: 'hidden', ...style}}>{texts[0]}</div>;
  const settle = curves.snap(progress(t, at[current], .5));
  const width = current > 0 ? mix(widths[current - 1], widths[current], settle) : widths[current];
  const left = (i: number) => align === 'center' ? (width - widths[i]) / 2 : align === 'right' ? width - widths[i] : 0;
  return <div style={{...fontCss(font), position: 'relative', display: 'inline-block', width, lineHeight: 1, whiteSpace: 'pre', ...style}}>
    {/* Invisible in-flow text gives the slot its baseline and height; the moving copies sit on top of it. */}
    <span aria-hidden style={{visibility: 'hidden'}}>{texts[current]}</span>
    {[current - 1, current].filter(i => i >= 0).map(i => <KineticText key={i} lines={[texts[i]]} by={by} enter={enter} exit={exit ?? enter}
      start={at[i]} stagger={each} order={order} duration={duration} exitAt={at[i + 1]} exitDuration={exitDuration}
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

type P = {x: number; y: number};
/** A hand-drawn box: four slightly uneven sides with a small overshoot where the pen closes it. */
const BOX: P[] = [{x: 3, y: 4}, {x: 97, y: 2.5}, {x: 98.5, y: 96}, {x: 2, y: 97.5}, {x: 3.5, y: 1.5}];
/** The first `q` (0–1) of a line through points, ending partway along a segment. Drawing a stroke this way
 * is exact at any size, unlike dash offsets, which break when a stroke does not scale with its path. */
function partial(points: readonly P[], q: number): P[] {
  const f = Math.max(0, Math.min(1, q)) * (points.length - 1), k = Math.floor(f);
  const head = points.slice(0, k + 1), a = points[k], b = points[k + 1];
  return b && f > k ? [...head, {x: a.x + (b.x - a.x) * (f - k), y: a.y + (b.y - a.y) * (f - k)}] : head;
}
const linePath = (points: readonly P[]) => points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');

/** A smooth path through points (Catmull-Rom as cubic Béziers). */
function smoothPath(points: readonly P[]): string {
  if (points.length < 2) return '';
  let d = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i], p1 = points[i], p2 = points[i + 1], p3 = points[i + 2] ?? p2;
    d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(2)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(2)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(2)} `
      + `${(p2.y - (p3.y - p1.y) / 6).toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/** A pen loop around a word, in a 100 × 100 box: a little more than one turn with an uneven radius and a
 * slight tilt, then a shorter second pass that does not quite follow the first, the way a hand circles a
 * word. Seeded, so every render draws the same loop. */
export function scribble(seed = 1): {first: P[]; second: P[]} {
  const random = mulberry32((seed * 7919 + 17) >>> 0);
  const tilt = (random() - .5) * .14, start = Math.PI * (.9 + random() * .12), phase = random() * 6.28;
  const loop = (from: number, turns: number, scale: number, steps: number) => Array.from({length: steps + 1}, (_, i) => {
    const a = from + i / steps * turns * 2 * Math.PI;
    const wobble = 1 + .05 * Math.sin(3 * a + phase) + .025 * Math.sin(7 * a + 2 * phase);
    const spiral = scale * (1 + .07 * i / steps), x = 48 * wobble * spiral * Math.cos(a), y = 45 * wobble * spiral * Math.sin(a);
    return {x: 50 + x * Math.cos(tilt) - y * Math.sin(tilt), y: 50 + x * Math.sin(tilt) + y * Math.cos(tilt)};
  });
  return {first: loop(start, 1.1 + random() * .08, .97, 64), second: loop(start + 2 * Math.PI * .92, .5, 1.02, 30)};
}

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
        const markStart = at + marks++ * each;
        const q = curves.punchOut(progress(t, markStart, duration));
        const color = markedColor ? `color-mix(in srgb, ${markedColor} ${(clamp((q - .35) / .4) * 100).toFixed(1)}%, ${run.color ?? font.color ?? 'currentColor'})` : run.color;
        return <span key={ri} style={{...runStyle(run), position: 'relative', display: 'inline-block', isolation: 'isolate', color}}>
          {kind === 'marker' && <span style={{position: 'absolute', zIndex: -1, left: '-.06em', right: '-.06em', top: '.14em', bottom: '.02em',
            background: markColor, borderRadius: '.08em', transform: `scaleX(${q}) skewX(-6deg)`, transformOrigin: '0 50%'}}/>}
          {(kind === 'underline' || kind === 'strike') && <span style={{position: 'absolute', left: '-.02em', right: '-.02em', height: '.075em',
            top: kind === 'underline' ? '.97em' : '.5em', background: markColor, borderRadius: '.04em', zIndex: kind === 'underline' ? -1 : 1,
            transform: `scaleX(${q}) rotate(${kind === 'strike' ? -2 : 0}deg)`, transformOrigin: '0 50%'}}/>}
          {kind === 'box' && <span aria-hidden style={{position: 'absolute', zIndex: -1, left: '-.14em', right: '-.14em', top: '.02em', bottom: '-.1em'}}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible'}}>
              <path d={linePath(partial(BOX, q))} fill="none" stroke={markColor} strokeWidth={Math.max(3, (run.fontSize ?? font.fontSize ?? 140) * .03)}
                strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
            </svg>
          </span>}
          {kind === 'circle' && (() => {
            // A pen's pace: slow into the stroke, quick around the far side, slow at the end; the second pass follows on.
            const loop = scribble(ri + li * 13 + 3), size = Math.max(3, (run.fontSize ?? font.fontSize ?? 140) * .035);
            const a = curves.glide(progress(t, markStart, duration * .78)), b = curves.glide(progress(t, markStart + duration * .62, duration * .38));
            return <span aria-hidden style={{position: 'absolute', zIndex: -1, left: '-.3em', right: '-.3em', top: '-.16em', bottom: '-.2em'}}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible'}}>
                {a > 0 && <path d={smoothPath(partial(loop.first, a))} fill="none" stroke={markColor} strokeWidth={size} strokeLinecap="round"
                  strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>}
                {b > 0 && <path d={smoothPath(partial(loop.second, b))} fill="none" stroke={markColor} strokeWidth={size * .7} strokeLinecap="round"
                  strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={.85}/>}
              </svg>
            </span>;
          })()}
          {run.text}
        </span>;
      })}
    </div>)}
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
  /** Every other row as an outline. Off by default: outlined type only when the brief asks for it. */
  outlineRows?: boolean;
  rowGap?: number;
  start?: number;
  time?: number;
  style?: React.CSSProperties;
};

/** Endless rows of repeating type, like a ticker or a poster band. For loud, brutalist, and event films. */
export function Marquee({text, rows = 3, speed = 260, separator = '  —  ', angle = 0, alternate = true, outlineRows = false, rowGap = .08,
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

export type WallVariant = {weight?: number; stretch?: number; italic?: boolean};
export type TypeWallProps = KineticFont & {
  word: string;
  rows?: number;
  /** Styles cycled across the repeats: weight, width (font-stretch %, needs a width axis such as Anybody's
   * 50–150), and italic. */
  variants?: readonly WallVariant[];
  /** Logical px per second; neighboring rows run in opposite directions. */
  speed?: number;
  /** [background, text] per row, cycled. */
  palettes?: readonly [string, string][];
  /** Color of the dot between repeats. */
  dot?: string;
  /** One row drawn as a solid band with a single centered word. */
  band?: {row: number; background: string; color: string; text?: string; variant?: WallVariant};
  /** Row height in em. */
  rowHeight?: number;
  /** Weights and widths ripple along each row over time. */
  ripple?: boolean;
  start?: number;
  time?: number;
  style?: React.CSSProperties;
};

/** A wall of one word repeated in rows, every repeat in a different width, weight, or slant, the rows sliding in
 * opposite directions, with an optional solid band through the middle. Poster energy for loud and graphic films. */
export function TypeWall({word, rows = 7, variants = [{weight: 800, stretch: 125}, {weight: 400, stretch: 70, italic: true}, {weight: 700, stretch: 100},
  {weight: 300, stretch: 60}], speed = 150, palettes = [['#f3f1ec', '#2f45ff'], ['#2f45ff', '#f3f1ec']], dot = '#ff5a1f', band, rowHeight = 1.06,
  ripple = true, start = 0, time, style, ...font}: TypeWallProps) {
  const clock = useTime(), t = time ?? clock;
  const repeats = 22, local = t - start;
  const css = fontCss(font);
  return <div style={{position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', ...style}}>
    {Array.from({length: rows}, (_, r) => {
      const [background, color] = palettes[r % palettes.length];
      if (band && band.row === r) return <div key={r} style={{...css, flex: 'none', height: `${rowHeight}em`, background: band.background, color: band.color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, whiteSpace: 'pre',
        fontWeight: band.variant?.weight ?? css.fontWeight, fontStretch: band.variant?.stretch ? `${band.variant.stretch}%` : undefined,
        fontStyle: band.variant?.italic ? 'italic' : 'normal'}}>{band.text ?? word}</div>;
      const dir = r % 2 ? 1 : -1, shift = dir * speed * local - (dir > 0 ? 9000 : 400) - r * 137;
      return <div key={r} style={{...css, flex: 'none', height: `${rowHeight}em`, background, color, lineHeight: rowHeight, whiteSpace: 'pre', overflow: 'hidden'}}>
        <div style={{transform: `translateX(${shift.toFixed(2)}px)`, display: 'flex', alignItems: 'baseline'}}>
          {Array.from({length: repeats}, (_, k) => {
            const v = variants[(k + r) % variants.length];
            const wave = ripple ? .5 + .5 * Math.sin(local * 2.2 + k * .8 + r * 1.3) : .5;
            const weight = ripple ? Math.round(mix((v.weight ?? 600) - 150, (v.weight ?? 600) + 150, wave)) : v.weight;
            const stretch = v.stretch !== undefined && ripple ? mix(v.stretch - 12, v.stretch + 12, 1 - wave) : v.stretch;
            return <span key={k} style={{display: 'inline-flex', alignItems: 'center'}}>
              <span style={{fontWeight: weight, fontStretch: stretch !== undefined ? `${Math.max(50, Math.min(150, stretch)).toFixed(1)}%` : undefined,
                fontStyle: v.italic ? 'italic' : 'normal'}}>{word}</span>
              <span style={{display: 'inline-block', width: '.16em', height: '.16em', borderRadius: '50%', background: dot, margin: '0 .32em', transform: 'translateY(-.28em)'}}/>
            </span>;
          })}
        </div>
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
