import React, {useLayoutEffect, useRef, useState} from 'react';
import {AbsoluteFill, Composition, cancelRender, continueRender, delayRender, registerRoot, staticFile} from 'remotion';
import {TaleframeEffects} from '../src/kit/TaleframeEffects';
import {applyTaleframeEffects, disposeTaleframeEffects, effectFrame, type EffectsSettings} from '../src/taleframe/effects/adapter';
import {effectExamples} from '../src/examples/EffectsGallery';

const W = 384, H = 216;
const source = (pose = 0) => {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, W, H);
  gradient.addColorStop(0, '#174367'); gradient.addColorStop(.5, '#cc7755'); gradient.addColorStop(1, '#eddea7');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 32; i++) {
    ctx.fillStyle = i % 2 ? '#112e39' : '#eed8a3';
    ctx.beginPath(); ctx.arc((i * 71 + pose) % W, (i * 37 + pose * .5) % H, 5 + i % 20, 0, Math.PI * 2); ctx.fill();
  }
  return ctx;
};
const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => a.length === b.length && a.every((value, index) => value === b[index]);
const pixels = (ctx: CanvasRenderingContext2D) => ctx.getImageData(0, 0, W, H).data;
const run = (effects: EffectsSettings, frame: number, pose = 0) => {const ctx = source(pose); applyTaleframeEffects(ctx, effects, frame, 60); return {ctx, data: pixels(ctx)};};

const EffectChecks = () => {
  const [handle] = useState(() => delayRender('Check native GPU effects'));
  const canvas = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    try {
      const baseline = pixels(source());
      const results: {name: string; changed: boolean; deterministic: boolean; maxDiff: number; changedBytes: number}[] = [];
      const target = canvas.current!.getContext('2d')!;
      for (const [i, example] of effectExamples.entries()) {
        const first = run(example.effects, 62);
        run(example.effects, 201, 201);
        const seeked = run(example.effects, 62);
        const maxDiff = first.data.reduce((max, value, index) => Math.max(max, Math.abs(value - seeked.data[index])), 0);
        const changedBytes = first.data.reduce((count, value, index) => count + Number(value !== seeked.data[index]), 0);
        results.push({name: example.name, changed: !same(first.data, baseline), deterministic: same(first.data, seeked.data), maxDiff, changedBytes});
        target.drawImage(first.ctx.canvas, (i % 4) * W, Math.floor(i / 4) * H);
      }
      const disabledIdentity = same(run({}, 0).data, baseline);
      const pureHold: EffectsSettings = {stopmotion: {enabled: true, fps: 12, jitter: 0, rotation: 0, boil: 0, texture: 0, exposure: 0}};
      const heldFrames = [0, 1, 4, 5, 9, 10].map(frame => effectFrame(frame, 60, W, H, pureHold).frame);
      const heldOnlyIdentity = same(run(pureHold, 3).data, baseline);
      const a = run({order: ['grain', 'duotone'], grain: {enabled: true}, duotone: {enabled: true}}, 32).data;
      const b = run({order: ['duotone', 'grain'], grain: {enabled: true}, duotone: {enabled: true}}, 32).data;
      const orderChangesPixels = !same(a, b);
      const report = {disabledIdentity, heldOnlyIdentity, heldFrames, orderChangesPixels, effects: results};
      if (!disabledIdentity || !heldOnlyIdentity || !orderChangesPixels || results.some(result => !result.changed || !result.deterministic)) throw new Error(JSON.stringify(report));
      console.log('EFFECTS_QA_REPORT:' + JSON.stringify(report));
      continueRender(handle);
    } catch (error) {cancelRender(error);}
    return () => disposeTaleframeEffects();
  }, [handle]);
  return <canvas ref={canvas} width={W * 4} height={H * 2} />;
};

const ErrorCheck = () => <AbsoluteFill><TaleframeEffects source={staticFile('this-image-does-not-exist.png')} effects={{watercolor: {enabled: true}}} /></AbsoluteFill>;
registerRoot(() => <>
  <Composition id="Effects-QA" component={EffectChecks} width={W * 4} height={H * 2} fps={60} durationInFrames={1} />
  <Composition id="Effects-Error-QA" component={ErrorCheck} width={384} height={216} fps={60} durationInFrames={1} />
</>);
