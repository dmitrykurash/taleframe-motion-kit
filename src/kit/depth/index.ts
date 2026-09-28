// Depth films: multiplane painted films with a travelling camera. See docs/depth-films.md.

export {DEPTH_CONFIG, depthConfig, depthUnit, heldTime, liveTime, outputScale, outputSize, type DepthConfig} from './config';
export {
  REST_DEPTH_CAMERA, coverScale, coveredPlate, defocusBlur, drawPlane, planeMatrix, planeToScreen, projectPlane,
  type DepthCamera, type PlaneDraw,
} from './stage';
export {
  cameraPath, easeInOut as depthEase, lerpCamera, matchCamera, monotoneCurve, passage,
  type DepthKey, type DepthMark, type PassageOptions,
} from './path';
export {IDENTITY as IDENTITY_AFFINE, affine, apply as applyAffine, invert as invertAffine, multiply as multiplyAffine,
  type Affine as DepthAffine} from './affine';
export {heldFrame, heldFrames, heldStill, onTwos} from './held';
export {footagePlanes, stillPlanes, type FootageLayout, type PlaneSource, type StillLayout} from './sources';
export {depthImage, releaseSurface, setDepthImageLimit, surface as depthSurface} from './raster';
export {
  asWatercolor, paintedPlane, planePaintSettings, setPlaneCacheLimit,
  type PaintSettings, type PaintedPlaneOptions, type TintSettings,
} from './planes';
export {
  applyMask, bloomMask, dissolveMask, peripheryMask, peripheryWeight, sweepMask,
  type BloomOptions, type DissolveOptions, type SweepOptions,
} from './mask';
export {fbm, hash as noiseHash, smooth as smoothstep} from './noise';
export {drawMotes, dustMotes, emberMotes, motesFade, type DepthMotes} from './motes';
export {mixCanvases, type DepthMix} from './mixer';
export {anchorAt, anchorOnScreen, anchorPoint, blendPlacement, stageToUV, trackLookup, uvToStage, type AnchorPoint, type Track} from './anchors';
export {focusEllipses, keyedEllipse, trackedEllipse, type Ellipse, type EllipseKey} from './focus';
export {
  INK_FONT, INK_VISIBLE_ALPHA, canvasMeasure, checkSafeArea, drawInkLine, inkCorners, inkFontString, inkLayout, inkPlacement,
  inkSafeAreaApplies, inkTiming, inkWordMatrix, inkWordPose, loadInkFonts, safeArea, safeAreaViolations,
  type InkBox, type InkEmphasis, type InkExit, type InkFont, type InkGroup, type InkLayout, type InkLine, type InkMeasure,
  type InkMetrics, type InkPlacement, type InkReveal, type InkWord, type InkWordPose, type SafeArea, type SafeAreaViolation,
} from './type';
export {
  drawUILayer, followUICamera, uiAnchor, uiDrawing, uiFocus, uiLook, uiPresence, uiSequence,
  type DepthUIFrame, type DepthUILayer, type DepthUIPose, type DepthUISource,
} from './ui';
export {
  depthFilmFrames, depthFrameAt, passLens, piecewise, renderDepthFrame, validateDepthFilm,
  type DepthCut, type DepthFilmSpec, type DepthGuest, type DepthLayer, type DepthShot,
} from './film';
export {DepthCanvas, DepthFilm, type DepthCanvasRender, type DepthFilmProps} from './DepthFilm';
