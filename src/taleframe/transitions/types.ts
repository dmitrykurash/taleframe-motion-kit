/**
 * Scene transitions: the module contract, the parameter schema and the
 * per-frame description the compositor renders from.
 * Contract: docs/research/transitions/engine-contract.md (§2, §3, §6, §7).
 *
 * A module is a plain ES module (meta, params, create) registered statically
 * in registry.ts, so Vite bundles it into the main bundle and the export
 * worker alike. Everything here is worker-safe (no DOM).
 */
export type Ease = 'linear' | 'hold' | [number, number, number, number];
export type TransitionParamValue = number | string | boolean | { x: number; y: number };

/* ------------------------------------------------------------ parameters */

/** Where the OUTGOING picture moves («Влево»: A leaves to the left, B comes from the right). */
export type Direction = 'left' | 'right' | 'up' | 'down' | 'up-left' | 'up-right' | 'down-left' | 'down-right';
export const DIRECTIONS: readonly Direction[] = ['left', 'right', 'up', 'down', 'up-left', 'up-right', 'down-left', 'down-right'];
/** Default `direction` options when a param lists none. */
export const BASIC_DIRECTIONS: readonly Direction[] = ['left', 'right', 'up', 'down'];

export type ParamUnit = '%' | '°' | 'с' | '×' | 'пикс';

interface ParamBase {
  /** camelCase, stable (stored in projects). */
  id: string;
  /** Calm, short, sentence case («Угол», «Мягкость края»). */
  label_ru: string;
  /** One line under the control. */
  hint_ru?: string;
  /** Under «Подробнее» (≤ 6 visible params). */
  advanced?: boolean;
}

export interface NumberParam extends ParamBase {
  type: 'number';
  min: number;
  max: number;
  step?: number;
  default: number;
  unit?: ParamUnit;
}
export interface EnumParam extends ParamBase {
  type: 'enum';
  options: readonly { value: string; label_ru: string }[];
  default: string;
}
export interface ColorParam extends ParamBase {
  type: 'color';
  /** '#rrggbb', sRGB. */
  default: string;
}
export interface BooleanParam extends ParamBase {
  type: 'boolean';
  default: boolean;
}
export interface DirectionParam extends ParamBase {
  type: 'direction';
  /** Default: the four basic directions. */
  options?: readonly Direction[];
  default: Direction;
}
export interface PointParam extends ParamBase {
  type: 'point';
  /** Frame fractions, top-left origin (like project px). */
  default: { x: number; y: number };
}
export interface SeedParam extends ParamBase {
  type: 'seed';
  /** The look the module was designed with; «Другой» picks a new integer. */
  default: number;
}

export type TransitionParam = NumberParam | EnumParam | ColorParam | BooleanParam | DirectionParam | PointParam | SeedParam;
export type TransitionParamType = TransitionParam['type'];

/** Values render() gets: every param present, defaults applied, numbers clamped. */
export type ResolvedParams = Record<string, TransitionParamValue>;

/* ----------------------------------------------------------------- module */

export interface TransitionMeta {
  /** kebab-case, stored in projects; never renamed. */
  id: string;
  /** ≤ ~16 chars (tile caption). */
  name_ru: string;
  /** One calm sentence. */
  description_ru: string;
  /** New transitions get this length (rounded to frames). */
  defaultDurationSec: number;
  /** Inspector range. */
  minDurationSec?: number;
  maxDurationSec?: number;
  /** 'linear' or a cubic-bezier; never 'hold'. */
  defaultEase: Exclude<Ease, 'hold'>;
  /** The host generates mipmaps for texA / texB. */
  inputs?: { mipmaps?: boolean };
  /** Bumped when a param's meaning changes. */
  version?: number;
}

/** What create() gets besides the context. */
export interface TransitionEnv {
  /** Running in a worker (export). */
  worker: boolean;
  /** EXT_color_buffer_float is enabled (RGBA16F render targets). */
  floatTargets: boolean;
  maxTextureSize: number;
}

/** render() arguments (contract §6). */
export interface TransitionRenderArgs {
  /** RGBA8, sRGB-encoded, opaque, LINEAR / CLAMP_TO_EDGE, upright for bottom-left uv. Never cache: replaced on resize. */
  texA: WebGLTexture;
  texB: WebGLTexture;
  width: number;
  height: number;
  /** Linear 0…1, frame-middle sampled. */
  progress: number;
  /** ease(progress); may leave [0, 1] with overshoot curves. */
  eased: number;
  /** Elapsed time inside the window and its length. */
  seconds: number;
  durationSec: number;
  fps: number;
  /** Canvas px per reference pixel (1/1080 of the short side). */
  pxScale: number;
  params: ResolvedParams;
  /** Framebuffer to draw every pixel of, or null (the canvas). */
  target: WebGLFramebuffer | null;
  /** Tiles and scrubbing: may lower sample counts, must not change the look. */
  draft: boolean;
}

export interface TransitionInstance {
  render(args: TransitionRenderArgs): void;
  dispose(): void;
}

export interface TransitionModule {
  meta: TransitionMeta;
  params: readonly TransitionParam[];
  create(gl: WebGL2RenderingContext, env: TransitionEnv): TransitionInstance;
}
