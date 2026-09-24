/** Water pools and capillary motion reveal video without a paper or pigment layer. */
import { bindTex, fullscreen, GLSL, pointToGl, program } from '../kit';
import type { TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';

export const meta: TransitionMeta = {
  id: 'watercolor', name_ru: 'Акварель',
  description_ru: 'Прозрачная вода проявляет новую сцену впереди плотного края растекающейся краски.',
  defaultDurationSec: 1.8, minDurationSec: 0.55, maxDurationSec: 5, defaultEase: 'linear', version: 4,
};
export const params: readonly TransitionParam[] = [
  { id: 'center', type: 'point', label_ru: 'Первая капля', default: { x: 0.45, y: 0.5 } },
  { id: 'count', type: 'number', label_ru: 'Количество капель', min: 1, max: 12, step: 1, default: 7 },
  { id: 'water', type: 'number', label_ru: 'Преломление воды', min: 0, max: 100, step: 1, default: 72, unit: '%' },
  { id: 'pigment', type: 'number', label_ru: 'Плотность капель', min: 15, max: 100, step: 1, default: 70, unit: '%' },
  { id: 'spread', type: 'number', label_ru: 'Мягкое растекание', min: 0, max: 100, step: 1, default: 65, unit: '%' },
  { id: 'grain', type: 'number', label_ru: 'Микропотоки', min: 0, max: 100, step: 1, default: 55, unit: '%' },
  { id: 'seed', type: 'seed', label_ru: 'Рисунок капель', default: 42, advanced: true },
];
const FRAG = `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv;
uniform sampler2D uA, uB;
uniform vec2 uRes, uCenter;
uniform float uT, uWater, uPigment, uGrain, uSpread;
uniform int uCount;
uniform uint uSeed;
out vec4 outColor;
${GLSL.hash}
${GLSL.noise}
// Approximate ellipse distance with its analytic gradient. Connected unequal
// lobes form the footprint itself; noise only pins small parts of its shoreline.
vec3 ellipse(vec2 p, vec2 center, vec2 axes) {
  vec2 d=(p-center)/axes;
  float len=max(length(d),0.0001), scale=min(axes.x,axes.y);
  return vec3(d/(len*axes)*scale,(len-1.0)*scale);
}
vec3 joinPools(vec3 a,vec3 b,float neck) {
  float h=clamp(0.5+0.5*(b.z-a.z)/neck,0.0,1.0);
  return vec3(mix(b.xy,a.xy,h),mix(b.z,a.z,h)-neck*h*(1.0-h));
}
float joinDistance(float a,float b,float neck) {
  float h=clamp(0.5+0.5*(b-a)/neck,0.0,1.0);
  return mix(b,a,h)-neck*h*(1.0-h);
}
void main() {
  if (uT <= 0.0) { outColor=vec4(texture(uA,vUv).rgb,1); return; }
  if (uT >= 1.0) { outColor=vec4(texture(uB,vUv).rgb,1); return; }
  vec2 aspect=uRes/min(uRes.x,uRes.y), q=vUv*aspect;
  float settle=smoothstep(0.78,1.0,uT);
  float pinning=fbm(q*13.0,uSeed+130u,3)-0.44;
  float fine=vnoise(q*95.0,uSeed+139u)-0.5;
  vec2 bend=vec2(vnoise(q*4.6,uSeed+31u),vnoise(q*4.6+9.0,uSeed+33u))-0.5;
  vec2 landingOffset=hash22i(ivec2(71,29),uSeed);
  float wash=0.0, unionD=10.0, flowWeight=0.0;
  vec2 flow=vec2(0);
  for (int i=0;i<12;i++) {
    if (i>=uCount) break;
    vec2 random=hash22i(ivec2(i,12),uSeed);
    vec2 shape=hash22i(ivec2(i,83),uSeed);
    // Low-discrepancy landing positions avoid the repeated clamped edge piles
    // of independent random centres. The first drop stays directly editable.
    vec2 center=i==0 ? uCenter : 0.055+0.89*fract(landingOffset+float(i)*vec2(0.754877666,0.569840296));
    float born=i==0 ? 0.025 : 0.055+float(i)/float(uCount)*0.22+random.x*0.065;
    float age=max(0.0,(uT-born)/(1.0-born));
    float growth=pow(age,0.76);
    float spread=mix(1.05,0.39,smoothstep(1.0,12.0,float(uCount)));
    float radius=0.002+growth*spread*(0.82+random.y*0.34)*(1.0+settle*0.72);
    float angle=random.x*6.2831853;
    vec2 axis=vec2(cos(angle),sin(angle)), across=vec2(-axis.y,axis.x);
    vec2 delta=q-center*aspect+bend*growth*0.12;
    vec2 p=vec2(dot(delta,axis),dot(delta,across))/radius;
    float relax=smoothstep(0.04,0.65,age);
    // Off-centre pools advance at different rates. They stay connected and
    // retain broad indentations instead of becoming a decorated circle.
    vec3 pool=ellipse(p,vec2(0),vec2(0.88+shape.x*0.25,0.52+shape.y*0.16));
    pool=joinPools(pool,ellipse(p,vec2(0.48+shape.y*0.30,0.20+shape.x*0.23)*mix(0.72,1.0,relax),
      vec2(0.47+random.y*0.20,0.47+shape.y*0.20)),0.24);
    pool=joinPools(pool,ellipse(p,vec2(-0.64-shape.x*0.16,0.18+shape.y*0.25)*mix(0.85,1.0,relax),
      vec2(0.39+shape.y*0.19,0.27+random.x*0.16)),0.19);
    pool=joinPools(pool,ellipse(p,vec2(-0.20+shape.x*0.30,-0.48-shape.y*0.16)*mix(0.55,1.0,relax),
      vec2(0.31+random.y*0.23,0.34+shape.x*0.19)),0.22);
    float d=pool.z*radius+pinning*0.110*growth+fine*0.0025*growth;
    float landed=smoothstep(0.0,0.025,uT-born);
    float aa=max(1.1/min(uRes.x,uRes.y),0.0013);
    // Dilute water advances ahead of the loaded-pigment boundary. Its broad
    // shoulder introduces B gradually while a narrower inner edge stays legible.
    // Width follows the growing pool and pinned shoreline, not a blurred image.
    float pigmentEdge=aa+uSpread*(0.0015+0.003*growth);
    float coverage=(1.0-smoothstep(-pigmentEdge,pigmentEdge,d))*landed;
    float wetReach=(0.012+0.050*growth)*mix(1.18,0.78,uPigment)
      *(0.86+0.28*vnoise(q*9.0,uSeed+uint(i)*43u))*uSpread;
    float wetFront=pow(1.0-smoothstep(0.0,max(aa,wetReach),d),1.35)*landed;
    float dilute=wetFront*uSpread*mix(0.30,0.16,uPigment);
    if (age>0.0) unionD=joinDistance(unionD,d+mix(0.03,0.0,landed),0.024*growth);
    float rim=exp(-pow(d/0.014,2.0));
    vec2 normal=axis*pool.x+across*pool.y;
    // A broad, shallow water cap bends the picture throughout the wet body.
    // The rim is only an additional meniscus, not the entire distortion.
    float depth=clamp(-pool.z/0.66,0.0,1.0);
    float body=sin(depth*3.14159265);
    float youth=1.0-smoothstep(0.35,0.92,age);
    float phase=dot(q,axis)*13.0-age*6.0+random.y*9.0;
    float crossPhase=dot(q,across)*10.0+age*4.5;
    vec2 surfaceWave=(axis*cos(phase)*sin(crossPhase)+across*sin(phase)*cos(crossPhase))*0.080*body;
    float ripple=sin(d*95.0-age*10.0)*exp(-abs(d)*19.0)*0.060;
    // The shallow advancing film has a gentler lens than the wet body. The
    // source remains sharp; only its coordinates bend through the water front.
    float frontSlope=exp(-pow((d-wetReach*.30)/max(aa,wetReach*.65),2.0))
      *wetFront*(1.0-coverage)*uSpread;
    vec2 slope=normal*(body*0.52+rim*0.48+ripple+frontSlope*0.19)+surfaceWave;
    vec3 ray=refract(vec3(0,0,-1),normalize(vec3(-slope,1)),0.7501875);
    vec2 refraction=ray.xy/max(0.2,-ray.z)*(0.070+depth*0.055)*youth;
    float weight=coverage*(0.45+depth*0.55)+wetFront*uSpread*0.26;
    flow+=refraction*weight;
    flowWeight+=weight;
    float density=mix(mix(0.38,1.0,uPigment),1.0,smoothstep(0.40,0.85,age));
    float loaded=1.0-(1.0-coverage*density)*(1.0-dilute);
    wash=1.0-(1.0-wash)*(1.0-loaded);
  }
  // Smooth necks join touching footprints; averaging surface slopes prevents
  // stacked droplets from multiplying the lens strength at their overlaps.
  float neckEdge=0.0015+uSpread*0.003;
  wash=max(wash,(1.0-smoothstep(-neckEdge,neckEdge,unionD))*mix(0.38,0.70,uPigment));
  flow/=max(1.0,flowWeight);
  // Remaining islands close into B; only source pixels ever enter the mix.
  wash=mix(wash,1.0,settle);
  vec2 micro=vec2(vnoise(q*82.0,uSeed+701u),vnoise(q*82.0+17.0,uSeed+709u))-0.5;
  flow=(flow+micro*0.0015*uGrain*wash)*uWater*(1.0-settle);
  vec3 incoming=texture(uB,clamp(vUv-flow/aspect,0.0,1.0)).rgb;
  vec3 outgoing=texture(uA,clamp(vUv+flow*0.35/aspect,0.0,1.0)).rgb;
  outColor=vec4(mix(outgoing,incoming,clamp(wash,0.0,1.0)),1);
}`;
export function create(gl: WebGL2RenderingContext): TransitionInstance {
  const { program: prog, u }=program(gl,FRAG);
  return {
    render({ texA, texB, width, height, eased, params:p, target }) {
      gl.bindFramebuffer(gl.FRAMEBUFFER,target); gl.viewport(0,0,width,height); gl.useProgram(prog);
      bindTex(gl,u.uA,texA,0); bindTex(gl,u.uB,texB,1); gl.uniform1f(u.uT,eased); gl.uniform2f(u.uRes,width,height);
      gl.uniform2fv(u.uCenter,pointToGl(p.center)); gl.uniform1f(u.uWater,Number(p.water)/100);
      const count=Number(p.count ?? 7);
      gl.uniform1i(u.uCount,Number.isFinite(count) ? Math.min(12,Math.max(1,Math.round(count))) : 7);
      gl.uniform1f(u.uPigment,Number(p.pigment)/100); gl.uniform1f(u.uGrain,Number(p.grain)/100);
      const spread=Number(p.spread ?? 65);
      gl.uniform1f(u.uSpread,Number.isFinite(spread) ? Math.min(1,Math.max(0,spread/100)) : 0.65);
      gl.uniform1ui(u.uSeed,Number(p.seed)>>>0); fullscreen(gl);
    },
    dispose() { gl.deleteProgram(prog); },
  };
}
export default { meta, params, create } satisfies TransitionModule;
