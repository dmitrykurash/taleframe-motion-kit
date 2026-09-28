// Ink typography composed into a depth film.
//
// A line of copy is one or more groups. Each group is a phrase with its own size, place, timing and slow drift: big
// or small, together or apart, set around the subject so the type frames the picture instead of covering it (a
// phrase top left drifting right while its answer arrives bottom right drifting left, the subject between them).
// Every group approaches the viewer a little for its whole life (a steady exponential zoom about its pivot), words
// surface out of the depth while a ragged wet front inks them in, and groups leave by lifting away like pigment (or
// rising in arcs, or rushing past the lens).
//
// Nothing is set in the outer 10% of the frame: every visible word's real ink box, after the group's drift and
// approach and the word's own gesture, is checked on every frame, and any excursion is logged as a SAFEAREA console
// error. Draw type on the live clock so its drift is continuous.
import {affine, apply, multiply, type Affine, type Point} from './affine';
import {depthUnit, type DepthConfig} from './config';
import {bloomMask, dissolveMask, sweepMask} from './mask';
import {clamp01, easeInOutCubic, easeInQuad, easeOutCubic} from './noise';

export type InkFont = {family: string; weight?: number | string; style?: 'normal' | 'italic'};
/** Instrument Serif Regular, which the kit installs with Fontsource (src/index.tsx imports it). */
export const INK_FONT: Readonly<InkFont> = {family: 'Instrument Serif', weight: 400, style: 'normal'};
export const inkFontString = (font: InkFont, size: number) =>
  `${font.style === 'italic' ? 'italic ' : ''}${font.weight ?? 400} ${size}px "${font.family}"`;

/** How ink arrives: a wet front sweeping left to right, a drop blooming from the word's middle, or a stamp from
 * near the lens. */
export type InkReveal = 'ink' | 'bloom' | 'stamp';
/** How a group leaves: pigment lifting off (upward), dissolving in place, rising in arcs, or rushing past the lens
 * (a full-frame gesture, exempt from the safe area while it leaves). */
export type InkExit = 'lift' | 'dissolve' | 'flight' | 'rush';
export type InkEmphasis = {word: number; kind: 'glint'; /** Seconds after the group starts. */ at?: number};

export type InkGroup = {
  /** The rows of the phrase (a string is one row). */
  text: string | string[];
  /** Anchor at the group's start, stage px: x per `align` (left edge, centre or right edge), y = first baseline. */
  x: number; y: number;
  align?: 'left' | 'center' | 'right';
  /** Font size in stage px (default 11% of the stage height), row spacing in em, tracking in em. */
  size?: number; lineHeight?: number; tracking?: number;
  /** Seconds after the line starts. */
  delay?: number;
  /** Steady drift over the group's life, stage px. */
  drift?: [number, number];
  /** Approach toward the viewer over the group's life (scale at the end ÷ scale at the start, default 1.1). */
  growth?: number;
  /** Centre of that approach: a point (groups sharing a baseline share one), or the group's left or right edge (so a
   * group set against a border grows away from it). Default: the group's own centre. */
  pivot?: [number, number] | 'left' | 'right';
  reveal?: InkReveal;
  /** 'depth' (default): words surface out of the depth. 'right': they also slide in a little from the right. */
  arrive?: 'depth' | 'right';
  exit?: InkExit;
  /** A soft, wide darkening behind the group (0..1), for type over bright paper or sky. */
  scrim?: number;
  emphasis?: InkEmphasis[];
  font?: Partial<InkFont>;
  color?: string;
  /** false exempts the group from the safe-area check: only for a deliberate full-frame effect or an off-screen
   * entrance. */
  safeArea?: boolean;
};

export type InkLine = {
  /** Film seconds on the live clock. */
  start: number; end: number;
  groups: InkGroup[];
  /** Plane depth of the copy: planes of the shot nearer than this pass in front of it. */
  depth?: number;
  /** How strongly those nearer planes hide the copy (0 = never, 1 = fully). */
  occlusion?: number;
  seed?: number;
  /** Seconds each word takes to ink in (0.95), the delay between words (0.12) and the exit length. */
  inDur?: number; stagger?: number; outDur?: number;
  font?: Partial<InkFont>;
  color?: string;
  scrimColor?: [number, number, number];
};

/** Real ink extents of a string: advance width, ink left/right of the origin, ink above/below the baseline. */
export type InkMetrics = {width: number; left: number; right: number; ascent: number; descent: number};
export type InkMeasure = (text: string, font: string, tracking: number) => InkMetrics;

