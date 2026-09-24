import React from 'react';
import {Composition, registerRoot} from 'remotion';
import '@fontsource-variable/dm-sans';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import {StarterFilm, defaultStarterProps, calculateStarterMetadata} from './examples/StarterFilm';
import {MotionCatalogue, CATALOGUE_DURATION} from './examples/MotionCatalogue';
import {LaunchFilm, defaultLaunchProps, calculateLaunchMetadata} from './examples/LaunchFilm';
import {TransitionGallery, TRANSITION_GALLERY_DURATION} from './examples/TransitionGallery';
import {EffectsGallery} from './examples/EffectsGallery';

const Root = () => <>
  {['Starter', 'UI-Demo'].map(id => <Composition key={id} id={id} component={StarterFilm}
    defaultProps={defaultStarterProps} calculateMetadata={calculateStarterMetadata}
    width={3840} height={2160} fps={60} durationInFrames={1440}/>)}
  <Composition id="Launch-Film" component={LaunchFilm} defaultProps={defaultLaunchProps}
    calculateMetadata={calculateLaunchMetadata} width={1920} height={1080} fps={30} durationInFrames={540}/>
  <Composition id="Motion-Catalogue" component={MotionCatalogue} width={1920} height={1080} fps={60}
    durationInFrames={CATALOGUE_DURATION * 60}/>
  <Composition id="Transition-Gallery" component={TransitionGallery} width={1920} height={1080} fps={60}
    durationInFrames={TRANSITION_GALLERY_DURATION}/>
  <Composition id="Effects-Gallery" component={EffectsGallery} width={1920} height={1080} fps={30}
    durationInFrames={720}/>
</>;
registerRoot(Root);
