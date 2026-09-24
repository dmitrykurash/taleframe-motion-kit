import React from 'react';
import {AbsoluteFill, CalculateMetadataFunction} from 'remotion';
import {Camera, CameraLayer, Cursor, LogicalStage, MaskReveal, Shots, TrackIn, WordRoll, arrive, curves, focusCamera, progress,
  useTextWidths, useTime, useTyping, type Rect, type Shot} from '../kit';

/* Style sheet · editorial, refined (docs/film-language.md)
 * Palette   paper #f4f2e9 ground, ink #24332f, the accent only where something happens.
 * Type      Instrument Serif display, 180–230 px, tight; DM Sans for the product UI.
 * Motion    words rise out of masks and settle long; slow camera drift; no overshoot.
 * Cuts      hard cuts; one card portal (a board card opens into its note); one expand from Publish.
 * Pacing    1.9–3.3 s shots; type and UI take turns; the brand holds at the end. */

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

const paper = '#f4f2e9', ink = '#24332f', card = '#fffdf7', line = '#e0ded3', muted = '#6e786d';
const serif = '"Instrument Serif", serif', sans = '"DM Sans Variable", sans-serif';
/** Cut times (s). Clicks land a few frames before the cut they cause. */
const T = {board: 2.4, cardClick: 5.42, note: 5.7, roll: 9.0, publish: 11.1, publishClick: 12.72, outcome: 12.92, brand: 15.4};

/** Where a stage rect appears through a CameraLayer camera (transform about the stage center). */
function project(r: Rect, camera: Camera): Rect {
  const f = (x: number, c: number, d: number) => c + (x - c) * camera.scale + d;
  return {x: f(r.x, 960, camera.x), y: f(r.y, 540, camera.y), width: r.width * camera.scale, height: r.height * camera.scale,
    radius: (r.radius ?? 0) * camera.scale};
}

/** Display lines sized to fit the frame with the actual font. */
function useFitted(lines: readonly string[], size: number, font = serif, weight = 400, max = 1620) {
  const widths = useTextWidths(lines, {fontFamily: font, fontSize: size, fontWeight: weight, letterSpacing: -.02 * size});
  return widths ? Math.floor(size * Math.min(1, max / Math.max(...widths))) : null;
}

function Mark({color, size = 56}: {color: string; size?: number}) {
  return <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
    <circle cx="24" cy="24" r="19" stroke={color} strokeWidth="2.5"/>
    <path d="M24 9v30M9 24h30M13.4 13.4l21.2 21.2m0-21.2L13.4 34.6" stroke={color} strokeWidth="2.5"/>
  </svg>;
}

function OpeningShot({lines}: {lines: string[]}) {
  const t = useTime(), size = useFitted(lines, 230);
  return <AbsoluteFill style={{background: paper, padding: '0 150px', justifyContent: 'center'}}>
    {size && <div style={{transform: `scale(${1 + .035 * curves.glide(progress(t, 0, 2.6))})`, transformOrigin: '0% 50%'}}>
      <MaskReveal lines={lines} start={.12} stagger={.07} duration={.85} fontFamily={serif} fontWeight={400}
        fontSize={size} letterSpacing={-.02} lineHeight={.95} color={ink}/>
    </div>}
  </AbsoluteFill>;
}

const columns = [
  {title: 'Ideas', cards: [['Onboarding story', 'Maya · 2 days ago'], ['Weekly digest', 'Leo · yesterday'], ['Customer quotes', 'Ana · last week']]},
  {title: 'Drafts', cards: [['Launch plan', 'You · edited now'], ['Pricing page', 'Ana · 3 hours ago'], ['FAQ', 'Leo · today']]},
  {title: 'Ready', cards: [['Release notes', 'Team · today'], ['Changelog', 'Maya · today']]},
] as const;
const cardRect: Rect = {x: 720, y: 262, width: 480, height: 156, radius: 18};
/** Framed close on the columns, drifting slowly inward. */
const boardCamera = (t: number): Camera => focusCamera({x: 960, y: 430}, 1.16 + .04 * curves.glide(progress(t, T.board, 3.4)));

