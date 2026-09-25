import React, {useLayoutEffect, useRef} from 'react';
import {useVideoConfig} from 'remotion';
import {useStage} from './camera';
import {TimeShift, useTime} from './clock';
import {clamp} from './motion';
import type {Point} from './scene/types';

/** Generative fields for motion reels: a grid of shapes driven by waves, a 3D field of blocks, and motion
 * trails. Everything is a pure function of time. */

export type Glyph = {shape: 'dot' | 'square' | 'diamond' | 'plus' | 'ring'; size: number; color: string; rotate?: number; opacity?: number;
  /** Corner rounding of squares and diamonds, 0–1. */
  round?: number};

export type FieldPattern = 'radial' | 'diagonal' | 'rows' | 'columns';

/** A traveling wave over a grid, 0–1 at each cell: `wavelength` cells between crests, moving `speed` crests per
 * second outward from `origin` (radial), across the diagonal, or along rows or columns. */
export function fieldWave(col: number, row: number, t: number, {pattern = 'radial', origin = {x: 0, y: 0}, speed = 1, wavelength = 6}:
  {pattern?: FieldPattern; origin?: Point; speed?: number; wavelength?: number} = {}): number {
  const d = pattern === 'radial' ? Math.hypot(col - origin.x, row - origin.y) : pattern === 'diagonal' ? (col + row) / Math.SQRT2
    : pattern === 'rows' ? row : col;
  return .5 + .5 * Math.cos(2 * Math.PI * (d / wavelength - speed * t));
}

export type PatternFieldProps = {
  columns: number;
  rows: number;
  /** Cell pitch in logical px; the grid is centered in its positioned parent. */
  cell: number;
  /** What each cell draws at time t: a glyph, several layered, or nothing. `size` is a fraction of the cell. */
  glyph: (col: number, row: number, t: number) => Glyph | readonly Glyph[] | null;
  time?: number;
  style?: React.CSSProperties;
};

function drawGlyph(g: Glyph, cx: number, cy: number, cell: number, key: string) {
  const s = Math.max(0, g.size) * cell;
  if (s < .3 || (g.opacity ?? 1) <= .005) return null;
  const common = {fill: g.color, opacity: g.opacity};
  const spin = (extra = 0) => `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${((g.rotate ?? 0) + extra).toFixed(2)})`;
  switch (g.shape) {
    case 'dot': return <circle key={key} cx={cx} cy={cy} r={s / 2} {...common}/>;
    case 'ring': return <circle key={key} cx={cx} cy={cy} r={s * .43} fill="none" stroke={g.color} strokeWidth={s * .14} opacity={g.opacity}/>;
    case 'square': case 'diamond': return <rect key={key} x={-s / 2} y={-s / 2} width={s} height={s} rx={(g.round ?? .2) * s / 2}
      transform={spin(g.shape === 'diamond' ? 45 : 0)} {...common}/>;
    case 'plus': {
      const a = s * .32;
      return <g key={key} transform={spin()} {...common}>
        <rect x={-s / 2} y={-a / 2} width={s} height={a} rx={a * .3}/><rect x={-a / 2} y={-s / 2} width={a} height={s} rx={a * .3}/>
      </g>;
    }
  }
}

/** A grid of shapes that pulse, turn, and change shape as waves travel through it: dot matrices, halftone
 * rings, and pattern fields. */
export function PatternField({columns, rows, cell, glyph, time, style}: PatternFieldProps) {
  const clock = useTime(), t = time ?? clock;
  const shapes: React.ReactNode[] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const g = glyph(col, row, t);
    if (!g) continue;
    const list = Array.isArray(g) ? g : [g as Glyph];
    list.forEach((item, k) => shapes.push(drawGlyph(item, (col + .5) * cell, (row + .5) * cell, cell, `${row}-${col}-${k}`)));
  }
  return <svg width={columns * cell} height={rows * cell} style={{position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
    overflow: 'visible', ...style}}>{shapes}</svg>;
}

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l];};
function shade(hex: string, k: number, toward: string, fog: number): string {
  const c = (h: string) => {const s = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(s.slice(i, i + 2), 16));};
  const a = c(hex), b = c(toward);
  return `rgb(${a.map((v, i) => Math.round((v * k) * (1 - fog) + b[i] * fog)).join(',')})`;
}

export type BlockCamera = {yaw?: number; pitch?: number; distance?: number; focal?: number; target?: V3};
export type BlockFieldProps = {
  columns: number;
  rows: number;
  /** Height of each block in cell units at time t. */
  height: (col: number, row: number, t: number) => number;
  /** Top color of each block as #rrggbb; the sides are shaded from it. */
  color: (col: number, row: number, t: number) => string;
  /** Orbit camera around `target` (cell units): yaw and pitch in degrees, distance in cells, focal as a fraction of the frame height. */
  camera?: BlockCamera;
  /** Gap between blocks as a fraction of a cell. */
  gap?: number;
  /** A ball on the field in cell units (y is its height), drawn with a contact shadow; squash flattens it. */
  ball?: {x: number; y: number; z: number; radius: number; color: string; squash?: number};
  background?: string;
  /** Fade toward the background with distance, 0–1. */
  fog?: number;
  time?: number;
};

