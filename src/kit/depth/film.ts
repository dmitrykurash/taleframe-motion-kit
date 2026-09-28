// The per-frame compositor of a depth film. Each shot is a stack of painted planes filmed by its own camera, with
// ghost fills, guest planes, motes, depth of field, UI layers, its lens and its copy; cuts mix two shots with a
// Taleframe shader centred on an anchor; the painted finish runs once on the whole frame.
//
// Two clocks: outside cuts the camera and the motes run on the held clock (on twos, the handmade look); inside a cut
// the camera runs on the live clock so the travel-through is smooth. Copy always runs on the live clock.
import {applyTaleframeEffects, type EffectsSettings} from '../../taleframe/effects/adapter';
import type {HeliosSettings} from '../../taleframe/effects/native/helios/model';
import {getTransitionParams, hasTransition} from '../../taleframe/transitions/registry';
import {multiply, type Affine} from './affine';
import {depthConfig, depthUnit, heldTime, outputSize, type DepthConfig} from './config';
import type {Ellipse} from './focus';
import {applyMask, bloomMask, peripheryMask} from './mask';
import {mixCanvases, type DepthMix} from './mixer';
import {drawMotes, type DepthMotes} from './motes';
import {smooth} from './noise';
import {asWatercolor, paintedPlane, type PaintSettings, type TintSettings} from './planes';
import {releaseSurface, surface} from './raster';
import type {PlaneSource} from './sources';
import {coveredPlate, defocusBlur, drawPlane, planeMatrix, projectPlane, type DepthCamera, type PlaneDraw} from './stage';
import {drawInkLine, INK_FONT, loadInkFonts, type InkFont, type InkLine} from './type';
import {drawUILayer, type DepthUILayer} from './ui';

export type DepthLayer = {
  /** Unique within the shot; guests refer to it. */
  id: string;
  source: PlaneSource;
  /** Plane depth: 1 = the backdrop, smaller = nearer the lens (0.5 is halfway). */
  depth: number;
  /** A full-frame plate: kept covering the frame (cover-scale overscan) and only mildly defocused.
   * Default: true for the first layer. */
  plate?: boolean;
  /** Added to the paint seed: planes of one shot get different brush layouts. */
  seed?: number;
  /** This plane's paint, instead of the shot's (false = unpainted). */
  paint?: PaintSettings | false;
  /** Multiplies brushSize: subjects a step finer than the plates behind them (0.8). */
  brush?: number;
  /** Oil focus ellipses (plane uv) where fine strokes gather, fixed or per held frame. */
  focus?: readonly Ellipse[] | ((held: number) => readonly Ellipse[]);
  flipX?: boolean;
  /** Keep only the frame's periphery (wisps and near planes that must never cross the copy). */
  periphery?: boolean;
  /** The plane's own motion and look at camera time t, given its projected scale (see passLens). */
  look?: (t: number, scale: number) => Omit<PlaneDraw, 'depth'>;
  /** Leave a heavily blurred colour wash of this cut-out on the plate where it stood, so what the parallax uncovers
   * is its own colour, softly. Only for front-row subjects: on others it reads as a double. */
  ghost?: boolean;
  /** Borrow the picture from another film frame (a haze bank from a different moment). */
  frameOffset?: number;
};

export type DepthGuest = {
  /** A plane borrowed from another shot and drawn inside this one (a subject arriving before its world). */
  shot: string; layer: string;
  /** Camera-clock window. */
  window: [number, number];
  /** Drawn right after this host layer (index; 0 = just above the plate). */
  after: number;
  /** Placement: by default the guest shot's own camera at the guest's own depth, so the hand-off is seamless.
   * Return another matrix (see blendPlacement) to move it. */
  place?: (t: number, own: Affine, host: DepthCamera) => Affine;
  /** Watercolor unmask: centre (frame fractions) and radius (frame heights) at time t; null = fully shown. */
  reveal?: (t: number) => {cx: number; cy: number; radius: number} | null;
  alpha?: (t: number) => number;
  /** Blur in stage px (a subject racking into focus as it arrives). */
  blur?: (t: number) => number;
};