/** The product's board: notes in columns. The cursor opens "Launch plan". */
function BoardShot({accent}: {accent: string}) {
  const t = useTime(), local = t - T.board, camera = boardCamera(t);
  const hover = t > T.cardClick - .5, press = Math.max(0, 1 - Math.abs(t - T.cardClick) / .1);
  const target = {x: cardRect.x + cardRect.width * .58, y: cardRect.y + cardRect.height * .52};
  return <AbsoluteFill style={{background: paper, fontFamily: sans, color: ink}}>
    <CameraLayer camera={camera}>
      <div style={{position: 'absolute', left: 150, top: 104, width: 1620, height: 872, borderRadius: 28, background: card,
        border: `1px solid ${line}`, boxShadow: '0 40px 100px rgba(36,51,47,.10)'}}>
        <div style={{height: 78, display: 'flex', alignItems: 'center', gap: 16, padding: '0 34px', borderBottom: `1px solid ${line}`}}>
          <Mark color={accent} size={34}/><span style={{fontSize: 24, fontWeight: 600}}>Field Notes</span>
          <span style={{marginLeft: 36, height: 42, width: 360, borderRadius: 21, background: '#f1efe6', color: muted, fontSize: 18,
            display: 'flex', alignItems: 'center', padding: '0 20px'}}>Search notes</span>
        </div>
      </div>
      {columns.map((column, i) => <div key={column.title} style={{position: 'absolute', left: 200 + i * 520, top: 212, fontSize: 21, fontWeight: 600}}>
        {column.title}<span style={{marginLeft: 12, color: muted, fontWeight: 400}}>{column.cards.length}</span>
      </div>)}
      {columns.flatMap((column, i) => column.cards.map(([title, meta], j) => {
        const enter = arrive(local, -.22 + (i * 3 + j) * .05, .7); // already rising at the cut, never an empty board
        const isTarget = i === 1 && j === 0;
        const lift = isTarget && hover ? 1 : 0;
        return <div key={title} style={{position: 'absolute', left: 200 + i * 520, top: 262 + j * 176, width: 480, height: 156,
          boxSizing: 'border-box', padding: '24px 28px', borderRadius: 18, background: '#fff',
          border: `1.5px solid ${lift ? accent : line}`, opacity: enter,
          boxShadow: lift ? '0 18px 40px rgba(36,51,47,.12)' : '0 1px 0 rgba(36,51,47,.04)',
          transform: `translateY(${40 * (1 - enter) - 4 * lift}px) scale(${1 - .02 * press})`}}>
          <div style={{fontFamily: serif, fontSize: 42, lineHeight: 1}}>{title}</div>
          <div style={{position: 'absolute', left: 28, bottom: 24, fontSize: 18, color: muted}}>{meta}</div>
          <div style={{position: 'absolute', right: 24, bottom: 20, height: 30, padding: '0 14px', borderRadius: 15, fontSize: 15,
            display: 'flex', alignItems: 'center', background: isTarget ? accent : '#efece2', color: isTarget ? '#fff' : muted}}>{isTarget ? 'Due Thu' : 'Note'}</div>
        </div>;
      }))}
      <Cursor time={t} enter={T.cardClick - 1.2} clicks={[T.cardClick]} size={30} color={ink} path={[
        {time: T.cardClick - 1.2, x: 1260, y: 900}, {time: T.cardClick - .2, x: target.x, y: target.y}, {time: T.cardClick + 1, x: target.x, y: target.y}]}/>
    </CameraLayer>
  </AbsoluteFill>;
}

const items = ['Share the brief with the team', 'Record the walkthrough', 'Publish on Thursday'];
const publishButton: Rect = {x: 1570, y: 58, width: 186, height: 64, radius: 32};
const publishCamera: Camera = {scale: 1.1, x: 0, y: 60};

