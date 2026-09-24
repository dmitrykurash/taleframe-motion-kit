import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Camera, CameraLayer, Cursor, LogicalStage, MaskReveal, Shots, TrackIn, WordRoll, arrive, curves, focusCamera, mix, progress,
  travel, useTime, useTyping, type Rect, type Shot} from '../kit';
import {COLUMN, WINDOW, composerFrame, composerTargets, interviewAnswer, researchAnswer, researchSources, stagePoint, studioRows, surveyAnswer} from './workspace/layout';
import {fonts, light as theme} from './workspace/theme';
import {AgentStep, Answer, AppWindow, Composer, FileCard, Permission, Result, Sidebar, Sources, UserMessage, allowButtonRect,
  type ButtonState, type SidebarRow} from './workspace/ui';

/* Style sheet · minimal premium, light (docs/film-language.md)
 * Palette   white type cards and a light-gray desk; the product's own white window; one blue for focus, green for done.
 * Type      Inter for statements (light to bold for contrast), Instrument Serif italic for one accent word, never eyebrows.
 * Motion    the camera pushes toward each action and pulls back for each result; words rise out of masks.
 * Cuts      hard cuts into every UI chapter; slice, a clean zoom, and an expand out of the result chip.
 * Pacing    type cards 1.7–2.4 s, UI chapters 5–10 s with one action each and a readable hold. */

export const EXPLAINER_SECONDS = 52;
const T = {ask: 2.8, filesType: 10, files: 11.8, researchType: 18.6, research: 20.4, organizeType: 27, organize: 28.9,
  agentType: 34.2, agent: 36.6, end: 47.2};
const ink = '#111114';
const typing = (text: string, start: number, end: number) => ({text, start, end, fontFamily: fonts.sans, fontSize: 26});
const blend = (a: Camera, b: Camera, p: number): Camera => ({x: mix(a.x, b.x, p), y: mix(a.y, b.y, p), scale: mix(a.scale, b.scale, p)});
/** Tight on the conversation column: the answer is what the viewer came to read. */
const threadCamera = (centerY: number, scale = 1.42) => focusCamera(stagePoint(COLUMN.left + COLUMN.width / 2 + 40, centerY), scale, {x: 960, y: 540});
const send = (t: number, click: number): ButtonState => (Math.abs(t - click) < .09 ? 'press' : t > click - .35 && t < click ? 'hover' : 'idle');

/** The whole composer, low in frame with a slow push, while a prompt is typed and sent. */
function composerCamera(t: number, from: number, attachment = false) {
  const frame = composerFrame(attachment);
  return focusCamera(stagePoint(frame.x + frame.width / 2, frame.y + frame.height / 2), 1.4 + .08 * curves.glide(progress(t, from, 3)), {x: 960, y: 760});
}

function Window({title, rows, children}: {title: string; rows: SidebarRow[]; children?: React.ReactNode}) {
  return <AppWindow theme={theme} frame={WINDOW} title={title} sidebar={<Sidebar theme={theme} rows={rows}/>}>{children}</AppWindow>;
}
const Thread = ({children}: {children: React.ReactNode}) =>
  <div style={{position: 'absolute', left: COLUMN.left, top: 96, width: COLUMN.width, display: 'flex', flexDirection: 'column', gap: 30}}>{children}</div>;
const rise = (t: number, at: number) => {const e = arrive(t, at, .55); return {opacity: e, transform: `translateY(${18 * (1 - e)}px)`};};

function TypeCard({children, background = '#fff', align = 'flex-start'}: {children: React.ReactNode; background?: string; align?: string}) {
  return <AbsoluteFill style={{background, justifyContent: 'center', alignItems: align, padding: '0 150px'}}>{children}</AbsoluteFill>;
}

function Opening({start}: {start: number}) {
  return <TypeCard><MaskReveal start={start + .1} stagger={.06} duration={.85} fontFamily={fonts.sans} fontWeight={640} fontSize={176}
    letterSpacing={-.045} lineHeight={1.02} color={ink} lines={['Think it through.',
      [{text: 'Then get it '}, {text: 'done.', fontFamily: fonts.serif, fontStyle: 'italic', fontWeight: 400, fontSize: 210, letterSpacing: -.01}]]}/></TypeCard>;
}