let measurer: CanvasRenderingContext2D | null = null;
const measured = new Map<string, InkMetrics>();
/** Canvas text metrics (actualBoundingBox*), cached. The font must be loaded (loadInkFonts). */
export const canvasMeasure: InkMeasure = (text, font, tracking) => {
  const key = `${font}|${tracking}|${text}`;
  const hit = measured.get(key);
  if (hit) return hit;
  measurer ??= document.createElement('canvas').getContext('2d')!;
  measurer.font = font;
  (measurer as CanvasRenderingContext2D & {letterSpacing: string}).letterSpacing = `${tracking}px`;
  const m = measurer.measureText(text);
  const out = {width: m.width, left: m.actualBoundingBoxLeft, right: m.actualBoundingBoxRight,
    ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent};
  if (measured.size > 2000) measured.clear();
  measured.set(key, out);
  return out;
};

export type InkWord = {
  text: string; row: number; x: number; width: number; index: number;
  /** The word's real ink: left and right of its origin, above and below its baseline. */
  ink: {left: number; right: number; ascent: number; descent: number};
};
export type InkLayout = {
  words: InkWord[]; rows: string[]; rowWidths: number[];
  /** Per row: ink left and right of the row's origin (the origin is the row's left edge by advance). */
  inkLeft: number[]; inkRight: number[];
  /** Ink above the first baseline and below the last one. */
  ascent: number; descent: number;
  size: number; lh: number; width: number; tracking: number; font: string;
};

export type InkOptions = {config: DepthConfig; font?: InkFont; measure?: InkMeasure};

const fontOf = (line: InkLine, g: InkGroup, base: InkFont = INK_FONT): InkFont => ({...base, ...line.font, ...g.font});

/** Words, rows and the real ink extents of a group. */
export function inkLayout(line: InkLine, g: InkGroup, o: InkOptions): InkLayout {
  const measure = o.measure ?? canvasMeasure;
  const rows = typeof g.text === 'string' ? [g.text] : g.text;
  if (!rows.length) throw new Error('An ink group needs at least one row of text.');
  const size = g.size ?? o.config.height * .11, lh = size * (g.lineHeight ?? 1.12), tracking = (g.tracking ?? 0) * size;
  const font = inkFontString(fontOf(line, g, o.font), size);
  const space = measure(' ', font, tracking).width;
  const words: InkWord[] = [], rowWidths: number[] = [], inkLeft: number[] = [], inkRight: number[] = [];
  let index = 0;
  rows.forEach((row, r) => {
    let x = 0;
    row.split(' ').forEach((w, i, all) => {
      const m = measure(w, font, tracking);
      words.push({text: w, row: r, x, width: m.width, index: index++,
        ink: {left: m.left, right: m.right, ascent: m.ascent, descent: m.descent}});
      x += m.width + (i < all.length - 1 ? space : 0);
    });
    rowWidths.push(x);
    const m = measure(row, font, tracking);
    inkLeft.push(m.left); inkRight.push(m.right);
  });
  const first = measure(rows[0], font, tracking), last = measure(rows[rows.length - 1], font, tracking);
  return {words, rows, rowWidths, inkLeft, inkRight, ascent: first.ascent, descent: last.descent, size, lh,
    width: Math.max(...rowWidths), tracking, font};
}

/** Left edge of a row given the group's alignment and its current anchor x. */
export function rowLeft(g: InkGroup, ax: number, rowWidth: number) {
  const a = g.align ?? 'center';
  return a === 'left' ? ax : a === 'right' ? ax - rowWidth : ax - rowWidth / 2;
}

const OUT_STAGGER = .04;
/** In and out timing of a group of n words. */
export function inkTiming(line: InkLine, g: InkGroup, n: number) {
  const inDur = line.inDur ?? .95, stagger = line.stagger ?? .12;
  const exit = g.exit ?? 'lift';
  const outDur = line.outDur ?? (exit === 'flight' ? .85 : exit === 'rush' ? .5 : .6);
  const outStart = line.end - outDur - OUT_STAGGER * (n - 1);
  return {inDur, stagger, outDur, outStart, exit, outStagger: OUT_STAGGER};
}

export type InkBox = {left: number; right: number; top: number; bottom: number};

