import React from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {CameraLayer, Counter, Cursor, LogicalStage, MaskReveal, MotionBlur, STAGES, Scramble, Shots, Slam, TaleframeTransition, TrackIn,
  WordRoll, WordSequence, arrive, curves, focusCamera, mix, overshoot, progress, useTime, useTyping, type Camera, type Rect,
  type Shot} from '../kit';
import {interviewAnswer} from './workspace/layout';
import {fonts, light as theme} from './workspace/theme';
import {Answer, AppWindow, Composer, Icon, UserMessage, type ButtonState} from './workspace/ui';

/* Style sheet · minimal, bright, typographic (docs/film-language.md)
 * Palette   white and black cards in turn; the product in light mode; one blue; two gradient plates for the painted transition.
 * Type      a different face per idea: Inter 300–800, Instrument Serif italic, Geist Mono, DM Sans Black for the portal word.
 * Motion    0.4–0.6 s beats; one move per shot; words rise from below or arrive from the right, and leave upward.
 * Cuts      hard cuts in the opening; the middle names each scene transition while it plays; a painted watercolor; hard cuts out.
 * Format    1080 × 1920 portrait stage; type stays inside the middle 1300 px, clear of social captions. */

export const KIT_REEL_SECONDS = 31.5;
const T = {type: 1.55, roll: 3.45, formats: 5.5, ui: 7.7, zoom: 11.4, expand: 12.45, slice: 13.5, glitch: 14.5, plate: 15.8,
  painted: 17.35, number: 19.5, blur: 21.2, agent: 23.2, render: 25.4, end: 27.6};
const FPS = 30;
const stage = STAGES.portrait;
const ink = '#0b0b0d', white = '#ffffff';
const button = (t: number, click: number): ButtonState => (Math.abs(t - click) < .09 ? 'press' : t > click - .35 && t < click ? 'hover' : 'idle');
const blend = (a: Camera, b: Camera, p: number): Camera => ({x: mix(a.x, b.x, p), y: mix(a.y, b.y, p), scale: mix(a.scale, b.scale, p)});
const rise = (t: number, at: number) => {const e = arrive(t, at, .5); return {opacity: e, transform: `translateY(${16 * (1 - e)}px)`};};
const card = (background: string, extra?: React.CSSProperties): React.CSSProperties =>
  ({background, justifyContent: 'center', padding: '0 90px', ...extra});

function Hook() {
  return <AbsoluteFill style={{background: white}}>
    <WordSequence words={['Launch', 'films,']} times={[0, .48]} palettes={[[white, ink], [ink, white]]} fontFamily={fonts.sans}
      fontWeight={760} fontSize={210} letterSpacing={-.055}/>
    <WordSequence words={['in code.']} times={[.96]} beat={.6} palettes={[[white, ink]]} fontFamily={fonts.mono} fontWeight={500}
      fontSize={170} letterSpacing={-.06}/>
  </AbsoluteFill>;
}

function TypeShot() {
  return <AbsoluteFill style={card(white)}>
    <MaskReveal start={T.type - .03} stagger={.09} duration={.8} lineHeight={1.02} fontFamily={fonts.sans} fontWeight={700} fontSize={150}
      letterSpacing={-.05} color={ink} lines={[
        [{text: 'Type', fontFamily: fonts.serif, fontStyle: 'italic', fontWeight: 400, fontSize: 330, letterSpacing: -.02}],
        'that moves.']}/>
  </AbsoluteFill>;
}

function RollShot() {
  return <AbsoluteFill style={card(ink, {gap: 8})}>
    <MaskReveal lines={['Made for']} start={T.roll + .04} fontFamily={fonts.sans} fontWeight={300} fontSize={150} letterSpacing={-.04} color={white}/>
    <WordRoll words={['launches.', 'demos.', 'reels.']} at={[T.roll + .3, T.roll + .9, T.roll + 1.45]} duration={.45} fontFamily={fonts.sans}
      fontWeight={700} fontSize={170} letterSpacing={-.05} color={white} rollColor="#7c9cff"/>
  </AbsoluteFill>;
}