function AskShot() {
  const t = useTime(), l = t - T.ask;
  const typed = useTyping(typing('Summarize the customer interviews and pull out three themes.', T.ask + .25, T.ask + 2.3));
  const click = T.ask + 3.05, sent = t >= click;
  const camera = blend(composerCamera(t, T.ask), threadCamera(300), travel(l, 3.15, .9));
  const target = composerTargets().send;
  return <AbsoluteFill style={{background: theme.canvas}}>
    <CameraLayer camera={camera}>
      <Window title="Customer interviews" rows={studioRows(true).map(r => ({...r, active: r.id === 'interviews'}))}>
        {sent && <Thread>
          <UserMessage theme={theme} text={typed.text} style={rise(t, click)}/>
          <Answer theme={theme} blocks={interviewAnswer} p={progress(t, click + .45, 1.9)}/>
        </Thread>}
        <Composer theme={theme} frame={composerFrame()} text={sent ? '' : typed.text} caret={!sent && t > T.ask + .1} send={send(t, click)}/>
      </Window>
      <Cursor time={t} enter={T.ask + 2.3} exit={click + .5} clicks={[click]} size={34} path={[
        {time: T.ask + 2.3, x: target.x - 260, y: target.y + 150}, {time: click - .12, x: target.x - 8, y: target.y - 6},
        {time: click + .6, x: target.x - 8, y: target.y - 6}]}/>
    </CameraLayer>
  </AbsoluteFill>;
}

function FilesType() {
  return <TypeCard><MaskReveal start={T.filesType + .06} stagger={.07} duration={.85} fontFamily={fonts.serif} fontWeight={400}
    fontSize={250} letterSpacing={-.015} color={ink} lines={[[{text: 'Bring your '}, {text: 'files.', fontStyle: 'italic'}]]}/></TypeCard>;
}

function FilesShot() {
  const t = useTime(), l = t - T.files;
  const drop = T.files + 1.45, click = T.files + 3.55, sent = t >= click;
  const typed = useTyping(typing('What changed since last quarter?', T.files + 1.95, T.files + 3.15));
  const attached = t >= drop;
  const frame = composerFrame(attached);
  const targets = composerTargets();
  // The file is carried from the desktop into the composer.
  const carry = curves.glide(progress(l, .2, 1.2));
  const card = {x: mix(-40, targets.send.x - 700, carry), y: mix(1040, stagePoint(0, frame.y + 20).y, carry) - 90 * Math.sin(Math.PI * carry)};
  const wide: Camera = {x: 0, y: 0, scale: 1};
  const camera = blend(blend(wide, composerCamera(t, T.files + 1.5, true), travel(l, 1.55, .75)), threadCamera(330), travel(l, 3.7, .9));
  return <AbsoluteFill style={{background: theme.canvas}}>
    <CameraLayer camera={camera}>
      <Window title="Q3 survey" rows={studioRows(true)}>
        {sent && <Thread>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12, ...rise(t, click)}}>
            <FileCard theme={theme} name="q3-survey.pdf" meta="PDF · 2.4 MB"/>
            <UserMessage theme={theme} text={typed.text} style={{width: '100%'}}/>
          </div>
          <Answer theme={theme} blocks={surveyAnswer} p={progress(t, click + .45, 1.7)}/>
        </Thread>}
        <Composer theme={theme} frame={frame} text={sent ? '' : typed.text} caret={attached && !sent} lift={t > T.files + .95 && !attached ? 1 : 0}
          attachment={attached && !sent ? {name: 'q3-survey.pdf', meta: 'PDF · 2.4 MB', progress: arrive(t, drop, .35)} : undefined}
          send={send(t, click)}/>
      </Window>
      {!attached && l > .1 && <FileCard theme={theme} name="q3-survey.pdf" meta="PDF · 2.4 MB"
        style={{position: 'absolute', left: card.x, top: card.y, transform: `rotate(${-4 * (1 - carry)}deg) scale(${1 - .06 * progress(l, 1.1, .3)})`,
          opacity: arrive(l, .1, .3)}}/>}
      <Cursor time={t} enter={T.files + .15} exit={drop + .25} size={34} clicks={[drop]} path={[
        {time: T.files + .2, x: card.x + 40, y: card.y + 50}, ...Array.from({length: 12}, (_, i) => {
          const at = .2 + (i + 1) / 12 * 1.2, c = curves.glide(progress(at, .2, 1.2));
          return {time: T.files + at, x: mix(-40, targets.send.x - 700, c) + 40, y: mix(1040, stagePoint(0, frame.y + 20).y, c) - 90 * Math.sin(Math.PI * c) + 50};
        })]}/>
      <Cursor time={t} enter={T.files + 3.1} exit={click + .5} size={34} clicks={[click]} path={[
        {time: T.files + 3.1, x: targets.send.x - 240, y: targets.send.y + 120}, {time: click - .12, x: targets.send.x - 8, y: targets.send.y - 6},
        {time: click + .6, x: targets.send.x - 8, y: targets.send.y - 6}]}/>
    </CameraLayer>
  </AbsoluteFill>;
}

