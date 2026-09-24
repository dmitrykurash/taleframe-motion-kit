import React, {useMemo} from 'react';
import {AbsoluteFill, Easing, useVideoConfig} from 'remotion';
import {useStage, type StageSize} from '../camera';
import {TimeShift} from '../clock';
import {samplesForStreak, shutterOffsets} from '../MotionBlur';
import {useTextMetrics} from '../typography';
import {clamp01, curves, phase, slope, smoothstep} from './curves';
import {coverZoom, deepestPoint, insideDistance, rasterizeLetters} from './glyphs';
import {Layer, STAGE, about, centerOf, farthestCorner, useSafeId} from './layers';
import type {Point, PortalOptions, Rect, TransitionRenderProps} from './types';

/** Accelerate into a shape; settle when the shape itself becomes the new frame. */
const dive = Easing.bezier(.55, 0, .15, 1);

type Shape =
  | {kind: 'text'; letters: {character: string; x: number}[]; baseline: number; fontSize: number; font: string; style: React.CSSProperties}
  | {kind: 'rect'; rect: Rect}
  | {kind: 'circle'; circle: {x: number; y: number; radius: number}};
type Geometry = {shape: Shape; fixed: Point; scale: number};

export function portalTiming(o: PortalOptions, shape: Shape['kind']) {
  const reveal = Math.min(.7, Math.max(0, o.reveal ?? (shape === 'text' ? .38 : shape === 'rect' ? .2 : .22)));
  const flyStart = Math.min(.95, reveal + (shape === 'text' ? .05 : 0));
  return {reveal, flyStart, flyEnd: shape === 'text' ? .9 : 1, curve: shape === 'text' ? curves.punchIn : dive,
    depth: Math.max(1, o.depth ?? 1.22)};
}

/** Where the camera flies and how far, for rect or circle shapes (text needs measured glyphs). */
export function shapeGeometry(o: PortalOptions, stage: StageSize = STAGE): Geometry | null {
  if (o.rect) {
    const {scale, fixed} = coverZoom(o.rect, stage);
    return {shape: {kind: 'rect', rect: o.rect}, fixed, scale};
  }
  if (o.circle) {
    if (!(o.circle.radius > 0)) throw new Error('Portal circle needs a positive radius.');
    const center = {x: o.circle.x, y: o.circle.y};
    return {shape: {kind: 'circle', circle: o.circle}, fixed: center, scale: Math.max(1, farthestCorner(center, stage) / o.circle.radius * 1.03)};
  }
  return null;
}

function useTextGeometry(o: PortalOptions, stage: StageSize): Geometry | null {
  const text = o.text ?? '';
  const fontFamily = o.fontFamily ?? '"DM Sans Variable", sans-serif', fontWeight = o.fontWeight ?? 900;
  const fontSize = o.fontSize ?? 440, letterSpacing = o.letterSpacing ?? -fontSize * .04;
  const at = o.at ?? {x: stage.width / 2, y: stage.height * .62};
  const metrics = useTextMetrics(text || ' ', {fontFamily, fontSize, fontWeight, letterSpacing});
  const into = o.into;
  return useMemo(() => {
    if (!text || !metrics) return null;
    const left = at.x - metrics.width / 2;
    const letters = metrics.characters.map((character, i) => ({character, x: left + metrics.positions[i]}));
    const font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const scale = .5, mask = rasterizeLetters(letters, at.y, font, scale, stage);
    let fixed: Point, radius: number;
    if (into) {
      const d = insideDistance(mask.inside, mask.width, mask.height);
      const px = Math.min(mask.width - 1, Math.max(0, Math.floor(into.x * scale)));
      const py = Math.min(mask.height - 1, Math.max(0, Math.floor(into.y * scale)));
      radius = d[py * mask.width + px] / scale;
      if (radius < 4) throw new Error(`Portal "into" point (${into.x}, ${into.y}) is not inside a letter of "${text}".`);
      fixed = into;
    } else {
      const deepest = deepestPoint(mask.inside, mask.width, mask.height);
      fixed = {x: deepest.x / scale, y: deepest.y / scale}; radius = deepest.radius / scale;
    }
    return {fixed, scale: Math.max(1, farthestCorner(fixed, stage) / radius * 1.04), shape: {kind: 'text', letters, baseline: at.y, fontSize, font,
      style: {fontFamily, fontWeight, fontSize, fontKerning: 'normal'}}} satisfies Geometry;
  }, [text, metrics, at.x, at.y, fontFamily, fontWeight, fontSize, into?.x, into?.y, stage]);
}

/** The portal shape at rest (base scale). The zoom is applied by a CSS transform on the element that
 * references the clip: Chrome clamps SVG text to about 10,000 px, so a glyph scaled inside the SVG would
 * silently shrink at deep zoom, while a CSS-scaled clip path stays exact. */
function ClipShape({geometry, rise, cornerFade}: {geometry: Geometry; rise: number[]; cornerFade: number}) {
  const {shape} = geometry;
  if (shape.kind === 'rect') {
    const r = shape.rect;
    return <rect x={r.x} y={r.y} width={r.width} height={r.height} rx={(r.radius ?? 0) * (1 - cornerFade)}/>;
  }
  if (shape.kind === 'circle') return <circle cx={shape.circle.x} cy={shape.circle.y} r={shape.circle.radius}/>;
  return <>{shape.letters.map((letter, i) =>
    <text key={i} x={letter.x} y={shape.baseline + (rise[i] ?? 0)} style={shape.style}>{letter.character}</text>)}</>;
}