/** The group's placement at time t: its drifted anchor, its real ink box, its approach scale k and the pivot. */
export function inkPlacement(line: InkLine, g: InkGroup, L: InkLayout, t: number) {
  const g0 = line.start + (g.delay ?? 0);
  const u = clamp01((t - g0) / Math.max(1e-6, line.end - g0));
  const [dx, dy] = g.drift ?? [0, 0];
  const ax = g.x + dx * u, ay = g.y + dy * u;
  let left = Infinity, right = -Infinity;
  L.rowWidths.forEach((w, r) => {
    const x = rowLeft(g, ax, w);
    left = Math.min(left, x - L.inkLeft[r]);
    right = Math.max(right, x + L.inkRight[r]);
  });
  const box: InkBox = {left, right, top: ay - L.ascent, bottom: ay + (L.rows.length - 1) * L.lh + L.descent};
  const cy = (box.top + box.bottom) / 2;
  const [px, py] = g.pivot === 'left' ? [box.left, cy] : g.pivot === 'right' ? [box.right, cy]
    : g.pivot ? [g.pivot[0] + dx * u, g.pivot[1] + dy * u] : [(box.left + box.right) / 2, cy];
  return {ax, ay, k: Math.pow(g.growth ?? 1.1, u - .5), px, py, box, g0, u};
}

/** How far the group has left (0..1) at time t. */
export function inkLeaving(line: InkLine, g: InkGroup, L: InkLayout, t: number) {
  const {outStart, outDur} = inkTiming(line, g, L.words.length);
  return clamp01((t - outStart) / (outDur + OUT_STAGGER * (L.words.length - 1)));
}

export type InkPlacement = ReturnType<typeof inkPlacement>;

/** One word at time t. Where its padded picture sits before any motion (x0, y0, width, height, stage px; the glyphs'
 * origin is at pad, baseline inside it), and its own gesture about that picture's centre (cx, cy): the shift, turn
 * and scale of surfacing, a stamp, the arrive-right slide, a flight, a lift or a rush. Also its opacity, blur (stage
 * px), ink-in progress `pin` (past 1 once settled) and exit progress `out` (0..1). */
export type InkWordPose = {
  x0: number; y0: number; width: number; height: number; pad: number; baseline: number; cx: number; cy: number;
  dx: number; dy: number; turn: number; scale: number;
  alpha: number; blur: number; pin: number; out: number;
};

/** The pose of one word at time t, or null before it starts to ink in and after it has left. The one description of
 * a word's motion: drawGroup draws with it and the safe-area check measures with it. */
export function inkWordPose(line: InkLine, g: InkGroup, L: InkLayout, w: InkWord, t: number, config: DepthConfig,
  P: InkPlacement = inkPlacement(line, g, L, t)): InkWordPose | null {
  const {inDur, stagger, outDur, outStart, exit} = inkTiming(line, g, L.words.length);
  const i = w.index, size = L.size, unit = depthUnit(config);
  const pin = (t - P.g0 - i * stagger) / inDur;
  if (pin <= 0) return null;
  const out = clamp01((t - (outStart + i * OUT_STAGGER)) / outDur);
  if (out >= 1) return null;
  const pad = Math.round(size * .45);
  const width = Math.ceil(w.width + pad * 2), height = Math.ceil(size * 1.5 + pad);
  const baseline = pad * .5 + size * 1.02;
  const x0 = rowLeft(g, P.ax, L.rowWidths[w.row]) + w.x - pad;
  const y0 = P.ay + w.row * L.lh - baseline;
  const cx = x0 + width / 2, cy = y0 + height / 2;

  // The word surfaces out of the depth: a little smaller, soft and faint, settling into place.
  let a = easeOutCubic(pin), scale = 1 + (.93 - 1) * (1 - a), dx = 0, dy = 0, turn = 0;
  let blur = 6 * unit * Math.pow(1 - a, 1.5);
  let alpha = clamp01(pin * 2.2);
  if ((g.reveal ?? 'ink') === 'stamp') {
    // Stamped down from near the lens: large and soft, landing quickly.
    a = easeOutCubic(pin * 1.4);
    scale = 1 + .45 * (1 - a); blur = 7 * unit * (1 - a); alpha = clamp01(pin * 3);
  }
  if (g.arrive === 'right') dx += size * .35 * (1 - a);
  if (out > 0) {
    const lift = easeInQuad(out);
    if (exit === 'flight') {
      // Rising in arcs, each word in its own time, as if caught by the wind.
      dy -= size * (.55 + .25 * ((i * 37) % 7) / 7) * lift;
      dx += size * (.18 + .1 * ((i * 53) % 5) / 5) * lift;
      turn = -(.04 + .03 * ((i * 29) % 3)) * lift;
      alpha *= 1 - easeInQuad(Math.max(0, out - .25) / .75);
    } else if (exit === 'rush') {
      // Rushing past the lens: spreading from the frame centre, growing, softening.
      const s = 1 + 1.7 * lift;
      dx += (cx - config.width / 2) * (s - 1); dy += (cy - config.height / 2) * (s - 1);
      scale *= s; alpha *= 1 - easeInQuad(out);
    } else if (exit === 'lift') {
      scale *= 1 + .05 * lift; alpha *= 1 - lift;
    } else {
      alpha *= 1 - lift;
    }
    blur += (exit === 'rush' ? 9 : 7) * unit * out;
  }
  return {x0, y0, width, height, pad, baseline, cx, cy, dx, dy, turn, scale, alpha, blur, pin, out};
}

