import { expect } from 'chai';
import { createRequire } from 'node:module';
import cytoscape from '../src/index.mjs';

// Round 114.8: the layout quality suite — every layout, one matrix of
// output properties: placement, fit, boundingBox, overlap (bodies and
// labels), locked nodes, animation, component separation, the lifecycle.
//
// Each overlap row is paired with the control docs/agents/testing.md
// requires, asserted red: the same fixture crammed with avoidOverlap
// off must overlap, or the row's green would be discriminating on
// nothing.  A control that stays green is a finding, not a spec to
// delete.  The spiral example from debug/ rides along through the
// extension contract, since it is the template external layouts crib.

const SpiralLayout = createRequire(import.meta.url)(
  '../debug/spiral-layout.js',
);

// -- probes --

const bodyBox = (n) => n.boundingBox({ includeLabels: false });
const labelBox = (n) => n.boundingBox();

/** strict interior intersection: touching edges do not count */
const overlaps = (a, b) =>
  a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

const overlapPairs = (nodes, boxOf) => {
  const boxes = nodes.map(boxOf);
  const pairs = [];

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (overlaps(boxes[i], boxes[j])) {
        pairs.push([nodes[i].id(), nodes[j].id()]);
      }
    }
  }

  return pairs;
};

const inside = (inner, outer, eps = 1e-6) =>
  inner.x1 >= outer.x1 - eps &&
  inner.y1 >= outer.y1 - eps &&
  inner.x2 <= outer.x2 + eps &&
  inner.y2 <= outer.y2 + eps;

const SENTINEL = { x: 12345, y: -6789 };
const atSentinel = (n) =>
  n.position().x === SENTINEL.x && n.position().y === SENTINEL.y;

const snapshot = (cy) =>
  Object.fromEntries(
    cy
      .nodes()
      .filter((n) => !n.isParent())
      .map((n) => [n.id(), { ...n.position() }]),
  );

/** run a layout and resolve at its layoutstop, whatever its shape */
const run = (cy, options) => {
  const layout = cy.layout(options);
  // registered before run(): the discrete layouts stop synchronously
  const stopped = cy.promiseOn('layoutstop');

  layout.run();

  return typeof layout.promise === 'function' ? layout.promise() : stopped;
};

const lifecycle = (cy) => {
  const log = [];

  for (const type of ['layoutstart', 'layoutready', 'layoutstop']) {
    cy.on(type, () => log.push(type));
  }

  return log;
};

// -- fixtures: deterministic, ids stable, every node at the sentinel --

const node = (id, extra = {}) => ({
  data: { id, ...extra.data },
  position: { ...SENTINEL },
  ...(extra.locked ? { locked: true, position: extra.position } : {}),
});
const edge = (s, t) => ({ data: { id: `${s}->${t}`, source: s, target: t } });

const FIXTURES = {
  /** balanced 1 + 3 + 9 + 27 */
  tree() {
    const els = [node('r')];
    let parents = ['r'];
    let next = 0;

    for (let depth = 0; depth < 3; depth++) {
      const children = [];

      for (const p of parents) {
        for (let k = 0; k < 3; k++) {
          const id = 'n' + next++;

          els.push(node(id), edge(p, id));
          children.push(id);
        }
      }

      parents = children;
    }

    return els;
  },
  /** hub + 40 leaves */
  fan(leaves = 40) {
    const els = [node('h')];

    for (let i = 0; i < leaves; i++) {
      els.push(node('l' + i), edge('h', 'l' + i));
    }

    return els;
  },
  /** 4 ranks x 4, chain edges plus rank-skipping ones */
  dag() {
    const els = [];

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        els.push(node(`r${r}c${c}`));
      }
    }

    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        els.push(edge(`r${r}c${c}`, `r${r + 1}c${(c + 1) % 4}`));
      }
    }

    els.push(edge('r0c0', 'r3c0'), edge('r0c1', 'r2c3'));
    els.push(edge('r0c2', 'r3c2'), edge('r1c0', 'r3c3'));

    return els;
  },
  /** K3 + path(4) + two singletons */
  components() {
    return [
      node('k0'),
      node('k1'),
      node('k2'),
      edge('k0', 'k1'),
      edge('k1', 'k2'),
      edge('k2', 'k0'),
      node('p0'),
      node('p1'),
      node('p2'),
      node('p3'),
      edge('p0', 'p1'),
      edge('p1', 'p2'),
      edge('p2', 'p3'),
      node('s0'),
      node('s1'),
    ];
  },
  /** ring of 12 with 40-character labels */
  labelled() {
    const els = [];

    for (let i = 0; i < 12; i++) {
      els.push(
        node('w' + i, {
          data: { label: 'a label long enough to matter a great deal' },
        }),
      );
      els.push(edge('w' + i, 'w' + ((i + 1) % 12)));
    }

    return els;
  },
  /** hub + 12 leaves with 40-character labels: one rank of labels side
   * by side, which a ring never gives a layered layout (flow's cycle
   * removal turns the ring into a chain, one node per rank — the
   * control that found this fixture necessary) */
  labelledFan() {
    const els = FIXTURES.fan(12);

    for (const el of els) {
      if (el.data.source == null) {
        el.data.label = 'a label long enough to matter a great deal';
      }
    }

    return els;
  },
  /** fan(8) with l3 locked at (400, 300) */
  locked() {
    const els = FIXTURES.fan(8);
    const l3 = els.find((e) => e.data.id === 'l3');

    l3.locked = true;
    l3.position = { x: 400, y: 300 };

    return els;
  },
};

