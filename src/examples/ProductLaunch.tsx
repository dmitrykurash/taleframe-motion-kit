import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Camera, CameraLayer, Counter, Cursor, LogicalStage, MaskReveal, Shots, TrackIn, WordRoll, WordSequence, arrive, curves, focusCamera,
  mix, progress, travel, useTime, useTyping, type Rect, type Shot} from '../kit';
import {COLUMN, WINDOW, composerFrame, composerTargets, interviewAnswer, researchAnswer, researchSources, stagePoint, studioRows, surveyAnswer} from './workspace/layout';
import {dark as theme, fonts} from './workspace/theme';
import {AgentStep, Answer, AppWindow, Composer, FileCard, Permission, Result, Sidebar, Sources, UserMessage, allowButtonRect,
  type ButtonState} from './workspace/ui';

/* Style sheet · minimal premium, dark (docs/film-language.md)
 * Palette   black; white type; the product in dark mode; one cool glow behind the hero and the end card.
 * Type      Inter, set large and tight, weights 600–800; Instrument Serif italic for one line; tabular figures for the number.
 * Motion    words land on 0.55 s beats; the hero rises into a slow push; UI shots hold still and let the product move.
 * Cuts      hard cuts on beats; an expand out of Send, a clean zoom into Allow, a slice into the number.
 * Pacing    word beats, then 1.7–4.3 s shots, then a 4 s hold on the end card. */

export const LAUNCH_SECONDS = 26;
const T = {hero: 1.9, roll: 6.2, files: 8.8, search: 10.7, agent: 12.4, control: 15.3, result: 17.5, number: 19.6, end: 22};
const white = '#f4f4f6';
const button = (t: number, click: number): ButtonState => (Math.abs(t - click) < .09 ? 'press' : t > click - .35 && t < click ? 'hover' : 'idle');
const blend = (a: Camera, b: Camera, p: number): Camera => ({x: mix(a.x, b.x, p), y: mix(a.y, b.y, p), scale: mix(a.scale, b.scale, p)});
const rise = (t: number, at: number) => {const e = arrive(t, at, .5); return {opacity: e, transform: `translateY(${16 * (1 - e)}px)`};};
/** Centered on the conversation; from 1.5× up the sidebar sits fully outside the frame. */
const column = (y: number, scale: number) => focusCamera(stagePoint(COLUMN.left + COLUMN.width / 2, y), scale, {x: 960, y: 540});
/** The composer close-up that ends the hero, and the frame the expand grows from. */
const heroClose = () => {const f = composerFrame(); return focusCamera(stagePoint(f.x + f.width / 2, f.y + f.height / 2), 1.5, {x: 960, y: 700});};

/** A slow, soft light behind the product and the last line. */
function Glow({t, strength = 1}: {t: number; strength?: number}) {
  const blob = (x: number, y: number, size: number, color: string, phase: number) => <div style={{position: 'absolute',
    left: x + 60 * Math.sin(t * .35 + phase) - size / 2, top: y + 40 * Math.cos(t * .3 + phase) - size / 2, width: size, height: size,
    borderRadius: '50%', background: `radial-gradient(closest-side, ${color}, transparent)`, opacity: strength}}/>;
  return <AbsoluteFill style={{filter: 'blur(40px)'}}>
    {blob(620, 760, 1300, 'rgba(58,92,255,.55)', 0)}
    {blob(1320, 700, 1200, 'rgba(139,92,246,.45)', 2)}
    {blob(960, 1060, 1400, 'rgba(34,211,238,.18)', 4)}
  </AbsoluteFill>;
}

const Window = ({title, children}: {title: string; children?: React.ReactNode}) => <AppWindow theme={theme} frame={WINDOW} title={title}
  sidebar={<Sidebar theme={theme} rows={studioRows(true).map(r => ({...r, active: r.id === 'interviews'}))}/>}>{children}</AppWindow>;
const Thread = ({children, top = 96}: {children: React.ReactNode; top?: number}) =>
  <div style={{position: 'absolute', left: COLUMN.left, top, width: COLUMN.width, display: 'flex', flexDirection: 'column', gap: 30}}>{children}</div>;

function Beats() {
  return <AbsoluteFill style={{background: '#000'}}>
    <WordSequence words={['Ask.', 'Research.', 'Delegate.']} times={[.05, .6, 1.15]} push={.04} fontFamily={fonts.sans} fontWeight={700}
      fontSize={250} letterSpacing={-.05} color={white}/>
  </AbsoluteFill>;
}

