/** Engraved motion: fine source-pixel displacement and a tonal reveal frontier. */
import { bindTex, fullscreen, GLSL, pointToGl, program } from '../kit';
import type { TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';
export const meta: TransitionMeta = {
  id:'engraving',name_ru:'Гравюра',description_ru:'Тонкие борозды деформируют изображение и раскрывают новую сцену без изменения цвета.',
  defaultDurationSec:1.3,minDurationSec:0.4,maxDurationSec:4,defaultEase:'linear',version:3,
};
export const params: readonly TransitionParam[] = [
  {id:'center',type:'point',label_ru:'Источник',default:{x:0.42,y:0.54}},
  {id:'roughness',type:'number',label_ru:'Фактура края',min:0,max:100,step:1,default:58,unit:'%'},
  {id:'etch',type:'number',label_ru:'Гравюра',min:0,max:100,step:1,default:82,unit:'%'},
  {id:'glow',type:'number',label_ru:'Глубина борозд',min:0,max:100,step:1,default:65,unit:'%'},
  {id:'seed',type:'seed',label_ru:'Рисунок',default:17},
];
const FRAG=`#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
uniform sampler2D uA,uB;
uniform vec2 uRes,uCenter;
uniform float uT,uRough,uEtch,uDepth;
uniform uint uSeed;
out vec4 outColor;
${GLSL.hash}
${GLSL.noise}
${GLSL.luma}
float hatch(float phase,float duty,float aa){
  float d=abs(fract(phase)-0.5);
  float line=1.0-smoothstep(duty*0.5-aa*0.5,duty*0.5+aa*0.5,d);
  return mix(line,duty,smoothstep(0.55,1.3,aa));
}
void main(){
  if(uT<=0.0){outColor=vec4(texture(uA,vUv).rgb,1);return;}
  if(uT>=1.0){outColor=vec4(texture(uB,vUv).rgb,1);return;}
  float shortSide=min(uRes.x,uRes.y);
  vec2 aspect=uRes/shortSide,q=(vUv-uCenter)*aspect;
  float reach=length(max(uCenter,1.0-uCenter)*aspect);
  vec2 warp=vec2(vnoise(q*3.1,uSeed),vnoise(q*3.1+13.0,uSeed+1u))-0.5;
  float terrain=fbm((q+warp*0.16)*6.5,uSeed,4)-0.47;
  float fibre=vnoise(q*78.0,uSeed+21u)-0.5;
  float field=length(q)+(terrain*0.25+fibre*0.009)*uRough;
  float dist=mix(-0.16,reach+0.18,uT)-field;
  float aa=max(fwidth(dist)*0.65,0.55/shortSide);
  float mask=smoothstep(-aa,aa,dist);
  vec3 a=texture(uA,vUv).rgb,b=texture(uB,vUv).rgb;
  float tone=luma(mix(a,b,mask));
  float envelope=smoothstep(0.0,0.11,uT)*(1.0-smoothstep(0.8,1.0,uT));
  float band=(1.0-smoothstep(0.025,0.24,abs(dist)))*envelope*uEtch;
  vec2 plate=vUv*aspect;
  float bend=vnoise(plate*2.7,uSeed+11u)*0.65;
  vec2 firstDir=vec2(0.76,0.65),secondDir=vec2(-0.52,0.85);
  float firstDuty=0.08+0.56*pow(tone,0.7);
  float first=hatch(dot(plate,firstDir)*230.0+bend,firstDuty,230.0*1.41/shortSide);
  float second=hatch(dot(plate,secondDir)*190.0-bend,0.18,190.0*1.37/shortSide);
  // A stroke is a small incision in source coordinates, never drawn ink or light.
  // Centered coverage prevents the whole picture drifting with average line density.
  vec2 grooves=firstDir*(first-firstDuty)+secondDir*(second-0.18)*smoothstep(0.42,0.9,tone)*0.6;
  vec2 shift=grooves*(2.0+uDepth*8.0)/1080.0*band/aspect;
  // Tonal line coverage only changes which source is exposed at the moving frontier.
  float reveal=smoothstep(-0.030,0.030,dist+(first-firstDuty)*0.030*band);
  vec3 outgoing=texture(uA,clamp(vUv+shift,0.0,1.0)).rgb;
  vec3 incoming=texture(uB,clamp(vUv-shift,0.0,1.0)).rgb;
  outColor=vec4(mix(outgoing,incoming,reveal),1);
}`;
export function create(gl:WebGL2RenderingContext):TransitionInstance{
  const{program:prog,u}=program(gl,FRAG);
  return{
    render({texA,texB,width,height,eased,params:p,target}){
      gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,width,height);gl.useProgram(prog);
      bindTex(gl,u.uA,texA,0);bindTex(gl,u.uB,texB,1);gl.uniform2f(u.uRes,width,height);
      gl.uniform2fv(u.uCenter,pointToGl(p.center));gl.uniform1f(u.uT,eased);
      gl.uniform1f(u.uRough,Number(p.roughness)/100);gl.uniform1f(u.uEtch,Number(p.etch)/100);
      gl.uniform1f(u.uDepth,Number(p.glow)/100);gl.uniform1ui(u.uSeed,Number(p.seed)>>>0);fullscreen(gl);
    },
    dispose(){gl.deleteProgram(prog);},
  };
}
export default{meta,params,create} satisfies TransitionModule;
