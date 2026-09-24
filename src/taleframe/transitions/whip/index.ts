/** A camera throw integrated over an exposure, with dolly-in and lens curvature. */
import { bindTex, dirVec, fullscreen, GLSL, program, target as createTarget } from '../kit';
import type { TransitionEnv, TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';
export const meta: TransitionMeta = {
  id: 'whip', name_ru: 'Рывок', description_ru: 'Разгон камеры, длинный направленный шлейф и приближение с мягкой остановкой.',
  defaultDurationSec: 0.65, minDurationSec: 0.2, maxDurationSec: 3, defaultEase: [0.65, 0, 0.35, 1], version: 2,
};
export const params: readonly TransitionParam[] = [
  { id: 'direction', type: 'direction', label_ru: 'Направление', default: 'left', options: ['left', 'right', 'up', 'down'] },
  { id: 'travel', type: 'number', label_ru: 'Размах', min: 30, max: 180, step: 1, default: 100, unit: '%' },
  { id: 'shutter', type: 'number', label_ru: 'Шлейф', min: 0, max: 100, step: 1, default: 72, unit: '%' },
  { id: 'bank', type: 'number', label_ru: 'Наклон', min: -15, max: 15, step: 0.5, default: 3, unit: '°' },
  { id: 'zoom', type: 'number', label_ru: 'Приближение', min: 0, max: 100, step: 1, default: 42, unit: '%' },
  { id: 'distortion', type: 'number', label_ru: 'Кривизна линзы', min: 0, max: 100, step: 1, default: 35, unit: '%' },
];
const FILTER = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform vec2 uStep;
uniform bool uLinear;
out vec4 outColor;
${GLSL.srgb}
vec2 mirrorUv(vec2 uv) { return 1.0-abs(mod(uv, 2.0)-1.0); }
void main() {
  // Reconstruct the area between temporal samples instead of leaving comb-like
  // trails on fine text. This is a narrow 1D prefilter, aligned to the throw.
  vec3 sum = vec3(0); float weight = 0.0;
  for (int i=-3; i<=3; i++) {
    float k = float(i); float w = exp(-k*k*0.5);
    sum += toLinear(texture(uSource, mirrorUv(vUv+uStep*k)).rgb) * w;
    weight += w;
  }
  vec3 col = sum/weight;
  outColor = vec4(uLinear ? col : toSrgb(col), 1);
}`;
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uA, uB;
uniform vec2 uRes;
uniform float uT;
uniform vec4 uCamera[48], uPath[48];
uniform bool uLinear;
out vec4 outColor;
${GLSL.srgb}
vec2 mirrorUv(vec2 uv) { return 1.0-abs(mod(uv, 2.0)-1.0); }
void main() {
  if (uT <= 0.0) { outColor = vec4(texture(uA, vUv).rgb, 1); return; }
  if (uT >= 1.0) { outColor = vec4(texture(uB, vUv).rgb, 1); return; }
  vec2 aspect = uRes/min(uRes.x, uRes.y);
  vec2 original = (vUv-0.5)*aspect;
  float radiusNorm = max(dot(aspect,aspect)*0.25, 0.25);
  vec3 total = vec3(0); float weights = 0.0;
  // A stationary stratified offset removes coherent comb bands on fine detail.
  // It changes sampling inside the shutter, never the source image itself.
  float jitter = fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));
  // CPU-precomputed camera matrices save repeated transcendental evaluation
  // at every pixel. Each sample still integrates its own zoom, bank and lens.
  for (int i = 0; i < 48; i++) {
    int next = min(i+1, 47);
    vec4 camera = mix(uCamera[i], uCamera[next], jitter);
    vec4 path = uPath[i].z == uPath[next].z ? mix(uPath[i], uPath[next], jitter) : uPath[i];
    vec2 q = mat2(camera.x, -camera.y, camera.y, camera.x)*original;
    q *= 1.0 + camera.z*dot(q,q)/radiusNorm;
    vec2 uv = mirrorUv(q/aspect+0.5+path.xy);
    vec3 sampleColor = path.z > 0.5 ? texture(uB, uv).rgb : texture(uA, uv).rgb;
    total += (uLinear ? sampleColor : toLinear(sampleColor)) * camera.w;
    weights += camera.w;
  }
  outColor = vec4(toSrgb(total / weights), 1);
}`;
export function create(gl: WebGL2RenderingContext, env: TransitionEnv): TransitionInstance {
  const main = program(gl, FRAG), filter = program(gl, FILTER);
  const linear = env.floatTargets;
  const a = createTarget(gl, { format: linear ? 'rgba16f' : 'rgba8' });
  const b = createTarget(gl, { format: linear ? 'rgba16f' : 'rgba8' });
  const cameraSamples = new Float32Array(48*4), pathSamples = new Float32Array(48*4);
  return {
    render({ texA, texB, width, height, eased, params: p, target }) {
      const direction = dirVec(p.direction), travel = Number(p.travel)/100, shutter = Number(p.shutter)/100;
      const pulse = Math.sin(Math.max(0, Math.min(1, eased))*Math.PI)**2;
      const exposure = 0.55*shutter*pulse;
      const fastest = Math.min(0.5, Math.min(eased, 1-eased)+exposure*0.5);
      const velocity = 11.4*fastest**2*travel;
      const spacing = velocity*exposure/48;
      const filtered = eased > 0 && eased < 1 && spacing*Math.max(width, height) > 0.55;
      if (filtered) {
        gl.useProgram(filter.program);
        gl.uniform2f(filter.u.uStep, direction[0]*spacing*1.1, direction[1]*spacing*1.1);
        gl.uniform1i(filter.u.uLinear, linear ? 1 : 0);
        a.ensure(width, height).bind(); bindTex(gl, filter.u.uSource, texA, 0); fullscreen(gl);
        b.ensure(width, height).bind(); bindTex(gl, filter.u.uSource, texB, 0); fullscreen(gl);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, target); gl.viewport(0, 0, width, height); gl.useProgram(main.program);
      const u = main.u;
      bindTex(gl, u.uA, filtered ? a.tex : texA, 0); bindTex(gl, u.uB, filtered ? b.tex : texB, 1);
      gl.uniform1i(u.uLinear, filtered && linear ? 1 : 0);
      gl.uniform2f(u.uRes, width, height); gl.uniform1f(u.uT, eased);
      const bank = Number(p.bank)*Math.PI/180, zoom = Number(p.zoom ?? 42)/100, lens = Number(p.distortion ?? 35)/100;
      for (let i=0; i<48; i++) {
        const sample = (i+0.5)/48, t = Math.max(0, Math.min(1, eased+(sample-0.5)*exposure));
        const wave = Math.sin(t*Math.PI)**2, angle = bank*wave, scale = 1/(1+zoom*wave);
        const incoming = t >= 0.5, local = incoming ? 1-t : t;
        const distance = 3.8*local**3*travel*(incoming ? 1 : -1), offset = i*4;
        cameraSamples[offset] = Math.cos(angle)*scale;
        cameraSamples[offset+1] = Math.sin(angle)*scale;
        cameraSamples[offset+2] = lens*0.28*wave;
        cameraSamples[offset+3] = Math.sin(sample*Math.PI);
        pathSamples[offset] = direction[0]*distance;
        pathSamples[offset+1] = direction[1]*distance;
        pathSamples[offset+2] = incoming ? 1 : 0;
      }
      gl.uniform4fv(u.uCamera, cameraSamples); gl.uniform4fv(u.uPath, pathSamples); fullscreen(gl);
    },
    dispose() { gl.deleteProgram(main.program); gl.deleteProgram(filter.program); a.dispose(); b.dispose(); },
  };
}
export default { meta, params, create } satisfies TransitionModule;
