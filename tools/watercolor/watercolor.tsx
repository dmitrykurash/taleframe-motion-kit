import React, {useEffect, useRef, useState} from 'react';
import {Composition, cancelRender, continueRender, delayRender, registerRoot, staticFile} from 'remotion';
import {applyPaintEffects, disposePaintEffects} from './paint/render';
import {DEFAULT_WATERCOLOR, normalizeWatercolor} from './paint/model';

type Props = {source: string; width: number; height: number; blur: number; settings: Record<string, number>};

const Watercolor: React.FC<Props> = ({source, width, height, blur, settings}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [handle] = useState(() => delayRender('Watercolor still', {timeoutInMilliseconds: 120000}));
  useEffect(() => {
    let disposed = false;
    (async () => {
      const image = new Image();
      image.src = staticFile(source);
      await image.decode();
      if (disposed) return;
      const ctx = ref.current!.getContext('2d', {alpha: true});
      if (!ctx) throw new Error('Cannot create the watercolor staging canvas.');
      // Enlarge the input before pre-blur so the blurred edges remain covered.
      const pad = Math.ceil(blur * 4);
      const scale = Math.max((width + 2 * pad) / image.width, (height + 2 * pad) / image.height);
      ctx.filter = blur > 0 ? `blur(${blur}px)` : 'none';
      ctx.drawImage(image, (width - image.width * scale) / 2, (height - image.height * scale) / 2,
        image.width * scale, image.height * scale);
      ctx.filter = 'none';
      const watercolor = normalizeWatercolor({...DEFAULT_WATERCOLOR, paper: 0, ...settings, enabled: true});
      // Undefined pigment omits the separate granulation stage. Time is fixed;
      // the Taleframe editor/compositor and temporal pipeline are not invoked.
      applyPaintEffects(ctx, watercolor, undefined, width, height, 0, {num: 60, den: 1});
      ctx.getImageData(0, 0, 1, 1);
      console.log('WATERCOLOR_SETTINGS ' + JSON.stringify(watercolor));
      continueRender(handle);
    })().catch(cancelRender);
    return () => {disposed = true; disposePaintEffects();};
  }, [source, width, height, blur, settings, handle]);
  return <canvas ref={ref} width={width} height={height} style={{display: 'block', width, height}} />;
};

const Root = () => <Composition id="Watercolor" component={Watercolor} durationInFrames={1} fps={60}
  width={1920} height={1080} defaultProps={{source: 'source.png', width: 1920, height: 1080, blur: 0, settings: {}}}
  calculateMetadata={({props}) => ({width: props.width, height: props.height})} />;

registerRoot(Root);
