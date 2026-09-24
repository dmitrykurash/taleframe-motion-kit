/** A clean sheet followed by animated, capillary-spreading pigment strokes. */
import { bindTex, dirVec, fullscreen, GLSL, program } from '../kit';
import type { TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';

export const meta: TransitionMeta = {
  id: 'paperpaint', name_ru: 'Белый лист',
  description_ru: 'Сцена растворяется до белой бумаги, затем следующая рисуется живыми растекающимися мазками.',
  defaultDurationSec: 2.6, minDurationSec: 0.8, maxDurationSec: 6, defaultEase: 'linear', version: 1,
};
export const params: readonly TransitionParam[] = [
  { id: 'direction', type: 'direction', label_ru: 'Направление мазков', options: ['left', 'right', 'up', 'down'], default: 'right' },
  { id: 'hold', type: 'number', label_ru: 'Пауза чистого листа', min: 0, max: 25, step: 1, default: 8, unit: '%' },
  { id: 'paper', type: 'number', label_ru: 'Фактура бумаги', min: 0, max: 100, step: 1, default: 55, unit: '%' },
  { id: 'detail', type: 'number', label_ru: 'Количество мазков', min: 5, max: 15, step: 1, default: 9 },
  { id: 'wetness', type: 'number', label_ru: 'Растекание краски', min: 0, max: 100, step: 1, default: 65, unit: '%' },
  { id: 'pigment', type: 'number', label_ru: 'Плотность пигмента', min: 20, max: 100, step: 1, default: 78, unit: '%' },
  { id: 'seed', type: 'seed', label_ru: 'Рисунок мазков', default: 521, advanced: true },
];
const FRAG = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
uniform sampler2D uA,uB;
uniform vec2 uRes,uDir;
uniform float uT,uHold,uPaper,uDetail,uWetness,uPigment;
uniform uint uSeed;
out vec4 outColor;
${GLSL.hash}
${GLSL.noise}

float strokeCurve(float x,float row,vec2 random) {
  float bend=sin(x*4.5+random.y*6.2831853)*0.031;
  float sweep=(x-0.5)*(random.x-0.5)*0.20;
  return row+bend+sweep;
}

void main() {
  if (uT<=0.0) { outColor=vec4(texture(uA,vUv).rgb,1); return; }
  if (uT>=1.0) { outColor=vec4(texture(uB,vUv).rgb,1); return; }
  vec2 aspect=uRes/min(uRes.x,uRes.y),q=(vUv-0.5)*aspect;
  vec2 side=vec2(uDir.y,-uDir.x);
  vec2 extent=vec2(dot(abs(uDir),aspect),dot(abs(side),aspect));
  vec2 local=vec2(dot(q,uDir),dot(q,side))/extent+0.5;
  // Paper is a static substrate: broad cotton tooth, fine cavities and crossed
  // fibres. The same height participates in colour deposition and ragged edges.
  float tooth=vnoise(q*95.0,uSeed+1u);
  float fine=vnoise(q*390.0,uSeed+3u);
  float fibres=vnoise(q*vec2(80.0,570.0),uSeed+4u)*0.5+
    vnoise(q*vec2(520.0,100.0),uSeed+5u)*0.5;
  float height=tooth*0.50+fine*0.24+fibres*0.26;
  float relief=(height-0.5)*0.09;
  vec3 paper=vec3(1.0-uPaper*(0.018-relief));
  paper=clamp(paper,0.94,1.0);
  float washEnd=0.24,paintStart=washEnd+uHold;
  if (uT<paintStart) {
    // Lift the outgoing pigment progressively into white paper. Broad flowing
    // patches affect removal, and the last trace vanishes before the hold.
    float wash=clamp(uT/washEnd,0.0,1.0);
    float cloud=fbm(q*5.0,uSeed+9u,3);
    float removal=smoothstep(0.04,0.98,wash+(cloud-0.43)*sin(wash*3.14159265)*0.42);
    vec3 a=texture(uA,vUv).rgb;
    float remaining=1.0-removal;
    vec3 lifted=paper*pow(max(a,vec3(0.001)),vec3(remaining));
    outColor=vec4(mix(a,lifted,smoothstep(0.0,0.10,wash)),1);
    return;
  }
  float paint=clamp((uT-paintStart)/(1.0-paintStart),0.0,1.0);
  float count=floor(uDetail+0.5);
  float distanceToPaint=10.0,youngest=0.0;
  float edgeNoise=(vnoise(q*65.0,uSeed+29u)-0.5)*0.013+
    (fine-0.5)*0.0035;
  // Each stroke has its own brush path, start, pressure and traverse speed.
  // Age is reconstructed analytically: seeking never replays a fluid history.
  for(int i=0;i<15;i++) {
    if(float(i)>=count) break;
    vec2 random=hash22i(ivec2(i,7),uSeed);
    float row=(float(i)+0.5+(random.x-0.5)*0.42)/count;
    float starts=float(i)/count*0.63+random.y*0.035;
    float duration=0.26+random.x*0.09;
    float t=(paint-starts)/duration;
    if(t<=0.0) continue;
    float signX=mod(float(i),2.0)<0.5 ? 1.0 : -1.0;
    float x=signX>0.0 ? local.x : 1.0-local.x;
    float tip=mix(-0.13,1.16,smoothstep(0.0,1.0,t));
    float nearestX=clamp(x,-0.13,tip);
    float y=strokeCurve(nearestX,row,random);
    float age=max(paint-starts-clamp((x+0.13)/1.29,0.0,1.0)*duration,0.0);
    float pressure=0.73+0.18*sin(nearestX*5.0+random.y*6.2831853)+random.x*0.18;
    float radius=0.71/count*pressure;
    // Unequal capillary spread; high paper ridges leave short dry-brush gaps.
    float spread=sqrt(age)*uWetness*(0.028+tooth*0.036);
    vec2 delta=vec2((x-nearestX)*extent.x,(local.y-y)*extent.y);
    float sd=length(delta)-radius*extent.y-spread+edgeNoise*(0.25+uWetness);
    if(sd<distanceToPaint) { distanceToPaint=sd; youngest=age; }
  }
  float aa=max(fwidth(distanceToPaint),0.8/min(uRes.x,uRes.y));
  float feather=0.002+uWetness*0.009;
  float covered=1.0-smoothstep(-aa,feather+aa,distanceToPaint);
  float rim=exp(-pow((distanceToPaint+0.004)/0.007,2.0));
  float dryGaps=smoothstep(0.40,0.68,height+youngest*(0.65+uWetness));
  float deposit=mix(0.57+dryGaps*0.43,1.0,uWetness*0.55);
  float granulation=(0.5-height)*uPaper*0.65;
  float settling=1.0-exp(-youngest*9.0);
  float density=mix(0.38,1.0,uPigment)*(0.72+settling*0.28+granulation+rim*0.42)*deposit;
  // Slight pigment transport softens very fresh paint, then immediately sampled
  // live scene detail returns. No source image or render result is cached.
  vec2 transport=vec2(vnoise(q*22.0,uSeed+67u),vnoise(q*22.0+7.0,uSeed+68u))-0.5;
  transport*=uWetness*0.012*exp(-youngest*9.0);
  vec2 sampleUv=clamp(vUv+transport/aspect,0.0,1.0);
  vec3 b=texture(uB,sampleUv).rgb;
  vec2 bleed=(0.003+0.011*exp(-youngest*12.0))*uWetness/aspect;
  vec3 soft=b*0.4;
  soft+=texture(uB,clamp(sampleUv+vec2(bleed.x,0),0.0,1.0)).rgb*0.15;
  soft+=texture(uB,clamp(sampleUv-vec2(bleed.x,0),0.0,1.0)).rgb*0.15;
  soft+=texture(uB,clamp(sampleUv+vec2(0,bleed.y),0.0,1.0)).rgb*0.15;
  soft+=texture(uB,clamp(sampleUv-vec2(0,bleed.y),0.0,1.0)).rgb*0.15;
  b=mix(b,soft,uWetness*(0.28+0.60*exp(-youngest*9.0)));
  vec3 glaze=paper*pow(max(b,vec3(0.001)),vec3(density));
  vec3 painted=mix(paper,glaze,covered);
  // The final wash reaches skipped paper cavities, then paper and pigment
  // treatment lift away together to recover the exact, still-playing B frame.
  float finish=smoothstep(0.79,1.0,paint);
  outColor=vec4(mix(painted,texture(uB,vUv).rgb,finish),1);
}`;

export function create(gl: WebGL2RenderingContext): TransitionInstance {
  const { program: prog,u }=program(gl,FRAG);
  return {
    render({texA,texB,width,height,eased,params:p,target}) {
      gl.bindFramebuffer(gl.FRAMEBUFFER,target); gl.viewport(0,0,width,height); gl.useProgram(prog);
      bindTex(gl,u.uA,texA,0); bindTex(gl,u.uB,texB,1);
      gl.uniform2f(u.uRes,width,height); gl.uniform2fv(u.uDir,dirVec(p.direction)); gl.uniform1f(u.uT,eased);
      gl.uniform1f(u.uHold,Number(p.hold)/100); gl.uniform1f(u.uPaper,Number(p.paper)/100);
      gl.uniform1f(u.uDetail,Number(p.detail)); gl.uniform1f(u.uWetness,Number(p.wetness)/100);
      gl.uniform1f(u.uPigment,Number(p.pigment)/100); gl.uniform1ui(u.uSeed,Number(p.seed)>>>0);
      fullscreen(gl);
    },
    dispose() { gl.deleteProgram(prog); },
  };
}
export default {meta,params,create} satisfies TransitionModule;
