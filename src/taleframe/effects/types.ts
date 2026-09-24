/** Minimal host types used by the vendored Taleframe effect runtime. */
import type {WatercolorSettings, PigmentSettings} from './native/paint/model';
import type {HeliosSettings} from './native/helios/model';
import type {StopmotionSettings} from './native/stopmotion/model';

export const SAMPLE_RATE = 48000;
export type Fps = {num: number; den: number};
export type Affine = [number, number, number, number, number, number];
export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
export interface PostEffects {
  order?: PostEffectKey[];
  excludeText: boolean;
  excludeTransitions: boolean;
  watercolor: WatercolorSettings;
  pigment: PigmentSettings;
  helios: HeliosSettings;
  stopmotion: StopmotionSettings;
  grain: {enabled: boolean; amount: number; size: number; monochrome: boolean; animated: boolean; speed: number; blend: 'normal' | 'overlay' | 'soft-light'};
  chromatic: {enabled: boolean; strength: number; angle: number; radial: boolean; redBlue: number; blur: number};
  lens: {enabled: boolean; distortion: number; zoom: number};
  duotone: {enabled: boolean; amount: number; shadows: string; highlights: string};
}
export type PostEffectKey = Exclude<keyof PostEffects, 'excludeText' | 'excludeTransitions' | 'order'>;
export type Project = {width: number; height: number; postEffects?: PostEffects};
/** Set enabled:true for each requested effect. Unspecified controls use native defaults. */
export type EffectsSettings = {order?: PostEffectKey[]} & {
  [K in PostEffectKey]?: Partial<PostEffects[K]>;
};
