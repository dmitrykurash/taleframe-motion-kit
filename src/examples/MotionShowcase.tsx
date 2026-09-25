import React from 'react';
import {AbsoluteFill} from 'remotion';
import {Breathe, CameraLayer, CircleText, Cursor, Enter, Handheld, KineticText, LogicalStage, Mark, Marquee, MotionBlur, ParticleText, Plane, Shine,
  Shots, Space, SpeedRamp, SplitText, TextSwap, WordSequence, arc, arrive, camera3DAt, curves, focusCamera, gridDelay, mix, moveCamera,
  progress, rampTime, useTime, useTyping, type Camera, type PresetName, type RampKey, type Shot} from '../kit';
import {COLUMN, WINDOW, composerFrame, interviewAnswer, researchAnswer, researchSources, stagePoint, studioRows} from './workspace/layout';
import {fonts, light as theme} from './workspace/theme';
import {AgentStep, Answer, AppWindow, Composer, FileCard, Permission, Result, Sidebar, Sources, UserMessage, allowButtonRect,
  type ButtonState, type SidebarRow} from './workspace/ui';

/* Style sheet · minimal catalog (docs/film-language.md)
 * Palette   white and black cards, the product in light mode, one blue, two soft gradient fields; a small label names each technique.
 * Type      Inter Medium for statements, Instrument Serif italic for accents, Geist Mono for labels and code; nothing outlined.
 * Motion    every shot shows one technique; UI shots hold still enough to read the move.
 * Cuts      chapter one is made of the eight new scene transitions; chapters two and three cut on the beat. */

export const SHOWCASE_SECONDS = 66;
const T = {s1: 3.4, s2: 5.3, s3: 7.1, s4: 9, s5: 10.8, s6: 12.6, s7: 14.4, s8: 16.2, space: 18, pop: 21.6, camera: 24, ramp: 26.4, hit: 29,
  wallA: 31, wallB: 35.4, order: 39.8, swap: 42.4, mark: 45.2, echo: 48.6, marquee: 50.6, breathe: 53, split: 55.2, circle: 57.2,
  shine: 59.4, end: 61.6};
const ink = '#0b0b0d', white = '#ffffff';
const cool = 'radial-gradient(circle at 18% 28%, #2f5bff 0%, rgba(47,91,255,0) 55%), radial-gradient(circle at 82% 78%, #8a4dff 0%, rgba(138,77,255,0) 58%), radial-gradient(circle at 70% 12%, #19c3ff 0%, rgba(25,195,255,0) 45%), #dfe5ff';
const warm = 'radial-gradient(circle at 78% 30%, #ff6726 0%, rgba(255,103,38,0) 55%), radial-gradient(circle at 22% 76%, #ff3a7c 0%, rgba(255,58,124,0) 58%), radial-gradient(circle at 40% 10%, #ffbf2e 0%, rgba(255,191,46,0) 45%), #ffe9ec';
const press = (t: number, click: number): ButtonState => (Math.abs(t - click) < .09 ? 'press' : t > click - .35 && t < click ? 'hover' : 'idle');
/** From 1.42× the sidebar sits outside the frame, so thread framings stay clean. */
const threadCamera = (centerY: number, scale = 1.42) => focusCamera(stagePoint(COLUMN.left + COLUMN.width / 2 + 40, centerY), scale, {x: 960, y: 540});
/** Aimed a little right of the composer's center so the sidebar stays fully outside the frame. */
const composerCamera = (scale = 1.42, screenY = 700) => {
  const f = composerFrame();
  return focusCamera(stagePoint(f.x + f.width / 2 + 46, f.y + f.height / 2), scale, {x: 960, y: screenY});
};

function Window({title, rows = studioRows(true), children}: {title: string; rows?: SidebarRow[]; children?: React.ReactNode}) {
  return <AppWindow theme={theme} frame={WINDOW} title={title} sidebar={<Sidebar theme={theme} rows={rows}/>}>{children}</AppWindow>;
}
const Thread = ({children, top = 96}: {children: React.ReactNode; top?: number}) =>
  <div style={{position: 'absolute', left: COLUMN.left, top, width: COLUMN.width, display: 'flex', flexDirection: 'column', gap: 30}}>{children}</div>;