/** A word's picture (stage px, before motion) → the screen (stage px): its own gesture about its centre, inside the
 * group's approach about the pivot. */
export function inkWordMatrix(P: InkPlacement, pose: InkWordPose): Affine {
  return affine()
    .translate(P.px, P.py).scale(P.k).translate(-P.px, -P.py)
    .translate(pose.cx + pose.dx, pose.cy + pose.dy).rotate(pose.turn).scale(pose.scale).translate(-pose.cx, -pose.cy)
    .done();
}

/** Below this opacity a word is not read as type yet (or any more), and the safe area ignores it. */
export const INK_VISIBLE_ALPHA = .05;

/** The corners of every visible word's real ink box on screen at time t (stage px): after the group's drift and
 * approach and the word's own gesture (surfacing, stamp, arrive-right slide, flight, lift, rush). Words fainter than
 * INK_VISIBLE_ALPHA are left out. */
export function inkCorners(line: InkLine, g: InkGroup, L: InkLayout, t: number, config: DepthConfig): Point[] {
  const P = inkPlacement(line, g, L, t);
  const corners: Point[] = [];
  if (t < P.g0) return corners;
  for (const w of L.words) {
    const pose = inkWordPose(line, g, L, w, t, config, P);
    if (!pose || pose.alpha < INK_VISIBLE_ALPHA) continue;
    const m = inkWordMatrix(P, pose);
    const ox = pose.x0 + pose.pad, by = pose.y0 + pose.baseline;
    const left = ox - w.ink.left, right = ox + w.ink.right, top = by - w.ink.ascent, bottom = by + w.ink.descent;
    for (const [x, y] of [[left, top], [right, top], [left, bottom], [right, bottom]]) corners.push(apply(m, x, y));
  }
  return corners;
}

/** The bounding box of some points (for reports). */
export function pointsBox(points: readonly Point[]): InkBox {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  return {left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys)};
}

export type SafeArea = {x0: number; y0: number; x1: number; y1: number};
/** The type-safe rectangle: `margin` (default 10%) of the stage kept free of type on every side. */
export const safeArea = (config: DepthConfig, margin = .1): SafeArea =>
  ({x0: config.width * margin, y0: config.height * margin, x1: config.width * (1 - margin), y1: config.height * (1 - margin)});

/** True when every point lies inside the safe area (with a half-pixel tolerance). */
export function checkSafeArea(points: readonly Point[], area: SafeArea, tolerance = .5): boolean {
  return points.every(p => p.x >= area.x0 - tolerance && p.x <= area.x1 + tolerance && p.y >= area.y0 - tolerance && p.y <= area.y1 + tolerance);
}

/** Whether the safe area applies to a group at time t: not for opted-out groups, nor for a rush once it leaves (a
 * full-frame gesture). Every other gesture is checked, word by word (inkCorners). */
export function inkSafeAreaApplies(line: InkLine, g: InkGroup, L: InkLayout, t: number) {
  if (g.safeArea === false || t < line.start + (g.delay ?? 0) || t > line.end) return false;
  return !((g.exit ?? 'lift') === 'rush' && inkLeaving(line, g, L, t) > 0);
}

export type SafeAreaViolation = {text: string; t: number; corners: Point[]};

/** Scan lines over their whole lives (every `step` seconds, default one frame) and list every moment a visible
 * word's ink box leaves the safe area. Pass `measure` to run it without a browser. */