function ResearchType() {
  return <TypeCard><MaskReveal start={T.researchType + .06} stagger={.06} duration={.85} fontFamily={fonts.sans} fontSize={190}
    letterSpacing={-.045} lineHeight={1.02} color={ink} lines={[[{text: 'Research,', fontWeight: 250}], [{text: 'with sources.', fontWeight: 720}]]}/></TypeCard>;
}

function ResearchShot() {
  const t = useTime(), l = t - T.research;
  const toggle = T.research + .7, click = T.research + 2.65, sent = t >= click;
  const typed = useTyping(typing('How long should onboarding take?', T.research + 1.0, T.research + 2.25));
  const targets = composerTargets();
  const camera = blend(composerCamera(t, T.research), threadCamera(330), travel(l, 2.75, .9));
  const searching = t >= click + .15 && t < click + .75;
  return <AbsoluteFill style={{background: theme.canvas}}>
    <CameraLayer camera={camera}>
      <Window title="Onboarding research" rows={studioRows(true)}>
        {sent && <Thread>
          <UserMessage theme={theme} text={typed.text} style={rise(t, click)}/>
          {searching && <div style={{fontSize: 22, color: theme.secondary, fontFamily: fonts.sans}}>Searching the web{'.'.repeat(1 + Math.floor((t - click) * 6) % 3)}</div>}
          {t >= click + .7 && <Sources theme={theme} items={researchSources} p={progress(t, click + .7, .8)}/>}
          <Answer theme={theme} blocks={researchAnswer} p={progress(t, click + 1.45, 1.4)}/>
        </Thread>}
        <Composer theme={theme} frame={composerFrame()} text={sent ? '' : typed.text} caret={!sent && t > toggle + .1}
          search={t >= toggle} searchState={send(t, toggle)} send={send(t, click)}/>
      </Window>
      <Cursor time={t} enter={T.research + .05} exit={toggle + .45} size={34} clicks={[toggle]} path={[
        {time: T.research + .05, x: targets.search.x + 180, y: targets.search.y + 110}, {time: toggle - .1, x: targets.search.x - 6, y: targets.search.y - 4},
        {time: toggle + .6, x: targets.search.x - 6, y: targets.search.y - 4}]}/>
      <Cursor time={t} enter={T.research + 2.2} exit={click + .45} size={34} clicks={[click]} path={[
        {time: T.research + 2.2, x: targets.send.x - 200, y: targets.send.y + 110}, {time: click - .1, x: targets.send.x - 8, y: targets.send.y - 6},
        {time: click + .6, x: targets.send.x - 8, y: targets.send.y - 6}]}/>
    </CameraLayer>
  </AbsoluteFill>;
}

function OrganizeType() {
  return <TypeCard><WordRoll prefix="Keep it " words={['organized.', 'searchable.', 'in one place.']}
    at={[T.organizeType + .05, T.organizeType + .62, T.organizeType + 1.12]} duration={.45} fontFamily={fonts.sans} fontWeight={600}
    fontSize={172} letterSpacing={-.045} color={ink} rollColor={theme.accent}/></TypeCard>;
}