const Card = ({background, children, align = 'center'}: {background: string; children: React.ReactNode; align?: 'center' | 'flex-start'}) =>
  <AbsoluteFill style={{background, justifyContent: 'center', alignItems: align, padding: '0 150px'}}>{children}</AbsoluteFill>;

function Opening() {
  return <Card background={white} align="flex-start">
    <div style={{display: 'flex', alignItems: 'baseline'}}>
      <KineticText lines={['More ']} enter="rise" start={.05} fontFamily={fonts.sans} fontWeight={500} fontSize={170} letterSpacing={-.045} color={ink}/>
      <TextSwap texts={['transitions.', 'motion.', 'type.']} at={[.45, 1.45, 2.35]} by="character" stagger={.02}
        fontFamily={fonts.sans} fontWeight={500} fontSize={170} letterSpacing={-.045} color={theme.accent}/>
    </div>
  </Card>;
}

function InterviewShot() {
  const t = useTime();
  return <AbsoluteFill style={{background: theme.canvas}}>
    <CameraLayer camera={threadCamera(300, 1.42 + .06 * curves.glide(progress(t, T.s1, 2.4)))}>
      <Window title="Customer interviews" rows={studioRows(true).map(r => ({...r, active: r.id === 'interviews'}))}>
        <Thread>
          <UserMessage theme={theme} text="Summarize the customer interviews and pull out three themes."/>
          <Answer theme={theme} blocks={interviewAnswer} p={progress(t, T.s1 + .1, 1.3)}/>
        </Thread>
        <Composer theme={theme} frame={composerFrame()}/>
      </Window>
    </CameraLayer>
  </AbsoluteFill>;
}

function WordCard({text, background, color, start, enter, by = 'character', font = fonts.sans, weight = 500, size = 300, italic = false}: {text: string;
  background: string; color: string; start: number; enter: PresetName; by?: 'word' | 'character'; font?: string; weight?: number; size?: number; italic?: boolean}) {
  return <Card background={background}>
    <KineticText lines={[[{text, fontStyle: italic ? 'italic' : 'normal'}]]} by={by} enter={enter} start={start} stagger={.04} fontFamily={font}
      fontWeight={weight} fontSize={size} letterSpacing={italic ? -.02 : -.05} color={color}/>
  </Card>;
}

function ResearchShot() {
  const t = useTime();
  return <AbsoluteFill style={{background: theme.canvas}}>
    <CameraLayer camera={threadCamera(330, 1.42 + .05 * curves.glide(progress(t, T.s3, 2.2)))}>
      <Window title="Onboarding research">
        <Thread>
          <UserMessage theme={theme} text="How long should onboarding take?"/>
          <Sources theme={theme} items={researchSources} p={1}/>
          <Answer theme={theme} blocks={researchAnswer} p={progress(t, T.s3 + .5, 1.2)}/>
        </Thread>
        <Composer theme={theme} frame={composerFrame()} search/>
      </Window>
    </CameraLayer>
  </AbsoluteFill>;
}

const permissionFrame = {x: COLUMN.left, y: 470, width: 640, height: 206};
function AgentShot() {
  const t = useTime(), allow = T.s6 + 1.05;
  const rect = allowButtonRect(permissionFrame), target = stagePoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
  return <AbsoluteFill style={{background: theme.canvas}}>
    <CameraLayer camera={threadCamera(410, 1.44)}>
      <Window title="Signup form" rows={studioRows(true).map(r => ({...r, active: r.id === 'signup'}))}>
        <Thread>
          <UserMessage theme={theme} text="Shorten the signup form to three fields, then run the tests."/>
          <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
            <AgentStep theme={theme} kind="read" target="SignupForm.tsx" status="done"/>
            <AgentStep theme={theme} kind="edit" target="SignupForm.tsx" status="done" diff={[3, 7]}/>
          </div>
        </Thread>
        <Permission theme={theme} command="npm test" allow={press(t, allow)} decided={t > allow + .06}
          style={{position: 'absolute', left: permissionFrame.x, top: permissionFrame.y, width: permissionFrame.width, boxSizing: 'border-box'}}/>
        <Composer theme={theme} frame={composerFrame()} agent/>
      </Window>
      <Cursor time={t} enter={T.s6 + .25} clicks={[allow]} size={34} path={[{time: T.s6 + .25, x: target.x - 220, y: target.y + 130},
        {time: allow - .12, x: target.x - 8, y: target.y - 6}, {time: allow + 1, x: target.x - 8, y: target.y - 6}]}/>
    </CameraLayer>
  </AbsoluteFill>;
}

