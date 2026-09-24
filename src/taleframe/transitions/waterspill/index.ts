/** A gravity-led water sheet: rounded advancing ridge, flowing body, source-only refraction. */
import { bindTex, dirVec, fullscreen, GLSL, program } from '../kit';
import type { TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';

export const meta: TransitionMeta = {
  id: 'waterspill', name_ru: 'Разлив',
  description_ru: 'Водяной поток входит с края, преломляет изображение и смывает сцену в следующую.',
  defaultDurationSec: 1.7, minDurationSec: 0.45, maxDurationSec: 5, defaultEase: 'linear', version: 1,
};
export const params: readonly TransitionParam[] = [
  { id: 'direction', type: 'direction', label_ru: 'Направление потока', options: ['left', 'right', 'up', 'down'], default: 'down' },
  { id: 'spread', type: 'number', label_ru: 'Неровность фронта', min: 0, max: 100, step: 1, default: 66, unit: '%' },
  { id: 'turbulence', type: 'number', label_ru: 'Течение воды', min: 0, max: 100, step: 1, default: 58, unit: '%' },
  { id: 'refraction', type: 'number', label_ru: 'Преломление', min: 0, max: 100, step: 1, default: 64, unit: '%' },
  { id: 'rim', type: 'number', label_ru: 'Толщина кромки', min: 1, max: 12, step: 0.5, default: 4, unit: '%' },
  { id: 'seed', type: 'seed', label_ru: 'Рисунок потока', default: 137 },
];
const FRAG = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
uniform sampler2D uA,uB;
uniform vec2 uRes,uDir;
uniform float uT,uSpread,uTurbulence,uRefraction,uRim;
uniform uint uSeed;
out vec4 outColor;
${GLSL.hash}
${GLSL.noise}

// Derivatives of a moving height field. Long waves and narrow longitudinal
// rivulets have distinct scales/speeds; the texture advects rather than boils.
vec2 filmSlope(vec2 p,float phase) {
  vec2 k1=vec2(12.0,7.0),k2=vec2(23.0,-11.0),k3=vec2(7.0,31.0);
  float a=dot(p,k1)-uT*13.0+phase;
  float b=dot(p,k2)-uT*19.0-phase*0.7;
  float c=dot(p,k3)-uT*10.0+phase*1.3;
  vec2 slope=cos(a)*k1*0.033+cos(b)*k2*0.012+cos(c)*k3*0.007;
  float run=p.y*26.0+sin(p.x*4.4-uT*7.0+phase)*0.75+phase;
  slope+=cos(run)*vec2(3.3*cos(p.x*4.4-uT*7.0+phase),26.0)*0.009;
  return slope;
}
vec2 boundedBend(vec2 uv,vec2 delta) {
  // Keep source coordinates within the frame without stretching edge pixels
  // into stripes when a thick meniscus reaches the canvas border.
  vec2 room=max(min(uv,1.0-uv),vec2(0.0001));
  return delta/(1.0+abs(delta)/room);
}
void main() {
  if (uT<=0.0) { outColor=vec4(texture(uA,vUv).rgb,1); return; }
  if (uT>=1.0) { outColor=vec4(texture(uB,vUv).rgb,1); return; }
  float shortSide=min(uRes.x,uRes.y);
  vec2 aspect=uRes/shortSide,q=(vUv-0.5)*aspect;
  vec2 side=vec2(-uDir.y,uDir.x);
  vec2 local=vec2(dot(q,uDir),dot(q,side));
  float alongReach=dot(abs(uDir),aspect)*0.5;
  float acrossReach=dot(abs(side),aspect)*0.5;
  float phase=hash2i(ivec2(19,4),uSeed)*6.2831853;
  // A single broad, connected sheet with blunt gravity-loaded lobes. Unlike
  // capillary fingers, these never branch or leave detached reveal islands.
  float front=0.0;
  for (int i=0;i<3;i++) {
    vec2 random=hash22i(ivec2(i,8),uSeed);
    float center=(i==0 ? -0.48+random.x*0.32 : i==1 ? 0.40+random.x*0.35 : -0.92+random.x*0.12)*acrossReach;
    center+=sin(uT*(i==0 ? 1.8 : 3.3)+random.y*6.2831853)*0.055*uTurbulence;
    float width=(i==0 ? 0.38+random.y*0.13 : i==1 ? 0.23+random.y*0.09 : 0.09+random.y*0.05)*max(acrossReach,0.5);
    float d=(local.y-center)/width;
    float lead=i==0 ? (0.30+random.x*0.16)*(0.35+0.65*smoothstep(0.02,0.63,uT)) :
      i==1 ? (0.17+random.x*0.09)*(0.68+0.32*sin(uT*3.5+random.y*2.0)) : 0.035+random.x*0.025;
    front+=exp(-d*d)*lead;
  }
  float wrinkle=(vnoise(vec2(local.y*15.0+phase,uT*0.65),uSeed+91u)-0.5)*0.052;
  front=(front-0.13+wrinkle)*uSpread;
  // Padding and a start/end envelope guarantee no pre-existing wet island at
  // epsilon progress, even with maximum spread and an extreme random seed.
  float motionEnvelope=smoothstep(0.0,0.13,uT)*(1.0-smoothstep(0.84,1.0,uT));
  float travel=mix(-alongReach-0.30,alongReach+0.34,uT);
  float field=local.x-travel-front*motionEnvelope;
  float aa=max(fwidth(field)*0.65,0.65/shortSide);
  float mask=1.0-smoothstep(-aa,aa,field);
  vec2 gradient=vec2(dFdx(field),dFdy(field))*shortSide;
  vec2 outward=gradient/max(length(gradient),0.001);
  float meniscus=field/uRim;
  float ridge=exp(-meniscus*meniscus*0.7);
  vec2 ridgeSlope=outward*(-meniscus*ridge*6.0);
  float covered=1.0-smoothstep(-uRim,0.0,field);
  float bodyAge=max(-field,0.0);
  float bodyMobile=covered*exp(-bodyAge*0.60)*(0.45+0.55*uTurbulence);
  vec2 flowLocal=filmSlope(local+vec2(-uT*0.12,0),phase);
  vec2 flow=flowLocal.x*uDir+flowLocal.y*side;
  vec2 slope=(ridgeSlope+flow*bodyMobile*(0.35+1.25*uTurbulence))*uRefraction*motionEnvelope;
  vec3 normal=normalize(vec3(-slope,1.0));
  vec3 ray=refract(vec3(0,0,-1),normal,1.0/1.333);
  vec2 refracted=ray.xy/max(-ray.z,0.3)*(0.11+uRim*0.60+ridge*0.04);
  // A shorter precursor bend moves the outgoing image at the leading ridge;
  // the incoming image feels the whole moving body of water behind it.
  vec2 bendA=boundedBend(vUv,-refracted*ridge*0.52/aspect);
  vec2 bendB=boundedBend(vUv,refracted/aspect);
  vec3 a=texture(uA,vUv+bendA).rgb,b=texture(uB,vUv+bendB).rgb;
  outColor=vec4(mix(a,b,mask),1);
}`;
export function create(gl: WebGL2RenderingContext): TransitionInstance {
  const { program: prog, u }=program(gl,FRAG);
  return {
    render({ texA,texB,width,height,eased,params:p,target }) {
      gl.bindFramebuffer(gl.FRAMEBUFFER,target); gl.viewport(0,0,width,height); gl.useProgram(prog);
      bindTex(gl,u.uA,texA,0); bindTex(gl,u.uB,texB,1);
      gl.uniform2f(u.uRes,width,height); gl.uniform2fv(u.uDir,dirVec(p.direction)); gl.uniform1f(u.uT,eased);
      gl.uniform1f(u.uSpread,Number(p.spread)/100); gl.uniform1f(u.uTurbulence,Number(p.turbulence)/100);
      gl.uniform1f(u.uRefraction,Number(p.refraction)/100); gl.uniform1f(u.uRim,Number(p.rim)/100);
      gl.uniform1ui(u.uSeed,Number(p.seed)>>>0); fullscreen(gl);
    },
    dispose() { gl.deleteProgram(prog); },
  };
}
export default { meta,params,create } satisfies TransitionModule;