export type DepthShot = {
  id: string;
  /** Visible window, film seconds (including the cuts on either side). */
  window: [number, number];
  /** Held picture for a film frame (see heldFrames); default: a still, held frame 0. */
  held?: (frame: number) => number;
  /** Paint for every plane (watercolor, or oil via oilStyle / looseOil); false or absent = unpainted. */
  paint?: PaintSettings | false;
  /** Per-shot duotone grade, applied before the paint so the strokes carry it. */
  tint?: TintSettings;
  /** Swirl lens on the shot's composite (SWIRL_LENS); null or absent = none. */
  lens?: Partial<HeliosSettings> | null;
  layers: DepthLayer[];
  camera: (t: number) => DepthCamera;
  /** The depth in focus at time t (rack focus by animating it). Without it nothing is defocused. */
  focus?: (t: number) => number;
  /** Blur in stage px per unit of |1/d − 1/f| (default 2 on a 1080p stage). */
  aperture?: number;
  /** Mote fields, each drawn right after the layer with index `after`. */
  motes?: {after: number; field: DepthMotes}[];
  guests?: DepthGuest[];
  ui?: DepthUILayer[];
  lines?: InkLine[];
};

export type DepthCut = {
  from: string; to: string;
  /** Live-clock window: the camera runs at the full frame rate inside it. */
  window: [number, number];
  /** Shader progress runs 0 → 1 across this span (inside the window). */
  shader: [number, number];
  mix: DepthMix;
  /** Moving centre (frame fractions), usually an anchor on screen. Only for shaders with a centre: watercolor, ink,
   * engraving, prism, ripple, godrays (docs/transitions.md). */
  center?: (t: number) => {x: number; y: number};
};

export type DepthFilmSpec = {
  config: DepthConfig;
  shots: readonly DepthShot[];
  cuts?: readonly DepthCut[];
  /** Lines that belong to the film rather than one shot, drawn over the mixed picture. */
  overlay?: readonly InkLine[];
  /** The painted finish on the whole frame (PAINTED_FINISH); null or absent = none. */
  finish?: EffectsSettings | null;
  /** Default face for ink type (Instrument Serif). */
  font?: InkFont;
  /** Paint every oil plane with its watercolor settings instead: one flag keeps a watercolor version reproducible. */
  forceWatercolor?: boolean;
  /** Behind each shot, under its plate (default black). */
  background?: string;
};

/** Near planes melting away as they reach the lens: fade from projected scale `from` to `to`, and soften by
 * `blur` stage px per unit of scale beyond 1.2. */
export const passLens = (from: number, to: number, blur = 2.5) => (_t: number, s: number): Omit<PlaneDraw, 'depth'> =>
  ({alpha: 1 - smooth(from, to, s), blur: Math.max(0, (s - 1.2) * blur)});

/** Piecewise-linear lookup through (t, v) samples, clamped: a hand-measured anchor path. */
export const piecewise = (pts: readonly [number, number][]) => (t: number) => {
  if (!pts.length) throw new Error('piecewise needs at least one sample.');
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * (t - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
  }
  return pts[pts.length - 1][1];
};

const isPlate = (shot: DepthShot, i: number) => shot.layers[i].plate ?? i === 0;