function ComposerShot() {
  const t = useTime();
  const typed = useTyping({text: 'Turn these notes into a launch plan.', start: T.s8 + .35, end: T.s8 + 1.4, fontFamily: fonts.sans, fontSize: 26});
  return <AbsoluteFill style={{background: theme.canvas}}>
    <CameraLayer camera={composerCamera(1.42 + .05 * curves.glide(progress(t, T.s8, 1.8)))}>
      <Window title="Launch plan">
        <Composer theme={theme} frame={composerFrame()} text={typed.text} caret/>
      </Window>
    </CameraLayer>
  </AbsoluteFill>;
}

/** Floating UI in 3D: the window and four cards at different depths, an orbiting camera, and depth of field. */
function SpaceShot() {
  const t = useTime();
  const camera = camera3DAt(t, [{time: T.space - .6, yaw: -26, pitch: 17, distance: 2500, target: {x: 960, y: 540, z: 120}},
    {time: T.pop, yaw: 20, pitch: 8, distance: 2250, target: {x: 960, y: 540, z: 120}}]);
  const float = (i: number) => 14 * Math.sin((t - T.space) * 1.1 + i * 1.7);
  const shadow = '0 40px 90px rgba(20,24,40,.22), 0 4px 14px rgba(20,24,40,.08)';
  return <Space camera={camera} perspective={2000} focus={(camera.distance ?? 2250) + 120} aperture={.012}
    background="linear-gradient(180deg, #f4f5f9 0%, #e5e8ef 100%)">
    <Plane width={1600} height={920}>
      <AppWindow theme={theme} frame={{x: 0, y: 0, width: 1600, height: 920}} title="Customer interviews"
        sidebar={<Sidebar theme={theme} rows={studioRows(true).map(r => ({...r, active: r.id === 'interviews'}))}/>}>
        <Thread><UserMessage theme={theme} text="Summarize the customer interviews and pull out three themes."/>
          <Answer theme={theme} blocks={interviewAnswer} p={1}/></Thread>
        <Composer theme={theme} frame={composerFrame()}/>
      </AppWindow>
    </Plane>
    <Plane x={470} y={330 + float(0)} z={280} width={620} height={250} style={{borderRadius: 26, background: theme.window, boxShadow: shadow, padding: 24, boxSizing: 'border-box'}}>
      <Sources theme={theme} items={researchSources} p={1}/>
    </Plane>
    <Plane x={1480} y={250 + float(1)} z={440} width={330} height={70}><Result theme={theme} text="18 tests passed" style={{boxShadow: shadow}}/></Plane>
    <Plane x={1430} y={820 + float(2)} z={340} width={380} height={90}><FileCard theme={theme} name="q3-survey.pdf" meta="PDF · 2.4 MB"/></Plane>
    <Plane x={640} y={860 + float(3)} z={200} width={640} height={206}>
      <Permission theme={theme} command="npm test" style={{boxShadow: shadow, width: 640, boxSizing: 'border-box'}}/>
    </Plane>
  </Space>;
}

const tiles = [['Onboarding benchmarks', 'research.example', '#5b6cff'], ['Time to first value', 'journal.example', '#179a55'],
  ['Why users leave', 'blog.example', '#e8833a'], ['The first session', 'design.example', '#8a5cf6'], ['Pricing pages', 'market.example', '#ff4d6d'],
  ['Retention curves', 'data.example', '#0ea5e9'], ['Setup checklists', 'guide.example', '#f59e0b'], ['Mobile review', 'field.example', '#10b981']] as const;
