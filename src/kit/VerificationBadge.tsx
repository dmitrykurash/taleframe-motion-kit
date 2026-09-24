import React from 'react';
import {arrive, mix, travel} from './motion';
import {useTime} from './text';
import {useTextMetrics} from './typography';

/** The default icon is illustrative. Replace icon + label with the app's actual trust indicator. */
export function VerificationBadge({label = 'Verified', start = 0, exit = 3, time, fontFamily = 'Arial, sans-serif',
  fontSize = 24, color = '#29744e', background = '#eef7f0', icon, size = 58,
}: {label?: string; start?: number; exit?: number; time?: number; fontFamily?: string; fontSize?: number;
  color?: string; background?: string; icon?: React.ReactNode; size?: number}) {
  const clock = useTime(), t = time ?? clock;
  const metrics = useTextMetrics(label, {fontFamily, fontSize, fontWeight: 500});
  const appear = arrive(t, start, .4), expand = arrive(t, start + .26, .65) * (1 - travel(t, exit, .5));
  const text = arrive(t, start + .43, .4) * (1 - travel(t, exit, .22));
  const vanish = travel(t, exit + .40, .32);
  const width = mix(size, size + (metrics?.width ?? 0) + 23, expand);
  return <div style={{position: 'relative', width, height: size, borderRadius: size / 2, background,
    color, overflow: 'hidden', opacity: appear * (1 - vanish), transform: `translateY(${16 * (1 - appear) - 12 * vanish}px) scale(${.9 + .1 * appear - .1 * vanish})`}}>
    <div style={{position: 'absolute', left: 0, top: 0, width: size, height: size, display: 'grid', placeItems: 'center'}}>
      {icon ?? <svg viewBox="0 0 24 24" width={size * .48} height={size * .48} fill="none">
        <path d="m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5l8-3Z" stroke="currentColor" strokeWidth="1.7"/>
        <path d="m8 12 2.5 2.5L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>}
    </div>
    <div style={{position: 'absolute', left: size - 2, top: 0, height: size, display: 'flex', alignItems: 'center',
      fontFamily, fontSize, fontWeight: 500, whiteSpace: 'nowrap', opacity: text, transform: `translateX(${8 * (1 - text)}px)`,
      filter: text < .999 ? `blur(${2 * (1 - text)}px)` : undefined}}>{label}</div>
  </div>;
}