function OrganizeShot() {
  const t = useTime(), l = t - T.organize;
  const grab = .55, drop = 1.55, searchClick = 2.45;
  const open = l >= drop;
  const drag = curves.glide(progress(l, grab + .1, .8));
  const opening = curves.punchOut(progress(l, drop, .5));
  const query = 'pricing'.slice(0, Math.max(0, Math.min(7, Math.floor((l - 2.75) / .09) + 1)));
  const filter = query.length > 0 ? curves.punchOut(progress(l, 2.75 + 6 * .09, .4)) : 0;
  const rows: SidebarRow[] = open
    ? studioRows(true).flatMap(r => r.id === 'signup' ? [r, {id: 'onboarding', label: 'Onboarding research', icon: 'chat' as const, depth: 1, active: true}] : [r])
      .map((r, i) => ({...r, open: r.id === 'studio' ? true : r.open,
        // Accordion: the rows below slide down four places and uncover the folder's contents as they pass.
        opacity: (i >= 1 && i <= 4 ? Math.max(0, Math.min(1, 1 + 4 * opening - i)) : 1) * (query && r.id !== 'pricing' && r.id !== 'studio' ? 1 - .72 * filter : 1),
        dy: i > 4 ? -46 * 4 * (1 - opening) : 0,
        highlight: r.id === 'pricing' ? filter : 0}))
    : [{id: 'studio', label: 'Studio', icon: 'folder', open: false, highlight: l > 1.15 ? curves.punchOut(progress(l, 1.15, .2)) : 0},
      {id: 'onboarding', label: 'Onboarding research', icon: 'chat', active: true, opacity: l >= grab ? 0 : 1},
      {id: 'weekly', label: 'Weekly notes', icon: 'chat', dy: -46 * drag},
      {id: 'trip', label: 'Trip ideas', icon: 'chat', dy: -46 * drag},
      {id: 'reading', label: 'Reading list', icon: 'chat', dy: -46 * drag}];
  const rowY = (i: number) => WINDOW.y + 150 + i * 46 + 21;
  const lifted = !open && l >= grab;
  const sidebarCamera = focusCamera({x: WINDOW.x + 250, y: WINDOW.y + 330}, 1.75, {x: 760, y: 500});
  const camera = blend(focusCamera({x: WINDOW.x + 400, y: WINDOW.y + 380}, 1.3, {x: 900, y: 520}), sidebarCamera, travel(l, 0, .9));
  return <AbsoluteFill style={{background: theme.canvas}}>
    <CameraLayer camera={camera}>
      <AppWindow theme={theme} frame={WINDOW} title="Onboarding research" sidebar={<Sidebar theme={theme} rows={rows}
        searchFocus={l >= searchClick} searchText={query}/>}>
        <Thread>
          <UserMessage theme={theme} text="How long should onboarding take?"/>
          <Sources theme={theme} items={researchSources} p={1}/>
          <Answer theme={theme} blocks={researchAnswer} p={1}/>
        </Thread>
        <Composer theme={theme} frame={composerFrame()} search/>
      </AppWindow>
      {lifted && <div style={{position: 'absolute', left: WINDOW.x + 18, width: 276, top: mix(rowY(1), rowY(0), drag) - 21 + 6 * Math.sin(Math.PI * drag),
        height: 42, borderRadius: 11, background: theme.window, boxShadow: '0 14px 30px rgba(20,20,40,.16)', display: 'flex', alignItems: 'center',
        gap: 11, padding: '0 14px', fontFamily: fonts.sans, fontSize: 20, color: theme.text, fontWeight: 550, transform: `rotate(${-1.5 * drag}deg)`}}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.5 11.6a8 8 0 0 1-11.7 7.1L4 20l1.3-4.5A8 8 0 1 1 20.5 11.6Z"/></svg>
        Onboarding research</div>}
      <Cursor time={t} enter={T.organize + .15} clicks={[T.organize + grab, T.organize + searchClick]} size={30} path={[
        {time: T.organize + .15, x: WINDOW.x + 260, y: rowY(1) + 70}, {time: T.organize + grab - .05, x: WINDOW.x + 160, y: rowY(1) + 4},
        {time: T.organize + grab + .1, x: WINDOW.x + 160, y: rowY(1) + 4}, {time: T.organize + grab + .9, x: WINDOW.x + 160, y: rowY(0) + 4},
        {time: T.organize + drop + .3, x: WINDOW.x + 190, y: rowY(0) + 20}, {time: T.organize + searchClick - .08, x: WINDOW.x + 150, y: WINDOW.y + 129},
        {time: T.organize + 5.4, x: WINDOW.x + 150, y: WINDOW.y + 129}]}/>
    </CameraLayer>
  </AbsoluteFill>;
}

