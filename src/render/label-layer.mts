import {
  GlyphAtlas,
  SDF_FONT_SIZE,
  SDF_RADIUS,
  SDF_TIER_MAX,
} from './glyph-atlas.mjs';
import { layoutLabelBlock, WRAP_NONE } from '../label-wrap.mjs';
import type { LaidBlock } from '../label-wrap.mjs';
import { GLYPH_ROTATE, GLYPH_WORDS, GlyphBuffer } from './glyph-buffer.mjs';
import type { RenderStoreView } from './host.mjs';
import type { LabelStream } from '../contract.mjs';

/**
 * The zoom-tier promotion threshold (round 94), displayed device px of
 * the em: when the largest label in use would display taller than this,
 * the atlas re-rasters at the 64 px tier.  40 px sits where the base
 * tier's baked raster error (~1 SDF px, magnified by displayed/32)
 * passes ~1.25 displayed px — visibly soft corners — while a promoted
 * raster stays sub-px up to displayed 64.  Judged on the round's
 * close-up goldens at zoom 4.
 */
export const LABEL_PROMOTE_PX = 40;

/**
 * Consumes the model's label-dirty channel each frame: lays out changed
 * labels against the SDF atlas and (re)writes their glyph runs in the
 * persistent GlyphBuffer.  Position changes never reach this layer —
 * glyphs follow their node on-GPU.
 */
export class LabelLayer {
  /** the SDF atlas every stream's quads sample; owned by this layer */
  atlas: GlyphAtlas;
  /** the node label stream, keyed by node slot */
  glyphs: GlyphBuffer;
  /** the edge label stream: same instance layout, keyed by edge slot */
  edgeGlyphs: GlyphBuffer;
  /** the end-label streams (round 13 D4), keyed by edge slot */
  sourceGlyphs: GlyphBuffer;
  /** the target end-label stream (round 13 D4), keyed by edge slot */
  targetGlyphs: GlyphBuffer;

  private store: RenderStoreView;
  /** the shaping memo (16.3): line breaking is zoom-invariant (labels
   * are model-space), so identical (text, wrap params) pairs share one
   * laid block; the cache clears with the atlas face. */
  private shapeMemo = new Map<string, LaidBlock>();
  private memoFont = '';
  /** shaping-memo hits since construction (stats) */
  memoHits = 0;
  /** shaping-memo misses since construction (stats) */
  memoMisses = 0;
  /** the largest label font size processed, model px (round 94): the
   * promotion meter's input.  Monotone — a removed label never lowers
   * it — which errs toward promoting, never toward staying soft. */
  private maxFontSize = 0;

  /**
   * Creates the atlas and all four glyph streams.  Nothing is laid out
   * here: the first process() consumes whatever the store has marked
   * label-dirty, which after a fresh load is every labelled slot.
   *
   * @param device — the device that owns the atlas texture and the four
   * glyph buffers
   * @param store — the graph store this layer reads label entries and
   * the label-dirty channel from, and writes laid dimensions back to
   */
  constructor(device: GPUDevice, store: RenderStoreView) {
    this.store = store;
    this.atlas = new GlyphAtlas(device);
    this.glyphs = new GlyphBuffer(device);
    this.edgeGlyphs = new GlyphBuffer(device);
    this.sourceGlyphs = new GlyphBuffer(device);
    this.targetGlyphs = new GlyphBuffer(device);
  }

  /** live glyph instances across all four streams (stats) */
  count(): number {
    return (
      this.glyphs.count() +
      this.edgeGlyphs.count() +
      this.sourceGlyphs.count() +
      this.targetGlyphs.count()
    );
  }

  /**
   * Rebuild every glyph run against freshly rasterized glyphs — for fonts
   * that finish loading after glyphs were cached from the fallback face.
   */
  reraster(): void {
    this.atlas.reraster();
    this.shapeMemo.clear(); // metrics may change with the real face
    this.store.markAllLabelsDirty();
  }

  /**
   * The zoom-tier promotion meter (round 94).  Given the displayed
   * device px per model px (zoom × dpr, render-scale-free — readability
   * is judged in displayed px, like the label LOD thresholds), promotes
   * the atlas to the 64 px raster tier when the largest label in use
   * would display taller than LABEL_PROMOTE_PX — the point where the
   * base raster's baked quantization error turns visibly soft.  The
   * swap reuses the font-loading re-raster's sequencing exactly: clear
   * the atlas and the shaping memo, mark every label dirty, and the
   * next frame's process() rebuilds all runs against the new raster
   * before anything draws — no mid-frame tear.  One-way by design
   * (zoom cycles must not churn shelves; a promoted atlas draws the
   * base zoom identically), so demand hysteresis is unnecessary.
   *
   * @param zoomDpr — displayed device px per model px
   * @returns whether a promotion happened (the caller schedules a frame)
   */
  maybePromote(zoomDpr: number): boolean {
    if (!this.canPromote()) {
      return false;
    }

    if (this.maxFontSize * zoomDpr <= LABEL_PROMOTE_PX) {
      return false;
    }

    this.atlas.setTier(this.atlas.tier + 1);
    this.shapeMemo.clear(); // tier rounding shifts metrics sub-px
    this.store.markAllLabelsDirty();

    return true;
  }