const LABEL_STYLE = { nodes: { label: { data: 'label' } } };

const mk = (elements, style) =>
  cytoscape({
    elements,
    style,
    headlessWidth: 800,
    headlessHeight: 600,
  });

const BOX = { x1: 0, y1: 0, w: 800, h: 600 };

/** a 100 px lattice by index, for preset */
const lattice = (cy) =>
  Object.fromEntries(
    cy
      .nodes()
      .map((n, i) => [
        n.id(),
        { x: 100 + (i % 6) * 100, y: 100 + Math.floor(i / 6) * 100 },
      ]),
  );

// -- the layouts --

const LAYOUTS = {
  grid: {
    bbox: true,
    overlap: true,
    cram: { boundingBox: { x1: 0, y1: 0, w: 100, h: 100 } },
  },
  preset: { bbox: false, overlap: false, positions: lattice },
  circle: {
    bbox: true,
    overlap: true,
    cram: { boundingBox: { x1: 0, y1: 0, w: 100, h: 100 } },
  },
  concentric: {
    bbox: true,
    overlap: true,
    cram: { boundingBox: { x1: 0, y1: 0, w: 100, h: 100 } },
  },
  breadthfirst: {
    bbox: true,
    overlap: true,
    cram: { boundingBox: { x1: 0, y1: 0, w: 100, h: 100 } },
  },
  random: { bbox: true, overlap: false, seeded: false },
  radial: {
    bbox: true,
    overlap: true,
    cram: { boundingBox: { x1: 0, y1: 0, w: 100, h: 100 } },
  },
  force: {
    bbox: false,
    overlap: true,
    separates: true,
    seed: 7,
    cram: { repulsion: 0, edgeLength: 1 },
  },
  flow: {
    bbox: true,
    overlap: true,
    separates: true,
    cram: { boundingBox: { x1: 0, y1: 0, w: 100, h: 100 } },
  },
  spiral: {
    bbox: false,
    overlap: true,
    separates: true,
    cram: { spiralStep: 1 },
  },
};

const NAMES = Object.keys(LAYOUTS);

/** the options for one layout: name or impl, seed, preset's positions */
const opts = (name, cy, extra = {}) => {
  const def = LAYOUTS[name];
  const base = name === 'spiral' ? { impl: SpiralLayout } : { name };

  if (def.seed != null) {
    base.seed = def.seed;
  }

  if (def.positions != null) {
    base.positions = def.positions(cy);
  }

  return { ...base, ...extra };
};

