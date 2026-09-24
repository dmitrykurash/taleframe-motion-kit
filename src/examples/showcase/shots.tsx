import React, {useId} from 'react';
import {AbsoluteFill, Img, staticFile} from 'remotion';
import {Counter, Cursor, MaskReveal, WordRoll, arrive, curves, mix, progress, useTime, useTyping} from '../../kit';
import {anchors, look} from './look';

/** Showcase shots for a fictional release tool. Each is a full-stage, opaque scene that reads the
 * clock itself, so transitions and motion blur can sample it at any instant. `start` is the shot's cut-in. */
type ShotProps = {start: number};
const useLocal = (start: number) => useTime() - start;

function Logo({size = 44}: {size?: number}) {
  return <div style={{width: size, height: size, borderRadius: size * .28, background: look.orange, display: 'grid', placeItems: 'center'}}>
    <svg width={size * .52} height={size * .52} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h12M12 5l7 7-7 7"/>
    </svg>
  </div>;
}

/** Dark release dashboard with three release cards and a live chart. */
export function DashboardShot({start}: ShotProps) {
  const t = useLocal(start);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const push = 1 + .03 * curves.glide(progress(t, -.5, 4.5));
  const draw = curves.punchOut(progress(t, -.3, 2.2));
  const shipping = mix(.58, .86, curves.glide(progress(t, 0, 3)));
  const cards = [
    {version: 'v2.6', title: 'Draft', progress: .34, accent: false},
    {version: 'v2.5', title: 'Shipping', progress: shipping, accent: true},
    {version: 'v2.4', title: 'Live', progress: 1, accent: false},
  ];
  const nav = ['Overview', 'Releases', 'Changelog', 'Rollouts', 'Team'];
  const points = Array.from({length: 13}, (_, i) => {
    const x = i / 12, y = .78 - .5 * x - .12 * Math.sin(x * 7.5 + 1) + .05 * Math.sin(x * 23);
    return [48 + x * 1272, 40 + y * 300];
  });
  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return <AbsoluteFill style={{background: `radial-gradient(1200px 800px at 70% 20%, #1a1c24, ${look.ink})`, fontFamily: look.sans, color: '#fff'}}>
    <AbsoluteFill style={{transform: `scale(${push})`, transformOrigin: '60% 45%'}}>
      <div style={{position: 'absolute', left: 120, top: 70, width: 1680, height: 940, borderRadius: 32, background: '#101217',
        border: `1px solid ${look.line}`, boxShadow: '0 60px 120px rgba(0,0,0,.45)', overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 240, borderRight: `1px solid ${look.line}`, background: '#0e1014'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 14, padding: '36px 30px 40px'}}><Logo size={40}/><span style={{fontSize: 27, fontWeight: 700}}>Relay</span></div>
          {nav.map((item, i) => <div key={item} style={{margin: '4px 16px', padding: '14px 16px', borderRadius: 12, fontSize: 21,
            background: i === 1 ? 'rgba(255,255,255,.07)' : undefined, color: i === 1 ? '#fff' : look.mutedDark, display: 'flex', alignItems: 'center', gap: 14}}>
            <span style={{width: 14, height: 14, borderRadius: i % 2 ? 4 : 7, border: `2px solid ${i === 1 ? look.orange : '#5b606b'}`}}/>{item}</div>)}
        </div>
      </div>
      <div style={{position: 'absolute', left: 400, top: 118, fontSize: 60, fontWeight: 750, letterSpacing: '-.03em'}}>Releases</div>
      <div style={{position: 'absolute', left: 402, top: 200, fontSize: 22, color: look.mutedDark}}>Three in flight · updated just now</div>
      <div style={{position: 'absolute', left: 1556, top: 128, height: 58, width: 212, borderRadius: 29, background: look.orange,
        display: 'grid', placeItems: 'center', fontSize: 21, fontWeight: 650}}>New release</div>
      {cards.map((card, i) => <div key={card.version} style={{position: 'absolute', left: 400 + i * 464, top: 272, width: 440, height: 250,
        borderRadius: 24, background: card.accent ? look.orange : look.panel2, border: card.accent ? undefined : `1px solid ${look.line}`,
        padding: '30px 32px', boxSizing: 'border-box'}}>
        <div style={{fontSize: 20, opacity: .72}}>{card.version}</div>
        <div style={{fontSize: 46, fontWeight: 750, letterSpacing: '-.02em', marginTop: 14}}>{card.title}</div>
        <div style={{position: 'absolute', left: 32, right: 32, bottom: 40, height: 10, borderRadius: 5, background: 'rgba(255,255,255,.16)'}}>
          <div style={{width: `${card.progress * 100}%`, height: 10, borderRadius: 5, background: card.accent ? '#fff' : i === 2 ? '#48d597' : '#b8bcc6'}}/>
        </div>
        <div style={{position: 'absolute', right: 32, bottom: 62, fontSize: 20, opacity: .8, fontVariantNumeric: 'tabular-nums'}}>{Math.round(card.progress * 100)}%</div>
      </div>)}
      <div style={{position: 'absolute', left: 400, top: 552, width: 1368, height: 426, borderRadius: 24, background: look.panel,
        border: `1px solid ${look.line}`, overflow: 'hidden'}}>
        <div style={{position: 'absolute', left: 36, top: 30, fontSize: 22, color: look.mutedDark}}>Adoption · last 14 days</div>
        <div style={{position: 'absolute', right: 36, top: 24, fontSize: 34, fontWeight: 700, fontVariantNumeric: 'tabular-nums'}}>+{Math.round(mix(0, 48, draw))}%</div>
        <svg style={{position: 'absolute', left: 0, top: 70}} width="1368" height="356" viewBox="0 0 1368 356">
          <defs><linearGradient id={`${id}-fill`} x2="0" y2="1"><stop stopColor={look.orange} stopOpacity=".35"/><stop offset="1" stopColor={look.orange} stopOpacity="0"/></linearGradient>
            <clipPath id={`${id}-draw`}><rect x="0" y="0" width={48 + 1272 * draw} height="356"/></clipPath></defs>
          {[0, 1, 2, 3].map(k => <path key={k} d={`M48 ${60 + k * 80}H1320`} stroke="rgba(255,255,255,.06)"/>)}
          <g clipPath={`url(#${id}-draw)`}>
            <path d={`${line} L1320 356 L48 356 Z`} fill={`url(#${id}-fill)`}/>
            <path d={line} fill="none" stroke={look.orange} strokeWidth="5" strokeLinejoin="round"/>
          </g>
        </svg>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>;
}

