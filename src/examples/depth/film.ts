// Painted-Depth: a short depth film made from the three demo paintings in public/demo/depth/.
//
// A lake at dawn, a sitting room, a harbour at dusk. Each painting is cut into planes (tools/depth) and painted in
// loose oil; a camera travels forward through each stack. The lake passes through its sun into the room's window,
// a render-status card arrives out of the room's depth and the camera dives through its badge into the harbour.

/* Style sheet · handmade, painted (docs/film-language.md)
 * Palette   the paintings' own light: a gold dawn, a lamp-lit amber room, a blue-grey harbour; white ink over a soft
 *           dark scrim; #0b0a09 under everything; the finish's light cool-shadow, warm-highlight duotone.
 * Type      Instrument Serif ink type in groups set around each subject: display 108–150 px, answers 50–70 px.
 * Motion    the camera travels forward through the planes and a little sideways; pictures on twos, cuts and type on
 *           the live clock; words ink in out of the depth and lift away like pigment.
 * Cuts      every cut travels through something in the picture: the sun into the window (watercolor), the card's
 *           badge into the harbour (ink).
 * Pacing    three shots of 6–9 s; each heading, then the card, then the next scene, never overlapping. */
import {
  anchorOnScreen, cameraPath, depthConfig, depthEase, dustMotes, matchCamera, passage, passLens, stillPlanes,
  uiAnchor, uiFocus, looseOil, paintedFinish, SWIRL_LENS, WATERCOLOR_BROAD,
  type DepthCamera, type DepthCut, type DepthFilmSpec, type DepthShot, type DepthUILayer, type Ellipse, type InkLine,
} from '../../kit';
import anchors from '../../../public/demo/depth/anchors.json';
import {statusCard, statusCardAnchor, type StatusCardOptions} from './card';

export const config = depthConfig();            // 1920 × 1080 stage, 24 fps, pictures on twos
const W = config.width, H = config.height;

type Anchor = {x: number; y: number; rx: number; ry: number};
/** An anchor from anchors.json as a focus ellipse (plane uv), grown by k. */
const ellipse = (a: Anchor, k = 1): Ellipse => [a.x, a.y, a.rx * k, a.ry * k];
/** An anchor in stage px on its plane at rest. */
const point = (a: Anchor) => ({x: a.x * W, y: a.y * H});
const lerp = (a: number, b: number, u: number) => a + (b - a) * u;

const lake = stillPlanes('demo/depth/lake');
const room = stillPlanes('demo/depth/room');
const harbour = stillPlanes('demo/depth/harbour');
const A = {lake: anchors.lake.anchors, room: anchors.room.anchors, harbour: anchors.harbour.anchors};

/** Loose oil (strokes twice the preset's size, much less detail outside focus) over the broad watercolor brush. */
const OIL = looseOil(WATERCOLOR_BROAD);

// The edit, in film seconds. Cut windows run on the live 24 fps clock; the shader spans sit inside them.
export const T = {
  lake: [0, 6.6] as [number, number],
  cut1: [5.3, 6.6] as [number, number], shader1: [5.5, 6.45] as [number, number],
  room: [5.3, 14.2] as [number, number],
  card: 10.15, dive: 13,
  cut2: [13, 14.2] as [number, number], shader2: [13.2, 14.1] as [number, number],
  harbour: [13, 22] as [number, number],
};

// ---------------------------------------------------------------------------------------------------------------
// The lake at dawn: forward over the water and a little sideways; the camera then steers into the sun.

const SUN = point(A.lake.sun);
const lakeTravel = cameraPath([
  {t: 0, z: 0, x: 0, y: 0, fx: .52, fy: .56},
  {t: 3, z: .075, x: 26},
  {t: 5.3, z: .15, x: 52, y: -8},
  {t: 6.6, z: .2, x: 68},
]);
const lakeCam = passage(lakeTravel, {dive: {at: 5.2, to: () => A.lake.sun, dur: 1.4, push: .24}});

const lakeLines: InkLine[] = [{
  start: .8, end: 4.95, seed: 3,
  groups: [
    {text: 'Every painting', x: 250, y: 318, size: 124, align: 'left', pivot: 'left', drift: [14, -4], growth: 1.12, scrim: .5},
    {text: 'has a far shore.', x: 1680, y: 560, size: 70, align: 'right', pivot: 'right', delay: .7, arrive: 'right',
      drift: [-16, 0], growth: 1.1, exit: 'flight', scrim: .35},
  ],
}];