function Hero() {
  const t = useTime(), l = t - T.hero;
  const enter = arrive(l, 0, 1.1);
  const click = T.roll - .18;
  const typed = useTyping({text: 'Draft the kickoff email for the team.', start: T.hero + 1.1, end: T.hero + 2.4, fontFamily: fonts.sans, fontSize: 26});
  const wide: Camera = {x: 0, y: 40 * (1 - enter), scale: .9 + .04 * curves.glide(progress(l, 0, 4))};
  const frame = composerFrame();
  const camera = blend(wide, heroClose(), travel(l, 2.5, 1.2));
  const target = composerTargets().send;
  return <AbsoluteFill style={{background: '#000'}}>
    <Glow t={t} strength={enter}/>
    <CameraLayer camera={camera} style={{opacity: enter}}>
      <Window title="Customer interviews">
        <Thread>
          <UserMessage theme={theme} text="Summarize the customer interviews and pull out three themes."/>
          <Answer theme={theme} blocks={interviewAnswer} p={1}/>
        </Thread>
        <Composer theme={theme} frame={frame} text={typed.text} caret={l > .9} send={button(t, click)}/>
      </Window>
      <Cursor time={t} enter={T.hero + 3.1} clicks={[click]} size={34} color="#f4f4f6" outline="#0e0e10" path={[
        {time: T.hero + 3.1, x: target.x - 240, y: target.y + 120}, {time: click - .12, x: target.x - 8, y: target.y - 6},
        {time: click + 1, x: target.x - 8, y: target.y - 6}]}/>
    </CameraLayer>
  </AbsoluteFill>;
}

/** The send button's rect on screen at the cut, for the expand. */
function sendAtCut(): Rect {
  const camera = heroClose();
  const c = composerTargets().send;
  const x = 960 + (c.x - 960) * camera.scale + camera.x, y = 540 + (c.y - 540) * camera.scale + camera.y, size = 48 * camera.scale;
  return {x: x - size / 2, y: y - size / 2, width: size, height: size, radius: size / 2};
}

function Roll() {
  return <AbsoluteFill style={{background: '#000', justifyContent: 'center', padding: '0 170px'}}>
    <WordRoll prefix="It " words={['reads.', 'searches.', 'writes.', 'acts.']} at={[T.roll + .18, T.roll + .8, T.roll + 1.38, T.roll + 1.95]}
      duration={.42} fontFamily={fonts.sans} fontWeight={650} fontSize={230} letterSpacing={-.05} color={white} rollColor={theme.accent}/>
  </AbsoluteFill>;
}

function Files() {
  const t = useTime(), l = t - T.files;
  const camera = column(300, 1.5 + .06 * curves.glide(progress(l, 0, 2)));
  return <AbsoluteFill style={{background: '#000'}}>
    <CameraLayer camera={camera}>
      <Window title="Q3 survey">
        <Thread>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12}}>
            <FileCard theme={theme} name="q3-survey.pdf" meta="PDF · 2.4 MB" style={rise(t, T.files - .1)}/>
            <UserMessage theme={theme} text="What changed since last quarter?" style={{width: '100%'}}/>
          </div>
          <Answer theme={theme} blocks={surveyAnswer} p={progress(t, T.files + .25, 1.3)}/>
        </Thread>
        <Composer theme={theme} frame={composerFrame()}/>
      </Window>
    </CameraLayer>
  </AbsoluteFill>;
}

function Search() {
  const t = useTime(), l = t - T.search;
  const camera = column(290, 1.5 + .05 * curves.glide(progress(l, 0, 1.8)));
  return <AbsoluteFill style={{background: '#000'}}>
    <CameraLayer camera={camera}>
      <Window title="Onboarding research">
        <Thread>
          <UserMessage theme={theme} text="How long should onboarding take?"/>
          <Sources theme={theme} items={researchSources} p={progress(t, T.search + .05, .8)}/>
          <Answer theme={theme} blocks={researchAnswer} p={progress(t, T.search + .7, 1)}/>
        </Thread>
        <Composer theme={theme} frame={composerFrame()} search/>
      </Window>
    </CameraLayer>
  </AbsoluteFill>;
}

const permission = {x: COLUMN.left, y: 420, width: 640, height: 206};
const agentCamera = focusCamera(stagePoint(COLUMN.left + COLUMN.width / 2, 360), 1.5, {x: 960, y: 486});
function Agent() {
  const t = useTime(), l = t - T.agent;
  const allow = T.control - .32;
  const rect = allowButtonRect(permission);
  const target = stagePoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
  return <AbsoluteFill style={{background: '#000'}}>
    <CameraLayer camera={{...agentCamera, scale: agentCamera.scale + .04 * curves.glide(progress(l, 0, 3))}}>
      <Window title="Signup form">
        <Thread>
          <UserMessage theme={theme} text="Shorten the signup form to three fields, then run the tests."/>
          <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
            <AgentStep theme={theme} kind="read" target="SignupForm.tsx" status={l < .5 ? 'running' : 'done'}/>
            {l > .6 && <AgentStep theme={theme} kind="edit" target="SignupForm.tsx" status={l < 1.1 ? 'running' : 'done'} diff={l < 1.1 ? undefined : [3, 7]} style={rise(t, T.agent + .6)}/>}
          </div>
        </Thread>
        {l > 1.2 && <Permission theme={theme} command="npm test" allow={button(t, allow)} decided={t > allow + .06}
          style={{position: 'absolute', left: permission.x, top: permission.y, width: permission.width, boxSizing: 'border-box', ...rise(t, T.agent + 1.2)}}/>}
        <Composer theme={theme} frame={composerFrame()} agent/>
      </Window>
      <Cursor time={t} enter={T.agent + 1.55} clicks={[allow]} size={34} color="#f4f4f6" outline="#0e0e10" path={[
        {time: T.agent + 1.55, x: target.x - 240, y: target.y + 140}, {time: allow - .12, x: target.x - 10, y: target.y - 6},
        {time: allow + 1, x: target.x - 10, y: target.y - 6}]}/>
    </CameraLayer>
  </AbsoluteFill>;
}