export function safeAreaViolations(lines: readonly InkLine[], o: InkOptions & {step?: number; margin?: number}): SafeAreaViolation[] {
  const area = safeArea(o.config, o.margin);
  const step = o.step ?? 1 / o.config.fps;
  const out: SafeAreaViolation[] = [];
  for (const line of lines) for (const g of line.groups) {
    const L = inkLayout(line, g, o);
    for (let t = line.start; t <= line.end + 1e-9; t += step) {
      if (!inkSafeAreaApplies(line, g, L, t)) continue;
      const corners = inkCorners(line, g, L, t, o.config);
      if (!checkSafeArea(corners, area)) out.push({text: L.rows.join(' / '), t, corners});
    }
  }
  return out;
}

const loadedFonts = new Map<string, Promise<void>>();
/** Load every face the lines use before drawing them on a canvas (canvas text does not wait for fonts). */
export function loadInkFonts(lines: readonly InkLine[], base: InkFont = INK_FONT): Promise<void> {
  const fonts = new Set<string>();
  for (const line of lines) for (const g of line.groups) fonts.add(inkFontString(fontOf(line, g, base), 100));
  return Promise.all([...fonts].map(font => {
    let pending = loadedFonts.get(font);
    if (!pending) {
      pending = document.fonts.load(font).then(faces => {
        if (!faces.length) throw new Error(`The ink type font did not load: ${font}. Import it (Fontsource) or add a @font-face.`);
      });
      pending.catch(() => loadedFonts.delete(font));
      loadedFonts.set(font, pending);
    }
    return pending;
  })).then(() => undefined);
}

let wordCanvas: HTMLCanvasElement | null = null;
let glowCanvas: HTMLCanvasElement | null = null;

export type DrawInkOptions = InkOptions & {
  /** Output px per stage px (default 1). */
  scale?: number;
  /** Log SAFEAREA violations (default true). */
  checkSafeArea?: boolean;
};

/** Draw a line of copy at film time t (seconds, live clock) onto an output-size canvas. */
export function drawInkLine(ctx: CanvasRenderingContext2D, line: InkLine, t: number, o: DrawInkOptions) {
  if (t < line.start || t > line.end) return;
  line.groups.forEach((g, gi) => drawGroup(ctx, line, g, gi, t, o));
}

