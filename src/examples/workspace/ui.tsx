import React from 'react';
import {fonts, type WorkspaceTheme} from './theme';

/** UI for the demo product, an unnamed desktop AI workspace. Every component is stateless: films derive
 * hover, press, typing, and progress from time and pass them in. Sizes are logical stage pixels. */

const paths = {
  compose: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z'],
  search: ['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z', 'M20 20l-3.6-3.6'],
  folder: ['M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z'],
  chat: ['M20.5 11.6a8 8 0 0 1-11.7 7.1L4 20l1.3-4.5A8 8 0 1 1 20.5 11.6Z'],
  plus: ['M12 5v14', 'M5 12h14'],
  globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M3.5 12h17', 'M12 3.2c2.4 2.4 3.6 5.3 3.6 8.8s-1.2 6.4-3.6 8.8c-2.4-2.4-3.6-5.3-3.6-8.8S9.6 5.6 12 3.2Z'],
  spark: ['M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9Z', 'M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7Z'],
  arrowUp: ['M12 19V5', 'M5.5 11.5 12 5l6.5 6.5'],
  file: ['M14 3H7.5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V7.5Z', 'M14 3v4.5h4.5'],
  check: ['M5 12.5l4.3 4.3L19 7'],
  terminal: ['M5 17l5-5-5-5', 'M12.5 18.5h6.5'],
  pencil: ['M15.5 4.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z'],
  read: ['M4 18.5V6a2.5 2.5 0 0 1 2.5-2.5H20v14H6.5A2.5 2.5 0 0 0 4 20Z', 'M4 20a2.5 2.5 0 0 0 2.5 2.5H20'],
  chevronDown: ['M6 9.5l6 6 6-6'],
  chevronRight: ['M9.5 6l6 6-6 6'],
  sliders: ['M4 7h10', 'M18 7h2', 'M16 5v4', 'M4 17h4', 'M12 17h8', 'M10 15v4'],
} as const;
export type IconName = keyof typeof paths;

export function Icon({name, size = 22, color = 'currentColor', stroke = 1.8, style}: {name: IconName; size?: number; color?: string; stroke?: number; style?: React.CSSProperties}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke}
    strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0, display: 'block', ...style}}>
    {paths[name].map((d, i) => <path key={i} d={d}/>)}
  </svg>;
}

/** Words visible after `p` of the text has streamed in; the newest word fades up. */
export function Streamed({text, p, style}: {text: string; p: number; style?: React.CSSProperties}) {
  const words = text.split(/(\s+)/);
  const count = words.filter(w => w.trim()).length;
  const shown = Math.max(0, Math.min(count, p * count));
  let seen = 0;
  return <span style={style}>{words.map((w, i) => {
    if (!w.trim()) return seen < shown ? <span key={i}>{w}</span> : null;
    const index = seen++;
    const o = Math.max(0, Math.min(1, shown - index));
    return o > 0 ? <span key={i} style={{opacity: o}}>{w}</span> : null;
  })}</span>;
}

export type Frame = {x: number; y: number; width: number; height: number};

/** Window with traffic lights and a centered title. `sidebar` and `children` fill it. */
export function AppWindow({theme, frame, title, sidebar, sidebarWidth = 312, children, style}: {theme: WorkspaceTheme; frame: Frame; title?: string;
  sidebar?: React.ReactNode; sidebarWidth?: number; children?: React.ReactNode; style?: React.CSSProperties}) {
  return <div style={{position: 'absolute', left: frame.x, top: frame.y, width: frame.width, height: frame.height, borderRadius: 28,
    background: theme.window, boxShadow: theme.shadow, overflow: 'hidden', fontFamily: fonts.sans, color: theme.text, ...style}}>
    {sidebar && <div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: sidebarWidth, background: theme.sidebar,
      borderRight: `1px solid ${theme.hairline}`}}>{sidebar}</div>}
    <div style={{position: 'absolute', left: 26, top: 22, display: 'flex', gap: 9}}>
      {['#ff5f57', '#febc2e', '#28c840'].map(color => <i key={color} style={{width: 13, height: 13, borderRadius: 7, background: color}}/>)}
    </div>
    {title && <div style={{position: 'absolute', left: sidebar ? sidebarWidth : 0, right: 0, top: 17, textAlign: 'center', fontSize: 18,
      color: theme.secondary, fontWeight: 500}}>{title}</div>}
    <div style={{position: 'absolute', left: sidebar ? sidebarWidth : 0, right: 0, top: 0, bottom: 0}}>{children}</div>
  </div>;
}

