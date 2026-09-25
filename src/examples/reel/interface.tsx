import React from 'react';
import {AbsoluteFill} from 'remotion';
import {CameraLayer, Counter, Cursor, Morph, clamp, cursorAt, curves, fitScale, liquidRange, mix, progress, springTo, useTime, useTyping,
  type CursorPoint, type MorphState} from '../../kit';

/** One shape, never cut: a cursor drives a single black element through a button, a loader, a player, a
 * slider, a toggle, tabs, a chart, a command palette, and a toast, then back to the button. */

export const UI = '"Geist Variable", system-ui, sans-serif';
const MONO = '"Geist Mono Variable", ui-monospace, monospace';
const INK = '#0d0d0d', WHITE = '#ffffff', GRAY = '#8e8e93', CANVAS = '#ecebe7';
const C = {x: 960, y: 540};

/** Times of every state change and action (film seconds). */
export const U = {start: 14, press: 14.55, loader: 14.62, check: 15.4, island: 15.9, player: 16.5, pause: 17.15, grabBar: 17.45, dropBar: 18.1,
  volume: 18.4, grab: 18.62, max: 18.88, over: 18.98, release: 19.32, toggle: 19.6, flip: 19.95, tabs: 20.4, week: 20.75, month: 21.1,
  chart: 21.5, hoverFrom: 22.35, hoverTo: 22.95, palette: 23.15, typeFrom: 23.4, typeTo: 23.85, pick: 24, enter: 24.15, toast: 24.25,
  back: 24.9, end: 26.2};

const box = (w: number, h: number) => ({x: C.x - w / 2, y: C.y - h / 2});
const PLAYER = {w: 540, h: 300}, VOLUME = {w: 470, h: 68}, TABS = {w: 440, h: 68}, CHART = {w: 580, h: 400}, PALETTE = {w: 580, h: 340};
const bar = {left: 28, right: 28, top: 176};
const track = {x0: box(PLAYER.w, PLAYER.h).x + bar.left, x1: box(PLAYER.w, PLAYER.h).x + PLAYER.w - bar.right, y: box(PLAYER.w, PLAYER.h).y + bar.top + 3};
const vol = {x0: box(VOLUME.w, VOLUME.h).x + 76, x1: box(VOLUME.w, VOLUME.h).x + VOLUME.w - 30, y: C.y};

/** The cursor's path: it clicks, drags the progress bar, pulls the volume past its end, and flips the toggle. */
export const cursorPath: CursorPoint[] = [
  {time: 14.05, x: 1180, y: 700}, {time: U.press - .1, x: 990, y: 552}, {time: U.pause - .45, x: 1040, y: 690},
  {time: U.pause - .08, x: 963, y: box(PLAYER.w, PLAYER.h).y + 252}, {time: U.grabBar - .05, x: mix(track.x0, track.x1, .36), y: track.y},
  {time: U.dropBar, x: mix(track.x0, track.x1, .8), y: track.y}, {time: U.volume + .1, x: 1110, y: 610},
  {time: U.grab - .04, x: mix(vol.x0, vol.x1, .55), y: vol.y}, {time: U.max, x: vol.x1, y: vol.y}, {time: U.release, x: vol.x1 + 92, y: vol.y + 4},
  {time: U.toggle + .1, x: 1060, y: 620}, {time: U.flip - .06, x: 968, y: 548}, {time: U.tabs + .15, x: 1030, y: 620},
  {time: U.week - .06, x: 962, y: 548}, {time: U.month - .06, x: 1108, y: 548}, {time: U.chart + .5, x: 1180, y: 660},
  {time: U.hoverFrom, x: 790, y: 640}, {time: U.hoverTo, x: 1170, y: 600}, {time: U.palette + .3, x: 1320, y: 740},
  {time: U.back + .1, x: 1180, y: 700}];
const clicks = [U.press, U.pause, U.flip, U.week, U.month];

