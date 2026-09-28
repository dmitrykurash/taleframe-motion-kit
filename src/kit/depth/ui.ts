// UI layers in depth. A product moment (a card, a dialog, a window) arrives out of the depth, small, soft and faint,
// settling into place in front of the painting. It leaves either by passing the viewer or, at a scene change, by the
// camera diving through it: it grows past the lens around its anchor (a button, a badge, a window) while the next
// scene opens from that point. Focus pulls to the UI while it is present.
//
// A layer's picture comes from a transparent PNG sequence (for example a UI composition rendered to transparent PNGs,
// with a per-frame log of its camera and anchor; see docs/depth-films.md) or from a deterministic draw(ctx, t)
// function.
import {sequenceFrameAt, validateImageSequenceOptions, type ImageSequenceOptions} from '../imageSequence';
import {anchorAt, type Track} from './anchors';
import {depthUnit, type DepthConfig} from './config';
import {clamp01, smooth} from './noise';
import {depthImage} from './raster';
import type {DepthCamera} from './stage';

/** The layer's own camera and anchor at a moment, stage px: where its content sits (x, y), its own zoom (scale),
 * and the point a dive goes through (anchorX, anchorY). */
export type DepthUIPose = {x: number; y: number; scale: number; anchorX: number; anchorY: number};

export type DepthUIFrame = {t: number; config: DepthConfig; scale: number};
export type DepthUISource = {
  /** Draw the layer's full-frame picture at film time t, in stage px (the context is already scaled to the output).
   * Must be a pure function of t. */
  draw: (ctx: CanvasRenderingContext2D, info: DepthUIFrame) => void | Promise<void>;
  /** The layer's pose at film time t. Without it the dive goes through the frame centre. */
  pose?: (t: number) => DepthUIPose | null;
};

export type DepthUILayer = {
  source: DepthUISource;
  /** Visible window, film seconds. */
  window: [number, number];
  /** Arrive out of the depth over `dur` seconds from `at`. */
  enter?: {at: number; dur: number};
  /** 'pass': grows toward the viewer and fades. 'dive': the camera flies through it at its anchor. */
  exit?: {at: number; dur: number; kind: 'pass' | 'dive'};
  /** The dive's anchor (stage px) when the source has no pose. */
  anchor?: (t: number) => {x: number; y: number};
};

/** A transparent PNG sequence (frame-000000.png…) placed on the film clock: sequence frame 0 plays at `start`.
 * `fit` places frames of another size on the stage as imageSequenceSource does (default 'cover'; a sequence of the
 * stage's aspect ratio fills it exactly either way). `poses` is the exported per-frame log (keyed by sequence frame)
 * of the layer's camera and anchor, in stage px. */
export function uiSequence(options: ImageSequenceOptions & {start?: number; poses?: Track<DepthUIPose>}): DepthUISource {
  const valid = validateImageSequenceOptions(options);
  const start = options.start ?? 0;
  const index = (t: number) => sequenceFrameAt(Math.max(0, t - start), valid);
  const fallback = null as DepthUIPose | null;
  return {
    draw: async (ctx, {t, config}) => {
      const img = await depthImage(`${valid.directory}/frame-${String(index(t)).padStart(6, '0')}.png`);
      const r = fitRect(valid.fit, img.naturalWidth, img.naturalHeight, config.width, config.height);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, r.x, r.y, r.width, r.height);
    },
    pose: options.poses ? (t: number) => anchorAt(options.poses!, index(t), fallback) : undefined,
  };
}

/** Where a picture of `w` × `h` goes on a `W` × `H` stage: scaled to cover it or fit inside it (centred), or
 * stretched over it. */
export function fitRect(fit: 'cover' | 'contain' | 'stretch', w: number, h: number, W: number, H: number) {
  if (fit === 'stretch' || !(w > 0 && h > 0)) return {x: 0, y: 0, width: W, height: H};
  const s = fit === 'contain' ? Math.min(W / w, H / h) : Math.max(W / w, H / h);
  return {x: (W - w * s) / 2, y: (H - h * s) / 2, width: w * s, height: h * s};
}

/** A layer drawn by a function of time (a card with checks appearing one by one, a small dialog). */
export const uiDrawing = (draw: DepthUISource['draw'], pose?: DepthUISource['pose']): DepthUISource => ({draw, pose});

const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = (t: number) => Math.pow(clamp01(t), 2.2);

