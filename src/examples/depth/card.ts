// A render-status card for the Painted-Depth example: a UI layer in depth drawn by a pure function of time.
// It opens in a checking state, adds its checks one by one (the card grows taller with its top fixed, each row
// spins, then settles), settles on "Ready to film", and the camera dives through its status badge.
import {uiDrawing, type DepthUIPose, type DepthUISource} from '../../kit';

export type StatusCardOptions = {
  /** Film second the card starts to arrive. */
  start: number;
  title: string;
  /** Shown while checking, and once every row has settled. */
  checking: string;
  ready: string;
  /** One row per check, with an optional muted detail on the right. */
  rows: readonly {label: string; detail?: string}[];
  /** Top-left corner and width, stage px. */
  x: number; y: number; width: number;
  /** Seconds before the first row, and between rows. */
  lead?: number; step?: number;
};

const FAMILY = '"DM Sans Variable", "DM Sans", sans-serif';
const INK = '#2a211a', MUTED = '#86776a', PAPER = 'rgba(248,243,234,.965)', RULE = 'rgba(42,33,26,.08)';
const AMBER = '#d08a3c', SAGE = '#4c7a5f';
const HEADER = 104, ROW = 60, FOOT = 18, BADGE = 26;
const SPIN = .38, SETTLE = .22;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
const easeInOut = (v: number) => {const t = clamp01(v); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;};
/** A small overshoot for the check settling in. */
const easeBack = (v: number) => {const t = clamp01(v) - 1, k = 1.8; return 1 + (k + 1) * t * t * t + k * t * t;};

let fonts: Promise<unknown> | null = null;
/** Canvas text does not wait for web fonts: load the two weights the card uses before drawing it. */
function cardFonts() {
  fonts ??= Promise.all(['500 24px "DM Sans Variable"', '600 30px "DM Sans Variable"'].map(f => document.fonts.load(f).then(faces => {
    if (!faces.length) throw new Error(`The card font did not load: ${f}. Import @fontsource-variable/dm-sans.`);
  })))
    .catch(error => {fonts = null; throw error;});
  return fonts;
}

/** When row i appears, and when the whole card has settled on its ready state. */
export function statusCardTiming(o: StatusCardOptions) {
  const lead = o.lead ?? .6, step = o.step ?? .42;
  const rowAt = (i: number) => o.start + lead + i * step;
  const readyAt = rowAt(o.rows.length - 1) + SPIN + SETTLE + .12;
  return {rowAt, readyAt};
}

/** The badge the camera dives through, stage px. */
export function statusCardAnchor(o: StatusCardOptions) {
  return {x: o.x + 30 + BADGE, y: o.y + HEADER / 2};
}

function spinner(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, color: string, width: number) {
  const a = t * Math.PI * 2 * 1.35;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = 'rgba(42,33,26,.1)';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, a, a + Math.PI * .62); ctx.stroke();
  ctx.restore();
}

function check(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, p: number, color: string) {
  if (p <= 0) return;
  const s = easeBack(p);
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  // The tick draws itself in.
  const d = clamp01((p - .15) / .7);
  ctx.strokeStyle = '#fbf7ef'; ctx.lineWidth = r * .2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const pts: [number, number][] = [[-r * .42, r * .02], [-r * .1, r * .32], [r * .45, -r * .3]];
  const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), l2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1]);
  const len = (l1 + l2) * d;
  ctx.beginPath(); ctx.moveTo(...pts[0]);
  if (len <= l1) ctx.lineTo(pts[0][0] + (pts[1][0] - pts[0][0]) * len / l1, pts[0][1] + (pts[1][1] - pts[0][1]) * len / l1);
  else {
    ctx.lineTo(...pts[1]);
    const u = (len - l1) / l2;
    ctx.lineTo(pts[1][0] + (pts[2][0] - pts[1][0]) * u, pts[1][1] + (pts[2][1] - pts[1][1]) * u);
  }
  ctx.stroke();
  ctx.restore();
}

/** The card as a UI layer source: a pure function of film time, drawn in stage px. */
export function statusCard(o: StatusCardOptions): DepthUISource {
  const {rowAt, readyAt} = statusCardTiming(o);
  const anchor = statusCardAnchor(o);
  const pose = (): DepthUIPose => ({x: o.x + o.width / 2, y: o.y, scale: 1, anchorX: anchor.x, anchorY: anchor.y});
  return uiDrawing(async (ctx, {t, scale}) => {
    await cardFonts();
    // The card grows taller with its top fixed as each row arrives.
    const grown = o.rows.reduce((h, _, i) => h + ROW * easeInOut((t - rowAt(i) + .05) / .32), 0);
    const height = HEADER + grown + FOOT * easeInOut((t - rowAt(0)) / .3);
    const {x, y, width} = o;

    ctx.save();
    // A soft shadow, no outline. Shadows are measured in output pixels, not in the scaled space.
    ctx.shadowColor = 'rgba(18,10,4,.34)'; ctx.shadowBlur = 64 * scale; ctx.shadowOffsetY = 26 * scale;
    ctx.fillStyle = PAPER;
    ctx.beginPath(); ctx.roundRect(x, y, width, height, 24); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, width, height, 24); ctx.clip();

    // Header: status badge, title and state.
    const ready = clamp01((t - readyAt) / SETTLE);
    if (ready < 1) spinner(ctx, anchor.x, anchor.y, BADGE * .72, t, AMBER, 4.5);
    check(ctx, anchor.x, anchor.y, BADGE, ready, SAGE);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = INK; ctx.font = `600 30px ${FAMILY}`;
    ctx.fillText(o.title, x + 30 + BADGE * 2 + 22, y + 48);
    ctx.font = `500 22px ${FAMILY}`;
    const state = (text: string, color: string, alpha: number) => {
      if (alpha <= 0) return;
      ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.fillText(text, x + 30 + BADGE * 2 + 22, y + 79);
      ctx.globalAlpha = 1;
    };
    // One state at a time: the checking line leaves before the ready line arrives.
    state(o.checking, MUTED, 1 - clamp01(ready * 2));
    state(o.ready, SAGE, clamp01(ready * 2 - 1));

    // Rows, one by one: each slides up into place, spins, then settles on its check.
    o.rows.forEach(({label, detail}, i) => {
      const at = rowAt(i);
      const appear = easeOut((t - at) / .3);
      if (appear <= 0) return;
      const ry = y + HEADER + i * ROW + ROW / 2 + (1 - appear) * 10;
      ctx.globalAlpha = appear;
      ctx.fillStyle = RULE; ctx.fillRect(x + 30, y + HEADER + i * ROW, width - 60, 1.5);
      const cx = x + 30 + 15, done = clamp01((t - at - SPIN) / SETTLE);
      if (done < 1) spinner(ctx, cx, ry, 11, t - at, AMBER, 3.5);
      check(ctx, cx, ry, 15, done, SAGE);
      ctx.fillStyle = INK; ctx.font = `500 24px ${FAMILY}`;
      ctx.fillText(label, cx + 32, ry + 8.5);
      if (detail) {
        ctx.globalAlpha = appear * (.35 + .65 * done);
        ctx.fillStyle = MUTED; ctx.font = `500 20px ${FAMILY}`; ctx.textAlign = 'right';
        ctx.fillText(detail, x + width - 30, ry + 7.5);
        ctx.textAlign = 'left';
      }
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }, pose);
}