export type SidebarRow = {id: string; label: string; icon?: IconName; depth?: number; active?: boolean; hover?: boolean;
  open?: boolean; dy?: number; opacity?: number; highlight?: number};

/** Rows sit on a 46 px grid starting at `top`; `dy` and `opacity` let a film move one of them. */
export function Sidebar({theme, rows, top = 150, search, searchFocus = false, searchText = ''}: {theme: WorkspaceTheme;
  rows: readonly SidebarRow[]; top?: number; search?: boolean; searchFocus?: boolean; searchText?: string}) {
  return <div style={{position: 'absolute', inset: 0, fontSize: 20}}>
    <div style={{position: 'absolute', left: 18, right: 18, top: 62, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center',
      gap: 12, padding: '0 14px', color: theme.text}}><Icon name="compose" size={21}/>New chat</div>
    <div style={{position: 'absolute', left: 18, right: 18, top: 108 - (search ? 0 : 0), height: 42, borderRadius: 12, display: 'flex',
      alignItems: 'center', gap: 12, padding: '0 14px', color: searchText ? theme.text : theme.secondary,
      background: searchFocus ? theme.window : 'transparent', boxShadow: searchFocus ? `0 0 0 1px ${theme.hairline}` : undefined}}>
      <Icon name="search" size={20}/>{searchText || 'Search'}{searchFocus && <i style={{width: 2, height: 22, background: theme.accent, marginLeft: -8}}/>}
    </div>
    {rows.map((row, i) => <div key={row.id} style={{position: 'absolute', left: 18 + (row.depth ?? 0) * 26, right: 18,
      top: top + i * 46 + (row.dy ?? 0), height: 42, borderRadius: 11, display: 'flex', alignItems: 'center', gap: 11, padding: '0 14px',
      opacity: row.opacity ?? 1, color: row.active ? theme.text : theme.secondary, fontWeight: row.active ? 550 : 450,
      background: row.active ? theme.selected : row.hover ? theme.selected : row.highlight ? theme.accentSoft : 'transparent',
      boxShadow: row.highlight ? `0 0 0 ${1.5 * row.highlight}px ${theme.accent}` : undefined, whiteSpace: 'nowrap'}}>
      {row.icon === 'folder' && <Icon name={row.open ? 'chevronDown' : 'chevronRight'} size={15} stroke={2.2} style={{marginLeft: -6, marginRight: -4}}/>}
      {row.icon && <Icon name={row.icon} size={20}/>}{row.label}
    </div>)}
    <div style={{position: 'absolute', left: 32, bottom: 30, display: 'flex', alignItems: 'center', gap: 14, color: theme.secondary}}>
      <div style={{width: 36, height: 36, borderRadius: 18, background: theme.dark ? '#2a2a31' : '#e3e3e8', display: 'grid', placeItems: 'center',
        fontSize: 15, fontWeight: 600, color: theme.text}}>JL</div>
      <span style={{fontSize: 19}}>Jamie Lee</span>
      <Icon name="sliders" size={20} style={{marginLeft: 'auto'}}/>
    </div>
  </div>;
}

export type ButtonState = 'idle' | 'hover' | 'press' | 'disabled';
const pressScale = (state: ButtonState) => (state === 'press' ? .92 : 1);