describe('gpu/layout: the quality suite (round 114.8)', function () {
  describe('the probes', function () {
    it('overlaps: coincident yes, edge-touching no', function () {
      const a = { x1: 0, y1: 0, x2: 10, y2: 10 };

      expect(overlaps(a, { ...a })).to.equal(true);
      expect(overlaps(a, { x1: 10, y1: 0, x2: 20, y2: 10 })).to.equal(false);
      expect(overlaps(a, { x1: 9.99, y1: 0, x2: 20, y2: 10 })).to.equal(true);
    });

    it('inside: a box a hair outside fails', function () {
      const outer = { x1: 0, y1: 0, x2: 10, y2: 10 };

      expect(inside({ x1: 0, y1: 0, x2: 10, y2: 10 }, outer)).to.equal(true);
      expect(inside({ x1: 0, y1: 0, x2: 10.001, y2: 10 }, outer)).to.equal(
        false,
      );
    });

    it('overlapPairs finds a deliberately duplicated position', function () {
      const cy = mk(FIXTURES.fan(3));

      cy.nodes().positions((n, i) => ({ x: i * 100, y: 0 }));
      cy.$id('l2').position({ x: 100, y: 0 }); // onto l0

      expect(overlapPairs(cy.nodes(), bodyBox)).to.deep.equal([['l0', 'l2']]);
    });
  });

  describe('every layout places every node', function () {
    for (const name of NAMES) {
      for (const fixture of ['tree', 'fan', 'dag', 'components']) {
        it(`${name} on ${fixture}: finite, off the sentinel, one lifecycle`, async function () {
          const cy = mk(FIXTURES[fixture]());
          const log = lifecycle(cy);

          await run(cy, opts(name, cy));

          cy.nodes().forEach((n) => {
            const p = n.position();

            expect(
              Number.isFinite(p.x) && Number.isFinite(p.y),
              n.id(),
            ).to.equal(true);
            expect(atSentinel(n), `${n.id()} never moved`).to.equal(false);
          });
          expect(log).to.deep.equal([
            'layoutstart',
            'layoutready',
            'layoutstop',
          ]);
        });
      }
    }
  });

  describe('fit', function () {
    // the rendered gap between the drawing and the viewport edge: the
    // binding axis sits at exactly the padding, the other at least
    const gaps = (cy) => {
      const bb = cy.elements().boundingBox();
      const ext = cy.extent();
      const z = cy.zoom();

      return {
        x: Math.min(bb.x1 - ext.x1, ext.x2 - bb.x2) * z,
        y: Math.min(bb.y1 - ext.y1, ext.y2 - bb.y2) * z,
        inside: inside(bb, ext, 1e-3),
      };
    };

    for (const name of NAMES) {
      for (const fixture of ['tree', 'labelled']) {
        it(`${name} on ${fixture} fits with the padding on the binding axis`, async function () {
          const cy = mk(FIXTURES[fixture](), LABEL_STYLE);

          await run(cy, opts(name, cy, { padding: 30 }));

          const g = gaps(cy);

          expect(g.inside, 'the drawing leaves the viewport').to.equal(true);
          expect(Math.min(g.x, g.y)).to.be.closeTo(30, 1e-2);
          expect(Math.max(g.x, g.y)).to.be.at.least(30 - 1e-2);
        });
      }

      it(`${name} with fit: false leaves the viewport alone`, async function () {
        const cy = mk(FIXTURES.tree());

        await run(cy, opts(name, cy, { fit: false }));

        expect(cy.zoom()).to.equal(1);
        expect(cy.pan()).to.deep.equal({ x: 0, y: 0 });
      });
    }

    it('control: spacingFactor 3 without a fit puts the fan outside the viewport', async function () {
      for (const name of NAMES.filter((n) => n !== 'preset')) {
        const cy = mk(FIXTURES.fan());

        await run(cy, opts(name, cy, { fit: false, spacingFactor: 3 }));

        expect(
          inside(cy.elements().boundingBox(), cy.extent(), 1e-3),
          `${name}: the containment probe cannot fail`,
        ).to.equal(false);
      }
    });

    it('honours a far-away boundingBox (avoidOverlap off, which may overflow one)', async function () {
      const box = { x1: 2000, y1: 2000, w: 400, h: 400 };

      for (const name of NAMES.filter((n) => LAYOUTS[n].bbox)) {
        const cy = mk(FIXTURES.tree());

        // spacingFactor 1: breadthfirst's v3 default of 1.75 scales the
        // drawing about its centre *after* the box is honoured
        await run(
          cy,
          opts(name, cy, {
            boundingBox: box,
            avoidOverlap: false,
            spacingFactor: 1,
            fit: false,
          }),
        );

        cy.nodes().forEach((n) => {
          const p = n.position();

          expect(p.x, `${name}: ${n.id()}`).to.be.within(
            2000 - 1e-3,
            2400 + 1e-3,
          );
          expect(p.y, `${name}: ${n.id()}`).to.be.within(
            2000 - 1e-3,
            2400 + 1e-3,
          );
        });
      }
    });
  });

  describe('no overlap (avoidOverlap default)', function () {
    const OVERLAP = NAMES.filter((n) => LAYOUTS[n].overlap);

    for (const name of OVERLAP) {
      for (const fixture of ['tree', 'fan', 'dag', 'components']) {
        it(`${name} on ${fixture}: no two bodies overlap`, async function () {
          const cy = mk(FIXTURES[fixture]());

          await run(cy, opts(name, cy, { fit: false }));

          const pairs = overlapPairs(cy.nodes(), bodyBox);

          expect(pairs, JSON.stringify(pairs)).to.deep.equal([]);
        });
      }

      for (const fixture of ['labelled', 'labelledFan']) {
        it(`${name} on ${fixture}: no two label boxes overlap (labels on by default)`, async function () {
          const cy = mk(FIXTURES[fixture](), LABEL_STYLE);
          const probe = cy.nodes()[1];

          // the precondition: the label is what makes the box wide
          expect(labelBox(probe).w).to.be.greaterThan(3 * bodyBox(probe).w);

          await run(cy, opts(name, cy, { fit: false }));

          const pairs = overlapPairs(cy.nodes(), labelBox);

          expect(pairs, JSON.stringify(pairs)).to.deep.equal([]);
        });
      }

      it(`control: ${name} crammed with avoidOverlap: false overlaps`, async function () {
        const cy = mk(FIXTURES.fan());

        await run(
          cy,
          opts(name, cy, {
            fit: false,
            avoidOverlap: false,
            ...LAYOUTS[name].cram,
          }),
        );

        expect(overlapPairs(cy.nodes(), bodyBox).length).to.be.greaterThan(0);
      });
    }

    it('control: nodeDimensionsIncludeLabels: false clears the bodies but not the labels', async function () {
      const cy = mk(FIXTURES.labelled(), LABEL_STYLE);

      await run(cy, {
        name: 'grid',
        fit: false,
        avoidOverlapPadding: 0,
        nodeDimensionsIncludeLabels: false,
      });

      expect(overlapPairs(cy.nodes(), bodyBox)).to.deep.equal([]);
      expect(overlapPairs(cy.nodes(), labelBox).length).to.be.greaterThan(0);
    });
  });

  describe('locked nodes', function () {
    for (const name of NAMES) {
      it(`${name}: the locked node never moves and every other node is placed`, async function () {
        const cy = mk(FIXTURES.locked());

        await run(cy, opts(name, cy));

        expect(cy.$id('l3').position()).to.deep.equal({ x: 400, y: 300 });
        cy.nodes().forEach((n) => {
          if (n.id() !== 'l3') {
            expect(atSentinel(n), `${n.id()} never moved`).to.equal(false);
          }
        });
      });

      it(`${name}: an animated run holds the lock too`, async function () {
        const cy = mk(FIXTURES.locked());

        await run(cy, opts(name, cy, { animate: true, animationDuration: 40 }));

        expect(cy.$id('l3').position()).to.deep.equal({ x: 400, y: 300 });
      });
    }

    it('force treats the locked node as an obstacle: nothing lands on it', async function () {
      // park the lock where the fan's hub settles (the component anchor)
      const cy = mk(FIXTURES.locked());

      cy.$id('l3').unlock().position({ x: 0, y: 0 }).lock();
      await run(cy, opts('force', cy, { fit: false }));

      const l3 = bodyBox(cy.$id('l3'));

      cy.nodes().forEach((n) => {
        if (n.id() !== 'l3') {
          expect(
            overlaps(bodyBox(n), l3),
            `${n.id()} landed on the lock`,
          ).to.equal(false);
        }
      });
    });

    it('control: with avoidOverlap: false the hub lands on the lock', async function () {
      const cy = mk(FIXTURES.locked());

      cy.$id('l3').unlock().position({ x: 0, y: 0 }).lock();
      await run(
        cy,
        opts('force', cy, {
          fit: false,
          avoidOverlap: false,
          repulsion: 0,
          edgeLength: 1,
        }),
      );

      const l3 = bodyBox(cy.$id('l3'));
      const onIt = cy
        .nodes()
        .filter((n) => n.id() !== 'l3' && overlaps(bodyBox(n), l3));

      expect(onIt.length).to.be.greaterThan(0);
    });

    it('position writes on a locked node are no-ops until unlock()', function () {
      const cy = mk(FIXTURES.locked());

      cy.$id('l3').position({ x: 1, y: 2 });
      cy.nodes().positions(() => ({ x: 1, y: 2 }));
      cy.nodes().shift({ x: 5, y: 5 });
      expect(cy.$id('l3').position()).to.deep.equal({ x: 400, y: 300 });
      expect(cy.$id('l1').position()).to.deep.equal({ x: 6, y: 7 });

      cy.$id('l3').unlock().position({ x: 1, y: 2 });
      expect(cy.$id('l3').position()).to.deep.equal({ x: 1, y: 2 });
    });
  });

  describe('animate', function () {
    for (const name of NAMES) {
      it(`${name}: an animated run ends where the sync run ends, fitted, one lifecycle`, async function () {
        const sync = mk(FIXTURES.tree());

        await run(sync, opts(name, sync, { boundingBox: BOX }));

        const cy = mk(FIXTURES.tree());
        const log = lifecycle(cy);

        await run(
          cy,
          opts(name, cy, {
            boundingBox: BOX,
            animate: true,
            animationDuration: 40,
          }),
        );

        if (LAYOUTS[name].seeded !== false) {
          cy.nodes().forEach((n) => {
            const want = sync.$id(n.id()).position();

            expect(n.position().x, n.id()).to.be.closeTo(want.x, 1e-3);
            expect(n.position().y, n.id()).to.be.closeTo(want.y, 1e-3);
          });
          expect(cy.zoom()).to.be.closeTo(sync.zoom(), 1e-6);
        }

        expect(inside(cy.elements().boundingBox(), cy.extent(), 1e-3)).to.equal(
          true,
        );
        expect(log).to.deep.equal(['layoutstart', 'layoutready', 'layoutstop']);
      });
    }

    it('force: animate is a tween — a mid-run sample is collinear with start and end', async function () {
      const cy = mk(FIXTURES.tree());

      // a scatter to start from: the spectral seed lands the same tree
      // in the same place whatever the seed, so a settled start would
      // leave the tween nothing to travel
      await run(cy, { name: 'random', fit: false });

      const start = snapshot(cy);
      const layout = cy.layout(
        opts('force', cy, {
          fit: false,
          animate: true,
          animationDuration: 200,
        }),
      );

      layout.run();

      // poll until some node has travelled a way, then sample it
      let sample = null;

      for (let k = 0; k < 60 && sample == null; k++) {
        await new Promise((resolve) => setTimeout(resolve, 5));

        cy.nodes().forEach((n) => {
          const p = n.position();
          const s = start[n.id()];

          if (sample == null && Math.hypot(p.x - s.x, p.y - s.y) > 5) {
            sample = { id: n.id(), ...p };
          }
        });
      }

      await layout.promise();

      expect(sample, 'no mid-run sample').to.not.equal(null);

      const s = start[sample.id];
      const f = cy.$id(sample.id).position();
      const cross =
        (sample.x - s.x) * (f.y - s.y) - (sample.y - s.y) * (f.x - s.x);
      const span = Math.hypot(f.x - s.x, f.y - s.y);

      expect(span).to.be.greaterThan(5);
      // a segment: the sample sits on the start -> final line
      expect(Math.abs(cross) / span).to.be.lessThan(1e-2);
    });

    it('force: animateLive ends fitted with one lifecycle', async function () {
      const cy = mk(FIXTURES.tree());
      const log = lifecycle(cy);

      await run(
        cy,
        opts('force', cy, { animateLive: true, stepsPerFrame: 200 }),
      );

      expect(inside(cy.elements().boundingBox(), cy.extent(), 1e-3)).to.equal(
        true,
      );
      expect(log).to.deep.equal(['layoutstart', 'layoutready', 'layoutstop']);
    });
  });

  describe('disconnected components', function () {
    // the layouts that pack components: force (59.2), flow (112.2), the
    // spiral example (87.1's packComponents).  The ring and grid layouts
    // place by index or by wedge about one centre, so their component
    // boxes interleave by design and are not asserted here.
    for (const name of NAMES.filter((n) => LAYOUTS[n].separates)) {
      it(`${name}: component boxes are pairwise disjoint`, async function () {
        const cy = mk(FIXTURES.components());

        await run(cy, opts(name, cy, { fit: false }));

        const groups = ['k', 'p', 's0', 's1'].map((prefix) =>
          cy.nodes().filter((n) => n.id().startsWith(prefix)),
        );
        const boxes = groups.map((g) => g.boundingBox());

        for (let i = 0; i < boxes.length; i++) {
          for (let j = i + 1; j < boxes.length; j++) {
            expect(
              overlaps(boxes[i], boxes[j]),
              `${name}: components ${i} and ${j} overlap`,
            ).to.equal(false);
          }
        }
      });
    }
  });
});
