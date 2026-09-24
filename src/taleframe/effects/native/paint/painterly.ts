/** Structure-guided paint reconstruction, from broad washes to small accents.
 * A denoised colour guide separates image structure from camera/compression
 * noise. Regularized tensor deformation, area-loaded pigments and continuous
 * overlapping wash sectors avoid unstable eigenvector/region decisions.
 * No frame history or stochastic time term: every frame can be sought directly.
 */
const COMMON = `
precision highp float;
precision highp int;
uniform sampler2D uSource,uPaper,uMobile,uFlow,uGuide,uCurrentGuide,uCurrentFlow,uTransport;
uniform bool uPrepared;
uniform float uGeneration;
// Maps are top-left CPU arrays, while paint fields use bottom-left GL UVs.
vec3 materialPoint(vec2 uv){
 if(!uPrepared)return vec3(uv,1.);
 ivec2 size=textureSize(uTransport,0);vec2 original=vec2(uv.x,1.-uv.y);
 vec2 p=clamp(original,.5/vec2(size),1.-.5/vec2(size));
 vec2 q=p*vec2(size)-.5;ivec2 i=ivec2(floor(q));vec2 f=fract(q);vec3 point=vec3(0);
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){
  vec3 v=texelFetch(uTransport,clamp(i+ivec2(x,y),ivec2(0),size-1),0).rgb;
  point+=v*(x==0?1.-f.x:f.x)*(y==0?1.-f.y:f.y);
 }
 point.xy+=original-p;
 return vec3(point.x,1.-point.y,point.z);
}
vec4 currentGuide(vec2 uv){vec4 c=texture(uCurrentGuide,uv);return vec4(c.rgb/max(c.a,.00001),c.a);}
uniform vec2 uSize,uReference;
uniform vec4 uSettings,uStroke;
uniform vec3 uGrid;
uniform ivec2 uOrigin;
uniform mat3 uMaterial;
uniform uint uSeed;
uniform float uEdgeScale;
vec3 linearRGB(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 srgb(vec3 c){c=max(c,vec3(0));return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
uint hash(uint x){x=(x^(x>>16u))*2246822519u;x=(x^(x>>13u))*3266489917u;return x^(x>>16u);}
float randomAt(ivec2 p){return float(hash(uint(p.x)*374761393u^uint(p.y)*668265263u^uSeed))/4294967295.;}
float noise(vec2 p){ivec2 i=ivec2(floor(p));vec2 f=fract(p);f=f*f*(3.-2.*f);return mix(mix(randomAt(i),randomAt(i+ivec2(1,0)),f.x),mix(randomAt(i+ivec2(0,1)),randomAt(i+ivec2(1,1)),f.x),f.y);}
float detailLevel(){return 1.-exp(-max(0.,uSettings.y)*1.8);}
float wetLevel(){return max(0.,uSettings.x)/(.8+max(0.,uSettings.x));}
float strokeLevel(){return 1.-exp(-max(0.,uStroke.z)*3.2);}
// Filter premultiplied colour before unpremultiplying; invisible texels must
// never tint a title's edge. Source texture itself remains straight-alpha.
vec4 paintSample(vec2 p){
 ivec2 size=textureSize(uSource,0);vec2 q=clamp(p,0.,1.)*vec2(size)-.5;
 ivec2 i=ivec2(floor(q));vec2 f=fract(q);vec4 sum=vec4(0);
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){
  vec4 c=texelFetch(uSource,clamp(i+ivec2(x,y),ivec2(0),size-1),0);
  float w=(x==0?1.-f.x:f.x)*(y==0?1.-f.y:f.y);
  sum+=vec4(linearRGB(c.rgb)*c.a,c.a)*w;
 }
 return vec4(sum.rgb/max(sum.a,.00001),sum.a);
}
vec4 guideSample(vec2 p){vec4 c=texture(uGuide,p);return vec4(c.rgb/max(c.a,.00001),c.a);}
float coherence(vec4 t){return sqrt(max(0.,(t.r-t.g)*(t.r-t.g)+4.*t.b*t.b))/(t.r+t.g+.0003);}
vec2 tensorDirection(vec4 tensor,vec2 fallbackAxis){
 // A positive-definite deformation never cancels or swaps eigenvectors.
 // In quiet/ambiguous areas it approaches identity, keeping the material's
 // resting direction. At an edge it stretches continuously along its tangent.
 // The previous double-angle blend could pass through zero and turn a brush
 // by 90 degrees when the input changed by only a fraction of a pixel.
 float trace=tensor.r+tensor.g;
 mat2 across=mat2(tensor.g,-tensor.b,-tensor.b,tensor.r)/(trace+.0003);
 float anisotropy=coherence(tensor);
 return normalize(fallbackAxis+across*fallbackAxis*(7.*anisotropy*anisotropy));
}
vec2 direction(vec4 tensor,vec2 p){
 float fallback=-.8+(noise(p*.009)-.5)*1.2;
 return tensorDirection(tensor,vec2(cos(fallback),sin(fallback)));
}
float compositionScale(vec2 p){
 float edge=smoothstep(.20,1.10,length((p/uReference-.5)*2.));
 float strength=max(0.,uEdgeScale)/(1.+max(0.,uEdgeScale)*.5);
 return exp(strength*(edge*.95-.30));
}
`;
const HEAD = '#version 300 es\n' + COMMON + '\nin vec2 uv;\nout vec4 result;\n';

