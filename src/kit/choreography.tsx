import React, {createContext, useContext} from 'react';
import {AbsoluteFill} from 'remotion';
import {useStage} from './camera';
import {ClockScale, TimeShift, useTime} from './clock';
import {ease, mix, progress} from './motion';
import {drift, impact, rampRate, rampTime, shake, type RampKey} from './moves';
import {poseAt, poseStyle, unitOf, type PresetName} from './presets';

export type EnterProps = {
  /** Motion preset for the entrance (see PRESETS). Default 'rise'. */
  preset?: PresetName;
  start?: number;
  duration?: number;
  exit?: PresetName;
  exitAt?: number;
  exitDuration?: number;
  /** Logical px per pose unit: how far a 'slide' or 'drop' travels. Default 80. */
  distance?: number;
  /** Index among siblings, for seeded presets such as 'scatter'. */
  index?: number;
  seed?: number;
  time?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

/** Any element arriving and leaving with a motion preset: cards, chips, buttons, images, whole panels. */
export function Enter({preset: name = 'rise', start = 0, duration, exit, exitAt, exitDuration, distance = 80, index = 0, seed = 1,
  time, style, children}: EnterProps) {
  const clock = useTime(), t = time ?? clock;
  const {pose, preset} = poseAt(t, unitOf(index, 1, seed), {enter: name, exit, start, duration, exitAt, exitDuration});
  const body = <div style={{...poseStyle(pose, distance, {origin: preset.origin}), display: 'block', ...style}}>{children}</div>;
  return preset.mask ? <div style={{overflow: 'hidden'}}>{body}</div> : body;
}

/** Plays its children through a speed ramp: slow motion, a freeze, or a rush, while the film runs on.
 * Everything inside that reads useTime() follows the ramp, including cursors, typing, and MotionBlur. */
export function SpeedRamp({keys, time, children}: {keys: readonly RampKey[]; time?: number; children: React.ReactNode}) {
  const clock = useTime(), t = time ?? clock;
  return <TimeShift by={rampTime(t, keys) - t}><ClockScale rate={rampRate(t, keys)}>{children}</ClockScale></TimeShift>;
}

/** A handheld camera on a whole shot: organic wander plus optional hits at `impacts` (seconds).
 * The shot is scaled up slightly so its edges never show. */
export function Handheld({amount = 6, frequency = .9, impacts = [], hit = 26, seed = 1, time, children}: {amount?: number; frequency?: number;
  impacts?: readonly number[]; hit?: number; seed?: number; time?: number; children: React.ReactNode}) {
  const clock = useTime(), t = time ?? clock;
  const stage = useStage();
  const wander = shake(t, {amount, frequency, seed});
  const jolts = impacts.map((at, i) => impact(t, at, {amount: hit, seed: seed + i}));
  const x = wander.x + jolts.reduce((s, j) => s + j.x, 0), y = wander.y + jolts.reduce((s, j) => s + j.y, 0);
  const rotate = wander.rotate + jolts.reduce((s, j) => s + j.rotate, 0), bump = jolts.reduce((s, j) => s * j.scale, 1);
  const cover = 1 + 2.4 * (amount + hit * (impacts.length ? 1 : 0)) / Math.min(stage.width, stage.height);
  return <AbsoluteFill style={{overflow: 'hidden'}}>
    <AbsoluteFill style={{transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${rotate.toFixed(3)}deg) scale(${(cover * bump).toFixed(4)})`}}>
      {children}
    </AbsoluteFill>
  </AbsoluteFill>;
}

/** A slow float for an element during a hold, so finished frames keep breathing. */
export function Drift({amount = 10, period = 7, seed = 2, time, style, children}: {amount?: number; period?: number; seed?: number; time?: number;
  style?: React.CSSProperties; children: React.ReactNode}) {
  const clock = useTime(), t = time ?? clock;
  const d = drift(t, {amount, period, seed});
  return <div style={{...style, transform: `translate(${d.x.toFixed(2)}px, ${d.y.toFixed(2)}px) rotate(${d.rotate.toFixed(3)}deg)`}}>{children}</div>;
}

/** A camera in 3D: it looks at `target` from `distance`, circled `yaw` degrees around it and tilted
 * `pitch` degrees down onto it. Stage units; z points toward the viewer. */
export type Camera3D = {target?: {x: number; y: number; z?: number}; yaw?: number; pitch?: number; roll?: number; distance?: number};
export type Camera3DKey = Camera3D & {time: number};

type SpaceInfo = {perspective: number; target: {x: number; y: number; z: number}; yaw: number; pitch: number; distance: number;
  focus: number; aperture: number};
const SpaceContext = createContext<SpaceInfo | null>(null);

/** Distance from the camera to a world point. */
export function depthOf(point: {x: number; y: number; z: number}, s: Pick<SpaceInfo, 'target' | 'yaw' | 'pitch' | 'distance'>): number {
  const X = point.x - s.target.x, Y = point.y - s.target.y, Z = point.z - s.target.z;
  const a = -s.yaw * Math.PI / 180, b = s.pitch * Math.PI / 180;
  const z1 = -X * Math.sin(a) + Z * Math.cos(a);
  const z2 = Y * Math.sin(b) + z1 * Math.cos(b);
  return s.distance - z2;
}

/** A 3D stage for floating UI: put Plane children in it and move the camera. `focus` (a distance from
 * the camera) and `aperture` (blur px per px of depth) add depth of field. */
export function Space({camera = {}, perspective = 2000, focus, aperture = 0, background, children}: {camera?: Camera3D; perspective?: number;
  focus?: number; aperture?: number; background?: string; children: React.ReactNode}) {
  const stage = useStage();
  const target = {x: camera.target?.x ?? stage.width / 2, y: camera.target?.y ?? stage.height / 2, z: camera.target?.z ?? 0};
  const {yaw = 0, pitch = 0, roll = 0, distance = perspective} = camera;
  const world = `translateZ(${(perspective - distance).toFixed(2)}px) rotateZ(${roll.toFixed(3)}deg) rotateX(${pitch.toFixed(3)}deg) `
    + `rotateY(${(-yaw).toFixed(3)}deg) translate3d(${(stage.width / 2 - target.x).toFixed(2)}px, ${(stage.height / 2 - target.y).toFixed(2)}px, ${(-target.z).toFixed(2)}px)`;
  const info: SpaceInfo = {perspective, target, yaw, pitch, distance, focus: focus ?? distance, aperture};
  return <AbsoluteFill style={{background, perspective, perspectiveOrigin: '50% 50%', overflow: 'hidden'}}>
    <AbsoluteFill style={{transformStyle: 'preserve-3d', transform: world, transformOrigin: '50% 50%'}}>
      <SpaceContext.Provider value={info}>{children}</SpaceContext.Provider>
    </AbsoluteFill>
  </AbsoluteFill>;
}

/** A flat layer placed in a Space: its center at (x, y, z), turned by rotateX/Y/Z degrees. */
export function Plane({x, y, z = 0, rotateX = 0, rotateY = 0, rotateZ = 0, width, height, style, children}: {x?: number; y?: number; z?: number;
  rotateX?: number; rotateY?: number; rotateZ?: number; width: number; height: number; style?: React.CSSProperties; children?: React.ReactNode}) {
  const stage = useStage(), space = useContext(SpaceContext);
  const cx = x ?? stage.width / 2, cy = y ?? stage.height / 2;
  const blur = space && space.aperture > 0 ? Math.abs(depthOf({x: cx, y: cy, z}, space) - space.focus) * space.aperture : 0;
  return <div style={{position: 'absolute', left: cx - width / 2, top: cy - height / 2, width, height,
    transform: `translateZ(${z.toFixed(2)}px) rotateX(${rotateX.toFixed(3)}deg) rotateY(${rotateY.toFixed(3)}deg) rotateZ(${rotateZ.toFixed(3)}deg)`,
    filter: blur > .3 ? `blur(${blur.toFixed(2)}px)` : undefined, ...style}}>{children}</div>;
}

/** Interpolates 3D camera keyframes with the kit's travel curve (numbers only; missing fields hold). */
export function camera3DAt(time: number, keys: readonly Camera3DKey[]): Camera3D {
  if (!keys.length) return {};
  if (keys.some((k, i) => i > 0 && k.time <= keys[i - 1].time)) throw new Error('3D camera keyframes need strictly increasing times.');
  if (time <= keys[0].time) return keys[0];
  const i = keys.findIndex(k => k.time >= time);
  if (i < 0) return keys[keys.length - 1];
  const a = keys[i - 1], b = keys[i], p = ease(progress(time, a.time, b.time - a.time));
  const num = (u?: number, v?: number) => u === undefined ? v : v === undefined ? u : mix(u, v, p);
  const target = a.target || b.target ? {x: num(a.target?.x, b.target?.x) ?? 0, y: num(a.target?.y, b.target?.y) ?? 0,
    z: num(a.target?.z, b.target?.z)} : undefined;
  return {target, yaw: num(a.yaw, b.yaw), pitch: num(a.pitch, b.pitch), roll: num(a.roll, b.roll), distance: num(a.distance, b.distance)};
}