function Icon({d, size = 24, color = WHITE, fill = false, width = 2}: {d: string; size?: number; color?: string; fill?: boolean; width?: number}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? color : 'none'} stroke={fill ? 'none' : color} strokeWidth={width}
    strokeLinecap="round" strokeLinejoin="round">{d.split('|').map((p, i) => <path key={i} d={p}/>)}</svg>;
}
const art = 'linear-gradient(135deg, #ff9a3d 0%, #ff4d6d 45%, #6a5cff 100%)';
const center: React.CSSProperties = {position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'};

function Label({text}: {text: string}) {
  return <div style={{...center, color: WHITE, fontFamily: UI, fontSize: 27, fontWeight: 500, letterSpacing: '-.01em'}}>{text}</div>;
}

function Loader() {
  const t = useTime();
  return <div style={center}><svg width={40} height={40} viewBox="0 0 40 40" style={{transform: `rotate(${(t * 420) % 360}deg)`}}>
    <circle cx={20} cy={20} r={16} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={3.5}/>
    <path d="M20 4 A16 16 0 0 1 36 20" fill="none" stroke={WHITE} strokeWidth={3.5} strokeLinecap="round"/>
  </svg></div>;
}

function Check() {
  const t = useTime(), q = curves.punchOut(progress(t, U.check + .12, .4));
  const pts = [[25, 39], [34, 48], [52, 29]], f = q * 2, k = Math.min(1, Math.floor(f));
  const a = pts[k], b = pts[k + 1], tip = [a[0] + (b[0] - a[0]) * (f - k), a[1] + (b[1] - a[1]) * (f - k)];
  const d = `M${pts[0][0]} ${pts[0][1]} ${f > 1 ? `L${pts[1][0]} ${pts[1][1]} ` : ''}L${tip[0].toFixed(2)} ${tip[1].toFixed(2)}`;
  return <div style={center}><svg width={76} height={76} viewBox="0 0 76 76"><path d={d} fill="none" stroke={WHITE} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round"/></svg></div>;
}

function Island() {
  const t = useTime();
  return <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 12px 0 10px', justifyContent: 'space-between'}}>
    <div style={{width: 40, height: 40, borderRadius: 11, background: art}}/>
    <div style={{display: 'flex', gap: 4, alignItems: 'center', marginRight: 10}}>
      {[0, 1, 2, 3].map(i => <i key={i} style={{width: 4, borderRadius: 2, background: WHITE, height: 8 + 16 * Math.abs(Math.sin(t * 7 + i * 1.3))}}/>)}
    </div>
  </div>;
}

function Player() {
  const t = useTime();
  const dragging = t >= U.grabBar && t < U.dropBar;
  const cursor = cursorAt(t, cursorPath);
  const played = t < U.pause ? .31 + (t - U.player) * .02 : .31 + (U.pause - U.player) * .02;
  const pct = dragging || t >= U.dropBar ? clamp((Math.min(cursor.x, t >= U.dropBar ? mix(track.x0, track.x1, .8) : cursor.x) - track.x0) / (track.x1 - track.x0)) : played;
  const paused = t >= U.pause, swap = curves.punchOut(progress(t, U.pause, .25));
  const seconds = Math.round(pct * 179), time = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return <div style={{position: 'absolute', inset: 0, fontFamily: UI, color: WHITE}}>
    <div style={{position: 'absolute', left: 28, top: 28, width: 110, height: 110, borderRadius: 22, background: art}}/>
    <div style={{position: 'absolute', left: 164, top: 46, fontSize: 28, fontWeight: 500, letterSpacing: '-.01em'}}>motion study 02</div>
    <div style={{position: 'absolute', left: 164, top: 86, fontSize: 20, color: GRAY}}>made in code</div>
    <div style={{position: 'absolute', left: bar.left, right: bar.right, top: bar.top, height: 6, borderRadius: 3, background: '#333'}}>
      <div style={{width: `${pct * 100}%`, height: '100%', borderRadius: 3, background: WHITE}}/>
      <div style={{position: 'absolute', left: `${pct * 100}%`, top: 3, width: dragging ? 22 : 14, height: dragging ? 22 : 14, borderRadius: '50%', background: WHITE,
        transform: 'translate(-50%, -50%)', boxShadow: '0 2px 8px rgba(0,0,0,.4)'}}/>
    </div>
    <div style={{position: 'absolute', left: bar.left, top: 196, fontFamily: MONO, fontSize: 15, color: GRAY}}>{time(seconds)}</div>
    <div style={{position: 'absolute', right: bar.right, top: 196, fontFamily: MONO, fontSize: 15, color: GRAY}}>-{time(179 - seconds)}</div>
    <div style={{position: 'absolute', left: 0, right: 0, top: 232, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 56}}>
      <Icon d="M19 20 9 12l10-8v16Z|M5 19V5" size={26} fill/>
      <div style={{position: 'relative', width: 34, height: 34}}>
        <div style={{position: 'absolute', inset: 0, opacity: 1 - swap, transform: `scale(${1 - .3 * swap})`}}><Icon d="M7 4h3v16H7z|M14 4h3v16h-3z" size={34} fill/></div>
        <div style={{position: 'absolute', inset: 0, opacity: swap, transform: `scale(${.7 + .3 * swap})`}}><Icon d="M7 4v16l13-8L7 4Z" size={34} fill/></div>
      </div>
      <Icon d="M5 4l10 8-10 8V4Z|M19 5v14" size={26} fill/>
    </div>
  </div>;
}

function Volume() {
  const t = useTime(), cursor = cursorAt(t, cursorPath);
  const held = t >= U.grab && t < U.release;
  const level = held ? clamp((cursor.x - vol.x0) / (vol.x1 - vol.x0)) : t >= U.release ? 1 : .55;
  return <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '0 30px 0 26px', gap: 22}}>
    <Icon d="M11 5 6 9H2v6h4l5 4V5Z|M15.5 8.5a5 5 0 0 1 0 7|M18.5 5.5a9 9 0 0 1 0 13" size={28} width={2.2}/>
    <div style={{position: 'relative', flex: 1, height: 8, borderRadius: 4, background: '#333'}}>
      <div style={{width: `${level * 100}%`, height: '100%', borderRadius: 4, background: WHITE}}/>
    </div>
  </div>;
}