export const PAINT_GUIDE = HEAD + `
void main(){
 vec4 center=paintSample(uv);vec4 sum=vec4(0);float total=0.;
 // Dense, fixed spatial support: the samples do not rotate with noisy image
 // gradients. A soft range weight keeps silhouettes and small high-contrast
 // features. Accumulate premultiplied linear RGB, including transparent edges.
 float radius=mix(1.65,1.05,detailLevel());
 for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
  vec4 c=paintSample(uv+vec2(x,y)*radius/uReference);
  vec3 d=(c.rgb-center.rgb)*min(c.a,center.a);
  float w=exp(-float(x*x+y*y)*.42-dot(d,d)*18.);
  sum+=vec4(c.rgb*c.a,c.a)*w;total+=w;
 }
 result=sum/total;
}`;

export const PAINT_TENSOR = HEAD + `
vec4 feature(vec2 p){return texture(uGuide,p);}
void main(){
 vec2 d=2.5/uReference;
 vec4 a=feature(uv+d*vec2(-1,1)),b=feature(uv+d*vec2(0,1)),c=feature(uv+d*vec2(1,1));
 vec4 e=feature(uv+d*vec2(-1,0)),f=feature(uv+d*vec2(1,0));
 vec4 g=feature(uv+d*vec2(-1,-1)),h=feature(uv+d*vec2(0,-1)),i=feature(uv+d*vec2(1,-1));
 vec4 gx=(c+2.*f+i-a-2.*e-g)*.25,gy=(a+2.*b+c-g-2.*h-i)*.25;
 result=vec4(dot(gx,gx),dot(gy,gy),dot(gx,gy),0);
}`;

export const PAINT_FLOW = HEAD + `
void main(){
 vec3 tensor=vec3(0);float total=0.;
 float radius=2.5+sqrt(max(0.,uSettings.w))*3.;
 for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
  float w=exp(-float(x*x+y*y)*.5);
  tensor+=texture(uMobile,uv+vec2(x,y)*radius/uReference).rgb*w;total+=w;
 }
 tensor/=total;result=vec4(tensor,sqrt(max(0.,tensor.r+tensor.g)));
}`;

export const PAINT_BASE = HEAD + `
void main(){
 vec4 center=guideSample(uv),flow=texture(uFlow,uv);vec2 tangent=direction(flow,uv*uReference),normal=vec2(-tangent.y,tangent.x);
 float detail=detailLevel(),radius=(5.+sqrt(max(0.,uSettings.w))*22.)*mix(1.25,.63,detail)*compositionScale(uv*uReference);
 radius*=mix(1.05,.62,flow.a/(flow.a+.055)*detail);
 float anisotropy=coherence(flow),stretch=1.+anisotropy*.8;
 vec3 sums[8],squares[8];float weights[8];
 const vec2 axes[8]=vec2[8](vec2(1,0),vec2(.707107,.707107),vec2(0,1),vec2(-.707107,.707107),vec2(-1,0),vec2(-.707107,-.707107),vec2(0,-1),vec2(.707107,-.707107));
 for(int k=0;k<8;k++){sums[k]=vec3(0);squares[k]=vec3(0);weights[k]=0.;}
 for(int y=-2;y<=2;y++)for(int x=-2;x<=2;x++){
  vec2 q=vec2(x,y)*.5;if(dot(q,q)>1.3)continue;
  vec2 offset=(tangent*q.x*stretch+normal*q.y/stretch)*radius;
  vec4 c=guideSample(uv+offset/uReference);
  float spatial=exp(-dot(q,q)*1.6)*c.a;
  // Smoothly overlapping polynomial sectors avoid selecting a winning
  // quadrant. Similar variances blend equally instead of flashing regions.
  for(int k=0;k<8;k++){
   float along=dot(q,axes[k]),across=dot(q,vec2(-axes[k].y,axes[k].x));
   float sector=max(0.,.42+along-.65*across*across);
   float w=sector*sector*spatial;
   sums[k]+=c.rgb*w;squares[k]+=c.rgb*c.rgb*w;weights[k]+=w;
  }
 }
 vec3 color=center.rgb*.0001;float total=.0001;
 for(int k=0;k<8;k++){
  vec3 mean=sums[k]/max(weights[k],.00001),variance=max(vec3(0),squares[k]/max(weights[k],.00001)-mean*mean);
  float v=max(0.,dot(variance,vec3(.333))-.00015);
  float w=1./(1.+pow(v*220.,2.));
  w*=exp(-dot(mean-center.rgb,mean-center.rgb)*mix(8.,36.,detail));
  color+=mean*w;total+=w;
 }
 result=vec4(color/total,center.a);
}`;