/** A field of extruded blocks in 3D whose heights and colors follow any function of time, drawn on a canvas with
 * an orbiting camera, flat lighting, fog, and an optional bouncing ball. */
export function BlockField({columns, rows, height, color, camera = {}, gap = .14, ball, background = '#0c0c0f', fog = .55, time}: BlockFieldProps) {
  const clock = useTime(), t = time ?? clock;
  const stage = useStage(), {width} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const scale = width / stage.width;
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = Math.round(stage.width * scale); canvas.height = Math.round(stage.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is unavailable for BlockField.');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = background; ctx.fillRect(0, 0, stage.width, stage.height);
    const {yaw = 30, pitch = 38, distance = 26, focal = 1.25, target = [0, 0, 0]} = camera;
    const ya = yaw * Math.PI / 180, pa = pitch * Math.PI / 180;
    const eye: V3 = [target[0] + distance * Math.sin(ya) * Math.cos(pa), target[1] + distance * Math.sin(pa), target[2] + distance * Math.cos(ya) * Math.cos(pa)];
    const f = norm(sub(target, eye)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f);
    const F = focal * stage.height, W2 = stage.width / 2, H2 = stage.height / 2;
    const project = (p: V3) => {const v = sub(p, eye), z = dot(v, f); return {x: W2 + F * dot(v, r) / z, y: H2 - F * dot(v, u) / z, z};};
    const light = norm([-.45, .85, .35]);
    const near = distance * .55, far = distance * 1.6;
    const blocks: {depth: number; draw: () => void}[] = [];
    const g = gap / 2;
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const h = Math.max(.02, height(col, row, t)), top = color(col, row, t);
      const x0 = col - columns / 2 + g, x1 = col - columns / 2 + 1 - g, z0 = row - rows / 2 + g, z1 = row - rows / 2 + 1 - g;
      const center: V3 = [(x0 + x1) / 2, h / 2, (z0 + z1) / 2];
      const depth = dot(sub(center, eye), f);
      blocks.push({depth, draw: () => {
        const fogged = clamp((depth - near) / (far - near)) * fog;
        const faces: {n: V3; c: V3; pts: V3[]}[] = [
          {n: [0, 0, 1], c: [center[0], h / 2, z1], pts: [[x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1]]},
          {n: [0, 0, -1], c: [center[0], h / 2, z0], pts: [[x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0]]},
          {n: [1, 0, 0], c: [x1, h / 2, center[2]], pts: [[x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1]]},
          {n: [-1, 0, 0], c: [x0, h / 2, center[2]], pts: [[x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0]]},
          {n: [0, 1, 0], c: [center[0], h, center[2]], pts: [[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]]},
        ];
        for (const face of faces) {
          if (dot(face.n, sub(eye, face.c)) <= 0) continue;
          const pts = face.pts.map(project);
          if (pts.some(p => p.z <= .1)) continue;
          ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
          ctx.fillStyle = shade(top, .38 + .62 * Math.max(0, dot(face.n, light)) + (face.n[1] > 0 ? .08 : 0), background, fogged);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = .6; ctx.stroke();
        }
      }});
    }
    if (ball) {
      const bc: V3 = [ball.x, ball.y + ball.radius, ball.z];
      blocks.push({depth: dot(sub(bc, eye), f) - .01, draw: () => {
        const ground = Math.max(0, height(Math.floor(ball.x + columns / 2), Math.floor(ball.z + rows / 2), t));
        const s = project([ball.x, ground, ball.z]), p = project(bc), rad = F * ball.radius / p.z, squash = ball.squash ?? 1;
        const lift = clamp(1 - (ball.y - ground) / 6);
        ctx.save(); ctx.filter = 'blur(6px)'; ctx.fillStyle = `rgba(0,0,0,${(.35 * lift).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(s.x, s.y, rad * 1.1, rad * .38, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        const grad = ctx.createRadialGradient(p.x - rad * .35, p.y - rad * .45, rad * .1, p.x, p.y, rad);
        grad.addColorStop(0, shade(ball.color, 1.25, ball.color, 0)); grad.addColorStop(1, shade(ball.color, .72, ball.color, 0));
        ctx.fillStyle = grad; ctx.beginPath(); ctx.ellipse(p.x, p.y + rad * (1 - squash), rad / Math.sqrt(squash), rad * squash, 0, 0, Math.PI * 2); ctx.fill();
      }});
    }
    blocks.sort((a, b) => b.depth - a.depth).forEach(b => b.draw());
  });
  return <canvas ref={ref} style={{position: 'absolute', inset: 0, width: stage.width, height: stage.height}}/>;
}

/** Ghosts of a moving element at earlier instants, fading out: the motion trail of animation studies.
 * The render function receives each instant; draw the element on a transparent ground. */
export function Trail({count = 6, spacing = .035, fade = .62, time, children}: {count?: number; spacing?: number; fade?: number; time?: number;
  children: (time: number) => React.ReactNode}) {
  const clock = useTime(), t = time ?? clock;
  return <>
    {Array.from({length: count}, (_, k) => count - k).map(k => <div key={k} style={{position: 'absolute', inset: 0, opacity: .75 * fade ** k}}>
      <TimeShift by={-k * spacing}>{children(t - k * spacing)}</TimeShift>
    </div>)}
    {children(t)}
  </>;
}
