/** Source-guided light shafts. All ray samples have positive, normalized weights. */
import { bindTex, fullscreen, GLSL, pointToGl, program } from '../kit';
import type { TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';

export const meta: TransitionMeta = {
  id: 'godrays', name_ru: 'Лучи', description_ru: 'Светлые детали вытягиваются в объёмные лучи и проявляют следующую сцену.',
  defaultDurationSec: 1.55, minDurationSec: 0.4, maxDurationSec: 5, defaultEase: 'linear', version: 1,
  inputs: { mipmaps: true },
};
export const params: readonly TransitionParam[] = [
  { id: 'center', type: 'point', label_ru: 'Источник лучей', default: { x: 0.48, y: 0.35 } },
  { id: 'length', type: 'number', label_ru: 'Длина лучей', min: 0, max: 100, default: 74, step: 1, unit: '%' },
  { id: 'focus', type: 'number', label_ru: 'Светлые детали', min: 0, max: 100, default: 72, step: 1, unit: '%' },
  { id: 'density', type: 'number', label_ru: 'Плотность лучей', min: 0, max: 100, default: 75, step: 1, unit: '%' },
  { id: 'spread', type: 'number', label_ru: 'Рассеивание', min: 0, max: 100, default: 36, step: 1, unit: '%' },
  { id: 'drift', type: 'number', label_ru: 'Движение источника', min: 0, max: 100, default: 32, step: 1, unit: '%' },
];
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uA,uB;
uniform vec2 uRes,uCenter;
uniform float uT,uLength,uFocus,uDensity,uSpread,uDrift;
out vec4 outColor;
${GLSL.luma}
vec3 shafts(sampler2D tex,vec2 ray,float length,float lod) {
  vec3 sum=vec3(0);
  float norm=0.0;
  // Integrate a footprint as wide as the spacing between radial samples;
  // the undistorted image is composed separately to retain its fine detail.
  for (int i=0;i<32;i++) {
    float s=(float(i)+0.5)/32.0;
    vec2 uv=clamp(vUv-ray*s*length,0.0,1.0);
    vec3 c=textureLod(tex,uv,lod).rgb;
    float lum=luma(c);
    float lum2=lum*lum;
    float weight=exp(-s*(1.5-uSpread))* (0.18+mix(lum2,lum2*lum2,uFocus)*(1.0+uFocus*18.0));
    sum+=c*weight;
    norm+=weight;
  }
  return sum/max(norm,0.00001);
}
void main() {
  if (uT <= 0.0) { outColor=vec4(texture(uA,vUv).rgb,1); return; }
  if (uT >= 1.0) { outColor=vec4(texture(uB,vUv).rgb,1); return; }
  vec2 aspect=uRes/min(uRes.x,uRes.y);
  float envelope=pow(sin(uT*3.14159265),1.3);
  vec2 center=uCenter+vec2(sin(uT*3.14159265)*0.08,(uT-0.5)*0.14)*uDrift/aspect;
  vec2 ray=vUv-center;
  float rayLength=uLength*envelope*0.92;
  // Sample footprint grows with radial path length; mipmaps avoid combing
  // through fine typography and video detail at the end of long rays.
  float footprint=length(ray*uRes)*rayLength/32.0;
  float lod=clamp(log2(max(footprint,1.0))+uSpread*0.8,0.0,7.0);
  vec3 a=texture(uA,vUv).rgb, b=texture(uB,vUv).rgb;
  vec3 ra=shafts(uA,ray,rayLength,lod);
  vec3 rb=shafts(uB,ray,rayLength*0.85,lod);
  float distanceToLight=length(ray*aspect);
  float influence=(luma(rb)-luma(b))*0.36-(luma(ra)-luma(a))*0.16;
  float clock=uT+influence*envelope+(0.45-distanceToLight)*0.10*envelope;
  float mask=smoothstep(0.17,0.83,clock);
  float coverage=envelope*uDensity;
  // No additive white/exposure term: ray transport redistributes existing
  // source radiance, so identical constant images remain exactly constant.
  outColor=vec4(mix(mix(a,ra,coverage),mix(b,rb,coverage),mask),1);
}`;
export function create(gl: WebGL2RenderingContext): TransitionInstance {
  const { program: prog, u }=program(gl,FRAG);
  return {
    render({ texA, texB, width, height, eased, params: p, target }) {
      gl.bindFramebuffer(gl.FRAMEBUFFER,target); gl.viewport(0,0,width,height); gl.useProgram(prog);
      bindTex(gl,u.uA,texA,0); bindTex(gl,u.uB,texB,1);
      gl.uniform2f(u.uRes,width,height); gl.uniform2fv(u.uCenter,pointToGl(p.center)); gl.uniform1f(u.uT,eased);
      gl.uniform1f(u.uLength,Number(p.length)/100); gl.uniform1f(u.uFocus,Number(p.focus)/100);
      gl.uniform1f(u.uDensity,Number(p.density)/100); gl.uniform1f(u.uSpread,Number(p.spread)/100);
      gl.uniform1f(u.uDrift,Number(p.drift)/100); fullscreen(gl);
    },
    dispose() { gl.deleteProgram(prog); },
  };
}
export default { meta, params, create } satisfies TransitionModule;