/** Scale, blur (stage px), opacity and the point the layer scales about, at time t. */
export function uiLook(l: DepthUILayer, t: number, config: DepthConfig) {
  const unit = depthUnit(config);
  let scale = 1, blur = 0, alpha = 1, ax = config.width / 2, ay = config.height / 2;
  if (l.enter) {
    const p = easeOut((t - l.enter.at) / l.enter.dur);
    scale *= .82 + .18 * p; blur += 8 * unit * Math.pow(1 - p, 1.5); alpha *= smooth(0, .6, (t - l.enter.at) / l.enter.dur);
  }
  if (l.exit) {
    const q = clamp01((t - l.exit.at) / l.exit.dur);
    if (l.exit.kind === 'dive') {
      const pose = l.source.pose?.(t);
      const anchor = pose ? {x: pose.anchorX, y: pose.anchorY} : l.anchor?.(t);
      if (anchor) {ax = anchor.x; ay = anchor.y;}
      scale *= Math.exp(Math.log(9) * easeIn(q)); blur += 17 * unit * q * q; alpha *= 1 - smooth(.55, 1, q);
    } else {
      scale *= 1 + .45 * easeIn(q); blur += 10 * unit * q * q; alpha *= 1 - easeIn(q);
    }
  }
  return {scale, blur, alpha, ax, ay};
}

/** The dive point of a layer at time t, in frame fractions (0..1), for a cut's centre or the next shot's opening. */
export function uiAnchor(l: DepthUILayer, t: number, config: DepthConfig): {x: number; y: number} {
  const pose = l.source.pose?.(t);
  const p = pose ? {x: pose.anchorX, y: pose.anchorY} : l.anchor?.(t) ?? {x: config.width / 2, y: config.height / 2};
  return {x: p.x / config.width, y: p.y / config.height};
}

/** How present the UI is (0..1) at time t: drives the focus pull from the painting to the UI and back. */
export function uiPresence(layers: readonly DepthUILayer[] | undefined, t: number) {
  let v = 0;
  for (const l of layers ?? []) {
    if (t < l.window[0] || t > l.window[1]) continue;
    const a = l.enter ? smooth(l.enter.at - .1, l.enter.at + .5, t) : 1;
    const b = l.exit ? 1 - smooth(l.exit.at, l.exit.at + l.exit.dur * .6, t) : 1;
    v = Math.max(v, a * b);
  }
  return v;
}

/** A shot focus that pulls from `scene` (a depth, or a function of time) to `ui` while UI layers are present. */
export function uiFocus(layers: readonly DepthUILayer[], o: {scene?: number | ((t: number) => number); ui?: number} = {}) {
  const scene = o.scene ?? 1, ui = o.ui ?? .3;
  return (t: number) => {
    const s = typeof scene === 'number' ? scene : scene(t);
    return s + (ui - s) * uiPresence(layers, t);
  };
}

/** Background camera travel that follows a UI layer's own logged camera at reduced rates (so an exported flat
 * product move gains parallax, per plane): sideways rates rx, ry and a zoom exponent e, relative to the pose at
 * `from`. */
export function followUICamera(source: DepthUISource, o: {from: number; rate?: [number, number]; zoom?: number}) {
  const [rx, ry] = o.rate ?? [.12, .1], e = o.zoom ?? .12;
  return (t: number): Pick<DepthCamera, 'x' | 'y' | 'z'> => {
    const p = source.pose?.(t), p0 = source.pose?.(o.from);
    if (!p || !p0) return {x: 0, y: 0, z: 0};
    return {x: -rx * (p.x - p0.x), y: -ry * (p.y - p0.y), z: 1 - Math.pow(p.scale / p0.scale, -e)};
  };
}

/** Draw a UI layer at film time t onto an output-size canvas through a scratch canvas of the same size. */
export async function drawUILayer(ctx: CanvasRenderingContext2D, l: DepthUILayer, t: number, config: DepthConfig, scale: number,
  scratch: CanvasRenderingContext2D) {
  if (t < l.window[0] || t > l.window[1]) return;
  const look = uiLook(l, t, config);
  if (look.alpha <= .002) return;
  scratch.save();
  scratch.setTransform(scale, 0, 0, scale, 0, 0);
  await l.source.draw(scratch, {t, config, scale});
  scratch.restore();
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.translate(look.ax, look.ay); ctx.scale(look.scale, look.scale); ctx.translate(-look.ax, -look.ay);
  ctx.globalAlpha = look.alpha;
  if (look.blur * scale > .4) ctx.filter = `blur(${(look.blur * scale).toFixed(2)}px)`;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(scratch.canvas, 0, 0, config.width, config.height);
  ctx.restore();
}
