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
  /** 'oil' (Taleframe kit): the same reconstruction painted with opaque bristle-brush boxes, coarse to fine,
   * after Stylized Neural Painting's oil strokes; no wetness, edge darkening or paper. Absent = watercolor. */
  style?: 'oil';
  /** Oil only: up to four ellipses [cx, cy, rx, ry] in frame uv (top-left origin) where fine strokes gather
   * (faces, hands, eyes, the hero prop of a scene). */
  focus?: number[];
  /** Oil only, 0.25-8: size of every stroke relative to the brush preset (1 = the preset's cell; 2 = twice as long and wide). */
  strokeScale?: number;
  /** Oil only, 1-8: how much more error finer strokes need outside the focus regions, which also thins the two finest
   * levels there (1 = every stroke the residual asks for; larger = looser). */
  looseness?: number;
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
    ...(r.style === 'oil' ? { style: 'oil' as const } : {}),
    ...(r.style === 'oil' && Array.isArray(r.focus) && r.focus.length >= 4 && r.focus.every(v => typeof v === 'number' && Number.isFinite(v))
      ? { focus: (r.focus as number[]).slice(0, Math.min(16, r.focus.length) - Math.min(16, r.focus.length) % 4) } : {}),
    ...(r.style === 'oil' && typeof r.strokeScale === 'number' && Number.isFinite(r.strokeScale) && r.strokeScale > 0
      ? { strokeScale: Math.max(.25, Math.min(8, r.strokeScale)) } : {}),
    ...(r.style === 'oil' && typeof r.looseness === 'number' && Number.isFinite(r.looseness)
      ? { looseness: Math.max(1, Math.min(8, r.looseness)) } : {}),
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
