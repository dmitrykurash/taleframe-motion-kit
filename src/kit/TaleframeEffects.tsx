import React, {useLayoutEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {applyTaleframeEffects, effectFrame, type EffectsFrame, type EffectsSettings} from '../taleframe/effects/adapter';
import {loadOilBrushes} from './oil';

export type EffectsSource = string | {
  src: string;
  fit?: 'cover' | 'contain' | 'stretch';
  background?: string;
} | {
  /** Draw or composite your scene using info.frame / info.seconds, not a wall clock. */
  draw: (ctx: CanvasRenderingContext2D, info: EffectsFrame) => void | Promise<void>;
};
export type TaleframeEffectsProps = {
  source: EffectsSource;
  effects?: EffectsSettings;
  style?: React.CSSProperties;
  /** Optional source resolution. Defaults to the full composition dimensions. */
  width?: number;
  height?: number;
};

const imageCache = new Map<string, Promise<HTMLImageElement>>();
function loadImage(src: string): Promise<HTMLImageElement> {
  let loaded = imageCache.get(src);
  if (!loaded) {
    loaded = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {imageCache.delete(src); reject(new Error(`Cannot load effects image: ${src}`));};
      img.src = src;
    });
    imageCache.set(src, loaded);
  }
  return loaded;
}

/** Finish a source canvas with native Taleframe effects. Put crisp UI/text after this component.
 * Oil paint (`watercolor.style: 'oil'`) loads its brushes here. If you call applyTaleframeEffects() yourself with oil,
 * await loadOilBrushes() first. */
export const TaleframeEffects: React.FC<TaleframeEffectsProps> = ({source, effects = {}, style, width, height}) => {
  const frame = useCurrentFrame();
  const config = useVideoConfig();
  const w = width ?? config.width, h = height ?? config.height;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [initialHandle] = useState(() => delayRender('Load Taleframe effects source'));
  const released = useRef(false);
  const settingsKey = JSON.stringify(effects);
  const sourceKey = typeof source === 'string' ? source : 'src' in source ? JSON.stringify(source) : source.draw;
  useLayoutEffect(() => {
    let active = true;
    let finished = false;
    const handle = delayRender(`Taleframe effects frame ${frame}`);
    const finish = () => {
      if (finished) return;
      finished = true;
      continueRender(handle);
      if (!released.current) {released.current = true; continueRender(initialHandle);}
    };
    const run = async () => {
      await document.fonts.ready;
      if (effects.watercolor?.style === 'oil') await loadOilBrushes();
      const staging = document.createElement('canvas');
      staging.width = w; staging.height = h;
      const ctx = staging.getContext('2d');
      if (!ctx) throw new Error('A 2D canvas is required for effects.');
      const info = effectFrame(frame, config.fps, w, h, effects);
      if (typeof source !== 'string' && 'draw' in source) {
        await source.draw(ctx, info);
      } else {
        const input = typeof source === 'string' ? {src: source} : source;
        const img = await loadImage(input.src);
        if (input.background) {ctx.fillStyle = input.background; ctx.fillRect(0, 0, w, h);}
        const fit = input.fit ?? 'cover';
        const scale = fit === 'contain' ? Math.min(w / img.naturalWidth, h / img.naturalHeight) : Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const iw = fit === 'stretch' ? w : img.naturalWidth * scale;
        const ih = fit === 'stretch' ? h : img.naturalHeight * scale;
        ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
      }
      if (!active) return;
      applyTaleframeEffects(ctx, effects, frame, config.fps);
      const target = canvas.current?.getContext('2d');
      if (!target) throw new Error('Effects output canvas is unavailable.');
      target.clearRect(0, 0, w, h);
      target.drawImage(staging, 0, 0);
    };
    run().then(finish).catch(error => {finish(); if (active) cancelRender(error);});
    return () => {active = false; finish();};
  }, [frame, config.fps, w, h, sourceKey, settingsKey, initialHandle]);
  return <canvas ref={canvas} width={w} height={h} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', ...style}} />;
};

export {applyTaleframeEffects, effectFrame, normalizeEffects, disposeTaleframeEffects, DEFAULT_TALEFRAME_EFFECTS} from '../taleframe/effects/adapter';
export type {EffectsFrame, EffectsSettings, PostEffectKey} from '../taleframe/effects/adapter';
