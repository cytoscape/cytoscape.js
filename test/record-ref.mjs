import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { GraphStore, IMG_STRIDE } from '../src/store/graph-store.mjs';
import { ColumnMirror } from '../src/render/column-mirror.mjs';
import { CHART_HEADER, COL, REF_OFFSET_FLOATS } from '../src/contract.mjs';

/*
The record reference's 24-bit offset (round 145, PLAN.md item 73's
latent defect).  `node.chartRef` and `node.imageRef` pack
`offset | count << 24`; a record appended past 2^24 floats used to OR its
offset's high bits into the count, so readback and the draw both read a
wrong-length record from the wrong place.  The packing stays (item 73's
sitting call); what these specs pin is the guard:

- the store never lets offset bits reach the count field, and readback
  reads the pool's own offset table, so a record past the boundary reads
  back whole;
- a compaction that brings the record back under the boundary leaves an
  exact ref;
- the renderer's mirror declines the pool as unaddressable — the
  feature degrades (round 138's order), nothing draws a corrupt ref.

Every spec runs at the real boundary, 2^24 floats.  The store specs
write records of 254 values (769 floats) and 254 images (3,048 floats) —
the store takes any count below 256; the style layer caps at 16 slices
and 4 images — so it is 21,818 charted or 5,506 imaged nodes, a few
hundred milliseconds.  254, not 255: a count with bit 0 already set
would hide the corruption (255 | 1 = 255).  The public-API specs reach
it the way a user would, at the style layer's caps: 305,042 nodes with
16-slice pies, 349,527 with four images, about a second each.
*/

const N_VALUES = 254;
const N_IMAGES = 254;

const chartRec = (seed) => ({
  kind: 1,
  size: 1,
  hole: 0,
  startAngle: 0,
  direction: 0,
  opacity: 1,
  values: Array.from({ length: N_VALUES }, (_, i) => (seed + i) % 97),
  colors: Array.from({ length: N_VALUES }, (_, i) => [
    i % 256,
    seed % 256,
    0,
    255,
  ]),
});

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

describe('store: the record ref past 2^24 floats (round 145)', function () {
  it('the boundary is the ref field: 2^24 floats', function () {
    expect(REF_OFFSET_FLOATS).to.equal(2 ** 24);
  });

  describe('charts', function () {
    let store, nodes, last;

    before(function () {
      store = new GraphStore();
      nodes = fillPast(store, CHART_HEADER + N_VALUES * 3, (slot, i) =>
        store.setChart(slot, chartRec(i)),
      );
      last = store.lookup('n' + (nodes - 1)).slot;
    });

    after(function () {
      store = null;
    });

    it('the fixture reaches the boundary: the last record lies past it', function () {
      expect(store.chartPool.offsetOf(last)).to.be.at.least(REF_OFFSET_FLOATS);
      expect(store.chartPool.offsetOf(last - 2)).to.be.below(REF_OFFSET_FLOATS);
    });

    it('its ref never carries offset bits into the count', function () {
      const refs = store.nodes.column(COL.NODE_CHART_REF);

      for (let slot = 0; slot < nodes; slot++) {
        expect(refs[slot] >>> 24, 'slot ' + slot).to.equal(N_VALUES);
      }
    });

    it('a record past the boundary reads back whole', function () {
      const rec = store.chartAt(last);
      const want = chartRec(nodes - 1);

      expect(rec.values).to.deep.equal(want.values);
      expect(rec.colors).to.deep.equal(want.colors);
    });

    it('the renderer declines the pool as unaddressable: charts degrade', function () {
      const unfit = [];
      const device = mockDevice();
      const mirror = new ColumnMirror(device, store, {
        onUnfit: (u) => unfit.push(u),
      });

      expect(unfit).to.deep.equal([
        {
          label: 'cy-gpu:chart-blob',
          bytes: store.chartBlob().byteLength,
          floats: store.chartBlobLength(),
        },
      ]);
      expect(mirror.chartBlobBuffer().size).to.equal(4);
    });

    it('a compaction back under the boundary leaves an exact ref', function () {
      // free the first half: waste passes half the live floats
      for (let i = 0; i < nodes / 2; i++) {
        store.setChart(store.lookup('n' + i).slot, null);
      }

      const off = store.chartPool.offsetOf(last);

      expect(off).to.be.below(REF_OFFSET_FLOATS);

      const ref = store.nodes.column(COL.NODE_CHART_REF)[last];

      expect(ref).to.equal((off | (N_VALUES << 24)) >>> 0);
      expect(store.chartAt(last).values).to.deep.equal(
        chartRec(nodes - 1).values,
      );

      // and the mirror of a pool back under the reach takes it
      const unfit = [];

      new ColumnMirror(mockDevice(), store, {
        onUnfit: (u) => unfit.push(u),
      });
      expect(unfit).to.deep.equal([]);
    });
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

      new ColumnMirror(mockDevice(), store, {
        onUnfit: (u) => unfit.push(u),
      });

      expect(unfit).to.deep.equal([
        {
          label: 'cy-gpu:image-blob',
          bytes: store.imageBlob().byteLength,
          floats: store.imageBlobLength(),
        },
      ]);
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

  describe('through the public API, at the style caps', function () {
    it('the 305,042nd 16-slice pie reads back its own values', function () {
      const n = Math.floor(REF_OFFSET_FLOATS / (CHART_HEADER + 16 * 3)) + 2;
      const values = Array.from({ length: 16 }, (_, i) =>
        i % 2 ? 0.03125 : 0.09375,
      );
      const els = [];

      for (let i = 0; i < n; i++) {
        els.push({ data: { id: 'n' + i } });
      }

      const cy = cytoscape({
        elements: els,
        style: { nodes: { chart: 'pie', 'chart-values': values } },
      });
      const last = cy.$id('n' + (n - 1));

      expect(n).to.equal(305042);
      expect(
        cy._store.chartPool.offsetOf(cy._store.lookup(last.id()).slot),
      ).to.be.at.least(REF_OFFSET_FLOATS);
      // before round 145: 17 values, the last thirteen colour bits
      expect(last.style('chart-values')).to.equal(values.join(' '));
      cy.destroy();
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
      // before round 145: five images, 'a.png' each, opacity 39321
      expect(last.style('background-image')).to.equal(
        'a.png b.png c.png d.png',
      );
      expect(last.style('background-image-opacity')).to.equal(
        '0.25 0.5 0.75 1',
      );
      cy.destroy();
    });
  });
});