  /** whether a promotion is still possible (below the top tier, with at
   * least one label seen) — gates scheduling the debounced meter */
  canPromote(): boolean {
    return this.atlas.tier < SDF_TIER_MAX && this.maxFontSize > 0;
  }

  /** cumulative glyph bytes written to the GPU across all four streams
   * (stats); the atlas's own texture uploads are not counted here */
  uploadedBytes(): number {
    return (
      this.glyphs.uploadedBytes +
      this.edgeGlyphs.uploadedBytes +
      this.sourceGlyphs.uploadedBytes +
      this.targetGlyphs.uploadedBytes
    );
  }

  /** Slot compaction (19.4): every glyph instance's owner word went
   * stale — drop all runs; the store marked every label dirty, so the
   * next process() rebuilds them against the new slots.  The shaping
   * memo survives (it keys on text/wrap params, not slots). */
  onCompacted(): void {
    this.glyphs.clear();
    this.edgeGlyphs.clear();
    this.sourceGlyphs.clear();
    this.targetGlyphs.clear();
  }

  /** Rebuild glyph runs for label-dirty elements and upload; no-op when clean. */
  process(): void {
    // a font change arrives with every labelled slot already label-dirty,
    // so the reset and the rebuild land in this same pass
    this.atlas.setFont(
      this.store.labelFont,
      this.store.labelFontStyle,
      this.store.labelFontWeight,
    );

    const fontKey = `${this.store.labelFontStyle} ${this.store.labelFontWeight} ${this.store.labelFont}`;

    if (fontKey !== this.memoFont) {
      this.memoFont = fontKey;
      this.shapeMemo.clear();
    }

    this.processGroup('nodes', this.glyphs);
    this.processGroup('edges', this.edgeGlyphs);
    this.processGroup('edgeSource', this.sourceGlyphs);
    this.processGroup('edgeTarget', this.targetGlyphs);
  }