function drawGroup(ctx: CanvasRenderingContext2D, line: InkLine, g: InkGroup, gi: number, t: number, o: DrawInkOptions) {
  const {config} = o;
  const scale = o.scale ?? 1, unit = depthUnit(config);
  const L = inkLayout(line, g, o);
  const {words, size} = L;
  const exit = g.exit ?? 'lift', reveal = g.reveal ?? 'ink';
  const P = inkPlacement(line, g, L, t);
  if (t < P.g0) return;
  const tau = t - P.g0;
  const seed = (line.seed ?? 1) * 7 + gi;
  const base = {a: scale, b: 0, c: 0, d: scale, e: 0, f: 0};
  // The whole group: approach about its pivot (steady, toward the viewer).
  const block = multiply(base, affine().translate(P.px, P.py).scale(P.k).translate(-P.px, -P.py).done());

  if (o.checkSafeArea !== false && inkSafeAreaApplies(line, g, L, t)) {
    const corners = inkCorners(line, g, L, t, config);
    if (!checkSafeArea(corners, safeArea(config))) {
      const b = pointsBox(corners);
      console.error(`SAFEAREA "${L.rows.join(' / ')}" t=${t.toFixed(2)} box=${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.right)},${Math.round(b.bottom)}`);
    }
  }

  if (g.scrim) {
    // A burn-in behind the words, like a printer's darkened ground: wide, soft, never a box.
    const s = g.scrim * Math.min(1, tau / .5, Math.max(0, line.end - t) / .5);
    const [r, gg, b] = line.scrimColor ?? [12, 9, 6];
    const cx = (P.box.left + P.box.right) / 2, cy = (P.box.top + P.box.bottom) / 2;
    ctx.save();
    ctx.setTransform(block);
    ctx.translate(cx, cy);
    ctx.scale((L.width / 2 + size * 1.4) / 100, ((P.box.bottom - P.box.top) / 2 + size * .9) / 100);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 100);
    grad.addColorStop(0, `rgba(${r},${gg},${b},${(.42 * s).toFixed(3)})`);
    grad.addColorStop(.55, `rgba(${r},${gg},${b},${(.26 * s).toFixed(3)})`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, 100, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  wordCanvas ??= document.createElement('canvas');
  const color = g.color ?? line.color ?? '#ffffff';
  for (const w of words) {
    const pose = inkWordPose(line, g, L, w, t, config, P);
    if (!pose) continue;
    const i = w.index, {pin, out, x0, y0, width: bw, height: bh} = pose;

    // The word at output resolution, masked by its ink front and its exit.
    const cw = Math.max(1, Math.ceil(bw * scale)), ch = Math.max(1, Math.ceil(bh * scale));
    wordCanvas.width = cw; wordCanvas.height = ch;
    const wc = wordCanvas.getContext('2d')!;
    wc.setTransform(scale, 0, 0, scale, 0, 0);
    wc.font = L.font;
    (wc as CanvasRenderingContext2D & {letterSpacing: string}).letterSpacing = `${L.tracking}px`;
    wc.fillStyle = color;
    wc.fillText(w.text, pose.pad, pose.baseline);
    wc.setTransform(1, 0, 0, 1, 0, 0);
    const mw = Math.max(8, bw >> 2), mh = Math.max(8, bh >> 2);
    if (pin < 1.2 && reveal !== 'stamp') {
      const m = reveal === 'bloom'
        ? bloomMask({width: mw, height: mh, cx: .5, cy: .52, radius: easeOutCubic(pin) * 1.3, aspect: Math.max(1, bw / bh * .55),
          feather: .22, ragged: .38, scale: 26, seed: seed * 19 + i})
        : sweepMask({width: mw, height: mh, progress: easeInOutCubic(pin * 1.08), feather: .1, ragged: .16, scale: 3.2, seed: seed * 31 + i});
      wc.globalCompositeOperation = 'destination-in'; wc.drawImage(m, 0, 0, cw, ch); wc.globalCompositeOperation = 'source-over';
    }
    if (out > 0 && exit !== 'rush') {
      // Pigment lifting off as the word leaves (evenly, in place, for a dissolve).
      const m = dissolveMask({width: mw, height: mh, progress: out * .85, feather: .16, scale: 5, seed: seed * 17 + i, lift: exit === 'dissolve' ? 0 : .3});
      wc.globalCompositeOperation = 'destination-in'; wc.drawImage(m, 0, 0, cw, ch); wc.globalCompositeOperation = 'source-over';
    }

    // The word's own gesture (inkWordPose), inside the group's approach.
    const place = multiply(base, inkWordMatrix(P, pose));
    ctx.save();
    ctx.setTransform(place);
    ctx.globalAlpha = pose.alpha;
    // Shadows and filters are measured in output pixels.
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 24 * unit * scale; ctx.shadowOffsetY = 4 * unit * scale;
    if (pose.blur * scale > .4) ctx.filter = `blur(${(pose.blur * scale).toFixed(2)}px)`;
    ctx.drawImage(wordCanvas, x0, y0, bw, bh);
    ctx.restore();

    const emph = g.emphasis?.find(e => e.word === i);
    if (emph?.kind === 'glint') {
      // A glint of light crossing the word (metal catching the light).
      const gl = (tau - (emph.at ?? 1)) / .7;
      if (gl > 0 && gl < 1) {
        glowCanvas ??= document.createElement('canvas');
        glowCanvas.width = cw; glowCanvas.height = ch;
        const gc = glowCanvas.getContext('2d')!;
        gc.drawImage(wordCanvas, 0, 0);
        gc.globalCompositeOperation = 'source-in';
        const band = (-bw * .35 + gl * bw * 1.7) * scale;
        const grad = gc.createLinearGradient(band - size * .6 * scale, ch, band + size * .6 * scale, 0);
        grad.addColorStop(0, 'rgba(255,236,200,0)'); grad.addColorStop(.5, 'rgba(255,240,214,1)'); grad.addColorStop(1, 'rgba(255,236,200,0)');
        gc.fillStyle = grad; gc.fillRect(0, 0, cw, ch);
        ctx.save();
        ctx.setTransform(place);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = .55 * Math.sin(Math.PI * gl) * pose.alpha;
        ctx.filter = `blur(${(7 * unit * scale).toFixed(2)}px)`;
        ctx.drawImage(glowCanvas, x0, y0, bw, bh);
        ctx.filter = `blur(${(1.5 * unit * scale).toFixed(2)}px)`;
        ctx.drawImage(glowCanvas, x0, y0, bw, bh);
        ctx.restore();
      }
    }
  }
}
