/** Content-aware contour relief: source gradients guide image displacement, never drawn lines. */
import { bindTex, dirVec, fullscreen, GLSL, program } from '../kit';
import { DIRECTIONS, type TransitionInstance, type TransitionMeta, type TransitionModule, type TransitionParam } from '../types';

export const meta: TransitionMeta = {
  id: 'contour', name_ru: 'Контуры', description_ru: 'Рельеф самого изображения направляет тонкие сдвиги и раскрывает новый кадр.',
  defaultDurationSec: 1.65, minDurationSec: 0.35, maxDurationSec: 5, defaultEase: 'linear', version: 1,
  inputs: { mipmaps: true },
};
export const params: readonly TransitionParam[] = [
  { id: 'direction', type: 'direction', label_ru: 'Направление', options: DIRECTIONS, default: 'right' },
  { id: 'relief', type: 'number', label_ru: 'Рельеф', min: 0, max: 100, default: 72, step: 1, unit: '%' },
  { id: 'displacement', type: 'number', label_ru: 'Смещение', min: 0, max: 100, default: 65, step: 1, unit: '%' },
  { id: 'layers', type: 'number', label_ru: 'Слои', min: 3, max: 14, default: 7, step: 1 },
  { id: 'detail', type: 'number', label_ru: 'Масштаб деталей', min: 1, max: 24, default: 12, step: 0.5, unit: 'пикс' },
  { id: 'softness', type: 'number', label_ru: 'Мягкость границы', min: 0, max: 100, default: 18, step: 1, unit: '%' },
];
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uA,uB;
uniform vec2 uRes,uDir;
uniform float uT,uRelief,uDisplacement,uLayers,uDetail,uSoftness;
out vec4 outColor;
${GLSL.srgb}
${GLSL.luma}
float tone(sampler2D tex,vec2 uv) {
  float footprint=max(uDetail*min(uRes.x,uRes.y)/1080.0,1.0);
  return luma(toLinear(textureLod(tex,clamp(uv,0.0,1.0),log2(footprint)).rgb));
}
vec3 structure(sampler2D tex,vec2 uv,vec2 d) {
  float tl=tone(tex,uv+vec2(-d.x,d.y)),tc=tone(tex,uv+vec2(0,d.y)),tr=tone(tex,uv+d);
  float ml=tone(tex,uv-vec2(d.x,0)),mc=tone(tex,uv),mr=tone(tex,uv+vec2(d.x,0));
  float bl=tone(tex,uv-d),bc=tone(tex,uv-vec2(0,d.y)),br=tone(tex,uv+vec2(d.x,-d.y));
  return vec3((tr+2.0*mr+br-tl-2.0*ml-bl)/8.0,(tl+2.0*tc+tr-bl-2.0*bc-br)/8.0,
    (tl+tc*2.0+tr+ml*2.0+mc*4.0+mr*2.0+bl+bc*2.0+br)/16.0);
}
void main() {
  if (uT <= 0.0) { outColor=vec4(texture(uA,vUv).rgb,1); return; }
  if (uT >= 1.0) { outColor=vec4(texture(uB,vUv).rgb,1); return; }
  float shortSide=min(uRes.x,uRes.y);
  vec2 aspect=uRes/shortSide;
  vec2 sampleStep=vec2(uDetail/1080.0)/aspect;
  vec3 sa=structure(uA,vUv,sampleStep), sb=structure(uB,vUv,sampleStep);
  float x=dot((vUv-0.5)*aspect,uDir);
  float reach=dot(abs(uDir),aspect)*0.5;
  float envelope=sin(uT*3.14159265);
  float level=mix(sa.z,sb.z,smoothstep(0.2,0.8,uT));
  // Terraces are derived from the actual picture's tone. They change sampling
  // coordinates and reveal order; they never quantize or recolour the output.
  float terrace=floor(level*uLayers)/uLayers;
  float field=x/max(reach,0.001)*0.32-mix(-0.83,0.83,uT)+(terrace-0.45)*uRelief*1.05;
  float aa=max(fwidth(field)*0.65,0.65/shortSide);
  float feather=max(aa,uSoftness*0.022);
  float mask=1.0-smoothstep(-feather,feather,field);
  float mobile=exp(-abs(field)/0.30)*envelope*uDisplacement;
  vec2 ga=sa.xy/(0.12+length(sa.xy)), gb=sb.xy/(0.12+length(sb.xy));
  float strata=sin(level*uLayers*6.2831853+uT*4.0);
  vec2 shiftA=(ga*0.065+uDir*(terrace-0.4)*0.13+vec2(-ga.y,ga.x)*strata*0.022)*mobile/aspect;
  vec2 shiftB=(gb*0.060-uDir*(terrace-0.4)*0.10+vec2(-gb.y,gb.x)*strata*0.020)*mobile/aspect;
  vec3 a=toLinear(texture(uA,clamp(vUv+shiftA,0.0,1.0)).rgb);
  vec3 b=toLinear(texture(uB,clamp(vUv-shiftB,0.0,1.0)).rgb);
  outColor=vec4(toSrgb(mix(a,b,mask)),1);
}`;
export function create(gl: WebGL2RenderingContext): TransitionInstance {
  const { program: prog, u }=program(gl,FRAG);
  return {
    render({ texA, texB, width, height, eased, params: p, target }) {
      gl.bindFramebuffer(gl.FRAMEBUFFER,target); gl.viewport(0,0,width,height); gl.useProgram(prog);
      bindTex(gl,u.uA,texA,0); bindTex(gl,u.uB,texB,1);
      gl.uniform2f(u.uRes,width,height); gl.uniform2fv(u.uDir,dirVec(p.direction)); gl.uniform1f(u.uT,eased);
      gl.uniform1f(u.uRelief,Number(p.relief)/100); gl.uniform1f(u.uDisplacement,Number(p.displacement)/100);
      gl.uniform1f(u.uLayers,Number(p.layers)); gl.uniform1f(u.uDetail,Number(p.detail));
      gl.uniform1f(u.uSoftness,Number(p.softness)/100); fullscreen(gl);
    },
    dispose() { gl.deleteProgram(prog); },
  };
}
export default { meta, params, create } satisfies TransitionModule;