/** The note the card opened into. `publishing` is the later, closer angle where Publish is clicked. */
function NoteShot({start, publishing = false, accent}: {start: number; publishing?: boolean; accent: string}) {
  const t = useTime(), local = t - start;
  const typing = useTyping({text: items[2], start: start + 1.9, end: start + 2.75, fontFamily: sans, fontSize: 40});
  const checked = (i: number) => publishing || local >= [1.2, 1.65, 99][i];
  const camera: Camera = publishing
    ? {...publishCamera, scale: publishCamera.scale + .015 * curves.glide(progress(local, 0, 2))}
    : {scale: 1 + .05 * curves.glide(progress(local, .6, 2.8)), x: -30 * curves.glide(progress(local, .6, 2.8)), y: -10 * curves.glide(progress(local, .6, 2.8))};
  const hover = publishing && t > T.publishClick - .45, press = Math.max(0, 1 - Math.abs(t - T.publishClick) / .1);
  const b = publishButton;
  return <AbsoluteFill style={{background: card, fontFamily: sans, color: ink}}>
    <CameraLayer camera={camera}>
      <div style={{position: 'absolute', left: 150, top: 76, fontSize: 21, color: muted}}>Drafts <span style={{margin: '0 10px'}}>/</span><span style={{color: ink}}>Launch plan</span></div>
      <div style={{position: 'absolute', left: b.x, top: b.y, width: b.width, height: b.height, borderRadius: b.radius,
        background: hover ? accent : ink, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 600,
        transform: `scale(${1 - .06 * press})`}}>Publish</div>
      <div style={{position: 'absolute', left: 146, top: 196, fontFamily: serif, fontSize: 120, lineHeight: 1, letterSpacing: '-.01em'}}>Launch plan</div>
      <div style={{position: 'absolute', left: 1290, top: 200, width: 470, fontSize: 20, color: muted, display: 'grid', gap: 34}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start'}}>Due<div style={{marginTop: 12, display: 'flex',
          height: 40, padding: '0 18px', borderRadius: 20, alignItems: 'center', background: accent, color: '#fff', fontSize: 19, fontWeight: 600}}>Thursday, 9:00</div></div>
        <div>People<div style={{marginTop: 12, display: 'flex'}}>{['#f0b58f', '#a9bfa5', '#9fb3d6'].map((color, i) =>
          <div key={color} style={{width: 52, height: 52, borderRadius: 26, background: color, border: `4px solid ${card}`, marginLeft: i ? -14 : 0}}/>)}</div></div>
        <div>Linked<div style={{marginTop: 12, padding: '20px 24px', borderRadius: 16, border: `1.5px solid ${line}`, background: '#fff', color: ink}}>
          <div style={{fontFamily: serif, fontSize: 34, lineHeight: 1}}>Release notes</div>
          <div style={{marginTop: 10, fontSize: 17, color: muted}}>Ready · Team</div></div></div>
      </div>
      <div style={{position: 'absolute', left: 150, top: 350, fontSize: 24, color: muted}}>Edited just now · Maya, Leo, and you</div>
      {items.map((item, i) => {
        const done = checked(i), fill = done ? curves.punchOut(progress(local, publishing ? -1 : [1.2, 1.65, 99][i], .3)) : 0;
        return <div key={item} style={{position: 'absolute', left: 150, top: 470 + i * 96, display: 'flex', alignItems: 'center', gap: 26, fontSize: 40}}>
          <div style={{width: 40, height: 40, borderRadius: 11, border: `2.5px solid ${done ? accent : '#c9c6ba'}`,
            background: done ? accent : 'transparent', display: 'grid', placeItems: 'center', transform: `scale(${1 + .12 * Math.sin(Math.PI * fill)})`}}>
            {done && <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round"
              strokeLinejoin="round" strokeDasharray="24" strokeDashoffset={24 * (1 - fill)}><path d="m5 12 4.5 4.5L19 7"/></svg>}
          </div>
          <span style={{color: done ? muted : ink, whiteSpace: 'pre'}}>{i < 2 || publishing ? item : typing.text}</span>
        </div>;
      })}
      {publishing && <Cursor time={t} enter={T.publishClick - 1} clicks={[T.publishClick]} size={30} color={ink} path={[
        {time: T.publishClick - 1, x: 1400, y: 420}, {time: T.publishClick - .18, x: b.x + b.width * .45, y: b.y + b.height * .45},
        {time: T.publishClick + 1, x: b.x + b.width * .45, y: b.y + b.height * .45}]}/>}
    </CameraLayer>
  </AbsoluteFill>;
}