/** The product window lives at 1.35× on the portrait stage, so its type reads on a phone. */
const WINDOW = {x: 180, y: 420, width: 720, height: 1000};
const BASE = 1.35;
const WINDOW_ON_SCREEN = {x: 540 - WINDOW.width * BASE / 2, y: 930 - WINDOW.height * BASE / 2,
  width: WINDOW.width * BASE, height: WINDOW.height * BASE};
const RATIOS = [{width: 900, height: 506}, {width: 720, height: 720}, {width: 560, height: 996}];

/** One card changes aspect ratio, then becomes the product window of the next shot. */
function Formats() {
  const t = useTime(), l = t - T.formats;
  const enter = arrive(l, 0, .55);
  const k = [.6, 1.2, 1.78].map(at => curves.snap(progress(l, at, .42)));
  const between = (a: number, b: number, c: number, d: number) => mix(mix(mix(a, b, k[0]), c, k[1]), d, k[2]);
  const width = between(RATIOS[0].width, RATIOS[1].width, RATIOS[2].width, WINDOW_ON_SCREEN.width);
  const height = between(RATIOS[0].height, RATIOS[1].height, RATIOS[2].height, WINDOW_ON_SCREEN.height);
  const cy = mix(960, WINDOW_ON_SCREEN.y + WINDOW_ON_SCREEN.height / 2, k[2]);
  return <AbsoluteFill style={{background: theme.canvas}}>
    <div style={{position: 'absolute', left: 540 - width / 2, top: cy - height / 2 + 70 * (1 - enter), width, height, borderRadius: mix(40, 28 * BASE, k[2]),
      background: theme.window, boxShadow: theme.shadow, opacity: enter, display: 'grid', placeItems: 'center'}}>
      <WordRoll words={['16:9', '1:1', '9:16']} at={[T.formats + .12, T.formats + .72, T.formats + 1.32]} exit={T.formats + 1.72} duration={.42}
        align="center" fontFamily={fonts.mono} fontWeight={500} fontSize={110} letterSpacing={-.04} color={ink}/>
    </div>
  </AbsoluteFill>;
}

const COMPOSER_EMPTY = 430, COMPOSER_REST = WINDOW.height - 28 - 142;
const composerAt = (y: number) => ({x: 28, y, width: WINDOW.width - 56, height: 142});
const sendAt = (y: number) => ({x: WINDOW.x + 28 + WINDOW.width - 56 - 22 - 24, y: WINDOW.y + y + 142 - 18 - 24});
const baseCamera = focusCamera({x: WINDOW.x + WINDOW.width / 2, y: WINDOW.y + WINDOW.height / 2}, BASE, {x: 540, y: 930}, stage);
const composerCamera = focusCamera({x: WINDOW.x + WINDOW.width / 2, y: WINDOW.y + COMPOSER_EMPTY + 71}, 1.5, {x: 540, y: 1000}, stage);
const threadCamera = focusCamera({x: WINDOW.x + WINDOW.width / 2, y: WINDOW.y + 330}, 1.48, {x: 540, y: 820}, stage);
const PROMPT = 'Pull three themes from the interviews.';

