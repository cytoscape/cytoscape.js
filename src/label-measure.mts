/*
Round 125.1: exact label dims before the first frame.

The store estimated every label's block with a flat 0.54 em advance
(`estimateBlock`) and let the renderer's glyph build overwrite the
estimate with the laid block — which lands in the first frame *after*
the labels were set.  A layout that runs before that frame (the
`layout` option of `cytoscape()`, or any run at load — what an app
does) separated label boxes it had only estimated: on em-web 154 of
569 labels lay wider than their estimate, one by 36 px, and a
label-inclusive force run at load left 14 overlapping label pairs on a
page whose readout said 0 once the frame had laid them.

So where a 2D canvas exists — a document, or an `OffscreenCanvas` in a
worker — the store measures instead: the same `breakLines` over the
same `measureText` advances the atlas uses, at the atlas's measuring
size (`SDF_FONT_SIZE`, 32 px) scaled to the em, so the number here is
the number the label layer writes back.  Headless Node has neither and
keeps the estimate (a recorded deviation, as before).
*/
import { breakLines } from './label-wrap.mjs';
import type { WrapOpts } from './label-wrap.mjs';

/** the size glyphs are measured at, in px — the glyph atlas's own, so
 * advances agree with the laid block to the atlas's rounding */
export const MEASURE_PX = 32;

/** A per-character advance in `MEASURE_PX` units. */
export type AdvanceReader = (ch: string) => number;

/** The font a block is measured in. */
export interface LabelFont {
  family: string;
  style: string;
  weight: string;
}

interface Measurer {
  key: string;
  advanceOf: AdvanceReader;
  advances: Map<string, number>;
}

let current: Measurer | null = null;
let installed: ((font: LabelFont) => AdvanceReader | null) | null = null;
let canvasUnavailable = false;

const fontKey = (font: LabelFont): string =>
  `${font.style} ${font.weight} ${font.family}`;

/**
 * A `measureText` advance reader over a 2D canvas for the font, or
 * null where no canvas can be had (headless Node).
 */
const canvasReader = (font: LabelFont): AdvanceReader | null => {
  if (canvasUnavailable) {
    return null;
  }

  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null =
    null;

  try {
    if (typeof document !== 'undefined') {
      ctx = document.createElement('canvas').getContext('2d');
    } else if (typeof OffscreenCanvas !== 'undefined') {
      ctx = new OffscreenCanvas(MEASURE_PX * 4, MEASURE_PX * 2).getContext(
        '2d',
      );
    }
  } catch {
    ctx = null;
  }

  if (ctx == null) {
    canvasUnavailable = true;

    return null;
  }

  ctx.font = `${font.style} ${font.weight} ${MEASURE_PX}px ${font.family}`;

  return (ch) => ctx.measureText(ch).width;
};

/**
 * Install an advance reader factory in place of the canvas one — the
 * test seam (headless Node has no canvas), and the way a host with its
 * own text metrics could supply them.  `null` restores the canvas.
 *
 * @param factory — given the font, returns a reader or null to fall
 *   back to the estimate
 */
export const installAdvanceReader = (
  factory: ((font: LabelFont) => AdvanceReader | null) | null,
): void => {
  installed = factory;
  current = null;
  canvasUnavailable = false;
};

const measurerFor = (font: LabelFont): Measurer | null => {
  const key = fontKey(font);

  if (current != null && current.key === key) {
    return current;
  }

  const reader = installed != null ? installed(font) : canvasReader(font);

  if (reader == null) {
    return null;
  }

  const advances = new Map<string, number>();
  const advanceOf: AdvanceReader = (ch) => {
    let a = advances.get(ch);

    if (a === undefined) {
      a = reader(ch);
      advances.set(ch, a);
    }

    return a;
  };

  current = { key, advanceOf, advances };

  return current;
};

/**
 * Measure a label block exactly: the lines `breakLines` produces over
 * the font's real advances, in model px at the given font size.  Null
 * where no advances can be read, in which case the caller estimates.
 *
 * @param text — the label text
 * @param fontSize — the em in model px
 * @param opts — the wrap options in model px (`maxWidth` included)
 * @param font — the font to measure in
 * @returns the block's width, height and line count, or null
 */
export const measureBlock = (
  text: string,
  fontSize: number,
  opts: WrapOpts,
  font: LabelFont,
): { width: number; height: number; lines: number } | null => {
  const m = measurerFor(font);

  if (m == null) {
    return null;
  }

  const scale = fontSize / MEASURE_PX;
  // the breaker works in the advance function's units: measured px
  const lines = breakLines(text, m.advanceOf, {
    ...opts,
    maxWidth: opts.maxWidth / scale,
  });

  return {
    width: lines.reduce((w, l) => Math.max(w, l.width), 0) * scale,
    height: (lines.length - 1) * fontSize * opts.lineHeight + fontSize,
    lines: lines.length,
  };
};
