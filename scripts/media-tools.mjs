import {RenderInternals} from '@remotion/renderer';
import path from 'node:path';

// Keep the one version-pinned internal API here, rather than hardcoding a Mac package.
export function mediaTool(name) {
  if (!['ffmpeg', 'ffprobe'].includes(name)) throw new Error(`Unknown media tool: ${name}`);
  return process.env[`${name.toUpperCase()}_BIN`] || RenderInternals.getExecutablePath({
    type: name, indent: false, logLevel: 'error', binariesDirectory: null,
  });
}
export function toolEnv(binary) {
  return process.platform === 'darwin' && path.isAbsolute(binary)
    ? {...process.env, DYLD_LIBRARY_PATH: path.dirname(binary)} : {...process.env};
}
