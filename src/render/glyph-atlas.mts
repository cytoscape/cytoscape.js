/*
Runtime SDF glyph atlas (TinySDF-style, no deps): glyphs are rasterized
on demand with canvas 2D, converted to a signed distance field via the
Felzenszwalb–Huttenlocher Euclidean distance transform, and shelf-packed
into a single r8unorm texture uploaded incrementally with writeTexture.

Distances are encoded so the glyph edge lands at sample value 0.5 — the
label fragment shader smooths around 0.5 with fwidth-based AA, which keeps
text crisp at any zoom from one 32px-per-glyph atlas.
*/

import { TEXTURE_USAGE } from './webgpu-constants.mjs';

/** rasterized glyph size; on-screen glyphs scale from this via the SDF */
export const SDF_FONT_SIZE = 32;
/** padding around the glyph ink, px — room for the distance halo */
export const SDF_PAD = 6;
/** distance range encoded into [0,1], px */
export const SDF_RADIUS = 8;
/** normalized sample value at the glyph edge */
export const SDF_CUTOFF = 0.5;

const ATLAS_SIZE = 1024;
const ROW_HEIGHT = Math.ceil(SDF_FONT_SIZE * 1.4) + 2 * SDF_PAD;
const INF = 1e20;

/** How a glyph is placed: sizes/offsets in SDF px, uvs normalized. */
export interface GlyphMetrics {
  /** pen advance */
  advance: number;
  /** quad left offset from the pen position (includes atlas padding) */
  planeX: number;
  /** quad top offset from the baseline (negative above) */
  planeY: number;
  /** quad size; 0 ⇒ advance-only glyph (e.g. space), no quad */
  w: number;
  h: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/**
 * Convert a rasterized alpha grid to SDF bytes (pure; exported for Node
 * tests).  255 = deep inside, ~128 at the edge, 0 = far outside.
 */
export const computeSdf = (
  alpha: ArrayLike<number>,
  w: number,
  h: number,
): Uint8Array => {
  const n = w * h;
  const gridOuter = new Float64Array(n);
  const gridInner = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const a = alpha[i] / 255;

    // antialiased edge pixels seed fractional squared distances
    gridOuter[i] =
      a >= 1 ? 0 : a <= 0 ? INF : Math.pow(Math.max(0, 0.5 - a), 2);
    gridInner[i] =
      a >= 1 ? INF : a <= 0 ? 0 : Math.pow(Math.max(0, a - 0.5), 2);
  }

  edt2d(gridOuter, w, h);
  edt2d(gridInner, w, h);

  const out = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const d = Math.sqrt(gridOuter[i]) - Math.sqrt(gridInner[i]);
    // edge (d = 0) lands at SDF_CUTOFF; ±SDF_RADIUS/2 px covers the full byte range
    const byte = Math.round(255 - 255 * (d / SDF_RADIUS + SDF_CUTOFF));

    out[i] = Math.max(0, Math.min(255, byte));
  }

  return out;
};

// 2D squared Euclidean distance transform: 1D passes over columns then rows
// (Felzenszwalb & Huttenlocher, "Distance Transforms of Sampled Functions")
const edt2d = (grid: Float64Array, w: number, h: number): void => {
  const size = Math.max(w, h);
  const f = new Float64Array(size);
  const d = new Float64Array(size);
  const z = new Float64Array(size + 1);
  const v = new Uint32Array(size);

  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      f[y] = grid[y * w + x];
    }

    edt1d(f, d, v, z, h);

    for (let y = 0; y < h; y++) {
      grid[y * w + x] = d[y];
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      f[x] = grid[y * w + x];
    }

    edt1d(f, d, v, z, w);

    for (let x = 0; x < w; x++) {
      grid[y * w + x] = d[x];
    }
  }
};

const edt1d = (
  f: Float64Array,
  d: Float64Array,
  v: Uint32Array,
  z: Float64Array,
  n: number,
): void => {
  let k = 0;

  v[0] = 0;
  z[0] = -INF;
  z[1] = INF;

  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);

    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }

    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = INF;
  }

  k = 0;

  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) {
      k++;
    }

    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
};

export class GlyphAtlas {
  /** the r8unorm shelf-packed atlas; its identity never changes, so
   * label bind groups holding a view of it survive font changes */
  texture: GPUTexture;
  /** linear/clamped sampler the label fragment shader reads the SDF with */
  sampler: GPUSampler;
  /** baseline offset from the top of a text block, SDF px */
  ascent: number;
  /** CSS font-family list glyphs raster with (one font per atlas) */
  fontFamily: string;
  /** CSS font-style the raster canvas is set to */
  fontStyle: string;
  /** CSS font-weight the raster canvas is set to */
  fontWeight: string;

  private device: GPUDevice;
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  private cache: Map<string, GlyphMetrics | null>;
  private penX: number;
  private penY: number;
  private full: boolean;

  /**
   * Allocates the atlas texture and sampler and sets up the offscreen 2D
   * canvas glyphs raster through, then seeds the font to 'sans-serif' so
   * `ascent` and the canvas font string are valid before the first
   * metrics() call.  Requires a DOM: this is the one part of the render
   * directory that cannot run headless.
   *
   * @param device — the device that owns the texture and sampler
   * @throws if a 2D canvas context cannot be obtained
   */
  constructor(device: GPUDevice) {
    this.device = device;
    this.cache = new Map();
    this.penX = 0;
    this.penY = 0;
    this.full = false;

    this.texture = device.createTexture({
      label: 'cy-gpu:glyph-atlas',
      size: { width: ATLAS_SIZE, height: ATLAS_SIZE },
      format: 'r8unorm',
      usage: TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST,
    });

    this.sampler = device.createSampler({
      label: 'cy-gpu:glyph-sampler',
      magFilter: 'linear',
      minFilter: 'linear',
    });

    // a worker host (round 86.3) has no document; OffscreenCanvas
    // rasterizes identically for the atlas's greyscale coverage reads
    const canvas =
      typeof document !== 'undefined'
        ? (() => {
            const el = document.createElement('canvas');

            el.width = SDF_FONT_SIZE * 4;
            el.height = ROW_HEIGHT;

            return el;
          })()
        : new OffscreenCanvas(SDF_FONT_SIZE * 4, ROW_HEIGHT);

    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
    }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

