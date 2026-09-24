/** Tokens for the demo product: an unnamed desktop AI workspace. It has no name, logo, or brand on purpose;
 * the films sell what it does. Light for the explainer and the kit reel, dark for the launch. */
export type WorkspaceTheme = {
  canvas: string; window: string; sidebar: string; hairline: string; text: string; secondary: string; tertiary: string;
  bubble: string; composer: string; control: string; controlText: string; accent: string; accentSoft: string;
  success: string; successSoft: string; code: string; shadow: string; selected: string; dark: boolean;
};

export const light: WorkspaceTheme = {
  canvas: '#f2f2f4', window: '#ffffff', sidebar: '#f7f7f8', hairline: 'rgba(15,15,20,.07)', text: '#111114',
  secondary: '#6c6c72', tertiary: '#a3a3aa', bubble: '#f1f1f3', composer: '#ffffff', control: '#111114', controlText: '#ffffff',
  accent: '#2f63ff', accentSoft: 'rgba(47,99,255,.09)', success: '#179a55', successSoft: 'rgba(23,154,85,.1)', code: '#f6f6f8',
  shadow: '0 50px 120px rgba(20,20,40,.12), 0 6px 18px rgba(20,20,40,.05)', selected: 'rgba(15,15,20,.055)', dark: false,
};

export const dark: WorkspaceTheme = {
  canvas: '#000000', window: '#0e0e10', sidebar: '#131316', hairline: 'rgba(255,255,255,.075)', text: '#f4f4f6',
  secondary: '#9a9aa2', tertiary: '#5d5d65', bubble: '#1b1b1f', composer: '#161619', control: '#f4f4f6', controlText: '#0e0e10',
  accent: '#7c9cff', accentSoft: 'rgba(124,156,255,.14)', success: '#3fd58a', successSoft: 'rgba(63,213,138,.12)', code: '#17171a',
  shadow: '0 60px 160px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04)', selected: 'rgba(255,255,255,.06)', dark: true,
};

export const fonts = {
  sans: '"Inter Variable", "Inter", system-ui, sans-serif',
  serif: '"Instrument Serif", serif',
  mono: '"Geist Mono Variable", ui-monospace, monospace',
  display: '"DM Sans Variable", sans-serif',
} as const;
