/** Chromium workers have a four-context budget. Share the fullscreen finishing passes:
 * HDR + transitions + paint + this context fit without evicting a live renderer.
 * Main-thread contexts remain isolated because their idle timers resize buffers.
 */
export interface SharedWorkerContext {
  canvas: OffscreenCanvas;
  gl: WebGL2RenderingContext;
}
let cached: SharedWorkerContext | null = null;

export function sharedWorkerContext(): SharedWorkerContext | null {
  if (typeof window !== 'undefined') return null;
  if (cached && !cached.gl.isContextLost()) return cached;
  cached = null;
  const canvas = new OffscreenCanvas(1, 1);
  const gl = canvas.getContext('webgl2', {
    alpha: true, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error('WebGL2 недоступен для обработки кадра.');
  const entry = { canvas, gl };
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    if (cached === entry) cached = null;
  });
  return cached = entry;
}

/** Every pass establishes its own state; a preceding pass may leave an FBO or texture unit bound. */
export function resetPostContext(gl: WebGL2RenderingContext, canvas: OffscreenCanvas | HTMLCanvasElement, width: number, height: number): void {
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.drawBuffers([gl.BACK]);
  gl.viewport(0, 0, width, height);
  gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST); gl.disable(gl.STENCIL_TEST);
  gl.disable(gl.SCISSOR_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.RASTERIZER_DISCARD);
  gl.colorMask(true, true, true, true);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindBuffer(gl.PIXEL_UNPACK_BUFFER, null);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
}

/** Call only after every sharing renderer has deleted its private programs and textures. */
export function disposeSharedWorkerContext(): void {
  const previous = cached;
  cached = null;
  if (!previous) return;
  previous.canvas.width = previous.canvas.height = 1;
  previous.gl.getExtension('WEBGL_lose_context')?.loseContext();
}