function RollShot({accent}: {accent: string}) {
  return <AbsoluteFill style={{background: ink, padding: '0 150px', justifyContent: 'center'}}>
    <MaskReveal lines={['Notes that turn into']} start={T.roll - .1} fontFamily={serif} fontWeight={400} fontSize={112}
      letterSpacing={-.01} color="rgba(244,242,233,.62)"/>
    <WordRoll words={['plans.', 'drafts.', 'launches.']} at={[T.roll + .06, T.roll + .7, T.roll + 1.1]} fontFamily={serif}
      fontWeight={400} fontSize={230} letterSpacing={-.02} color={paper} rollColor={accent} duration={.5} style={{marginTop: 6}}/>
  </AbsoluteFill>;
}

function OutcomeShot({lines, accent}: {lines: string[]; accent: string}) {
  const size = useFitted(lines, 210);
  return <AbsoluteFill style={{background: accent, padding: '0 150px', justifyContent: 'center'}}>
    {size && <MaskReveal lines={lines} start={T.outcome + .28} stagger={.08} duration={.8} fontFamily={serif} fontWeight={400}
      fontSize={size} letterSpacing={-.02} lineHeight={.95} color={paper}/>}
  </AbsoluteFill>;
}

function BrandShot({name, website, accent}: {name: string; website: string; accent: string}) {
  const t = useTime(), mark = arrive(t, T.brand - .12, .7); // already arriving on the cut
  return <AbsoluteFill style={{background: paper, alignItems: 'center', justifyContent: 'center', gap: 34}}>
    <div style={{opacity: mark, transform: `translateY(${24 * (1 - mark)}px) rotate(${-40 * (1 - mark)}deg)`}}><Mark color={accent} size={116}/></div>
    <TrackIn text={name} start={T.brand - .05} duration={1.5} trackFrom={.3} fontFamily={sans} fontWeight={600} fontSize={156}
      letterSpacing={-.04} color={ink}/>
    <MaskReveal lines={[website]} start={T.brand + .8} fontFamily={sans} fontWeight={500} fontSize={40} letterSpacing={0} color={muted}/>
  </AbsoluteFill>;
}

/** A 18-second launch in the editorial family: type and product take turns, two meaningful transitions. */
export function LaunchFilm(input: LaunchProps) {
  const p = validateLaunchProps(input);
  const shots: Shot[] = [
    {name: 'opening', until: T.board, content: <OpeningShot lines={p.opening}/>},
    {name: 'board', until: T.note, content: <BoardShot accent={p.accent}/>},
    {name: 'note', until: T.roll, content: <NoteShot start={T.note} accent={p.accent}/>,
      // The hovered card sits 4 px higher; the portal starts from exactly where it is on screen.
      enter: {kind: 'portal', rect: project({...cardRect, y: cardRect.y - 4}, boardCamera(T.note)), duration: 1, depth: 1, backdrop: card}},
    {name: 'roll', until: T.publish, content: <RollShot accent={p.accent}/>},
    {name: 'publish', until: T.outcome, content: <NoteShot start={T.publish} publishing accent={p.accent}/>},
    {name: 'outcome', until: T.brand, content: <OutcomeShot lines={p.outcome} accent={p.accent}/>,
      enter: {kind: 'expand', source: project(publishButton, {...publishCamera, scale: publishCamera.scale + .015 * curves.glide(progress(T.outcome - T.publish, 0, 2))}),
        color: p.accent, duration: .8, align: 'start', dim: .3}},
    {name: 'brand', content: <BrandShot name={p.name} website={p.website} accent={p.accent}/>},
  ];
  return <LogicalStage background={paper}><Shots shots={shots}/></LogicalStage>;
}