function UiShot() {
  const t = useTime(), l = t - T.ui;
  const click = T.ui + 1.85;
  const typed = useTyping({text: PROMPT, start: T.ui + .45, end: T.ui + 1.4, fontFamily: fonts.sans, fontSize: 26});
  const sent = t >= click + .06;
  const glide = curves.snap(progress(t, click + .1, .55));
  const camera = blend(blend(baseCamera, composerCamera, curves.glide(progress(l, .25, 1.3))), threadCamera, curves.glide(progress(t, click + .2, 1.3)));
  const target = sendAt(COMPOSER_EMPTY);
  return <AbsoluteFill style={{background: theme.canvas}}>
    <CameraLayer camera={camera}>
      <AppWindow theme={theme} frame={WINDOW} title={t > click + .5 ? 'Customer interviews' : 'New chat'}>
        <div style={{position: 'absolute', inset: 0, opacity: arrive(l, 0, .3)}}>
          <div style={{position: 'absolute', left: 0, right: 0, top: COMPOSER_EMPTY - 96, textAlign: 'center', fontSize: 40, fontWeight: 560,
            letterSpacing: '-.02em', opacity: 1 - progress(t, click, .2)}}>What are we working on?</div>
          {sent && <div style={{position: 'absolute', left: 36, top: 90, width: WINDOW.width - 72, display: 'flex', flexDirection: 'column', gap: 28}}>
            <UserMessage theme={theme} text={PROMPT} style={rise(t, click + .1)}/>
            <Answer theme={theme} blocks={interviewAnswer} p={progress(t, click + .45, 1.3)}/>
          </div>}
          <Composer theme={theme} frame={composerAt(mix(COMPOSER_EMPTY, COMPOSER_REST, glide))} text={sent ? '' : typed.text}
            caret={!sent && l > .3} send={button(t, click)}/>
        </div>
      </AppWindow>
      <Cursor time={t} enter={T.ui + 1.05} exit={click + .45} clicks={[click]} size={26} path={[
        {time: T.ui + 1.05, x: target.x + 150, y: target.y + 190}, {time: click - .12, x: target.x - 6, y: target.y - 5},
        {time: click + 1, x: target.x - 6, y: target.y - 5}]}/>
    </CameraLayer>
  </AbsoluteFill>;
}

/** The dot that the next card grows out of. */
const DOT = {x: 540, y: 1270, radius: 30};
const dotRect: Rect = {x: DOT.x - DOT.radius, y: DOT.y - DOT.radius, width: DOT.radius * 2, height: DOT.radius * 2, radius: DOT.radius};

function ZoomCard() {
  const t = useTime();
  const pop = overshoot(1)(progress(t, T.zoom + .45, .4));
  return <AbsoluteFill style={{background: white, display: 'grid', placeItems: 'center'}}>
    <Slam text="Zoom." start={T.zoom - .1} scaleFrom={1.9} fontFamily={fonts.sans} fontWeight={800} fontSize={300} letterSpacing={-.055} color={ink}/>
    <div style={{position: 'absolute', left: dotRect.x, top: dotRect.y, width: dotRect.width, height: dotRect.height, borderRadius: '50%',
      background: theme.accent, transform: `scale(${pop})`}}/>
  </AbsoluteFill>;
}

function ExpandCard() {
  return <AbsoluteFill style={{background: theme.accent, display: 'grid', placeItems: 'center'}}>
    <MaskReveal lines={[[{text: 'Expand.', fontStyle: 'italic'}]]} start={T.expand + .3} fontFamily={fonts.serif} fontWeight={400}
      fontSize={270} letterSpacing={-.02} color={white}/>
  </AbsoluteFill>;
}

function SliceCard() {
  return <AbsoluteFill style={{background: ink, display: 'grid', placeItems: 'center'}}>
    <MaskReveal lines={['Slice.']} by="character" stagger={.035} start={T.slice + .1} fontFamily={fonts.sans} fontWeight={800}
      fontSize={300} letterSpacing={-.055} color={white}/>
  </AbsoluteFill>;
}

/** Decodes in, then leaves upward so the portal opens on a clean card. */
function GlitchCard() {
  const t = useTime();
  const leave = curves.punchIn(progress(t, T.plate - .36, .32));
  return <AbsoluteFill style={{background: white, display: 'grid', placeItems: 'center'}}>
    <div style={{overflow: 'hidden', padding: '.1em 0'}}>
      <div style={{transform: `translateY(${-130 * leave}%)`}}>
        <Scramble text="Glitch." start={T.glitch - .04} duration={.46} fontFamily={fonts.mono} fontWeight={500} fontSize={200}
          letterSpacing={-.05} color={ink}/>
      </div>
    </div>
  </AbsoluteFill>;
}

