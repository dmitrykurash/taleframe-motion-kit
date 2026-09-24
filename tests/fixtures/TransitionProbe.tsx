import React, {useEffect, useState} from 'react';
import {Composition, registerRoot, continueRender, delayRender, cancelRender} from 'remotion';
import {TransitionHost, CONTEXT_ATTRS} from '../../src/taleframe/transitions/host';
import {listTransitions} from '../../src/taleframe/transitions/registry';
import {transitionFrame} from '../../src/taleframe/transitions/adapter';
const width = 320, height = 180;
const Probe = () => {
 const [handle] = useState(() => delayRender('GPU transition probe'));
 useEffect(() => {
  const canvas = document.createElement('canvas');canvas.width=width;canvas.height=height;
  const gl = canvas.getContext('webgl2', {...CONTEXT_ATTRS,preserveDrawingBuffer:true})!;
  const host = new TransitionHost(gl);
  try {
   const plate = (a: string,b: string) => {const c=document.createElement('canvas');c.width=width;c.height=height;const x=c.getContext('2d')!;x.fillStyle=a;x.fillRect(0,0,width,height);x.fillStyle=b;x.fillRect(0,0,width/2,height/2);return c;};
   const a=plate('#ed8042','#39539e'), b=plate('#66c5b6','#efcc80');
   const draw = (kind:string,frame:number) => {
    const state=transitionFrame(frame,0,101,60,kind), {module,...args}=state;
    const instance=host.instance(module)!;host.ensureInputs(width,height,!!module.meta.inputs?.mipmaps);host.upload('A',a);host.upload('B',b);
    host.render(instance,{...args,width,height,pxScale:height/1080,target:null,draft:false});host.sync();
    const error=gl.getError();if(error!==gl.NO_ERROR)throw new Error(kind+' GL error '+error);
    return host.readAll();
   };
   const diff=(x:Uint8Array,y:Uint8Array)=>x.reduce((m,v,i)=>Math.max(m,Math.abs(v-y[i])),0);
   const A=draw('crossfade',0),B=draw('crossfade',100),report=[];
   for(const mod of listTransitions(true)){
    const start=draw(mod.meta.id,0),end=draw(mod.meta.id,100),mid=draw(mod.meta.id,50);
    draw(mod.meta.id,99);draw(mod.meta.id,2);draw(mod.meta.id,74);draw(mod.meta.id,16);
    const repeat=draw(mod.meta.id,50);
    const result={kind:mod.meta.id,startMaxDifference:diff(A,start),endMaxDifference:diff(B,end),repeatMaxDifference:diff(mid,repeat)};
    if(result.startMaxDifference>1 || result.endMaxDifference>1 || result.repeatMaxDifference>0) throw new Error(JSON.stringify(result));
    report.push(result);
   }
   console.log('GPU_TRANSITION_QA:'+JSON.stringify(report));continueRender(handle);
  }catch(error){cancelRender(error);}finally{host.dispose();}
 },[]);
 return <div style={{background:'#eef1f4',width,height}}>Transition probe passed</div>;
};
registerRoot(()=> <Composition id="Transition-Probe" component={Probe} width={width} height={height} fps={60} durationInFrames={1}/>);
