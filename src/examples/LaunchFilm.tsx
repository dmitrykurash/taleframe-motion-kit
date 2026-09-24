import React from 'react';
import {CalculateMetadataFunction} from 'remotion';
import {CameraLayer, CharacterReveal, LogicalStage, ParallaxBackground, WordReveal,
  arrive, focusCamera, mix, travel, useTime} from '../kit';

export type LaunchProps = {
  name: string; opening: string[]; outcome: string[]; website: string; accent: string;
  output: {width: number; height: number; fps: number};
};
export const defaultLaunchProps: LaunchProps = {
  name: 'Field Notes', opening: ['Make room for', 'what comes next.'],
  outcome: ['A small step.', 'A clear direction.'], website: 'fieldnotes.example', accent: '#e26840',
  output: {width: 1920, height: 1080, fps: 30},
};
export function validateLaunchProps(input: LaunchProps): LaunchProps {
  for (const field of ['name', 'website'] as const) {
    if (typeof input[field] !== 'string' || !input[field].trim() || input[field].length > 32)
      throw new Error(`${field} must be 1–32 characters.`);
  }
  for (const field of ['opening', 'outcome'] as const) {
    if (!Array.isArray(input[field]) || input[field].length < 1 || input[field].length > 2 ||
      input[field].some(line => typeof line !== 'string' || !line.trim() || line.length > 28))
      throw new Error(`${field} needs one or two short lines (up to 28 characters each).`);
  }
  if (!/^#[0-9a-f]{6}$/i.test(input.accent)) throw new Error('accent must be a six-digit hex color.');
  const o = input.output;
  if (!o || ![o.width,o.height,o.fps].every(Number.isInteger) || o.width < 640 || o.width > 7680 ||
    o.height < 360 || o.height > 4320 || o.width % 2 || o.height % 2 ||
    o.width * 9 !== o.height * 16 || ![24,25,30,50,60].includes(o.fps))
    throw new Error('output must use even 16:9 dimensions and a supported frame rate.');
  return input;
}
export const calculateLaunchMetadata: CalculateMetadataFunction<LaunchProps> = ({props}) => {
  const p = validateLaunchProps(props);
  return {width:p.output.width,height:p.output.height,fps:p.output.fps,durationInFrames:18*p.output.fps,props:p};
};
const serif='"Instrument Serif", serif', sans='"DM Sans Variable", sans-serif';
const center:React.CSSProperties={position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'};

/** Fictional launch direction: an editorial opening, a workflow, a benefit, and a quiet close.
 * The scene structure and artwork are editable; neither is a requirement for a new project. */
export function LaunchFilm(input:LaunchProps) {
  const p=validateLaunchProps(input),t=useTime(),ink='#24332f',paper='#f4f2e9';
  const move=travel(t,5,4.2),cam=focusCamera({x:mix(790,1130,move),y:535},mix(1.16,1.05,move));
  const cardEnter=arrive(t,4.3,.8),cardExit=travel(t,9.6,.65);
  return <LogicalStage background={paper}>
    <div style={{position:'absolute',inset:0,color:ink,fontFamily:sans}}>
      <ParallaxBackground camera={t>=4&&t<10.3?cam:{x:0,y:0,scale:1}} color={paper} depth={.12} overscan={1.28}>
        <svg viewBox="0 0 1920 1080" width="1920" height="1080" style={{opacity:.26}}>
          <path d="M-150 1080C260 1170 350 710 230 600S-90 300 120-60" fill="none" stroke="#bac2aa" strokeWidth="130"/>
          <path d="M1770-140C1450 100 1810 400 2130 430" fill="none" stroke="#d6b6a0" strokeWidth="170"/>
        </svg>
      </ParallaxBackground>
      {t<4.3&&<div style={center}>{p.opening.map((line,i)=><CharacterReveal key={i} text={line}
        fontFamily={serif} fontSize={114} start={.2+i*.12} exit={3.65} time={t} color={ink}/>)}</div>}
      {t>=4&&t<10.3&&<CameraLayer camera={cam} style={{opacity:cardEnter*(1-cardExit)}}>
        <div style={{position:'absolute',left:355,top:295,display:'flex',gap:24,transform:`translateY(${70*(1-cardEnter)-70*cardExit}px)`}}>
          {[
            {n:'01',title:'A place to start',body:'Collect the things that matter.',kind:'Draft'},
            {n:'02',title:'Shape the idea',body:'A little clarity goes a long way.',kind:'Review'},
            {n:'03',title:'Ready for the world',body:'Put your next chapter in motion.',kind:'Publish'},
          ].map((card,i)=>{
            const e=arrive(t,4.38+i*.15,.75),active=travel(t,5.55+i*.9,.55);
            return <div key={card.n} style={{width:386,height:472,boxSizing:'border-box',padding:34,
              background:i===1?ink:'#fffdf7',color:i===1?paper:ink,borderRadius:12,
              border:`1px solid ${i===1?ink:'#dddcd1'}`,opacity:e,transform:`translateY(${(1-e)*64}px)`}}>
              <div style={{fontSize:17,opacity:.55}}>{card.n}</div>
              <svg width="120" height="138" viewBox="0 0 120 138" style={{marginTop:25,overflow:'visible'}}>
                <rect x="18" y="17" width="68" height="88" rx="4" fill="none" stroke="currentColor" strokeWidth="1.5"
                  transform={`rotate(${mix(-9,0,active)} 52 61)`}/>
                {[0,1,2].map(j=><path key={j} d={`M32 ${40+j*15}h${42-j*7}`} stroke={i===1?'#c5d3bd':p.accent}
                  strokeWidth="3" strokeDasharray="50" strokeDashoffset={50*(1-active)}/>)
                }
              </svg>
              <div style={{fontFamily:serif,fontSize:43,lineHeight:1.08,marginTop:13}}>{card.title}</div>
              <div style={{fontSize:17,lineHeight:1.5,opacity:.68,marginTop:18,maxWidth:245}}>{card.body}</div>
              <div style={{marginTop:34,fontSize:14,color:i===1?'#d3e1ce':p.accent}}>{card.kind} <span style={{marginLeft:12}}>↗</span></div>
            </div>;
          })}
        </div>
      </CameraLayer>}
      {t>=10.3&&t<14.1&&<div style={center}>{p.outcome.map((line,i)=><WordReveal key={i} text={line}
        fontFamily={serif} fontSize={106} start={10.35+i*.3} exit={13.45} time={t} color={ink}/>)}</div>}
      {t>=14.1&&<div style={center}>
        <div style={{opacity:arrive(t,14.15,.55)*(1-travel(t,17.35,.5)),transform:`translateY(${12*(1-arrive(t,14.15,.55))}px)`}}>
          <svg width="48" height="48" viewBox="0 0 48 48" style={{display:'block',margin:'0 auto 24px'}}>
            <circle cx="24" cy="24" r="19" fill="none" stroke={p.accent} strokeWidth="2"/>
            <path d="M24 9v30M9 24h30M13.4 13.4l21.2 21.2m0-21.2L13.4 34.6" stroke={p.accent} strokeWidth="2"/>
          </svg>
          <CharacterReveal text={p.name} fontFamily={sans} fontSize={54} fontWeight={500} start={14.25} exit={17.35} time={t}/>
        </div>
        <div style={{marginTop:22}}><CharacterReveal text={p.website} fontFamily={sans} fontSize={23} start={14.7} exit={17.35} time={t} color="#6e786d"/></div>
      </div>}
    </div>
  </LogicalStage>;
}