function PopShot() {
  const t = useTime();
  return <AbsoluteFill style={{background: theme.canvas, display: 'grid', placeItems: 'center'}}>
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 380px)', gap: 28}}>
      {tiles.map(([title, domain, tint], i) => {
        const col = i % 4, row = Math.floor(i / 4);
        return <Enter key={title} preset="pop" start={T.pop - .25 + gridDelay(col, row, 4, 2, 'radial') * .5} exit="drop"
          exitAt={T.camera - .75 + gridDelay(col, row, 4, 2, 'diagonal') * .3} distance={110} index={i} time={t}>
          <div style={{height: 132, borderRadius: 24, background: theme.window, boxShadow: '0 18px 50px rgba(20,24,40,.1), inset 0 0 0 1px rgba(15,15,20,.05)',
            display: 'flex', alignItems: 'center', gap: 18, padding: '0 26px', fontFamily: fonts.sans}}>
            <div style={{width: 52, height: 52, borderRadius: 14, background: tint, color: white, display: 'grid', placeItems: 'center', fontSize: 24, fontWeight: 700}}>{title[0]}</div>
            <div><div style={{fontSize: 23, fontWeight: 600, color: theme.text}}>{title}</div><div style={{fontSize: 18, color: theme.secondary, marginTop: 3}}>{domain}</div></div>
          </div>
        </Enter>;
      })}
    </div>
  </AbsoluteFill>;
}

/** Crash zoom into the answer, then a whip across to the composer, with real motion blur. */
function CameraShot() {
  const wide: Camera = {x: 0, y: 0, scale: 1};
  const answer = focusCamera(stagePoint(COLUMN.left + COLUMN.width / 2, 300), 1.9, {x: 960, y: 520});
  const composer = composerCamera(1.8, 600);
  return <MotionBlur samples={12} shutter={.6}>{time => {
    const camera = time < T.camera + 1.3 ? moveCamera(time, wide, answer, T.camera + .3, .55, 'crash')
      : moveCamera(time, answer, composer, T.camera + 1.3, .45, 'whip');
    return <AbsoluteFill style={{background: theme.canvas}}>
      <CameraLayer camera={camera}>
        <Window title="Customer interviews" rows={studioRows(true).map(r => ({...r, active: r.id === 'interviews'}))}>
          <Thread><UserMessage theme={theme} text="Summarize the customer interviews and pull out three themes."/>
            <Answer theme={theme} blocks={interviewAnswer} p={1}/></Thread>
          <Composer theme={theme} frame={composerFrame()} text="Draft a follow-up for each theme." caret/>
        </Window>
      </CameraLayer>
    </AbsoluteFill>;
  }}</MotionBlur>;
}

/** Files fly into the composer on arcs; a speed ramp drops them into slow motion mid-air, then rushes them in.
 * The ramp only wraps the flying files, so the product behind them keeps real time. */
const RAMP: RampKey[] = [{at: T.ramp + .42, rate: 1}, {at: T.ramp + .6, rate: .08}, {at: T.ramp + 1.55, rate: .08},
  {at: T.ramp + 1.75, rate: 2.4}, {at: T.ramp + 2.05, rate: 1}];
const FILES = [{from: {x: -240, y: 250}, bend: -.3, name: 'interviews.pdf'}, {from: {x: 720, y: -180}, bend: .18, name: 'survey.csv'},
  {from: {x: 2120, y: 320}, bend: .3, name: 'notes.md'}];
const fileStart = (i: number) => T.ramp + .08 + i * .1;
function RampShot() {
  const t = useTime();
  const camera: Camera = {x: 0, y: 0, scale: 1};
  const f = composerFrame(true), dockStage = stagePoint(f.x + 90, f.y + 42);
  const dock = {x: 960 + (dockStage.x - 960) * camera.scale + camera.x, y: 540 + (dockStage.y - 540) * camera.scale + camera.y};
  const landed = FILES.filter((_, i) => rampTime(t, RAMP) >= fileStart(i) + 1).length;
  const flight = (time: number) => FILES.map((file, i) => {
    const p = curves.glide(progress(time, fileStart(i), 1));
    if (p <= 0 || p >= 1) return null;
    const at = arc(p, file.from, dock, file.bend);
    return <div key={file.name} style={{position: 'absolute', left: at.x, top: at.y, opacity: 1 - Math.max(0, (p - .88) / .12),
      transform: `translate(-50%, -50%) scale(${mix(1.25, .5, p).toFixed(4)}) rotate(${mix(-12 + i * 12, 0, p).toFixed(2)}deg)`}}>
      <FileCard theme={theme} name={file.name} meta="Drop to attach"/>
    </div>;
  });
  return <AbsoluteFill style={{background: theme.canvas}}>
    <CameraLayer camera={camera}>
      <Window title="Launch plan">
        <Composer theme={theme} frame={composerFrame(landed > 0)} text="Summarize these." caret
          attachment={landed > 0 ? {name: `${landed} file${landed > 1 ? 's' : ''}`, meta: 'Ready to read'} : undefined}/>
      </Window>
    </CameraLayer>
    <SpeedRamp keys={RAMP}>
      <MotionBlur samples={10} shutter={.5}>{time => <AbsoluteFill>{flight(time)}</AbsoluteFill>}</MotionBlur>
    </SpeedRamp>
  </AbsoluteFill>;
}