export function PortalTransition({from, to, time, start, duration, options}: TransitionRenderProps<PortalOptions>) {
  const {fps} = useVideoConfig();
  const baseId = useSafeId('portal');
  const stage = useStage();
  const textGeometry = useTextGeometry(options, stage);
  const geometry = options.text ? textGeometry : shapeGeometry(options, stage) ?? shapeGeometry({circle: {...centerOf(stage), radius: 90}}, stage);
  if (!geometry) return <>{from}</>; // Font metrics are pending; the frame waits on delayRender.
  const kind = geometry.shape.kind, timing = portalTiming(options, kind);
  const shutter = options.shutter ?? .6, quality = options.quality ?? 20;
  const flyLength = Math.max(.05, timing.flyEnd - timing.flyStart);
  const letters = kind === 'text' ? (geometry.shape as Extract<Shape, {kind: 'text'}>).letters : [];
  const fontSize = kind === 'text' ? (geometry.shape as Extract<Shape, {kind: 'text'}>).fontSize : 0;

  const state = (p: number) => {
    const fly = phase(p, timing.flyStart, timing.flyEnd);
    const zoom = Math.exp(Math.log(geometry.scale) * timing.curve(fly));
    const open = phase(p, 0, Math.max(.001, timing.reveal));
    const stagger = letters.length > 1 ? .35 / (letters.length - 1) : 0;
    const rise = letters.map((_, i) => fontSize * 1.15 * (1 - curves.punchOut(phase(open, i * stagger, i * stagger + .65))));
    const settle = Math.pow(timing.depth, 1 - curves.punchOut(phase(p, timing.flyStart, 1)));
    return {zoom, open, rise, settle, cornerFade: smoothstep(.55, 1, fly)};
  };
  const p = clamp01((time - start) / duration);
  const fly = phase(p, timing.flyStart, timing.flyEnd);
  const zoomRate = Math.log(geometry.scale) * slope(timing.curve, fly) / (flyLength * duration);
  const riseRate = kind === 'text' && p < timing.reveal ? fontSize * 2.5 / Math.max(.05, timing.reveal * duration) : 0;
  const speed = (fly > 0 && fly < 1 ? farthestCorner(geometry.fixed, stage) * zoomRate : 0) + riseRate;
  const streak = speed / fps * shutter;
  const offsets = shutterOffsets(samplesForStreak(streak, quality), shutter, fps);
  const gap = offsets.length > 1 ? streak / offsets.length : 0;
  const soften = gap > 3 ? Math.min(5, .4 * gap) : 0;

  const sample = (offset: number, i: number) => {
    const s = state((time + offset - start) / duration);
    const id = `${baseId}-${i}`;
    const F = geometry.fixed, shape = geometry.shape;
    const zoom = about(F, s.zoom);
    // Inside the zoomed clip, undo the zoom so the incoming shot only shows its own parallax (or nesting).
    const unzoom = `translate(${F.x}px, ${F.y}px) scale(${1 / s.zoom}) translate(${-F.x}px, ${-F.y}px)`;
    const incoming = shape.kind === 'rect'
      // Nested: the incoming shot lives inside the card and becomes the frame exactly at full zoom.
      ? `translate(${shape.rect.x + shape.rect.width / 2}px, ${shape.rect.y + shape.rect.height / 2}px) scale(${1 / geometry.scale}) translate(${-stage.width / 2}px, ${-stage.height / 2}px)`
      : `${unzoom} ${about(centerOf(stage), s.settle)}`;
    const lineTop = shape.kind === 'text' ? shape.baseline - fontSize * 1.05 : 0;
    return <AbsoluteFill>
      <Layer transform={zoom} style={{filter: soften > .2 ? `blur(${soften}px)` : undefined}}>{from}</Layer>
      <AbsoluteFill style={{transform: zoom, transformOrigin: '0 0'}}>
        <AbsoluteFill style={{clipPath: `url(#${id})`, opacity: kind === 'text' ? 1 : curves.punchOut(s.open),
          background: shape.kind === 'rect' ? options.backdrop ?? '#000' : undefined}}>
          <AbsoluteFill style={{transform: incoming, transformOrigin: '0 0'}}>{to}</AbsoluteFill>
        </AbsoluteFill>
      </AbsoluteFill>
      <svg width="0" height="0" style={{position: 'absolute'}} aria-hidden>
        {kind === 'text' && <clipPath id={`${id}-line`} clipPathUnits="userSpaceOnUse">
          <rect x={-stage.width} y={lineTop} width={stage.width * 3} height={fontSize * 1.4}/>
        </clipPath>}
        <clipPath id={id} clipPathUnits="userSpaceOnUse" clipPath={kind === 'text' ? `url(#${id}-line)` : undefined}>
          <ClipShape geometry={geometry} rise={s.rise} cornerFade={s.cornerFade}/>
        </clipPath>
      </svg>
    </AbsoluteFill>;
  };
  return <AbsoluteFill style={{background: options.backdrop ?? '#000', overflow: 'hidden'}}>
    <AbsoluteFill style={{isolation: 'isolate'}}>
      {offsets.map((offset, i) => <AbsoluteFill key={i} style={{opacity: 1 / (i + 1)}}>
        <TimeShift by={offset}>{sample(offset, i)}</TimeShift>
      </AbsoluteFill>)}
    </AbsoluteFill>
  </AbsoluteFill>;
}
