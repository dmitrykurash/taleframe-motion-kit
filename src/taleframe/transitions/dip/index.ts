/** Two-stage overlap through a source-derived midpoint, never through a color. */
import { bindTex, fullscreen, program } from '../kit';
import type { TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';
export const meta: TransitionMeta = {
  id:'dip',name_ru:'Перетекание',description_ru:'Два кадра мягко соединяются с короткой паузой в середине смешения.',
  defaultDurationSec:1,minDurationSec:0.2,maxDurationSec:4,defaultEase:'linear',version:2,
};
export const params: readonly TransitionParam[] = [
  {id:'hold',type:'number',label_ru:'Пауза смешения',hint_ru:'Как долго оба кадра видны в равной пропорции.',min:0,max:80,step:1,default:10,unit:'%'},
];
const FRAG=`#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uA,uB;
uniform float uT,uHalf;
out vec4 outColor;
void main(){
  float e=clamp(uT,0.0,1.0),h=max(uHalf,0.0001);
  float weight=e<h ? 0.5*smoothstep(0.0,1.0,e/h) :
    e>1.0-h ? 1.0-0.5*smoothstep(0.0,1.0,(1.0-e)/h) : 0.5;
  outColor=vec4(mix(texture(uA,vUv).rgb,texture(uB,vUv).rgb,weight),1);
}`;
export function create(gl:WebGL2RenderingContext):TransitionInstance{
  const {program:prog,u}=program(gl,FRAG);
  return {
    render({texA,texB,width,height,eased,params:p,target}){
      gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,width,height);gl.useProgram(prog);
      bindTex(gl,u.uA,texA,0);bindTex(gl,u.uB,texB,1);gl.uniform1f(u.uT,eased);
      const hold=Math.min(0.8,Math.max(0,Number(p.hold??10)/100));gl.uniform1f(u.uHalf,(1-hold)/2);fullscreen(gl);
    },
    dispose(){gl.deleteProgram(prog);},
  };
}
export default {meta,params,create} satisfies TransitionModule;
