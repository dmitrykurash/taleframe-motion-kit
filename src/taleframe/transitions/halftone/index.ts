/** A CMY press: independent rotated dot screens and plate-registration choreography. */
import { bindTex, fullscreen, hexToRgb, program } from '../kit';
import type { TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';
export const meta: TransitionMeta = {
  id:'halftone',name_ru:'Растр',description_ru:'Три печатные формы собирают новый кадр из цветных растровых точек.',
  defaultDurationSec:1.2,minDurationSec:0.3,maxDurationSec:4,defaultEase:'linear',version:1,
};
export const params: readonly TransitionParam[] = [
  {id:'density',type:'number',label_ru:'Частота растра',min:24,max:120,step:1,default:55},
  {id:'registration',type:'number',label_ru:'Смещение красок',min:0,max:20,step:0.5,default:5,unit:'пикс'},
  {id:'stagger',type:'number',label_ru:'Задержка форм',min:0,max:100,step:1,default:65,unit:'%'},
  {id:'paper',type:'color',label_ru:'Бумага',default:'#fff5df'},
  {id:'stepped',type:'boolean',label_ru:'Печатать на двойках',default:true},
];
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uA,uB;
uniform vec2 uRes;
uniform float uT,uDensity,uRegistration,uStagger,uStepped,uDuration;
uniform vec3 uPaper;
out vec4 outColor;
mat2 rotate(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float plate(int channel,float angle,float stage,float envelope) {
  vec2 aspect=uRes/min(uRes.x,uRes.y);
  vec2 shift=vec2(cos(angle*2.0),sin(angle*2.0))*uRegistration/1080.0*envelope;
  vec2 grid=rotate(angle)*((vUv-0.5)*aspect+shift)*uDensity;
  vec2 cell=floor(grid)+0.5;
  vec2 source=rotate(-angle)*(cell/uDensity)-shift;
  source=source/aspect+0.5;
  vec3 tone=mix(texture(uA,source).rgb,texture(uB,source).rgb,stage);
  float ink=1.0-tone[channel];
  float radius=sqrt(max(ink,0.0))*0.707;
  float d=length(fract(grid)-0.5);
  float aa=max(fwidth(d),0.015);
  return 1.0-smoothstep(radius-aa,radius+aa,d);
}
void main(){
  if(uT<=0.0){outColor=vec4(texture(uA,vUv).rgb,1);return;}
  if(uT>=1.0){outColor=vec4(texture(uB,vUv).rgb,1);return;}
  float steps=max(2.0,uDuration*12.0);
  float p=mix(uT,floor(uT*steps)/steps,uStepped);
  float envelope=smoothstep(0.02,0.24,uT)*(1.0-smoothstep(0.76,0.98,uT));
  float offset=uStagger*0.14;
  float c=plate(0,0.261799,smoothstep(0.30-offset,0.64-offset,p),envelope);
  float m=plate(1,1.308997,smoothstep(0.30,0.64,p),envelope);
  float y=plate(2,0.0,smoothstep(0.30+offset,0.64+offset,p),envelope);
  vec3 printed=uPaper;
  printed*=mix(vec3(1),vec3(0.04,0.74,0.90),c);
  printed*=mix(vec3(1),vec3(0.95,0.06,0.48),m);
  printed*=mix(vec3(1),vec3(1.0,0.85,0.04),y);
  vec3 picture=mix(texture(uA,vUv).rgb,texture(uB,vUv).rgb,smoothstep(0.32,0.68,uT));
  outColor=vec4(mix(picture,printed,envelope),1);
}`;
export function create(gl:WebGL2RenderingContext):TransitionInstance {
  const {program:prog,u}=program(gl,FRAG);
  return {
    render({texA,texB,width,height,eased,durationSec,params:p,target}){
      gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,width,height);gl.useProgram(prog);
      bindTex(gl,u.uA,texA,0);bindTex(gl,u.uB,texB,1);gl.uniform2f(u.uRes,width,height);gl.uniform1f(u.uT,eased);
      gl.uniform1f(u.uDensity,Number(p.density));gl.uniform1f(u.uRegistration,Number(p.registration));
      gl.uniform1f(u.uStagger,Number(p.stagger)/100);gl.uniform1f(u.uStepped,p.stepped?1:0);
      gl.uniform1f(u.uDuration,durationSec);gl.uniform3fv(u.uPaper,hexToRgb(p.paper));fullscreen(gl);
    },
    dispose(){gl.deleteProgram(prog);},
  };
}
export default {meta,params,create} satisfies TransitionModule;
