/** A normalized dissolve of the two source pictures in encoded color space. */
import { bindTex, fullscreen, program } from '../kit';
import type { TransitionInstance, TransitionMeta, TransitionModule, TransitionParam } from '../types';
export const meta: TransitionMeta = {
  id: 'crossfade', name_ru: 'Растворение', description_ru: 'Один кадр плавно сменяет другой, сохраняя исходные цвета.',
  defaultDurationSec: 0.8, minDurationSec: 0.1, maxDurationSec: 4,
  defaultEase: [0.4, 0, 0.2, 1], version: 2,
};
// Saved `linear` values are accepted as legacy data; no exposure-changing mode.
export const params: readonly TransitionParam[] = [];
const FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uA, uB;
uniform float uT;
out vec4 outColor;
void main() {
  outColor=vec4(mix(texture(uA,vUv).rgb,texture(uB,vUv).rgb,clamp(uT,0.0,1.0)),1);
}`;
export function create(gl: WebGL2RenderingContext): TransitionInstance {
  const { program: prog, u }=program(gl,FRAG);
  return {
    render({texA,texB,width,height,eased,target}) {
      gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,width,height);gl.useProgram(prog);
      bindTex(gl,u.uA,texA,0);bindTex(gl,u.uB,texB,1);gl.uniform1f(u.uT,eased);fullscreen(gl);
    },
    dispose(){gl.deleteProgram(prog);},
  };
}
export default {meta,params,create} satisfies TransitionModule;
