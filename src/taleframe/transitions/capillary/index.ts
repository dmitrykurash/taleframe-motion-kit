/** Image-only viscous fingering: a connected front splits into narrow liquid tongues. */
import { bindTex, dirVec, fullscreen, GLSL, program } from '../kit';
import { DIRECTIONS, type TransitionInstance, type TransitionMeta, type TransitionModule, type TransitionParam } from '../types';

export const meta: TransitionMeta = {
  id: 'capillary', name_ru: 'Капилляры', description_ru: 'Кадр проникает ветвящимися потоками, растягивая изображение на границе.',
  defaultDurationSec: 1.65, minDurationSec: 0.4, maxDurationSec: 5, defaultEase: 'linear', version: 1,
};
export const params: readonly TransitionParam[] = [
  { id: 'direction', type: 'direction', label_ru: 'Направление', options: DIRECTIONS, default: 'right' },
  { id: 'branching', type: 'number', label_ru: 'Ветвление', min: 0, max: 100, default: 72, step: 1, unit: '%' },
  { id: 'scale', type: 'number', label_ru: 'Число потоков', min: 3, max: 15, default: 7, step: 1 },
  { id: 'stretch', type: 'number', label_ru: 'Вытеснение', min: 0, max: 100, default: 65, step: 1, unit: '%' },
  { id: 'edge', type: 'number', label_ru: 'Мягкость границы', min: 0, max: 100, default: 8, step: 1, unit: '%' },
  { id: 'seed', type: 'seed', label_ru: 'Рисунок', default: 231 },
];
const FRAG = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
uniform sampler2D uA,uB;
uniform vec2 uRes,uDir;
uniform float uT,uBranches,uScale,uStretch,uEdge;
uniform uint uSeed;
out vec4 outColor;
${GLSL.hash}
${GLSL.noise}
${GLSL.srgb}
void main() {
  if (uT <= 0.0) { outColor=vec4(texture(uA,vUv).rgb,1); return; }
  if (uT >= 1.0) { outColor=vec4(texture(uB,vUv).rgb,1); return; }
  float shortSide=min(uRes.x,uRes.y);
  vec2 aspect=uRes/shortSide, q=(vUv-0.5)*aspect;
  vec2 across=vec2(-uDir.y,uDir.x);
  float x=dot(q,uDir), y=dot(q,across);
  float reach=dot(abs(uDir),aspect)*0.5;
  float phase=hash2i(ivec2(4,9),uSeed)*20.0;
  // Stretched multiscale channels. Long wavelengths set the mother tongues;
  // smaller nested wavelengths split their tips. The front stays connected.
  vec2 domain=vec2(x*1.35,y*uScale)+phase;
  float warp=(vnoise(domain*vec2(0.8,0.37),uSeed+17u)-0.5)*2.4;
  domain.y += warp + sin(x*4.0+phase)*0.24;
  float tongue=0.72*(vnoise(domain,uSeed)-0.5);
  tongue+=0.22*(vnoise(domain*vec2(1.8,2.05)+4.1,uSeed+71u)-0.5);
  tongue+=0.055*(vnoise(domain*vec2(3.1,4.13),uSeed+193u)-0.5);
  float travel=mix(-reach-0.65,reach+0.65,uT);
  float field=x-travel-tongue*(0.4+1.65*uBranches);
  float aa=max(fwidth(field)*0.6,0.65/shortSide);
  float edge=max(aa,uEdge*0.018);
  float mask=1.0-smoothstep(-edge,edge,field);
  float envelope=smoothstep(0.0,0.13,uT)*(1.0-smoothstep(0.82,1.0,uT));
  vec2 g=vec2(dFdx(field),dFdy(field))*shortSide;
  vec2 normal=g/max(length(g),0.001);
  float wet=exp(-abs(field)/0.095)*envelope*uStretch;
  // Refraction is a coordinate operation only; no line, shadow or pigment is drawn.
  vec2 bend=(normal*0.038*sin(field*22.0)+uDir*0.085)*wet/aspect;
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
      gl.uniform2f(u.uRes,width,height); gl.uniform2fv(u.uDir,dirVec(p.direction)); gl.uniform1f(u.uT,eased);
      gl.uniform1f(u.uBranches,Number(p.branching)/100); gl.uniform1f(u.uScale,Number(p.scale));
      gl.uniform1f(u.uStretch,Number(p.stretch)/100); gl.uniform1f(u.uEdge,Number(p.edge)/100);
      gl.uniform1ui(u.uSeed,Number(p.seed)>>>0); fullscreen(gl);
    },
    dispose() { gl.deleteProgram(prog); },
  };
}
export default { meta, params, create } satisfies TransitionModule;
