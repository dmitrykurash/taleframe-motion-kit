import React from 'react';
import {CharacterReveal, Cursor, LogicalStage, ParallaxBackground, VerificationBadge,
  WordReveal, useTime, useTyping} from '../kit';

export const CATALOGUE_DURATION = 12;
const panel: React.CSSProperties = {position: 'absolute', width: 852, height: 348, border: '1px solid #deded7',
  background: '#fff', borderRadius: 20, overflow: 'hidden'};
const center: React.CSSProperties = {position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center'};
const caption = (text: string) => <div style={{position: 'absolute', left: 28, bottom: 22, fontSize: 17, color: '#888a84', fontFamily: '"DM Sans Variable", sans-serif'}}>{text}</div>;

/** A compact, seekable visual menu. Labels describe recipes; they are not title-card requirements. */
export function MotionCatalogue() {
  const t = useTime(), cycle = t < 6 ? t : t - 6;
  const typed = useTyping({text: 'Turn an idea into a useful next step.', start: .4, end: 4.5,
    time: cycle, fontFamily: '"DM Sans Variable", sans-serif', fontSize: 34});
  const camera = {x: -Math.max(0, typed.width - 320) * .65, y: 0, scale: 1.08};
  return <LogicalStage background="#f4f3ef">
    <div style={{position: 'absolute', left: 80, top: 62, fontFamily: '"Instrument Serif", serif', color: '#252525', fontSize: 58}}>Framecraft Motion Kit</div>
    <div style={{position: 'absolute', left: 82, top: 144, fontFamily: '"DM Sans Variable", sans-serif', fontSize: 21, color: '#777970'}}>
      Four reusable recipes. One frame-based motion system.
    </div>
    <div style={{...panel, left: 80, top: 230}}>
      <div style={center}><CharacterReveal text="Almost all at once." time={cycle} start={.3} exit={5.0}
        fontFamily={'"Instrument Serif", serif'} fontSize={60}/></div>
      {caption('Character reveal · 8 ms staggering')}
    </div>
    <div style={{...panel, left: 988, top: 230}}>
      <div style={center}><WordReveal text="Every word finds its place." time={cycle} start={.3} exit={5}
        fontFamily={'"Instrument Serif", serif'} fontSize={51} stagger={.32}/></div>
      {caption('Word reveal · centered as the line grows')}
    </div>
    <div style={{...panel, left: 80, top: 634}}>
      {/* Local demo uses a full logical camera, so transform origins are explicit. */}
      <ParallaxBackground camera={camera} color="#f5f2ec" depth={.14} overscan={1.35}>
        <svg viewBox="0 0 852 348" style={{width: '100%', height: '100%'}}><path d="M-100 380 300-100M500 450 900-50"
          stroke="#e8ded1" strokeWidth="90"/></svg>
      </ParallaxBackground>
      <div style={{position: 'absolute', left: 105 + camera.x, top: 100, width: 900, height: 111,
        borderRadius: 17, background: '#fff', border: '1px solid #deded7', padding: '35px 25px', boxSizing: 'border-box',
        fontFamily: '"DM Sans Variable", sans-serif', fontSize: 34, whiteSpace: 'pre', color: '#252525'}}>
        {typed.text}<span style={{borderLeft: '2px solid currentColor', marginLeft: 4}}/>
      </div>
      {caption('Natural typing · camera and background share motion')}
    </div>
    <div style={{...panel, left: 988, top: 634}}>
      <div style={center}><VerificationBadge label="Ready to review" start={.3} exit={4.5} time={cycle}
        size={68} fontSize={29}/></div>
      <Cursor time={cycle} enter={2.2} exit={4.2} clicks={[3.55]} path={[
        {time: 2.2, x: 650, y: 260}, {time: 3.2, x: 560, y: 177}, {time: 4.2, x: 560, y: 177},
      ]}/>
      {caption('Expanding badge · cursor movement and press')}
    </div>
  </LogicalStage>;
}