/** The composer: attachment chip, text with caret, tool toggles, and the send button. */
export function Composer({theme, frame, text, placeholder = 'Ask anything', caret = false, attachment, search = false, agent = false,
  send = 'idle', searchState = 'idle', agentState = 'idle', lift = 0}: {theme: WorkspaceTheme; frame: Frame; text?: string; placeholder?: string;
  caret?: boolean; attachment?: {name: string; meta: string; progress?: number}; search?: boolean; agent?: boolean; send?: ButtonState;
  searchState?: ButtonState; agentState?: ButtonState; lift?: number}) {
  const toggle = (on: boolean, state: ButtonState, icon: IconName, label: string) => <div style={{height: 44, borderRadius: 22, padding: '0 18px 0 14px',
    display: 'flex', alignItems: 'center', gap: 9, fontSize: 19, fontWeight: 500, transform: `scale(${pressScale(state)})`,
    color: on ? theme.accent : theme.secondary, background: on ? theme.accentSoft : state === 'hover' ? theme.selected : 'transparent',
    boxShadow: on ? undefined : `inset 0 0 0 1px ${theme.hairline}`}}><Icon name={icon} size={20}/>{label}</div>;
  const empty = !text;
  return <div style={{position: 'absolute', left: frame.x, top: frame.y, width: frame.width, minHeight: frame.height, borderRadius: 28,
    background: theme.composer, boxShadow: `0 ${10 + 20 * lift}px ${40 + 40 * lift}px rgba(0,0,0,${theme.dark ? .45 : .07 + .05 * lift}), inset 0 0 0 1px ${theme.hairline}`,
    fontFamily: fonts.sans, color: theme.text, boxSizing: 'border-box', padding: '22px 22px 18px'}}>
    {attachment && <div style={{display: 'inline-flex', alignItems: 'center', gap: 14, padding: '10px 18px 10px 10px', borderRadius: 16,
      background: theme.bubble, marginBottom: 16, opacity: attachment.progress ?? 1, transform: `translateY(${10 * (1 - (attachment.progress ?? 1))}px)`}}>
      <div style={{width: 44, height: 44, borderRadius: 11, background: theme.dark ? '#26262c' : '#ffffff', display: 'grid', placeItems: 'center',
        color: theme.accent, boxShadow: `inset 0 0 0 1px ${theme.hairline}`}}><Icon name="file" size={22}/></div>
      <div><div style={{fontSize: 19, fontWeight: 550}}>{attachment.name}</div><div style={{fontSize: 16, color: theme.secondary, marginTop: 2}}>{attachment.meta}</div></div>
    </div>}
    <div style={{fontSize: 26, lineHeight: 1.4, minHeight: 36, padding: '0 6px', whiteSpace: 'pre-wrap', color: empty ? theme.tertiary : theme.text}}>
      {empty ? (caret ? '' : placeholder) : text}
      {caret && <i style={{display: 'inline-block', width: 2.5, height: 30, marginLeft: 2, verticalAlign: '-6px', background: theme.accent}}/>}
      {empty && caret && <span style={{color: theme.tertiary, marginLeft: 4}}>{placeholder}</span>}
    </div>
    <div style={{display: 'flex', alignItems: 'center', gap: 10, marginTop: 18}}>
      <div style={{width: 44, height: 44, borderRadius: 22, display: 'grid', placeItems: 'center', color: theme.secondary,
        boxShadow: `inset 0 0 0 1px ${theme.hairline}`}}><Icon name="plus" size={21}/></div>
      {toggle(search, searchState, 'globe', 'Search')}
      {toggle(agent, agentState, 'spark', 'Agent')}
      <div style={{marginLeft: 'auto', width: 48, height: 48, borderRadius: 24, display: 'grid', placeItems: 'center',
        background: empty || send === 'disabled' ? (theme.dark ? '#2a2a30' : '#d9d9de') : send === 'hover' || send === 'press' ? theme.accent : theme.control,
        color: theme.controlText, transform: `scale(${pressScale(send)})`}}><Icon name="arrowUp" size={24} stroke={2.2}/></div>
    </div>
  </div>;
}

