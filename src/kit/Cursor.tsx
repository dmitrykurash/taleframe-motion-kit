import React from 'react';
import {arrive, ease, mix, progress, travel} from './motion';
import {useTime} from './text';

export type CursorPoint = {time: number; x: number; y: number};
export function cursorAt(time: number, path: readonly CursorPoint[]): {x: number; y: number} {
  if (!path.length) return {x: 0, y: 0};
  if (time <= path[0].time) return path[0];
  for (let i = 1; i < path.length; i++) {
    const previous = path[i - 1], next = path[i];
    if (next.time <= previous.time) throw new Error('Cursor points need strictly increasing times; repeat positions for a dwell.');
    if (time <= next.time) {
      const p = ease(progress(time, previous.time, next.time - previous.time));
      return {x: mix(previous.x, next.x, p), y: mix(previous.y, next.y, p)};
    }
  }
  return path[path.length - 1];
}

/** Put the cursor inside the same CameraLayer as the UI so clicks remain registered. */
export function Cursor({path, clicks = [], time, enter = 0, exit = Infinity, size = 30,
  color = '#252525', outline = '#fff'}: {path: readonly CursorPoint[]; clicks?: readonly number[];
  time?: number; enter?: number; exit?: number; size?: number; color?: string; outline?: string}) {
  const clock = useTime(), t = time ?? clock, point = cursorAt(t, path);
  const press = Math.max(0, ...clicks.map(click => Math.max(0, 1 - Math.abs(t - click) / .12)));
  return <svg aria-hidden viewBox="0 0 26 34" width={size} height={size * 34 / 26}
    style={{position: 'absolute', left: point.x, top: point.y, overflow: 'visible',
      opacity: arrive(t, enter, .2) * (1 - travel(t, exit, .2)), transformOrigin: '0 0',
      transform: `scale(${1 - press * .12})`, pointerEvents: 'none'}}>
    <path d="M2 1.8v25.1l6.5-6.1 5.2 11 4.4-2.1-5.2-10.6h9.3L2 1.8Z" fill={color} stroke={outline} strokeWidth="1.65" strokeLinejoin="round"/>
  </svg>;
}
