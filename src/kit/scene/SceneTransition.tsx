import React from 'react';
import {useTime} from '../clock';
import {CardsTransition} from './cards';
import {DivideTransition} from './divide';
import {ExpandTransition} from './expand';
import {FocusTransition} from './focus';
import {GlitchTransition} from './glitch';
import {GridTransition} from './grid';
import {LiquidTransition} from './liquid';
import {PortalTransition} from './portal';
import {SliceTransition} from './slice';
import {SplitTransition} from './split';
import {StackTransition} from './stack';
import {TiltTransition} from './tilt';
import {TilesTransition} from './tiles';
import type {SceneTransitionKind, TransitionSpec} from './types';
import {ZoomTransition} from './zoom';

/** What each scene transition is for. Durations are seconds; `align` places the window on the cut. */
export const SCENE_TRANSITIONS = {
  zoom: {name: 'Zoom punch', duration: .5, align: 'center',
    use: 'Loud, classic cut between two full-frame shots: accelerate into a point, cut on the blur, land in the next shot.'},
  portal: {name: 'Portal', duration: 1.1, align: 'start',
    use: 'Fly through a word, a card, or a dot of the outgoing shot. Kinetic type into product, or a UI card into its own screen.'},
  expand: {name: 'Expand', duration: .7, align: 'start',
    use: 'The next shot grows out of the element that was just clicked while the current one recedes. Clean and UI-native.'},
  slice: {name: 'Slice', duration: .6, align: 'center',
    use: 'Bands of the frame push across with a stagger, optionally led by brand-color bars. Graphic and fast.'},
  glitch: {name: 'Glitch', duration: .42, align: 'center',
    use: 'A short digital hit around a hard cut: RGB split, tearing, smeared rows, stutter. For loud, technical films.'},
  stack: {name: 'Stack', duration: .75, align: 'start',
    use: 'The next shot slides over as a card while the current one sinks into depth. Calm, product-like, great for step-by-step.'},
  tiles: {name: 'Tiles', duration: .8, align: 'center',
    use: 'The frame breaks into a grid of tiles that shrink away in a wave or ripple. Graphic and modern.'},
  split: {name: 'Split', duration: .7, align: 'start',
    use: 'A line of light cracks the frame and the halves slide apart to reveal the next shot. Doors, tears, reveals.'},
  focus: {name: 'Rack focus', duration: .7, align: 'center',
    use: 'Out of focus and back in: the swap hides inside the blur. Soft and cinematic; the premium alternative to a dissolve.'},
  liquid: {name: 'Liquid', duration: .8, align: 'center',
    use: 'Both shots ripple as if under moving water, and the swap happens inside the distortion. Organic and dreamy.'},
  tilt: {name: 'Tilt', duration: .8, align: 'center',
    use: 'Two planes pass in 3D: the current shot tips back and falls away as the next swings up into place. Spatial and bold.'},
  cards: {name: 'Cards', duration: 1.1, align: 'center',
    use: 'The app-switcher move: shrink to a card, slide along the strip, grow into the next shot. Shows that shots belong together.'},
  grid: {name: 'Grid', duration: 1.5, align: 'center',
    use: 'Pull back to a bento grid of live shots, hold, and push into the next one. A recap, a chapter jump, or a show of range.'},
  divide: {name: 'Divide', duration: 1.3, align: 'center',
    use: 'The next shot pushes in to share a split screen, holds side by side, then takes the frame. Comparisons and handoffs.'},
} as const satisfies Record<SceneTransitionKind, {name: string; duration: number; align: 'center' | 'start' | 'end'; use: string}>;

export const SCENE_TRANSITION_KINDS = Object.keys(SCENE_TRANSITIONS) as SceneTransitionKind[];

export type SceneTransitionProps = TransitionSpec & {
  /** Outgoing and incoming shots: full-stage, opaque React scenes that read time with useTime(). */
  from: React.ReactNode;
  to: React.ReactNode;
  /** Film time (s) where the window starts. */
  start: number;
  time?: number;
};

/** Transition between two live React scenes. Before `start` it shows `from`, after the window `to`,
 * so the endpoints are exactly the two shots. Place it inside a LogicalStage. */
export function SceneTransition(props: SceneTransitionProps) {
  const clock = useTime(), time = props.time ?? clock;
  const meta = SCENE_TRANSITIONS[props.kind];
  if (!meta) throw new Error(`Unknown scene transition "${String(props.kind)}". Use one of: ${SCENE_TRANSITION_KINDS.join(', ')}.`);
  const duration = props.duration ?? meta.duration;
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('A scene transition needs a positive duration in seconds.');
  if (!Number.isFinite(props.start)) throw new Error('A scene transition needs a finite start time in seconds.');
  if (time <= props.start) return <>{props.from}</>;
  if (time >= props.start + duration) return <>{props.to}</>;
  const {from, to, start} = props;
  const common = {from, to, time, start, duration};
  switch (props.kind) {
    case 'zoom': return <ZoomTransition {...common} options={props}/>;
    case 'portal': return <PortalTransition {...common} options={props}/>;
    case 'expand': return <ExpandTransition {...common} options={props}/>;
    case 'slice': return <SliceTransition {...common} options={props}/>;
    case 'glitch': return <GlitchTransition {...common} options={props}/>;
    case 'stack': return <StackTransition {...common} options={props}/>;
    case 'tiles': return <TilesTransition {...common} options={props}/>;
    case 'split': return <SplitTransition {...common} options={props}/>;
    case 'focus': return <FocusTransition {...common} options={props}/>;
    case 'liquid': return <LiquidTransition {...common} options={props}/>;
    case 'tilt': return <TiltTransition {...common} options={props}/>;
    case 'cards': return <CardsTransition {...common} options={props}/>;
    case 'grid': return <GridTransition {...common} options={props}/>;
    case 'divide': return <DivideTransition {...common} options={props}/>;
  }
}
