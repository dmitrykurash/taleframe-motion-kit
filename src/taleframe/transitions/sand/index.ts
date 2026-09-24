/** Image-coloured grains lift from an eroding surface, drift in a gust and deposit into B. */
import { bindTex, dirVec, fullscreen, GLSL, program } from '../kit';
import type { TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';

export const meta:TransitionMeta={
  id:'sand',name_ru:'Песок',description_ru:'Ветер срывает мелкие зерна изображения и осаждает их в следующую сцену.',
  defaultDurationSec:1.4,minDurationSec:0.45,maxDurationSec:4,defaultEase:'linear',version:2,
};
export const params:readonly TransitionParam[]=[
  {id:'direction',type:'direction',label_ru:'Ветер',options:['left','right','up','down','up-left','up-right','down-left','down-right'],default:'right'},
  {id:'wind',type:'number',label_ru:'Сила порыва',min:0,max:100,step:1,default:65,unit:'%'},
  {id:'curl',type:'number',label_ru:'Завихрения',min:0,max:100,step:1,default:55,unit:'%'},
  {id:'grain',type:'number',label_ru:'Размер зерна',min:0.8,max:5,step:0.1,default:2.4,unit:'пикс'},
  {id:'seed',type:'seed',label_ru:'Рисунок ветра',default:123},
];
const FIELD=`
float erosion(vec2 uv,vec2 aspect,vec2 direction,uint seed){
  vec2 q=(uv-0.5)*aspect;
  float along=dot(q,direction)/dot(abs(direction),aspect)+0.5;
  vec2 lattice=floor(uv*vec2(220.0)*aspect);
  float grit=hash2i(ivec2(lattice),seed);
  float gust=0.5+0.5*sin(dot(q,vec2(-direction.y,direction.x))*13.0+sin(dot(q,direction)*7.0)*1.3);
  return 0.04+along*0.68+gust*0.11+grit*0.13;
}`;
const BASE=`#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
uniform sampler2D uA,uB;
uniform vec2 uRes,uDir;
uniform float uT;
uniform uint uSeed;
out vec4 outColor;
${GLSL.hash}
${FIELD}
void main(){
  if(uT<=0.0){outColor=vec4(texture(uA,vUv).rgb,1);return;}
  if(uT>=1.0){outColor=vec4(texture(uB,vUv).rgb,1);return;}
  vec2 aspect=uRes/min(uRes.x,uRes.y);
  float field=erosion(vUv,aspect,uDir,uSeed);
  float survive=1.0-smoothstep(field-0.020,field+0.020,uT*1.6-0.10);
  float deposit=smoothstep(field-0.020,field+0.020,uT*1.6-0.44);
  vec3 a=texture(uA,vUv).rgb,b=texture(uB,vUv).rgb;
  // The gaps also contain source video. Every weight belongs to A or B.
  vec3 col=mix(mix(a,b,0.5),b,deposit);
  col=mix(col,a,survive);
  outColor=vec4(col,1);
}`;
const PARTICLE_VS=`#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uA,uB;
uniform vec2 uRes,uDir;
uniform ivec2 uGrid;
uniform float uT,uWind,uCurl,uGrain,uScale;
uniform uint uSeed;
out vec3 vColor;
out float vAlpha;
${GLSL.hash}
${FIELD}
void main(){
  int cells=uGrid.x*uGrid.y;
  bool incoming=gl_VertexID>=cells;
  int id=gl_VertexID%cells;
  ivec2 cell=ivec2(id%uGrid.x,id/uGrid.x);
  vec2 random=hash22i(cell,uSeed+31u);
  vec2 origin=(vec2(cell)+0.5+(random-0.5)*0.84)/vec2(uGrid);
  vec2 aspect=uRes/min(uRes.x,uRes.y);
  float field=erosion(origin,aspect,uDir,uSeed);
  float age=incoming?(field-(uT*1.6-0.44))/0.28:((uT*1.6-0.10)-field)/0.28;
  if(age<=0.0||age>=1.0){gl_Position=vec4(3,3,0,1);gl_PointSize=1.0;vAlpha=0.0;vColor=vec3(0);return;}
  float fine=0.35+0.65*random.x;
  float distance=pow(age,1.35)*(0.16+uWind*0.72)*(1.3-fine*0.55);
  vec2 side=vec2(-uDir.y,uDir.x);
  float eddy=sin(age*4.4+random.y*6.2831853)*sin(age*3.14159265)*uCurl*(0.035+random.x*0.055);
  // Fine grains travel farther; the short curved component suggests saltation near the surface.
  float hop=sin(age*3.14159265)*(0.012+0.025*fine);
  vec2 motion=uDir*distance+side*(eddy+hop);
  vec2 position=origin+(incoming?-motion:motion)/aspect;
  gl_Position=vec4(position*2.0-1.0,0,1);
  float size=uGrain*uScale*(0.6+fine*1.45);
  gl_PointSize=max(1.0,size);
  vAlpha=smoothstep(0.0,0.07,age)*(1.0-smoothstep(0.62,1.0,age))*min(1.0,size*size);
  vColor=incoming?texture(uB,origin).rgb:texture(uA,origin).rgb;
}`;
const PARTICLE_FS=`#version 300 es
precision highp float;
in vec3 vColor;
in float vAlpha;
out vec4 outColor;
void main(){
  vec2 q=gl_PointCoord*2.0-1.0;
  float d=length(q);
  float coverage=1.0-smoothstep(0.60,1.0,d);
  outColor=vec4(vColor,vAlpha*coverage);
}`;
export function create(gl:WebGL2RenderingContext):TransitionInstance{
  const base=program(gl,BASE),particles=program(gl,PARTICLE_FS,PARTICLE_VS);
  const vao=gl.createVertexArray();
  return {
    render({texA,texB,width,height,eased,pxScale,params:p,target}){
      const dir=dirVec(p.direction);
      gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,width,height);gl.useProgram(base.program);
      bindTex(gl,base.u.uA,texA,0);bindTex(gl,base.u.uB,texB,1);
      gl.uniform2f(base.u.uRes,width,height);gl.uniform2fv(base.u.uDir,dir);gl.uniform1f(base.u.uT,eased);
      gl.uniform1ui(base.u.uSeed,Number(p.seed)>>>0);fullscreen(gl);
      if(eased<=0||eased>=1)return;
      gl.useProgram(particles.program);
      const u=particles.u;
      bindTex(gl,u.uA,texA,0);bindTex(gl,u.uB,texB,1);
      gl.uniform2f(u.uRes,width,height);gl.uniform2fv(u.uDir,dir);gl.uniform1f(u.uT,eased);
      gl.uniform1f(u.uWind,Number(p.wind)/100);gl.uniform1f(u.uCurl,Number(p.curl)/100);
      gl.uniform1f(u.uGrain,Number(p.grain));gl.uniform1f(u.uScale,pxScale);
      gl.uniform1ui(u.uSeed,Number(p.seed)>>>0);
      const short=Math.min(width,height),columns=Math.ceil(180*width/short),rows=Math.ceil(180*height/short);
      gl.uniform2i(u.uGrid,columns,rows);
      gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.bindVertexArray(vao);gl.drawArrays(gl.POINTS,0,columns*rows*2);gl.bindVertexArray(null);gl.disable(gl.BLEND);
    },
    dispose(){gl.deleteProgram(base.program);gl.deleteProgram(particles.program);gl.deleteVertexArray(vao);},
  };
}
export default {meta,params,create} satisfies TransitionModule;