function HitShot() {
  const beats = [T.hit + .12, T.hit + .6, T.hit + 1.08];
  return <Handheld amount={4} impacts={beats} hit={30}>
    <AbsoluteFill style={{background: ink}}>
      <WordSequence words={['Every', 'beat', 'hits.']} times={beats} palettes={[[ink, white], [ink, white], [theme.accent, white]]}
        fontFamily={fonts.sans} fontWeight={600} fontSize={320} letterSpacing={-.05}/>
    </AbsoluteFill>
  </Handheld>;
}

const WALL_A: PresetName[] = ['rise', 'drop', 'soft', 'blur', 'flip', 'turn', 'pop', 'stretch', 'slide'];
const WALL_B: PresetName[] = ['scatter', 'wave', 'zoom', 'spin', 'weight', 'skew', 'wipe', 'glitch', 'track'];
function PresetWall({names, start}: {names: PresetName[]; start: number}) {
  return <AbsoluteFill style={{background: white, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)', padding: '60px 90px'}}>
    {names.map((name, i) => <div key={name} style={{display: 'grid', placeItems: 'center'}}>
      <KineticText lines={[name]} by={name === 'track' || name === 'wipe' ? 'word' : 'character'} enter={name} start={start - .02 + i * .32} stagger={.045}
        fontFamily={fonts.sans} fontWeight={name === 'weight' ? 900 : 500} fontSize={128} letterSpacing={-.04} color={ink} seed={i + 3}/>
    </div>)}
  </AbsoluteFill>;
}

function OrderShot() {
  const line = (text: string, order: 'start' | 'center' | 'random', at: number, color = ink) => <KineticText lines={[text]} by="character" enter="pop"
    order={order} stagger={.03} start={at} fontFamily={fonts.sans} fontWeight={500} fontSize={130} letterSpacing={-.04} color={color}/>;
  return <Card background={white} align="flex-start">
    {line('from the start.', 'start', T.order - .02)}
    {line('from the center.', 'center', T.order + .8, theme.accent)}
    {line('at random.', 'random', T.order + 1.5)}
  </Card>;
}

function SwapShot() {
  return <Card background={white} align="flex-start">
    <div style={{display: 'flex', alignItems: 'baseline'}}>
      <KineticText lines={['Make it ']} enter="soft" start={T.swap - .04} fontFamily={fonts.sans} fontWeight={500} fontSize={190} letterSpacing={-.045} color={ink}/>
      <TextSwap texts={['fast.', 'simple.', 'yours.']} at={[T.swap + .25, T.swap + 1.05, T.swap + 1.85]}
        fontFamily={fonts.serif} fontWeight={400} fontSize={220} letterSpacing={-.01} color={theme.accent} style={{fontStyle: 'italic'}}/>
    </div>
  </Card>;
}

function MarkShot() {
  const font = {fontFamily: fonts.sans, fontWeight: 500, fontSize: 138, letterSpacing: -.04, color: ink};
  return <Card background={white} align="flex-start">
    <Enter preset="soft" start={T.mark - .04} distance={140}><Mark {...font} kind="marker" at={T.mark + .45} markColor="#ffd84d"
      lines={[[{text: 'Ship in '}, {text: 'minutes', mark: true}, {text: ','}]]}/></Enter>
    <Enter preset="soft" start={T.mark + .2} distance={140}><Mark {...font} kind="strike" at={T.mark + 1.05} markColor="#ff3b30" markedColor="#a9a9b0"
      lines={[[{text: 'not '}, {text: 'weeks', mark: true}, {text: '.'}]]}/></Enter>
    <Enter preset="soft" start={T.mark + 1.4} distance={140} style={{marginTop: 26}}><Mark {...font} fontFamily={fonts.serif} fontWeight={400}
      kind="circle" at={T.mark + 1.8} duration={.8} markColor={theme.accent} lines={[[{text: 'Your call.', mark: true, fontStyle: 'italic'}]]}/></Enter>
  </Card>;
}

function DustShot() {
  return <AbsoluteFill style={{background: ink}}>
    <ParticleText text="Particles." mode="dissolve" start={T.echo + .55} duration={1.35} count={6500} fontFamily={fonts.sans} fontWeight={500}
      fontSize={250} letterSpacing={-.045} color={white} accent="#7c9cff"/>
  </AbsoluteFill>;
}

function MarqueeShot() {
  return <AbsoluteFill style={{background: white, overflow: 'hidden'}}>
    <Marquee text="Launch films in code" rows={9} speed={340} angle={-8} start={T.marquee - 2} fontFamily={fonts.sans} fontWeight={500}
      fontSize={165} letterSpacing={-.045} color={ink}/>
  </AbsoluteFill>;
}

function BreatheShot() {
  return <Card background={white}>
    <Breathe text="Variable" min={100} max={900} speed={.75} wavelength={5} start={T.breathe + .05} fontFamily={fonts.sans} fontWeight={500}
      fontSize={250} letterSpacing={-.04} color={ink}/>
  </Card>;
}

function SplitShot() {
  return <Card background={ink}>
    <SplitText text="Split." start={T.split - .02} exitAt={T.circle - .5} fontFamily={fonts.sans} fontWeight={500} fontSize={330}
      letterSpacing={-.05} color={white}/>
  </Card>;
}

function CircleShot() {
  const t = useTime();
  return <AbsoluteFill style={{background: theme.accent, display: 'grid', placeItems: 'center'}}>
    <div style={{position: 'absolute', opacity: arrive(t, T.circle - .08, .5), transform: `scale(${mix(.85, 1, arrive(t, T.circle - .08, .7))})`}}>
      <CircleText text={"MOTION · TYPE · TRANSITIONS · ".repeat(2)} radius={260} fontSize={40} speed={32} start={T.circle} fontFamily={fonts.mono}
        fontWeight={500} letterSpacing={.02} color={white}/>
    </div>
    <KineticText lines={[[{text: 'Loop.', fontStyle: 'italic'}]]} enter="pop" by="word" start={T.circle + .2} fontFamily={fonts.serif}
      fontWeight={400} fontSize={170} letterSpacing={-.02} color={white}/>
  </AbsoluteFill>;
}

function ShineShot() {
  return <Card background={ink}>
    <Enter preset="blur" start={T.shine - .04} distance={200}>
      <Shine text="Premium." at={T.shine + .55} duration={1.25} fontFamily={fonts.sans} fontWeight={500} fontSize={240} letterSpacing={-.05}
        color="#5d5d66" shineColor={white} width={.14}/>
    </Enter>
  </Card>;
}

function EndCard() {
  return <AbsoluteFill style={{background: white, justifyContent: 'center', alignItems: 'center', gap: 42}}>
    <KineticText lines={['Taleframe']} by="character" enter="blur" start={T.end - .02} stagger={.04} align="center" fontFamily={fonts.sans}
      fontWeight={500} fontSize={190} letterSpacing={-.05} color={ink}/>
    <KineticText lines={['14 scene transitions · 18 type presets · 8 type effects']} by="word" enter="soft" start={T.end + .8} stagger={.05}
      align="center" fontFamily={fonts.sans} fontWeight={450} fontSize={46} letterSpacing={-.015} color={theme.secondary}/>
  </AbsoluteFill>;
}

export const showcaseShots: Shot[] = [
  {name: 'open', until: T.s1, content: <Opening/>},
  {name: 'interviews', until: T.s2, content: <InterviewShot/>},
  {name: 'fast', until: T.s3, content: <WordCard text="Side by side." background={ink} color={white} start={T.s2 - .3} enter="slide" size={150}/>,
    enter: {kind: 'divide', duration: 1.3}},
  {name: 'research', until: T.s4, content: <ResearchShot/>, enter: {kind: 'stack'}},
  {name: 'grid', until: T.s5, content: <AbsoluteFill style={{background: cool}}><WordCard text="Piece by piece." background="transparent" color={white}
    start={T.s4 + .2} enter="wave" size={200}/></AbsoluteFill>, enter: {kind: 'tiles', pattern: 'diagonal'}},
  {name: 'open-up', until: T.s6, content: <WordCard text="Open up." background={ink} color={white} start={T.s5 + .3} enter="blur" by="word"
    font={fonts.serif} weight={400} size={280} italic/>, enter: {kind: 'split', angle: 90}},
  {name: 'agent', until: T.s7, content: <AgentShot/>, enter: {kind: 'focus'}},
  {name: 'flow', until: T.s8, content: <AbsoluteFill style={{background: warm}}><WordCard text="Flow." background="transparent" color={white}
    start={T.s7 + .15} enter="soft" by="word" font={fonts.serif} weight={400} size={330} italic/></AbsoluteFill>, enter: {kind: 'liquid'}},
  {name: 'composer', until: T.space, content: <ComposerShot/>, enter: {kind: 'tilt', direction: 'up'}},
  {name: 'space', until: T.pop, content: <SpaceShot/>, enter: {kind: 'cards', direction: 'left', backdrop: '#e8eaf0'}},
  {name: 'pop', until: T.camera, content: <PopShot/>},
  {name: 'camera', until: T.ramp, content: <CameraShot/>},
  {name: 'ramp', until: T.hit, content: <RampShot/>},
  {name: 'hit', until: T.wallA, content: <HitShot/>},
  {name: 'wall-a', until: T.wallB, content: <PresetWall names={WALL_A} start={T.wallA}/>},
  {name: 'wall-b', until: T.order, content: <PresetWall names={WALL_B} start={T.wallB}/>},
  {name: 'order', until: T.swap, content: <OrderShot/>},
  {name: 'swap', until: T.mark, content: <SwapShot/>},
  {name: 'mark', until: T.echo, content: <MarkShot/>},
  {name: 'dust', until: T.marquee, content: <DustShot/>},
  {name: 'marquee', until: T.breathe, content: <MarqueeShot/>},
  {name: 'breathe', until: T.split, content: <BreatheShot/>},
  {name: 'split', until: T.circle, content: <SplitShot/>},
  {name: 'circle', until: T.shine, content: <CircleShot/>},
  {name: 'shine', until: T.end, content: <ShineShot/>},
  {name: 'end', content: <EndCard/>},
];

/** What each part of the film shows, from the moment it starts. */
const labels: [number, string | null][] = [[0, null], [4.65, 'Transition · divide'], [7.1, 'Transition · stack'], [8.6, 'Transition · tiles'],
  [10.8, 'Transition · split'], [12.25, 'Transition · focus'], [14, 'Transition · liquid'], [15.8, 'Transition · tilt'], [17.45, 'Transition · cards'],
  [18.75, 'Space · Plane · 3D camera · depth of field'], [T.pop, 'Enter · pop → drop · radial stagger'], [T.camera, 'moveCamera · crash → whip · MotionBlur'],
  [T.ramp, 'arc · SpeedRamp'], [T.hit, 'Handheld · impact'], [T.wallA, 'KineticText · 18 presets'], [T.order, 'KineticText · stagger order'],
  [T.swap, 'TextSwap · roll'], [T.mark, 'Mark · marker · strike · circle'], [T.echo, 'ParticleText · dissolve'], [T.marquee, 'Marquee'], [T.breathe, 'Breathe · variable weight'],
  [T.split, 'SplitText'], [T.circle, 'CircleText'], [T.shine, 'Shine'], [T.end, null]];

function Label() {
  const t = useTime();
  const index = labels.reduce((found, [time], i) => (t >= time ? i : found), 0);
  const [since, text] = labels[index];
  if (!text) return null;
  const e = arrive(t, since, .35);
  return <div style={{position: 'absolute', left: 48, bottom: 44, display: 'flex', alignItems: 'center', gap: 12, padding: '11px 20px 11px 16px',
    borderRadius: 999, background: 'rgba(14,14,18,.8)', color: white, fontFamily: fonts.mono, fontSize: 21, fontWeight: 500, letterSpacing: '-.01em',
    opacity: e, transform: `translateY(${(1 - e) * 14}px)`}}>
    <i style={{width: 9, height: 9, borderRadius: 5, background: '#7c9cff'}}/>{text}
  </div>;
}

/** A catalog film of the motion vocabulary: eight new scene transitions, camera and element motion, and
 * kinetic type presets and effects. Each technique is named by a small label while it plays. */
export function MotionShowcase({labelled = true}: {labelled?: boolean}) {
  return <LogicalStage background={white}>
    <AbsoluteFill><Shots shots={showcaseShots}/></AbsoluteFill>
    {labelled && <Label/>}
  </LogicalStage>;
}
