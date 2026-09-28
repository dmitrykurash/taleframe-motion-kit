// The multiplane stage: a shot is a stack of painted planes at different depths, filmed by a camera that travels
// forward (and drifts sideways). Planes stay parallel to the lens, as on a real multiplane rig, so every projection
// is an affine map and plain Canvas 2D draws it exactly.
import {affine, apply, invert, multiply, type Affine} from './affine';
import type {DepthConfig} from './config';

export type DepthCamera = {
  /** Distance travelled forward, in units of the backdrop's depth (1). 0.5 is halfway to the backdrop. */
  z: number;
  /** Sideways and vertical travel, in stage pixels as seen on the backdrop plane. */
  x: number; y: number;
  /** Roll around the lens axis, radians. */
  roll: number;
  /** Focus of expansion: the screen point the camera travels toward, 0..1 of the frame. */
  fx: number; fy: number;
};

export const REST_DEPTH_CAMERA: Readonly<DepthCamera> = {z: 0, x: 0, y: 0, roll: 0, fx: .5, fy: .5};

/** Screen scale and shift of a plane at `depth` (1 = the backdrop) seen from `cam`. Nearer planes grow faster. */
export function projectPlane(depth: number, cam: DepthCamera) {
  const gap = Math.max(1e-3, depth - cam.z);
  return {scale: depth / gap, dx: -cam.x / gap, dy: -cam.y / gap};
}

/** Where a point authored on a plane (stage px at rest) lands on screen, and the plane's scale there. */
export function planeToScreen(px: number, py: number, depth: number, cam: DepthCamera, config: DepthConfig) {
  const {scale, dx, dy} = projectPlane(depth, cam);
  const fx = cam.fx * config.width, fy = cam.fy * config.height;
  const x = (px - fx) * scale + dx, y = (py - fy) * scale + dy;
  const c = Math.cos(cam.roll), s = Math.sin(cam.roll);
  return {x: fx + x * c - y * s, y: fy + x * s + y * c, scale};
}

export type PlaneDraw = {
  depth: number;
  /** Extra uniform scale around the plane's own anchor (a plane that grows by itself). */
  grow?: number; anchorX?: number; anchorY?: number;
  /** Extra shift in screen px (a plane that moves by itself). */
  shiftX?: number; shiftY?: number;
  /** Extra rotation of the plane around its anchor, radians. */
  turn?: number;
  /** Overscan: the picture scaled about its own centre before everything else, so a plate keeps covering the frame
   * under the camera and its look. coveredPlate sets it. */
  cover?: number;
  alpha?: number;
  /** Gaussian blur in stage px (depth of field, a plane passing the lens). */
  blur?: number;
  op?: GlobalCompositeOperation;
};

/** Plane space (the picture at rest, stage px) → screen, for this camera and the plane's own motion. */
export function planeMatrix(cam: DepthCamera, p: PlaneDraw, config: DepthConfig): Affine {
  const {scale, dx, dy} = projectPlane(p.depth, cam);
  const fx = cam.fx * config.width, fy = cam.fy * config.height;
  const ax = p.anchorX ?? config.width / 2, ay = p.anchorY ?? config.height / 2;
  const W = config.width, H = config.height, cover = p.cover ?? 1;
  return affine()
    .translate(fx, fy).rotate(cam.roll).translate(dx + (p.shiftX ?? 0), dy + (p.shiftY ?? 0)).scale(scale).translate(-fx, -fy)
    .translate(ax, ay).rotate(p.turn ?? 0).scale(p.grow ?? 1).translate(-ax, -ay)
    .translate(W / 2, H / 2).scale(cover).translate(-W / 2, -H / 2)
    .done();
}

/** Overscan (about the picture's centre, see PlaneDraw.cover) a full-frame plate needs to keep covering the screen
 * under this camera and its own look: rolls, sideways travel, pull-backs, a turn or a grow below 1 would otherwise
 * reveal its edges. Includes a hair of margin for the stopmotion jitter of the finish. 1 when it already covers, and
 * continuous as the camera moves, so a plate never pops when it starts to need it. */
export function coverScale(cam: DepthCamera, p: PlaneDraw, config: DepthConfig): number {
  const {width: W, height: H} = config;
  const inv = invert(planeMatrix(cam, {...p, cover: 1}, config));
  let k = 0;
  for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) {
    const q = apply(inv, x, y);
    k = Math.max(k, Math.abs(q.x - W / 2) / (W / 2), Math.abs(q.y - H / 2) / (H / 2));
  }
  return Math.max(1, k * 1.004);
}

/** The draw of a plate with its cover scale folded in. Its look (grow, turn, shift about its own anchor) is kept. */
export function coveredPlate(cam: DepthCamera, p: PlaneDraw, config: DepthConfig): PlaneDraw {
  return {...p, cover: coverScale(cam, p, config)};
}

/** Draw a full-frame plane picture (authored at the stage size) through the camera. `scale` is output pixels per
 * stage pixel (the canvas is the output); the picture may have any resolution, it is stretched over the stage. */
export function drawPlane(ctx: CanvasRenderingContext2D, picture: CanvasImageSource, cam: DepthCamera, p: PlaneDraw,
  config: DepthConfig, scale = 1) {
  if ((p.alpha ?? 1) <= .001) return;
  ctx.save();
  ctx.setTransform(multiply({a: scale, b: 0, c: 0, d: scale, e: 0, f: 0}, planeMatrix(cam, p, config)));
  ctx.globalAlpha = p.alpha ?? 1;
  if (p.op) ctx.globalCompositeOperation = p.op;
  // Canvas filters are measured in output pixels, not in the transformed space.
  if (p.blur && p.blur * scale > .3) ctx.filter = `blur(${(p.blur * scale).toFixed(2)}px)`;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(picture, 0, 0, config.width, config.height);
  ctx.restore();
}

/** Depth-of-field blur (stage px) of a plane at `depth`: the circle of confusion grows with |1/d − 1/f|, where d and
 * f are the distances from the lens to the plane and to the focus plane. `aperture` is the blur per unit of that
 * difference; `cap` limits it. */
export function defocusBlur(depth: number, focus: number, camZ: number, aperture: number, cap = Infinity): number {
  const d = Math.max(.03, depth - camZ), f = Math.max(.03, focus - camZ);
  return Math.min(cap, aperture * Math.abs(1 / d - 1 / f));
}
