import React from 'react';
import {CalculateMetadataFunction} from 'remotion';
import {
  Camera, CameraLayer, CharacterReveal, Cursor, FontAsset, FontLoader, LogicalStage, ParallaxBackground,
  VerificationBadge, WordReveal, arrive, focusCamera, mix, travel, useTime, useTyping,
} from '../kit';

export type StarterProps = {
  appName: string; prompt: string; replyTitle: string; replyItems: string[]; heading: string;
  settingsTitle: string; closingTagline: string[]; website: string; accent: string;
  fontFamily: string; headingFontFamily: string; fonts: FontAsset[];
  output: {width: number; height: number; fps: number};
};
export const STARTER_DURATION = 24;
export const defaultStarterProps: StarterProps = {
  appName: 'Relay', prompt: 'Turn these notes into a launch checklist.',
  replyTitle: 'A clear next step.',
  replyItems: ['Review the release notes', 'Check the onboarding flow', 'Prepare the launch announcement'],
  heading: 'From an idea to action.', settingsTitle: 'Choose how your work gets published',
  closingTagline: ['Good ideas.', 'Ready to move.'], website: 'relay.example', accent: '#ed7556',
  fontFamily: '"DM Sans Variable", sans-serif', headingFontFamily: '"Instrument Serif", serif', fonts: [],
  output: {width: 3840, height: 2160, fps: 60},
};

/** Deliberately small schema: a new product gets its own UI adapter and truthful interactions.
 * Props personalize this fictional example; they do not discover or recreate an app automatically. */