/** Full-frame type card with one idea. Loud colors, very heavy weight, tight tracking. */
export function SlamShot({start, text, background = look.lime, color = look.ink, size = 330}: ShotProps & {text: string; background?: string; color?: string; size?: number}) {
  const t = useLocal(start);
  return <AbsoluteFill style={{background, display: 'grid', placeItems: 'center'}}>
    <div style={{transform: `scale(${1 + .035 * curves.glide(progress(t, 0, 2.2))})`, fontFamily: look.sans, fontSize: size,
      fontWeight: 1000, letterSpacing: '-.055em', color, lineHeight: 1, whiteSpace: 'pre'}}>{text}</div>
  </AbsoluteFill>;
}

/** Light composer: a request is typed and published. The Publish button sits at anchors.publishButton. */
export function ComposerShot({start, typeFrom = .15, typeTo = 1.35, clickAt = 1.9}: ShotProps & {typeFrom?: number; typeTo?: number; clickAt?: number}) {
  const t = useLocal(start);
  const typing = useTyping({text: 'Ship v2.5 to everyone at 9:00', start: start + typeFrom, end: start + typeTo,
    fontFamily: look.sans, fontSize: 48});
  const b = anchors.publishButton;
  const press = Math.max(0, 1 - Math.abs(t - clickAt) / .1);
  const hover = t > clickAt - .35;
  const enter = arrive(t, -.4, .7);
  return <AbsoluteFill style={{background: look.paper, fontFamily: look.sans, color: look.ink}}>
    <div style={{position: 'absolute', left: 330, top: 372, width: 1260, height: 320, borderRadius: 36, background: look.card,
      boxShadow: '0 40px 90px rgba(30,25,15,.12), 0 2px 0 rgba(30,25,15,.04)', transform: `translateY(${30 * (1 - enter)}px)`}}>
      <div style={{position: 'absolute', left: 60, top: 64, fontSize: 48, letterSpacing: '-.01em', whiteSpace: 'pre'}}>
        {typing.text}<span style={{display: 'inline-block', width: 3, height: 50, marginLeft: 4, verticalAlign: '-.14em',
          background: look.orange, opacity: t < typeTo + .1 || Math.floor(t * 2.2) % 2 === 0 ? 1 : 0}}/>
      </div>
      {['Release notes', 'Changelog'].map((chip, i) => <div key={chip} style={{position: 'absolute', left: 60 + i * 238, top: 214, height: 60,
        padding: '0 26px', borderRadius: 30, border: `1.5px solid ${look.lineLight}`, display: 'flex', alignItems: 'center', gap: 12,
        fontSize: 22, color: look.mutedLight}}><span style={{width: 12, height: 12, borderRadius: 3, background: i ? look.blue : look.orange}}/>{chip}</div>)}
    </div>
    <div style={{position: 'absolute', left: b.x, top: b.y + 30 * (1 - enter), width: b.width, height: b.height, borderRadius: b.radius,
      background: hover ? look.orange : look.ink, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 25, fontWeight: 650,
      transform: `scale(${1 - .06 * press})`}}>Publish</div>
    <Cursor time={t} enter={clickAt - .95} clicks={[clickAt]} size={34} path={[
      {time: clickAt - .95, x: 1180, y: 820}, {time: clickAt - .15, x: b.x + b.width / 2 - 8, y: b.y + b.height / 2 - 6},
      {time: clickAt + 1, x: b.x + b.width / 2 - 8, y: b.y + b.height / 2 - 6}]}/>
  </AbsoluteFill>;
}

