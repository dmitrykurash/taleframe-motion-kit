import type { WatercolorSettings } from '../model';

/** Analysis textures use top-left coordinates and straight sRGB / alpha bytes. */
export interface PaintAnchor {
  id: string;
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

/** Every texel tracks a material point from the anchor into the output frame.
 * RG = normalized output UV (top-left), B = visibility/confidence, A = 1. */
export interface PaintTransport {
  width: number;
  height: number;
  data: Float32Array;
}

export interface PreparedPaintFrame {
  a: PaintAnchor;
  b: PaintAnchor;
  fromA: PaintTransport;
  fromB: PaintTransport;
  /** Crossfade between overlapping persistent generations; 0 at A, 1 at B. */
  mix: number;
}

export interface PaintInput {
  site: string;
  /** Exact root sequence frame, independent of held transform evaluation time. */
  frame: number;
  canvas: HTMLCanvasElement | OffscreenCanvas;
  projectWidth: number;
  projectHeight: number;
  settings: WatercolorSettings;
}

export interface PreparedPaintProvider {
  /** Structural discovery records sites without paying for their paint solve. */
  discoverOnly?: boolean;
  /** Synchronous borrowed frame; preparation jobs may inspect the input here. */
  resolve(input: PaintInput): PreparedPaintFrame | null;
}

export interface PaintRenderContext {
  provider: PreparedPaintProvider;
  frame: number;
  /** Stable instance / effect owner / protection and transition branch path. */
  site: string;
}

export interface PaintWindow {
  site: string;
  start: number;
  frames: PreparedPaintFrame[];
}

export const PAINT_ANALYSIS_VERSION = 1;
export const PAINT_WINDOW_FRAMES = 12;
export const PAINT_ANALYSIS_LONG_EDGE = 320;
export const PAINT_TRANSPORT_LONG_EDGE = 128;