/** Check a film's structure and return it with a validated config. Throws with a readable message. */
export function validateDepthFilm<T extends DepthFilmSpec>(film: T): T {
  const config = depthConfig(film.config);
  if (!film.shots.length) throw new Error('A depth film needs at least one shot.');
  const shots = new Map<string, DepthShot>();
  for (const shot of film.shots) {
    if (shots.has(shot.id)) throw new Error(`Two shots are called "${shot.id}".`);
    shots.set(shot.id, shot);
    if (!(shot.window[1] > shot.window[0])) throw new Error(`Shot "${shot.id}" needs a window that ends after it starts.`);
    if (!shot.layers.length) throw new Error(`Shot "${shot.id}" needs at least one layer (its plate).`);
    const ids = new Set<string>();
    for (const layer of shot.layers) {
      if (ids.has(layer.id)) throw new Error(`Shot "${shot.id}" has two layers called "${layer.id}".`);
      ids.add(layer.id);
      if (!Number.isFinite(layer.depth) || layer.depth <= 0) throw new Error(`Layer "${shot.id}/${layer.id}" needs a positive depth.`);
    }
    for (const m of shot.motes ?? []) {
      if (!Number.isInteger(m.after) || m.after < 0 || m.after >= shot.layers.length) throw new Error(`Shot "${shot.id}": motes after ${m.after} is not a layer index.`);
    }
  }
  for (const shot of film.shots) for (const g of shot.guests ?? []) {
    const own = shots.get(g.shot);
    if (!own) throw new Error(`Shot "${shot.id}" borrows from an unknown shot "${g.shot}".`);
    if (!own.layers.some(l => l.id === g.layer)) throw new Error(`Shot "${shot.id}" borrows an unknown layer "${g.shot}/${g.layer}".`);
    if (!Number.isInteger(g.after) || g.after < 0 || g.after >= shot.layers.length) throw new Error(`Shot "${shot.id}": guest after ${g.after} is not a layer index.`);
  }
  for (const cut of film.cuts ?? []) {
    const name = `${cut.from} → ${cut.to}`;
    if (!shots.has(cut.from) || !shots.has(cut.to)) throw new Error(`Cut ${name} refers to an unknown shot.`);
    if (!(cut.window[1] > cut.window[0])) throw new Error(`Cut ${name} needs a window that ends after it starts.`);
    if (!(cut.shader[1] > cut.shader[0]) || cut.shader[0] < cut.window[0] - 1e-9 || cut.shader[1] > cut.window[1] + 1e-9) {
      throw new Error(`Cut ${name}: the shader span must lie inside the cut's window.`);
    }
    if (!hasTransition(cut.mix.kind)) throw new Error(`Cut ${name}: unknown transition "${cut.mix.kind}" (docs/transitions.md).`);
    if (cut.center && !getTransitionParams(cut.mix.kind).some(p => p.id === 'center' && p.type === 'point')) {
      throw new Error(`Cut ${name}: the ${cut.mix.kind} shader has no centre to follow an anchor. Use watercolor, ink, engraving, prism, ripple or godrays, or drop center.`);
    }
  }
  return {...film, config};
}

/** Frames needed to show every shot and overlay line. */
export function depthFilmFrames(film: DepthFilmSpec): number {
  const end = Math.max(...film.shots.map(s => s.window[1]), ...(film.overlay ?? []).map(l => l.end));
  return Math.max(1, Math.ceil(end * film.config.fps - 1e-6));
}

/** Which cut or shot a film time shows: the cut whose window holds t, else the shot whose window holds t (the last
 * shot after the end). */
export function depthFrameAt(film: DepthFilmSpec, t: number): {cut: DepthCut} | {shot: DepthShot} {
  const cut = film.cuts?.find(c => t >= c.window[0] && t < c.window[1]);
  if (cut) return {cut};
  return {shot: film.shots.find(s => t >= s.window[0] && t < s.window[1]) ?? film.shots[film.shots.length - 1]};
}

type Render = {film: DepthFilmSpec; config: DepthConfig; scale: number; out: {width: number; height: number}; unit: number};

function paintOf(r: Render, shot: DepthShot, layer: DepthLayer): PaintSettings | false {
  const paint = layer.paint === undefined ? shot.paint ?? false : layer.paint;
  return paint && r.film.forceWatercolor ? asWatercolor(paint) : paint;
}

function plane(r: Render, shot: DepthShot, layer: DepthLayer, frame: number): Promise<HTMLCanvasElement> {
  const held = (shot.held ?? (() => 0))(frame + (layer.frameOffset ?? 0));
  const focus = typeof layer.focus === 'function' ? layer.focus(held) : layer.focus;
  return paintedPlane({source: layer.source, held, config: r.config, scale: r.scale, paint: paintOf(r, shot, layer),
    tint: shot.tint, seed: layer.seed, brush: layer.brush, focus});
}

/** How a layer is drawn at camera time tc: its depth, its own motion and look, and (for plates) enough extra scale
 * to always cover the frame. */
function layerDraw(r: Render, shot: DepthShot, i: number, cam: DepthCamera, tc: number): PlaneDraw {
  const L = shot.layers[i];
  const {scale} = projectPlane(L.depth, cam);
  const draw: PlaneDraw = {depth: L.depth, ...(L.look?.(tc, scale) ?? {})};
  return isPlate(shot, i) ? coveredPlate(cam, draw, r.config) : draw;
}

