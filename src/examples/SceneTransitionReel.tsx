import React from 'react';
import {AbsoluteFill} from 'remotion';
import {LogicalStage, Shots, useTime, type Shot} from '../kit';
import {anchors, look} from './showcase/look';
import {ComposerShot, DashboardShot, GridShot, LiveShot, PlateShot, RollShot, SlamShot, StatShot, TerminalShot} from './showcase/shots';

export const SCENE_TRANSITION_REEL_SECONDS = 22;
const card = anchors.shippingCard;

/** The five scene transitions between realistic launch-film shots, with hard cuts between demos. */
export const reelShots: Shot[] = [
  {name: 'dashboard', until: 1.7, content: <DashboardShot start={0}/>},
  {name: 'ship-it', until: 3.3, content: <SlamShot start={1.7} text="Ship it."/>,
    enter: {kind: 'zoom', duration: .52, focus: {x: card.x + card.width / 2, y: card.y + card.height / 2}, push: 2.6, land: 1.55, roll: 3}},
  {name: 'plate', until: 4.3, content: <PlateShot start={3.3}/>},
  {name: 'dashboard-through-word', until: 6.9, content: <DashboardShot start={4.3}/>,
    enter: {kind: 'portal', duration: 1.35, text: 'Relay', fontSize: 540, fontWeight: 1000, at: {x: 960, y: 735}}},
  {name: 'composer', until: 8.88, content: <ComposerShot start={6.9}/>},
  {name: 'live', until: 11.1, content: <LiveShot start={8.88}/>,
    enter: {kind: 'expand', duration: .8, source: anchors.publishButton, color: look.orange}},
  {name: 'stat', until: 12.9, content: <StatShot start={11.1}/>},
  {name: 'grid', until: 15.2, content: <GridShot start={12.9}/>,
    enter: {kind: 'slice', duration: .62, bands: 5, stagger: .06, lead: [look.orange, look.lime]}},
  {name: 'dashboard-through-card', until: 17.6, content: <DashboardShot start={15.2}/>,
    enter: {kind: 'portal', duration: 1.05, rect: anchors.chartTile}},
  {name: 'terminal', until: 19.6, content: <TerminalShot start={17.6}/>},
  {name: 'built-for', content: <RollShot start={19.6} composed/>, enter: {kind: 'glitch', duration: .46, intensity: .85}},
];

const labels: [number, string][] = [[0, 'Zoom punch'], [3.3, 'Portal · word'], [6.9, 'Expand'], [11.1, 'Slice'], [15.2, 'Portal · card'], [17.6, 'Glitch']];

function Label() {
  const t = useTime();
  const index = labels.reduce((found, [time], i) => (t >= time ? i : found), 0);
  return <div style={{position: 'absolute', left: 48, top: 44, display: 'flex', gap: 14, alignItems: 'center', padding: '12px 20px 12px 14px',
    borderRadius: 999, background: 'rgba(12,13,16,.72)', color: '#fff', fontFamily: look.sans, fontSize: 22, fontWeight: 600, letterSpacing: '-.01em'}}>
    <span style={{padding: '3px 10px', borderRadius: 999, background: look.orange, fontSize: 18, fontVariantNumeric: 'tabular-nums'}}>0{index + 1}</span>
    {labels[index][1]}
  </div>;
}

export function SceneTransitionReel({labelled = true}: {labelled?: boolean}) {
  return <LogicalStage background={look.ink}>
    <AbsoluteFill><Shots shots={reelShots}/></AbsoluteFill>
    {labelled && <Label/>}
  </LogicalStage>;
}
