import React from 'react';
import {Composition, registerRoot} from 'remotion';
import '@fontsource-variable/dm-sans';
import '@fontsource-variable/inter/opsz.css';
import '@fontsource-variable/inter/opsz-italic.css';
import '@fontsource-variable/geist-mono';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import {StarterFilm, defaultStarterProps, calculateStarterMetadata} from './examples/StarterFilm';
import {MotionCatalogue, CATALOGUE_DURATION} from './examples/MotionCatalogue';
import {LaunchFilm, defaultLaunchProps, calculateLaunchMetadata} from './examples/LaunchFilm';
import {TransitionGallery, TRANSITION_GALLERY_DURATION} from './examples/TransitionGallery';
import {EffectsGallery} from './examples/EffectsGallery';
import {SceneTransitionReel, SCENE_TRANSITION_REEL_SECONDS} from './examples/SceneTransitionReel';
import {ProductExplainer, EXPLAINER_SECONDS} from './examples/ProductExplainer';
import {ProductLaunch, LAUNCH_SECONDS} from './examples/ProductLaunch';
import {KitReel, KIT_REEL_SECONDS} from './examples/KitReel';
import {MotionShowcase, SHOWCASE_SECONDS} from './examples/MotionShowcase';

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
  <Composition id="Product-Explainer" component={ProductExplainer} width={1920} height={1080} fps={30}
    durationInFrames={EXPLAINER_SECONDS * 30}/>
  <Composition id="Product-Launch" component={ProductLaunch} width={1920} height={1080} fps={30}
    durationInFrames={LAUNCH_SECONDS * 30}/>
  <Composition id="Kit-Reel" component={KitReel} width={1080} height={1920} fps={30} durationInFrames={KIT_REEL_SECONDS * 30}/>
  <Composition id="Motion-Showcase" component={MotionShowcase} defaultProps={{labelled: true}} width={1920} height={1080} fps={30}
    durationInFrames={SHOWCASE_SECONDS * 30}/>
  <Composition id="Scene-Transitions" component={SceneTransitionReel} defaultProps={{labelled: true}} width={1920} height={1080}
    fps={30} durationInFrames={SCENE_TRANSITION_REEL_SECONDS * 30}/>
</>;
registerRoot(Root);
