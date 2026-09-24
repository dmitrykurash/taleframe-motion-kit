/** Saved controls for the held-frame rhythm and handmade surface of Stopmotion. */
export interface StopmotionSettings {
  enabled: boolean;
  fps: number;
  /** Registration offsets and surface displacement use project pixels. */
  jitter: number;
  rotation: number;
  boil: number;
  texture: number;
  /** Optional frame-to-frame lighting variation, in exposure stops. */
  exposure: number;
  seed: number;
}

export const DEFAULT_STOPMOTION: Readonly<StopmotionSettings> = Object.freeze({
  enabled: false, fps: 12, jitter: .35, rotation: .025, boil: .45,
  texture: .18, exposure: 0, seed: 23,
});

/** Physical/numeric limits stay separate from the shorter creative slider ranges. */
export const STOPMOTION_LIMITS = {
  fps: { min: 1, max: 60 }, jitter: { min: 0, max: 100 },
  rotation: { min: 0, max: 45 }, boil: { min: 0, max: 32 },
  texture: { min: 0, max: 1 }, exposure: { min: 0, max: 2 },
  seed: { min: 0, max: 4294967295 },
} as const;

export function normalizeStopmotion(value: unknown): StopmotionSettings {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Partial<StopmotionSettings> : {};
  const bounded = (key: keyof typeof STOPMOTION_LIMITS): number => {
    const v = raw[key], range = STOPMOTION_LIMITS[key];
    return typeof v === 'number' && Number.isFinite(v)
      ? Math.max(range.min, Math.min(range.max, v)) : DEFAULT_STOPMOTION[key];
  };
  const result: StopmotionSettings = {
    enabled: raw.enabled === true,
    fps: bounded('fps'), jitter: bounded('jitter'), rotation: bounded('rotation'),
    boil: bounded('boil'), texture: bounded('texture'), exposure: bounded('exposure'),
    seed: Math.round(bounded('seed')),
  };
  return Object.keys(result).every(key => raw[key as keyof StopmotionSettings] === result[key as keyof StopmotionSettings])
    ? raw as StopmotionSettings : result;
}

/** Frame holding alone is meaningful, even when every surface imperfection is zero. */
export function stopmotionActive(value: StopmotionSettings | undefined | null): value is StopmotionSettings {
  return value?.enabled === true;
}
