/** Expanding glass meniscus with a smooth aperture and dispersive refraction. */
import { bindTex, fullscreen, pointToGl, program } from '../kit';
import type { TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';
export const meta: TransitionMeta = {
  id: 'prism', name_ru: 'Линза', description_ru: 'Мягкая стеклянная волна преломляет кадр и разделяет свет на спектр.',
  defaultDurationSec: 1.1, minDurationSec: 0.3, maxDurationSec: 4, defaultEase: [0.4, 0, 0.2, 1], version: 3,
};
export const params: readonly TransitionParam[] = [
  { id: 'center', type: 'point', label_ru: 'Центр линзы', default: { x: 0.5, y: 0.5 } },
  { id: 'refraction', type: 'number', label_ru: 'Преломление', min: 0, max: 100, step: 1, default: 62, unit: '%' },
  { id: 'thickness', type: 'number', label_ru: 'Толщина стекла', min: 2, max: 25, step: 0.5, default: 10, unit: '%' },
  { id: 'dispersion', type: 'number', label_ru: 'Спектр', min: 0, max: 100, step: 1, default: 36, unit: '%' },
  { id: 'softness', type: 'number', label_ru: 'Мягкость края', min: 0, max: 100, step: 1, default: 65, unit: '%' },
];
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uA, uB;
uniform vec2 uRes, uCenter;
uniform float uT, uRefract, uWidth, uDispersion, uSoftness;
out vec4 outColor;
vec2 glassRay(vec3 normal, float ior, float depth) {
  vec3 ray = refract(vec3(0, 0, -1), normal, 1.0 / ior);
  return ray.xy / max(-ray.z, 0.25) * depth;
}
vec3 spectral(sampler2D tex, vec2 uv, vec2 red, vec2 green, vec2 blue) {
  return vec3(texture(tex, clamp(uv+red, 0.0, 1.0)).r,
              texture(tex, clamp(uv+green, 0.0, 1.0)).g,
              texture(tex, clamp(uv+blue, 0.0, 1.0)).b);
}
void main() {
  if (uT <= 0.0) { outColor = vec4(texture(uA, vUv).rgb, 1); return; }
  if (uT >= 1.0) { outColor = vec4(texture(uB, vUv).rgb, 1); return; }
  float shortSide = min(uRes.x, uRes.y);
  vec2 aspect = uRes / shortSide;
  vec2 q = (vUv-uCenter) * aspect;
  float len = length(q);
  vec2 radial = q / max(len, 0.0001);
  float reach = length(max(uCenter, 1.0-uCenter) * aspect);
  float radius = mix(-uWidth*2.0, reach+uWidth*2.0, uT);
  float dist = len-radius;
  float x = dist / uWidth;
  float rim = exp(-x*x*0.65);
  float envelope = smoothstep(0.0, 0.09, uT) * (1.0-smoothstep(0.85, 1.0, uT));
  // Derivative of a rounded annular glass height: opposite slopes focus and
  // defocus opposite sides of the wave, unlike a flat displaced circle.
  float slope = x * rim * 3.8 * uRefract * envelope;
  vec3 normal = normalize(vec3(radial*slope, 1.0));
  float depth = uWidth * 3.2;
  float spectralSpread = uDispersion * 0.11;
  vec2 red = glassRay(normal, 1.46-spectralSpread, depth) / aspect;
  vec2 green = glassRay(normal, 1.46, depth) / aspect;
  vec2 blue = glassRay(normal, 1.46+spectralSpread, depth) / aspect;
  float aa = max(fwidth(dist)*0.7, 0.65/shortSide);
  float feather = max(aa, uWidth * mix(0.025, 0.78, uSoftness));
  float mask = 1.0-smoothstep(-feather, feather, dist);
  // The interior also magnifies slightly; it settles back as the lens exits.
  vec2 interior = -q/aspect * (0.14*uRefract*envelope*mask);
  vec3 a = spectral(uA, vUv, red*0.7, green*0.7, blue*0.7);
  vec3 b = spectral(uB, vUv+interior, -red, -green, -blue);
  // Refraction and dispersion only resample video. No rim light or shadow.
  outColor = vec4(mix(a,b,mask),1);
}`;
export function create(gl: WebGL2RenderingContext): TransitionInstance {
  const { program: prog, u } = program(gl, FRAG);
  return {
    render({ texA, texB, width, height, eased, params: p, target }) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target); gl.viewport(0, 0, width, height); gl.useProgram(prog);
      bindTex(gl, u.uA, texA, 0); bindTex(gl, u.uB, texB, 1);
      gl.uniform2f(u.uRes, width, height); gl.uniform2fv(u.uCenter, pointToGl(p.center)); gl.uniform1f(u.uT, eased);
      gl.uniform1f(u.uRefract, Number(p.refraction)/100); gl.uniform1f(u.uWidth, Number(p.thickness)/100);
      gl.uniform1f(u.uDispersion, Number(p.dispersion)/100);
      gl.uniform1f(u.uSoftness, Number(p.softness ?? 65)/100); fullscreen(gl);
    },
    dispose() { gl.deleteProgram(prog); },
  };
}
export default { meta, params, create } satisfies TransitionModule;
