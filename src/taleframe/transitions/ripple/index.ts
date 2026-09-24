/** Superposed dispersive wave packets refract both images, with no synthetic light. */
import { bindTex, fullscreen, GLSL, pointToGl, program } from '../kit';
import type { TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';

export const meta: TransitionMeta = {
  id: 'ripple', name_ru: 'Рябь', description_ru: 'Столкнувшиеся волны преломляют изображение и открывают следующую сцену.',
  defaultDurationSec: 1.7, minDurationSec: 0.45, maxDurationSec: 5, defaultEase: 'linear', version: 1,
};
export const params: readonly TransitionParam[] = [
  { id: 'center', type: 'point', label_ru: 'Первая волна', default: { x: 0.38, y: 0.54 } },
  { id: 'strength', type: 'number', label_ru: 'Преломление', min: 0, max: 100, default: 64, step: 1, unit: '%' },
  { id: 'wavelength', type: 'number', label_ru: 'Длина волны', min: 4, max: 22, default: 10, step: 0.5, unit: '%' },
  { id: 'impacts', type: 'number', label_ru: 'Число волн', min: 1, max: 5, default: 3, step: 1 },
  { id: 'damping', type: 'number', label_ru: 'Затухание', min: 0, max: 100, default: 56, step: 1, unit: '%' },
  { id: 'seed', type: 'seed', label_ru: 'Расположение', default: 47 },
];
const FRAG = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
uniform sampler2D uA,uB;
uniform vec2 uRes,uCenter;
uniform float uT,uStrength,uWavelength,uImpacts,uDamping;
uniform uint uSeed;
out vec4 outColor;
${GLSL.hash}
${GLSL.srgb}
void main() {
  if (uT <= 0.0) { outColor=vec4(texture(uA,vUv).rgb,1); return; }
  if (uT >= 1.0) { outColor=vec4(texture(uB,vUv).rgb,1); return; }
  vec2 aspect=uRes/min(uRes.x,uRes.y), q=vUv*aspect;
  float reach=length(max(uCenter,1.0-uCenter)*aspect);
  float k=6.2831853/uWavelength;
  vec2 slope=vec2(0);
  float wet=0.0;
  for (int i=0;i<5;i++) {
    if (float(i)>=uImpacts) break;
    vec2 r=hash22i(ivec2(i,17),uSeed);
    vec2 center=i==0 ? uCenter : clamp(uCenter+(r-0.5)*1.15,0.04,0.96);
    float delay=float(i)*0.052+r.x*0.035*min(float(i),1.0);
    float age=max(uT-delay,0.0);
    vec2 d=q-center*aspect;
    float len=length(d);
    vec2 radial=d/max(len,0.0001);
    float radius=age*(reach+0.65)*1.42;
    float behind=radius-len;
    float leading=smoothstep(-0.055,0.055,behind);
    float decay=exp(-max(behind,0.0)*(1.0+uDamping*4.5));
    float phase=k*(len-radius);
    // The second frequency travels at a different phase speed: the packet
    // opens into a dispersive train rather than rigid concentric rings.
    float packet=sin(phase)+0.32*sin(phase*1.57+age*7.0);
    float localSlope=(cos(phase)+0.50*cos(phase*1.57+age*7.0))*leading*decay;
    slope+=radial*localSlope/(1.0+float(i)*0.35);
    wet=max(wet,leading*smoothstep(0.0,0.085,age));
    slope+=radial*packet*0.12*leading*decay;
  }
  float settle=1.0-smoothstep(0.63,1.0,uT);
  vec2 normal=normalize(vec3(slope*uStrength*1.9,1.0)).xy;
  vec2 bend=normal*(0.075*uStrength)*settle/aspect;
  float reveal=smoothstep(0.13,0.78,uT);
  float mask=clamp(reveal*(0.58+0.42*wet)+smoothstep(0.75,0.98,uT),0.0,1.0);
  vec3 a=toLinear(texture(uA,clamp(vUv+bend,0.0,1.0)).rgb);
  vec3 b=toLinear(texture(uB,clamp(vUv-bend*0.72,0.0,1.0)).rgb);
  outColor=vec4(toSrgb(mix(a,b,mask)),1);
}`;
export function create(gl: WebGL2RenderingContext): TransitionInstance {
  const { program: prog, u }=program(gl,FRAG);
  return {
    render({ texA, texB, width, height, eased, params: p, target }) {
      gl.bindFramebuffer(gl.FRAMEBUFFER,target); gl.viewport(0,0,width,height); gl.useProgram(prog);
      bindTex(gl,u.uA,texA,0); bindTex(gl,u.uB,texB,1);
      gl.uniform2f(u.uRes,width,height); gl.uniform2fv(u.uCenter,pointToGl(p.center)); gl.uniform1f(u.uT,eased);
      gl.uniform1f(u.uStrength,Number(p.strength)/100); gl.uniform1f(u.uWavelength,Number(p.wavelength)/100);
      gl.uniform1f(u.uImpacts,Number(p.impacts)); gl.uniform1f(u.uDamping,Number(p.damping)/100);
      gl.uniform1ui(u.uSeed,Number(p.seed)>>>0); fullscreen(gl);
    },
    dispose() { gl.deleteProgram(prog); },
  };
}
export default { meta, params, create } satisfies TransitionModule;