const COOL = staticFile('demo/gradient-cool.svg'), WARM = staticFile('demo/gradient-warm.svg');
/** A slow push shared by the plate and the painted shot, so the cut between them is invisible. */
const platePush = (t: number) => ({transform: `scale(${1 + .05 * curves.glide(progress(t, T.plate, 4.6))})`});

function Plate() {
  const t = useTime();
  return <AbsoluteFill style={{background: '#dde5ff'}}>
    <Img src={COOL} style={{width: '100%', height: '100%', ...platePush(t)}}/>
  </AbsoluteFill>;
}

function Painted() {
  const t = useTime();
  return <AbsoluteFill style={{background: '#dde5ff'}}>
    <TaleframeTransition kind="watercolor" from={COOL} to={WARM} fromFrame={Math.round((T.painted + .1) * FPS)} durationInFrames={54}
      params={{count: 3, seed: 42}} style={platePush(t)}/>
  </AbsoluteFill>;
}

function NumberCard() {
  return <AbsoluteFill style={card(ink)}>
    <Counter to={25} start={T.number + .08} duration={1} fontFamily={fonts.serif} fontWeight={400} fontSize={560} letterSpacing={-.03}
      color={white} style={{marginLeft: -12}}/>
    <MaskReveal lines={['transitions.']} start={T.number + .45} fontFamily={fonts.sans} fontWeight={600} fontSize={96} letterSpacing={-.04}
      color="rgba(255,255,255,.62)"/>
  </AbsoluteFill>;
}

/** Real temporal motion blur: every word is rendered at 16 instants inside the shutter and averaged. */
function BlurCard() {
  return <MotionBlur samples={16} shutter={.9}>{time => <AbsoluteFill style={card(white)}>
    {['Real', 'motion', 'blur.'].map((word, i) => {
      const enter = curves.punchOut(progress(time, T.blur - .03 + i * .09, .5));
      const leave = curves.punchIn(progress(time, T.agent - .34 + i * .04, .3));
      return <div key={word} style={{fontFamily: fonts.sans, fontWeight: 800, fontSize: 200, letterSpacing: '-.055em', lineHeight: 1.02, color: ink,
        whiteSpace: 'pre', transform: `translateX(${1150 * (1 - enter) - 1300 * leave}px)`}}>{word}</div>;
    })}
  </AbsoluteFill>}</MotionBlur>;
}

function AgentCard() {
  return <AbsoluteFill style={card(white)}>
    <MaskReveal lines={['Describe', 'the film.']} start={T.agent + .05} stagger={.07} lineHeight={1} fontFamily={fonts.sans} fontWeight={700}
      fontSize={150} letterSpacing={-.05} color={ink}/>
    <MaskReveal lines={[[{text: 'Your agent', fontStyle: 'italic'}], [{text: 'makes it.', fontStyle: 'italic'}]]} start={T.agent + .75}
      stagger={.07} lineHeight={1} fontFamily={fonts.serif} fontWeight={400} fontSize={165} letterSpacing={-.015} color={theme.accent}
      style={{marginTop: 40}}/>
  </AbsoluteFill>;
}

