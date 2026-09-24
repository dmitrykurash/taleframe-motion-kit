import React, {useLayoutEffect, useRef} from 'react';
import {cancelRender, continueRender, delayRender} from 'remotion';
import {WATERCOLOR_FRAGMENT, WATERCOLOR_VERTEX} from './watercolorTransitionShader';

/** Transform of a full-frame 16:9 plate; coordinates are logical stage pixels. */
export type WatercolorPlate = {
  src: string;
  x: number;
  y: number;
  scale: number;
};

export type WatercolorTransitionProps = {
  /** Linear, frame-derived transition progress. Never wall-clock animated. */
  progress: number;
  from: WatercolorPlate;
  to: WatercolorPlate;
  count?: 1 | 2 | 3;
  seed?: number;
  /** First droplet position as frame fractions, with a top-left origin. */
  center?: {x: number; y: number};
  /** Taleframe sliders, normalized to 0…1. */
  water?: number;
  pigment?: number;
  spread?: number;
  width?: number;
  height?: number;
  pixelRatio?: number;
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Watercolor transition: cannot create shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Watercolor transition shader: ${message}`);
  }
  return shader;
}

/** Two source textures are uploaded once; only progress and transforms change. */
class WatercolorRenderer {
  readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly vao: WebGLVertexArrayObject;
  private readonly uniforms: Record<string, WebGLUniformLocation | null> = {};
  private readonly textures = new Map<string, WebGLTexture>();
  private readonly loading = new Map<string, Promise<WebGLTexture>>();
  private disposed = false;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      // Remotion screenshots can occur after the frame was composited. Keeping
      // the buffer avoids a cleared canvas after GPU work has already finished.
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('The Taleframe watercolor transition requires WebGL2.');
    this.gl = gl;
    const vertex = compile(gl, gl.VERTEX_SHADER, WATERCOLOR_VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, WATERCOLOR_FRAGMENT);
    const program = gl.createProgram();
    if (!program) throw new Error('Watercolor transition: cannot create program.');
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Watercolor transition link: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;
    this.vao = gl.createVertexArray()!;
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const uniform = gl.getActiveUniform(program, i);
      if (uniform) this.uniforms[uniform.name] = gl.getUniformLocation(program, uniform.name);
    }
  }

  private texture(src: string): Promise<WebGLTexture> {
    const cached = this.textures.get(src);
    if (cached) return Promise.resolve(cached);
    const pending = this.loading.get(src);
    if (pending) return pending;
    const promise = new Promise<WebGLTexture>((resolve, reject) => {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.onload = async () => {
        try {
          await image.decode();
          if (this.disposed) throw new Error('Watercolor renderer was disposed.');
          const gl = this.gl;
          const texture = gl.createTexture();
          if (!texture) throw new Error(`Could not upload watercolor plate: ${src}`);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          // Taleframe convention: GL bottom-left UVs with upright source images.
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          this.textures.set(src, texture);
          resolve(texture);
        } catch (error) {
          reject(error);
        }
      };
      image.onerror = () => reject(new Error(`Could not load watercolor plate: ${src}`));
      image.src = src;
    });
    this.loading.set(src, promise);
    return promise;
  }

  async prepare(from: WatercolorPlate, to: WatercolorPlate) {
    return Promise.all([this.texture(from.src), this.texture(to.src)]);
  }

  draw(props: Required<WatercolorTransitionProps>, textures: WebGLTexture[]) {
    const {gl, uniforms: u} = this;
    if (gl.isContextLost()) throw new Error('Watercolor transition: WebGL context lost.');
    const {from, to, progress, width, height, count, seed, center, water, pigment, spread} = props;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.disable(gl.BLEND);
    gl.useProgram(this.program);
    for (let i = 0; i < 2; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, textures[i]);
      gl.uniform1i(i === 0 ? u.uA : u.uB, i);
    }
    gl.uniform1f(u.uT, clamp01(progress));
    gl.uniform2f(u.uRes, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform2f(u.uCenter, clamp01(center.x), 1 - clamp01(center.y));
    gl.uniform1i(u.uCount, Math.min(3, Math.max(1, Math.round(count))));
    gl.uniform1ui(u.uSeed, seed >>> 0);
    gl.uniform1f(u.uWater, clamp01(water));
    gl.uniform1f(u.uPigment, clamp01(pigment));
    gl.uniform1f(u.uSpread, clamp01(spread));
    // Taleframe calls this slider «Микропотоки». No extra microtexture or grain.
    gl.uniform1f(u.uGrain, 0);
    gl.uniform3f(u.uTransformA, from.x / width, -from.y / height, from.scale);
    gl.uniform3f(u.uTransformB, to.x / width, -to.y / height, to.scale);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
    // Finish before releasing Remotion's screenshot barrier. No rAF/wall time,
    // including random frame seeks and simultaneous render workers.
    gl.finish();
    const error = gl.getError();
    if (error !== gl.NO_ERROR) throw new Error(`Watercolor transition WebGL error: 0x${error.toString(16)}`);
  }

  dispose() {
    this.disposed = true;
    for (const texture of this.textures.values()) this.gl.deleteTexture(texture);
    this.textures.clear();
    this.loading.clear();
    this.gl.deleteVertexArray(this.vao);
    this.gl.deleteProgram(this.program);
  }
}

/**
 * Exact Taleframe watercolor v4 transition between two moving background plates.
 * Mount only during the transition window; keep UI as a separate layer above it.
 * Defaults are Taleframe's settings, apart from the requested 1–3 drop limit and
 * disabled microflows. The source images remain sharp: only UVs refract.
 */
export function WatercolorTransition({
  progress,
  from,
  to,
  count = 2,
  seed = 42,
  center = {x: .45, y: .5},
  water = .72,
  pigment = .70,
  spread = .65,
  width = 1920,
  height = 1080,
  pixelRatio = 2,
}: WatercolorTransitionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<WatercolorRenderer | null>(null);
  useLayoutEffect(() => {
    if (!canvasRef.current) return;
    try {
      rendererRef.current = new WatercolorRenderer(canvasRef.current);
    } catch (error) {
      cancelRender(error);
    }
    return () => {
      rendererRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const handle = delayRender('Taleframe watercolor: textures and GPU frame');
    let active = true;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        continueRender(handle);
      }
    };
    renderer.prepare(from, to).then(textures => {
      if (!active) return;
      renderer.draw({progress, from, to, count, seed, center, water, pigment, spread, width, height, pixelRatio}, textures);
      release();
    }).catch(error => {
      if (active) cancelRender(error);
      release();
    });
    return () => {
      active = false;
      release();
    };
  }, [progress, from.src, from.x, from.y, from.scale, to.src, to.x, to.y, to.scale,
    count, seed, center.x, center.y, water, pigment, spread, width, height, pixelRatio]);

  return <canvas ref={canvasRef} width={Math.round(width * pixelRatio)} height={Math.round(height * pixelRatio)}
    aria-hidden style={{position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none'}}/>;
}
