/** Palette and type for the showcase films: a fictional release tool called Relay.
 * Loud where the film speaks (type shots), calm where the product works (UI shots). */
export const look = {
  ink: '#0c0d10',
  panel: '#14161c',
  panel2: '#1c1f27',
  line: 'rgba(255,255,255,.075)',
  mutedDark: '#8b8f99',
  paper: '#f1efe9',
  card: '#ffffff',
  lineLight: '#e4e1d8',
  mutedLight: '#7a776f',
  orange: '#ff5a1f',
  blue: '#3d5afe',
  lime: '#d6ff3b',
  sans: '"DM Sans Variable", sans-serif',
  serif: '"Instrument Serif", serif',
  mono: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace',
} as const;

/** Stage rects of elements that transitions start from. Shots place those elements exactly here. */
export const anchors = {
  shippingCard: {x: 864, y: 272, width: 440, height: 250, radius: 24},
  publishButton: {x: 1352, y: 578, width: 210, height: 76, radius: 38},
  chartTile: {x: 1236, y: 60, width: 624, height: 351, radius: 28},
} as const;
