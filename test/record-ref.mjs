import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { GraphStore, IMG_STRIDE } from '../src/store/graph-store.mjs';
import { ColumnMirror } from '../src/render/column-mirror.mjs';
import { COL, REF_OFFSET_FLOATS } from '../src/contract.mjs';

/*
The background-image record reference still packs a 24-bit offset
(round 145, PLAN.md item 73's latent defect). A pool past 2^24 floats
used to OR offset bits into the image count, so readback and drawing
could use a wrong record. These specs pin the store's saturation and
readback, the compaction rewrite, and the renderer's degradation at the
real boundary. Chart references now use offset+1 in a u32 word, with the
count in the chart header (round 80.1); their mixed record and bit-exact
color contract lives in `test/modules/chart-record.mjs`.
*/

const N_IMAGES = 254;

const imageSpecs = (seed) =>
  Array.from({ length: N_IMAGES }, (_, i) => ({
    url: 'i' + (i % 4) + '.png',
    sdf: false,
    crossOrigin: 'anonymous',
    fit: 0,
    repeat: 0,
    clip: 0,
    containment: 0,
    smoothing: true,
    opacity: ((seed + i) % 100) / 100,
    posX: { v: 50, pct: true },
    posY: { v: 50, pct: true },
    offX: { v: 0, pct: false },
    offY: { v: 0, pct: false },
    w: { mode: 0, v: 0 },
    h: { mode: 0, v: 0 },
    tint: [0, 0, 0, 0],
  }));

/** Nodes with one record each, until one lies past the ref's reach. */
const fillPast = (store, floatsPerRecord, write) => {
  const nodes = Math.floor(REF_OFFSET_FLOATS / floatsPerRecord) + 2;

  for (let i = 0; i < nodes; i++) {
    store.addNode('n' + i, 0, 0);
    write(store.lookup('n' + i).slot, i);
  }

  return nodes;
};

const mockDevice = () => {
  const created = [];

  return {
    created,
    createBuffer(desc) {
      const buffer = { ...desc, destroy() {} };

      created.push(buffer);

      return buffer;
    },
    queue: {
      writeBuffer() {},
      onSubmittedWorkDone: () => Promise.resolve(undefined),
    },
  };
};

describe('store: the image record ref past 2^24 floats (round 145)', function () {
  it('the image boundary remains the ref field: 2^24 floats', function () {
    expect(REF_OFFSET_FLOATS).to.equal(2 ** 24);
  });

  describe('images', function () {
    let store, nodes, last;

    before(function () {
      store = new GraphStore();
      nodes = fillPast(store, N_IMAGES * IMG_STRIDE, (slot, i) =>
        store.setNodeImages(slot, imageSpecs(i)),
      );
      last = store.lookup('n' + (nodes - 1)).slot;
    });

    after(function () {
      store = null;
    });

    it('the fixture reaches the boundary: the last record lies past it', function () {
      expect(store.imagePool.offsetOf(last)).to.be.at.least(REF_OFFSET_FLOATS);
    });

    it('its ref never carries offset bits into the count', function () {
      const refs = store.nodes.column(COL.NODE_IMAGE_REF);

      for (let slot = 0; slot < nodes; slot++) {
        expect(refs[slot] >>> 24, 'slot ' + slot).to.equal(N_IMAGES);
      }
    });

    it('a record past the boundary reads back whole', function () {
      const recs = store.nodeImagesAt(last);
      const want = imageSpecs(nodes - 1);

      expect(recs).to.have.length(N_IMAGES);
      expect(recs.map((r) => r.url)).to.deep.equal(want.map((s) => s.url));
      expect(recs.map((r) => Math.round(r.opacity * 100))).to.deep.equal(
        want.map((s) => Math.round(s.opacity * 100)),
      );
    });

    it('the renderer declines the pool as unaddressable: images degrade', function () {
      const unfit = [];
      const device = mockDevice();
      const mirror = new ColumnMirror(device, store, {
        onUnfit: (u) => unfit.push(u),
      });

      expect(unfit).to.deep.equal([
        {
          label: 'cy-gpu:image-blob',
          bytes: store.imageBlob().byteLength,
          floats: store.imageBlobLength(),
        },
      ]);
      expect(mirror.imageBlobBuffer().size).to.equal(4);
    });

    it('a compaction back under the boundary leaves an exact ref', function () {
      for (let i = 0; i < nodes / 2; i++) {
        store.setNodeImages(store.lookup('n' + i).slot, null);
      }

      const off = store.imagePool.offsetOf(last);

      expect(off).to.be.below(REF_OFFSET_FLOATS);
      expect(store.nodes.column(COL.NODE_IMAGE_REF)[last]).to.equal(
        (off | (N_IMAGES << 24)) >>> 0,
      );
      expect(store.nodeImagesAt(last)).to.have.length(N_IMAGES);
    });
  });

  it('the 349,527th four-image node reads back its own images', function () {
    const n = Math.floor(REF_OFFSET_FLOATS / (4 * IMG_STRIDE)) + 2;
    const els = [];

    for (let i = 0; i < n; i++) {
      els.push({ data: { id: 'n' + i } });
    }

    const cy = cytoscape({
      elements: els,
      style: {
        nodes: {
          'background-image': ['a.png', 'b.png', 'c.png', 'd.png'],
          'background-image-opacity': [0.25, 0.5, 0.75, 1],
        },
      },
    });
    const last = cy.$id('n' + (n - 1));

    expect(n).to.equal(349527);
    expect(
      cy._store.imagePool.offsetOf(cy._store.lookup(last.id()).slot),
    ).to.be.at.least(REF_OFFSET_FLOATS);
    expect(last.style('background-image')).to.equal('a.png b.png c.png d.png');
    expect(last.style('background-image-opacity')).to.equal('0.25 0.5 0.75 1');
    cy.destroy();
  });
});
