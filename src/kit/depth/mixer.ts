// Taleframe's transition shaders (watercolor, ink, engraving, waterspill…) driven imperatively: hand it two finished
// pictures and a progress value, and it paints the mix into its own WebGL2 canvas. Depth films use it for cuts that
// travel through something in the picture, with the shader's centre following an anchor.
import {cubicBezier} from '../../taleframe/transitions/easing';
import {CONTEXT_ATTRS, TransitionHost} from '../../taleframe/transitions/host';
import {getTransitionModule, hasTransition, resolveParams} from '../../taleframe/transitions/registry';
import type {TransitionParamValue} from '../../taleframe/transitions/types';

export type DepthMix = {
  /** A Taleframe transition kind: 'watercolor', 'ink', 'engraving', 'waterspill', … (docs/transitions.md). */
  kind: string;
  params?: Record<string, TransitionParamValue>;
  /** Cubic-bezier easing of the shader's progress. Linear by default: the camera already eases through the cut. */
  ease?: [number, number, number, number];
  /** Nominal length in seconds, passed to shaders that time internal phases. */
  duration: number;
};

let runtime: {canvas: HTMLCanvasElement; gl: WebGL2RenderingContext; host: TransitionHost} | null = null;

function host(width: number, height: number) {
  if (runtime && !runtime.gl.isContextLost() && runtime.canvas.width === width && runtime.canvas.height === height) return runtime;
  if (runtime && !runtime.gl.isContextLost()) runtime.host.dispose();
  const canvas = Object.assign(document.createElement('canvas'), {width, height});
  const gl = canvas.getContext('webgl2', {...CONTEXT_ATTRS, preserveDrawingBuffer: true});
  if (!gl) throw new Error('Depth film transitions need WebGL2 (render with --gl angle or swangle).');
  runtime = {canvas, gl, host: new TransitionHost(gl)};
  return runtime;
}

/** Mix picture a → b at linear progress p (0..1) with a Taleframe shader. Both pictures must have the same size.
 * Returns the shared WebGL canvas: draw it before the next call. */
export function mixCanvases(a: HTMLCanvasElement, b: HTMLCanvasElement, p: number, m: DepthMix, fps: number): HTMLCanvasElement {
  if (!hasTransition(m.kind)) throw new Error(`Unknown transition "${m.kind}". See docs/transitions.md for the available names.`);
  if (a.width !== b.width || a.height !== b.height) throw new Error('Both pictures of a mix must have the same size.');
  const {width, height} = a;
  const {canvas, gl, host: h} = host(width, height);
  const module = getTransitionModule(m.kind);
  const instance = h.instance(module);
  if (!instance) throw new Error(`Cannot initialize transition ${m.kind}.`);
  const progress = Math.max(0, Math.min(1, p));
  const eased = m.ease ? cubicBezier(...m.ease)(progress) : progress;
  h.ensureInputs(width, height, !!module.meta.inputs?.mipmaps);
  h.upload('A', a); h.upload('B', b);
  const ok = h.render(instance, {progress, eased, seconds: progress * m.duration, durationSec: m.duration, fps,
    params: resolveParams(m.kind, m.params), width, height, pxScale: Math.min(width, height) / 1080, target: null, draft: false});
  if (!ok) throw new Error(`Transition ${m.kind} failed to render.`);
  h.sync();
  const err = gl.getError();
  if (err !== gl.NO_ERROR) throw new Error(`Transition ${m.kind}: WebGL error 0x${err.toString(16)}.`);
  return canvas;
}
