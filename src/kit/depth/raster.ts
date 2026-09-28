// Pixel plumbing for depth films: decoded images with an LRU cache, and a small pool of reusable canvases.
import {staticFile} from 'remotion';

const images = new Map<string, Promise<HTMLImageElement>>();
let imageLimit = 48;

/** Decoded image for a path under public/, least recently used first out. Failures are not cached. */
export function depthImage(path: string): Promise<HTMLImageElement> {
  const hit = images.get(path);
  if (hit) {images.delete(path); images.set(path, hit); return hit;}
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => img.decode().then(() => resolve(img), reject);
    img.onerror = () => reject(new Error(`Cannot load ${path}. Paths are relative to public/.`));
    img.src = /^(https?:|data:|blob:)/.test(path) ? path : staticFile(path.replace(/^\/+/, ''));
  });
  images.set(path, pending);
  pending.catch(() => {if (images.get(path) === pending) images.delete(path);});
  while (images.size > imageLimit) images.delete(images.keys().next().value!);
  return pending;
}

/** How many decoded images to keep (default 48). Raise it for shots with many planes at 4K only if memory allows. */
export function setDepthImageLimit(limit: number) {
  if (!Number.isInteger(limit) || limit < 4) throw new Error('The image cache needs room for at least 4 images.');
  imageLimit = limit;
}

const pool = new Map<string, HTMLCanvasElement[]>();

/** A cleared canvas from a small pool, reset to plain drawing state. Give it back with releaseSurface(). */
export function surface(width: number, height: number): CanvasRenderingContext2D {
  const key = `${width}x${height}`;
  const canvas = pool.get(key)?.pop() ?? Object.assign(document.createElement('canvas'), {width, height});
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('A 2D canvas is required for depth films.');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
  ctx.shadowColor = 'rgba(0,0,0,0)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, width, height);
  return ctx;
}

/** Return canvases to the pool once nothing draws from them any more this frame. */
export function releaseSurface(...contexts: (CanvasRenderingContext2D | null | undefined)[]) {
  for (const ctx of contexts) {
    if (!ctx) continue;
    const key = `${ctx.canvas.width}x${ctx.canvas.height}`;
    const list = pool.get(key) ?? [];
    if (list.length < 10 && !list.includes(ctx.canvas)) list.push(ctx.canvas);
    pool.set(key, list);
  }
}
