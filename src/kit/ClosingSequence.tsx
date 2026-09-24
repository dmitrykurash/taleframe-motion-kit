import React from 'react';
import {arrive, mix, travel} from './motion';
import {CharacterReveal, useTime} from './text';
import {useTextMetrics} from './typography';

export type ClosingSequenceProps = {
  name: string; tagline: readonly string[]; website: string; symbol?: React.ReactNode; time?: number;
  fontFamily?: string; headingFontFamily?: string; color?: string; accent?: string;
};

/** A ten-second insert on a LogicalStage. For a canonical logo, provide symbol;
 * replace the name treatment with SVG paths when the wordmark is not live text. */
export function ClosingSequence({name, tagline, website, symbol, time, fontFamily = 'Arial, sans-serif',
  headingFontFamily = 'Georgia, serif', color = '#252525', accent = '#ff7653'}: ClosingSequenceProps) {
  const clock = useTime(), t = time ?? clock;
  const metrics = useTextMetrics(name, {fontFamily, fontSize: 72, fontWeight: 600});
  const enter = arrive(t, .08, .56), expansion = arrive(t, .90, .64), out = travel(t, 3.05, .5);
  const iconSize = 82, gap = 24, fullWidth = iconSize + gap + (metrics?.width ?? 0);
  return <>
    {t < 3.55 && <div style={{position: 'absolute', left: 960 - mix(iconSize, fullWidth, expansion) / 2,
      top: 499, width: fullWidth, height: iconSize, opacity: enter * (1 - out),
      transform: `translateY(${18 * (1 - enter) - 38 * out}px)`}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: iconSize, height: iconSize, color: accent,
        display: 'grid', placeItems: 'center'}}>{symbol ?? <svg width="70" height="70" viewBox="0 0 80 80" fill="none">
        <path d="M14 18h34c15 0 23 9 23 21S63 60 48 60H14" stroke="currentColor" strokeWidth="11"/>
        <path d="m31 31 18 9-18 9Z" fill="currentColor"/>
      </svg>}</div>
      <div style={{position: 'absolute', left: iconSize + gap, top: -2}}>
        <CharacterReveal text={name} start={.90} time={t} fontFamily={fontFamily} fontSize={72} fontWeight={600} color={color}/>
      </div>
    </div>}
    {t >= 3.65 && t < 7.05 && <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center'}}>
      {tagline.map((line, i) => <CharacterReveal key={i} text={line} start={3.72 + i * .10} time={t}
        exit={6.55} fontFamily={headingFontFamily} fontSize={76} color={color}/>)}</div>}
    {t >= 7.1 && <div style={{position: 'absolute', inset: 0, display: 'grid', placeItems: 'center'}}>
      <CharacterReveal text={website} start={7.2} time={t} exit={9.35} fontFamily={headingFontFamily}
        fontSize={56} fontWeight={700} color={color}/></div>}
  </>;
}
