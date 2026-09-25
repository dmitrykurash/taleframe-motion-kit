import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useStage, type StageSize} from '../camera';
import {gridDelay} from '../moves';
import {clamp01, curves, mix, phase} from './curves';
import {Layer, STAGE, about, centerOf, useSafeId} from './layers';
import type {TilesOptions, TransitionRenderProps} from './types';

export function tilesSettings(o: TilesOptions, stage: StageSize = STAGE) {
  const columns = Math.max(2, Math.min(40, Math.round(o.columns ?? (stage.height > stage.width ? 7 : 12))));
  const cell = stage.width / columns;
  return {columns, rows: Math.ceil(stage.height / cell - 1e-9), cell, pattern: o.pattern ?? 'diagonal', origin: o.origin ?? centerOf(stage),
    spread: Math.min(.9, Math.max(0, o.spread ?? .55)), round: clamp01(o.round ?? .6), rotate: o.rotate ?? 0,
    depth: Math.max(1, o.depth ?? 1.08), seed: o.seed ?? 5, backdrop: o.backdrop ?? '#000', stage};
}

/** How far each tile has shrunk at progress p, by row then column: 0 whole … 1 gone. */
export function tileShrink(p: number, s: ReturnType<typeof tilesSettings>): number[][] {
  const origin = {x: s.origin.x / s.cell - .5, y: s.origin.y / s.cell - .5};
  return Array.from({length: s.rows}, (_, row) => Array.from({length: s.columns}, (_, col) => {
    const delay = gridDelay(col, row, s.columns, s.rows, s.pattern, origin, s.seed) * s.spread;
    return curves.snap(phase(p, delay, delay + 1 - s.spread));
  }));
}

export function TilesTransition({from, to, time, start, duration, options}: TransitionRenderProps<TilesOptions>) {
  const id = useSafeId('tiles');
  const s = tilesSettings(options, useStage());
  const p = clamp01((time - start) / duration);
  const shrink = tileShrink(p, s);
  const tiles: React.ReactNode[] = [];
  shrink.forEach((cols, row) => cols.forEach((k, col) => {
    // Tiles overlap by a pixel while whole, so no seam shows before they start to move.
    const size = (s.cell + 1.5) * (1 - k);
    if (size <= .4) return;
    const cx = (col + .5) * s.cell, cy = (row + .5) * s.cell;
    tiles.push(<rect key={`${row}-${col}`} x={cx - size / 2} y={cy - size / 2} width={size} height={size} rx={s.round * size / 2 * Math.min(1, k * 1.6)}
      transform={s.rotate ? `rotate(${(s.rotate * k).toFixed(2)} ${cx} ${cy})` : undefined}/>);
  }));
  return <AbsoluteFill style={{background: s.backdrop, overflow: 'hidden'}}>
    <Layer transform={about(centerOf(s.stage), mix(s.depth, 1, curves.punchOut(p)))}>{to}</Layer>
    {tiles.length > 0 && <AbsoluteFill style={{clipPath: `url(#${id})`}}>{from}</AbsoluteFill>}
    <svg width="0" height="0" style={{position: 'absolute'}} aria-hidden>
      <clipPath id={id} clipPathUnits="userSpaceOnUse">{tiles}</clipPath>
    </svg>
  </AbsoluteFill>;
}
