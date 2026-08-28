/*
Runtime SDF glyph atlas (TinySDF-style, no deps): glyphs are rasterized
on demand with canvas 2D, converted to a signed distance field via the
Felzenszwalb–Huttenlocher Euclidean distance transform, and shelf-packed
into a single r8unorm texture uploaded incrementally with writeTexture.

Distances are encoded so the glyph edge lands at sample value 0.5 — the
label fragment shader smooths around 0.5 with fwidth-based AA.  The AA is
scale-free; the *letterform* is not (round 94): raster + EDT quantization
error is baked into the field at raster resolution, so it magnifies with
displayed px / raster px — which is why the atlas is zoom-tiered.  The
base tier rasters at 32 px per glyph; sustained zoom past the promotion
threshold re-rasters every glyph in use at 64 px (`setTier`), halving
every baked artifact's on-screen size at a given zoom.  Metrics are
always reported in *base-tier* SDF px regardless of tier, so layout, the
shaping memo and the glyph-run math never see the raster resolution.
*/

import { TEXTURE_USAGE } from './webgpu-constants.mjs';

/** rasterized glyph size at the base tier; on-screen glyphs scale from
 * this via the SDF, and all metrics are reported in these units */
export const SDF_FONT_SIZE = 32;
/** padding around the glyph ink, base-tier px — room for the distance
 * halo (scaled by the tier at raster time, so the halo stays a constant
 * fraction of the em) */
export const SDF_PAD = 6;
/** distance range encoded into [0,1], base-tier px (scaled by the tier
 * at raster time — the field always spans SDF_RADIUS/SDF_FONT_SIZE em,
 * so outline-width conversions are tier-free) */
export const SDF_RADIUS = 8;
/** normalized sample value at the glyph edge */
export const SDF_CUTOFF = 0.5;
/** the highest raster tier (round 94): tier 2 doubles the raster
 * (64 px per glyph) and the atlas edge (2048), halving the on-screen
 * size of raster/EDT quantization error at a given zoom.  One extra
 * tier, judged on the round's close-up goldens; promotion is one-way,
 * so zoom cycles cannot churn shelves. */
export const SDF_TIER_MAX = 2;

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
 * `radius` is the encoded distance range in raster px (the base-tier
 * SDF_RADIUS by default; a promoted tier scales it so the field spans
 * the same fraction of the em).
 */
