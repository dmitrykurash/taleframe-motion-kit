import React, {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, Html5Audio, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {outputScale} from './config';
import {releaseSurface, surface} from './raster';
import {renderDepthFrame, validateDepthFilm, type DepthFilmSpec} from './film';

export type DepthCanvasRender = (ctx: CanvasRenderingContext2D, frame: number) => Promise<void>;

/** One canvas per frame, drawn by an async renderer that must be a pure function of the frame. The renderer draws
 * into a staging canvas of the composition's size, which is shown only if its frame is still current. Fonts are
 * ready before the renderer runs. */
export const DepthCanvas: React.FC<{render: DepthCanvasRender; style?: React.CSSProperties}> = ({render, style}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const [first] = useState(() => delayRender('First depth film frame'));
  const released = useRef(false);
  useLayoutEffect(() => {
    let active = true;
    let finished = false;
    const handle = delayRender(`Depth film frame ${frame}`);
    const done = () => {
      if (finished) return;
      finished = true;
      continueRender(handle);
      if (!released.current) {released.current = true; continueRender(first);}
    };
    (async () => {
      await document.fonts.ready;
      const staging = surface(width, height);
      try {
        await render(staging, frame);
        const ctx = ref.current?.getContext('2d');
        if (!active) return;
        if (!ctx) throw new Error('A 2D canvas is required for depth films.');
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(staging.canvas, 0, 0);
      } finally {
        releaseSurface(staging);
      }
    })().then(done, error => {done(); if (active) cancelRender(error);});
    return () => {active = false; done();};
  }, [frame, render, first, width, height]);
  return <canvas ref={ref} width={width} height={height}
    style={{position: 'absolute', inset: 0, width: '100%', height: '100%', ...style}}/>;
};

export type DepthFilmProps = DepthFilmSpec & {
  /** Soundtrack under public/ (or a URL). */
  audio?: string;
  volume?: number;
};

/** A multiplane painted film: shots of painted planes filmed by travelling cameras, cut through anchors, with ink
 * type, UI layers, motes and the painted finish. Author on the config's stage (1920 × 1080 by default); a larger
 * composition of the same aspect ratio renders the same shots at a higher resolution. Keep the spec stable (module
 * scope or useMemo): a new object every render repaints from scratch. */
export const DepthFilm: React.FC<DepthFilmProps> = ({audio, volume, config, shots, cuts, overlay, finish, font, forceWatercolor, background}) => {
  const video = useVideoConfig();
  const film = useMemo(() => validateDepthFilm({config, shots, cuts, overlay, finish, font, forceWatercolor, background}),
    [config, shots, cuts, overlay, finish, font, forceWatercolor, background]);
  if (video.fps !== film.config.fps) throw new Error(`The composition runs at ${video.fps} fps but the depth film at ${film.config.fps}. Use the same rate.`);
  const scale = outputScale(film.config, video.width, video.height);
  const render = useCallback((ctx: CanvasRenderingContext2D, frame: number) => renderDepthFrame(ctx, film, frame, scale), [film, scale]);
  return <>
    <DepthCanvas render={render}/>
    {audio ? <Html5Audio src={/^(https?:|data:|blob:)/.test(audio) ? audio : staticFile(audio.replace(/^\/+/, ''))} volume={volume}/> : null}
  </>;
};
