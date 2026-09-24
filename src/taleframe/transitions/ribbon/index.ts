/** Syncopated graphic montage with unequal bands and alternating travelling cuts. */
import { bindTex, dirVec, fullscreen, GLSL, hexToRgb, program } from '../kit';
import type { TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';
export const meta: TransitionMeta = {
  id:'ribbon',name_ru:'Монтаж',description_ru:'Неравные полосы меняют кадр в чётком встречном ритме.',
  defaultDurationSec:0.85,minDurationSec:0.2,maxDurationSec:3,defaultEase:'linear',version:1,
};
export const params: readonly TransitionParam[] = [
  {id:'direction',type:'direction',label_ru:'Направление',default:'left'},
  {id:'bands',type:'number',label_ru:'Полосы',min:3,max:12,step:1,default:7},
  {id:'stagger',type:'number',label_ru:'Синкопа',min:0,max:100,step:1,default:70,unit:'%'},
  {id:'accent',type:'color',label_ru:'Акцент',default:'#e7ff79'},
  {id:'edge',type:'number',label_ru:'Ширина акцента',min:0,max:5,step:0.1,default:0.8,unit:'%'},
  {id:'seed',type:'seed',label_ru:'Ритм',default:31},
];
const FRAG = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
uniform sampler2D uA,uB;
uniform vec2 uDir,uRes;
uniform float uT,uBands,uStagger,uEdge;
uniform vec3 uAccent;
uniform uint uSeed;
out vec4 outColor;
${GLSL.hash}
void main(){
  if(uT<=0.0){outColor=vec4(texture(uA,vUv).rgb,1);return;}
  if(uT>=1.0){outColor=vec4(texture(uB,vUv).rgb,1);return;}
  bool vertical=abs(uDir.y)>0.5;
  vec2 uv=vertical?vUv.yx:vUv;
  float baseDirection=vertical?-uDir.y:-uDir.x;
  float warped=uv.y+0.045*sin(uv.y*6.2831853)+0.015*sin(uv.y*18.8495559);
  float band=clamp(floor(warped*uBands),0.0,uBands-1.0);
  float random=hash2i(ivec2(int(band),13),uSeed);
  float delay=(random*0.75+band/uBands*0.25)*uStagger*0.34;
  float time=clamp((uT-delay)/(1.0-uStagger*0.34),0.0,1.0);
  // Quintic landing keeps strips still at both ends, yet sharply accelerates centrally.
  float p=time*time*time*(time*(time*6.0-15.0)+10.0);
  float direction=baseDirection*(mod(band,2.0)<0.5?1.0:-1.0);
  float x=direction>0.0?uv.x:1.0-uv.x;
  float translated=x+p;
  bool incoming=translated>=1.0;
  float sx=incoming?translated-1.0:translated;
  sx=direction>0.0?sx:1.0-sx;
  vec2 source=vec2(sx,uv.y);source=vertical?source.yx:source;
  vec3 col=incoming?texture(uB,source).rgb:texture(uA,source).rgb;
  float aa=1.0/(vertical?uRes.y:uRes.x);
  float edge=1.0-smoothstep(uEdge,uEdge+aa,abs(translated-1.0));
  edge*=smoothstep(0.0,0.1,p)*(1.0-smoothstep(0.9,1.0,p));
  col=mix(col,uAccent,edge);
  outColor=vec4(col,1);
}`;
export function create(gl:WebGL2RenderingContext):TransitionInstance {
  const {program:prog,u}=program(gl,FRAG);
  return {
    render({texA,texB,width,height,eased,params:p,target}){
      gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,width,height);gl.useProgram(prog);
      bindTex(gl,u.uA,texA,0);bindTex(gl,u.uB,texB,1);gl.uniform1f(u.uT,eased);gl.uniform2f(u.uRes,width,height);
      gl.uniform2fv(u.uDir,dirVec(p.direction));gl.uniform1f(u.uBands,Math.round(Number(p.bands)));
      gl.uniform1f(u.uStagger,Number(p.stagger)/100);gl.uniform1f(u.uEdge,Number(p.edge)/100);
      gl.uniform3fv(u.uAccent,hexToRgb(p.accent));gl.uniform1ui(u.uSeed,Number(p.seed)>>>0);fullscreen(gl);
    },
    dispose(){gl.deleteProgram(prog);},
  };
}
export default {meta,params,create} satisfies TransitionModule;
