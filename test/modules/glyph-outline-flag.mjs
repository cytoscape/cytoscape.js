import { expect } from 'chai';

import {
  GlyphBuffer,
  GLYPH_WORDS,
} from '../../src/render/glyph-buffer.mjs';

/*
Round 95 draws label outlines in their own pass, under every fill, so a
glyph's outline ring cannot bite the previous letter's ink.  The
renderer skips that pass per stream on `hasOutline()`, a count the
GlyphBuffer maintains across set/replace/clear/compact — and a stale
count fails silently in both directions: stuck-true wastes a full
second pass on every frame, stuck-false erases every outline (the fill
pass no longer draws ring coverage at all).  So the count is pinned
here through each mutation path.
*/

const mockDevice = () => ({
  createBuffer: () => ({ destroy() {} }),
  queue: {
    writeBuffer() {},
    onSubmittedWorkDone: () => Promise.resolve(undefined),
  },
});

/**
 * Build one interleaved run.  Each spec picks the three words the flag
 * reads: u0 (< 0 marks a solid background quad), packed outline color
 * (alpha in the top byte) and outline width.
 */
const run = (glyphs) => {
  const buf = new ArrayBuffer(glyphs.length * GLYPH_WORDS * 4);
  const u32 = new Uint32Array(buf);
  const f32 = new Float32Array(buf);

  glyphs.forEach(({ solid = false, color = 0, width = 0 }, i) => {
    const at = i * GLYPH_WORDS;

    u32[at] = i; // owner word: live
    f32[at + 6] = solid ? -1 : 0.25; // u0
    u32[at + 10] = color;
    f32[at + 11] = width;
  });

  return u32;
};

const OPAQUE_WHITE = 0xffffffff;
const ZERO_ALPHA_WHITE = 0x00ffffff; // alpha is the top byte

describe('glyph outline flag (round 95)', () => {
  let glyphs;

  beforeEach(() => {
    glyphs = new GlyphBuffer(mockDevice(), 4); // tiny cap: growth is exercised
  });

  it('starts false and stays false for outline-free runs', () => {
    expect(glyphs.hasOutline()).to.be.false;

    glyphs.set(0, run([{}, {}, {}]));

    expect(glyphs.hasOutline()).to.be.false;
  });

  it('a width without alpha, or alpha without width, is not an outline', () => {
    glyphs.set(0, run([{ color: ZERO_ALPHA_WHITE, width: 0.2 }]));
    glyphs.set(1, run([{ color: OPAQUE_WHITE, width: 0 }]));

    expect(glyphs.hasOutline()).to.be.false;
  });

  it('a solid background quad never counts — its outline words are the text-border', () => {
    glyphs.set(0, run([{ solid: true, color: OPAQUE_WHITE, width: 3 }]));

    expect(glyphs.hasOutline()).to.be.false;
  });

  it('tracks set, same-count replace and removal', () => {
    glyphs.set(0, run([{ color: OPAQUE_WHITE, width: 0.2 }, {}]));

    expect(glyphs.hasOutline()).to.be.true;

    // same-count replacement (the in-place fast path) drops the outline
    glyphs.set(0, run([{}, {}]));

    expect(glyphs.hasOutline()).to.be.false;

    // and restores it
    glyphs.set(0, run([{}, { color: OPAQUE_WHITE, width: 0.2 }]));

    expect(glyphs.hasOutline()).to.be.true;

    glyphs.set(0, null);

    expect(glyphs.hasOutline()).to.be.false;
  });

  it('survives compaction and clear()', () => {
    const outlined = run([{ color: OPAQUE_WHITE, width: 0.2 }]);

    // enough churn to trip the garbage-half compaction threshold
    for (let slot = 0; slot < 200; slot++) {
      glyphs.set(slot, run([{}, {}, {}]));
      glyphs.set(slot, null);
    }

    glyphs.set(999, outlined);

    for (let slot = 0; slot < 200; slot++) {
      glyphs.set(slot, run([{}]));
      glyphs.set(slot, null);
    }

    expect(glyphs.hasOutline()).to.be.true;

    glyphs.clear();

    expect(glyphs.hasOutline()).to.be.false;
  });
});
