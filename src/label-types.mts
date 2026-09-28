/*
The label glyph types (131.1): how the atlas places a glyph and where a
laid-out glyph lands.  Their own module, outside `render/`, because the
store's label wrap (`label-wrap.mts`) is typed by them and a headless
build must reach nothing under `render/`, not even for a type.  The
atlas (`render/glyph-atlas.mts`) and the layout
(`render/label-layout.mts`) implement them and re-export them.
*/

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

/** One glyph quad of a laid-out line, in SDF px (`render/label-layout.mts`). */
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
