// Where a plane's pictures live under public/. A plane is the colour picture of a held frame, cut by its own
// alpha mask, or (for the plate) the colour picture with its cut-out subjects filled in. The helpers below follow
// the folder layout the preparation tools write (tools/depth/README.md); write your own PlaneSource for any other.

export type PlaneSource = {
  /** Colour picture of a held frame. */
  color: (held: number) => string;
  /** Alpha-only coverage of this plane (white = the plane). Omit for a plate. */
  mask?: (held: number) => string;
  /** The picture with its cut-out subjects filled in (push-pull), so parallax never reveals a hole. */
  fill?: (held: number) => string;
  /** Where the fill replaces the colour (alpha). Without it the fill replaces the whole picture. */
  fillMask?: (held: number) => string;
};

export type StillLayout = {color?: string; fill?: string; fillMask?: string; maskExt?: string};

/** A still painting cut into planes: `<dir>/color.jpg`, `<dir>/<plane>.png`, `<dir>/fill.jpg`, `<dir>/fillmask.png`.
 * Stills are held frame 0 for the whole shot. */
export function stillPlanes(dir: string, layout: StillLayout = {}) {
  const at = (file: string) => () => `${dir}/${file}`;
  const color = at(layout.color ?? 'color.jpg');
  return {
    /** The whole painting; `fill: true` uses the filled plate (subjects removed) so cut-outs can move over it. */
    plate: (o: {fill?: boolean} = {}): PlaneSource => o.fill
      ? {color, fill: at(layout.fill ?? 'fill.jpg'), fillMask: at(layout.fillMask ?? 'fillmask.png')} : {color},
    /** A cut-out plane by name. */
    plane: (name: string): PlaneSource => ({color, mask: at(`${name}.${layout.maskExt ?? 'png'}`)}),
  };
}

export type FootageLayout = {digits?: number; prefix?: string; colorExt?: string; fillExt?: string};

/** Footage cut into planes, one file per held film frame:
 * `<dir>/frames/f0048.jpg`, `<dir>/planes/<plane>/f0048.png`, `<dir>/fill/f0048.jpg`, `<dir>/fillmask/f0048.png`. */
export function footagePlanes(dir: string, layout: FootageLayout = {}) {
  const name = (f: number) => `${layout.prefix ?? 'f'}${String(f).padStart(layout.digits ?? 4, '0')}`;
  const color = (f: number) => `${dir}/frames/${name(f)}.${layout.colorExt ?? 'jpg'}`;
  return {
    plate: (o: {fill?: boolean; fillMask?: string} = {}): PlaneSource => o.fill
      ? {color, fill: f => `${dir}/fill/${name(f)}.${layout.fillExt ?? 'jpg'}`, fillMask: f => `${dir}/${o.fillMask ?? 'fillmask'}/${name(f)}.png`}
      : {color},
    plane: (plane: string): PlaneSource => ({color, mask: f => `${dir}/planes/${plane}/${name(f)}.png`}),
  };
}
