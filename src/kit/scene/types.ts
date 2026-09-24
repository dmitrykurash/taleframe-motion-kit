import type React from 'react';

/** Logical stage units (1920 × 1080), the same space as LogicalStage and CameraLayer. */
export type Point = {x: number; y: number};
export type Rect = {x: number; y: number; width: number; height: number; radius?: number};

export type BlurOptions = {
  /** Exposure as a fraction of one frame: 0.5 = 180° shutter, 0 = no motion blur. */
  shutter?: number;
  /** Most copies averaged in the fastest frame. Higher is smoother and slower to render. */
  quality?: number;
};

/** Push into the outgoing shot, cut on the blur, land in the incoming one. */
export type ZoomOptions = BlurOptions & {
  /** Point of the outgoing shot the camera rushes toward. Default: stage center. */
  focus?: Point;
  /** Point of the incoming shot the camera settles on. Default: stage center. */
  landing?: Point;
  /** Scale the outgoing shot reaches at the cut. Default 2.4. */
  push?: number;
  /** Scale the incoming shot starts from before settling to 1. Default 1.6. */
  land?: number;
  /** Degrees of roll into the cut; the landing unwinds it. Default 0. */
  roll?: number;
  /** Where the cut falls inside the window (0.2–0.8). Default 0.5. */
  cut?: number;
  /** Light burst at the cut, 0–1. Default 0.18. */
  flash?: number;
  flashColor?: string;
  /** Radial color fringing at peak speed, 0–1. Default 0.35. */
  chroma?: number;
  backdrop?: string;
};

/** Fly through a shape of the outgoing shot (a word, a card, a dot) into the incoming shot. */
export type PortalOptions = BlurOptions & {
  /** A word: the incoming shot shows inside its letters, then the camera flies through one stroke. */
  text?: string;
  /** Baseline center of the word. Default: stage center, baseline at 62% height. */
  at?: Point;
  fontFamily?: string;
  fontWeight?: number;
  fontSize?: number;
  letterSpacing?: number;
  /** A card, screen, or button of the outgoing shot. The camera pushes until it fills the frame. */
  rect?: Rect;
  /** A dot or round control. */
  circle?: {x: number; y: number; radius: number};
  /** Fraction of the window spent opening the portal before flying through it. */
  reveal?: number;
  /** Override the point the camera flies into (stage units). Text defaults to its thickest stroke. */
  into?: Point;
  /** The incoming shot starts this much larger inside the portal and settles to 1. Default 1.22. */
  depth?: number;
  backdrop?: string;
};

/** The incoming shot grows out of an element of the outgoing one (container transform). */
export type ExpandOptions = BlurOptions & {
  /** Element the new shot grows out of, e.g. the button that was just clicked. Default: 140 px square at center. */
  source?: Rect;
  shape?: 'rect' | 'circle';
  /** Fill of that element: the window starts in this color and dissolves into the incoming shot. */
  color?: string;
  /** Scale the outgoing shot moves to while the new one opens: above 1 pushes toward the camera
   * (like a home screen when an app opens), below 1 recedes. Default 1.08. */
  push?: number;
  /** How much the outgoing shot darkens, 0–1. Default 0.4. */
  dim?: number;
  /** Depth blur on the outgoing shot in logical pixels. Default 8. */
  defocus?: number;
  /** 0 = settle without overshoot, 1 ≈ 8% overshoot. Default 0. */
  bounce?: number;
  backdrop?: string;
};

/** Bands of the frame push across with a stagger; optional color bars lead each band. */
export type SliceOptions = BlurOptions & {
  /** 'horizontal' bands travel left/right; 'vertical' bands travel up/down. */
  orientation?: 'horizontal' | 'vertical';
  bands?: number;
  /** Where the outgoing shot leaves. Default 'left' (horizontal) or 'up' (vertical). */
  direction?: 'left' | 'right' | 'up' | 'down';
  /** Alternate the travel direction band by band. */
  alternate?: boolean;
  /** Delay between bands as a fraction of the window. Default 0.07. */
  stagger?: number;
  order?: 'sequence' | 'reverse' | 'center' | 'random';
  /** Solid bars that run ahead of the incoming shot, first color leading. */
  lead?: readonly string[];
  /** Width of each lead bar in logical pixels. Default 150. */
  leadWidth?: number;
  seed?: number;
};

/** A deliberate digital hit: RGB split, tearing, smeared rows, and a stutter around a hard cut. */
export type GlitchOptions = {
  /** 0–1. Default 0.75. */
  intensity?: number;
  /** Where the hard cut falls inside the window. Default 0.5. */
  cut?: number;
  /** Glitch pattern changes per second, independent of fps. Default 24. */
  rate?: number;
  /** Largest RGB split in logical pixels. Default 34. */
  split?: number;
  /** Solid block color that flickers on the hit. Default white. */
  color?: string;
  /** Briefly repeat earlier instants of each shot. Default true. */
  stutter?: boolean;
  seed?: number;
  backdrop?: string;
};

export type Align = 'center' | 'start' | 'end';
export type TransitionTiming = {
  /** Seconds. Each kind has a default. */
  duration?: number;
  /** Window relative to the cut time: centered on it (default), starting at it, or ending at it. */
  align?: Align;
};

export type TransitionSpec =
  | ({kind: 'zoom'} & ZoomOptions & TransitionTiming)
  | ({kind: 'portal'} & PortalOptions & TransitionTiming)
  | ({kind: 'expand'} & ExpandOptions & TransitionTiming)
  | ({kind: 'slice'} & SliceOptions & TransitionTiming)
  | ({kind: 'glitch'} & GlitchOptions & TransitionTiming);
export type SceneTransitionKind = TransitionSpec['kind'];

export type TransitionRenderProps<O> = {
  from: React.ReactNode;
  to: React.ReactNode;
  /** Film time of this frame, seconds. */
  time: number;
  /** Window start and length, seconds. */
  start: number;
  duration: number;
  options: O;
};
