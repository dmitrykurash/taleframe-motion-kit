import React, {useEffect, useMemo, useState} from 'react';
import {cancelRender, continueRender, delayRender, staticFile} from 'remotion';
import {graphemes} from './typing';

export type FontAsset = {family: string; src: string; weight?: number; style?: 'normal' | 'italic'};
export type FontStyle = {fontFamily?: string; fontSize?: number; fontWeight?: number; letterSpacing?: number};
export type TextMetrics = {characters: string[]; width: number; positions: number[]; prefixWidths: number[]};
export const assetUrl = (src: string) => /^(https?:|data:|blob:)/.test(src) ? src : staticFile(src.replace(/^\//, ''));

/** Children mount after local fonts exist, preventing fallback-font measurement. */
export function FontLoader({fonts = [], children}: {fonts?: readonly FontAsset[]; children: React.ReactNode}) {
  const signature = JSON.stringify(fonts);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [handle] = useState(() => delayRender('Load project fonts'));
  useEffect(() => {
    let active = true;
    const updateHandle = delayRender('Load changed project fonts');
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      continueRender(handle);
      continueRender(updateHandle);
    };
    const assets: FontAsset[] = JSON.parse(signature);
    Promise.all(assets.map(async font => {
      const face = new FontFace(font.family, `url(${JSON.stringify(assetUrl(font.src))})`, {
        weight: String(font.weight ?? 400), style: font.style ?? 'normal',
      });
      await face.load();
      document.fonts.add(face);
    })).then(() => {
      if (active) setLoaded(signature);
      release();
    }).catch(error => { release(); if (active) cancelRender(error); });
    return () => { active = false; release(); };
  }, [signature, handle]);
  return loaded === signature ? <>{children}</> : null;
}

/** Prefix metrics keep Latin pair kerning while glyphs move independently.
 * For Arabic/Indic connected shaping, animate whole words with WordReveal instead. */
export function useTextMetrics(text: string, {
  fontFamily = 'Arial, sans-serif', fontSize = 64, fontWeight = 400, letterSpacing = 0,
}: FontStyle = {}): TextMetrics | null {
  const key = JSON.stringify([text, fontFamily, fontSize, fontWeight, letterSpacing]);
  const characters = useMemo(() => graphemes(text), [text]);
  const [result, setResult] = useState<{key: string; metrics: TextMetrics} | null>(null);
  const [handle] = useState(() => delayRender('Measure animated typography'));
  useEffect(() => {
    let active = true;
    const updateHandle = delayRender('Measure changed animated typography');
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      continueRender(handle);
      continueRender(updateHandle);
    };
    document.fonts.load(`${fontWeight} ${fontSize}px ${fontFamily}`, text || 'M').then(async () => {
      await document.fonts.ready;
      const context = document.createElement('canvas').getContext('2d');
      if (!context) throw new Error('Canvas text measurement is unavailable.');
      context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      context.fontKerning = 'normal';
      const prefixWidths = [0, ...characters.map((_, i) =>
        context.measureText(characters.slice(0, i + 1).join('')).width + Math.max(0, i) * letterSpacing)];
      const positions = characters.map((character, i) => prefixWidths[i + 1] - context.measureText(character).width);
      if (active) setResult({key, metrics: {characters, positions, prefixWidths, width: prefixWidths.at(-1) ?? 0}});
      release();
    }).catch(error => { release(); if (active) cancelRender(error); });
    return () => { active = false; release(); };
  }, [key, characters, text, fontFamily, fontSize, fontWeight, letterSpacing, handle]);
  return result?.key === key ? result.metrics : null;
}