async function drawGuest(r: Render, out: CanvasRenderingContext2D, host: DepthCamera, g: DepthGuest, frame: number, tc: number) {
  const shot = r.film.shots.find(s => s.id === g.shot)!;
  const layer = shot.layers.find(l => l.id === g.layer)!;
  const pic = await plane(r, shot, layer, frame);
  // Placed by its own shot's camera at its own depth, so the hand-off to that shot is seamless.
  const own = planeMatrix(shot.camera(tc), {depth: layer.depth}, r.config);
  const m = g.place ? g.place(tc, own, host) : own;
  const tmp = surface(r.out.width, r.out.height);
  tmp.setTransform(multiply({a: r.scale, b: 0, c: 0, d: r.scale, e: 0, f: 0}, m));
  tmp.drawImage(pic, 0, 0, r.config.width, r.config.height);
  tmp.setTransform(1, 0, 0, 1, 0, 0);
  const rv = g.reveal?.(tc);
  if (rv) {
    const w = 480, h = Math.max(8, Math.round(480 * r.config.height / r.config.width));
    applyMask(tmp, bloomMask({width: w, height: h, cx: rv.cx, cy: rv.cy, radius: Math.max(.001, rv.radius), feather: .14, ragged: .3, scale: 70, seed: 29}));
  }
  out.save();
  out.globalAlpha = g.alpha?.(tc) ?? 1;
  const blur = (g.blur?.(tc) ?? 0) * r.scale;
  if (blur > .3) out.filter = `blur(${blur.toFixed(2)}px)`;
  out.drawImage(tmp.canvas, 0, 0);
  out.restore();
  releaseSurface(tmp);
}

/** One shot's picture: painted planes through its camera, ghost fills, motes, guests, UI layers, the lens, then
 * its copy (which nearer planes may cover). tc = camera clock, th = held clock. */
async function renderShot(r: Render, shot: DepthShot, frame: number, tc: number, th: number): Promise<CanvasRenderingContext2D> {
  const {config, scale, unit} = r;
  const out = surface(r.out.width, r.out.height);
  out.fillStyle = r.film.background ?? '#000';
  out.fillRect(0, 0, r.out.width, r.out.height);
  const cam = shot.camera(tc);
  // Copy runs on the live clock: its slow approach must be continuous, not held on twos.
  const t = frame / config.fps;
  const lines = (shot.lines ?? []).filter(l => t >= l.start && t <= l.end);
  const occluders = lines.map(() => surface(r.out.width, r.out.height));
  const aperture = shot.aperture ?? 2 * unit;
  let plateDraw: PlaneDraw | null = null;
  for (let i = 0; i < shot.layers.length; i++) {
    const L = shot.layers[i];
    const pic = await plane(r, shot, L, frame);
    let src: CanvasImageSource = pic, tmp: CanvasRenderingContext2D | null = null;
    if (L.periphery || L.flipX) {
      tmp = surface(r.out.width, r.out.height);
      if (L.flipX) {tmp.translate(r.out.width, 0); tmp.scale(-1, 1);}
      tmp.drawImage(pic, 0, 0, r.out.width, r.out.height);
      tmp.setTransform(1, 0, 0, 1, 0, 0);
      if (L.periphery) applyMask(tmp, peripheryMask());
      src = tmp.canvas;
    }
    const draw = layerDraw(r, shot, i, cam, tc);
    if (shot.focus) {
      // Depth of field: plates only mildly, so the backdrop never dissolves into a smear.
      const dof = defocusBlur(L.depth, shot.focus(tc), cam.z, aperture, isPlate(shot, i) ? 3 * unit : 18 * unit);
      if (dof > .15 * unit) draw.blur = (draw.blur ?? 0) + dof;
    }
    if (i === 0) plateDraw = draw;
    drawPlane(out, src, cam, draw, config, scale);
    if (i === 0) {
      // Ghost fills: each ghost cut-out, blurred, where it stood on the plate.
      for (const G of shot.layers) {
        if (!G.ghost || !plateDraw) continue;
        const gp = await plane(r, shot, G, frame);
        // A colour wash, not a double: shrink to a sixteenth and let the upscale blur it (cheap and very soft).
        const small = surface(Math.max(1, Math.round(r.out.width / 16)), Math.max(1, Math.round(r.out.height / 16)));
        small.drawImage(gp, 0, 0, small.canvas.width, small.canvas.height);
        drawPlane(out, small.canvas, cam, {...plateDraw, alpha: .9, blur: 4 * unit}, config, scale);
        releaseSurface(small);
      }
    }
    lines.forEach((line, k) => {
      if (line.depth !== undefined && (line.occlusion ?? 0) > 0 && L.depth < line.depth) {
        drawPlane(occluders[k], src, cam, {...draw, alpha: 1, op: undefined}, config, scale);
      }
    });
    releaseSurface(tmp);
    for (const g of shot.guests ?? []) if (g.after === i && tc >= g.window[0] && tc <= g.window[1]) await drawGuest(r, out, cam, g, frame, tc);
    for (const m of shot.motes ?? []) if (m.after === i) drawMotes(out, shot.focus ? {...m.field, focus: shot.focus(tc)} : m.field, th, cam, config, scale);
  }
  if (shot.ui?.length) {
    // UI layers float in front of the painting; they share the shot's lens but not its planes' camera.
    const scratch = surface(r.out.width, r.out.height);
    for (const l of shot.ui) {
      scratch.clearRect(0, 0, r.out.width, r.out.height);
      await drawUILayer(out, l, tc, config, scale, scratch);
    }
    releaseSurface(scratch);
  }
  if (shot.lens) applyTaleframeEffects(out, {order: ['helios'], helios: {...shot.lens, enabled: true}}, frame, config.fps);
  lines.forEach((line, k) => {
    const txt = surface(r.out.width, r.out.height);
    drawInkLine(txt, line, t, {config, scale, font: r.film.font});
    const strength = line.occlusion ?? 0;
    if (strength > 0) {
      txt.save(); txt.globalCompositeOperation = 'destination-out'; txt.globalAlpha = strength; txt.drawImage(occluders[k].canvas, 0, 0); txt.restore();
    }
    out.drawImage(txt.canvas, 0, 0);
    releaseSurface(txt);
  });
  releaseSurface(...occluders);
  return out;
}

