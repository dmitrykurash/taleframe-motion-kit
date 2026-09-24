import type {Frame, SidebarRow, Source, Block} from './ui';

/** Geometry of the demo product's window on a 1920 × 1080 stage, and helpers that turn positions inside
 * the window's main area into stage coordinates (for the camera, cursor, and transitions). */
export const WINDOW: Frame = {x: 160, y: 80, width: 1600, height: 920};
export const SIDEBAR = 312;
/** Column of the conversation inside the main area. */
export const COLUMN = {left: 140, width: 1008};
export const COMPOSER_BOTTOM = 880;

export const stagePoint = (x: number, y: number, window: Frame = WINDOW) => ({x: window.x + SIDEBAR + x, y: window.y + y});

/** Composer frame in main-area coordinates; it grows upward when a file is attached. */
export function composerFrame(attachment = false): Frame {
  const height = attachment ? 222 : 142;
  return {x: COLUMN.left, y: COMPOSER_BOTTOM - height, width: COLUMN.width, height};
}

/** Centers (stage coordinates) of the composer's controls. */
export function composerTargets(window: Frame = WINDOW) {
  const row = COMPOSER_BOTTOM - 18 - 24;
  return {
    send: stagePoint(COLUMN.left + COLUMN.width - 22 - 24, row, window),
    search: stagePoint(COLUMN.left + 22 + 44 + 10 + 62, row, window),
    agent: stagePoint(COLUMN.left + 22 + 44 + 10 + 124 + 10 + 58, row, window),
    textStart: stagePoint(COLUMN.left + 28, COMPOSER_BOTTOM - 142 + 40, window),
  };
}

export const studioRows = (open: boolean): SidebarRow[] => [
  {id: 'studio', label: 'Studio', icon: 'folder', open},
  ...(open ? [
    {id: 'interviews', label: 'Customer interviews', icon: 'chat' as const, depth: 1},
    {id: 'pricing', label: 'Pricing research', icon: 'chat' as const, depth: 1},
    {id: 'signup', label: 'Signup form', icon: 'chat' as const, depth: 1},
  ] : []),
  {id: 'weekly', label: 'Weekly notes', icon: 'chat'},
  {id: 'trip', label: 'Trip ideas', icon: 'chat'},
  {id: 'reading', label: 'Reading list', icon: 'chat'},
];

export const interviewAnswer: Block[] = [
  {kind: 'heading', text: 'Three themes from 12 interviews'},
  {kind: 'item', index: 1, text: 'Onboarding feels long. Most people stop at the fourth step.'},
  {kind: 'item', index: 2, text: 'Team pricing is unclear, especially for small studios.'},
  {kind: 'item', index: 3, text: 'People want to review work from their phone.'},
];

export const surveyAnswer: Block[] = [
  {kind: 'heading', text: 'Three changes since last quarter'},
  {kind: 'item', index: 1, text: 'Satisfaction is up from 7.4 to 8.1.'},
  {kind: 'item', index: 2, text: 'Setup time fell by a third after the new checklist.'},
  {kind: 'item', index: 3, text: 'Requests for a mobile view doubled.'},
];

export const researchSources: Source[] = [
  {title: 'Onboarding benchmarks, 2026', domain: 'research.example', tint: '#5b6cff'},
  {title: 'Time to first value', domain: 'journal.example', tint: '#179a55'},
  {title: 'Why users leave in week one', domain: 'blog.example', tint: '#e8833a'},
  {title: 'Designing the first session', domain: 'design.example', tint: '#8a5cf6'},
];

export const researchAnswer: Block[] = [
  {kind: 'text', text: 'Aim for under five minutes to the first useful result [1]. Products that deliver value in the first session keep about 30% more people after a month [2][4].'},
];
