// Motes: dust in the light, embers over a fire, specks in the dark. Each one lives at its own depth and is projected
// through the shot's camera, so motes are the strongest depth cue a shot has: near ones stream past the lens as the
// camera travels, far ones barely move, and anything off the focus plane opens into soft bokeh.
import {depthUnit, type DepthConfig} from './config';
import {peripheryWeight} from './mask';
import {fbm, hash} from './noise';
import {planeToScreen, type DepthCamera} from './stage';

export type DepthMotes = {
  seed: number;
  count: number;
  /** Plane depths the motes are spread over (1 = the backdrop). */
  depth: [number, number];
  /** Spawn box on the rest plane (stage px: x0, y0, x1, y1); drifting motes wrap around inside it.
   * Default: the frame plus a quarter on every side. */
  box?: [number, number, number, number];
  /** Radius in stage px at depth 1. */
  size: [number, number];
  /** Drift in stage px per second. */
  drift: [number, number];
  /** Wander amplitude in stage px (default 20 on a 1080p stage). */
  wander?: number;
  color: [number, number, number];
  alpha: [number, number];
  /** Depth in focus; bokeh grows with the distance from it. The shot's focus overrides it while it has one. */
  focus: number;
  /** How fast motes open into bokeh away from the focus depth (default 3). */
  bokeh?: number;
  /** Embers: rise and flicker. */
  ember?: boolean;
  /** Ember rise speed range in stage px per second (default 28–73 on a 1080p stage). */
  rise?: [number, number];
  /** Fade in and out over this window (film seconds, 0.6 s fades). */
  window?: [number, number];
  /** Keep these motes at the edges of the frame (peripheryWeight): for near specks that fly past the lens, so they
   * never cross the copy. Use a separate field for them. */
  periphery?: boolean;
};

/** Warm dust in sunlight, sized for a 1920 × 1080 stage. Pass count, depths and focus; override anything else. */
export function dustMotes(o: Pick<DepthMotes, 'seed' | 'count' | 'depth' | 'focus'> & Partial<DepthMotes>): DepthMotes {
  return {size: [1.5, 4.25], drift: [8, -5], wander: 22, color: [255, 228, 188], alpha: [.18, .62], bokeh: 3.2, ...o};
}

/** Embers rising from a fire (set `box` over the fire), sized for a 1920 × 1080 stage. */
export function emberMotes(o: Pick<DepthMotes, 'seed' | 'count' | 'depth' | 'focus'> & Partial<DepthMotes>): DepthMotes {
  return {ember: true, size: [1.5, 3.5], drift: [9, 0], wander: 18, color: [255, 150, 60], alpha: [.35, .85], bokeh: 2.5, ...o};
}

let sprite: HTMLCanvasElement | null = null;
let disc: HTMLCanvasElement | null = null;
function sprites() {
  if (sprite && disc) return {sprite, disc};
  const make = (profile: (r: number) => number) => {
    const s = 128, c = Object.assign(document.createElement('canvas'), {width: s, height: s});
    const ctx = c.getContext('2d')!, img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const r = Math.hypot(x - s / 2 + .5, y - s / 2 + .5) / (s / 2);
      const a = Math.max(0, Math.min(1, profile(r)));
      const i = (y * s + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  };
  // In focus: a bright core with a soft falloff. Out of focus: a flat disc with a slightly brighter rim.
  sprite = make(r => Math.exp(-r * r * 9) * .85 + Math.exp(-r * r * 2.2) * .35 - .02);
  disc = make(r => r > 1 ? 0 : (.55 + .25 * Math.pow(r, 6)) * (1 - Math.pow(Math.max(0, (r - .86) / .14), 2)));
  return {sprite, disc};
}

const tints = new Map<string, HTMLCanvasElement>();
function tinted(src: HTMLCanvasElement, r: number, g: number, b: number) {
  const key = `${src === disc ? 'd' : 's'}${r},${g},${b}`;
  const hit = tints.get(key);
  if (hit) return hit;
  const c = Object.assign(document.createElement('canvas'), {width: src.width, height: src.height});
  const ctx = c.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, c.width, c.height);
  if (tints.size > 64) tints.delete(tints.keys().next().value!);
  tints.set(key, c);
  return c;
}

/** Fade of a mote field at time t (0 outside its window). */
export function motesFade(m: DepthMotes, t: number): number {
  if (!m.window) return 1;
  const [a, b] = m.window;
  return Math.min(1, Math.max(0, (t - a) / .6), Math.max(0, (b - t) / .6));
}

/** Draw a mote field at film time t through `cam` (added as light, 'screen'). `scale`: output px per stage px. */
export function drawMotes(ctx: CanvasRenderingContext2D, m: DepthMotes, t: number, cam: DepthCamera, config: DepthConfig, scale = 1) {
  const fade = motesFade(m, t);
  if (fade <= 0) return;
  const {width: W, height: H} = config;
  const unit = depthUnit(config);
  const {sprite: core, disc: bokeh} = sprites();
  const [x0, y0, x1, y1] = m.box ?? [-W * .25, -H * .25, W * 1.25, H * 1.25];
  const bw = x1 - x0, bh = y1 - y0;
  const wander = m.wander ?? 20 * unit;
  const [rise0, rise1] = m.rise ?? [28 * unit, 73 * unit];
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = 'none';
  for (let i = 0; i < m.count; i++) {
    const r0 = hash(i, 1, m.seed), r1 = hash(i, 2, m.seed), r2 = hash(i, 3, m.seed), r3 = hash(i, 4, m.seed), r4 = hash(i, 5, m.seed);
    const depth = m.depth[0] + (m.depth[1] - m.depth[0]) * Math.pow(r2, .8);
    if (depth - cam.z < .04) continue;
    const size = m.size[0] + (m.size[1] - m.size[0]) * r3 * r3;
    const rise = m.ember ? rise0 + (rise1 - rise0) * r4 : 0;
    let x = x0 + r0 * bw + m.drift[0] * t + (fbm(i * 13.1 + t * 1.6, 3.7, m.seed) - .5) * 2 * wander;
    let y = y0 + r1 * bh + (m.drift[1] - rise) * t + (fbm(7.3, i * 11.7 + t * 1.6, m.seed + 1) - .5) * 2 * wander;
    x = x0 + (((x - x0) % bw) + bw) % bw;
    y = y0 + (((y - y0) % bh) + bh) % bh;
    const p = planeToScreen(x, y, depth, cam, config);
    const defocus = Math.abs(depth - m.focus) * (m.bokeh ?? 3);
    const radius = size * p.scale * (1 + defocus * 1.6);
    if (p.x < -radius || p.y < -radius || p.x > W + radius || p.y > H + radius) continue;
    let alpha = (m.alpha[0] + (m.alpha[1] - m.alpha[0]) * r4) * fade / (1 + defocus * 1.1);
    if (m.ember) alpha *= .55 + .45 * Math.sin(t * (5 + 4 * r0) + r1 * 6.28);
    // Motes very near the lens thin out rather than filling the frame.
    alpha *= Math.min(1, (depth - cam.z) / .14);
    if (m.periphery) alpha *= peripheryWeight(p.x / W, p.y / H);
    if (alpha < .01) continue;
    const [cr, cg, cb] = m.color;
    ctx.globalAlpha = alpha;
    ctx.drawImage(tinted(defocus > .35 ? bokeh : core, cr, cg, cb), p.x - radius, p.y - radius, radius * 2, radius * 2);
  }
  ctx.restore();
}
