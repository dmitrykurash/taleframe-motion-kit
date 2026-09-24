/** Paint is transported as RGB optical density, never as an added noise layer. */
export const VERTEX = `#version 300 es
out vec2 uv;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0,1);}`;
const HEAD = `#version 300 es
precision highp float;
precision highp int;
in vec2 uv;
uniform sampler2D uSource,uPaper,uMobile,uDeposit;
uniform vec2 uSize,uReference;
uniform vec4 uSettings;
uniform uint uSeed;
vec3 linearRGB(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 srgb(vec3 c){c=max(c,vec3(0));return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
vec3 density(vec3 c){return -log(max(c,vec3(.003)));}
float luminance(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}
vec3 sourceAt(vec2 p){return linearRGB(texture(uSource,clamp(p,0.,1.)).rgb);}
const vec2 DIR[4]=vec2[4](vec2(1,0),vec2(-1,0),vec2(0,1),vec2(0,-1));
`;
const NOISE = `
uint hash(uint x){x=(x^(x>>16u))*2246822519u;x=(x^(x>>13u))*3266489917u;return x^(x>>16u);}
float randomAt(ivec2 p){return float(hash(uint(p.x)*374761393u^uint(p.y)*668265263u^uSeed))/4294967295.;}
float noise(vec2 p){ivec2 i=ivec2(floor(p));vec2 f=fract(p);f=f*f*(3.-2.*f);return mix(mix(randomAt(i),randomAt(i+ivec2(1,0)),f.x),mix(randomAt(i+ivec2(0,1)),randomAt(i+ivec2(1,1)),f.x),f.y);}
`;
export const PAPER = HEAD + NOISE + `
out vec4 result;
void main(){
 vec2 p=uv*uReference;
 p+=(vec2(noise(p*.043),noise(p*.043+vec2(37.1,19.8)))-.5)*6.2;
 float broad=noise(p*.014)+.5*noise(p*.035+17.3);
 float fibre=.5*noise(p*vec2(.045,.38))+.5*noise(vec2(p.x+p.y*.37,p.y-p.x*.12)*vec2(.26,.055)+29.);
 vec2 oblique=mat2(.8,.6,-.6,.8)*p;
 float tooth=(noise(oblique*.29+53.)+.5*noise(mat2(.932,-.362,.362,.932)*p*.47+13.4))/1.5;
 float height=.37*tooth+.36*fibre+.27*broad/1.5;
 // Height drives flow; permeability and basin depth control deposition.
 result=vec4(height,.24+.76*fibre,broad/1.5,tooth);
}`;

const INIT = HEAD + `
layout(location=0) out vec4 mobileOut;
layout(location=1) out vec4 depositOut;

`;
const WASH = `
vec3 wash(float radius,float protection){
 vec3 center=sourceAt(uv);
 vec3 sums[4],squares[4];float weights[4];
 for(int k=0;k<4;k++){sums[k]=vec3(0);squares[k]=vec3(0);weights[k]=0.;}
 // Continuous variance-weighted sectors reconstruct connected colour washes.
 // There is no hard winning sector or palette quantisation to shimmer on video.
 for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
  vec3 c=sourceAt(uv+vec2(x,y)*radius/uReference);
  float w=exp(-dot(vec2(x,y),vec2(x,y))*.20);
  for(int k=0;k<4;k++){
   bool inside=(k%2==0?x<=0:x>=0)&&(k<2?y<=0:y>=0);
   if(inside){sums[k]+=c*w;squares[k]+=c*c*w;weights[k]+=w;}
  }
 }
 vec3 result=center*.0001;float total=.0001;
 for(int k=0;k<4;k++){
  vec3 mean=sums[k]/weights[k],variance=max(vec3(0),squares[k]/weights[k]-mean*mean);
  float w=1./pow(1.+dot(variance,vec3(.3333))*520.,3.);
  w*=exp(-dot(mean-center,mean-center)*mix(2.,20.,protection));
  result+=mean*w;total+=w;
 }
 return result/total;
}
`;
export const INIT_PIGMENT = INIT + WASH + `
void main(){
 vec3 color=wash(2.8+uSettings.x*4.,.65);
 vec3 mass=density(color)*.98;
 float suspension=min(.99,mix(.2,.93,uSettings.y));
 mobileOut=vec4(mass*suspension,.75);
 depositOut=vec4(mass*(1.-suspension),1);
}`;

const STEP = HEAD + `
layout(location=0) out vec4 mobileOut;
layout(location=1) out vec4 depositOut;
`;
export const STEP_PIGMENT = STEP + `
void main(){
 vec4 m=texture(uMobile,uv),paper=texture(uPaper,uv);
 vec3 mass=m.rgb,color=sourceAt(uv);
 float granulation=uSettings.x,settling=uSettings.y;
 // Mineral fractions have slightly different settling/transport rates.
 vec3 mobility=vec3(.93,1.0,1.07);
 for(int i=0;i<4;i++){
  vec2 p=clamp(uv+DIR[i]/uSize,vec2(.5)/uSize,1.-vec2(.5)/uSize);
  vec4 n=texture(uMobile,p),np=texture(uPaper,p);
  vec3 dc=sourceAt(p)-color;
  float gate=.12+.88*exp(-dot(dc,dc)*38.);
  float downhill=(np.r-paper.r)*granulation*(.4+.6*uSettings.z);
  // A conservative downhill exchange gathers pigment in real paper valleys.
  float flux=clamp(downhill*.34*settling*gate,-.12,.12);
  mass+=flux*(flux>0.?n.rgb:m.rgb)*mobility;
  mass+=(n.rgb-m.rgb)*(.018*max(0.,1.-granulation)*gate);
 }
 mass=max(mass,vec3(0));
 float basin=1.-smoothstep(.28,.66,paper.r);
 vec3 rate=clamp((.015+basin*.24*granulation)*(.35+.65*settling)*vec3(1.06,1.,.94),0.,.35);
 vec3 fixedMass=texture(uDeposit,uv).rgb+mass*rate;
 mobileOut=vec4(mass*(1.-rate),m.a*.94);
 depositOut=vec4(fixedMass,1);
}`;

export const RESOLVE = HEAD + `
uniform int uMode;
uniform float uAmount;
out vec4 result;
void main(){
 vec4 original=texture(uSource,uv),paper=texture(uPaper,uv);
 vec3 mobile=texture(uMobile,uv).rgb,fixedMass=texture(uDeposit,uv).rgb;
 vec3 mass=mobile+fixedMass;
 // Beer–Lambert attenuation of a reflective paper ground, per RGB channel.
 // This is optical-density mixing, not interpolation of paint RGB swatches.
 vec2 px=1./uSize;
 float dx=texture(uPaper,uv+vec2(px.x,0)).r-texture(uPaper,uv-vec2(px.x,0)).r;
 float dy=texture(uPaper,uv+vec2(0,px.y)).r-texture(uPaper,uv-vec2(0,px.y)).r;
 float relief=(dx-dy)*.10+(paper.a-.5)*.026;
 vec3 paperColor=mix(vec3(1),linearRGB(vec3(.989,.977,.953)),uSettings.z);
 paperColor*=1.+relief*uSettings.z;
 vec3 painted=paperColor*exp(-mass);
 vec3 color=mix(linearRGB(original.rgb),max(painted,vec3(0)),uAmount);
 result=vec4(clamp(srgb(color),0.,1.),original.a);
}`;
