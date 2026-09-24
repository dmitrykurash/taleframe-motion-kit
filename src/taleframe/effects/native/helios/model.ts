/** Artistic image-space approximation of a Helios 44-2; no scene depth is inferred. */
export interface HeliosSettings {
  enabled: boolean;
  amount: number;
  aperture: number;
  focusX: number;
  focusY: number;
  focusRadius: number;
  focusFeather: number;
  /** Blur radius in pixels at a 1080-pixel short edge, independent of preview scale. */
  blur: number;
  swirl: number;
  curvature: number;
  highlightBoost: number;
  vignette: number;
}

export const DEFAULT_HELIOS: Readonly<HeliosSettings> = Object.freeze({
  enabled: false, amount: 1, aperture: 2, focusX: .5, focusY: .5,
  focusRadius: .22, focusFeather: .28, blur: 32, swirl: .8,
  curvature: .45, highlightBoost: .35, vignette: .12,
});

/** Keep aperture/feather denominators positive; focus may sit outside the image. */
export const HELIOS_LIMITS = {
  amount: { min: 0, max: 1 }, aperture: { min: .25, max: 64 },
  focusX: { min: -4, max: 5 }, focusY: { min: -4, max: 5 },
  focusRadius: { min: 0, max: 4 }, focusFeather: { min: .001, max: 4 },
  blur: { min: 0, max: 2048 }, swirl: { min: 0, max: 4 },
  curvature: { min: 0, max: 4 }, highlightBoost: { min: 0, max: 8 },
  vignette: { min: 0, max: 4 },
} as const;

const finite = (v: unknown, fallback: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;

export function normalizeHelios(value: unknown): HeliosSettings {
  const v = value && typeof value === 'object' ? value as Partial<HeliosSettings> : {};
  const bounded = (key: keyof typeof HELIOS_LIMITS) => finite(v[key], DEFAULT_HELIOS[key], HELIOS_LIMITS[key].min, HELIOS_LIMITS[key].max);
  const n: HeliosSettings = {
    enabled: v.enabled === true,
    amount: bounded('amount'), aperture: bounded('aperture'),
    focusX: bounded('focusX'), focusY: bounded('focusY'),
    focusRadius: bounded('focusRadius'), focusFeather: bounded('focusFeather'),
    blur: bounded('blur'), swirl: bounded('swirl'), curvature: bounded('curvature'),
    highlightBoost: bounded('highlightBoost'), vignette: bounded('vignette'),
  };
  return Object.keys(n).every((key) => v[key as keyof HeliosSettings] === n[key as keyof HeliosSettings])
    ? v as HeliosSettings : n;
}

/** A zero-blur lens is a strict bypass, including its optional highlight/vignette treatment. */
export function heliosActive(value: HeliosSettings | undefined | null): value is HeliosSettings {
  return !!value?.enabled && value.amount > 0 && value.blur > 0;
}
