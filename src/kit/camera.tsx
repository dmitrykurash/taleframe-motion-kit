import React from 'react';
import {AbsoluteFill, Img, useVideoConfig} from 'remotion';
import {ease, mix, progress} from './motion';
import {assetUrl} from './typography';

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;
export type Camera = {x: number; y: number; scale: number};
export type CameraKeyframe = Camera & {time: number};
export const REST_CAMERA: Camera = {x: 0, y: 0, scale: 1};

/** A single 16:9 logical coordinate system keeps motion identical in 1080p and 4K.
 * Portrait needs a new layout, not a crop of this landscape composition. */
export function LogicalStage({children, background = '#fff'}: {children: React.ReactNode; background?: string}) {
  const {width, height} = useVideoConfig();
  if (Math.abs(width / height - 16 / 9) > .0001) throw new Error('LogicalStage requires a 16:9 output. Build a portrait layout explicitly.');
  return <AbsoluteFill style={{background}}><div style={{position: 'absolute', inset: 0,
    width: STAGE_WIDTH, height: STAGE_HEIGHT, overflow: 'hidden', transform: `scale(${width / STAGE_WIDTH})`,
    transformOrigin: '0 0'}}>{children}</div></AbsoluteFill>;
}

/** Coordinates are measured on the untransformed logical stage. */
export function focusCamera(target: {x: number; y: number}, scale: number,
  screen = {x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2}): Camera {
  return {scale, x: screen.x - STAGE_WIDTH / 2 - (target.x - STAGE_WIDTH / 2) * scale,
    y: screen.y - STAGE_HEIGHT / 2 - (target.y - STAGE_HEIGHT / 2) * scale};
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