    if (ctx == null) {
      throw new Error(
        'Could not get a 2d canvas context for glyph rasterization',
      );
    }

    this.ctx = ctx;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000';

    this.fontFamily = '';
    this.fontStyle = 'normal';
    this.fontWeight = 'normal';
    this.ascent = 0;
    this.setFont('sans-serif');
  }

  /**
   * Switch the atlas font: clear the glyph cache and restart packing.
   * Reuses the texture object (bind groups survive); stale cells are
   * overwritten as glyphs re-raster, and every glyph run rebuilds in the
   * same label-dirty pass, so no run references old UVs.  No-op when
   * family, style and weight are all unchanged.
   */
  setFont(
    family: string,
    style: string = 'normal',
    weight: string = 'normal',
  ): void {
    if (
      family === this.fontFamily &&
      style === this.fontStyle &&
      weight === this.fontWeight
    ) {
      return;
    }

    this.fontFamily = family;
    this.fontStyle = style;
    this.fontWeight = weight;
    this.reset();
  }

  /**
   * Re-raster with the *same* family: clears the cache so glyphs that were
   * rasterized before a web font finished loading (and so cached from the
   * fallback font) rebuild against the now-loaded face.
   */
  reraster(): void {
    this.reset();
  }

  private reset(): void {
    this.ctx.font = `${this.fontStyle} ${this.fontWeight} ${SDF_FONT_SIZE}px ${this.fontFamily}`;
    this.cache.clear();
    this.penX = 0;
    this.penY = 0;
    this.full = false;

    const m = this.ctx.measureText('Mg');

    this.ascent = Math.ceil(
      m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent,
    );
  }

  /** Metrics for a glyph, rasterizing it into the atlas on first use.  Null when the atlas is full. */
  metrics(ch: string): GlyphMetrics | null {
    const cached = this.cache.get(ch);

    if (cached !== undefined) {
      return cached;
    }

    const built = this.build(ch);

    this.cache.set(ch, built);

    return built;
  }

  private build(ch: string): GlyphMetrics | null {
    const ctx = this.ctx;
    const measured = ctx.measureText(ch);
    const advance = measured.width;

    // whitespace and zero-ink glyphs advance the pen without a quad
    if (ch.trim() === '') {
      return {
        advance,
        planeX: 0,
        planeY: 0,
        w: 0,
        h: 0,
        u0: 0,
        v0: 0,
        u1: 0,
        v1: 0,
      };
    }

    const left = Math.ceil(measured.actualBoundingBoxLeft);
    const right = Math.ceil(measured.actualBoundingBoxRight);
    const asc = Math.ceil(measured.actualBoundingBoxAscent);
    const desc = Math.ceil(measured.actualBoundingBoxDescent);
    const inkW = left + right;
    const inkH = asc + desc;

    if (inkW <= 0 || inkH <= 0) {
      return {
        advance,
        planeX: 0,
        planeY: 0,
        w: 0,
        h: 0,
        u0: 0,
        v0: 0,
        u1: 0,
        v1: 0,
      };
    }

    const cellW = inkW + 2 * SDF_PAD;
    const cellH = Math.min(inkH + 2 * SDF_PAD, ROW_HEIGHT);

    if (this.full) {
      return null;
    }

    if (this.penX + cellW > ATLAS_SIZE) {
      this.penX = 0;
      this.penY += ROW_HEIGHT;
    }

    if (this.penY + ROW_HEIGHT > ATLAS_SIZE) {
      this.full = true;
      // eslint-disable-next-line no-console
      console.warn(
        'cytoscape: the glyph atlas is full; further new glyphs will not render',
      );

      return null;
    }

    ctx.clearRect(0, 0, cellW, cellH);
    ctx.fillText(ch, SDF_PAD + left, SDF_PAD + asc);

    const image = ctx.getImageData(0, 0, cellW, cellH).data;
    const alpha = new Uint8Array(cellW * cellH);

    for (let i = 0; i < alpha.length; i++) {
      alpha[i] = image[i * 4 + 3];
    }

    const sdf = computeSdf(alpha, cellW, cellH);

    this.device.queue.writeTexture(
      { texture: this.texture, origin: { x: this.penX, y: this.penY } },
      sdf,
      { bytesPerRow: cellW },
      { width: cellW, height: cellH },
    );

    const metrics: GlyphMetrics = {
      advance,
      planeX: -left - SDF_PAD,
      planeY: -asc - SDF_PAD,
      w: cellW,
      h: cellH,
      u0: this.penX / ATLAS_SIZE,
      v0: this.penY / ATLAS_SIZE,
      u1: (this.penX + cellW) / ATLAS_SIZE,
      v1: (this.penY + cellH) / ATLAS_SIZE,
    };

    this.penX += cellW;

    return metrics;
  }

  /**
   * Destroys the atlas texture.  The raster canvas and glyph cache are
   * dropped with the object; no metrics() call may follow, since a hit
   * would return UVs into a destroyed texture.
   */
  destroy(): void {
    this.texture.destroy();
  }
}
