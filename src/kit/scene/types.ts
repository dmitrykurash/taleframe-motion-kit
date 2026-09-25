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

/** A whip pan: the picture tears sideways at speed and the next shot swings in from the other side on the
 * same move. Real temporal motion blur plus a directional streak at peak speed. */
export type WhipOptions = BlurOptions & {
  /** Direction the picture moves. 'left' is the camera panning right. Default 'left'. */
  direction?: 'left' | 'right' | 'up' | 'down';
  /** Degrees the frame rolls through the move, for a spin whip. Default 0. */
  spin?: number;
  /** Scale at peak speed, as if the move bulged toward the lens. Default 1.05. */
  bulge?: number;
  backdrop?: string;
};

/** The next shot slides over the current one as a card while the current one sinks back into depth. */
export type StackOptions = BlurOptions & {
  /** Side the new card enters from. Default 'bottom'. */
  side?: 'bottom' | 'top' | 'left' | 'right';
  /** Scale the outgoing shot recedes to. Default .9. */
  recede?: number;
  /** How much the outgoing shot darkens, 0–1. Default .45. */
  dim?: number;
  /** Depth blur on the outgoing shot in logical px. Default 6. */
  defocus?: number;
  /** Corner radius of the card while it travels. Default 44. */
  radius?: number;
  /** 0 settles without overshoot, 1 ≈ 8% overshoot. Default 0. */
  bounce?: number;
  backdrop?: string;
};

/** The outgoing shot breaks into a grid of tiles that shrink away in a wave, uncovering the next shot. */
export type TilesOptions = {
  /** Tiles across the frame; rows follow so tiles stay square. Default 12 (landscape) or 7 (portrait). */
  columns?: number;
  /** Order the tiles go: a diagonal wave, a ripple from `origin`, rows, columns, or random. Default 'diagonal'. */
  pattern?: 'diagonal' | 'radial' | 'rows' | 'columns' | 'random';
  /** Where a 'radial' ripple starts (stage units). Default: stage center. */
  origin?: Point;
  /** Fraction of the window between the first and the last tile starting. Default .55. */
  spread?: number;
  /** Tile shape as it shrinks: 0 stays square, 1 becomes a dot. Default .6. */
  round?: number;
  /** Degrees each tile turns as it shrinks (45 gives diamonds). Default 0. */
  rotate?: number;
  /** The incoming shot settles from this scale. Default 1.08. */
  depth?: number;
  seed?: number;
  backdrop?: string;
};

/** The outgoing shot splits along a line and its halves slide apart, revealing the next shot behind. */
export type SplitOptions = BlurOptions & {
  /** Angle of the split in degrees: 90 vertical doors, 0 horizontal, 20 a diagonal tear. Default 90. */
  angle?: number;
  /** A point on the split line (stage units). Default: stage center. */
  at?: Point;
  /** The incoming shot settles from this scale behind the halves. Default 1.12. */
  depth?: number;
  /** A line of light along the split before it opens, 0–1. Default .7. */
  seam?: number;
  seamColor?: string;
  backdrop?: string;
};

/** A rack focus: the current shot drifts out of focus, the next one resolves out of the blur. */
export type FocusOptions = {
  /** Peak blur in logical px. Default 28. */
  blur?: number;
  /** Scale the outgoing shot drifts to; the incoming settles from it. Default 1.06. */
  scale?: number;
  /** Light blooming at the blend, 0–1. Default .22. */
  bloom?: number;
  backdrop?: string;
};

/** Both shots ripple as if seen through moving water; the swap happens inside the distortion. */
export type LiquidOptions = {
  /** Peak displacement in logical px. Default 150. */
  amount?: number;
  /** Size of the ripples: smaller is broader. Default .0045. */
  frequency?: number;
  /** How fast the liquid flows, in logical px per second. Default 320. */
  flow?: number;
  seed?: number;
  backdrop?: string;
};

/** Two planes pass in 3D: the current shot tips back and falls away as the next one swings up into place. */
export type TiltOptions = BlurOptions & {
  /** Direction the new shot comes from: 'up' rises from below. Default 'up'. */
  direction?: 'up' | 'down' | 'left' | 'right';
  /** Degrees the planes tilt. Default 40. */
  angle?: number;
  /** How far the outgoing plane falls back, in logical px. Default 900. */
  depth?: number;
  /** Camera distance (CSS perspective) in logical px. Default 1500. */
  perspective?: number;
  /** Corner radius of the planes in flight. Default 40. */
  radius?: number;
  backdrop?: string;
};

/** The app-switcher move: the current shot shrinks to a card, the strip slides to the next card, and it
 * grows to fill the frame. */
export type CardsOptions = BlurOptions & {
  /** Direction the strip moves: 'left' brings the next card in from the right. Default 'left'. */
  direction?: 'left' | 'right' | 'up' | 'down';
  /** Scale of the shots while they are cards. Default .66. */
  scale?: number;
  /** Space between the cards in logical px (at card size). Default 80. */
  gap?: number;
  /** Corner radius of the cards. Default 44. */
  radius?: number;
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
  | ({kind: 'glitch'} & GlitchOptions & TransitionTiming)
  | ({kind: 'whip'} & WhipOptions & TransitionTiming)
  | ({kind: 'stack'} & StackOptions & TransitionTiming)
  | ({kind: 'tiles'} & TilesOptions & TransitionTiming)
  | ({kind: 'split'} & SplitOptions & TransitionTiming)
  | ({kind: 'focus'} & FocusOptions & TransitionTiming)
  | ({kind: 'liquid'} & LiquidOptions & TransitionTiming)
  | ({kind: 'tilt'} & TiltOptions & TransitionTiming)
  | ({kind: 'cards'} & CardsOptions & TransitionTiming);
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