export const BRUSH_VERTEX = '#version 300 es\n' + COMMON + `
out vec2 brushUV;
out float brushSupport;
flat out vec4 brushColor;
flat out vec4 brushShape;
vec2 brushDirection(vec4 tensor,vec2 p){
 // Quiet paint has no reliable image direction. Its seeded axis belongs to
 // the clip material, so an animated clip carries that axis along with it.
 if(abs(determinant(mat2(uMaterial)))<.00000001)return direction(tensor,p);
 vec2 local=(inverse(uMaterial)*vec3(p,1.)).xy;
 vec2 fallback=normalize(mat2(uMaterial)*direction(vec4(0),local));
 return tensorDirection(tensor,fallback);
}
float colourSupport(vec4 s,vec4 center){
 vec3 d=s.rgb-center.rgb;
 return exp(-dot(d,d)*mix(5.,22.,detailLevel()))*min(1.,s.a/max(center.a,.001));
}
void main(){
 int nx=int(uGrid.x),segments=int(uStroke.w);
 int row=gl_InstanceID/nx,col=gl_InstanceID-row*nx;if((row+uOrigin.y)%2!=0)col=nx-1-col;
 ivec2 cell=ivec2(col,row)+uOrigin;
 float a=randomAt(cell+ivec2(31,17)),b=randomAt(cell+ivec2(73,9)),c=randomAt(cell+ivec2(3,91));
 float lengthRandom=randomAt(cell+ivec2(137,53)),widthRandom=randomAt(cell+ivec2(11,149));
 float scale=sqrt(abs(determinant(mat2(uMaterial))));
 vec2 seed=(uMaterial*vec3((vec2(cell)+.5+(vec2(a,b)-.5)*.7)*uGrid.z,1.)).xy;
 float spacing=uGrid.z*scale*compositionScale(seed);
 vec2 center=seed;
 vec4 flow=texture(uFlow,center/uReference);
 vec2 tangent=brushDirection(flow,center),normal=vec2(-tangent.y,tangent.x);
 // Follow a feature across the seed's neighbourhood. A weighted normal
 // projection is continuous; an argmax snap would pop between two edges.
 float total=0.;vec2 pull=vec2(0.);
 for(int j=-2;j<=2;j++){
  vec2 offset=normal*float(j)*spacing*.2;
  float energy=texture(uFlow,(seed+offset)/uReference).a;
  float w=energy*energy*exp(-float(j*j)*.4);
  total+=w;pull+=offset*w;
 }
 center+=pull/(total+.0003)*.35*coherence(flow);
 flow=texture(uFlow,center/uReference);
 tangent=brushDirection(flow,center);normal=vec2(-tangent.y,tangent.x);
 float confidence=coherence(flow)*coherence(flow);
 float detail=detailLevel(),level=uStroke.y;
 float opacity=.90;
 if(level>1.5)opacity*=flow.a/(flow.a+.06)*mix(.22,1.,detail);
 else if(level>.5)opacity*=mix(.42,1.,flow.a/(flow.a+.045));
 opacity*=smoothstep(0.,.85,max(0.,uStroke.z));
 vec2 sampleUV=center/uReference;
 vec4 centerColor=guideSample(sampleUV);
 opacity*=centerColor.a;
 if(opacity<.002||scale<.0001){brushUV=vec2(0);brushSupport=0.;brushColor=vec4(0);brushShape=vec4(0);gl_Position=vec4(2,2,0,1);return;}
 // Short touches, body strokes and occasional long gestures have independent
 // identities. Weak/ambiguous structure receives a dab, never a long rotor.
 float halfWidth=spacing*mix(.26,.70,widthRandom);
 float gestureLength=spacing*mix(.42,2.65,pow(lengthRandom,1.7));
 float halfLength=mix(halfWidth*mix(.85,1.25,lengthRandom),gestureLength,pow(confidence,.65));
 halfLength=max(halfWidth*.72,halfLength);
 if(level>1.5)halfLength=min(halfLength,spacing*1.45);
 // Estimate transverse room from source colours/coverage. A slender branch
 // gets a slender mark even when the chosen brush preset is broad.
 float room=0.;
 for(int j=1;j<=3;j++){
  float d=float(j)/3.;
  float support=min(colourSupport(guideSample(sampleUV+normal*halfWidth*d/uReference),centerColor),
                    colourSupport(guideSample(sampleUV-normal*halfWidth*d/uReference),centerColor));
  room+=support/3.;
 }
 halfWidth*=mix(1.,.28+.72*room,confidence);
 halfWidth=max(.38*scale,halfWidth);
 halfLength*=mix(1.,.6+.4*room,confidence*.35);
 // One shared pair of vertices per station makes a ribbon, with no overlapping
 // rectangle joints. Trace each half in the tensor's consistent local sign.
 int node=gl_VertexID/2;
 float q=float(node)*2./float(segments)-1.;
 float side=q<0.?-1.:1.;
 int halfSteps=max(1,segments/2),steps=segments==1?1:abs(node-segments/2);
 float stepSize=halfLength/float(halfSteps);
 vec2 position=center,travelDirection=tangent*side;float support=1.;
 for(int j=0;j<3;j++){
  if(j>=steps)break;
  vec2 midpoint=position+travelDirection*stepSize*.5;
  vec4 localFlow=texture(uFlow,midpoint/uReference);
  // Transport the current tangent through the positive-definite field. There
  // is no sign test at 90 degrees that could flip the next ribbon station.
  vec2 next=tensorDirection(localFlow,travelDirection);
  float alignment=max(0.,dot(next,travelDirection));
  next=normalize(travelDirection*.45+next*.55);
  vec2 candidate=position+next*stepSize;
  float colour=min(colourSupport(guideSample(midpoint/uReference),centerColor),colourSupport(guideSample(candidate/uReference),centerColor));
  float accepted=colour*mix(.65,1.,alignment);
  support*=pow(max(.001,accepted),.3);
  // Geometry does not collapse as a small edge passes the end of a brush.
  // Paint coverage fades there instead, leaving a continuous ribbon path.
  position+=next*stepSize;
  travelDirection=next;
 }
 vec2 along=travelDirection*side;normal=vec2(-along.y,along.x);
 float pressure=mix(.65,1.,1.-abs(q))*(.9+.1*cos(abs(q)*3.14159+c*6.283));
 position+=normal*(gl_VertexID%2==0?-1.:1.)*halfWidth*pressure*mix(.2,1.,support);
 vec4 loadedCenter=uPrepared?currentGuide(materialPoint(sampleUV).xy):centerColor;
 vec3 color=vec3(0);float weight=0.;vec2 loadNormal=vec2(-tangent.y,tangent.x);
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  vec2 offset=tangent*float(x)*halfLength*.24+loadNormal*float(y)*halfWidth*.4;
  vec2 loadUV=sampleUV+offset/uReference;
  vec4 loaded=uPrepared?currentGuide(materialPoint(loadUV).xy):guideSample(loadUV);
  float w=exp(-float(x*x+y*y)*.7)*colourSupport(loaded,loadedCenter)*loaded.a;
  color+=loaded.rgb*w;weight+=w;
 }
 color=color/max(weight,.00001);
 color*=exp((a-.5)*mix(.035,.13,flow.a/(flow.a+.03))*strokeLevel());
 brushUV=vec2(q,gl_VertexID%2==0?-1.:1.);
 vec3 transported=materialPoint(position/uReference);
 brushSupport=mix(.08,1.,support)*transported.z;
 brushColor=vec4(color,opacity);brushShape=vec4(halfLength,halfWidth,a,b);
 gl_Position=vec4(transported.xy*2.-1.,0,1);
}`;

