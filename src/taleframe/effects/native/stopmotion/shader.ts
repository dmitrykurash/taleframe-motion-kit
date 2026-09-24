/** Image-space handmade registration/material, compiled into the existing
 * finishing shader: no extra contexts, temporal image cache or random state. */
export const STOPMOTION_SHADER = `
uniform vec4 u_stop;
uniform vec3 u_stopMaterial;
uniform uint u_stopSeed,u_stopPose;
float handHash(ivec2 p,uint seed,uint channel){
 uvec2 q=uvec2(p);uint h=q.x*374761393u^q.y*668265263u^seed*2246822519u^(channel+1u)*3266489917u;
 h=(h^(h>>16))*2246822519u;h=(h^(h>>13))*3266489917u;return float(h^(h>>16))/4294967295.;
}
float handNoise(vec2 p,uint seed,uint channel){
 ivec2 i=ivec2(floor(p));vec2 f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(handHash(i,seed,channel),handHash(i+ivec2(1,0),seed,channel),f.x),
 mix(handHash(i+ivec2(0,1),seed,channel),handHash(i+ivec2(1,1),seed,channel),f.x),f.y);
}
vec2 handmadeUV(vec2 uv){
 if(u_stopMaterial.z<.5)return uv;
 vec2 p=(uv-.5)*u_project-u_stop.xy;
 float co=cos(u_stop.z),si=sin(u_stop.z);
 uv=.5+vec2(co*p.x+si*p.y,-si*p.x+co*p.y)/u_project;
 if(u_stop.w>0.){
  vec4 dx=sampleAt(uv+vec2(1./u_project.x,0.))-sampleAt(uv-vec2(1./u_project.x,0.));
  vec4 dy=sampleAt(uv+vec2(0.,1./u_project.y))-sampleAt(uv-vec2(0.,1./u_project.y));
  float edge=min(1.,2.*sqrt(dot(dx,dx)+dot(dy,dy)));
  p=uv*u_project;uint changing=u_stopSeed^((u_stopPose+1u)*2246822519u);
  vec2 stable=vec2(handNoise(p/17.,u_stopSeed,4u),handNoise(p/17.,u_stopSeed,6u))*2.-1.;
  vec2 formed=vec2(handNoise(p/31.,changing,5u),handNoise(p/31.,changing,7u))*2.-1.;
  uv+=(.65*stable+.35*formed)*u_stop.w*edge/u_project;
 }
 return uv;
}
vec3 handmadeSurface(vec3 color,vec2 source){
 if(u_stopMaterial.z<.5)return color;
 float luma=dot(color,vec3(.2126,.7152,.0722)),relief=0.;
 if(u_stopMaterial.x>0.){
  vec2 p=source*u_project;
  relief=.65*(handNoise(p*vec2(.52,1.37),u_stopSeed,21u)*2.-1.)+.35*(handNoise(p*vec2(.14,.52),u_stopSeed,22u)*2.-1.);
 }
 return color*u_stopMaterial.y*(1.+u_stopMaterial.x*.12*relief*max(0.,4.*luma*(1.-luma)));
}
`;
