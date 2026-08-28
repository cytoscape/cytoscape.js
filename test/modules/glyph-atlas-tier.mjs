import { expect } from 'chai';

import {
  GlyphAtlas,
  SDF_FONT_SIZE,
  SDF_PAD,
  SDF_TIER_MAX,
} from '../../src/render/glyph-atlas.mjs';
import { LabelLayer, LABEL_PROMOTE_PX } from '../../src/render/label-layer.mjs';
import { GLYPH_WORDS } from '../../src/render/glyph-buffer.mjs';
import { WRAP_NONE } from '../../src/label-wrap.mjs';

/*
Round 94: the zoom-tiered glyph atlas.  The base tier rasters at 32 px
per glyph; sustained zoom past the promotion threshold re-rasters at
64 px into a 2048 texture.  Two invariants fail silently if broken:

- **Metrics are tier-free.**  Every consumer (layout, the shaping memo,
  the glyph-run scale math) works in base-tier SDF px; a tier that
  leaked raster px into metrics would draw every promoted label at
  twice its size — and nothing in the Node tier would notice, because
  layout math stays self-consistent under a uniform scale error.
- **Promotion must not churn.**  The texture is replaced exactly once
  per promotion (bind groups re-key on `generation`), and zoom cycles
  after the one-way promotion must create no further textures — the
  leak gate's plateau rule applied to texture shelves.

The canvas 2d context is faked with proportional metrics (advance
0.6 em, ascent 0.7 em, descent 0.2 em), so raster px double with the
tier exactly and the normalized metrics must come back identical.
*/

/** A deterministic 2d context: metrics proportional to the font px. */
class FakeCtx {
  constructor() {
    this.font = '';
    this.textBaseline = '';
    this.fillStyle = '';
    this.fillTextCalls = 0;
  }

  fontPx() {
    const m = /(\d+)px/.exec(this.font);

    return m == null ? 0 : Number(m[1]);
  }

  measureText(text) {
    const px = this.fontPx();
    const ch = text[0] ?? '';

    return {
      width: 0.6 * px * text.length,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: 0.5 * px,
      actualBoundingBoxAscent: 0.7 * px,
      actualBoundingBoxDescent: ch === 'g' ? 0.2 * px : 0,
      fontBoundingBoxAscent: 0.8 * px,
    };
  }

  clearRect() {}

  fillText() {
    this.fillTextCalls++;
  }

  getImageData(x, y, w, h) {
    // a filled band away from the borders, so the EDT sees real ink
    const data = new Uint8ClampedArray(w * h * 4);

    for (let yy = 2; yy < h - 2; yy++) {
      for (let xx = 2; xx < w - 2; xx++) {
        data[(yy * w + xx) * 4 + 3] = 255;
      }
    }

    return { data };
  }
}

class FakeOffscreenCanvas {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.ctx = new FakeCtx();
  }

  getContext() {
    return this.ctx;
  }
}

const makeDevice = () => {
  const textures = [];
  const writes = [];

  return {
    textures,
    writes,
    createTexture(desc) {
      const tex = {
        size: desc.size,
        destroyed: false,
        destroy() {
          this.destroyed = true;
        },
      };

      textures.push(tex);

      return tex;
    },
    createSampler() {
      return {};
    },
    createBuffer() {
      return { destroy() {} };
    },
    queue: {
      writeTexture(dst, data, layout, size) {
        writes.push({ origin: dst.origin, texture: dst.texture, size });
      },
      writeBuffer() {},
      onSubmittedWorkDone: () => Promise.resolve(undefined),
    },
  };
};