/** What the click produced: the result owns the frame. */
export function LiveShot({start}: ShotProps) {
  return <AbsoluteFill style={{background: look.orange, fontFamily: look.sans, color: '#fff', padding: '0 150px', justifyContent: 'center'}}>
    <MaskReveal lines={['Live.']} start={start + .2} by="character" stagger={.035} duration={.7} fontSize={420} fontWeight={1000}
      letterSpacing={-.06} lineHeight={.86} color="#fff"/>
    <div style={{marginTop: 26}}>
      <MaskReveal lines={['48,210 people. 12 seconds.']} start={start + .45} fontSize={64} fontWeight={600} letterSpacing={-.02} color="rgba(255,255,255,.86)"/>
    </div>
  </AbsoluteFill>;
}

/** A single number that carries the claim. */
export function StatShot({start}: ShotProps) {
  return <AbsoluteFill style={{background: look.paper, fontFamily: look.sans, color: look.ink, padding: '0 150px', justifyContent: 'center'}}>
    <Counter from={1} to={3} decimals={1} suffix="×" start={start + .05} duration={1.1} fontSize={500} fontWeight={1000} letterSpacing={-.06} color={look.ink}/>
    <div style={{marginTop: -10, marginLeft: 12}}>
      <MaskReveal lines={['faster release cycles']} start={start + .25} fontSize={72} fontWeight={650} letterSpacing={-.025} color={look.mutedLight}/>
    </div>
  </AbsoluteFill>;
}

function Tile({x, y, width, height, children, accent}: {x: number; y: number; width: number; height: number; children?: React.ReactNode; accent?: boolean}) {
  return <div style={{position: 'absolute', left: x, top: y, width, height, borderRadius: 28, background: accent ? look.orange : look.panel,
    border: accent ? undefined : `1px solid ${look.line}`, overflow: 'hidden', padding: 36, boxSizing: 'border-box'}}>{children}</div>;
}

