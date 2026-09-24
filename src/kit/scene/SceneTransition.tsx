import React from 'react';
import {useTime} from '../clock';
import {ExpandTransition} from './expand';
import {GlitchTransition} from './glitch';
import {PortalTransition} from './portal';
import {SliceTransition} from './slice';
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
  }
}
