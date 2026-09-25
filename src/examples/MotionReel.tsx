import React from 'react';
import {AbsoluteFill} from 'remotion';
import {BlockField, KineticText, LogicalStage, ParticleText, PatternField, Scramble, SelectionBox, Shots, Trail, TypeWall, Viewfinder, arrive,
  bounce, clamp, curves, fieldWave, mix, progress, spring, useTextWidths, useTime, type Rect, type Shot} from '../kit';
import {mulberry32} from '../taleframe/transitions/kit';
import {InterfaceShot, U} from './reel/interface';

/* Style sheet · motion-design reel (docs/film-language.md)
 * Palette   near-black and warm paper grounds, one orange, one electric blue; the interface in black and white on warm gray.
 * Type      Inter Medium for statements, Anybody's width axis for the type wall, Geist for the interface, Geist Mono for the frame.
 * Motion    springs with a touch of overshoot at most; every change lands on a 120 BPM beat; motion trails and real blur.
 * Cuts      hard cuts on beats; a circle out of the ball, a split screen into the type wall, a bento grid into the end.
 * Frame     a camera viewfinder over the whole reel: title, specs, running timecode, progress, and section. */

export const REEL_SECONDS = 30;
const T = {frame: 2.6, field: 5, blocks: 7.2, wall: 9.6, dust: 12, ui: U.start, end: U.end};
const INK = '#0c0c0f', PAPER = '#efede8', ORANGE = '#ff5a1f', BLUE = '#2f45ff';
const SANS = '"Inter Variable", "Inter", sans-serif', MONO = '"Geist Mono Variable", ui-monospace, monospace', WIDE = '"Anybody Variable", sans-serif';

/** The bouncing ball: squash and stretch, a motion trail, its path drawn like a curve editor, and a key at every impact. */
const LINE_Y = 760, RADIUS = 44, DROP = .35;
const ballX = (t: number) => mix(330, 1480, curves.open(progress(t, DROP, 2.1)));
const ballState = (t: number) => bounce(t, {start: DROP, height: 380, gravity: 3600, restitution: .58});
function Ball({time}: {time: number}) {
  const b = ballState(time);
  // It springs into place at the top of its arc, then drops: stretched in fast flight, squashed on each impact.
  const pop = Math.max(0, spring(time - (DROP - .32), {duration: .42, bounce: .3}));
  const sx = (b.squash < .999 ? 1 / b.squash : 1 / b.stretch) * pop, sy = (b.squash < .999 ? b.squash : b.stretch) * pop;
  return <div style={{position: 'absolute', left: ballX(time) - RADIUS, top: LINE_Y - 2 * RADIUS - b.y, width: 2 * RADIUS, height: 2 * RADIUS, borderRadius: '50%',
    background: `radial-gradient(circle at 35% 30%, #ff8a5c, ${ORANGE} 55%, #d9430f)`, transform: `scale(${sx.toFixed(4)}, ${sy.toFixed(4)})`,
    transformOrigin: b.y > 1 ? '50% 50%' : '50% 100%'}}/>;
}
function BounceShot() {
  const t = useTime();
  const impacts = ballState(0).impacts;
  const draw = curves.punchOut(progress(t, .05, .7));
  const path = Array.from({length: Math.max(2, Math.floor((t - DROP) * 60))}, (_, i) => DROP + i / 60)
    .map(s => `${ballX(s).toFixed(1)},${(LINE_Y - RADIUS - ballState(s).y).toFixed(1)}`).join(' ');
  return <AbsoluteFill style={{background: INK}}>
    <div style={{position: 'absolute', left: 260, top: LINE_Y - .75, width: 1400, height: 1.5, background: 'rgba(239,237,232,.55)', transform: `scaleX(${draw})`, transformOrigin: '0 50%'}}/>
    {t > DROP && <svg width={1920} height={1080} style={{position: 'absolute', inset: 0}}>
      <polyline points={path} fill="none" stroke="rgba(239,237,232,.28)" strokeWidth={1.5} strokeDasharray="2 7" strokeLinecap="round"/>
    </svg>}
    {impacts.slice(0, 6).map((at, i) => {
      if (t < at) return null;
      const e = arrive(t, at, .35), x = ballX(at);
      return <React.Fragment key={i}>
        <div style={{position: 'absolute', left: x - 7, top: LINE_Y - 7, width: 14, height: 14, border: `1.5px solid ${PAPER}`, background: INK,
          transform: `rotate(45deg) scale(${e})`}}/>
        {i < 3 && <div style={{position: 'absolute', left: x - 40, top: LINE_Y + 22, width: 80, textAlign: 'center', fontFamily: MONO, fontSize: 13,
          letterSpacing: '.08em', color: 'rgba(239,237,232,.55)', opacity: e}}>KEY {String(i + 1).padStart(2, '0')}</div>}
      </React.Fragment>;
    })}
    <Trail count={7} spacing={.028} fade={.7}>{time => time > DROP - .32 ? <Ball time={time}/> : null}</Trail>
  </AbsoluteFill>;
}
function ballRect(t: number): Rect {
  const b = ballState(t);
  return {x: ballX(t) - RADIUS, y: LINE_Y - 2 * RADIUS - b.y, width: 2 * RADIUS, height: 2 * RADIUS, radius: RADIUS};
}

