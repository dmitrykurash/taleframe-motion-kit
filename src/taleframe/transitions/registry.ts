/**
 * The transition registry: every module imported statically (so Vite bundles
 * them into the main bundle and the export worker), their meta for the UI,
 * and parameter resolution (contract §6, §7).
 *
 * Adding a transition = a folder src/engine/transitions/<id>/index.ts that
 * exports `meta`, `params`, `create` (and a default module object), plus one
 * line in MODULES below. Order = the picker's order.
 */
import type { TransitionParamValue } from './types';
import crossfade from './crossfade';
import dip from './dip';
import engraving from './engraving';
import whip from './whip';
import prism from './prism';
import ink from './ink';
import watercolor from './watercolor';
import waterspill from './waterspill';
import paperpaint from './paperpaint';
import frost from './frost';
import sand from './sand';
import capillary from './capillary';
import marbling from './marbling';
import ripple from './ripple';
import contour from './contour';
import godrays from './godrays';
import fold from './fold';
import halftone from './halftone';
import signal from './signal';
import ribbon from './ribbon';
import {
  BASIC_DIRECTIONS,
  DIRECTIONS,
  type Direction,
  type ResolvedParams,
  type TransitionMeta,
  type TransitionModule,
  type TransitionParam,
} from './types';

const MODULES: readonly TransitionModule[] = [crossfade, dip, engraving, whip, prism, ink, watercolor, waterspill, paperpaint, sand, capillary, marbling, ripple, contour, godrays];

// Retired choices remain loadable: existing projects keep their authored look and parameters.
const LEGACY_MODULES: readonly TransitionModule[] = [fold, halftone, signal, ribbon, frost];

/** The module every unknown kind renders as (a project from a newer build, a removed module). */
export const FALLBACK_KIND = 'crossfade';

const byId = new Map<string, TransitionModule>([...MODULES, ...LEGACY_MODULES].map((m) => [m.meta.id, m]));

/** Visible choices, in picker order. Retired modules resolve by id but never appear here. */
export function listTransitions(includeLegacy = false): readonly TransitionModule[] {
  return includeLegacy ? [...MODULES, ...LEGACY_MODULES] : MODULES;
}

/** Whether `kind` is supported, including retired effects stored in existing projects. */
export function hasTransition(kind: string): boolean {
  return byId.has(kind);
}

/** The module for `kind`; unknown kinds get the crossfade. */
export function getTransitionModule(kind: string): TransitionModule {
  return byId.get(kind) ?? byId.get(FALLBACK_KIND)!;
}

/** Meta for `kind` (unknown kinds: the crossfade's). */
export function getTransitionMeta(kind: string): TransitionMeta {
  return getTransitionModule(kind).meta;
}

/** Params schema for `kind` (unknown kinds: the crossfade's). */
export function getTransitionParams(kind: string): readonly TransitionParam[] {
  return getTransitionModule(kind).params;
}

/* ----------------------------------------------------------------- params */

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * The values render() gets: every param present, numbers clamped to their
 * range, anything missing or invalid → the default, unknown ids dropped.
 * `schema` may be a module kind. Pure, deterministic (same on every thread).
 */
export function resolveParams(schema: readonly TransitionParam[] | string, values: Readonly<Record<string, TransitionParamValue>> | undefined = {}): ResolvedParams {
  const list = typeof schema === 'string' ? getTransitionParams(schema) : schema;
  const out: ResolvedParams = {};
  const vals = values ?? {};
  for (const p of list) {
    const v = vals[p.id];
    switch (p.type) {
      case 'number': {
        const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
        out[p.id] = Number.isFinite(n) ? Math.min(p.max, Math.max(p.min, n)) : p.default;
        break;
      }
      case 'enum':
        out[p.id] = p.options.some((o) => o.value === v) ? (v as string) : p.default;
        break;
      case 'direction': {
        const opts = p.options ?? BASIC_DIRECTIONS;
        out[p.id] = typeof v === 'string' && (opts as readonly string[]).includes(v) ? v : p.default;
        break;
      }
      case 'color':
        out[p.id] = typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : p.default;
        break;
      case 'boolean':
        out[p.id] = typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : p.default;
        break;
      case 'point': {
        const q = v as { x?: unknown; y?: unknown } | undefined;
        out[p.id] =
          q && typeof q === 'object' && typeof q.x === 'number' && typeof q.y === 'number' && Number.isFinite(q.x) && Number.isFinite(q.y)
            ? { x: q.x, y: q.y }
            : { ...p.default };
        break;
      }
      case 'seed': {
        const n = typeof v === 'number' ? Math.round(v) : typeof v === 'string' && v.trim() !== '' ? Math.round(Number(v)) : NaN;
        out[p.id] = Number.isFinite(n) ? n : p.default;
        break;
      }
    }
  }
  return out;
}

/** The default value of every param of `kind` (what a new transition renders with). */
export function defaultParams(kind: string): ResolvedParams {
  return resolveParams(kind, {});
}

/** Options a direction param offers (its own list, else the four basic directions). */
export function directionOptions(p: { options?: readonly Direction[] }): readonly Direction[] {
  return p.options ?? BASIC_DIRECTIONS;
}


export const LEGACY_TRANSITION_IDS = LEGACY_MODULES.map((mod) => mod.meta.id);
