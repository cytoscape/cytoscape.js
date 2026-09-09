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
      // the control settles at the stream's own threshold (119.3: a
      // watched run keeps the sim's 0.1 px, a silent one defaults to
      // 2% of the edge length), so the two runs share a trajectory
      const sync = await settled({ fit: false, threshold: 0.1 });
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

  describe('boundingBox holds the bodies, scaling down only (116.2)', function () {
    const bodies = (cy) =>
      cy.nodes().map((n) => n.boundingBox({ includeLabels: false }));
    const within = (bb, box, eps = 1e-3) =>
      bb.x1 >= box.x1 - eps &&
      bb.y1 >= box.y1 - eps &&
      bb.x2 <= box.x1 + box.w + eps &&
      bb.y2 <= box.y1 + box.h + eps;
    const distances = (cy) => {
      const ps = cy.nodes().map((n) => n.position());
      const out = [];

      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          out.push(Math.hypot(ps[j].x - ps[i].x, ps[j].y - ps[i].y));
        }
      }

      return out;
    };
    const run = async (cy, extra) => {
      await cy
        .layout({ name: 'force', seed: 3, fit: false, ...extra })
        .run()
        .promise();
    };

    it('a small box holds every body', async function () {
      const cy = cytoscape({ elements: RING() });
      const box = { x1: 100, y1: 100, w: 150, h: 120 };

      await run(cy, { boundingBox: box });

      for (const bb of bodies(cy)) {
        expect(within(bb, box), JSON.stringify(bb)).to.equal(true);
      }
    });

    it('control: without the box the ring is wider than that', async function () {
      const cy = cytoscape({ elements: RING() });

      await run(cy, {});

      const bb = cy.nodes().boundingBox({ includeLabels: false });

      expect(bb.w > 150 || bb.h > 120).to.equal(true);
    });

    it('a box larger than the drawing centres it and never inflates it', async function () {
      const free = cytoscape({ elements: RING() });
      const boxed = cytoscape({ elements: RING() });
      const box = { x1: 1000, y1: 1000, w: 5000, h: 5000 };

      await run(free, {});
      await run(boxed, { boundingBox: box });

      const a = distances(free);
      const b = distances(boxed);

      for (let i = 0; i < a.length; i++) {
        expect(b[i]).to.be.closeTo(a[i], 1e-3);
      }

      const bb = boxed.nodes().boundingBox({ includeLabels: false });

      expect((bb.x1 + bb.x2) / 2).to.be.closeTo(3500, 1e-3);
      expect((bb.y1 + bb.y2) / 2).to.be.closeTo(3500, 1e-3);
    });

    it('a pinned node holds the box back, as it holds the re-pack', async function () {
      const cy = cytoscape({ elements: RING() });
      const box = { x1: 100, y1: 100, w: 150, h: 120 };

      cy.$id('n0').position({ x: -500, y: -500 }).lock();
      await run(cy, { boundingBox: box, randomize: false });

      expect(cy.$id('n0').position()).to.deep.equal({ x: -500, y: -500 });
      expect(bodies(cy).some((bb) => !within(bb, box))).to.equal(true);
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

    // the smallest gap between any two bodies
    const minGap = (cy) => {
      const boxes = cy
        .nodes()
        .map((n) => n.boundingBox({ includeLabels: false }));
      let out = Infinity;

      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i];
          const b = boxes[j];
          const gx = Math.max(a.x1 - b.x2, b.x1 - a.x2);
          const gy = Math.max(a.y1 - b.y2, b.y1 - a.y2);

          out = Math.min(out, Math.max(gx, gy));
        }
      }

      return out;
    };

    // 118.2: which mechanism keeps the boxes apart is the option's
    // value — the settle's exact pass ('settle', the default), a
    // separation sweep after every tick ('sim'), or both.  The sweep
    // is what a streamed run shows: sample the live column mid-run.
    // Mid-transient the springs press a pile a box deep every tick and
    // the sweeps hold it open rather than clear it (measured on the
    // sim: a 30-clique holds ~45 of its 435 pairs overlapping at tick
    // 50 under the sweeps against the whole pile without them, and is
    // clear from tick ~400 of 458), so the mid-run assertion is the
    // ratio, and the end state is what is exact
    const streamed = async (avoidOverlap, frames = 12) => {
      const cy = CLIQUE(30, 40);
      const layout = cy.layout({
        name: 'force',
        seed: 7,
        fit: false,
        animateLive: true,
        stepsPerFrame: 3,
        avoidOverlap,
      });
      let seen = 0;
      let midRun = null;

      layout.run();

      // the stream lands through the bulk slot path, which emits no
      // per-node events — poll the column until enough frames passed
      while (seen < frames) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        seen++;
      }

      midRun = overlapping(cy);

      await layout.promise();

      return { midRun, final: overlapping(cy), gap: minGap(cy) };
    };

    it("avoidOverlap: 'sim' streams a held-open pile and ends clear with no settle pass", async function () {
      const sim = await streamed('sim');
      const settle = await streamed('settle');

      // the control: the point sim's pile mid-run, cleared by the
      // settle's pass at the end to exactly the padding
      expect(settle.midRun).to.be.greaterThan(30);
      expect(settle.final).to.equal(0);
      expect(settle.gap).to.be.closeTo(10, 0.5);

      expect(
        sim.midRun,
        `sim ${sim.midRun} vs settle ${settle.midRun}`,
      ).to.be.lessThan(settle.midRun / 3);
      expect(sim.final).to.equal(0);
      // the sweep lands pairs a hair past touching, the settle's own
      // rule, so the tightest gap is the padding
      expect(sim.gap).to.be.within(9.5, 15);
    });

    it("'both' sweeps per tick and separates at the settle: held open mid-run, exactly the padding at the end", async function () {
      const { midRun, final, gap } = await streamed('both');

      expect(midRun).to.be.lessThan(100);
      expect(final).to.equal(0);
      expect(gap).to.be.closeTo(10, 0.5);
    });

    it('control: by default the sim is the point sim and the settle separates to exactly the padding (117)', async function () {
      // item 56: the per-tick sweep is opt-in, so the default run's
      // pile is opened by the settle alone, whose tightest pair sits at
      // the padding
      const cy = CLIQUE(30, 40);

      await cy.layout({ name: 'force', seed: 7, fit: false }).run().promise();

      expect(overlapping(cy)).to.equal(0);
      expect(minGap(cy)).to.be.closeTo(10, 0.5);
    });

    it('any other avoidOverlap value throws at start', function () {
      const cy = CLIQUE(4, 20);

      expect(() =>
        cy.layout({ name: 'force', avoidOverlap: 'sometimes' }).run(),
      ).to.throw(TypeError, /avoidOverlap/);
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

    it('an infinite run keeps a clique of bodies apart by the sweep, at rest', async function () {
      // 118.3: no settle to land a pass on, so avoidOverlap means the
      // per-tick sweep — the field rests overlap-free
      const cy = CLIQUE(12, 40);
      const layout = cy.layout({
        name: 'force',
        seed: 7,
        fit: false,
        infinite: true,
        stepsPerFrame: 12,
      });

      layout.run();
      await new Promise((resolve) => setTimeout(resolve, 1500));

      expect(overlapping(cy)).to.equal(0);
      expect(minGap(cy)).to.be.within(9.5, 15);

      layout.stop();
      await layout.promise();
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

// Round 118.3: the infinite run — the live force-directed layout that
// never ends, done so that it costs nothing at rest: the sim ticks only
// while its field moves, a drag pins the grabbed node and heats the
// field, a moved node or an added element does the same, and stop()
// lands the positions as they stand.
describe('gpu/layout: the infinite force run (118.3)', function () {
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const snapshot = (cy) =>
    Object.fromEntries(cy.nodes().map((n) => [n.id(), { ...n.position() }]));
  const start = (cy, extra = {}) => {
    const layout = cy.layout({
      name: 'force',
      seed: 4,
      fit: false,
      infinite: true,
      stepsPerFrame: 6,
      ...extra,
    });
    let settled = false;

    layout.run();
    layout.promise().then(() => {
      settled = true;
    });

    return { layout, isSettled: () => settled };
  };

  it('stays open at rest: the positions stop moving, the promise stays pending, stop() lands them without a fit', async function () {
    const cy = cytoscape({
      elements: RING(),
      headlessWidth: 800,
      headlessHeight: 600,
    });
    const zoom = cy.zoom();
    const { layout, isSettled } = start(cy);

    await wait(1200);

    const a = snapshot(cy);

    await wait(300);

    expect(snapshot(cy)).to.deep.equal(a);
    expect(isSettled()).to.equal(false);

    layout.stop();
    await layout.promise();

    expect(snapshot(cy)).to.deep.equal(a);
    expect(cy.zoom()).to.equal(zoom);
  });

  it('a drag reheats the field: the grabbed node holds where it is put and its neighbours follow', async function () {
    const cy = cytoscape({ elements: RING() });
    const { layout } = start(cy);

    await wait(1200);

    const before = snapshot(cy);
    const n0 = cy.$id('n0');
    const target = { x: before.n0.x + 400, y: before.n0.y };

    n0.emit('grab');
    n0.position({ x: before.n0.x + 200, y: before.n0.y });
    n0.position(target);

    await wait(600);

    // held: the grabbed node is pinned where the pointer put it while
    // the field reflows around it, and its ring neighbours are pulled
    // after it
    expect(cy.$id('n0').position().x).to.be.closeTo(target.x, 0.01);
    for (const id of ['n1', 'n11']) {
      expect(cy.$id(id).position().x, id).to.be.greaterThan(before[id].x + 50);
    }

    n0.emit('free');
    await wait(600);

    // released: the node joins the sim again and the ring relaxes —
    // the springs pull it back toward its neighbours, and the field
    // comes to rest somewhere between
    const after = cy.$id('n0').position().x;

    expect(after).to.be.lessThan(target.x - 20);
    expect(after).to.be.greaterThan(before.n0.x + 20);

    layout.stop();
    await layout.promise();
  });

  it('control: after a finished animateLive run the same gesture moves nothing else', async function () {
    const cy = cytoscape({ elements: RING() });

    await cy
      .layout({ name: 'force', seed: 4, fit: false, animateLive: true })
      .run()
      .promise();

    const before = snapshot(cy);
    const n0 = cy.$id('n0');

    n0.emit('grab');
    n0.position({ x: before.n0.x + 400, y: before.n0.y });
    n0.emit('free');

    await wait(300);

    for (const id of ['n1', 'n11']) {
      expect(cy.$id(id).position()).to.deep.equal(before[id]);
    }
  });

  it('an added node and edge are absorbed: the sim is rebuilt on the live graph', async function () {
    const cy = cytoscape({ elements: RING() });
    const { layout, isSettled } = start(cy);

    await wait(1200);

    const n0 = cy.$id('n0').position();

    cy.add([
      { data: { id: 'extra' }, position: { x: n0.x + 2000, y: n0.y + 2000 } },
      { data: { id: 'e-extra', source: 'extra', target: 'n0' } },
    ]);

    await wait(1500);

    const p = cy.$id('extra').position();

    expect(
      Math.hypot(
        p.x - cy.$id('n0').position().x,
        p.y - cy.$id('n0').position().y,
      ),
    ).to.be.lessThan(250);
    expect(isSettled()).to.equal(false);

    layout.stop();
    await layout.promise();
  });

  it('control: a finished run leaves an added node where it was added', async function () {
    const cy = cytoscape({ elements: RING() });

    await cy
      .layout({ name: 'force', seed: 4, fit: false, animateLive: true })
      .run()
      .promise();

    const n0 = cy.$id('n0').position();

    cy.add([
      { data: { id: 'extra' }, position: { x: n0.x + 2000, y: n0.y + 2000 } },
      { data: { id: 'e-extra', source: 'extra', target: 'n0' } },
    ]);

    await wait(300);

    expect(cy.$id('extra').position().x).to.be.closeTo(n0.x + 2000, 0.01);
    expect(cy.$id('extra').position().y).to.be.closeTo(n0.y + 2000, 0.01);
  });

  it("a subset scope ignores an add: the caller's collection is the scope", async function () {
    const cy = cytoscape({ elements: RING() });
    const layout = cy.nodes().slice(0, 6).layout({
      name: 'force',
      seed: 4,
      fit: false,
      infinite: true,
      stepsPerFrame: 6,
    });

    layout.run();
    await wait(800);

    cy.add([
      { data: { id: 'extra' }, position: { x: 5000, y: 5000 } },
      { data: { id: 'e-extra', source: 'extra', target: 'n0' } },
    ]);

    await wait(600);

    expect(cy.$id('extra').position()).to.deep.equal({ x: 5000, y: 5000 });

    layout.stop();
    await layout.promise();
  });

  it('reheat() returns the layout and wakes an infinite run', async function () {
    const cy = cytoscape({ elements: RING() });
    const { layout } = start(cy);

    await wait(1000);

    expect(layout.reheat()).to.equal(layout);

    layout.stop();
    await layout.promise();
  });

  it('a locked node stays through a drag of its neighbour', async function () {
    const cy = cytoscape({ elements: RING() });

    cy.$id('n6').position({ x: 300, y: 300 }).lock();

    const { layout } = start(cy);

    await wait(1000);

    const n5 = cy.$id('n5');
    const p = n5.position();

    n5.emit('grab');
    n5.position({ x: p.x + 300, y: p.y });
    n5.emit('free');

    await wait(500);

    expect(cy.$id('n6').position()).to.deep.equal({ x: 300, y: 300 });

    layout.stop();
    await layout.promise();
  });
});

// Round 120: the smallest components take canonical shapes at the
// settle — a pair stands vertically, three make a point-up triangle,
// four a diamond — so the packed rows of small components read as
// order, and two centre labels on a pair never sit side by side.
describe('the smallest components take canonical shapes (120)', function () {
  const SMALL = () => [
    // a 6-ring, so the largest component is a real sim shape
    ...RING(6),
    // a pair, a 3-path, a 4-cycle
    { data: { id: 'p0' } },
    { data: { id: 'p1' } },
    { data: { id: 'pe', source: 'p0', target: 'p1' } },
    { data: { id: 't0' } },
    { data: { id: 't1' } },
    { data: { id: 't2' } },
    { data: { id: 'te0', source: 't0', target: 't1' } },
    { data: { id: 'te1', source: 't1', target: 't2' } },
    { data: { id: 'd0' } },
    { data: { id: 'd1' } },
    { data: { id: 'd2' } },
    { data: { id: 'd3' } },
    { data: { id: 'de0', source: 'd0', target: 'd1' } },
    { data: { id: 'de1', source: 'd1', target: 'd2' } },
    { data: { id: 'de2', source: 'd2', target: 'd3' } },
    { data: { id: 'de3', source: 'd3', target: 'd0' } },
  ];
  const run = async (opts = {}) => {
    const cy = cytoscape({ elements: SMALL() });

    await cy
      .layout({ name: 'force', seed: 4, fit: false, ...opts })
      .run()
      .promise();

    return cy;
  };
  const pos = (cy, id) => cy.$id(id).position();
  const d = (cy, a, b) =>
    Math.hypot(pos(cy, a).x - pos(cy, b).x, pos(cy, a).y - pos(cy, b).y);

  it('a pair stands vertically, three make a triangle, four a diamond', async function () {
    const cy = await run();

    // the pair: one x, a full edge length apart vertically
    expect(pos(cy, 'p0').x).to.be.closeTo(pos(cy, 'p1').x, 1e-3);
    expect(Math.abs(pos(cy, 'p0').y - pos(cy, 'p1').y)).to.be.closeTo(60, 1e-3);

    // the triangle: three equal sides, the apex above a level base
    expect(d(cy, 't0', 't1')).to.be.closeTo(60, 1e-3);
    expect(d(cy, 't1', 't2')).to.be.closeTo(60, 1e-3);
    expect(d(cy, 't2', 't0')).to.be.closeTo(60, 1e-3);

    const ys = ['t0', 't1', 't2']
      .map((id) => pos(cy, id).y)
      .sort((a, b) => a - b);

    expect(ys[1]).to.be.closeTo(ys[2], 1e-3);
    expect(ys[0]).to.be.lessThan(ys[1] - 30);

    // the diamond: four equal sides along the cycle, axis-aligned diagonals
    for (const [a, b] of [
      ['d0', 'd1'],
      ['d1', 'd2'],
      ['d2', 'd3'],
      ['d3', 'd0'],
    ]) {
      expect(d(cy, a, b), a + '-' + b).to.be.closeTo(60, 1e-3);
    }

    expect(pos(cy, 'd0').x).to.be.closeTo(pos(cy, 'd2').x, 1e-3);
    expect(pos(cy, 'd1').y).to.be.closeTo(pos(cy, 'd3').y, 1e-3);
  });

  it('tidyComponents: false keeps the sim’s shapes (the control), and a locked node holds its component', async function () {
    const raw = await run({ tidyComponents: false });

    // the sim leaves the pair at its seed's angle, not upright
    expect(Math.abs(pos(raw, 'p0').x - pos(raw, 'p1').x)).to.be.greaterThan(1);

    const cy = cytoscape({ elements: SMALL() });

    cy.$id('p0').position({ x: 900, y: 900 }).lock();
    cy.$id('p1').position({ x: 950, y: 920 });
    await cy.layout({ name: 'force', seed: 4, fit: false }).run().promise();

    // the locked pair is exactly where it was left; the free shapes still took theirs
    expect(pos(cy, 'p0')).to.deep.equal({ x: 900, y: 900 });
    expect(Math.abs(pos(cy, 'p0').x - pos(cy, 'p1').x)).to.be.greaterThan(1);
    expect(d(cy, 't0', 't1')).to.be.closeTo(60, 1e-3);
  });
});

// Round 121.1: the settle's re-pack takes the caller's grouping and
// order — `componentGroup` a function of each component's description
// (its nodes, its size, its packed box), the groups standing in a row
// by key; `componentOrder` a comparator ahead of the largest-first
// order — so the EnrichmentMap shape (negatives left, positives right,
// each side's rows by score) is one force call.  121.2: the larger
// components turn to a canonical angle.
describe('the re-pack takes a grouping and an order (121)', function () {
  // six singletons with a score, and a signed pair each side
  const SCORED = () => [
    ...['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) => ({
      data: { id, score: [2, -1, 1, -2, 3, -3][i] },
    })),
    { data: { id: 'n0', score: -1 } },
    { data: { id: 'n1', score: -1 } },
    { data: { id: 'ne', source: 'n0', target: 'n1' } },
    { data: { id: 'p0', score: 1 } },
    { data: { id: 'p1', score: 1 } },
    { data: { id: 'pe', source: 'p0', target: 'p1' } },
  ];
  const mean = (c) => {
    let s = 0;

    c.nodes.forEach((n) => {
      s += n.data('score');
    });

    return s / c.size;
  };
  const run = async (opts = {}, elements = SCORED()) => {
    const cy = cytoscape({ elements });

    await cy
      .layout({ name: 'force', seed: 2, fit: false, ...opts })
      .run()
      .promise();

    return cy;
  };
  // ids in one group's reading order: by shelf, then left to right —
  // a shelf aligns its boxes' tops
  const reading = (cy, ids) =>
    ids
      .map((id) => {
        const bb = cy.$id(id).boundingBox();

        return { id, x: bb.x1, y: Math.round(bb.y1) };
      })
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((b) => b.id);

  it('componentGroup packs the groups in a row, keyed ascending, a groupSpacing apart', async function () {
    const calls = [];
    const cy = await run({
      componentGroup: (c) => {
        calls.push(c);

        return Math.sign(mean(c));
      },
      groupSpacing: 200,
    });

    // one description per component: eight, with the pair's nodes as a
    // collection and its box as the re-pack sees it
    expect(calls.length).to.equal(8);

    const pair = calls.find(
      (c) => c.size === 2 && c.nodes.map((n) => n.id()).includes('n0'),
    );

    expect(pair.nodes.map((n) => n.id()).sort()).to.deep.equal(['n0', 'n1']);
    expect(pair.width).to.be.greaterThan(0);
    expect(pair.height).to.be.greaterThan(pair.width);

    // every negative is left of every positive, by at least the gap
    const neg = cy.nodes((n) => n.data('score') < 0);
    const pos = cy.nodes((n) => n.data('score') > 0);

    expect(pos.boundingBox().x1 - neg.boundingBox().x2).to.be.at.least(
      200 - 1e-6,
    );
  });

  it('componentOrder orders the rows: by size, then by score, with the largest-first default as the tie-break', async function () {
    const cy = await run({
      componentGroup: (c) => Math.sign(mean(c)),
      componentOrder: (a, b) => b.size - a.size || mean(b) - mean(a),
    });

    // reading order — by shelf (the box tops, which a shelf aligns),
    // then left to right: on the positive side the pair first, then
    // the singletons by score descending; on the negative side the
    // pair (-1), then -1, -2, -3
    expect(reading(cy, ['c', 'a', 'e', 'p0'])).to.deep.equal([
      'p0',
      'e',
      'a',
      'c',
    ]);
    expect(reading(cy, ['f', 'd', 'b', 'n0'])).to.deep.equal([
      'n0',
      'b',
      'd',
      'f',
    ]);
  });

  it('an unkeyed component packs last, a non-function throws at start, and a locked node holds the run to one field', async function () {
    const cy = await run({
      componentGroup: (c) => (c.size === 1 ? null : 'pairs'),
    });

    // the pairs are the keyed group, the singletons the unkeyed one
    // after it
    const pairs = cy.nodes((n) => ['n0', 'n1', 'p0', 'p1'].includes(n.id()));
    const singles = cy.nodes().difference(pairs);

    expect(singles.boundingBox().x1).to.be.greaterThan(pairs.boundingBox().x2);

    expect(() =>
      cytoscape({ elements: SCORED() })
        .layout({
          name: 'force',
          componentGroup: 'score',
        })
        .run(),
    ).to.throw(/componentGroup must be a function/);
    expect(() =>
      cytoscape({ elements: SCORED() })
        .layout({
          name: 'force',
          componentOrder: 'score',
        })
        .run(),
    ).to.throw(/componentOrder must be a function/);

    // a locked node skips the re-pack, so the grouping with it: the
    // call is never made
    const els = SCORED();

    els[0].locked = true;
    els[0].position = { x: 0, y: 0 };

    let called = 0;

    await run({ componentGroup: () => called++ }, els);

    expect(called).to.equal(0);
  });

  it('a larger component lies flat at the settle (121.2), and keeps its shape', async function () {
    // a 7-path: a principal axis, and no small shape
    const els = [];

    for (let i = 0; i < 7; i++) {
      els.push({ data: { id: 'q' + i } });

      if (i > 0) {
        els.push({
          data: { id: 'qe' + i, source: 'q' + (i - 1), target: 'q' + i },
        });
      }
    }

    const cy = await run({ avoidOverlap: false }, els);
    const ys = cy.nodes().map((n) => n.position().y);
    const xs = cy.nodes().map((n) => n.position().x);
    const spreadY = Math.max(...ys) - Math.min(...ys);
    const spreadX = Math.max(...xs) - Math.min(...xs);

    expect(spreadX).to.be.greaterThan(spreadY * 3);

    // the control: tidy off keeps the sim's angle
    const control = await run(
      { avoidOverlap: false, tidyComponents: false },
      els,
    );
    const cys = control.nodes().map((n) => n.position().y);
    const cxs = control.nodes().map((n) => n.position().x);
    const flat =
      Math.max(...cxs) - Math.min(...cxs) >
      (Math.max(...cys) - Math.min(...cys)) * 3;

    // the same shape either way: the end-to-end length
    const end = (c) => {
      const a = c.$id('q0').position();
      const b = c.$id('q6').position();

      return Math.hypot(a.x - b.x, a.y - b.y);
    };

    expect(end(cy)).to.be.closeTo(end(control), 1e-3);
    // (the seed's angle is whatever it is; the spec records that the
    // turned run is flat, and only that the control is the same shape)
    void flat;
  });
});
