import React from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {TaleframeEffects, type EffectsFrame, type EffectsSettings} from '../kit/TaleframeEffects';
import {looseOil, WATERCOLOR_BROAD} from '../kit/looks';

export const effectExamples: {name: string; detail: string; effects: EffectsSettings}[] = [
  {name: 'Watercolor', detail: 'Brushwork, softened detail, and paper', effects: {watercolor: {enabled: true, amount: 1, brushSize: .8, strokes: 1.1, paper: .45}}},
  {name: 'Pigment', detail: 'Color settling and granulation', effects: {pigment: {enabled: true, granulation: 1.2, settling: .9, paper: .55}}},
  {name: 'Helios', detail: 'A focused center with a swirled blur', effects: {helios: {enabled: true, blur: 65, swirl: 1.3, focusRadius: .13}}},
  {name: 'Film grain', detail: 'A repeatable texture on every frame', effects: {grain: {enabled: true, amount: .35, size: 2.6, animated: true}}},
  {name: 'Chromatic', detail: 'Soft red and blue edges', effects: {chromatic: {enabled: true, strength: 14, blur: 2}}},
  {name: 'Lens', detail: 'Image distortion and zoom', effects: {lens: {enabled: true, distortion: .22, zoom: 1.15}}},
  {name: 'Duotone', detail: 'Map the image to two chosen colors', effects: {duotone: {enabled: true, shadows: '#142d46', highlights: '#f9d99a'}}},
  {name: 'Stopmotion', detail: 'Held source frames plus optional handmade texture', effects: {stopmotion: {enabled: true, fps: 8, jitter: .7, rotation: .08, boil: .45, texture: .12}}},
];

/** Oil needs its brushes loaded, which <TaleframeEffects> does; it is kept out of effectExamples, whose GPU check
 * calls applyTaleframeEffects() directly. The focus ellipse keeps finer strokes on the sun. */
export const oilExample: {name: string; detail: string; effects: EffectsSettings} = {
  name: 'Oil', detail: 'Bristle-brush strokes laid coarse to fine', effects: {watercolor: looseOil(WATERCOLOR_BROAD, [[.8, .26, .1, .16]])},
};
const panels = [effectExamples[0], oilExample, ...effectExamples.slice(1)];
/** Three seconds per pair. */
export const EFFECTS_GALLERY_SECONDS = panels.length * 3;

const drawMotion = (ctx: CanvasRenderingContext2D, {width, height, seconds}: EffectsFrame) => {
  ctx.fillStyle = '#eee4d4'; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#c2b7a8'; ctx.lineWidth = 2;
  for (let x = 0; x < width; x += width / 12) {ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();}
  for (let y = 0; y < height; y += height / 8) {ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();}
  const x = width * (.5 + .28 * Math.sin(seconds * Math.PI));
  ctx.fillStyle = '#d97854'; ctx.beginPath(); ctx.arc(x, height * .48, height * .19, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2f6762'; ctx.save(); ctx.translate(width - x, height * .57); ctx.rotate(seconds); ctx.fillRect(-height * .11, -height * .11, height * .22, height * .22); ctx.restore();
};

/** Register at any resolution and frame rate, with durationInFrames = fps * EFFECTS_GALLERY_SECONDS. The pairs share
 * whatever duration the composition has. */
export const EffectsGallery: React.FC = () => {
  const frame = useCurrentFrame(), {width, height, durationInFrames} = useVideoConfig();
  const index = Math.min(panels.length - 1, Math.floor(frame / (durationInFrames / panels.length)));
  const entry = panels[index];
  const source = entry.name === 'Stopmotion' ? {draw: drawMotion} : staticFile('demo/landscape-a.svg');
  const pad = width * .045, gap = width * .018;
  const cardWidth = (width - pad * 2 - gap) / 2, cardHeight = height * .60;
  return <AbsoluteFill style={{background: '#f6f3ed', color: '#272622', fontFamily: 'DM Sans Variable, sans-serif'}}>
    <div style={{position: 'absolute', top: height * .062, left: pad, fontSize: height * .058, fontWeight: 600}}>{entry.name}</div>
    <div style={{position: 'absolute', top: height * .145, left: pad, fontSize: height * .026, color: '#66635c'}}>{entry.detail}</div>
    {[false, true].map((processed) => <div key={String(processed)} style={{position: 'absolute', left: pad + (processed ? cardWidth + gap : 0), top: height * .255, width: cardWidth, height: cardHeight}}>
      <div style={{position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: width * .01}}>
        <TaleframeEffects source={source} width={Math.round(cardWidth)} height={Math.round(cardHeight)} effects={processed ? entry.effects : {}} />
      </div>
      <div style={{position: 'absolute', top: '104%', fontSize: height * .023, color: '#66635c'}}>{processed ? 'With effect' : 'Original'}</div>
    </div>)}
    <div style={{position: 'absolute', right: pad, top: height * .075, fontSize: height * .025, color: '#8b877d'}}>{index + 1} / {panels.length}</div>
  </AbsoluteFill>;
};