function RenderCard() {
  const t = useTime();
  const bar = curves.punchOut(progress(t, T.render + .75, 1.05));
  const done = arrive(t, T.render + 1.75, .45);
  return <AbsoluteFill style={card(ink)}>
    <Scramble text="npm run render" start={T.render + .05} duration={.6} fontFamily={fonts.mono} fontWeight={500} fontSize={80}
      letterSpacing={-.03} color={white}/>
    <div style={{marginTop: 72, display: 'flex', alignItems: 'center', gap: 30, opacity: arrive(t, T.render + .6, .3)}}>
      <div style={{flex: 1, height: 10, borderRadius: 5, background: 'rgba(255,255,255,.14)', overflow: 'hidden'}}>
        <div style={{width: `${bar * 100}%`, height: '100%', borderRadius: 5, background: white}}/>
      </div>
      <Counter to={100} start={T.render + .75} duration={1.05} suffix="%" fontFamily={fonts.mono} fontWeight={500} fontSize={44}
        letterSpacing={-.02} color="rgba(255,255,255,.7)" style={{width: 136, textAlign: 'right'}}/>
    </div>
    <div style={{marginTop: 60, display: 'flex', alignItems: 'center', gap: 22}}>
      <div style={{width: 64, height: 64, borderRadius: 32, display: 'grid', placeItems: 'center', background: 'rgba(63,213,138,.14)',
        color: '#3fd58a', opacity: done, transform: `scale(${mix(.6, 1, done)})`}}><Icon name="check" size={34} stroke={2.6}/></div>
      <MaskReveal lines={['launch.mp4']} start={T.render + 1.8} fontFamily={fonts.mono} fontWeight={500} fontSize={60} letterSpacing={-.02} color={white}/>
    </div>
  </AbsoluteFill>;
}

function EndCard() {
  return <AbsoluteFill style={{background: white, justifyContent: 'center', alignItems: 'center', gap: 44}}>
    <TrackIn text="Taleframe" start={T.end + .1} duration={1.7} trackFrom={.3} fontFamily={fonts.sans} fontWeight={650} fontSize={180}
      letterSpacing={-.05} color={ink}/>
    <MaskReveal lines={['Motion kit for coding agents.']} align="center" start={T.end + .7} fontFamily={fonts.sans} fontWeight={420}
      fontSize={52} letterSpacing={-.02} color={theme.secondary}/>
  </AbsoluteFill>;
}

export const kitReelShots: Shot[] = [
  {name: 'hook', until: T.type, content: <Hook/>},
  {name: 'type', until: T.roll, content: <TypeShot/>},
  {name: 'roll', until: T.formats, content: <RollShot/>},
  {name: 'formats', until: T.ui, content: <Formats/>},
  {name: 'ui', until: T.zoom, content: <UiShot/>},
  {name: 'zoom', until: T.expand, content: <ZoomCard/>, enter: {kind: 'zoom', duration: .5, focus: {x: 540, y: 820}, push: 2.4, land: 1.5,
    flash: .1, chroma: .2}},
  {name: 'expand', until: T.slice, content: <ExpandCard/>, enter: {kind: 'expand', source: dotRect, shape: 'circle', color: theme.accent,
    duration: .75, push: 1.05, dim: .08, defocus: 6}},
  {name: 'slice', until: T.glitch, content: <SliceCard/>, enter: {kind: 'slice', duration: .6, bands: 6, alternate: true, stagger: .045}},
  {name: 'glitch', until: T.plate, content: <GlitchCard/>, enter: {kind: 'glitch', duration: .46, intensity: .85}},
  {name: 'plate', until: T.painted, content: <Plate/>, enter: {kind: 'portal', text: 'Portal', at: {x: 540, y: 1090}, fontSize: 330,
    fontWeight: 1000, duration: 1.3}},
  {name: 'painted', until: T.number, content: <Painted/>},
  {name: 'number', until: T.blur, content: <NumberCard/>},
  {name: 'blur', until: T.agent, content: <BlurCard/>},
  {name: 'agent', until: T.render, content: <AgentCard/>},
  {name: 'render', until: T.end, content: <RenderCard/>},
  {name: 'end', content: <EndCard/>},
];

/** A 31-second vertical reel about the kit itself, told with the kit: every transition names itself as it plays. */
export function KitReel() {
  return <LogicalStage background={white}><Shots shots={kitReelShots}/></LogicalStage>;
}
