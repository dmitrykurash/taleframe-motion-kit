// 2D affine matrices as plain objects. Same layout as DOMMatrix2DInit, so ctx.setTransform() takes them directly,
// and pure enough to test without a browser.

export type Affine = {a: number; b: number; c: number; d: number; e: number; f: number};
export type Point = {x: number; y: number};

export const IDENTITY: Readonly<Affine> = {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0};

/** m · n: apply n first, then m. */
export function multiply(m: Affine, n: Affine): Affine {
  return {
    a: m.a * n.a + m.c * n.b, b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d, d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e, f: m.b * n.e + m.d * n.f + m.f,
  };
}

export function invert(m: Affine): Affine {
  const det = m.a * m.d - m.b * m.c;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) throw new Error('This placement cannot be inverted (zero scale).');
  return {
    a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det, f: (m.b * m.e - m.a * m.f) / det,
  };
}

export function apply(m: Affine, x: number, y: number): Point {
  return {x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f};
}

/** Chainable builder with DOMMatrix's post-multiplying order: the last call applies to points first. */
export class AffineBuilder {
  m: Affine;
  constructor(m: Affine = IDENTITY) {this.m = {...m};}
  translate(x: number, y: number) {this.m = multiply(this.m, {a: 1, b: 0, c: 0, d: 1, e: x, f: y}); return this;}
  scale(s: number, sy = s) {this.m = multiply(this.m, {a: s, b: 0, c: 0, d: sy, e: 0, f: 0}); return this;}
  /** Radians. */
  rotate(r: number) {const c = Math.cos(r), s = Math.sin(r); this.m = multiply(this.m, {a: c, b: s, c: -s, d: c, e: 0, f: 0}); return this;}
  then(n: Affine) {this.m = multiply(this.m, n); return this;}
  done(): Affine {return this.m;}
}
export const affine = (m?: Affine) => new AffineBuilder(m);