const lakeShot: DepthShot = {
  id: 'lake', window: T.lake, paint: OIL, lens: SWIRL_LENS,
  layers: [
    {id: 'plate', source: lake.plate({fill: true}), depth: 1, focus: [ellipse(A.lake.sun, 2.2)]},
    {id: 'trees', source: lake.plane('trees'), depth: .93, seed: 11},
    {id: 'mist', source: lake.plane('mist'), depth: .82, seed: 21, brush: 1.2},
    {id: 'moorings', source: lake.plane('moorings'), depth: .7, seed: 31, brush: .8, focus: [ellipse(A.lake.boat, 1.3)],
      look: passLens(2.6, 4)},
    {id: 'reeds', source: lake.plane('reeds'), depth: .44, seed: 41, ghost: true, look: passLens(2.2, 3.4)},
  ],
  camera: lakeCam,
  // Rack focus from the far shore to the boat as the second phrase arrives.
  focus: t => lerp(.95, .7, depthEase((t - 2.2) / 1.6)),
  aperture: 3,
  motes: [
    {after: 2, field: dustMotes({seed: 3, count: 70, depth: [.5, .98], focus: .8})},
    {after: 4, field: dustMotes({seed: 5, count: 26, depth: [.3, .5], focus: .8, size: [1.2, 3], periphery: true})},
  ],
  lines: lakeLines,
};

// ---------------------------------------------------------------------------------------------------------------
// The sitting room: it opens out of its window (matched onto the lake's sun), pulls back, then a render-status card
// arrives out of the depth; the camera dives through the card's badge.

const WINDOW = point(A.room.window);
/** Where the sun sits on screen as the watercolor opens: the room's window starts exactly there. */
const sunAtCut = anchorOnScreen(SUN, 1, lakeCam((T.shader1[0] + T.shader1[1]) / 2), config);
/** The camera that puts the window on the sun (its focus of expansion is the window, like the passage's opening). */
const windowMatch = matchCamera({x: sunAtCut.x * W, y: sunAtCut.y * H}, WINDOW, 1, config);

const roomTravel = cameraPath([
  {t: T.room[0], z: 0, x: 0, y: 0, fx: .58, fy: .46},
  {t: 9.5, z: .06, x: -18},
  {t: T.dive, z: .1, x: -26},
  {t: T.room[1], z: .12},
]);
const card: StatusCardOptions = {
  start: T.card, x: 690, y: 312, width: 540,
  title: 'Painting the harbour', checking: 'Checking the planes', ready: 'Ready to film',
  rows: [
    {label: 'Depth measured', detail: 'near to far'}, {label: 'Planes cut', detail: '4 planes'},
    {label: 'Gaps filled', detail: 'push-pull'}, {label: 'Strokes laid', detail: 'loose oil'},
  ],
  lead: .55, step: .38,
};
const cardAnchor = statusCardAnchor(card);
const cardUV = {x: cardAnchor.x / W, y: cardAnchor.y / H};
const cardLayer: DepthUILayer = {
  source: statusCard(card), window: [T.card, T.dive + .85],
  enter: {at: T.card, dur: .7}, exit: {at: T.dive, dur: .8, kind: 'dive'},
};
const openRoom = passage(roomTravel, {
  open: {at: T.shader1[0], from: A.room.window, dur: 1.6, push: .3},
  dive: {at: T.dive, to: () => cardUV, dur: .9, push: .3},
});
/** The matched start: the window sits exactly on the sun, then eases to the room's own path (faster than the
 * push-back, so the near planes never pull away from the frame edges). matchCamera's sideways shift is for its own
 * small push; a plane's shift on screen is x / (depth − z), so it is rescaled to the passage's push at every frame. */
const roomCam = (t: number): DepthCamera => {
  const c = openRoom(t), u = Math.pow(1 - depthEase((t - T.shader1[0]) / 1.6), 2);
  const k = (1 - c.z) / (1 - windowMatch.z);
  return {...c, x: lerp(c.x, windowMatch.x * k, u), y: lerp(c.y, windowMatch.y * k, u)};
};

const roomLines: InkLine[] = [{
  start: 6.9, end: 9.95, seed: 7,
  groups: [
    {text: 'Near things', x: 820, y: 800, size: 108, align: 'left', drift: [18, 0], growth: 1.1, scrim: .35},
    {text: 'move first.', x: 930, y: 905, size: 108, align: 'left', delay: .35, drift: [18, 0], growth: 1.1, scrim: .35},
    {text: 'Far things wait.', x: 1285, y: 330, size: 58, align: 'center', delay: .8, drift: [-10, 0], growth: 1.06,
      reveal: 'bloom', exit: 'dissolve', scrim: .3},
  ],
}];

const roomShot: DepthShot = {
  id: 'room', window: T.room, paint: OIL, lens: SWIRL_LENS,
  layers: [
    {id: 'plate', source: room.plate({fill: true}), depth: 1, focus: [ellipse(A.room.window, .8)]},
    {id: 'table', source: room.plane('table'), depth: .74, seed: 12, brush: .8, focus: [ellipse(A.room.lamp, 1.2), [.34, .5, .07, .06]],
      look: passLens(2.8, 4.2)},
    {id: 'fern', source: room.plane('fern'), depth: .57, seed: 22, brush: .8, look: passLens(2.6, 4)},
    // No ghost fill on the armchair or the harbour wall: their clear outlines (an arm, a mooring post) would come
    // back as a soft second chair and a second post. The plates' own fills are quieter there.
    {id: 'chair', source: room.plane('chair'), depth: .42, seed: 32, look: passLens(2.2, 3.4)},
  ],
  camera: roomCam,
  // Rack from the window to the lamp as the heading arrives, then to the card while it is present.
  // A gentle pull: a strongly defocused lamp beside the wall's sharp pool of lamplight reads as a second lamp.
  focus: uiFocus([cardLayer], {scene: t => lerp(1, .74, depthEase((t - 6.6) / 1.4)), ui: .45}),
  aperture: 4,
  motes: [{after: 1, field: dustMotes({seed: 8, count: 80, depth: [.45, .98], focus: .74, drift: [6, -3]})}],
  ui: [cardLayer],
  lines: roomLines,
};