function Toggle() {
  const t = useTime();
  const knob = liquidRange(t, [{at: 0, start: 6, end: 62}, {at: U.flip, start: 66, end: 122}]);
  return <div style={{position: 'absolute', left: knob.start, top: 6, width: knob.end - knob.start, height: 56, borderRadius: 28, background: WHITE,
    boxShadow: '0 2px 6px rgba(0,0,0,.18)'}}/>;
}

const TAB_NAMES = ['Day', 'Week', 'Month'];
function Tabs({compact = false}: {compact?: boolean}) {
  const t = useTime(), w = compact ? 300 : TABS.w, h = compact ? 46 : TABS.h, seg = (w - 16) / 3;
  const range = compact ? {start: 8 + 2 * seg, end: 8 + 3 * seg}
    : liquidRange(t, [{at: 0, start: 8, end: 8 + seg}, {at: U.week, start: 8 + seg, end: 8 + 2 * seg}, {at: U.month, start: 8 + 2 * seg, end: 8 + 3 * seg}]);
  return <div style={{position: 'relative', width: w, height: h, fontFamily: UI}}>
    <div style={{position: 'absolute', left: range.start, top: 6, width: range.end - range.start, height: h - 12, borderRadius: (h - 12) / 2, background: INK}}/>
    {TAB_NAMES.map((name, i) => {
      const middle = 8 + (i + .5) * seg, inside = clamp(1 - Math.max(range.start - middle, middle - range.end, 0) / 30);
      return <div key={name} style={{position: 'absolute', left: 8 + i * seg, width: seg, top: 0, height: h, display: 'grid', placeItems: 'center',
        fontSize: compact ? 17 : 23, fontWeight: 500, color: `color-mix(in srgb, ${WHITE} ${(inside * 100).toFixed(0)}%, ${GRAY})`}}>{name}</div>;
    })}
  </div>;
}

