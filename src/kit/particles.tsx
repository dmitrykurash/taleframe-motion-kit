import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, useVideoConfig} from 'remotion';
import {mulberry32} from '../taleframe/transitions/kit';
import {useStage} from './camera';
import {useTime} from './clock';
import type {KineticFont} from './kinetic';
import {clamp, mix} from './motion';
import {curves} from './scene/curves';

/** Type made of particles: letters that break into drifting dust, dust that assembles into letters, and dust
 * that swirls into a turning galaxy. Particles are sampled from the real glyphs, seeded, and derived from time. */

type Particle = {x: number; y: number; order: number; a: number; b: number; c: number};
type Sampled = {particles: Particle[]; width: number; height: number; step: number; baseline: number};

function useParticles(text: string, font: string, tracking: number, count: number, seed: number): Sampled | null {
  const key = JSON.stringify([text, font, tracking, count, seed]);
  const [result, setResult] = useState<{key: string; data: Sampled} | null>(null);
  const [handle] = useState(() => delayRender('Sample particle text'));
  useEffect(() => {
    let active = true, released = false;
    const update = delayRender('Sample changed particle text');
    const release = () => {if (!released) {released = true; continueRender(handle); continueRender(update);}};
    document.fonts.load(font, text).then(async () => {
      await document.fonts.ready;
      const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D is unavailable for ParticleText.');
      const setFont = () => {ctx.font = font; (ctx as CanvasRenderingContext2D & {letterSpacing: string}).letterSpacing = `${tracking}px`;};
      setFont();
      const metrics = ctx.measureText(text), size = parseFloat(font.match(/(\d+(?:\.\d+)?)px/)?.[1] ?? '140');
      const width = Math.ceil(metrics.width + size * .1), height = Math.ceil(size * 1.3), baseline = Math.round(size * 1.02);
      canvas.width = width; canvas.height = height; setFont();
      ctx.fillStyle = '#000'; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, size * .05, baseline);
      const alpha = ctx.getImageData(0, 0, width, height).data;
      let filled = 0;
      for (let i = 3; i < alpha.length; i += 4) if (alpha[i] > 127) filled++;
      const step = Math.max(1.5, Math.sqrt(filled / count));
      const random = mulberry32((seed * 7919 + 1) >>> 0), particles: Particle[] = [];
      for (let y = step / 2; y < height; y += step) for (let x = step / 2; x < width; x += step) {
        if (alpha[(Math.floor(y) * width + Math.floor(x)) * 4 + 3] <= 127) continue;
        particles.push({x, y, order: clamp(x / width + (random() - .5) * .12), a: random(), b: random(), c: random()});
      }
      if (active) setResult({key, data: {particles, width, height, step, baseline}});
      release();
    }).catch(error => {release(); if (active) cancelRender(error);});
    return () => {active = false; release();};
  }, [key, handle]);
  return result?.key === key ? result.data : null;
}

export type ParticleTextProps = KineticFont & {
  text: string;
  /** 'dissolve': solid letters break into dust from left to right; 'assemble': dust flies in and becomes solid
   * letters; 'swirl': the letters dissolve and the dust spins into a galaxy. */
  mode?: 'dissolve' | 'assemble' | 'swirl';
  start?: number;
  duration?: number;
  /** About how many particles make the text. */
  count?: number;
  /** Second particle color and the share of particles that take it. */
  accent?: string;
  accentShare?: number;
  /** Center of the text on the stage. Default: stage center. */
  center?: {x: number; y: number};
  /** How far the dust drifts, in logical px. */
  drift?: number;
  seed?: number;
  time?: number;
  style?: React.CSSProperties;
};

