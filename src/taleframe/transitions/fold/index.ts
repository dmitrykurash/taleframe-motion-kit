/** Connected concertina geometry, inverse projected per panel; no independent tile flips. */
import { bindTex, fullscreen, hexToRgb, program } from '../kit';
import type { TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';
export const meta: TransitionMeta = {
  id: 'fold', name_ru: 'Складка', description_ru: 'Кадр складывается в бумажную гармошку и раскрывается новой сценой.',
  defaultDurationSec: 1.05, minDurationSec: 0.3, maxDurationSec: 4, defaultEase: [0.33,0,0.67,1], version: 1,
};
export const params: readonly TransitionParam[] = [
  { id: 'axis', type: 'enum', label_ru: 'Складки', default: 'vertical', options: [{value:'vertical',label_ru:'Вертикальные'},{value:'horizontal',label_ru:'Горизонтальные'}] },
  { id: 'panels', type: 'number', label_ru: 'Грани', min: 2, max: 6, step: 1, default: 4 },
  { id: 'depth', type: 'number', label_ru: 'Глубина', min: 0, max: 100, step: 1, default: 64, unit: '%' },
  { id: 'shade', type: 'number', label_ru: 'Свет на сгибах', min: 0, max: 100, step: 1, default: 65, unit: '%' },
  { id: 'color', type: 'color', label_ru: 'Подложка', default: '#161923' },
];
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uA, uB;
uniform float uT, uDepth, uShade, uHorizontal, uPanels;
uniform vec2 uRes;
uniform vec3 uColor;
out vec4 outColor;
void main() {
  if (uT <= 0.0) { outColor=vec4(texture(uA,vUv).rgb,1); return; }
  if (uT >= 1.0) { outColor=vec4(texture(uB,vUv).rgb,1); return; }
  vec2 uv = mix(vUv,vUv.yx,uHorizontal);
  float fold = sin(uT*3.14159265);
  float angle = fold*1.558;
  float cs = cos(angle), sn = sin(angle);
  float perspective = uDepth*1.8;
  vec2 s = uv-0.5;
  vec3 col = uColor;
  // Broad displaced shadow under the folded sheet, independent from its face lighting.
  float shadow = (1.0-smoothstep(cs*0.5,cs*0.5+0.07,abs(s.x-0.025*fold))) * (1.0-smoothstep(0.48,0.59,abs(s.y+0.018*fold)));
  col *= 1.0-shadow*fold*0.45;
  for (int j=0; j<6; j++) {
    if (float(j)>=uPanels) break;
    float jf=float(j), alternate=mod(jf,2.0);
    float x0=(jf/uPanels-0.5)*cs;
    float z0=alternate*sn/uPanels;
    float dz=(1.0-2.0*alternate)*sn/uPanels;
    float dx=cs/uPanels;
    // Solve s.x = (x0 + f*dx)/(1 + perspective*(z0 + f*dz)).
    float denominator=dx-s.x*perspective*dz;
    float f=(s.x*(1.0+perspective*z0)-x0)/max(denominator,0.00001);
    if (f<0.0 || f>1.0) continue;
    float z=z0+f*dz;
    float y=s.y*(1.0+perspective*z)+0.5;
    if (y<0.0 || y>1.0) continue;
    vec2 source=vec2((jf+f)/uPanels,y);
    source=mix(source,source.yx,uHorizontal);
    vec3 picture=uT<0.5 ? texture(uA,source).rgb : texture(uB,source).rgb;
    float light=1.0-uShade*fold*(0.18+0.40*alternate);
    float crease=exp(-min(f,1.0-f)*95.0)*fold*uShade;
    float coverage=1.0-smoothstep(0.5-1.0/min(uRes.x,uRes.y),0.5,abs(y-0.5));
    col=mix(col,picture*light+vec3(0.055)*crease,coverage);
  }
  outColor=vec4(col,1);
}`;
export function create(gl: WebGL2RenderingContext): TransitionInstance {
  const { program: prog,u }=program(gl,FRAG);
  return {
    render({texA,texB,width,height,eased,params:p,target}) {
      gl.bindFramebuffer(gl.FRAMEBUFFER,target); gl.viewport(0,0,width,height); gl.useProgram(prog);
      bindTex(gl,u.uA,texA,0); bindTex(gl,u.uB,texB,1); gl.uniform1f(u.uT,eased); gl.uniform2f(u.uRes,width,height);
      gl.uniform1f(u.uPanels,Math.round(Number(p.panels))); gl.uniform1f(u.uDepth,Number(p.depth)/100);
      gl.uniform1f(u.uShade,Number(p.shade)/100); gl.uniform1f(u.uHorizontal,p.axis==='horizontal'?1:0);
      gl.uniform3fv(u.uColor,hexToRgb(p.color)); fullscreen(gl);
    },
    dispose(){gl.deleteProgram(prog);},
  };
}
export default {meta,params,create} satisfies TransitionModule;