export const BRUSH_FRAGMENT = '#version 300 es\n' + COMMON + `
in vec2 brushUV;
in float brushSupport;
flat in vec4 brushColor;
flat in vec4 brushShape;
out vec4 result;
void main(){
 float wet=wetLevel(),character=strokeLevel();vec2 q=brushUV;
 float id=brushShape.z*143.,width=brushShape.y;
 // Broad flat tip, asymmetric pressure and a torn leading/trailing edge.
 // The footprint is invariant under q -> -q: a tensor is an unoriented
 // axis. A 180-degree axis change must not swap two different brush marks.
 float tail=.76+.17*noise(vec2(q.y*9.+id,71.));
 float tip=.76+.17*noise(vec2(-q.y*9.+id,71.));
 float side=.83+.09*noise(vec2(abs(q.x)*5.+id,43.))+.07*noise(vec2(q.x*q.y*19.+id,8.));
 float exponent=mix(2.3,7.,smoothstep(1.2,3.,brushShape.x/max(width,.001)));
 float across=abs(q.y+q.x*.045*sin(id))/side;
 float end=abs(q.x)/(q.x<0.?tail:tip);
 // Ambiguous structure becomes a rounded wet dab. Confident elongated
 // gestures retain a flatter brush tip, rather than rotating square stamps.
 float boundary=(pow(pow(across,exponent)+pow(end,exponent),1./exponent)-1.)*min(side,min(tail,tip));
 float feather=mix(.008,.052,wet);float aa=max(fwidth(boundary),.003);
 float coverage=1.-smoothstep(-feather-aa,aa,boundary);
 // Pigment lies between individual bristles, letting an earlier painted
 // layer show through. These grooves run with the brush, never screen noise.
 float groove=noise(vec2(abs(q.y)*width*1.9+id,abs(q.x)*.8+9.));
 float dry=smoothstep(.22,.65,groove);
 coverage*=mix(1.,.32+.68*dry,smoothstep(.28,.92,abs(q.x))*(1.-wet)*.8);
 vec2 screen=gl_FragCoord.xy/uSize;vec4 source=uPrepared?currentGuide(screen):guideSample(screen);
 // Soft colour rejection contains strokes at meaningful image boundaries,
 // while allowing an irregular, slightly overpainted edge instead of a mask.
 float difference=length(source.rgb-brushColor.rgb);
 float gate=mix(.025,1.,exp(-difference*difference*mix(9.,30.,detailLevel())));
 vec3 color=mix(brushColor.rgb,source.rgb,.18*detailLevel());
 float edge=exp(-abs(boundary+.04)*24.);
 color*=exp(-edge*wet*.095);
 float energy=uPrepared?texture(uCurrentFlow,screen).a:texture(uFlow,screen).a,localDetail=energy/(energy+.04);
 float fibre=(groove-.5)*(.08+.10*character)*(1.-wet*.65)*mix(.15,1.,localDetail);
 color=max(vec3(0),color*(1.+fibre));
 float alpha=clamp(coverage*brushColor.a*gate*brushSupport,0.,.9999);
 // Optical-density weighting keeps coverage steady while old/new generations overlap.
 result=vec4(color,1.-pow(1.-alpha,uGeneration));
}`;

