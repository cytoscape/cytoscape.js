import type { GlyphMetrics } from './glyph-atlas.mjs';

/*
Pure single-line glyph layout (Node-testable with fake metrics): places
glyph quads for a label, horizontally centered about x = 0 with y = 0 at
the top of the text block.  All units are SDF px; callers scale by
fontSize / SDF_FONT_SIZE.  Newlines are treated as spaces (single-line
labels are a documented pass-1 constraint); glyphs missing from the atlas
are skipped.
*/

export interface LaidGlyph {
  x: number;
  y: number;
  w: number;
  h: number;
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/**
 * Lays out one line of text as glyph quads in SDF px.  Advances are
 * accumulated first so the run's total width is known, then each quad is
 * shifted by -width/2 — the result is centred on x = 0 with y = 0 at the
 * block top, which is the origin the label pipeline expects.
 *
 * @param text — the label's text; newlines and tabs collapse to spaces
 * @param metricsFor — atlas lookup, returning null when the glyph cannot
 * be rasterised (atlas full, unrenderable); such glyphs are dropped, and
 * they contribute no advance
 * @param ascent — the font ascent in SDF px, added to every glyph's
 * plane offset to put the baseline below the block top
 * @returns the drawable quads only — whitespace advances the pen but
 * emits nothing
 */
export const layoutLabel = (
  text: string,
  metricsFor: (ch: string) => GlyphMetrics | null,
  ascent: number,
): LaidGlyph[] => {
  const placed: { m: GlyphMetrics; pen: number }[] = [];
  let width = 0;

  for (const raw of text) {
    const ch = raw === '\n' || raw === '\t' ? ' ' : raw;
    const m = metricsFor(ch);

    if (m == null) {
      continue;
    } // atlas full or unrenderable: skip

    placed.push({ m, pen: width });
    width += m.advance;
  }

  const glyphs: LaidGlyph[] = [];

  for (const { m, pen } of placed) {
    if (m.w <= 0) {
      continue;
    } // advance-only (whitespace)

    glyphs.push({
      x: pen + m.planeX - width / 2,
      y: ascent + m.planeY,
      w: m.w,
      h: m.h,
      u0: m.u0,
      v0: m.v0,
      u1: m.u1,
      v1: m.v1,
    });
  }

  return glyphs;
};