export function ParticleText({text, mode = 'dissolve', start = 0, duration = 1.6, count = 5200, accent, accentShare = .35, center, drift = 360,
  seed = 1, time, style, ...font}: ParticleTextProps) {
  const clock = useTime(), t = time ?? clock;
  const stage = useStage(), {width: outputWidth} = useVideoConfig();
  const family = font.fontFamily ?? '"DM Sans Variable", sans-serif', size = font.fontSize ?? 140, weight = font.fontWeight ?? 500;
  const color = font.color ?? '#ffffff';
  const fontString = `${weight} ${size}px ${family}`;
  const sampled = useParticles(text, fontString, (font.letterSpacing ?? -.02) * size, count, seed);
  const ref = useRef<HTMLCanvasElement>(null);
  const scale = outputWidth / stage.width;
  const c = center ?? {x: stage.width / 2, y: stage.height / 2};
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas || !sampled) return;
    canvas.width = Math.round(stage.width * scale); canvas.height = Math.round(stage.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.clearRect(0, 0, stage.width, stage.height);
    const {particles, width, height, step, baseline} = sampled;
    const ox = c.x - width / 2, oy = c.y - height / 2;
    const flight = duration * .55, sweep = duration - flight;
    const emitted = (pt: Particle) => start + sweep * pt.order + .08 * pt.a * duration;
    const assemble = mode === 'assemble';
    // Solid letters, erased (or revealed) exactly where particles have left (or landed).
    const solid = document.createElement('canvas');
    solid.width = canvas.width; solid.height = canvas.height;
    const s = solid.getContext('2d')!;
    s.setTransform(scale, 0, 0, scale, 0, 0);
    s.font = fontString; (s as CanvasRenderingContext2D & {letterSpacing: string}).letterSpacing = `${(font.letterSpacing ?? -.02) * size}px`;
    s.fillStyle = color; s.textBaseline = 'alphabetic'; s.fillText(text, ox + size * .05, oy + baseline);
    s.globalCompositeOperation = 'destination-out';
    // Behind the sweep every particle has left (or, when assembling, ahead of it none has landed), so that whole
    // region is cleared, antialiased edges included; per-particle cells shape the ragged front in between.
    const front = width * ((t - start - (assemble ? flight : 0) - .08 * duration) / sweep - .06);
    if (assemble) s.fillRect(ox + Math.max(0, front), oy - size, width + size, height + 2 * size);
    else if (front > 0) s.fillRect(ox - size, oy - size, front + size, height + 2 * size);
    for (const pt of particles) {
      const e = emitted(pt), gone = assemble ? t < e + flight : t >= e;
      if (gone) s.fillRect(ox + pt.x - step / 2 - 1, oy + pt.y - step / 2 - 1, step + 2, step + 2);
    }
    ctx.drawImage(solid, 0, 0, stage.width, stage.height);
    // Landed particles on the front of an assembling word, until the solid letters reach them.
    if (assemble) {
      ctx.fillStyle = color;
      for (const pt of particles) if (t >= emitted(pt) + flight && pt.x > front) ctx.fillRect(ox + pt.x - step / 2, oy + pt.y - step / 2, step, step);
    }
    // Particles in flight.
    const r = Math.max(1, step * .55);
    for (const pt of particles) {
      const e = emitted(pt);
      // q: 0 at home in the letters … 1 at the far end of the drift.
      let q: number;
      if (assemble) {if (t >= e + flight) continue; q = clamp((e + flight - t) / flight);}
      else {if (t < e) continue; q = clamp((t - e) / flight);}
      const hx = ox + pt.x, hy = oy + pt.y;
      const w = curves.punchOut(q) * drift;
      let x = hx + w * (.35 + .9 * pt.a) + 26 * Math.sin(q * 6 + pt.b * 6.28) * q;
      let y = hy - w * (.15 + .6 * pt.b) + 18 * Math.cos(q * 5 + pt.c * 6.28) * q;
      let alpha = assemble ? 1 - q * .85 : 1 - q;
      if (mode === 'swirl') {
        const g = curves.glide(clamp((t - e - flight * .25) / (flight * 1.4)));
        const radius = 60 + 380 * Math.sqrt(pt.a), arm = pt.b < .5 ? 0 : Math.PI;
        const angle = arm + Math.log(radius / 60 + 1) * 2.2 + (pt.c - .5) * .5 - (t - start) * 1.1;
        const gx = c.x + radius * Math.cos(angle), gy = c.y + radius * .42 * Math.sin(angle);
        x = mix(x, gx, g); y = mix(y, gy, g); alpha = Math.max(alpha, g * (.55 + .45 * pt.c));
      }
      if (alpha <= .01) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = accent && pt.c < accentShare ? accent : color;
      const d = r * (1 - .35 * q);
      ctx.fillRect(x - d, y - d, d * 2, d * 2);
    }
    ctx.globalAlpha = 1;
  });
  return <canvas ref={ref} style={{position: 'absolute', inset: 0, width: stage.width, height: stage.height, ...style}}/>;
}