/** Where Allow is on screen when the zoom begins. */
function allowAtCut() {
  const rect = allowButtonRect(permission), c = stagePoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
  const scale = agentCamera.scale + .04 * curves.glide(progress(T.control - .25 - T.agent, 0, 3));
  return {x: 960 + (c.x - 960) * scale + agentCamera.x, y: 540 + (c.y - 540) * scale + agentCamera.y};
}

function Control() {
  return <AbsoluteFill style={{background: '#000', justifyContent: 'center', padding: '0 170px'}}>
    <MaskReveal start={T.control - .16} stagger={.07} duration={.85} fontFamily={fonts.sans} fontWeight={700} fontSize={200}
      letterSpacing={-.05} lineHeight={1.02} color={white} lines={['Every step.',
        [{text: 'Your call.', fontFamily: fonts.serif, fontStyle: 'italic', fontWeight: 400, fontSize: 236, letterSpacing: -.01, color: 'rgba(244,244,246,.72)'}]]}/>
  </AbsoluteFill>;
}

function ResultShot() {
  const t = useTime(), l = t - T.result;
  const camera = column(300, 1.5 + .05 * curves.glide(progress(l, 0, 2.1)));
  return <AbsoluteFill style={{background: '#000'}}>
    <CameraLayer camera={camera}>
      <Window title="Signup form">
        <Thread>
          <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
            <AgentStep theme={theme} kind="read" target="SignupForm.tsx" status="done"/>
            <AgentStep theme={theme} kind="edit" target="SignupForm.tsx" status="done" diff={[3, 7]}/>
            <AgentStep theme={theme} kind="run" target="npm test" status={l < .5 ? 'running' : 'done'}/>
          </div>
          {l > .6 && <div style={rise(t, T.result + .6)}><Result theme={theme} text="18 tests passed"/></div>}
          <Answer theme={theme} p={progress(t, T.result + .9, .9)} blocks={[{kind: 'text', text: 'The form now asks for email, name, and password.'}]}/>
        </Thread>
        <Composer theme={theme} frame={composerFrame()} agent/>
      </Window>
    </CameraLayer>
  </AbsoluteFill>;
}

function NumberShot() {
  return <AbsoluteFill style={{background: '#000', justifyContent: 'center', padding: '0 170px'}}>
    <Counter to={42} from={0} suffix="s" start={T.number + .15} duration={1.1} fontFamily={fonts.sans} fontWeight={760} fontSize={400}
      letterSpacing={-.06} color={white}/>
    <div style={{marginTop: -8, marginLeft: 10}}>
      <MaskReveal lines={['from request to result.']} start={T.number + .5} fontFamily={fonts.sans} fontWeight={420} fontSize={70}
        letterSpacing={-.02} color="rgba(244,244,246,.6)"/>
    </div>
  </AbsoluteFill>;
}

function EndCard() {
  const t = useTime();
  return <AbsoluteFill style={{background: '#000', justifyContent: 'center', alignItems: 'center'}}>
    <Glow t={t} strength={.85 * arrive(t, T.end, 1.2)}/>
    <TrackIn text="Available today." start={T.end + .15} duration={1.8} trackFrom={.3} fontFamily={fonts.sans} fontWeight={640}
      fontSize={160} letterSpacing={-.045} color={white}/>
  </AbsoluteFill>;
}

export const launchShots: Shot[] = [
  {name: 'beats', until: T.hero, content: <Beats/>},
  {name: 'hero', until: T.roll, content: <Hero/>},
  {name: 'roll', until: T.files, content: <Roll/>, enter: {kind: 'expand', source: sendAtCut(), duration: .75, align: 'start', dim: .6, defocus: 10}},
  {name: 'files', until: T.search, content: <Files/>},
  {name: 'search', until: T.agent, content: <Search/>},
  {name: 'agent', until: T.control, content: <Agent/>},
  {name: 'control', until: T.result, content: <Control/>, enter: {kind: 'zoom', duration: .5, focus: allowAtCut(), push: 2.3, land: 1.4,
    chroma: .15, flash: .08}},
  {name: 'result', until: T.number, content: <ResultShot/>},
  {name: 'number', until: T.end, content: <NumberShot/>, enter: {kind: 'slice', duration: .6, bands: 5, stagger: .05}},
  {name: 'end', content: <EndCard/>},
];

/** A 26-second launch for an unnamed desktop AI workspace. Dark, quiet, and exact. */
export function ProductLaunch() {
  return <LogicalStage background="#000"><Shots shots={launchShots}/></LogicalStage>;
}