export const PAINT_FINISH = HEAD + `
uniform float uAmount;
void main(){
 vec4 original=texture(uSource,uv),underpaint=texture(uMobile,uv);vec3 painted=underpaint.rgb;
 // Fine accents remain at output resolution (eyes, lettering, 4K edges).
 // Keep a bounded high-frequency colour residual, not a photo overlay.
 vec3 center=paintSample(uv).rgb,local=vec3(0);float weight=0.;
 const vec2 around[4]=vec2[4](vec2(1,0),vec2(-1,0),vec2(0,1),vec2(0,-1));
 for(int i=0;i<4;i++){vec4 s=paintSample(uv+around[i]*1.8/uReference);local+=s.rgb*s.a;weight+=s.a;}
 vec3 accent=center-local/max(weight,.00001);
 painted+=accent*detailLevel()*.48;
 // If a subpixel transparent feature fell between material-grid samples,
 // recover its colour rather than turning that preserved alpha dark.
 float missed=clamp((original.a-underpaint.a)/max(original.a,.00001),0.,1.);
 painted=mix(painted,center,missed);
 vec4 paper=texture(uPaper,uv);float relief=(paper.a-.5)*.025+(paper.r-.5)*.009;
 // Paper changes deposited pigment coverage locally, not the image's white
 // point. Full strength replaces the source with the reconstructed painting.
 painted*=exp(relief*uSettings.z);
 vec3 color=mix(linearRGB(original.rgb),max(vec3(0),painted),uAmount);
 result=vec4(clamp(srgb(color),0.,1.),original.a);
}`;
