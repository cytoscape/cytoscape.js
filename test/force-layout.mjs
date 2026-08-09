import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 18.2, model rebuilt in round 59: the built-in `force` layout —
// the extension contract's first production consumer.  CPU executor
// (the reference sim); deterministic under a seed; leaves-only under
// compounds (owner gravity + nesting since 59.5); component anchors,
// the spectral seed and the settle re-pack since 59.2/59.4; locked
// nodes pin; live mode streams positions and stop() settles early.

const RING = (n = 12) => {
  const elements = [];

  for (let i = 0; i < n; i++) {
    elements.push({ data: { id: 'n' + i } });
    elements.push({
      data: { id: 'e' + i, source: 'n' + i, target: 'n' + ((i + 1) % n) },
    });
  }

  return elements;
};

describe('gpu/layout: the force layout (round 18.2)', function () {
  it('lays out, fits and completes the lifecycle', async function () {
    const cy = cytoscape({ elements: RING() });
    const log = [];

    for (const type of ['layoutstart', 'layoutready', 'layoutstop']) {
      cy.on(type, () => log.push(type));
    }

    await cy.layout({ name: 'force', seed: 5 }).run().promise();

    expect(log).to.deep.equal(['layoutstart', 'layoutready', 'layoutstop']);

    // a laid-out ring spreads: every link lands near the ideal length
    const nodes = cy.nodes();

    for (let i = 0; i < 12; i++) {
      const a = cy.$id('n' + i).position();
      const b = cy.$id('n' + ((i + 1) % 12)).position();

      expect(Math.hypot(b.x - a.x, b.y - a.y)).to.be.within(30, 120);
    }

    // fit applied (the default): the viewport moved off zoom 1 / pan 0
    const pan = cy.pan();

    expect(cy.zoom() !== 1 || pan.x !== 0 || pan.y !== 0).to.equal(true);
    expect(nodes.length).to.equal(12);
  });

  it('is deterministic under a seed', async function () {
    const run = async () => {
      const cy = cytoscape({ elements: RING() });

      await cy.layout({ name: 'force', seed: 42, fit: false }).run().promise();

      return cy.nodes().map((n) => {
        const p = n.position();

        return [p.x, p.y];
      });
    };

    expect(await run()).to.deep.equal(await run());
  });

  it('resolves per-edge lengths through a plain function', async function () {
    const cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { id: 'short', source: 'a', target: 'b', len: 40 } },
        { data: { id: 'long', source: 'b', target: 'c', len: 160 } },
      ],
    });

    await cy
      .layout({
        name: 'force',
        seed: 3,
        fit: false,
        edgeLength: (edge) => edge.data('len'),
      })
      .run()
      .promise();

    const d = (id) => {
      const e = cy.$id(id);
      const s = e.source().position();
      const t = e.target().position();

      return Math.hypot(t.x - s.x, t.y - s.y);
    };

    expect(d('long')).to.be.greaterThan(d('short') * 1.5);
  });

  it('pins locked nodes in place', async function () {
    const cy = cytoscape({ elements: RING() });

    cy.$id('n0').position({ x: 500, y: 500 }).lock();

    await cy.layout({ name: 'force', seed: 1, fit: false }).run().promise();

    expect(cy.$id('n0').position()).to.deep.equal({ x: 500, y: 500 });
    // and the ring still relaxed around the pin
    expect(cy.$id('n6').position()).to.not.deep.equal({ x: 0, y: 0 });
  });

  it('simulates leaves only under compounds', async function () {
    const cy = cytoscape({
      elements: [
        { data: { id: 'p' } },
        { data: { id: 'a', parent: 'p' } },
        { data: { id: 'b', parent: 'p' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
    });

    await cy.layout({ name: 'force', seed: 2, fit: false }).run().promise();

    // the parent's box derives from its placed children
    const p = cy.$id('p');
    const a = cy.$id('a').position();
    const b = cy.$id('b').position();
    const bb = p.boundingBox({ includeLabels: false });

    expect(a.x).to.be.within(bb.x1, bb.x2);
    expect(b.x).to.be.within(bb.x1, bb.x2);
  });

  it('scopes to a subset via eles.layout', async function () {
    const cy = cytoscape({ elements: RING(8) });

    cy.$id('n7').position({ x: 9999, y: 9999 });

    const scope = cy
      .elements()
      .difference(cy.$id('n7'))
      .difference(cy.$id('e6'))
      .difference(cy.$id('e7'));

    await scope.layout({ name: 'force', seed: 1, fit: false }).run().promise();

    // the out-of-scope node never moved
    expect(cy.$id('n7').position()).to.deep.equal({ x: 9999, y: 9999 });
  });

  it('separates disconnected components and contains strays (59.2)', async function () {
    // two 8-rings plus four isolated nodes: the round-18 model piled
    // both rings onto the shared gravity centre (they interleaved) and
    // held strays only as far as a weak linear pull reached.  With
    // component anchors + the settle re-pack, the rings' boxes are
    // disjoint and every stray sits inside the packed field.
    const elements = [];

    for (const [prefix, base] of [
      ['a', 0],
      ['b', 100],
    ]) {
      for (let i = 0; i < 8; i++) {
        elements.push({ data: { id: prefix + i } });
        elements.push({
          data: {
            id: prefix + 'e' + i,
            source: prefix + i,
            target: prefix + ((i + 1) % 8),
          },
        });
      }
    }

    for (let i = 0; i < 4; i++) {
      elements.push({ data: { id: 'iso' + i } });
    }

    const cy = cytoscape({ elements });

    await cy.layout({ name: 'force', seed: 9, fit: false }).run().promise();

    const box = (prefix) => {
      let x1 = Infinity,
        y1 = Infinity,
        x2 = -Infinity,
        y2 = -Infinity;

      for (let i = 0; i < 8; i++) {
        const p = cy.$id(prefix + i).position();

        x1 = Math.min(x1, p.x);
        x2 = Math.max(x2, p.x);
        y1 = Math.min(y1, p.y);
        y2 = Math.max(y2, p.y);
      }

      return { x1, y1, x2, y2 };
    };
    const A = box('a');
    const B = box('b');
    const disjoint = A.x2 < B.x1 || B.x2 < A.x1 || A.y2 < B.y1 || B.y2 < A.y1;

    expect(disjoint, 'ring boxes disjoint').to.equal(true);

    // strays are in the packed field, not drifting at range
    for (let i = 0; i < 4; i++) {
      const p = cy.$id('iso' + i).position();

      expect(Math.hypot(p.x, p.y), 'iso' + i).to.be.lessThan(1500);
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).to.equal(true);
    }
  });

  it('skips the settle re-pack when anything is pinned (59.2)', async function () {
    // a locked node must never move — and a re-pack translates whole
    // components, so a scope holding a pinned node keeps the anchor
    // placement and skips the exact re-pack (recorded scope note)
    const elements = [];

    for (let i = 0; i < 4; i++) {
      elements.push({ data: { id: 'n' + i } });
    }

    elements.push({ data: { id: 'e0', source: 'n0', target: 'n1' } });
    elements.push({ data: { id: 'e1', source: 'n2', target: 'n3' } });

    const cy = cytoscape({ elements });

    cy.$id('n0').position({ x: 4000, y: 4000 }).lock();

    await cy.layout({ name: 'force', seed: 2, fit: false }).run().promise();

    expect(cy.$id('n0').position()).to.deep.equal({ x: 4000, y: 4000 });
  });

  it('uncurls a chain: the spectral seed reaches what refinement cannot (59.4)', async function () {
    // a 40-node path.  From a random scatter, every short-range model
    // curls it (round 18's own recorded limit); the landmark-MDS seed
    // embeds it near-collinear and the force phase preserves that.
    const elements = [];

    for (let i = 0; i < 40; i++) {
      elements.push({ data: { id: 'n' + i } });

      if (i > 0) {
        elements.push({
          data: { id: 'e' + i, source: 'n' + (i - 1), target: 'n' + i },
        });
      }
    }

    const cy = cytoscape({ elements });

    await cy.layout({ name: 'force', seed: 7, fit: false }).run().promise();

    const a = cy.$id('n0').position();
    const b = cy.$id('n39').position();

    // a straight 39-link chain at ideal length 60 spans ~2340; curled
    // scatters land at a small fraction of that.  0.4x is generous —
    // it discriminates curled from straight, not good from perfect.
    expect(Math.hypot(b.x - a.x, b.y - a.y)).to.be.greaterThan(39 * 60 * 0.4);
  });

  it("init: 'scatter' keeps the plain seeded start; unknown init throws (59.4)", async function () {
    const els = [];

    for (let i = 0; i < 10; i++) {
      els.push({ data: { id: 'n' + i } });

      if (i > 0) {
        els.push({
          data: { id: 'e' + i, source: 'n' + (i - 1), target: 'n' + i },
        });
      }
    }

    const spectral = cytoscape({ elements: els });
    const scatter = cytoscape({ elements: els });

    await spectral
      .layout({ name: 'force', seed: 3, fit: false })
      .run()
      .promise();
    await scatter
      .layout({ name: 'force', seed: 3, fit: false, init: 'scatter' })
      .run()
      .promise();

    // both are valid runs; they differ, which is what pins that the
    // option selects a different placement path
    const posOf = (cy) =>
      cy.nodes().map((node) => {
        const p = node.position();

        return [p.x, p.y];
      });

    expect(posOf(spectral)).to.not.deep.equal(posOf(scatter));

    const bad = cytoscape({ elements: els });

    expect(() => bad.layout({ name: 'force', init: 'organic' }).run()).to.throw(
      /unknown init/,
    );
  });

  it('compound gravity coheres each compound about its own centroid (59.5)', async function () {
    // a 16-ring whose halves belong to two compounds: the spectral
    // seed lays the ring as a circle, where the two half-arcs' boxes
    // overlap heavily; the owner-centroid pull contracts each half
    // into its own blob.  The acceptance is a compactness ratio, not
    // box disjointness — a ring fights the contraction by topology.
    const elements = [{ data: { id: 'P' } }, { data: { id: 'Q' } }];

    for (let i = 0; i < 16; i++) {
      elements.push({
        data: { id: 'n' + i, parent: i < 8 ? 'P' : 'Q' },
      });
      elements.push({
        data: { id: 'e' + i, source: 'n' + i, target: 'n' + ((i + 1) % 16) },
      });
    }

    const cy = cytoscape({ elements });

    await cy.layout({ name: 'force', seed: 11, fit: false }).run().promise();

    const centroid = (from, to) => {
      let x = 0;
      let y = 0;

      for (let i = from; i < to; i++) {
        const p = cy.$id('n' + i).position();

        x += p.x;
        y += p.y;
      }

      return { x: x / (to - from), y: y / (to - from) };
    };
    const spread = (from, to, c) => {
      let sum = 0;

      for (let i = from; i < to; i++) {
        const p = cy.$id('n' + i).position();

        sum += Math.hypot(p.x - c.x, p.y - c.y) ** 2;
      }

      return Math.sqrt(sum / (to - from));
    };
    const cp = centroid(0, 8);
    const cq = centroid(8, 16);
    const sep = Math.hypot(cq.x - cp.x, cq.y - cp.y);
    const rms = Math.max(spread(0, 8, cp), spread(8, 16, cq));

    // cohered compounds: each half's rms spread well under the
    // centroid separation.  The bound is measured, both ways: the
    // model without compound gravity reads 0.599 on this seed, with
    // it 0.421 — 0.5 fails the former and passes the latter with
    // margin (the first draft's 0.75 passed both, which is the
    // round-27 lesson about a spec that cannot fail)
    expect(rms).to.be.lessThan(sep * 0.5);

    // and every position is finite (the clustered fixture NaN'd
    // wholesale before round 59)
    for (let i = 0; i < 16; i++) {
      const p = cy.$id('n' + i).position();

      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).to.equal(true);
    }
  });

  it('nesting elevates the ideal length of compound-crossing edges (59.5)', async function () {
    // two 4-cliques in two compounds joined by one edge: the cross
    // edge spans two boundaries, so its ideal length is elevated by
    // nestingFactor per spanned level (v3 cose's rule) and it settles
    // visibly longer than the intra edges
    const elements = [{ data: { id: 'P' } }, { data: { id: 'Q' } }];

    for (const [prefix, parent] of [
      ['p', 'P'],
      ['q', 'Q'],
    ]) {
      for (let i = 0; i < 4; i++) {
        elements.push({ data: { id: prefix + i, parent } });

        for (let j = 0; j < i; j++) {
          elements.push({
            data: {
              id: prefix + i + '_' + j,
              source: prefix + i,
              target: prefix + j,
            },
          });
        }
      }
    }

    elements.push({ data: { id: 'cross', source: 'p0', target: 'q0' } });

    const cy = cytoscape({ elements });

    await cy.layout({ name: 'force', seed: 4, fit: false }).run().promise();

    const lengthOf = (id) => {
      const edge = cy.$id(id);
      const s = edge.source().position();
      const t = edge.target().position();

      return Math.hypot(t.x - s.x, t.y - s.y);
    };
    let intraSum = 0;
    let intraCount = 0;

    for (const prefix of ['p', 'q']) {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < i; j++) {
          intraSum += lengthOf(prefix + i + '_' + j);
          intraCount++;
        }
      }
    }

    expect(lengthOf('cross')).to.be.greaterThan((intraSum / intraCount) * 1.5);
  });

  it('streams positions in live mode and settles on stop()', async function () {
    const cy = cytoscape({ elements: RING() });
    const layout = cy.layout({
      name: 'force',
      seed: 4,
      animate: true,
      fit: false,
    });
    const snapshots = [];

    layout.run();

    // the sim streams through the bulk slot path (which, as recorded,
    // emits no per-node position events) — sample the live column
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) => setTimeout(resolve, 25));
      snapshots.push(cy.$id('n0').position().x);
    }

    expect(new Set(snapshots).size).to.be.greaterThan(1);

    layout.stop();
    await layout.promise();

    expect(cy.$id('n0').position().x).to.be.a('number');
  });
});