function AgentType() {
  return <TypeCard background="#0b0b0d"><MaskReveal start={T.agentType + .06} stagger={.06} duration={.85} fontFamily={fonts.sans} fontWeight={640}
    fontSize={170} letterSpacing={-.045} lineHeight={1.04} color="#f4f4f6" lines={['Let it do the work.',
      [{text: 'You approve every step.', fontFamily: fonts.serif, fontStyle: 'italic', fontWeight: 400, fontSize: 176, letterSpacing: -.01, color: 'rgba(244,244,246,.7)'}]]}/></TypeCard>;
}

const permissionFrame = {x: COLUMN.left, y: 520, width: 640, height: 206};
const agentResultCamera = threadCamera(370);
function AgentShot() {
  const t = useTime(), l = t - T.agent;
  const toggle = T.agent + .5, click = T.agent + 3.05, allow = T.agent + 6.55, sent = t >= click;
  const typed = useTyping(typing('Shorten the signup form to three fields, then run the tests.', T.agent + .8, T.agent + 2.8));
  const targets = composerTargets();
  const allowRect = allowButtonRect(permissionFrame);
  const allowStage = stagePoint(allowRect.x + allowRect.width / 2, allowRect.y + allowRect.height / 2);
  // Tilt down to the card on the same column framing; the sidebar stays out of frame.
  const cardCamera = threadCamera(430);
  const camera = blend(blend(blend(composerCamera(t, T.agent), threadCamera(300), travel(l, 3.15, .9)), cardCamera, travel(l, 5.3, .8)),
    agentResultCamera, travel(l, 6.9, 1));
  const step = (appear: number, done: number) => t < T.agent + appear ? null : t < T.agent + done ? 'running' as const : 'done' as const;
  const read = step(3.5, 4.1), edit = step(4.3, 5.0), run = step(6.8, 8.0);
  return <AbsoluteFill style={{background: theme.canvas}}>
    <CameraLayer camera={camera}>
      <Window title="Signup form" rows={studioRows(true).map(r => ({...r, active: r.id === 'signup'}))}>
        {sent && <div style={{position: 'absolute', left: COLUMN.left, top: 96, width: COLUMN.width}}>
          <UserMessage theme={theme} text={typed.text} style={rise(t, click)}/>
          <div style={{display: 'flex', flexDirection: 'column', gap: 18, marginTop: 34}}>
            {read && <AgentStep theme={theme} kind="read" target="SignupForm.tsx" status={read} style={rise(t, T.agent + 3.5)}/>}
            {edit && <AgentStep theme={theme} kind="edit" target="SignupForm.tsx" status={edit} diff={edit === 'done' ? [3, 7] : undefined} style={rise(t, T.agent + 4.3)}/>}
            {run && <AgentStep theme={theme} kind="run" target="npm test" status={run} style={rise(t, T.agent + 6.8)}/>}
          </div>
        </div>}
        {t >= T.agent + 5.3 && t < T.agent + 6.95 && <Permission theme={theme} command="npm test" decided={t >= allow + .06}
          allow={send(t, allow)} style={{position: 'absolute', left: permissionFrame.x, top: permissionFrame.y, width: permissionFrame.width,
            boxSizing: 'border-box', ...rise(t, T.agent + 5.3), opacity: arrive(t, T.agent + 5.3, .4) * (1 - progress(t, T.agent + 6.7, .25))}}/>}
        {t >= T.agent + 8.2 && <div style={{position: 'absolute', left: COLUMN.left, top: 520, width: COLUMN.width}}>
          <Result theme={theme} text="18 tests passed" style={rise(t, T.agent + 8.2)}/>
          <Answer theme={theme} p={progress(t, T.agent + 8.5, .9)} style={{marginTop: 22}}
            blocks={[{kind: 'text', text: 'The form now asks for email, name, and password.'}]}/>
        </div>}
        <Composer theme={theme} frame={composerFrame()} text={sent ? '' : typed.text} caret={!sent && t > toggle + .1}
          agent={t >= toggle} agentState={send(t, toggle)} send={send(t, click)}/>
      </Window>
      <Cursor time={t} enter={T.agent + .05} exit={toggle + .45} size={34} clicks={[toggle]} path={[
        {time: T.agent + .05, x: targets.agent.x + 170, y: targets.agent.y + 110}, {time: toggle - .1, x: targets.agent.x - 6, y: targets.agent.y - 4},
        {time: toggle + .6, x: targets.agent.x - 6, y: targets.agent.y - 4}]}/>
      <Cursor time={t} enter={T.agent + 2.55} exit={click + .45} size={34} clicks={[click]} path={[
        {time: T.agent + 2.55, x: targets.send.x - 200, y: targets.send.y + 110}, {time: click - .1, x: targets.send.x - 8, y: targets.send.y - 6},
        {time: click + .6, x: targets.send.x - 8, y: targets.send.y - 6}]}/>
      <Cursor time={t} enter={T.agent + 5.6} exit={allow + .4} size={34} clicks={[allow]} path={[
        {time: T.agent + 5.6, x: allowStage.x - 260, y: allowStage.y + 150}, {time: allow - .12, x: allowStage.x - 10, y: allowStage.y - 6},
        {time: allow + .6, x: allowStage.x - 10, y: allowStage.y - 6}]}/>
    </CameraLayer>
  </AbsoluteFill>;
}

