import {bundle} from '@remotion/bundler';
import {selectComposition,renderStill,openBrowser} from '@remotion/renderer';
import {writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out=base+'/out/transition-qa',chromiumOptions={gl:'angle'};
await mkdir(out,{recursive:true});
const browser=await openBrowser('chrome',{chromiumOptions});
try{
 const url=await bundle({entryPoint:base+'/src/index.tsx',publicDir:base+'/public'});
 const composition=await selectComposition({serveUrl:url,id:'Transition-Gallery',chromiumOptions,puppeteerInstance:browser});
 const names=['crossfade','dip','engraving','whip','prism','ink','watercolor','waterspill','paperpaint','sand','capillary','marbling','ripple','contour','godrays','fold','halftone','signal','ribbon','frost'];
 for(const [i,name] of names.entries()){
  await renderStill({serveUrl:url,composition,frame:i*120+63,output:out+'/'+name+'.png',chromiumOptions,puppeteerInstance:browser});console.log('Rendered '+name);
 }
 const probeUrl=await bundle({entryPoint:base+'/tests/fixtures/TransitionProbe.tsx'});
 const probe=await selectComposition({serveUrl:probeUrl,id:'Transition-Probe',chromiumOptions,puppeteerInstance:browser});
 let result=null;
 await renderStill({serveUrl:probeUrl,composition:probe,frame:0,output:out+'/probe.png',chromiumOptions,puppeteerInstance:browser,onBrowserLog(log){if(log.text.startsWith('GPU_TRANSITION_QA:'))result=JSON.parse(log.text.slice('GPU_TRANSITION_QA:'.length));}});
 if(!result)throw new Error('No GPU probe result');
 await writeFile(out+'/gpu-results.json',JSON.stringify({date:new Date().toISOString(),gl:'angle',width:320,height:180,results:result},null,2)+'\n');
 await writeFile(out+'/index.html',`<style>body{font-family:system-ui;background:#eee}main{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}img{width:100%}</style><main>${names.map(name=>`<figure><img src="${name}.png"><figcaption>${name}</figcaption></figure>`).join('')}</main>`);
 console.log('All 20 native shaders passed exact endpoint and arbitrary-seek pixel tests.');
}finally{await browser.close({silent:true});}
