import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useStage, type StageSize} from '../camera';
import {bell} from '../moves';
import {clamp01, curves, mix, phase} from './curves';
import {STAGE} from './layers';
import type {GridOptions, TransitionRenderProps} from './types';

const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

export function gridSettings(o: GridOptions, stage: StageSize = STAGE) {
  const columns = clampInt(o.columns ?? 3, 2, 8), rows = clampInt(o.rows ?? 3, 1, 8), cells = columns * rows;
  const fromCell = clampInt(o.fromCell ?? Math.floor(cells / 2), 0, cells - 1);
  const toCell = clampInt(o.toCell ?? (fromCell + 1) % cells, 0, cells - 1);
  if (toCell === fromCell) throw new Error('Grid needs different cells for the outgoing and incoming shots.');
  const gap = Math.max(0, o.gap ?? 26), radius = Math.max(0, o.radius ?? 22), hold = Math.min(.8, Math.max(0, o.hold ?? .3));
  // Cells keep the stage's aspect ratio, so a cell scaled up fills the frame exactly.
  const cellW = (stage.width - gap * (columns + 1)) / columns, cellH = cellW * stage.height / stage.width;
  const top = (stage.height - (rows * cellH + (rows + 1) * gap)) / 2;
  const rect = (i: number) => ({x: gap + (i % columns) * (cellW + gap), y: top + gap + Math.floor(i / columns) * (cellH + gap), width: cellW, height: cellH});
  return {columns, rows, cells, fromCell, toCell, gap, radius, hold, rect, zoom: stage.width / cellW, tiles: o.tiles ?? [],
    backdrop: o.backdrop ?? '#0b0b0d', stage};
}

/** Camera over the grid at progress p: the stage point shown at the frame center, and the scale. It starts on
 * the outgoing cell, pulls back to the whole grid, holds, and pushes into the incoming cell. */
export function gridCamera(p: number, s: ReturnType<typeof gridSettings>) {
  const a = (1 - s.hold) / 2;
  const out = curves.snap(phase(p, 0, a)), into = curves.snap(phase(p, 1 - a, 1));
  const center = (i: number) => {const r = s.rect(i); return {x: r.x + r.width / 2, y: r.y + r.height / 2};};
  const mid = {x: s.stage.width / 2, y: s.stage.height / 2}, from = center(s.fromCell), to = center(s.toCell);
  const log = Math.log(s.zoom) * ((1 - out) + into), drift = 1 + .025 * phase(p, a, 1 - a) * (1 - into);
  const focus = p < .5 ? {x: mix(from.x, mid.x, out), y: mix(from.y, mid.y, out)} : {x: mix(mid.x, to.x, into), y: mix(mid.y, to.y, into)};
  return {focus, scale: Math.exp(log) * drift, overview: 1 - log / Math.log(s.zoom), speed: bell(phase(p, 0, a)) + bell(phase(p, 1 - a, 1))};
}

export function GridTransition({from, to, time, start, duration, options}: TransitionRenderProps<GridOptions>) {
  const s = gridSettings(options, useStage());
  const cam = gridCamera(clamp01((time - start) / duration), s);
  const W = s.stage.width, H = s.stage.height;
  let filler = 0;
  const cells = Array.from({length: s.cells}, (_, i) => {
    const content = i === s.fromCell ? from : i === s.toCell ? to : s.tiles[filler++ % Math.max(1, s.tiles.length)];
    const r = s.rect(i);
    return <div key={i} style={{position: 'absolute', left: r.x, top: r.y, width: r.width, height: r.height, overflow: 'hidden',
      borderRadius: s.radius * cam.overview, background: '#1a1a1e'}}>
      {content && <div style={{position: 'absolute', left: 0, top: 0, width: W, height: H, transform: `scale(${(r.width / W).toFixed(5)})`, transformOrigin: '0 0'}}>{content}</div>}
    </div>;
  });
  return <AbsoluteFill style={{background: s.backdrop, overflow: 'hidden'}}>
    <AbsoluteFill style={{transformOrigin: '0 0', filter: cam.speed > .05 ? `blur(${(2.2 * cam.speed).toFixed(2)}px)` : undefined,
      transform: `translate(${W / 2}px, ${H / 2}px) scale(${cam.scale.toFixed(5)}) translate(${(-cam.focus.x).toFixed(2)}px, ${(-cam.focus.y).toFixed(2)}px)`}}>
      {cells}
    </AbsoluteFill>
  </AbsoluteFill>;
}
