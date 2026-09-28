// Painted-Depth: a depth film from three demo paintings (a lake at dawn, a sitting room, a harbour at dusk), each
// cut into planes and painted in loose oil, with travel-through cuts on anchors, ink type composed per scene, a
// render-status card in depth and the painted finish. Its shots are data: see ./depth/film.ts and docs/depth-films.md.
import React, {useMemo} from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {DepthFilm, depthFilmFrames, outputScale} from '../kit';
import {config, paintedDepthFilm} from './depth/film';

export const PAINTED_DEPTH_FPS = config.fps;
export const PAINTED_DEPTH_FRAMES = depthFilmFrames(paintedDepthFilm());

/** `watercolor` paints every oil plane in watercolor instead (one flag keeps the earlier look reproducible). */
export const PaintedDepth: React.FC<{watercolor?: boolean}> = ({watercolor = false}) => {
  const frame = useCurrentFrame();
  const {width, height, durationInFrames} = useVideoConfig();
  const scale = outputScale(config, width, height);
  // Built once per output size: the spec holds functions and must stay stable between frames.
  const film = useMemo(() => paintedDepthFilm({scale, watercolor}), [scale, watercolor]);
  // Out of black and back to black.
  const dark = interpolate(frame, [0, 10, durationInFrames - 14, durationInFrames - 1], [1, 0, 0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <AbsoluteFill style={{background: '#0b0a09'}}>
    <DepthFilm {...film}/>
    {dark > 0 && <AbsoluteFill style={{background: '#0b0a09', opacity: dark}}/>}
  </AbsoluteFill>;
};