/** Values of the chart, left to right. */
const SERIES = [21, 24, 22, 27, 26, 31, 29, 35, 33, 38, 41, 39, 46, 52, 50, 58, 63, 61, 69, 74];
const CH = {left: 36, right: 36, top: 196, bottom: 40};
function chartPoint(i: number) {
  const w = CHART.w - CH.left - CH.right, h = CHART.h - CH.top - CH.bottom;
  return {x: CH.left + i / (SERIES.length - 1) * w, y: CH.top + h - (SERIES[i] - 15) / 65 * h};
}
function Chart() {
  const t = useTime();
  const draw = curves.glide(progress(t, U.chart + .15, .8)), f = draw * (SERIES.length - 1), k = Math.floor(f);
  const pts = SERIES.map((_, i) => chartPoint(i)).slice(0, k + 1);
  if (k < SERIES.length - 1 && f > k) {const a = chartPoint(k), b = chartPoint(k + 1); pts.push({x: mix(a.x, b.x, f - k), y: mix(a.y, b.y, f - k)});}
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)} ${CHART.h - CH.bottom} L${CH.left} ${CHART.h - CH.bottom} Z`;
  const hover = t >= U.hoverFrom - .1 && t < U.palette;
  const cx = cursorAt(t, cursorPath).x - box(CHART.w, CHART.h).x;
  const hi = clamp((cx - CH.left) / (CHART.w - CH.left - CH.right)) * (SERIES.length - 1), lo = Math.floor(hi);
  const p = {x: mix(chartPoint(lo).x, chartPoint(Math.min(lo + 1, SERIES.length - 1)).x, hi - lo), y: mix(chartPoint(lo).y, chartPoint(Math.min(lo + 1, SERIES.length - 1)).y, hi - lo)};
  const value = Math.round(mix(SERIES[lo], SERIES[Math.min(lo + 1, SERIES.length - 1)], hi - lo) * 1140);
  const tip = curves.punchOut(progress(t, U.hoverFrom - .1, .3));
  return <div style={{position: 'absolute', inset: 0, fontFamily: UI, color: INK}}>
    <div style={{position: 'absolute', right: 30, top: 28}}><Tabs compact/></div>
    <Counter to={84320} from={62000} start={U.chart + .1} duration={.9} fontFamily={UI} fontWeight={500} fontSize={64} letterSpacing={-.03} color={INK}
      style={{position: 'absolute', left: 36, top: 84}}/>
    <div style={{position: 'absolute', left: 38, top: 156, fontSize: 20, color: GRAY}}>total views</div>
    <svg width={CHART.w} height={CHART.h} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
      <defs><linearGradient id="reel-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={INK} stopOpacity={.12}/><stop offset="1" stopColor={INK} stopOpacity={0}/></linearGradient></defs>
      {[0, 1, 2].map(i => <line key={i} x1={CH.left} x2={CHART.w - CH.right} y1={CH.top + i * (CHART.h - CH.top - CH.bottom) / 2} y2={CH.top + i * (CHART.h - CH.top - CH.bottom) / 2}
        stroke="rgba(0,0,0,.06)" strokeWidth={1.5}/>)}
      <path d={area} fill="url(#reel-area)" opacity={draw}/>
      <path d={line} fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"/>
      {hover && <g opacity={tip}>
        <line x1={p.x} x2={p.x} y1={CH.top - 8} y2={CHART.h - CH.bottom} stroke="rgba(0,0,0,.25)" strokeWidth={1.5} strokeDasharray="4 5"/>
        <circle cx={p.x} cy={p.y} r={7} fill={INK} stroke={WHITE} strokeWidth={3}/>
      </g>}
    </svg>
    {hover && <div style={{position: 'absolute', left: p.x, top: p.y - 58, transform: `translate(-50%, ${mix(8, 0, tip)}px)`, opacity: tip, background: INK, color: WHITE,
      fontFamily: MONO, fontSize: 17, padding: '6px 11px', borderRadius: 8, whiteSpace: 'pre'}}>{value.toLocaleString('en-US')}</div>}
  </div>;
}

const COMMANDS = [{label: 'New project', key: '⌘N', icon: 'M5 4h14v16H5z'}, {label: 'Export video', key: '⌘E', icon: 'M12 4v11|M7 10l5 5 5-5|M5 20h14'},
  {label: 'Frame rate · 60 fps', key: '', icon: 'M4 6h16v12H4z|M8 6v12|M16 6v12'}, {label: 'Motion blur', key: '', icon: 'M4 9h10|M4 15h16|M8 12h12'},
  {label: 'Every frame is code', key: '↵', icon: 'M8 7l-5 5 5 5|M16 7l5 5-5 5'}];
function Palette() {
  const t = useTime();
  const typed = useTyping({text: 'frame', start: U.typeFrom, end: U.typeTo, fontFamily: UI, fontSize: 24});
  const query = typed.text.toLowerCase();
  let row = 0;
  const rows = COMMANDS.map(c => {
    const match = !query || c.label.toLowerCase().includes(query), since = t - U.typeFrom;
    return {...c, match, index: match ? row++ : -1, since};
  });
  const selected = t >= U.pick ? 1 : 0;
  const highlight = springTo(t, [{at: 0, value: 0}, {at: U.pick, value: 1}], {duration: .35, bounce: .06});
  const top = (i: number) => 92 + i * 48;
  return <div style={{position: 'absolute', inset: 0, fontFamily: UI, color: INK}}>
    <div style={{position: 'absolute', left: 28, right: 28, top: 26, display: 'flex', alignItems: 'center', gap: 14, fontSize: 24}}>
      <Icon d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z|M16 16l4 4" size={24} color={INK} width={2.2}/>
      {typed.text ? <span>{typed.text}</span> : <span style={{color: '#b3b3b8'}}>Type a command</span>}
      <i style={{width: 2, height: 26, background: INK, opacity: Math.floor(t * 2.4) % 2 ? .25 : 1, marginLeft: -10}}/>
    </div>
    <div style={{position: 'absolute', left: 0, right: 0, top: 76, height: 1.5, background: 'rgba(0,0,0,.07)'}}/>
    {query && <div style={{position: 'absolute', left: 16, right: 16, top: mix(top(0), top(1), highlight) - 4, height: 44, borderRadius: 12,
      background: selected ? INK : 'rgba(0,0,0,.05)'}}/>}
    {rows.map((r, i) => {
      const shown = r.match ? 1 : 1 - curves.punchOut(progress(t, U.typeFrom + .12, .3));
      if (shown <= .01) return null;
      const y = r.match ? springTo(t, [{at: 0, value: top(i)}, {at: U.typeFrom + .12, value: top(r.index)}], {duration: .4, bounce: .05}) : top(i);
      // Text turns white only where the dark highlight actually sits behind it.
      const bar = mix(top(0), top(1), highlight) - 4, under = selected && query ? clamp(1 - Math.abs(bar + 4 - y) / 30) : 0;
      const ink = `color-mix(in srgb, ${WHITE} ${(under * 100).toFixed(0)}%, ${INK})`;
      return <div key={r.label} style={{position: 'absolute', left: 30, right: 30, top: y, height: 36, display: 'flex', alignItems: 'center', gap: 16,
        fontSize: 21, opacity: shown, color: ink}}>
        <Icon d={r.icon} size={20} color={under > .5 ? WHITE : '#6b6b70'} width={1.8}/>{r.label}
        <span style={{marginLeft: 'auto', fontFamily: MONO, fontSize: 15, color: under > .5 ? 'rgba(255,255,255,.7)' : '#a1a1a6'}}>{r.key}</span>
      </div>;
    })}
  </div>;
}

function Toast() {
  return <div style={{...center, gridAutoFlow: 'column', gap: 14, color: WHITE, fontFamily: UI, fontSize: 24, fontWeight: 500}}>
    <Icon d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z|M8 12l3 3 5-6" size={28} width={2.2}/>Film rendered
  </div>;
}

export const morphStates: MorphState[] = [
  {at: 13.9, width: 14, height: 14},
  {at: U.start, width: 280, height: 76, content: <Label text="Generate"/>},
  {at: U.press - .06, width: 268, height: 72, id: 'press'},
  {at: U.loader, width: 76, height: 76, content: <Loader/>},
  {at: U.check, width: 76, height: 76, content: <Check/>},
  {at: U.island, width: 380, height: 60, content: <Island/>},
  {at: U.player, width: PLAYER.w, height: PLAYER.h, radius: 40, content: <Player/>},
  {at: U.volume, width: VOLUME.w, height: VOLUME.h, content: <Volume/>, id: 'volume', fill: true},
  {at: U.over, width: VOLUME.w + 58, height: VOLUME.h - 6, id: 'volume'},
  {at: U.release, width: VOLUME.w, height: VOLUME.h, id: 'volume'},
  {at: U.toggle, width: 128, height: 68, color: '#c9c8c4', content: <Toggle/>, id: 'toggle'},
  {at: U.flip, width: 128, height: 68, color: INK, id: 'toggle'},
  {at: U.tabs, width: TABS.w, height: TABS.h, color: WHITE, content: <div style={{...center}}><Tabs/></div>},
  {at: U.chart, width: CHART.w, height: CHART.h, radius: 36, color: WHITE, content: <Chart/>},
  {at: U.palette, width: PALETTE.w, height: PALETTE.h, radius: 28, color: WHITE, content: <Palette/>, id: 'palette', fill: true},
  {at: U.typeFrom + .2, width: PALETTE.w, height: 196, radius: 28, color: WHITE, id: 'palette'},
  {at: U.toast, width: 400, height: 68, color: INK, content: <Toast/>},
  {at: U.back, width: 280, height: 76, color: INK, content: <Label text="Generate"/>},
];

/** The camera zooms so each state fills a good part of the frame; it springs from one framing to the next. */
function cameraScale(t: number) {
  const frame = {width: 1920, height: 1080};
  const keys = morphStates.filter(s => s.width > 20).map(s => ({at: s.at, value: Math.min(3.4, fitScale(s.width, s.height, frame, s.width > 400 ? .6 : .42))}));
  return springTo(t, keys, {duration: .75, bounce: .04});
}

export function InterfaceShot() {
  const t = useTime();
  return <AbsoluteFill style={{background: CANVAS}}>
    <CameraLayer camera={{x: 0, y: 0, scale: cameraScale(t)}}>
      <Morph states={morphStates} center={C} shadow={.5}/>
      <Cursor time={t} path={cursorPath} clicks={clicks} enter={14.05} exit={U.palette + .15} size={24} color={INK} outline={WHITE}/>
    </CameraLayer>
  </AbsoluteFill>;
}
