/** Connected ice fronds carry a growth-time field; a separate thaw reveals the next image. */
import { bindTex, dirVec, fullscreen, GLSL, hexToRgb, mulberry32, program } from '../kit';
import type { TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';

export const meta: TransitionMeta = {
  id: 'frost', name_ru: 'Иней', description_ru: 'Ветви ледяных кристаллов замораживают изображение и оттаивают в новую сцену.',
  defaultDurationSec: 1.65, minDurationSec: 0.5, maxDurationSec: 5, defaultEase: 'linear', version: 1,
};
export const params: readonly TransitionParam[] = [
  { id: 'direction', type: 'direction', label_ru: 'Рост кристаллов', options: ['left','right','up','down','up-left','up-right','down-left','down-right'], default: 'up-right' },
  { id: 'density', type: 'number', label_ru: 'Ледяные ветви', min: 3, max: 10, step: 1, default: 6 },
  { id: 'depth', type: 'number', label_ru: 'Толщина льда', min: 0, max: 100, step: 1, default: 65, unit: '%' },
  { id: 'crystal', type: 'number', label_ru: 'Блеск граней', min: 0, max: 100, step: 1, default: 70, unit: '%' },
  { id: 'color', type: 'color', label_ru: 'Лёд', default: '#d8efff' },
  { id: 'seed', type: 'seed', label_ru: 'Узор', default: 67 },
];

/** Rasterize connected, subordinate branches. RGBA = relief, growth time, facet light, opaque. */
function crystalField(gl: WebGL2RenderingContext, aspect: [number,number], direction: [number,number], count: number, seed: number): WebGLTexture {
  const scale=Math.min(768,2048/Math.max(...aspect));
  const width=Math.ceil(aspect[0]*scale), height=Math.ceil(aspect[1]*scale);
  const data=new Uint8Array(width*height*4);
  const rnd=mulberry32(seed);
  const [dx,dy]=direction, px=-dy, py=dx;
  const along=Math.abs(dx)*aspect[0]+Math.abs(dy)*aspect[1];
  const across=Math.abs(px)*aspect[0]+Math.abs(py)*aspect[1];
  function segment(x0:number,y0:number,x1:number,y1:number,r:number,t0:number,t1:number,light:number) {
    const ax=(x0/aspect[0]+0.5)*width, ay=(y0/aspect[1]+0.5)*height;
    const bx=(x1/aspect[0]+0.5)*width, by=(y1/aspect[1]+0.5)*height;
    const vx=bx-ax,vy=by-ay,denom=vx*vx+vy*vy || 1;
    const radius=r*scale;
    const minX=Math.max(0,Math.floor(Math.min(ax,bx)-radius-1)),maxX=Math.min(width-1,Math.ceil(Math.max(ax,bx)+radius+1));
    const minY=Math.max(0,Math.floor(Math.min(ay,by)-radius-1)),maxY=Math.min(height-1,Math.ceil(Math.max(ay,by)+radius+1));
    for(let y=minY;y<=maxY;y++) for(let x=minX;x<=maxX;x++) {
      const f=Math.max(0,Math.min(1,((x+0.5-ax)*vx+(y+0.5-ay)*vy)/denom));
      const distance=Math.hypot(x+0.5-ax-vx*f,y+0.5-ay-vy*f);
      const cover=Math.max(0,Math.min(1,radius+0.7-distance));
      const at=(y*width+x)*4;
      if(cover*255<=data[at])continue;
      data[at]=Math.round(cover*255);
      data[at+1]=Math.round(Math.max(0.01,Math.min(0.97,t0+(t1-t0)*f))*cover*255);
      data[at+2]=Math.round(light*cover*255); data[at+3]=255;
    }
  }
  function twig(x:number,y:number,angle:number,length:number,radius:number,start:number,span:number,needles:boolean) {
    const nx=Math.cos(angle),ny=Math.sin(angle),curve=(rnd()-0.5)*0.14;
    const point=(f:number):[number,number]=>[x+nx*length*f-ny*Math.sin(f*Math.PI)*length*curve,y+ny*length*f+nx*Math.sin(f*Math.PI)*length*curve];
    for(let part=0;part<6;part++){
      const f0=part/6,f1=(part+1)/6,a=point(f0),b=point(f1);
      segment(...a,...b,radius*(1-f0*0.78),start+span*f0,start+span*f1,0.35+0.50*rnd());
    }
    if(!needles)return;
    const n=14;
    for(let j=1;j<n;j++) {
      const f=(j+(rnd()-0.5)*0.6)/n;
      for(const side of [-1,1]) {
        const theta=angle+side*(0.66+0.38*rnd());
        const len=length*(0.16+0.22*rnd())*(1-f*0.70);
        const [sx,sy]=point(f);
        segment(sx,sy,sx+Math.cos(theta)*len,sy+Math.sin(theta)*len,radius*0.38*(0.7+rnd()*0.6),start+span*f,start+span*f+0.07,0.55+0.45*rnd());
      }
    }
  }
  const baseAngle=Math.atan2(dy,dx);
  for(let tree=0;tree<count;tree++) {
    const lateral=(-0.58+(tree+0.2+rnd()*0.6)/count*1.16)*across;
    const originX=-dx*along*0.55+px*lateral,originY=-dy*along*0.55+py*lateral;
    const angle=baseAngle+(rnd()-0.5)*0.60;
    const nx=Math.cos(angle),ny=Math.sin(angle),length=along*(1.12+rnd()*0.10);
    let lastX=originX,lastY=originY;
    for(let j=1;j<=22;j++) {
      const f=j/22, bend=Math.sin(f*3.5+tree)*0.020;
      const x=originX+nx*length*f-ny*bend,y=originY+ny*length*f+nx*bend;
      segment(lastX,lastY,x,y,0.0028*(1-f*0.75),Math.max(0,(j-1)/22)*0.9,f*0.9,0.78);
      if(j>1&&j<21) for(const side of [-1,1]) {
        const len=(0.08+rnd()*0.17)*Math.min(along,1.8)*(1-f*0.25);
        twig(x,y,angle+side*(0.77+rnd()*0.18),len,0.0016*(1-f*0.6),f*0.86,len/along*0.45,true);
      }
      lastX=x;lastY=y;
    }
  }
  const tex=gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D,tex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  return tex;
}
const FRAG=`#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
uniform sampler2D uA,uB,uIce;
uniform vec2 uRes,uDir;
uniform float uT,uDepth,uCrystal;
uniform vec3 uColor;
uniform uint uSeed;
out vec4 outColor;
${GLSL.srgb}
${GLSL.hash}
${GLSL.noise}
vec3 frosted(sampler2D source,vec2 uv,float rough){
  vec2 d=vec2(0.009)*rough*min(uRes.x,uRes.y)/uRes;
  return texture(source,uv).rgb*0.34+(texture(source,uv+d).rgb+texture(source,uv-d).rgb+texture(source,uv+vec2(d.x,-d.y)).rgb+texture(source,uv+vec2(-d.x,d.y)).rgb)*0.165;
}
void main(){
  if(uT<=0.0){outColor=vec4(texture(uA,vUv).rgb,1);return;}
  if(uT>=1.0){outColor=vec4(texture(uB,vUv).rgb,1);return;}
  vec2 aspect=uRes/min(uRes.x,uRes.y),q=(vUv-0.5)*aspect;
  float reach=dot(abs(uDir),aspect);
  float axis=dot(q,uDir)/reach+0.5;
  float noise=fbm(q*11.0,uSeed,3)-0.44;
  float fine=vnoise(q*200.0,uSeed+7u);
  float field=axis*0.88+0.06+noise*0.085;
  float freeze=smoothstep(0.0,0.62,uT)*1.16-0.08;
  float thaw=smoothstep(0.31,1.0,uT)*1.16-0.08;
  float frozen=smoothstep(field-0.025,field+0.025,freeze)*(1.0-smoothstep(field-0.045,field+0.045,thaw));
  float reveal=smoothstep(field-0.035,field+0.035,thaw);
  vec4 ice=texture(uIce,vUv);
  float arrival=ice.g/max(ice.r,1.0/255.0);
  float facet=ice.b/max(ice.r,1.0/255.0);
  float grown=smoothstep(arrival-0.025,arrival+0.025,freeze)*(1.0-smoothstep(arrival-0.025,arrival+0.025,thaw));
  float branch=ice.r*grown;
  vec2 stepUv=1.0/768.0/aspect;
  vec2 normal=vec2(texture(uIce,vUv+vec2(stepUv.x,0)).r-texture(uIce,vUv-vec2(stepUv.x,0)).r,texture(uIce,vUv+vec2(0,stepUv.y)).r-texture(uIce,vUv-vec2(0,stepUv.y)).r);
  vec2 bend=(normal*0.007+vec2(noise,-noise)*0.008)*frozen*uDepth/aspect;
  vec3 a=frosted(uA,vUv+bend,frozen*uDepth),b=frosted(uB,vUv-bend,frozen*uDepth);
  vec3 col=toLinear(mix(a,b,reveal));
  float frostOpacity=frozen*(0.26+uDepth*0.48)+(branch*0.27)*(0.4+uCrystal*0.6);
  vec3 iceLight=toLinear(uColor)*(0.50+fine*0.12+facet*0.38);
  col=mix(col,iceLight,clamp(frostOpacity,0.0,0.96));
  float glint=pow(max(0.0,dot(normal,vec2(-0.6,0.8))),3.0)*branch*uCrystal;
  col+=toLinear(uColor)*glint*0.34;
  outColor=vec4(toSrgb(col),1);
}`;
export function create(gl:WebGL2RenderingContext):TransitionInstance {
  const {program:prog,u}=program(gl,FRAG);
  let texture:WebGLTexture|null=null,fieldKey='';
  return {
    render({texA,texB,width,height,eased,params:p,target}) {
      const aspect:[number,number]=[width/Math.min(width,height),height/Math.min(width,height)];
      const direction=dirVec(p.direction);
      const key=`${aspect.join(',')}:${p.direction}:${Math.round(Number(p.density))}:${p.seed}`;
      if(key!==fieldKey) {
        if(texture)gl.deleteTexture(texture);
        texture=crystalField(gl,aspect,direction,Math.round(Number(p.density)),Number(p.seed)); fieldKey=key;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER,target); gl.viewport(0,0,width,height); gl.useProgram(prog);
      bindTex(gl,u.uA,texA,0);bindTex(gl,u.uB,texB,1);bindTex(gl,u.uIce,texture,2);
      gl.uniform2f(u.uRes,width,height);gl.uniform2fv(u.uDir,direction);gl.uniform1f(u.uT,eased);
      gl.uniform1f(u.uDepth,Number(p.depth)/100);gl.uniform1f(u.uCrystal,Number(p.crystal)/100);
      gl.uniform3fv(u.uColor,hexToRgb(p.color));gl.uniform1ui(u.uSeed,Number(p.seed)>>>0);fullscreen(gl);
    },
    dispose(){gl.deleteProgram(prog);if(texture)gl.deleteTexture(texture);},
  };
}
export default {meta,params,create} satisfies TransitionModule;