/** Bento grid of product details. The chart tile sits at anchors.chartTile. */
export function GridShot({start}: ShotProps) {
  const t = useLocal(start);
  const ring = curves.punchOut(progress(t, -.2, 1.4));
  const c = anchors.chartTile;
  const spark = Array.from({length: 20}, (_, i) => `${i ? 'L' : 'M'}${(i / 19 * 552).toFixed(1)} ${(150 - 90 * (i / 19) - 26 * Math.sin(i * .9) + 8 * Math.sin(i * 2.7 + t * 3)).toFixed(1)}`).join(' ');
  return <AbsoluteFill style={{background: look.ink, fontFamily: look.sans, color: '#fff'}}>
    <Tile x={60} y={60} width={564} height={936}>
      <div style={{fontSize: 24, color: look.mutedDark}}>Release health</div>
      <svg width="420" height="420" viewBox="0 0 420 420" style={{position: 'absolute', left: 72, top: 230}}>
        <circle cx="210" cy="210" r="170" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="34"/>
        <circle cx="210" cy="210" r="170" fill="none" stroke={look.lime} strokeWidth="34" strokeLinecap="round"
          strokeDasharray={`${2 * Math.PI * 170 * .98 * ring} 2000`} transform="rotate(-90 210 210)"/>
      </svg>
      <div style={{position: 'absolute', left: 0, right: 0, top: 380, textAlign: 'center', fontSize: 110, fontWeight: 900, letterSpacing: '-.04em'}}>{Math.round(98 * ring)}%</div>
      <div style={{position: 'absolute', left: 36, bottom: 40, fontSize: 24, color: look.mutedDark}}>0 rollbacks this week</div>
    </Tile>
    <Tile x={648} y={60} width={564} height={351}>
      <div style={{fontSize: 24, color: look.mutedDark}}>Auto-rollback</div>
      <div style={{position: 'absolute', left: 36, bottom: 44, fontSize: 52, fontWeight: 750, letterSpacing: '-.02em'}}>On</div>
      <div style={{position: 'absolute', right: 40, bottom: 48, width: 118, height: 66, borderRadius: 33, background: look.orange, padding: 7, boxSizing: 'border-box'}}>
        <div style={{width: 52, height: 52, borderRadius: 26, background: '#fff', marginLeft: 52}}/></div>
    </Tile>
    <Tile x={c.x} y={c.y} width={c.width} height={c.height}>
      <div style={{fontSize: 24, color: look.mutedDark}}>Adoption</div>
      <div style={{position: 'absolute', right: 36, top: 30, fontSize: 40, fontWeight: 750}}>+48%</div>
      <svg width="552" height="190" viewBox="0 0 552 190" style={{position: 'absolute', left: 36, bottom: 30}}>
        <path d={spark} fill="none" stroke={look.orange} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </Tile>
    <Tile x={648} y={435} width={564} height={585}>
      <div style={{fontSize: 24, color: look.mutedDark}}>Reviews</div>
      <div style={{display: 'flex', marginTop: 150}}>{['#ffb36b', '#8fa7ff', '#b7f09a', '#f59bc7', '#ffe07a'].map((color, i) =>
        <div key={color} style={{width: 96, height: 96, borderRadius: 48, background: color, border: `6px solid ${look.panel}`, marginLeft: i ? -26 : 0}}/>)}</div>
      <div style={{position: 'absolute', left: 36, bottom: 44, fontSize: 52, fontWeight: 750, letterSpacing: '-.02em'}}>12 approved</div>
    </Tile>
    <Tile x={1236} y={435} width={624} height={585} accent>
      <div style={{fontSize: 24, opacity: .85}}>Regions</div>
      <div style={{position: 'absolute', left: 32, bottom: 20, fontSize: 300, fontWeight: 1000, letterSpacing: '-.06em', lineHeight: 1}}>48</div>
    </Tile>
  </AbsoluteFill>;
}

