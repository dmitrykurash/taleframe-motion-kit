/** Minimal structural types used by the vendored still paint renderer. */
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export type Affine = [number, number, number, number, number, number];
export interface Fps { num: number; den: number; }
export interface PaintAnchor { id: string; width: number; height: number; rgba: Uint8ClampedArray; }
export interface PaintTransport { width: number; height: number; data: Float32Array; }
export interface PreparedPaintFrame { a: PaintAnchor; b: PaintAnchor; fromA: PaintTransport; fromB: PaintTransport; mix: number; }
