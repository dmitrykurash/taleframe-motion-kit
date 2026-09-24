import React, {useId} from 'react';
import {AbsoluteFill} from 'remotion';
import {LANDSCAPE, type StageSize} from '../camera';
import type {Point} from './types';

/** Default (landscape) stage. Components read the actual size with useStage(). */
export const STAGE = LANDSCAPE;
export const STAGE_CENTER: Point = {x: STAGE.width / 2, y: STAGE.height / 2};
export const centerOf = (stage: StageSize): Point => ({x: stage.width / 2, y: stage.height / 2});
/** Margin (logical px) rendered beyond the stage where a filter needs neighbors outside the frame. */
export const OVERSCAN = 96;

/** A DOM-safe id that is stable for this component instance. */
export function useSafeId(prefix: string) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** CSS transform (origin 0 0) that scales and rotates the stage about a stage point. */
export function about(point: Point, scale: number, rotateDeg = 0, dx = 0, dy = 0): string {
  return `translate(${point.x + dx}px, ${point.y + dy}px) rotate(${rotateDeg}deg) scale(${scale}) translate(${-point.x}px, ${-point.y}px)`;
}

/** Full-stage layer that clips its content, with an optional transform about the stage origin. */
export function Layer({children, transform, style, clip = true}: {children: React.ReactNode; transform?: string; style?: React.CSSProperties; clip?: boolean}) {
  return <AbsoluteFill style={{overflow: clip ? 'hidden' : 'visible', ...style}}>
    <AbsoluteFill style={transform ? {transform, transformOrigin: '0 0'} : undefined}>{children}</AbsoluteFill>
  </AbsoluteFill>;
}

/** Distance from a point to the farthest stage corner. */
export function farthestCorner(point: Point, stage: StageSize = STAGE): number {
  return Math.max(...[[0, 0], [stage.width, 0], [0, stage.height], [stage.width, stage.height]]
    .map(([x, y]) => Math.hypot(x - point.x, y - point.y)));
}

let rampUrl: string | null = null;
/** 256² map with red = x and green = y, for radial displacement around the stage center. */
function radialRamp(): string {
  if (rampUrl) return rampUrl;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is unavailable for the chromatic aberration map.');
  const image = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const i = (y * 256 + x) * 4;
    image.data[i] = x; image.data[i + 1] = y; image.data[i + 2] = 0; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return (rampUrl = canvas.toDataURL('image/png'));
}

/** SVG filter that scales red outward and blue inward from the stage center by `amount` logical pixels
 * at the frame edge, reconstructing green in place. Channels recombine exactly when amount is 0. */
export function ChromaFilter({id, amount, stage = STAGE}: {id: string; amount: number; stage?: StageSize}) {
  // The region overscans the stage so displaced channels never sample empty space at the frame edge.
  const m = OVERSCAN;
  return <svg width="0" height="0" style={{position: 'absolute'}} aria-hidden>
    <filter id={id} filterUnits="userSpaceOnUse" x={-m} y={-m} width={stage.width + 2 * m} height={stage.height + 2 * m} colorInterpolationFilters="sRGB">
      <feImage href={radialRamp()} x={-m} y={-m} width={stage.width + 2 * m} height={stage.height + 2 * m} preserveAspectRatio="none" result="ramp"/>
      <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>
      <feDisplacementMap in="r" in2="ramp" scale={-2 * amount} xChannelSelector="R" yChannelSelector="G" result="rd"/>
      <feDisplacementMap in="b" in2="ramp" scale={2 * amount} xChannelSelector="R" yChannelSelector="G" result="bd"/>
      <feComposite in="rd" in2="g" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="rg"/>
      <feComposite in="rg" in2="bd" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
    </filter>
  </svg>;
}

/** Split red and blue horizontally/vertically by fixed offsets (glitch). */
export function SplitFilter({id, dx, dy = 0}: {id: string; dx: number; dy?: number}) {
  return <svg width="0" height="0" style={{position: 'absolute'}} aria-hidden>
    <filter id={id} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
      <feOffset in="r" dx={dx} dy={dy} result="ro"/>
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g"/>
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b"/>
      <feOffset in="b" dx={-dx} dy={-dy} result="bo"/>
      <feComposite in="ro" in2="g" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="rg"/>
      <feComposite in="rg" in2="bo" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
    </filter>
  </svg>;
}

/** Directional blur along one axis (approximate motion blur for a straight, uniform move). */
export function StreakFilter({id, x, y = 0}: {id: string; x: number; y?: number}) {
  return <svg width="0" height="0" style={{position: 'absolute'}} aria-hidden>
    <filter id={id} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
      <feGaussianBlur stdDeviation={`${Math.max(0, x)} ${Math.max(0, y)}`} edgeMode="none"/>
    </filter>
  </svg>;
}