describe('glyph atlas zoom tiers (round 94)', () => {
  let device, atlas;

  beforeEach(() => {
    globalThis.OffscreenCanvas = FakeOffscreenCanvas;
    device = makeDevice();
    atlas = new GlyphAtlas(device);
  });

  afterEach(() => {
    delete globalThis.OffscreenCanvas;
  });

  it('starts at tier 1 with a 1024 texture', () => {
    expect(atlas.tier).to.equal(1);
    expect(atlas.generation).to.equal(0);
    expect(device.textures).to.have.length(1);
    expect(device.textures[0].size.width).to.equal(1024);
  });

  it('promotion grows the texture to 2048 and bumps the generation', () => {
    const before = atlas.texture;

    atlas.setTier(2);

    expect(atlas.tier).to.equal(2);
    expect(atlas.generation).to.equal(1);
    expect(atlas.texture).to.not.equal(before);
    expect(atlas.texture.size.width).to.equal(2048);
    expect(before.destroyed).to.be.true;
  });

  it('reports identical base-tier metrics from both rasters', () => {
    const at1 = atlas.metrics('A');

    atlas.setTier(2);

    const at2 = atlas.metrics('A');

    // advances are un-rounded, so normalization is exact; the boxed
    // metrics quantize at the raster's ceil, so the promoted raster may
    // differ by up to half a base px (its grid is twice as fine) — any
    // larger difference is raster px leaking into the metric space
    expect(at2.advance).to.equal(at1.advance);
    expect(at2.planeX).to.be.closeTo(at1.planeX, 0.5);
    expect(at2.planeY).to.be.closeTo(at1.planeY, 0.5);
    expect(at2.w).to.be.closeTo(at1.w, 1);
    expect(at2.h).to.be.closeTo(at1.h, 1);
    expect(atlas.ascent).to.equal(Math.ceil(0.8 * SDF_FONT_SIZE));
  });

  it('rasters promoted cells at double resolution into the 2048 space', () => {
    atlas.metrics('A');

    const w1 = device.writes.at(-1);

    atlas.setTier(2);
    atlas.metrics('A');

    const w2 = device.writes.at(-1);

    // ink 0.5 em + 2 pads: 16 + 12 = 28 raster px at tier 1, 56 at 2
    expect(w1.size.width).to.equal(0.5 * SDF_FONT_SIZE + 2 * SDF_PAD);
    expect(w2.size.width).to.equal(2 * w1.size.width);
    expect(w2.texture).to.equal(atlas.texture);

    // and the uv extent spans cell / edge for the grown edge
    const m = atlas.metrics('A');

    expect((m.u1 - m.u0) * 2048).to.be.closeTo(w2.size.width, 1e-9);
  });

  it('setTier is a no-op at the current tier and clamps past the max', () => {
    atlas.metrics('A');

    const texturesBefore = device.textures.length;
    const rasters =
      atlas
      // reach into the fake to count re-rasters
      ['ctx'].fillTextCalls;

    atlas.setTier(1); // no-op: same tier

    expect(device.textures).to.have.length(texturesBefore);

    atlas.metrics('A'); // still cached — no re-raster happened

    expect(atlas['ctx'].fillTextCalls).to.equal(rasters);

    atlas.setTier(99); // clamps to SDF_TIER_MAX

    expect(atlas.tier).to.equal(SDF_TIER_MAX);
  });

  it('zoom cycles after promotion never churn textures (plateau)', () => {
    atlas.metrics('A');
    atlas.setTier(2);

    for (let cycle = 0; cycle < 20; cycle++) {
      atlas.setTier(2); // repeated settles at high zoom
      atlas.metrics('A');
      atlas.metrics('g');
    }

    // exactly two textures ever: the base and the one promotion
    expect(device.textures).to.have.length(2);
    expect(device.textures.filter((t) => t.destroyed)).to.have.length(1);
  });
});

/** The label layer's meter, over a minimal fake store view. */
const makeStore = (entries) => {
  const dirty = {
    nodes: [...entries.keys()],
    edges: [],
    edgeSource: [],
    edgeTarget: [],
  };

  return {
    labelFont: 'sans-serif',
    labelFontStyle: 'normal',
    labelFontWeight: 'normal',
    markAllCalls: 0,
    takeLabelDirty(group) {
      const out = dirty[group];

      dirty[group] = [];

      return out;
    },
    labelAt(slot, group) {
      return group === 'nodes' ? entries.get(slot) : undefined;
    },
    setLabelDims() {},
    markAllLabelsDirty() {
      this.markAllCalls++;
      dirty.nodes = [...entries.keys()];
    },
  };
};

