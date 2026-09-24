/** Image-only marbling: area-preserving shears and vortices stretch two scenes into lamellae. */
import { bindTex, dirVec, fullscreen, GLSL, program } from '../kit';
import { DIRECTIONS, type TransitionInstance, type TransitionMeta, type TransitionModule, type TransitionParam } from '../types';

export const meta: TransitionMeta = {
  id: 'marbling', name_ru: 'Мрамор', description_ru: 'Два кадра закручиваются в широкие жидкие складки и плавно распрямляются.',
  defaultDurationSec: 1.8, minDurationSec: 0.5, maxDurationSec: 5, defaultEase: 'linear', version: 1,
};
export const params: readonly TransitionParam[] = [
  { id: 'direction', type: 'direction', label_ru: 'Течение', options: DIRECTIONS, default: 'up-right' },
  { id: 'flow', type: 'number', label_ru: 'Сила течения', min: 0, max: 100, default: 66, step: 1, unit: '%' },
  { id: 'folds', type: 'number', label_ru: 'Складки', min: 2, max: 8, default: 3, step: 1 },
  { id: 'vortex', type: 'number', label_ru: 'Завихрения', min: 0, max: 100, default: 72, step: 1, unit: '%' },
  { id: 'mixing', type: 'number', label_ru: 'Смешивание', min: 0, max: 100, default: 12, step: 1, unit: '%' },
  { id: 'seed', type: 'seed', label_ru: 'Течение', default: 319 },
];
const FRAG = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
uniform sampler2D uA,uB;
uniform vec2 uRes,uDir;
uniform float uT,uFlow,uFolds,uVortex,uMixing;
uniform uint uSeed;
out vec4 outColor;
${GLSL.hash}
${GLSL.srgb}
vec2 rotate(vec2 q,float angle) { float c=cos(angle),s=sin(angle); return mat2(c,s,-s,c)*q; }
vec2 foldFlow(vec2 q,float amount,float phase) {
  // Each shear has determinant one. Their composition folds material without
  // the pulsing scale changes of time-varying noise displacement.
  q.x += sin(q.y*3.8+phase)*amount*0.42;
  q.y += sin(q.x*4.5-phase*0.7)*amount*0.35;
  q.x += sin(q.y*7.1+phase*0.4)*amount*0.16;
  for (int i=0;i<3;i++) {
    vec2 c=(hash22i(ivec2(i,3),uSeed)-0.5)*vec2(1.65,1.2);
    vec2 d=q-c;
    float spin=exp(-dot(d,d)*3.8)*amount*uVortex*(i==1 ? -2.9 : 2.5);
    q=c+rotate(d,spin);
  }
  return q;
}
void main() {
  if (uT <= 0.0) { outColor=vec4(texture(uA,vUv).rgb,1); return; }
  if (uT >= 1.0) { outColor=vec4(texture(uB,vUv).rgb,1); return; }
  vec2 aspect=uRes/min(uRes.x,uRes.y), q=(vUv-0.5)*aspect;
  vec2 across=vec2(-uDir.y,uDir.x);
  vec2 local=vec2(dot(q,uDir),dot(q,across));
  float phase=hash2i(ivec2(4,5),uSeed)*6.2831853;
  float envelope=sin(uT*3.14159265);
  vec2 material=foldFlow(local,0.65+uFlow*0.7,phase);
  float lamella=sin(material.y*uFolds*3.14159265+sin(material.x*2.1+phase)*0.7);
  float level=0.5+lamella*0.28+0.12*sin(material.x*2.7-phase);
  float threshold=mix(-0.08,1.08,smoothstep(0.06,0.94,uT));
  float aa=max(fwidth(level)*0.6,0.001);
  float softness=aa+uMixing*0.08;
  float mask=1.0-smoothstep(threshold-softness,threshold+softness,level);
  vec2 transported=foldFlow(local,uFlow*envelope,phase+uT*0.48);
  vec2 drift=(transported-local);
  // Two sides of the lamella slide past one another before returning to their
  // original registration. Colours remain a normalized A/B mixture throughout.
  vec2 world=(drift.x*uDir+drift.y*across)/aspect;
  // Compress the backtrace smoothly near the frame boundary. Clamping a
  // long trace there would stretch one edge texel into a conspicuous stripe.
  vec2 room=max(min(vUv,1.0-vUv),vec2(0.0001));
  vec2 bendA=world*0.68, bendB=-world*0.5;
  bendA/=1.0+abs(bendA)/room; bendB/=1.0+abs(bendB)/room;
  vec3 a=toLinear(texture(uA,vUv+bendA).rgb);
  vec3 b=toLinear(texture(uB,vUv+bendB).rgb);
  outColor=vec4(toSrgb(mix(a,b,mask)),1);
}`;
export function create(gl: WebGL2RenderingContext): TransitionInstance {
  const { program: prog, u }=program(gl,FRAG);
  return {
    render({ texA, texB, width, height, eased, params: p, target }) {
      gl.bindFramebuffer(gl.FRAMEBUFFER,target); gl.viewport(0,0,width,height); gl.useProgram(prog);
      bindTex(gl,u.uA,texA,0); bindTex(gl,u.uB,texB,1);
      gl.uniform2f(u.uRes,width,height); gl.uniform2fv(u.uDir,dirVec(p.direction)); gl.uniform1f(u.uT,eased);
      gl.uniform1f(u.uFlow,Number(p.flow)/100); gl.uniform1f(u.uFolds,Number(p.folds));
      gl.uniform1f(u.uVortex,Number(p.vortex)/100); gl.uniform1f(u.uMixing,Number(p.mixing)/100);
      gl.uniform1ui(u.uSeed,Number(p.seed)>>>0); fullscreen(gl);
    },
    dispose() { gl.deleteProgram(prog); },
  };
}
export default { meta, params, create } satisfies TransitionModule;
