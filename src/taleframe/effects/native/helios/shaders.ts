export const HELIOS_SAMPLES = 128;
export const vertex = `#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;

const common = `
precision highp float;
uniform vec2 u_size, u_aspect, u_focus;
uniform vec4 u_lens; // radius, feather, aperture, blur / 1080
uniform vec4 u_character; // swirl, curvature, highlights, vignette
vec2 uvAt(){return gl_FragCoord.xy/u_size;}
vec3 linearize(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 encode(vec3 c){c=max(c,vec3(0.));return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
float defocus(vec2 uv){
 float r=length((uv-u_focus)*u_aspect);
 float d=max(0.,r-u_lens.x)/u_lens.y;
 // A smoothly curved focus field, not a discontinuous sharp/blur matte.
 d*=1.+1.4*u_character.y*min(r*r*2.,1.);
 return 1.-exp(-d*d);
}
vec2 reflectEdge(vec2 uv){return 1.-abs(mod(uv,2.)-1.);}
`;

/** Linear-light, premultiplied radiance; HDR preserves the energy of tiny bright input objects. */
export const prepare = `#version 300 es
${common}
uniform sampler2D u_input;
out vec4 outColor;
void main(){
 vec2 uv=uvAt();vec4 c=texture(u_input,uv);
 vec3 rgb=linearize(c.rgb);
 float lum=dot(rgb,vec3(.2126,.7152,.0722));
 // An explicit creative gain on existing bright, defocused source areas. Black remains black.
 float neighbourhood=max(1.,u_lens.w*min(u_size.x,u_size.y)*.75);
 float surround=dot(linearize(textureLod(u_input,uv,log2(neighbourhood)).rgb),vec3(.2126,.7152,.0722));
 float isolated=smoothstep(.06,.4,lum-surround);
 float gain=1.+u_character.z*6.*smoothstep(.45,1.,lum)*isolated*defocus(uv);
 outColor=vec4(rgb*gain*c.a,c.a);
}`;

/** Integrate a clipped exit pupil whose long axis is tangent to the image circle. */
export const blur = `#version 300 es
${common}
uniform sampler2D u_radiance;
uniform vec2 u_sourceSize;
uniform vec2 u_pupil[${HELIOS_SAMPLES}];
out vec4 outColor;
void main(){
 vec2 uv=uvAt();vec2 p=(uv-u_focus)*u_aspect;
 float r=length(p),wide=2./u_lens.z;
 float coc=u_lens.w*wide*defocus(uv);
 if(coc*min(u_sourceSize.x,u_sourceSize.y)<.15){outColor=textureLod(u_radiance,uv,0.);return;}
 vec2 radial=r>.00001?p/r:vec2(1.,0.);
 vec2 tangent=vec2(-radial.y,radial.x);
 // Numeric entry can exceed the slider's aperture/swirl presets. The exit
 // pupil still has positive area, including at extreme creative settings.
 float cat=min(.98,.78*u_character.x*pow(wide,.8)*smoothstep(.08,.85,r));
 vec2 axes=vec2(1.-cat,sqrt(1.-cat*cat));
 // A sample covers a finite area of the pupil. Mip integration avoids sparse bright dots
 // at large radii while retaining the silhouette of the clipped pupil.
 float footprint=coc*min(u_sourceSize.x,u_sourceSize.y)*.18;
 float lod=max(0.,log2(max(footprint,1.)));
 vec4 sum=vec4(0.);float norm=0.;
 for(int i=0;i<${HELIOS_SAMPLES};i++){
   vec2 q=u_pupil[i]*axes;
   float boundary=length(vec2(abs(q.x)+cat,q.y));
   float pupil=1.-smoothstep(.96,1.015,boundary);
   // Mild edge emphasis models an aberrated blur-disc profile, not a Gaussian smear.
   float weight=pupil*(1.+.3*wide*smoothstep(.72,.96,boundary));
   vec2 sampleUV=uv+(radial*q.x+tangent*q.y)*coc/u_aspect;
   sum+=textureLod(u_radiance,reflectEdge(sampleUV),lod)*weight;
   norm+=weight;
 }
 outColor=sum/max(norm,.001);
}`;

export const composite = `#version 300 es
${common}
uniform sampler2D u_input,u_blurred;
uniform float u_amount;
out vec4 outColor;
void main(){
 vec2 uv=uvAt();vec4 original=texture(u_input,uv);
 vec4 blurred=texture(u_blurred,uv);
 float coc=u_lens.w*(2./u_lens.z)*defocus(uv)*min(u_size.x,u_size.y);
 // Preserve the original high-resolution focal plane, including crisp text and fine hair.
 float blend=u_amount*smoothstep(.1,1.5,coc);
 vec4 sharp=vec4(linearize(original.rgb)*original.a,original.a);
 vec4 result=mix(sharp,blurred,blend);
 float r=length((uv-u_focus)*u_aspect);
 float falloff=1.-u_character.w*u_amount*.65*smoothstep(.25,1.1,r);
 vec3 color=result.a>.00001?result.rgb/result.a:vec3(0.);
 outColor=vec4(clamp(encode(color*falloff),0.,1.),result.a);
}`;
