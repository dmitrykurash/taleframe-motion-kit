// Stage size, frame rate and the hold of a depth film. Shots are authored on a logical stage (1920 × 1080 by
// default) and render at any multiple of it: a 3840 × 2160 composition renders the same shots at scale 2. Every
// function that measures the frame takes this config, so nothing depends on module-level constants.

export type DepthConfig = {
  /** Logical stage size. Positions, sizes and blurs in shots are in these stage pixels. */
  width: number;
  height: number;
  fps: number;
  /** Output frames per held picture outside cuts: 2 = on twos (12 pictures a second at 24 fps), 1 = live. */
  hold: number;
};

export const DEPTH_CONFIG: Readonly<DepthConfig> = {width: 1920, height: 1080, fps: 24, hold: 2};

/** A validated config; missing fields take the defaults (1920 × 1080, 24 fps, on twos). */
export function depthConfig(options: Partial<DepthConfig> = {}): DepthConfig {
  const config = {...DEPTH_CONFIG, ...options};
  for (const key of ['width', 'height'] as const) {
    if (!Number.isInteger(config[key]) || config[key] < 16 || config[key] > 16384) throw new Error(`Depth ${key} must be an integer from 16 to 16384.`);
  }
  if (!Number.isFinite(config.fps) || config.fps <= 0 || config.fps > 240) throw new Error('Depth fps must be greater than 0 and at most 240.');
  if (!Number.isInteger(config.hold) || config.hold < 1 || config.hold > 12) throw new Error('Depth hold must be a whole number of frames from 1 to 12.');
  return config;
}

/** Pixels per 1080p pixel: 1 at 1920 × 1080, 2 at 3840 × 2160. The engine's own blurs and shadows scale by it. */
export const depthUnit = (config: DepthConfig) => Math.min(config.width, config.height) / 1080;

/** Seconds on the live clock (every output frame). */
export const liveTime = (frame: number, config: DepthConfig) => frame / config.fps;

/** Seconds on the held clock: the start of the current hold (on twos, frames 6 and 7 both read frame 6). */
export const heldTime = (frame: number, config: DepthConfig) => {
  const f = Math.floor(frame);
  return (f - (((f % config.hold) + config.hold) % config.hold)) / config.fps;
};

/** Output pixels per stage pixel for a composition of `width` × `height`. The output must have the stage's aspect
 * ratio: a 3840 × 2160 composition of a 1920 × 1080 stage renders at scale 2. */
export function outputScale(config: DepthConfig, width: number, height: number): number {
  if (!(width > 0 && height > 0)) throw new Error('The output size must be positive.');
  const sx = width / config.width, sy = height / config.height;
  if (Math.abs(sx - sy) > 1e-3 * Math.max(sx, sy)) {
    throw new Error(`A ${width} × ${height} output does not match the ${config.width} × ${config.height} depth stage. Keep the aspect ratio.`);
  }
  return sx;
}

/** The output canvas size for a render scale (whole pixels). */
export const outputSize = (config: DepthConfig, scale: number) =>
  ({width: Math.round(config.width * scale), height: Math.round(config.height * scale)});
