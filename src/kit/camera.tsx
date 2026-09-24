import React, {createContext, useContext} from 'react';
import {AbsoluteFill, Img, useVideoConfig} from 'remotion';
import {ease, mix, progress} from './motion';
import {assetUrl} from './typography';

/** Landscape logical stage, the default everywhere. */
export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;
export type StageSize = {width: number; height: number};
export const LANDSCAPE: StageSize = {width: 1920, height: 1080};
/** Logical stages per aspect ratio. The short side of portrait, square and 4:5 stages is 1080 units. */
export const STAGES = {landscape: LANDSCAPE, portrait: {width: 1080, height: 1920}, square: {width: 1080, height: 1080},
  feed: {width: 1080, height: 1350}} as const satisfies Record<string, StageSize>;
export type Camera = {x: number; y: number; scale: number};
export type CameraKeyframe = Camera & {time: number};
export const REST_CAMERA: Camera = {x: 0, y: 0, scale: 1};

/** The logical stage for an output size: 16:9, 9:16, 1:1, or 4:5. Other ratios need their own layout. */
export function stageFor(width: number, height: number): StageSize {
  const ratio = width / height;
  const match = Object.values(STAGES).find(stage => Math.abs(stage.width / stage.height - ratio) < .0005);
  if (!match) throw new Error(`No logical stage for a ${width} × ${height} output. Use 16:9, 9:16, 1:1, or 4:5.`);
  return match;
}

const StageContext = createContext<StageSize>(LANDSCAPE);
/** Size of the enclosing LogicalStage in logical units (1920 × 1080 outside one). */
export const useStage = () => useContext(StageContext);

/** A fixed logical coordinate system keeps motion identical at every output resolution.
 * 16:9 outputs get a 1920 × 1080 stage, 9:16 a 1080 × 1920 stage, 1:1 1080 × 1080, and 4:5 1080 × 1350.
 * Each aspect ratio needs its own layout; nothing is cropped or stretched. */
export function LogicalStage({children, background = '#fff'}: {children: React.ReactNode; background?: string}) {
  const {width, height} = useVideoConfig();
  const stage = stageFor(width, height);
  return <AbsoluteFill style={{background}}><div style={{position: 'absolute', inset: 0,
    width: stage.width, height: stage.height, overflow: 'hidden', transform: `scale(${width / stage.width})`,
    transformOrigin: '0 0'}}><StageContext.Provider value={stage}>{children}</StageContext.Provider></div></AbsoluteFill>;
}

/** Coordinates are measured on the untransformed logical stage. Pass `stage` for portrait or square films. */
export function focusCamera(target: {x: number; y: number}, scale: number,
  screen?: {x: number; y: number}, stage: StageSize = LANDSCAPE): Camera {
  const cx = stage.width / 2, cy = stage.height / 2, at = screen ?? {x: cx, y: cy};
  return {scale, x: at.x - cx - (target.x - cx) * scale, y: at.y - cy - (target.y - cy) * scale};
}

export function cameraAt(time: number, keyframes: readonly CameraKeyframe[]): Camera {
  if (!keyframes.length) return REST_CAMERA;
  if (keyframes.some((key, i) => !Number.isFinite(key.time) || key.scale <= 0 ||
      (i > 0 && key.time <= keyframes[i - 1].time))) throw new Error('Camera keyframes need positive scales and strictly increasing times.');
  if (time <= keyframes[0].time) return keyframes[0];
  for (let i = 1; i < keyframes.length; i++) {
    const next = keyframes[i], previous = keyframes[i - 1];
    if (time <= next.time) {
      const p = ease(progress(time, previous.time, next.time - previous.time));
      return {x: mix(previous.x, next.x, p), y: mix(previous.y, next.y, p), scale: mix(previous.scale, next.scale, p)};
    }
  }
  return keyframes[keyframes.length - 1];
}

export function CameraLayer({camera = REST_CAMERA, children, style}: {
  camera?: Camera; children: React.ReactNode; style?: React.CSSProperties;
}) {
  return <div style={{...style, position: 'absolute', inset: 0,
    transformOrigin: '50% 50%', transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`}}>{children}</div>;
}

/** Same direction as foreground motion, lower displacement because this plane is farther away. */
export function parallaxCamera(camera: Camera, depth = .12, overscan = 1.20): Camera {
  if (depth < 0 || depth > 1 || overscan < 1) throw new Error('Parallax depth must be 0…1; overscan must be >= 1.');
  return {x: camera.x * depth, y: camera.y * depth,
    scale: overscan * (1 + (camera.scale - 1) * depth * .3)};
}

export function backgroundCoversFrame(camera: Camera, width = STAGE_WIDTH, height = STAGE_HEIGHT): boolean {
  return (camera.scale - 1) * width / 2 >= Math.abs(camera.x) &&
    (camera.scale - 1) * height / 2 >= Math.abs(camera.y);
}

export function ParallaxBackground({camera = REST_CAMERA, depth = .12, overscan = 1.20,
  src, children, color = '#f6f5f1', style,
}: {camera?: Camera; depth?: number; overscan?: number; src?: string; children?: React.ReactNode;
  color?: string; style?: React.CSSProperties}) {
  const transform = parallaxCamera(camera, depth, overscan);
  return <CameraLayer camera={transform} style={{background: color, ...style}}>
    {src && <Img src={assetUrl(src)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}}/>}
    {children}
  </CameraLayer>;
}
