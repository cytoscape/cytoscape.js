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

  // a 40-node path, the chain fixture both spectral specs measure
  const CHAIN = () => {
    const elements = [];

    for (let i = 0; i < 40; i++) {
      elements.push({ data: { id: 'n' + i } });

      if (i > 0) {
        elements.push({
          data: { id: 'e' + i, source: 'n' + (i - 1), target: 'n' + i },
        });
      }
    }

    return elements;
  };

  /** end-to-end spread of the laid-out chain under one init mode */
  const chainSpread = async (init) => {
    const cy = cytoscape({ elements: CHAIN() });

    await cy
      .layout({ name: 'force', seed: 7, fit: false, ...init })
      .run()
      .promise();

    const a = cy.$id('n0').position();
    const b = cy.$id('n39').position();

    return Math.hypot(b.x - a.x, b.y - a.y);
  };

  it('uncurls a chain: the spectral seed reaches what refinement cannot (59.4)', async function () {
    // From a random scatter, every short-range model curls the chain
    // (round 18's own recorded limit); the landmark-MDS seed embeds it
    // near-collinear and the force phase preserves that.
    //
    // a straight 39-link chain at ideal length 60 spans ~2340; curled
    // scatters land at a small fraction of that.  0.4x is generous —
    // it discriminates curled from straight, not good from perfect.
    const spread = await chainSpread();

    // This spec has failed intermittently in the full tier (rounds 86,
    // 108 and 109), always at the same value, and a bare "346.4557 is
    // not above 936" told three rounds nothing.  So on failure it
    // re-measures the scatter path here and says whether the number it
    // got is that path's — which is the whole diagnosis, in the
    // failure message, on the run that saw it.
    if (spread <= 39 * 60 * 0.4) {
      const scatter = await chainSpread({ init: 'scatter' });
      const same = Math.abs(spread - scatter) < 1e-6;

      expect.fail(
        `chain spread ${spread}; the scatter path measures ${scatter} in ` +
          `this same process, so the spectral seed ` +
          `${same ? 'did not run' : 'ran and did not uncurl the chain'}`,
      );
    }

    expect(spread).to.be.greaterThan(39 * 60 * 0.4);
  });

  it('the chain spec discriminates the seed, not the machine (round 109)', async function () {
    // Round 86 saw the spec above fail at 346.4557 and round 109's plan
    // read it as harness sensitivity.  It is not: 346.4557 is exactly
    // what `init: 'scatter'` produces on this fixture, so whatever that
    // run did, the spectral seed did not run.  The absolute bound above
    // cannot say that; this one does, by measuring both paths in one
    // process and asserting the gap between them.  A regression that
    // silently falls back to the scatter path fails here by name.
    const spectral = await chainSpread();
    const scatter = await chainSpread({ init: 'scatter' });

    expect(scatter).to.be.lessThan(39 * 60 * 0.4);
    expect(spectral).to.be.greaterThan(scatter * 4);
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

  it('streams positions under animateLive and settles on stop()', async function () {
    const cy = cytoscape({ elements: RING() });
    const layout = cy.layout({
      name: 'force',
      seed: 4,
      animateLive: true,
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

  // Round 114.5: `animate: true` is the discrete layouts' meaning — the
  // sim settles silently, then the nodes tween into place through the
  // shared finisher; `animateLive` is the streaming run.  And the sim is
  // point-based, so the settle separates node bodies (labels included by
  // default) before the re-pack.
  describe('animate tweens to the settle; animateLive streams (114.5)', function () {
    const settled = async (opts = {}) => {
      const cy = cytoscape({
        elements: RING(),
        headlessWidth: 800,
        headlessHeight: 600,
      });

      await cy
        .layout({ name: 'force', seed: 9, ...opts })
        .run()
        .promise();

      return cy;
    };

    it('animate: true ends where the sync run ends, and fits', async function () {
      const sync = await settled();
      const cy = cytoscape({
        elements: RING(),
        headlessWidth: 800,
        headlessHeight: 600,
      });
      const log = [];

      for (const type of ['layoutstart', 'layoutready', 'layoutstop']) {
        cy.on(type, () => log.push(type));
      }

      // the tween starts from the pre-run positions: no node sits where
      // the settle will put it
      const before = cy.nodes().map((n) => ({ ...n.position() }));

      await cy
        .layout({
          name: 'force',
          seed: 9,
          animate: true,
          animationDuration: 40,
        })
        .run()
        .promise();

      cy.nodes().forEach((n, i) => {
        const want = sync.$id(n.id()).position();

        expect(n.position().x, n.id()).to.be.closeTo(want.x, 1e-3);
        expect(n.position().y, n.id()).to.be.closeTo(want.y, 1e-3);
        expect(
          Math.hypot(before[i].x - want.x, before[i].y - want.y),
        ).to.be.greaterThan(1);
      });
      expect(cy.zoom()).to.be.closeTo(sync.zoom(), 1e-6);
      expect(log).to.deep.equal(['layoutstart', 'layoutready', 'layoutstop']);
    });

    it('animate: true honours the finisher options force used to ignore', async function () {
      const sync = await settled({ fit: false });
      const cy = await settled({
        fit: false,
        animate: true,
        animationDuration: 20,
        transform: (node, pos) => ({ x: pos.x + 1000, y: pos.y }),
        animateFilter: (node) => node.id() !== 'n0',
      });

      cy.nodes().forEach((n) => {
        expect(n.position().x, n.id()).to.be.closeTo(
          sync.$id(n.id()).position().x + 1000,
          1e-3,
        );
      });
      // zoom/pan with fit: false animate too (114.2's lone-zoom fix)
      const zoomed = await settled({
        fit: false,
        animate: true,
        animationDuration: 20,
        zoom: 2,
      });

      expect(zoomed.zoom()).to.be.closeTo(2, 1e-6);
    });

    it('animateLive lands the settle in one write, no second tween', async function () {
      const sync = await settled({ fit: false });
      const cy = cytoscape({
        elements: RING(),
        headlessWidth: 800,
        headlessHeight: 600,
      });
      const layout = cy.layout({
        name: 'force',
        seed: 9,
        fit: false,
        animateLive: true,
        stepsPerFrame: 200,
      });

      layout.run();

      const t = Date.now();

      await layout.promise();

      // a settle write, not a 500 ms default tween after the stream
      expect(Date.now() - t).to.be.lessThan(400);
      cy.nodes().forEach((n) => {
        expect(n.position().x, n.id()).to.be.closeTo(
          sync.$id(n.id()).position().x,
          1e-3,
        );
      });
    });
  });

  describe('avoidOverlap separates node bodies at the settle (114.5)', function () {
    const CLIQUE = (n, size) => {
      const elements = [];

      for (let i = 0; i < n; i++) {
        elements.push({ data: { id: 'n' + i } });
      }

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          elements.push({
            data: { id: `e${i}_${j}`, source: 'n' + i, target: 'n' + j },
          });
        }
      }

      return cytoscape({
        elements,
        style: { nodes: { width: size, height: size } },
        headlessWidth: 800,
        headlessHeight: 600,
      });
    };

    const overlapping = (cy, includeLabels = false) => {
      const boxes = cy.nodes().map((n) => n.boundingBox({ includeLabels }));
      let count = 0;

      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];

          if (a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2) {
            count++;
          }
        }
      }

      return count;
    };

    it('leaves no two bodies overlapping by default', async function () {
      const cy = CLIQUE(30, 40);

      await cy.layout({ name: 'force', seed: 7 }).run().promise();

      expect(overlapping(cy)).to.equal(0);
    });

    it("control: avoidOverlap: false leaves the sim's pile as it landed", async function () {
      const cy = CLIQUE(30, 40);

      await cy
        .layout({ name: 'force', seed: 7, avoidOverlap: false })
        .run()
        .promise();

      // a 30-clique of 40 px bodies at the default ideal length cannot
      // help but overlap — the separation is what clears it
      expect(overlapping(cy)).to.be.greaterThan(10);
    });

    it('includes labels on request, bodies alone by default (115)', async function () {
      const withLabels = CLIQUE(12, 20);

      withLabels.style({
        nodes: { width: 20, height: 20, label: 'a long enough label' },
      });
      await withLabels
        .layout({ name: 'force', seed: 3, nodeDimensionsIncludeLabels: true })
        .run()
        .promise();
      expect(overlapping(withLabels, true)).to.equal(0);

      const bodiesOnly = CLIQUE(12, 20);

      bodiesOnly.style({
        nodes: { width: 20, height: 20, label: 'a long enough label' },
      });
      await bodiesOnly
        .layout({ name: 'force', seed: 3, nodeDimensionsIncludeLabels: false })
        .run()
        .promise();
      // the control: bodies clear, labels do not
      expect(overlapping(bodiesOnly, false)).to.equal(0);
      expect(overlapping(bodiesOnly, true)).to.be.greaterThan(0);
    });

    it('a locked node is an obstacle: it stays, the overlapping neighbour moves', async function () {
      const cy = CLIQUE(30, 40);

      // park the pinned node where the pile will land (the centroid of a
      // clique's settle is its anchor at the origin)
      cy.$id('n0').position({ x: 0, y: 0 }).lock();

      await cy.layout({ name: 'force', seed: 7, fit: false }).run().promise();

      expect(cy.$id('n0').position()).to.deep.equal({ x: 0, y: 0 });
      expect(overlapping(cy)).to.equal(0);
    });
  });
});