export function validateStarterProps(input: unknown): StarterProps {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Starter props must be an object.');
  const p = input as Record<string, unknown>;
  const allowed = new Set(Object.keys(defaultStarterProps));
  for (const key of Object.keys(p)) if (!allowed.has(key)) throw new Error(`Unknown starter prop: ${key}`);
  const string = (key: string, max: number) => {
    const value = p[key];
    if (typeof value !== 'string' || !value.trim() || Array.from(value).length > max) {
      throw new Error(`${key} must be nonempty text, at most ${max} characters.`);
    }
    return value;
  };
  const list = (key: string, min: number, max: number, itemLength: number) => {
    const value = p[key];
    if (!Array.isArray(value) || value.length < min || value.length > max ||
      value.some(item => typeof item !== 'string' || !item.trim() || Array.from(item).length > itemLength)) {
      throw new Error(`${key} needs ${min}–${max} nonempty lines, up to ${itemLength} characters each.`);
    }
    return value as string[];
  };
  const output = p.output as StarterProps['output'];
  if (!output || ![output.width, output.height, output.fps].every(Number.isInteger) ||
    output.width < 640 || output.width > 7680 || output.height < 360 || output.height > 4320 ||
    output.width % 2 !== 0 || output.height % 2 !== 0 || output.width * 9 !== output.height * 16 ||
    ![24, 25, 30, 50, 60].includes(output.fps)) {
    throw new Error('output requires even 16:9 dimensions (640×360–7680×4320) and fps 24, 25, 30, 50, or 60.');
  }
  const accent = string('accent', 7);
  if (!/^#[0-9a-f]{6}$/i.test(accent)) throw new Error('accent must be a six-digit hex color.');
  if (!Array.isArray(p.fonts) || p.fonts.some(font => !font || typeof font !== 'object' ||
    typeof font.family !== 'string' || !font.family.trim() || typeof font.src !== 'string' || !font.src.trim() ||
    (font.weight !== undefined && (!Number.isInteger(font.weight) || font.weight < 100 || font.weight > 900)) ||
    (font.style !== undefined && !['normal', 'italic'].includes(font.style)))) {
    throw new Error('fonts must contain {family, src, weight?, style?} records.');
  }
  return {appName: string('appName', 24), prompt: string('prompt', 100), replyTitle: string('replyTitle', 38),
    replyItems: list('replyItems', 2, 4, 62), heading: string('heading', 45), settingsTitle: string('settingsTitle', 45),
    closingTagline: list('closingTagline', 1, 2, 34), website: string('website', 38), accent,
    fontFamily: string('fontFamily', 160), headingFontFamily: string('headingFontFamily', 160),
    fonts: p.fonts as FontAsset[], output};
}
export const calculateStarterMetadata: CalculateMetadataFunction<StarterProps> = ({props}) => {
  const valid = validateStarterProps(props);
  return {width: valid.output.width, height: valid.output.height, fps: valid.output.fps,
    durationInFrames: STARTER_DURATION * valid.output.fps, props: valid};
};

const ink = '#252525', muted = '#8b8c88', line = '#e2e2dc';
const centered: React.CSSProperties = {position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'};
const interpolateCamera = (from: Camera, to: Camera, p: number): Camera => ({
  x: mix(from.x, to.x, p), y: mix(from.y, to.y, p), scale: mix(from.scale, to.scale, p),
});

/** Flat illustration only: this starter's UI and controls do not represent a shipped product. */
function StarterContent(props: StarterProps) {
  const t = useTime();
  const typing = useTyping({text: props.prompt, start: .3, end: 3.95, time: t,
    fontFamily: props.fontFamily, fontSize: 36});
  const reading = Math.max(0, typing.width - 400) * .65;
  const initial = focusCamera({x: 725, y: 520}, 1.55);
  const composerCamera = interpolateCamera({...initial, x: initial.x - reading}, {x: 0, y: 0, scale: 1.08}, travel(t, 4.03, .70));
  const settingsCamera = interpolateCamera(
    interpolateCamera(focusCamera({x: 940, y: 370}, 1.45), focusCamera({x: 1080, y: 560}, 1.75), travel(t, 16.9, .65)),
    focusCamera({x: 1180, y: 750}, 1.70), travel(t, 18.52, .65));
  const camera = t < 6.1 ? composerCamera : t >= 15.7 && t < 20.2 ? settingsCamera : {x: 0, y: 0, scale: 1};
  const sceneBackground = t < 6.1 ? '#f4f3ef' : t < 10 ? '#fff' : t < 15.7 ? '#eeeee8' : t < 20.2 ? '#f7f3ee' : '#fff';
  return <LogicalStage background={sceneBackground}>
    <ParallaxBackground camera={camera} color={sceneBackground} overscan={1.27}>
      {/* Large, quiet shapes make parallax inspectable. Swap for a plate, or omit for plain white. */}
      {t < 6.1 && <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{opacity: .045}}>
        <circle cx="120" cy="1100" r="510" fill="none" stroke={props.accent} strokeWidth="170"/>
        <circle cx="1750" cy="-160" r="600" fill="none" stroke={props.accent} strokeWidth="150"/>
      </svg>}
    </ParallaxBackground>

    {t < 6.1 && <CameraLayer camera={composerCamera} style={{opacity: 1 - travel(t, 5.55, .55)}}>
      <div style={{position: 'absolute', left: 330, top: 420, width: 1260, height: 224,
        background: '#fff', border: `1.5px solid ${line}`, borderRadius: 26, color: ink,
        transform: `translateY(${-90 * travel(t, 5.55, .55)}px)`, overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 44, right: 44, top: 44, height: 60, overflow: 'hidden',
          fontSize: 36, whiteSpace: 'pre', lineHeight: 1.4}}>
          <div style={{transform: `translateX(${-Math.max(0, typing.width - 1110)}px)`}}>
            {typing.text}<span style={{display: 'inline-block', width: 2, height: 35, background: ink, marginLeft: 4,
              verticalAlign: '-.12em', opacity: t < 4.15 || Math.floor(t * 2) % 2 === 0 ? 1 : 0}}/>
          </div>
        </div>
        <div style={{position: 'absolute', left: 44, bottom: 34, display: 'flex', gap: 18, alignItems: 'center', color: muted, fontSize: 22}}>
          <span style={{fontSize: 30, lineHeight: 1}}>＋</span><span>{props.appName}</span>
        </div>
        <div style={{position: 'absolute', right: 30, bottom: 24, width: 70, height: 70, borderRadius: 20,
          background: t >= 4.80 ? '#343430' : ink, display: 'grid', placeItems: 'center',
          transform: `scale(${1 - .08 * Math.max(0, 1 - Math.abs(t - 5.08) / .13)})`}}>
          <svg width="29" height="29" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.9">
            <path d="M12 20V4m-7 7 7-7 7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      <Cursor time={t} enter={4.25} exit={5.4} clicks={[5.08]} path={[
        {time: 4.25, x: 1330, y: 730}, {time: 4.82, x: 1523, y: 610}, {time: 5.4, x: 1523, y: 610},
      ]}/>
    </CameraLayer>}

    {t >= 6.1 && t < 10 && <div style={centered}>
      {t < 8.50 && <WordReveal text={props.heading} start={6.15} exit={7.90} time={t}
        fontFamily={props.headingFontFamily} fontSize={91} color={ink}/>}
      {t >= 8.5 && <VerificationBadge label="Ready to review" start={8.50} exit={9.45} time={t}
        fontFamily={props.fontFamily} fontSize={27} size={64} color={ink} background="#f0f0eb"
        icon={<svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m5 12 4 4L19 6"/></svg>}/>}
    </div>}

    {t >= 10 && t < 15.7 && <CameraLayer camera={{x: 0, y: -26 * travel(t, 10.2, 3), scale: 1 + .08 * travel(t, 10.2, 3)}}>
      <div style={{position: 'absolute', left: 385, top: 235, width: 1150, height: 620, borderRadius: 24,
        background: '#fff', border: `1.5px solid ${line}`, opacity: arrive(t, 10.05, .6) * (1 - travel(t, 15.1, .5)),
        transform: `translateY(${70 * (1 - arrive(t, 10.05, .7)) - 70 * travel(t, 15.1, .5)}px)`, overflow: 'hidden'}}>
        <div style={{height: 68, borderBottom: `1px solid ${line}`, display: 'flex', alignItems: 'center', padding: '0 27px', gap: 9}}>
          {['#f2776b', '#ecc463', '#88c68f'].map(color => <i key={color} style={{width: 11, height: 11, background: color, borderRadius: '50%'}}/>)}
          <span style={{marginLeft: 23, fontSize: 19, color: muted}}>{props.appName}</span>
        </div>
        <div style={{padding: props.replyItems.length === 4 ? '43px 63px' : '51px 63px'}}>
          <div style={{fontFamily: props.headingFontFamily, fontSize: 53, marginBottom: props.replyItems.length === 4 ? 24 : 38}}>{props.replyTitle}</div>
          {props.replyItems.map((item, i) => {
            const enter = arrive(t, 10.80 + i * .24, .6);
            return <div key={i} style={{display: 'flex', alignItems: 'center', gap: 20, minHeight: props.replyItems.length === 4 ? 65 : 76,
              borderTop: i > 0 ? `1px solid ${line}` : undefined, opacity: enter, transform: `translateY(${14 * (1 - enter)}px)`, fontSize: 25}}>
              <span style={{width: 23, height: 23, border: `1.5px solid ${line}`, borderRadius: 6, flexShrink: 0}}/>{item}
            </div>;
          })}
        </div>
      </div>
    </CameraLayer>}

    {t >= 15.7 && t < 20.2 && <CameraLayer camera={settingsCamera} style={{opacity: arrive(t, 15.7, .4) * (1 - travel(t, 19.7, .4))}}>
      <div style={{position: 'absolute', left: 610, top: 270, width: 700, height: 540, borderRadius: 22,
        border: `1.5px solid ${line}`, background: '#fff', overflow: 'hidden',
        transform: `translateY(${35 * (1 - arrive(t, 15.7, .5)) - 40 * travel(t, 19.7, .4)}px)`}}>
        <div style={{padding: '32px 34px 25px', borderBottom: `1px solid ${line}`}}>
          <div style={{fontSize: 24, fontWeight: 600}}>Publishing</div>
          <div style={{fontSize: 17, color: muted, marginTop: 12}}>{props.settingsTitle}</div>
        </div>
        <div style={{padding: '24px 34px'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 19, marginBottom: 29}}>
            Enable publishing
            <div style={{width: 45, height: 26, borderRadius: 13, background: t >= 16.8 ? props.accent : '#dadbd5', padding: 3, boxSizing: 'border-box'}}>
              <div style={{width: 20, height: 20, borderRadius: '50%', background: '#fff', transform: `translateX(${19 * arrive(t, 16.8, .2)}px)`}}/>
            </div>
          </div>
          <div style={{fontSize: 15, color: muted, marginBottom: 16}}>Review policy</div>
          {[['Publish immediately', 'Share changes as soon as they are ready.'], ['Review before publishing', 'Check the draft before anyone sees it.']].map(([title, body], i) => {
            const selected = (t >= 18.15 ? 1 : 0) === i;
            return <div key={title} style={{display: 'flex', gap: 15, padding: '17px 0', borderTop: i ? `1px solid ${line}` : undefined}}>
              <div style={{marginTop: 1, width: 18, height: 18, borderRadius: '50%', border: `1.5px solid ${selected ? props.accent : '#c6c8c0'}`,
                display: 'grid', placeItems: 'center', flexShrink: 0}}>{selected && <div style={{width: 9, height: 9, borderRadius: '50%', background: props.accent}}/>}</div>
              <div><div style={{fontSize: 18}}>{title}</div><div style={{fontSize: 14, color: muted, marginTop: 7}}>{body}</div></div>
            </div>;
          })}
        </div>
        <div style={{position: 'absolute', bottom: 25, right: 30, width: 148, height: 44, borderRadius: 10,
          color: '#fff', background: t >= 19.18 ? '#353532' : ink, display: 'grid', placeItems: 'center', fontSize: 16,
          transform: `scale(${1 - .035 * Math.max(0, 1 - Math.abs(t - 19.4) / .12)})`}}>Save changes</div>
      </div>
      <Cursor time={t} enter={16.1} exit={19.68} size={22} clicks={[16.8, 18.15, 19.4]} path={[
        {time: 16.1, x: 1140, y: 430}, {time: 16.64, x: 1250, y: 425},
        {time: 16.94, x: 1250, y: 425}, {time: 17.93, x: 654, y: 604},
        {time: 18.45, x: 654, y: 604}, {time: 19.17, x: 1210, y: 766}, {time: 19.6, x: 1210, y: 766},
      ]}/>
    </CameraLayer>}

    {t >= 20.2 && t < 22.4 && <div style={{...centered, flexDirection: 'column'}}>
      {props.closingTagline.map((text, i) => <CharacterReveal key={i} text={text} start={20.28 + i * .10} exit={21.93}
        time={t} fontFamily={props.headingFontFamily} fontSize={75} color={ink}/>)}</div>}
    {t >= 22.4 && <div style={centered}><CharacterReveal text={props.website} start={22.43} exit={23.50} time={t}
      fontFamily={props.fontFamily} fontSize={54} fontWeight={700} color={ink}/></div>}
  </LogicalStage>;
}

export function StarterFilm(input: StarterProps) {
  const props = validateStarterProps(input);
  return <FontLoader fonts={props.fonts}><div style={{fontFamily: props.fontFamily, color: ink}}><StarterContent {...props}/></div></FontLoader>;
}