const fontsReady = new WeakMap<DepthFilmSpec, Promise<void>>();
function filmFonts(film: DepthFilmSpec) {
  let pending = fontsReady.get(film);
  if (!pending) {
    pending = loadInkFonts([...film.shots.flatMap(s => s.lines ?? []), ...(film.overlay ?? [])], film.font ?? INK_FONT);
    pending.catch(() => fontsReady.delete(film));
    fontsReady.set(film, pending);
  }
  return pending;
}

/** Render one frame of a depth film into `ctx` (an output-size canvas; `scale` = output px per stage px).
 * A pure function of the frame: render frames in any order. */
export async function renderDepthFrame(ctx: CanvasRenderingContext2D, film: DepthFilmSpec, frame: number, scale = 1) {
  const config = film.config;
  await filmFonts(film);
  const r: Render = {film, config, scale, out: outputSize(config, scale), unit: depthUnit(config)};
  const t = frame / config.fps;
  const th = heldTime(frame, config);
  const at = depthFrameAt(film, t);
  const tc = 'cut' in at ? t : th;
  const out = surface(r.out.width, r.out.height);
  if ('cut' in at) {
    const cut = at.cut;
    const p = Math.max(0, Math.min(1, (t - cut.shader[0]) / (cut.shader[1] - cut.shader[0])));
    const from = film.shots.find(s => s.id === cut.from)!, to = film.shots.find(s => s.id === cut.to)!;
    // Outside the shader's span only one side is visible (the camera still runs on the live clock).
    const a = p < 1 ? await renderShot(r, from, frame, tc, th) : null;
    const b = p > 0 ? await renderShot(r, to, frame, tc, th) : null;
    if (a && b) {
      const params = cut.center ? {...cut.mix.params, center: cut.center(t)} : cut.mix.params;
      out.drawImage(mixCanvases(a.canvas, b.canvas, p, {...cut.mix, params}, config.fps), 0, 0);
    } else out.drawImage((a ?? b)!.canvas, 0, 0);
    releaseSurface(a, b);
  } else {
    const pic = await renderShot(r, at.shot, frame, tc, th);
    out.drawImage(pic.canvas, 0, 0);
    releaseSurface(pic);
  }
  for (const line of film.overlay ?? []) drawInkLine(out, line, t, {config, scale, font: film.font});
  if (film.finish) applyTaleframeEffects(out, film.finish, frame, config.fps);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.drawImage(out.canvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
  releaseSurface(out);
}