/** Terminal with a deploy streaming in. */
export function TerminalShot({start}: ShotProps) {
  const t = useLocal(start);
  const typing = useTyping({text: 'relay ship v2.5 --everyone', start: start + .05, end: start + .75, fontFamily: look.mono, fontSize: 38});
  const lines = [['✓', 'build', '1.8s'], ['✓', 'tests', '412 passed'], ['✓', 'canary', '5% → 25% → 100%'], ['→', 'shipping', '48 regions']];
  const bar = curves.glide(progress(t, 1.45, 1.6));
  return <AbsoluteFill style={{background: look.ink, fontFamily: look.mono, color: '#e8e9ec'}}>
    <div style={{position: 'absolute', left: 190, top: 140, width: 1540, height: 800, borderRadius: 26, background: '#0f1115',
      border: `1px solid ${look.line}`, boxShadow: '0 60px 140px rgba(0,0,0,.6)', overflow: 'hidden'}}>
      <div style={{height: 64, borderBottom: `1px solid ${look.line}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 26px'}}>
        {['#ff5f57', '#febc2e', '#28c840'].map(color => <i key={color} style={{width: 15, height: 15, borderRadius: 8, background: color}}/>)}
        <span style={{marginLeft: 20, fontSize: 20, color: look.mutedDark, fontFamily: look.sans}}>relay — deploy</span>
      </div>
      <div style={{padding: '54px 64px', fontSize: 38, lineHeight: 1.75, whiteSpace: 'pre'}}>
        <div><span style={{color: look.lime}}>$ </span>{typing.text}<span style={{display: 'inline-block', width: 20, height: 40, verticalAlign: '-.12em',
          background: '#e8e9ec', opacity: Math.floor(t * 2.4) % 2 === 0 ? .9 : 0}}/></div>
        {lines.map(([mark, label, value], i) => t >= .95 + i * .18 && <div key={label}>
          <span style={{color: mark === '✓' ? '#48d597' : look.orange}}>{mark} </span>{label.padEnd(12, ' ')}<span style={{color: look.mutedDark}}>{value}</span></div>)}
        <div style={{marginTop: 26, height: 14, width: 1180, borderRadius: 7, background: 'rgba(255,255,255,.08)', opacity: t > 1.45 ? 1 : 0}}>
          <div style={{height: 14, width: `${bar * 100}%`, borderRadius: 7, background: look.orange}}/></div>
      </div>
    </div>
  </AbsoluteFill>;
}

/** Black type card with a rolling word. `composed` starts with the first word already in place,
 * for an arrival (such as a glitch cut) that should hit a finished frame. */
export function RollShot({start, words = ['speed.', 'scale.', 'everyone.'], composed = false}: ShotProps & {words?: string[]; composed?: boolean}) {
  const first = composed ? start - 2 : start + .12;
  return <AbsoluteFill style={{background: '#050506', fontFamily: look.sans, color: '#fff', padding: '0 150px', justifyContent: 'center'}}>
    <MaskReveal lines={['Built for']} start={composed ? start - 2 : start + .02} fontSize={120} fontWeight={650} letterSpacing={-.03} color="rgba(255,255,255,.62)"/>
    <WordRoll words={words} at={words.map((_, i) => i === 0 ? first : start + (composed ? .35 : .12) + i * .62)} fontSize={300} fontWeight={1000} letterSpacing={-.055}
      color="#fff" rollColor={look.lime} style={{marginTop: 4}}/>
  </AbsoluteFill>;
}

/** Photograph-like plate with an editorial line. */
export function PlateShot({start, line}: ShotProps & {line?: string}) {
  const t = useLocal(start);
  return <AbsoluteFill style={{background: '#223'}}>
    <AbsoluteFill style={{transform: `scale(${1.04 + .05 * curves.glide(progress(t, -.3, 4))})`}}>
      <Img src={staticFile('demo/landscape-b.svg')} style={{width: '100%', height: '100%', objectFit: 'cover'}}/>
    </AbsoluteFill>
    <AbsoluteFill style={{background: 'linear-gradient(0deg, rgba(10,14,20,.55), rgba(10,14,20,0) 55%)'}}/>
    {line && <div style={{position: 'absolute', left: 140, bottom: 120}}>
      <MaskReveal lines={[line]} start={start + .15} fontFamily={look.serif} fontWeight={400} fontSize={128} letterSpacing={-.01} color="#fff"/>
    </div>}
  </AbsoluteFill>;
}