export const computeSdf = (
  alpha: ArrayLike<number>,
  w: number,
  h: number,
  radius: number = SDF_RADIUS,
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
    // edge (d = 0) lands at SDF_CUTOFF; ±radius/2 px covers the full byte range
    const byte = Math.round(255 - 255 * (d / radius + SDF_CUTOFF));

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
  /** the r8unorm shelf-packed atlas.  Its identity survives font
   * changes, but a tier promotion grows it (1024 → 2048) and replaces
   * the object — bind groups key on `generation` to follow the swap. */
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

  /** current raster tier (round 94): glyphs raster at
   * SDF_FONT_SIZE × tier px into an ATLAS_SIZE × tier-edge texture;
   * metrics stay in base-tier SDF px */
  tier: number;
  /** bumped whenever `texture` is replaced (tier growth), so cached
   * bind groups holding a view of the old texture rebuild */
  generation: number;

  private device: GPUDevice;
  private canvas: HTMLCanvasElement | OffscreenCanvas;
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
    this.tier = 1;
    this.generation = 0;

    this.texture = this.createTexture();

    this.sampler = device.createSampler({
      label: 'cy-gpu:glyph-sampler',
      magFilter: 'linear',
      minFilter: 'linear',
    });

    // a worker host (round 86.3) has no document; OffscreenCanvas
    // rasterizes identically for the atlas's greyscale coverage reads.
    // Sized (and resized on tier changes) by reset(), which also owns
    // the 2d state — a canvas resize clears it.
    const canvas =
      typeof document !== 'undefined'
        ? document.createElement('canvas')
        : new OffscreenCanvas(SDF_FONT_SIZE * 4, ROW_HEIGHT);

    const ctx = canvas.getContext('2d', {
      willReadFrequently: true,
    }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;

    if (ctx == null) {
      throw new Error(
        'Could not get a 2d canvas context for glyph rasterization',
      );
    }

    this.canvas = canvas;
    this.ctx = ctx;

    this.fontFamily = '';
    this.fontStyle = 'normal';
    this.fontWeight = 'normal';
    this.ascent = 0;
    this.setFont('sans-serif');
  }

  /** the current tier's atlas edge, raster px */
  private edge(): number {
    return ATLAS_SIZE * this.tier;
  }

  private createTexture(): GPUTexture {
    return this.device.createTexture({
      label: 'cy-gpu:glyph-atlas',
      size: { width: this.edge(), height: this.edge() },
      format: 'r8unorm',
      usage: TEXTURE_USAGE.TEXTURE_BINDING | TEXTURE_USAGE.COPY_DST,
    });
  }

  /**
   * Switch the raster tier (round 94): re-rasters every glyph at
   * SDF_FONT_SIZE × tier px.  Growing past tier 1 replaces the texture
   * with one at the covering edge (2048 for tier 2) and bumps
   * `generation`, so bind-group caches keyed on it rebuild; the old
   * texture is destroyed (WebGPU defers actual release past in-flight
   * work).  The caller must rebuild every glyph run before the next
   * draw — `LabelLayer.maybePromote` marks all labels dirty, exactly
   * the font-loading re-raster's sequencing, so runs never point a live
   * frame at stale UVs.  No-op for the current tier; clamped to
   * [1, SDF_TIER_MAX].
   */
  setTier(tier: number): void {
    const next = Math.max(1, Math.min(SDF_TIER_MAX, Math.round(tier)));

    if (next === this.tier) {
      return;
    }

    const oldEdge = this.edge();

    this.tier = next;

    if (this.edge() !== oldEdge) {
      const old = this.texture;

      this.texture = this.createTexture();
      this.generation++;
      old.destroy();
    }

    this.reset();
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
    const tier = this.tier;
    const w = SDF_FONT_SIZE * 4 * tier;
    const h = ROW_HEIGHT * tier;

    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }

    // a canvas resize clears the 2d state, so every reset re-applies it
    // rather than trusting what construction set
    this.ctx.textBaseline = 'alphabetic';
    this.ctx.fillStyle = '#000';
    this.ctx.font = `${this.fontStyle} ${this.fontWeight} ${SDF_FONT_SIZE * tier}px ${this.fontFamily}`;
    this.cache.clear();
    this.penX = 0;
    this.penY = 0;
    this.full = false;

    const m = this.ctx.measureText('Mg');

    this.ascent =
      Math.ceil(m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent) / tier;
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
    const tier = this.tier;
    const measured = ctx.measureText(ch);
    // metrics are reported in base-tier SDF px whatever the raster tier,
    // so consumers (layout, the shaping memo, the run math) are tier-free
    const advance = measured.width / tier;

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

    // raster px from here down to the writeTexture; the metrics
    // normalize back to base-tier SDF px at the end
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

    const pad = SDF_PAD * tier;
    const rowH = ROW_HEIGHT * tier;
    const edge = this.edge();
    const cellW = inkW + 2 * pad;
    const cellH = Math.min(inkH + 2 * pad, rowH);

    if (this.full) {
      return null;
    }

    if (this.penX + cellW > edge) {
      this.penX = 0;
      this.penY += rowH;
    }

    if (this.penY + rowH > edge) {
      this.full = true;
      // eslint-disable-next-line no-console
      console.warn(
        'cytoscape: the glyph atlas is full; further new glyphs will not render',
      );

      return null;
    }

    ctx.clearRect(0, 0, cellW, cellH);
    ctx.fillText(ch, pad + left, pad + asc);

    const image = ctx.getImageData(0, 0, cellW, cellH).data;
    const alpha = new Uint8Array(cellW * cellH);

    for (let i = 0; i < alpha.length; i++) {
      alpha[i] = image[i * 4 + 3];
    }

    const sdf = computeSdf(alpha, cellW, cellH, SDF_RADIUS * tier);

    this.device.queue.writeTexture(
      { texture: this.texture, origin: { x: this.penX, y: this.penY } },
      sdf,
      { bytesPerRow: cellW },
      { width: cellW, height: cellH },
    );

    const metrics: GlyphMetrics = {
      advance,
      planeX: (-left - pad) / tier,
      planeY: (-asc - pad) / tier,
      w: cellW / tier,
      h: cellH / tier,
      u0: this.penX / edge,
      v0: this.penY / edge,
      u1: (this.penX + cellW) / edge,
      v1: (this.penY + cellH) / edge,
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