export function UserMessage({theme, text, style}: {theme: WorkspaceTheme; text: string; style?: React.CSSProperties}) {
  return <div style={{display: 'flex', justifyContent: 'flex-end', fontFamily: fonts.sans, color: theme.text, ...style}}>
    <div style={{maxWidth: '76%', padding: '16px 24px', borderRadius: 24, background: theme.bubble, fontSize: 25, lineHeight: 1.45}}>{text}</div>
  </div>;
}

export type Block = {kind: 'heading' | 'text' | 'item'; text: string; index?: number};

/** An answer streaming in: heading, paragraphs, and numbered points. `p` is 0–1 across all words. */
export function Answer({theme, blocks, p, style}: {theme: WorkspaceTheme; blocks: readonly Block[]; p: number; style?: React.CSSProperties}) {
  const counts = blocks.map(b => b.text.split(/\s+/).filter(Boolean).length);
  const total = counts.reduce((a, b) => a + b, 0);
  let before = 0;
  return <div style={{fontSize: 25, lineHeight: 1.5, fontFamily: fonts.sans, color: theme.text, ...style}}>{blocks.map((block, i) => {
    const local = Math.max(0, Math.min(1, (p * total - before) / counts[i]));
    before += counts[i];
    if (local <= 0) return null;
    const text = <Streamed text={block.text} p={local}/>;
    if (block.kind === 'heading') return <div key={i} style={{fontSize: 27, fontWeight: 620, marginBottom: 14}}>{text}</div>;
    if (block.kind === 'item') return <div key={i} style={{display: 'flex', gap: 16, margin: '10px 0'}}>
      <span style={{color: theme.tertiary, fontVariantNumeric: 'tabular-nums', minWidth: 20}}>{block.index}.</span><span>{text}</span></div>;
    return <div key={i} style={{color: theme.secondary, margin: '8px 0'}}>{text}</div>;
  })}</div>;
}

export function FileCard({theme, name, meta, style}: {theme: WorkspaceTheme; name: string; meta: string; style?: React.CSSProperties}) {
  return <div style={{display: 'inline-flex', alignItems: 'center', gap: 16, padding: '14px 26px 14px 14px', borderRadius: 20,
    background: theme.window, boxShadow: `0 6px 18px rgba(0,0,0,${theme.dark ? .2 : .04}), inset 0 0 0 1px ${theme.hairline}`, fontFamily: fonts.sans, ...style}}>
    <div style={{width: 56, height: 56, borderRadius: 14, background: theme.accentSoft, color: theme.accent, display: 'grid', placeItems: 'center'}}>
      <Icon name="file" size={28}/></div>
    <div><div style={{fontSize: 22, fontWeight: 560, color: theme.text}}>{name}</div><div style={{fontSize: 17, color: theme.secondary, marginTop: 3}}>{meta}</div></div>
  </div>;
}

