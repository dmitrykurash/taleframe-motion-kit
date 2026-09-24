/** Seeded liquid pools: crisp menisci carry source pixels in a coherent flow. */
import { bindTex, fullscreen, GLSL, pointToGl, program } from '../kit';
import type { TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';
export const meta: TransitionMeta = {
  id: 'ink', name_ru: 'Тушь', description_ru: 'Тушь сливается в живые потоки и проявляет кадр под влажной кромкой.',
  defaultDurationSec: 1.55, minDurationSec: 0.4, maxDurationSec: 5, defaultEase: 'linear', version: 3,
};
export const params: readonly TransitionParam[] = [
  { id: 'center', type: 'point', label_ru: 'Первая капля', default: { x: 0.44, y: 0.53 } },
  { id: 'spread', type: 'number', label_ru: 'Разброс капель', min: 0, max: 100, step: 1, default: 85, unit: '%' },
  { id: 'texture', type: 'number', label_ru: 'Волокна', min: 0, max: 100, step: 1, default: 65, unit: '%' },
  { id: 'wetness', type: 'number', label_ru: 'Влажность', min: 0, max: 100, step: 1, default: 55, unit: '%' },
  { id: 'seed', type: 'seed', label_ru: 'Рисунок', default: 83 },
  { id: 'flow', type: 'number', label_ru: 'Движение краски', min: 0, max: 100, step: 1, default: 72, unit: '%', advanced: true },
];
const FRAG = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
uniform sampler2D uA, uB;
uniform vec2 uRes, uCenter;
uniform float uT, uSpread, uTexture, uWet, uFlow;
uniform uint uSeed;
out vec4 outColor;
${GLSL.hash}
${GLSL.noise}
float softUnion(float a, float b, float k) {
  float h = max(k-abs(a-b),0.0)/k;
  return min(a,b)-h*h*k*0.25;
}
// Curl of a small analytic stream function: a coherent incompressible field,
// independently evaluable at any scrub time. No feedback or boiling pixel noise.
vec2 flowAt(vec2 q, float phase) {
  float a = q.x*8.1 + phase, b = q.y*7.3 - phase*0.7;
  float c = dot(q,vec2(5.8,6.2)) + phase*0.4;
  return vec2(0.65*cos(b)+0.34*cos(c), -0.58*cos(a)-0.318*cos(c));
}
void main() {
  if (uT <= 0.0) { outColor = vec4(texture(uA, vUv).rgb, 1); return; }
  if (uT >= 1.0) { outColor = vec4(texture(uB, vUv).rgb, 1); return; }
  float shortSide = min(uRes.x,uRes.y);
  vec2 aspect = uRes/shortSide, q = vUv*aspect;
  float phase = hash2i(ivec2(9,7),uSeed)*6.2831853 + uT*1.25;
  vec2 flow = flowAt(q,phase);
  vec2 wetQ = q + flow*0.025*uTexture;
  float n = fbm(wetQ*7.0, uSeed+71u, 4)-0.46;
  float fine = vnoise(wetQ*123.0, uSeed+312u)-0.5;
  float field = 100.0;
  for (int i=0; i<5; i++) {
    vec2 random = hash22i(ivec2(i,3), uSeed);
    vec2 center = clamp(uCenter + (random-0.5)*uSpread*1.5*min(float(i),1.0), vec2(0.015), vec2(0.985));
    float delay = i == 0 ? 0.0 : 0.11+random.x*0.24;
    float local = clamp((uT-delay)/(1.0-delay),0.0,1.0);
    float reach = length(max(center,1.0-center)*aspect);
    float radius = (pow(local,1.15)*1.16-0.13+smoothstep(0.80,0.99,uT)*0.13)*reach;
    float d = length(wetQ-center*aspect) + (n*0.15+fine*0.006)*uTexture - radius;
    field = softUnion(field,d,0.025+0.045*uWet);
  }
  // Wetness controls liquid behavior, not a large Gaussian mask blur.
  float aa = max(fwidth(field)*0.60, 0.6/shortSide);
  float covered = 1.0-smoothstep(-aa,aa,field);
  float fade = smoothstep(0.015,0.13,uT)*(1.0-smoothstep(0.79,1.0,uT));
  vec2 gradient = vec2(dFdx(field),dFdy(field))*shortSide;
  vec2 normal = gradient/max(length(gradient),0.001);
  float mobile = exp(-abs(field)/0.15)*fade*uFlow*(0.35+0.65*uWet);
  // A short backtrace of the incoming image makes pigment advect its content.
  vec2 nextFlow = flowAt(q-flow*0.04,phase-0.15);
  vec2 liquid = (flow+nextFlow)*0.5;
  vec2 bend = (liquid*0.075 + normal*sin(field*49.0)*0.014)*mobile/aspect;
  vec3 a = texture(uA,clamp(vUv+bend*0.36,vec2(0),vec2(1))).rgb;
  vec3 b = texture(uB,clamp(vUv-bend,vec2(0),vec2(1))).rgb;
  // The liquid transports source pixels; it never dyes or illuminates them.
  outColor = vec4(mix(a,b,covered),1);
}`;
export function create(gl: WebGL2RenderingContext): TransitionInstance {
  const { program: prog, u } = program(gl, FRAG);
  return {
    render({ texA, texB, width, height, eased, params: p, target }) {
      gl.bindFramebuffer(gl.FRAMEBUFFER,target); gl.viewport(0,0,width,height); gl.useProgram(prog);
      bindTex(gl,u.uA,texA,0); bindTex(gl,u.uB,texB,1); gl.uniform2f(u.uRes,width,height);
      gl.uniform2fv(u.uCenter,pointToGl(p.center)); gl.uniform1f(u.uT,eased);
      gl.uniform1f(u.uSpread,Number(p.spread)/100); gl.uniform1f(u.uTexture,Number(p.texture)/100);
      gl.uniform1f(u.uWet,Number(p.wetness)/100); gl.uniform1f(u.uFlow,Number(p.flow ?? 72)/100);
      gl.uniform1ui(u.uSeed,Number(p.seed)>>>0); fullscreen(gl);
    },
    dispose() { gl.deleteProgram(prog); },
  };
}
export default { meta, params, create } satisfies TransitionModule;