/** The result chip's rect on screen at the cut, so the closing card can grow out of it. */
function resultChipAtCut(): Rect {
  const camera = agentResultCamera;
  const chip = {x: stagePoint(COLUMN.left, 0).x, y: stagePoint(0, 520).y, width: 258, height: 55};
  const f = (v: number, c: number, d: number) => c + (v - c) * camera.scale + d;
  return {x: f(chip.x, 960, camera.x), y: f(chip.y, 540, camera.y), width: chip.width * camera.scale, height: chip.height * camera.scale, radius: 18 * camera.scale};
}

function EndCard() {
  return <TypeCard>
    <MaskReveal start={T.end + .25} stagger={.06} duration={.85} fontFamily={fonts.sans} fontWeight={640} fontSize={176}
      letterSpacing={-.045} lineHeight={1.02} color={ink} lines={['Think it through.',
        [{text: 'Then get it '}, {text: 'done.', fontFamily: fonts.serif, fontStyle: 'italic', fontWeight: 400, fontSize: 210, letterSpacing: -.01}]]}/>
    <div style={{marginTop: 64}}><TrackIn text="Available today." start={T.end + 1.5} duration={1.6} trackFrom={.25} fontFamily={fonts.sans}
      fontWeight={500} fontSize={48} letterSpacing={-.01} color={theme.secondary} style={{textAlign: 'left'}}/></div>
  </TypeCard>;
}

export const explainerShots: Shot[] = [
  {name: 'opening', until: T.ask, content: <Opening start={0}/>},
  {name: 'ask', until: T.filesType, content: <AskShot/>},
  {name: 'files-type', until: T.files, content: <FilesType/>},
  {name: 'files', until: T.researchType, content: <FilesShot/>},
  {name: 'research-type', until: T.research, content: <ResearchType/>,
    enter: {kind: 'slice', duration: .6, bands: 4, stagger: .05, orientation: 'horizontal', direction: 'left'}},
  {name: 'research', until: T.organizeType, content: <ResearchShot/>},
  {name: 'organize-type', until: T.organize, content: <OrganizeType/>,
    enter: {kind: 'zoom', duration: .5, focus: {x: 960, y: 460}, push: 2, land: 1.35, chroma: 0, flash: 0, backdrop: theme.canvas}},
  {name: 'organize', until: T.agentType, content: <OrganizeShot/>},
  {name: 'agent-type', until: T.agent, content: <AgentType/>},
  {name: 'agent', until: T.end, content: <AgentShot/>},
  {name: 'end', content: <EndCard/>, enter: {kind: 'expand', source: resultChipAtCut(), color: theme.successSoft, duration: .8, align: 'start',
    dim: .15, defocus: 5, backdrop: theme.canvas}},
];

/** A 52-second UX explainer for an unnamed desktop AI workspace: each chapter shows one action and its result. */
export function ProductExplainer() {
  return <LogicalStage background="#ffffff"><Shots shots={explainerShots}/></LogicalStage>;
}