// ---------------------------------------------------------------------------------------------------------------
// The harbour at dusk: it opens out of the card's badge and travels toward the lighthouse.

const harbourTravel = cameraPath([
  {t: T.harbour[0], z: 0, x: 0, y: 0, fx: .62, fy: .4},
  {t: 17, z: .1, x: 36, y: -14},
  {t: T.harbour[1], z: .22, x: 84, y: -40, fx: .72, fy: .24},
]);
const harbourCam = passage(harbourTravel, {open: {at: T.shader2[0], from: cardUV, dur: 1.5, push: .3}});

const harbourLines: InkLine[] = [{
  start: 15, end: 18.35, seed: 11,
  groups: [
    {text: 'Paint it once.', x: 250, y: 300, size: 118, align: 'left', pivot: 'left', drift: [10, 0], growth: 1.12, scrim: .4, exit: 'rush'},
    {text: 'Then go through it.', x: 1000, y: 700, size: 64, align: 'left', delay: .8, arrive: 'right', drift: [-12, 0], growth: 1.08, scrim: .45},
  ],
}, {
  start: 18.75, end: 21.85, seed: 13,
  groups: [
    {text: 'Painted depth', x: 960, y: 560, size: 150, align: 'center', growth: 1.14, reveal: 'stamp', scrim: .45,
      emphasis: [{word: 1, kind: 'glint', at: 1.2}]},
    {text: 'pictures you can step into', x: 960, y: 660, size: 50, align: 'center', delay: .7, growth: 1.08, scrim: .3, tracking: .02},
  ],
}];

const harbourShot: DepthShot = {
  id: 'harbour', window: T.harbour, paint: OIL, lens: SWIRL_LENS,
  // The harbour's mist plane is left out: its luminance key has holes where the mooring post and the boat stand in
  // the mist, and at the mist's depth those holes drift off their subjects as a second, darker post and mast.
  layers: [
    {id: 'plate', source: harbour.plate({fill: true}), depth: 1},
    {id: 'headland', source: harbour.plane('headland'), depth: .9, seed: 13,
      focus: [ellipse(A.harbour.lamp, 2), ellipse(A.harbour.lighthouse, 1.1)]},
    {id: 'boat', source: harbour.plane('boat'), depth: .7, seed: 33, brush: .8, focus: [ellipse(A.harbour.boat, 1.1)], look: passLens(2.6, 4)},
    {id: 'near', source: harbour.plane('near'), depth: .46, seed: 43, look: passLens(2.2, 3.4)},
  ],
  camera: harbourCam,
  // Rack from the harbour wall out to the lighthouse as the first phrase lands.
  focus: t => lerp(.5, .9, depthEase((t - 15.6) / 1.8)),
  aperture: 3.5,
  motes: [
    {after: 1, field: dustMotes({seed: 12, count: 70, depth: [.5, .98], focus: .85, color: [214, 224, 236], drift: [16, -2], alpha: [.12, .45]})},
    {after: 3, field: dustMotes({seed: 14, count: 24, depth: [.3, .5], focus: .85, color: [214, 224, 236], drift: [20, -2],
      size: [1.2, 3], alpha: [.12, .4], periphery: true})},
  ],
  lines: harbourLines,
};

// ---------------------------------------------------------------------------------------------------------------
// Cuts: through the sun into the window (watercolor), and through the card's badge into the harbour (ink).

const cuts: DepthCut[] = [
  {from: 'lake', to: 'room', window: T.cut1, shader: T.shader1,
    mix: {kind: 'watercolor', duration: .95, params: {count: 1, water: 34, pigment: 88, spread: 78, grain: 50, seed: 21}},
    center: t => {
      const sun = anchorOnScreen(SUN, 1, lakeCam(t), config);
      const u = depthEase((t - T.shader1[0]) / (T.shader1[1] - T.shader1[0]));
      return {x: lerp(sun.x, sunAtCut.x, u), y: lerp(sun.y, sunAtCut.y, u)};
    }},
  {from: 'room', to: 'harbour', window: T.cut2, shader: T.shader2,
    mix: {kind: 'ink', duration: .9, params: {spread: 40, texture: 70, wetness: 60, seed: 5, flow: 70}},
    center: t => uiAnchor(cardLayer, t, config)},
];

/** The whole film for an output scale (1 = 1920 × 1080). `watercolor` paints every oil plane in watercolor instead. */
export function paintedDepthFilm(o: {scale?: number; watercolor?: boolean} = {}): DepthFilmSpec {
  return {
    config, shots: [lakeShot, roomShot, harbourShot], cuts,
    finish: paintedFinish(o.scale ?? 1), forceWatercolor: !!o.watercolor, background: '#0b0a09',
  };
}