/** Type under a design-tool selection. */
function FrameShot() {
  const size = 330, widths = useTextWidths(['FRAME'], {fontFamily: SANS, fontSize: size, fontWeight: 500, letterSpacing: -.04 * size});
  const w = widths?.[0] ?? 1000;
  return <AbsoluteFill style={{background: INK, display: 'grid', placeItems: 'center'}}>
    <KineticText lines={['FRAME']} by="character" enter="rise" start={T.frame + .62} stagger={.04} fontFamily={SANS} fontWeight={500} fontSize={size}
      letterSpacing={-.04} color={ORANGE}/>
    <SelectionBox rect={{x: 960 - w / 2 - 26, y: 540 - size * .4, width: w + 52, height: size * .8}} start={T.frame + 1.05} name="Heading"
      label={`${Math.round(w + 52)} × ${Math.round(size * .8)}`}/>
  </AbsoluteFill>;
}

/** A halftone disc that pulses, then a pattern field where dots turn into crosses and tiles in a diagonal wave. */
const accent = (col: number, row: number) => {const r = mulberry32((col * 73856093) ^ (row * 19349663))(); return r < .1 ? ORANGE : r < .22 ? BLUE : PAPER;};
function FieldShot() {
  const t = useTime(), local = t - T.field;
  return <AbsoluteFill style={{background: INK}}>
    <PatternField columns={32} rows={18} cell={60} glyph={(col, row, time) => {
      const d = Math.hypot(col - 15.5, row - 8.5), wave = fieldWave(col, row, time, {pattern: 'radial', origin: {x: 15.5, y: 8.5}, speed: 1.3, wavelength: 5});
      const spread = curves.punchOut(clamp((local - .1) / 1) );
      const disc = d < 1.5 + 7 * spread ? (.14 + .5 * wave) * (1 - d / 10) : 0;
      const m = curves.snap(clamp((local - 1.05 - (col + row) * .022) / .45));
      if (m <= 0) return disc > .02 ? {shape: 'dot', size: disc, color: Math.abs(d - 7.4) < .6 ? ORANGE : PAPER} : null;
      const color = accent(col, row), tile = color !== PAPER;
      return [{shape: 'dot', size: disc * (1 - m), color: PAPER},
        {shape: tile ? 'square' : 'plus', size: m * (tile ? .5 : .42) * (.75 + .25 * wave), color, rotate: tile ? 45 * m : 90 * m, round: .35}];
    }}/>
  </AbsoluteFill>;
}

/** A field of blocks in 3D rippling out from the middle, with a ball bouncing across it. */
const blockColor = (col: number, row: number) => {const r = mulberry32((col * 2654435761) ^ (row * 40503))(); return r < .09 ? ORANGE : r < .17 ? BLUE : '#dcdcdf';};
function BlocksShot() {
  const t = useTime(), p = progress(t, T.blocks, T.wall - T.blocks + .6);
  const height = (col: number, row: number, time: number) => .3 + 1.9 * fieldWave(col, row, time, {pattern: 'radial', origin: {x: 8, y: 5.5}, speed: .7, wavelength: 7.5});
  const bx = mix(-5, 5, p), bz = mix(2.5, -1.5, p), ground = height(Math.floor(bx + 8), Math.floor(bz + 5.5), t);
  const hop = Math.abs(Math.sin(Math.PI * (t - T.blocks) * 1.7)), squash = hop < .12 ? .78 + 1.8 * hop : 1;
  return <BlockField columns={16} rows={11} height={height} color={blockColor} background={INK} fog={.5}
    camera={{yaw: mix(22, 40, p), pitch: mix(41, 33, p), distance: mix(21, 18.5, p)}}
    ball={{x: bx, y: ground + 2.4 * hop, z: bz, radius: .42, color: ORANGE, squash}}/>;
}

function WallShot() {
  return <AbsoluteFill style={{background: PAPER}}>
    <TypeWall word="MOTION" rows={7} fontFamily={WIDE} fontSize={150} letterSpacing={-.01} speed={170} start={T.wall - 1.4}
      palettes={[[PAPER, BLUE], [BLUE, PAPER]]} dot={ORANGE} band={{row: 3, background: ORANGE, color: INK, variant: {weight: 800, stretch: 112}}}/>
  </AbsoluteFill>;
}