const entry = (fontSize) => ({
  text: 'Ag',
  fontSize,
  color: 0xff000000,
  anchorY: 0,
  marginX: 0,
  marginY: 0,
  outlineWidth: 0,
  outlineColor: 0,
  bgColor: 0,
  bgPadding: 0,
  bgShape: 0,
  bgBorderColor: 0,
  bgBorderWidth: 0,
  anchorX: 0,
  halignShift: 0,
  valignShift: 0,
  endOffset: 0,
  minZoomedFontSize: 0,
  rotate: false,
  rotation: 0,
  wrap: WRAP_NONE,
  maxWidth: 0,
  lineHeight: 1.2,
  overflowWrap: 0,
  justification: 1,
});

describe('label tier promotion meter (round 94)', () => {
  let device, store, layer;

  beforeEach(() => {
    globalThis.OffscreenCanvas = FakeOffscreenCanvas;
    device = makeDevice();
    store = makeStore(new Map([[0, entry(14)]]));
    layer = new LabelLayer(device, store);
    layer.process();
  });

  afterEach(() => {
    delete globalThis.OffscreenCanvas;
  });

  it('stays at the base tier while displayed px sit under the threshold', () => {
    // 14 px at zoom 2 displays 28 px — comfortably under 40
    expect(layer.maybePromote(2)).to.be.false;
    expect(layer.atlas.tier).to.equal(1);
    expect(store.markAllCalls).to.equal(0);
  });

  it('promotes past the threshold and re-lays every run at the same model size', () => {
    const runBefore = captureRun(layer);

    // 14 px at zoom 4 displays 56 px > LABEL_PROMOTE_PX
    expect(14 * 4).to.be.above(LABEL_PROMOTE_PX);
    expect(layer.maybePromote(4)).to.be.true;
    expect(layer.atlas.tier).to.equal(2);
    expect(store.markAllCalls).to.equal(1);

    // the swap is the font-loading re-raster's sequencing: the runs
    // rebuild in the next process(), against the promoted raster,
    // at an unchanged model-px size and position
    layer.process();

    const runAfter = captureRun(layer);

    expect(runAfter.count).to.equal(runBefore.count);

    // 14 px labels scale SDF px by 14/32, and the promoted raster can
    // legitimately shift a boxed metric by half a base px — so the quad
    // budget is that quantization, not a free pass (a tier leaking into
    // the scale math would move quads by a full glyph width)
    const budget = 0.5 * (14 / 32) + 1e-6;

    for (let i = 0; i < runAfter.count; i++) {
      expect(runAfter.x[i]).to.be.closeTo(runBefore.x[i], budget);
      expect(runAfter.w[i]).to.be.closeTo(runBefore.w[i], 2 * budget);
      expect(runAfter.h[i]).to.be.closeTo(runBefore.h[i], 2 * budget);
    }
  });

  it('is one-way: once at the top tier the meter never fires again', () => {
    expect(layer.maybePromote(4)).to.be.true;
    expect(layer.canPromote()).to.be.false;
    expect(layer.maybePromote(100)).to.be.false; // even at extreme zoom
    expect(layer.maybePromote(0.1)).to.be.false; // and zooming out never demotes
    expect(layer.atlas.tier).to.equal(2);
    expect(store.markAllCalls).to.equal(1);
  });

  it('meters on the largest label seen, monotone across removals', () => {
    store = makeStore(
      new Map([
        [0, entry(8)],
        [1, entry(20)],
      ]),
    );
    layer = new LabelLayer(makeDevice(), store);
    layer.process();

    // 8 px at zoom 4 = 32: under; but the 20 px label displays 80
    expect(layer.maybePromote(4)).to.be.true;
  });
});

/** Snapshot the node stream's live glyph quads (x, w, h in model px). */
const captureRun = (layer) => {
  const words = layer.glyphs['words'];
  const f32 = new Float32Array(words.buffer);
  const high = layer.glyphs.highWater;
  const x = [],
    w = [],
    h = [];
  let count = 0;

  for (let i = 0; i < high; i++) {
    const at = i * GLYPH_WORDS;

    if (words[at] === 0xffffffff) {
      continue; // tombstone
    }

    x.push(f32[at + 2]);
    w.push(f32[at + 4]);
    h.push(f32[at + 5]);
    count++;
  }

  return { count, x, w, h };
};
