/** Spatial paint reconstruction; plain saved data shared by preview and export. */
export interface WatercolorSettings {
  enabled: boolean;
  /** Legacy saved field, normalized to true. Context availability selects
   * prepared rendering; editor analysis is a separate explicit action. */
  prepared: boolean;
  amount: number;
  wetness: number;
  detail: number;
  /** Reference-space flat-brush scale and visible stroke character. */
  brushSize: number;
  strokes: number;
  /** Smooth growth of brush size away from the frame center; exactly 0 disables it. */
  edgeScale: number;
  paper: number;
  seed: number;
}
export interface PigmentSettings {
  enabled: boolean;
  amount: number;
  granulation: number;
  settling: number;
  paper: number;
  seed: number;
}
export const DEFAULT_WATERCOLOR: Readonly<WatercolorSettings> = {
  enabled: false, prepared: true, amount: 1, wetness: 0.65, detail: 0.6, brushSize: 0.6, strokes: 0.8, edgeScale: 0, paper: 0.75, seed: 17,
};
export const DEFAULT_PIGMENT: Readonly<PigmentSettings> = {
  enabled: false, amount: 0.95, granulation: 0.8, settling: 0.72, paper: 0.75, seed: 53,
};
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const unit = (v: unknown, fallback: number): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
const artistic = (v: unknown, fallback: number): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(4, v)) : fallback;
const seed = (v: unknown, fallback: number): number => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(4294967295, Math.round(v))) : fallback;
export function normalizeWatercolor(value: unknown): WatercolorSettings {
  const r = object(value), d = DEFAULT_WATERCOLOR;
  const result: WatercolorSettings = {
    enabled: r.enabled === true, prepared: true, amount: unit(r.amount, d.amount), wetness: artistic(r.wetness, d.wetness),
    detail: artistic(r.detail, d.detail), brushSize: artistic(r.brushSize, d.brushSize), strokes: artistic(r.strokes, d.strokes),
    edgeScale: artistic(r.edgeScale, d.edgeScale),
    paper: artistic(r.paper, d.paper), seed: seed(r.seed, d.seed),
  };
  return JSON.stringify(result) === JSON.stringify(value) ? value as WatercolorSettings : result;
}
export function normalizePigment(value: unknown): PigmentSettings {
  const r = object(value), d = DEFAULT_PIGMENT;
  const result: PigmentSettings = {
    enabled: r.enabled === true, amount: unit(r.amount, d.amount), granulation: artistic(r.granulation, d.granulation),
    settling: artistic(r.settling, d.settling), paper: artistic(r.paper, d.paper), seed: seed(r.seed, d.seed),
  };
  return JSON.stringify(result) === JSON.stringify(value) ? value as PigmentSettings : result;
}
export const watercolorActive = (s: WatercolorSettings | undefined): boolean => !!s?.enabled && s.amount > 0;
export const pigmentActive = (s: PigmentSettings | undefined): boolean => !!s?.enabled && s.amount > 0;
export const paintEffectsActive = (a: WatercolorSettings | undefined, b: PigmentSettings | undefined): boolean => watercolorActive(a) || pigmentActive(b);