function DustShot() {
  return <AbsoluteFill style={{background: INK}}>
    <ParticleText text="MOTION" mode="swirl" start={T.dust + .3} duration={1.5} count={7000} fontFamily={SANS} fontWeight={500} fontSize={310}
      letterSpacing={-.04} color={PAPER} accent={ORANGE} accentShare={.4}/>
  </AbsoluteFill>;
}

function EndShot() {
  const t = useTime(), at = T.end + .55;
  const line = arrive(t, at + .5, .7);
  return <AbsoluteFill style={{background: INK}}>
    <div style={{position: 'absolute', left: 190, top: 330, display: 'flex', alignItems: 'baseline'}}>
      <KineticText lines={['Taleframe']} by="character" enter="rise" start={at} stagger={.035} fontFamily={SANS} fontWeight={500} fontSize={250}
        letterSpacing={-.05} color={PAPER}/>
      <div style={{width: 52, height: 52, borderRadius: '50%', background: ORANGE, marginLeft: 14, transform: `scale(${curves.punchOut(progress(t, at + .45, .5))})`}}/>
    </div>
    <div style={{position: 'absolute', left: 196, right: 196, top: 650, height: 1.5, background: 'rgba(239,237,232,.4)', transform: `scaleX(${line})`, transformOrigin: '0 50%'}}/>
    <div style={{position: 'absolute', left: 196, top: 680}}><Scramble text="MOTION KIT FOR CODING AGENTS" start={at + .6} fontFamily={MONO} fontSize={20}
      letterSpacing={.08} fontWeight={500} color={PAPER}/></div>
    <div style={{position: 'absolute', right: 196, top: 680, textAlign: 'right'}}><Scramble text="REEL · 2026" start={at + .7} fontFamily={MONO} fontSize={20}
      letterSpacing={.08} fontWeight={500} color={PAPER}/></div>
    <div style={{position: 'absolute', right: 196, top: 760, opacity: arrive(t, at + 1.1, .6), fontFamily: '"Instrument Serif", serif', fontStyle: 'italic',
      fontSize: 40, color: 'rgba(239,237,232,.7)'}}>every frame here is code.</div>
  </AbsoluteFill>;
}

export const reelShots: Shot[] = [
  {name: 'bounce', until: T.frame, content: <BounceShot/>},
  {name: 'frame', until: T.field, content: <FrameShot/>, enter: {kind: 'expand', source: ballRect(T.frame), shape: 'circle', color: ORANGE, duration: 1,
    colorHold: .5, push: 1.04, dim: .2, defocus: 4}},
  {name: 'field', until: T.blocks, content: <FieldShot/>},
  {name: 'blocks', until: T.wall, content: <BlocksShot/>},
  {name: 'wall', until: T.dust, content: <WallShot/>, enter: {kind: 'divide', duration: 1.3, line: 2, lineColor: PAPER}},
  {name: 'dust', until: T.ui, content: <DustShot/>},
  {name: 'interface', until: T.end, content: <InterfaceShot/>},
  {name: 'end', content: <EndShot/>, enter: {kind: 'grid', duration: 1.6, columns: 4, rows: 2, fromCell: 5, toCell: 2, backdrop: '#202025',
    tiles: [<BounceShot key="b"/>, <FrameShot key="f"/>, <FieldShot key="p"/>, <BlocksShot key="k"/>, <WallShot key="w"/>, <DustShot key="d"/>]}},
];

const sections = [{at: 0, label: '01 · TIMING'}, {at: T.frame, label: '02 · TYPE'}, {at: T.field, label: '03 · SYSTEMS'}, {at: T.blocks, label: '04 · SPACE'},
  {at: T.wall, label: '05 · KINETIC TYPE'}, {at: T.dust, label: '06 · PARTICLES'}, {at: T.ui, label: '07 · INTERFACE'}, {at: T.end, label: '08 · REEL'}];

/** A motion-design reel made with the kit, in the manner of a designer's showreel: timing, type, systems, space,
 * kinetic type, particles, and one continuous interface morph, all under a camera viewfinder. */
export function MotionReel() {
  return <LogicalStage background={INK}>
    <AbsoluteFill><Shots shots={reelShots}/></AbsoluteFill>
    <AbsoluteFill style={{mixBlendMode: 'difference'}}>
      <Viewfinder title="TALEFRAME — MOTION REEL" specs="120 BPM · 60 FPS · 1920×1080" sections={sections} color="rgba(255,255,255,.78)" accent={ORANGE}
        start={.02}/>
    </AbsoluteFill>
  </LogicalStage>;
}
