import React, {useLayoutEffect, useRef, useState} from 'react';
import {cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {CONTEXT_ATTRS, TransitionHost} from '../taleframe/transitions/host';
import {imagePlacement, transitionFrame} from '../taleframe/transitions/adapter';
import type {Ease, TransitionParamValue} from '../taleframe/transitions/types';

export type TransitionSourceContext = {frame: number; fps: number; width: number; height: number; seconds: number};
export type TransitionImageSource = {src: string; fit?: 'cover' | 'contain' | 'stretch'; background?: string};
/** Draw the entire source from this frame's inputs. Do not depend on prior calls. */
export type TransitionCanvasSource = {draw: (ctx: CanvasRenderingContext2D, frame: TransitionSourceContext) => void | Promise<void>; background?: string};
export type TransitionSource = string | TransitionImageSource | TransitionCanvasSource;
export type TaleframeTransitionProps = {
  kind: string;
  from: TransitionSource;
  to: TransitionSource;
  fromFrame?: number;
  durationInFrames: number;
  params?: Record<string, TransitionParamValue>;
  ease?: Exclude<Ease, 'hold'>;
  /** Explicit CSS font requests for a custom canvas source, e.g. '500 48px "DM Sans"'. */
  fonts?: readonly string[];
  style?: React.CSSProperties;
};

type Runtime = {gl: WebGL2RenderingContext; host: TransitionHost; images: Map<string, Promise<HTMLImageElement>>; disposed: boolean};
const NO_FONTS: readonly string[] = [];

function loadImage(runtime: Runtime, src: string): Promise<HTMLImageElement> {
  let pending = runtime.images.get(src);
  if (!pending) {
    pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = async () => {
        try {
          await image.decode();
          if (!image.naturalWidth || !image.naturalHeight) throw new Error('Image has no dimensions');
          resolve(image);
        } catch (error) {reject(new Error(`Could not decode transition image: ${src}`, {cause: error}));}
      };
      image.onerror = () => reject(new Error(`Could not load transition image: ${src}. Keep assets in public/ and use staticFile().`));
      image.src = src;
    });
    runtime.images.set(src, pending);
  }
  return pending;
}

async function stageSource(runtime: Runtime, source: TransitionSource, info: TransitionSourceContext): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = info.width; canvas.height = info.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a 2D source canvas for the transition.');
  const input = typeof source === 'string' ? {src: source} : source;
  // Native transitions operate on opaque scene pictures. Matte transparent assets explicitly.
  ctx.fillStyle = input.background ?? '#ffffff'; ctx.fillRect(0, 0, info.width, info.height);
  if ('draw' in input) await input.draw(ctx, info);
  else {
    const image = await loadImage(runtime, input.src);
    const rect = imagePlacement(image.naturalWidth, image.naturalHeight, info.width, info.height, input.fit ?? 'cover');
    ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  }
  return canvas;
}

/** Native Taleframe shaders, applied to two image or canvas scene pictures. */
export const TaleframeTransition: React.FC<TaleframeTransitionProps> = ({kind, from, to, fromFrame = 0, durationInFrames, params, ease, fonts = NO_FONTS, style}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const runtime = useRef<Runtime | null>(null);
  const [initialHandle] = useState(() => delayRender('Initialize Taleframe transition'));
  const initialFinished = useRef(false);
  const finishInitial = () => {if (!initialFinished.current) {initialFinished.current = true; continueRender(initialHandle);}};

  useLayoutEffect(() => {
    const element = canvas.current!;
    element.width = width; element.height = height;
    let created: Runtime | null = null;
    const lost = (event: Event) => {event.preventDefault(); if (created && !created.disposed) cancelRender(new Error('The transition WebGL2 context was lost. Retry the render with lower concurrency.'));};
    try {
      const gl = element.getContext('webgl2', {...CONTEXT_ATTRS, preserveDrawingBuffer: true});
      if (!gl) throw new Error('Taleframe transitions need WebGL2. Render with Chromium ANGLE enabled (the included render script already does this).');
      created = {gl, host: new TransitionHost(gl), images: new Map(), disposed: false};
      runtime.current = created;
      element.addEventListener('webglcontextlost', lost);
    } catch (error) {finishInitial(); cancelRender(error);}
    return () => {
      element.removeEventListener('webglcontextlost', lost);
      if (created) {
        created.disposed = true;
        created.host.dispose(created.gl.isContextLost());
        created.images.clear();
        // Keep the now-empty context reusable during React effect replay; its canvas owns its lifetime.
      }
      runtime.current = null;
      finishInitial();
    };
  }, [width, height]);

  useLayoutEffect(() => {
    const current = runtime.current;
    if (!current) return;
    let cancelled = false;
    const handle = delayRender(`Taleframe ${kind}, frame ${frame}`);
    const draw = async () => {
      const state = transitionFrame(frame, fromFrame, durationInFrames, fps, kind, params, ease);
      if (width > current.host.env.maxTextureSize || height > current.host.env.maxTextureSize) throw new Error('Transition resolution exceeds this GPU’s texture limit.');
      await document.fonts.ready;
      for (const font of fonts) {
        const faces = await document.fonts.load(font);
        if (!faces.length) throw new Error(`Transition canvas font did not load: ${font}`);
      }
      const info = {frame, fps, width, height, seconds: frame / fps};
      const [a, b] = await Promise.all([stageSource(current, from, info), stageSource(current, to, info)]);
      if (cancelled || current.disposed) return;
      const {gl, host} = current;
      if (gl.isContextLost()) throw new Error('Transition WebGL2 context is lost.');
      if (gl.drawingBufferWidth !== width || gl.drawingBufferHeight !== height) throw new Error('The GPU could not allocate the requested transition canvas size.');
      const instance = host.instance(state.module);
      if (!instance) throw new Error(`Could not initialize transition: ${kind}`);
      host.ensureInputs(width, height, !!state.module.meta.inputs?.mipmaps);
      host.upload('A', a); host.upload('B', b);
      const {module: _module, ...args} = state;
      if (!host.render(instance, {...args, width, height, pxScale: Math.min(width, height) / 1080, target: null, draft: false})) throw new Error(`Could not render transition: ${kind}`);
      host.sync();
      const glError = gl.getError();
      if (glError !== gl.NO_ERROR) throw new Error(`Transition ${kind} failed with WebGL error 0x${glError.toString(16)}.`);
    };
    void draw().then(() => {if (!cancelled) finishInitial();}).catch((error) => {if (!cancelled) {finishInitial(); cancelRender(error);}}).finally(() => continueRender(handle));
    return () => {cancelled = true; continueRender(handle);};
  }, [frame, fps, width, height, kind, from, to, fromFrame, durationInFrames, params, ease, fonts]);

  return <canvas ref={canvas} width={width} height={height} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', ...style}} />;
};