export type Source = {title: string; domain: string; tint: string};
/** Sources used for an answer; each slides in after the previous one. */
export function Sources({theme, items, p, style}: {theme: WorkspaceTheme; items: readonly Source[]; p: number; style?: React.CSSProperties}) {
  return <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, fontFamily: fonts.sans, color: theme.text, ...style}}>{items.map((item, i) => {
    const e = Math.max(0, Math.min(1, p * items.length - i));
    return <div key={item.domain} style={{display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 18,
      background: theme.bubble, opacity: e, transform: `translateY(${14 * (1 - e)}px)`}}>
      <div style={{width: 34, height: 34, borderRadius: 10, background: item.tint, color: '#fff', display: 'grid', placeItems: 'center',
        fontSize: 16, fontWeight: 700}}>{item.domain[0].toUpperCase()}</div>
      <div style={{minWidth: 0}}><div style={{fontSize: 19, fontWeight: 550, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{item.title}</div>
        <div style={{fontSize: 16, color: theme.secondary, marginTop: 2}}>{item.domain}</div></div>
    </div>;
  })}</div>;
}

export type StepStatus = 'waiting' | 'running' | 'done';
/** One agent action: read, edit, or run. */
export function AgentStep({theme, kind, target, status, diff, style}: {theme: WorkspaceTheme; kind: 'read' | 'edit' | 'run'; target: string;
  status: StepStatus; diff?: [number, number]; style?: React.CSSProperties}) {
  const verb = {read: 'Read', edit: 'Edited', run: 'Ran'}[kind];
  const icon: IconName = kind === 'read' ? 'read' : kind === 'edit' ? 'pencil' : 'terminal';
  return <div style={{display: 'flex', alignItems: 'center', gap: 16, fontSize: 22, color: theme.secondary, fontFamily: fonts.sans, ...style}}>
    <div style={{width: 36, height: 36, borderRadius: 18, display: 'grid', placeItems: 'center',
      background: status === 'done' ? theme.successSoft : theme.bubble, color: status === 'done' ? theme.success : theme.secondary}}>
      <Icon name={status === 'done' ? 'check' : icon} size={19} stroke={2.2}/></div>
    <span style={{color: theme.text, fontWeight: 540}}>{status === 'running' ? {read: 'Reading', edit: 'Editing', run: 'Running'}[kind] : verb}</span>
    <span style={{fontFamily: fonts.mono, fontSize: 20, padding: '4px 10px', borderRadius: 8, background: theme.code}}>{target}</span>
    {diff && <span style={{fontFamily: fonts.mono, fontSize: 19}}><span style={{color: theme.success}}>+{diff[0]}</span> <span style={{color: '#e5484d'}}>−{diff[1]}</span></span>}
  </div>;
}

/** Permission request for one agent action, with Deny and Allow. */
export function Permission({theme, command, allow = 'idle', decided = false, style}: {theme: WorkspaceTheme; command: string;
  allow?: ButtonState; decided?: boolean; style?: React.CSSProperties}) {
  return <div style={{borderRadius: 22, padding: 24, background: theme.window, boxShadow: `0 18px 50px rgba(0,0,0,${theme.dark ? .5 : .09}), inset 0 0 0 1px ${theme.hairline}`,
    fontFamily: fonts.sans, ...style}}>
    <div style={{fontSize: 21, color: theme.text, fontWeight: 560}}>Allow the agent to run this command?</div>
    <div style={{marginTop: 14, fontFamily: fonts.mono, fontSize: 21, padding: '12px 16px', borderRadius: 12, background: theme.code, color: theme.text}}>{command}</div>
    <div style={{display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 18}}>
      <div style={{height: 46, padding: '0 22px', borderRadius: 23, display: 'grid', placeItems: 'center', fontSize: 19, color: theme.secondary,
        boxShadow: `inset 0 0 0 1px ${theme.hairline}`}}>Deny</div>
      <div style={{height: 46, padding: '0 24px', borderRadius: 23, display: 'flex', alignItems: 'center', gap: 8, fontSize: 19, fontWeight: 560,
        background: decided ? theme.success : allow === 'hover' || allow === 'press' ? theme.accent : theme.control,
        color: decided ? '#fff' : theme.controlText, transform: `scale(${pressScale(allow)})`}}>
        {decided && <Icon name="check" size={19} stroke={2.4}/>}{decided ? 'Allowed' : 'Allow once'}</div>
    </div>
  </div>;
}

/** Positions of the Allow button inside a Permission card of the given frame (for cursor aim and transitions). */
export function allowButtonRect(card: Frame) {
  return {x: card.x + card.width - 24 - 146, y: card.y + card.height - 24 - 46, width: 146, height: 46, radius: 23};
}

export function Result({theme, text, style}: {theme: WorkspaceTheme; text: string; style?: React.CSSProperties}) {
  return <div style={{display: 'inline-flex', alignItems: 'center', gap: 14, padding: '14px 22px 14px 16px', borderRadius: 18,
    background: theme.successSoft, color: theme.success, fontSize: 22, fontWeight: 580, fontFamily: fonts.sans, ...style}}>
    <Icon name="check" size={22} stroke={2.4}/>{text}</div>;
}
