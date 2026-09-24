/** Geometry helpers for flying through shapes. Pure functions, except `rasterizeLetters` (canvas). */

const INF = 1e20;

/** 1D squared distance transform (Felzenszwalb & Huttenlocher) of sampled function f. */
function transform1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  let k = 0;
  v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Distance (in mask pixels) from every inside pixel to the nearest outside pixel. Pixels beyond the
 * mask border count as outside. `inside[i]` is nonzero for inside pixels. */
export function insideDistance(inside: Uint8Array, width: number, height: number): Float64Array {
  if (inside.length !== width * height) throw new Error('Mask size does not match width × height.');
  const w = width + 2, h = height + 2, grid = new Float64Array(w * h);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    grid[(y + 1) * w + x + 1] = inside[y * width + x] ? INF : 0;
  }
  const size = Math.max(w, h), f = new Float64Array(size), d = new Float64Array(size);
  const v = new Int32Array(size), z = new Float64Array(size + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    transform1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    transform1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
  const out = new Float64Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) out[y * width + x] = Math.sqrt(grid[(y + 1) * w + x + 1]);
  return out;
}

/** The inside point farthest from any edge, and that distance (the largest inscribed circle). */
export function deepestPoint(inside: Uint8Array, width: number, height: number): {x: number; y: number; radius: number} {
  const distance = insideDistance(inside, width, height);
  let best = -1, radius = 0;
  for (let i = 0; i < distance.length; i++) if (distance[i] > radius) {radius = distance[i]; best = i;}
  if (best < 0) throw new Error('The portal shape has no filled pixels. Check the font and text.');
  return {x: best % width + .5, y: Math.floor(best / width) + .5, radius};
}

export type PlacedLetter = {character: string; x: number};

/** Rasterize letters (baseline y, individual x positions) into an inside mask at `scale` of the stage. */
export function rasterizeLetters(letters: readonly PlacedLetter[], y: number, font: string, scale: number,
  stage = {width: 1920, height: 1080}): {inside: Uint8Array; width: number; height: number} {
  const width = Math.ceil(stage.width * scale), height = Math.ceil(stage.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) throw new Error('Canvas 2D is unavailable for portal text geometry.');
  ctx.scale(scale, scale);
  ctx.font = font; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
  for (const letter of letters) ctx.fillText(letter.character, letter.x, y);
  const data = ctx.getImageData(0, 0, width, height).data, inside = new Uint8Array(width * height);
  for (let i = 0; i < inside.length; i++) inside[i] = data[i * 4 + 3] > 127 ? 1 : 0;
  return {inside, width, height};
}

/** Pure zoom about a fixed point F that maps rect R onto (covering) a frame. */
export function coverZoom(rect: {x: number; y: number; width: number; height: number}, frame = {width: 1920, height: 1080}) {
  if (!(rect.width > 0 && rect.height > 0)) throw new Error('Portal rect needs a positive width and height.');
  const scale = Math.max(frame.width / rect.width, frame.height / rect.height);
  const cx = rect.x + rect.width / 2, cy = rect.y + rect.height / 2;
  if (scale <= 1.0001) return {scale: 1, fixed: {x: cx, y: cy}};
  return {scale, fixed: {x: (scale * cx - frame.width / 2) / (scale - 1), y: (scale * cy - frame.height / 2) / (scale - 1)}};
}
