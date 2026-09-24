import {staticFile} from 'remotion';

export type ImageSequenceOptions = {
  /** Directory relative to public/, containing frame-000000.png, frame-000001.png, ... */
  directory: string;
  /** Total number of zero-based PNGs, as reported by sequence.mjs. */
  frameCount: number;
  /** Source sequence rate, which may differ from the composition frame rate. */
  fps: number;
  /** First source frame to play. Looping repeats the remaining trimmed range. */
  startFrame?: number;
  fit?: 'cover' | 'contain' | 'stretch';
  loop?: boolean;
};
export type ValidatedImageSequenceOptions = Required<ImageSequenceOptions>;
export type SequenceFrameContext = {frame: number; fps: number; width: number; height: number; seconds: number};
export type ImageSequenceSource = {draw: (ctx: CanvasRenderingContext2D, frame: SequenceFrameContext) => Promise<void>};

/** Four decoded frames per source and browser worker; no eager video-sized allocation. */
const CACHE_LIMIT = 4;

export function validateImageSequenceOptions(options: ImageSequenceOptions): ValidatedImageSequenceOptions {
  if (!options || typeof options !== 'object') throw new Error('Image sequence options must be an object.');
  if (typeof options.directory !== 'string') throw new Error('directory must be a path relative to public/.');
  const directory = options.directory.replaceAll('\\', '/').replace(/\/+$/, '');
  if (!directory || directory.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(directory) ||
    directory.split('/').some(part => !part || part === '.' || part === '..') || /[\0\r\n]/.test(directory)) {
    throw new Error('directory must be relative to public/, without empty, . or .. segments.');
  }
  if (!Number.isInteger(options.frameCount) || options.frameCount < 1 || options.frameCount > 1_000_000) {
    throw new Error('frameCount must be an integer from 1 to 1000000.');
  }
  if (!Number.isFinite(options.fps) || options.fps <= 0 || options.fps > 240) {
    throw new Error('Sequence fps must be greater than 0 and at most 240.');
  }
  const startFrame = options.startFrame ?? 0;
  if (!Number.isInteger(startFrame) || startFrame < 0 || startFrame >= options.frameCount) {
    throw new Error('startFrame must be a source frame within 0…frameCount-1.');
  }
  const fit = options.fit ?? 'cover';
  if (!['cover', 'contain', 'stretch'].includes(fit)) throw new Error('fit must be cover, contain, or stretch.');
  if (options.loop !== undefined && typeof options.loop !== 'boolean') throw new Error('loop must be a boolean.');
  return {directory, frameCount: options.frameCount, fps: options.fps, startFrame, fit, loop: options.loop ?? false};
}

/** Sample by seconds, so 30 fps footage plays at the same speed in a 60 fps film.
 * A tiny tolerance stabilizes exact boundaries such as (29 / 30) * 30. */
export function sequenceFrameAt(seconds: number, options: ImageSequenceOptions): number {
  const valid = validateImageSequenceOptions(options);
  if (!Number.isFinite(seconds)) throw new Error('Sequence time must be finite.');
  const advance = Math.floor(Math.max(0, seconds) * valid.fps + 1e-7);
  if (!Number.isSafeInteger(advance)) throw new Error('Sequence time is outside the supported frame range.');
  const length = valid.frameCount - valid.startFrame;
  return valid.startFrame + (valid.loop ? advance % length : Math.min(advance, length - 1));
}

/** Portable canvas source for both TaleframeEffects and TaleframeTransition.
 * Construct once (module scope or useMemo), then let each requested frame draw independently. */
export function imageSequenceSource(options: ImageSequenceOptions): ImageSequenceSource {
  const valid = validateImageSequenceOptions(options);
  const cache = new Map<number, Promise<HTMLImageElement>>();
  const imageAt = (index: number): Promise<HTMLImageElement> => {
    const existing = cache.get(index);
    if (existing) {
      cache.delete(index);
      cache.set(index, existing);
      return existing;
    }
    const src = staticFile(`${valid.directory}/frame-${String(index).padStart(6, '0')}.png`);
    const pending = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = async () => {
        try {
          await image.decode();
          if (!image.naturalWidth || !image.naturalHeight) throw new Error('Frame has no dimensions.');
          resolve(image);
        } catch (error) {reject(new Error(`Cannot decode sequence frame ${index}: ${src}`, {cause: error}));}
      };
      image.onerror = () => reject(new Error(`Cannot load sequence frame ${index}: ${src}. Check the directory and manifest frameCount.`));
      image.src = src;
    });
    cache.set(index, pending);
    // Eviction drops the cached reference; an active draw still owns its awaited image.
    while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
    void pending.catch(() => {if (cache.get(index) === pending) cache.delete(index);});
    return pending;
  };
  return {draw: async (ctx, {seconds, width, height}) => {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      throw new Error('Sequence target dimensions must be positive.');
    }
    const image = await imageAt(sequenceFrameAt(seconds, valid));
    const scale = valid.fit === 'contain'
      ? Math.min(width / image.naturalWidth, height / image.naturalHeight)
      : Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = valid.fit === 'stretch' ? width : image.naturalWidth * scale;
    const drawHeight = valid.fit === 'stretch' ? height : image.naturalHeight * scale;
    // Wrappers supply a fresh source canvas on every request. Preserve their matte
    // outside a contained image (the transition wrapper paints white by default).
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    ctx.restore();
  }};
}
