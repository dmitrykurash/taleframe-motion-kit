import React from 'react';
import {AbsoluteFill, Sequence, staticFile} from 'remotion';
import {TaleframeTransition} from '../kit/TaleframeTransition';
import {TRANSITION_CATALOG} from '../taleframe/transitions/catalog';

export const TRANSITION_GALLERY_FRAMES_PER_ITEM = 120;
export const TRANSITION_GALLERY_DURATION = TRANSITION_CATALOG.length * TRANSITION_GALLERY_FRAMES_PER_ITEM;

/** 40 seconds at 60 fps. Every current and legacy shader has its own two-second scene. */
export const TransitionGallery: React.FC = () => <AbsoluteFill style={{background: '#111827'}}>
  {TRANSITION_CATALOG.map((item, index) => <Sequence key={item.id} from={index * TRANSITION_GALLERY_FRAMES_PER_ITEM} durationInFrames={TRANSITION_GALLERY_FRAMES_PER_ITEM}>
    <TaleframeTransition kind={item.id} from={staticFile('demo/landscape-a.svg')} to={staticFile('demo/landscape-b.svg')} fromFrame={24} durationInFrames={78} params={item.id === 'watercolor' ? {count: 3, seed: 42} : undefined} />
    <div style={{position: 'absolute', left: '4%', bottom: '6%', padding: '20px 26px', borderRadius: 16, background: 'rgba(255,255,255,.94)', color: '#172331', fontFamily: 'system-ui, sans-serif'}}>
      <div style={{fontWeight: 650, fontSize: 38}}>{item.name}</div>
      <div style={{fontSize: 19, marginTop: 5}}>{item.description}</div>
    </div>
    <div style={{position: 'absolute', right: '4%', bottom: '7%', color: '#fff', fontSize: 20, fontFamily: 'system-ui, sans-serif'}}>{index + 1} / {TRANSITION_CATALOG.length}</div>
  </Sequence>)}
</AbsoluteFill>;