  private processGroup(group: LabelStream, glyphs: GlyphBuffer): void {
    const dirty = this.store.takeLabelDirty(group);

    for (const slot of dirty) {
      const entry = this.store.labelAt(slot, group);

      if (entry == null) {
        glyphs.set(slot, null);

        continue;
      }

      if (entry.fontSize > this.maxFontSize) {
        this.maxFontSize = entry.fontSize; // the promotion meter's input
      }

      const scale = entry.fontSize / SDF_FONT_SIZE;

      // shaping (16.3): break/justify/lay through the shared block
      // engine, memoized — maxWidth converts model px -> SDF px so the
      // memo key is scale-free like the layout itself.  Under wrap
      // 'none' the breaker ignores maxWidth entirely (25.5): drop it
      // from the key, or a font-size tween would miss (and grow the
      // memo) every tick for the default wrap mode.
      const keyWidth = entry.wrap === WRAP_NONE ? 0 : entry.maxWidth / scale;
      const memoKey =
        `${entry.wrap}|${keyWidth}|${entry.overflowWrap}|` +
        `${entry.justification}|${entry.lineHeight}|${entry.text}`;
      let block = this.shapeMemo.get(memoKey);

      if (block == null) {
        this.memoMisses++;
        block = layoutLabelBlock(
          entry.text,
          (ch) => this.atlas.metrics(ch),
          this.atlas.ascent,
          SDF_FONT_SIZE,
          {
            wrap: entry.wrap,
            maxWidth: entry.maxWidth / scale,
            overflowWrap: entry.overflowWrap,
            justification: entry.justification,
            lineHeight: entry.lineHeight,
          },
        );
        this.shapeMemo.set(memoKey, block);
      } else {
        this.memoHits++;
      }

      const laid = block.glyphs;

      // exact laid dims feed the label bb term (16.4); model px
      this.store.setLabelDims(
        slot,
        group,
        block.width * scale,
        block.height * scale,
      );

      if (laid.length === 0) {
        glyphs.set(slot, null);

        continue;
      }

      // outline width in SDF sample units: model px → raster px (/ scale)
      // → samples (/ SDF_RADIUS); clamped so it can't cross the whole range
      // D2: min-zoomed-font-size as a zoom threshold (frame.zoomDpr
      // compare in the glyph cull); 0 disables the floor
      const zoomDprMin =
        entry.minZoomedFontSize > 0
          ? entry.minZoomedFontSize / entry.fontSize
          : 0;

      // D4 end-label encoding: sign picks the end, |v| - 1 is the arc
      // offset (the +1 bias keeps offset 0 distinct from the midpoint
      // streams' 0)
      const endParam =
        group === 'edgeSource'
          ? entry.endOffset + 1
          : group === 'edgeTarget'
            ? -(entry.endOffset + 1)
            : 0;

      const outlineW =
        entry.outlineWidth > 0
          ? Math.min(entry.outlineWidth / scale / SDF_RADIUS, 0.45)
          : 0;

      // block metrics (16.3): alignment shifts and the background quad
      // use the *block* extents (advance width x line-stacked height),
      // which are also what the bb term stores — ink extents undershoot
      // multi-line blocks and made boxes hug descenders
      const blockW = block.width;
      const blockH = block.height;

      // text-halign/-valign (D3): the entry carries the node-extent base
      // (anchorX/anchorY) plus block-fraction shifts resolved here,
      // where the laid dimensions are known
      const dx =
        entry.anchorX + entry.halignShift * blockW * scale + entry.marginX;
      const dy = entry.anchorY + entry.valignShift * blockH * scale;

      // an optional solid background quad precedes the glyphs in the run
      const hasBg = ((entry.bgColor >>> 24) & 0xff) > 0;
      const count = laid.length + (hasBg ? 1 : 0);
      const scratch = new ArrayBuffer(count * GLYPH_WORDS * 4);
      const u32 = new Uint32Array(scratch);
      const f32 = new Float32Array(scratch);
      let at = 0;

      // autorotate rides bit 31 of the owner word (edge stream only); the
      // background quad carries it too, so the box rotates with its text
      const owner = (entry.rotate ? slot | GLYPH_ROTATE : slot) >>> 0;

      if (hasBg) {
        const pad = entry.bgPadding;

        u32[at] = owner;
        u32[at + 1] = entry.bgColor;
        f32[at + 2] = (-blockW / 2) * scale + dx - pad;
        f32[at + 3] = dy - pad;
        f32[at + 4] = blockW * scale + 2 * pad;
        f32[at + 5] = blockH * scale + 2 * pad;
        f32[at + 6] = -1; // u0 < 0: solid quad, no atlas sample
        f32[at + 7] = blockH * scale; // LOD height: the glyph block's
        // uv1.x carries the background shape (B6: 1 = round-rectangle);
        // the solid branch never samples the atlas, so the slot is free
        f32[at + 8] = entry.bgShape;
        f32[at + 9] = -1;
        // the outline fields double as the text-border for solid quads
        // (B6): packed border color + width in *model px* (the FS scales)
        u32[at + 10] = entry.bgBorderColor;
        f32[at + 11] = entry.bgBorderWidth;
        f32[at + 12] = zoomDprMin; // the box hides with its text
        f32[at + 13] = endParam; // and anchors with it (D4)
        f32[at + 14] = entry.rotation; // and turns with it (27.7)
        at += GLYPH_WORDS;
      }

      for (let i = 0; i < laid.length; i++) {
        const g = laid[i];

        u32[at] = owner;
        u32[at + 1] = entry.color;
        f32[at + 2] = g.x * scale + dx;
        f32[at + 3] = dy + g.y * scale;
        f32[at + 4] = g.w * scale;
        f32[at + 5] = g.h * scale;
        f32[at + 6] = g.u0;
        f32[at + 7] = g.v0;
        f32[at + 8] = g.u1;
        f32[at + 9] = g.v1;
        u32[at + 10] = entry.outlineColor;
        f32[at + 11] = outlineW;
        f32[at + 12] = zoomDprMin;
        f32[at + 13] = endParam;
        f32[at + 14] = entry.rotation; // 27.7: numeric text-rotation
        at += GLYPH_WORDS;
      }

      glyphs.set(slot, u32);
    }

    glyphs.sync();
  }

  /**
   * Destroys all four glyph streams and the atlas.  The store is not
   * owned here and is left alone; no further process() may run, since
   * the streams' buffers are gone.
   */
  destroy(): void {
    this.glyphs.destroy();
    this.edgeGlyphs.destroy();
    this.sourceGlyphs.destroy();
    this.targetGlyphs.destroy();
    this.atlas.destroy();
  }
}
