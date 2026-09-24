/** Luminance-as-height scan relief, reconstructed independently on every frame. */
import { bindTex, fullscreen, GLSL, hexToRgb, program } from '../kit';
import type { TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';
export const meta: TransitionMeta = {
  id:'signal',name_ru:'Развёртка',description_ru:'Кадр превращается в световой рельеф строк и собирается заново.',
  defaultDurationSec:1.25,minDurationSec:0.3,maxDurationSec:4,defaultEase:'linear',version:1,
};
export const params: readonly TransitionParam[] = [
  {id:'rows',type:'number',label_ru:'Число строк',min:24,max:100,step:1,default:56},
  {id:'relief',type:'number',label_ru:'Рельеф',min:0,max:100,step:1,default:75,unit:'%'},
  {id:'width',type:'number',label_ru:'Толщина луча',min:0.5,max:4,step:0.25,default:1.5,unit:'пикс'},
  {id:'color',type:'color',label_ru:'Свечение',default:'#88dfff'},
  {id:'sourceColor',type:'boolean',label_ru:'Цвет исходного кадра',default:false},
];
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uA,uB;
uniform vec2 uRes;
uniform float uT,uRows,uRelief,uWidth,uSource;
uniform vec3 uColor;
out vec4 outColor;
${GLSL.srgb}
${GLSL.luma}
void main(){
  if(uT<=0.0){outColor=vec4(texture(uA,vUv).rgb,1);return;}
  if(uT>=1.0){outColor=vec4(texture(uB,vUv).rgb,1);return;}
  float envelope=smoothstep(0.01,0.27,uT)*(1.0-smoothstep(0.73,0.99,uT));
  float height=uRelief*0.075*envelope;
  float row=floor(vUv.y*uRows);
  float beamWidth=max(uWidth/1080.0*min(uRes.x,uRes.y)/uRes.y,0.50/uRes.y);
  vec3 signal=vec3(0);
  // A bounded gather reconstructs the displaced neighbouring scanlines; no previous-frame state.
  for(int k=-5;k<=5;k++){
    float y=(row+float(k)+0.5)/uRows;
    if(y<0.0||y>1.0)continue;
    float transfer=smoothstep(0.30,0.70,uT+(y-0.5)*0.22);
    vec2 uv=vec2(vUv.x,y);
    vec3 data=mix(texture(uA,uv).rgb,texture(uB,uv).rgb,transfer);
    float tone=luma(data);
    float projected=y+(tone-0.5)*height;
    float distance=abs(vUv.y-projected);
    float core=exp(-pow(distance/beamWidth,2.0));
    float aura=exp(-distance/(beamWidth*3.0))*0.10;
    vec3 tint=mix(toLinear(uColor),toLinear(data)*0.8+toLinear(uColor)*0.2,uSource);
    signal+=tint*(core+aura)*(0.24+tone*1.2);
  }
  vec3 base=mix(toLinear(texture(uA,vUv).rgb),toLinear(texture(uB,vUv).rgb),smoothstep(0.30,0.70,uT));
  outColor=vec4(toSrgb(mix(base,vec3(0.0015,0.0025,0.005)+signal,envelope)),1);
}`;
export function create(gl:WebGL2RenderingContext):TransitionInstance {
  const {program:prog,u}=program(gl,FRAG);
  return {
    render({texA,texB,width,height,eased,params:p,target}){
      gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,width,height);gl.useProgram(prog);
      bindTex(gl,u.uA,texA,0);bindTex(gl,u.uB,texB,1);gl.uniform2f(u.uRes,width,height);gl.uniform1f(u.uT,eased);
      gl.uniform1f(u.uRows,Math.round(Number(p.rows)));gl.uniform1f(u.uRelief,Number(p.relief)/100);
      gl.uniform1f(u.uWidth,Number(p.width));gl.uniform1f(u.uSource,p.sourceColor?1:0);
      gl.uniform3fv(u.uColor,hexToRgb(p.color));fullscreen(gl);
    },
    dispose(){gl.deleteProgram(prog);},
  };
}
export default {meta,params,create} satisfies TransitionModule;
