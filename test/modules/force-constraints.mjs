import { expect } from 'chai';
import { ForceSim, defaultForceParams } from '../../src/layout/force-sim.mjs';

// round 85.2: the constraint projection, driven at the sim level where
// iteration counts are readable — the paired convergence-plus-
// satisfaction spec lives here because the projection/fold ordering
// has a wrong answer in each direction: fold-then-project reads as
// never settling (the projection's own corrections keep maxDisp hot),
// project-then-fold can converge while violated (the last tick would
// end unprojected).  The public option surface and its throws are
// covered in test/force-constraints.mjs.

const ring = (n) => {
  const edges = [];

  for (let i = 0; i < n; i++) {
    edges.push(i, (i + 1) % n);
  }

  return Uint32Array.from(edges);
};

const seededPositions = (n) => {
  const out = new Float32Array(n * 2);

  for (let i = 0; i < n; i++) {
    // deterministic scatter, no two coincident
    out[i * 2] = ((i * 73) % 97) * 5;
    out[i * 2 + 1] = ((i * 31) % 89) * 5;
  }

  return out;
};

const mkSim = (n, constraints, extra = {}) => {
  const edges = ring(n);

  return new ForceSim({
    ...defaultForceParams(),
    n,
    edges,
    edgeLength: new Float32Array(edges.length / 2).fill(60),
    positions: seededPositions(n),
    constraints,
    ...extra,
  });
};

const spread = (sim, members, axis) => {
  const pos = sim.positions;
  let lo = Infinity;
  let hi = -Infinity;

  for (const i of members) {
    lo = Math.min(lo, pos[i * 2 + axis]);
    hi = Math.max(hi, pos[i * 2 + axis]);
  }

  return hi - lo;
};

describe('force constraints: the projection (round 85.2)', function () {
  it('a constrained run both converges and satisfies (the paired spec)', function () {
    // horizontal alignment (shared y) on three ring nodes + one
    // relative pair — the fixture the ordering bugs discriminate on
    const members = Int32Array.from([0, 4, 8]);
    const sim = mkSim(12, {
      groups: [{ axis: 1, members }],
      pairs: [{ a: 1, b: 7, axis: 0, gap: 50 }],
    });

    sim.project(); // the pre-tick projection (the seed is blind)

    while (!sim.converged()) {
      sim.step(50);
    }

    // converged by settling, not by burning the iteration cap — the
    // fold-then-project ordering fails exactly here
    expect(sim.iteration).to.be.below(defaultForceParams().iterations);

    // and the converged state satisfies — the project-then-fold-
    // without-a-final-projection ordering fails exactly here
    expect(spread(sim, members, 1)).to.be.below(1e-3);
    expect(sim.positions[7 * 2] - sim.positions[1 * 2]).to.be.at.least(
      50 - 1e-3,
    );
  });

  it('an unconstrained twin of the same seed shows a real spread (the control)', function () {
    const members = [0, 4, 8];
    const sim = mkSim(12, undefined);

    while (!sim.converged()) {
      sim.step(50);
    }

    // the same nodes without the constraint land well apart — so the
    // paired spec above is discriminating, not vacuous
    expect(spread(sim, members, 1)).to.be.above(10);
  });

  it('a locked member pins the group at its coordinate', function () {
    const pinned = new Uint8Array(12);

    pinned[4] = 1;

    const positions = seededPositions(12);
    const pinnedY = 1234.5;

    positions[4 * 2 + 1] = pinnedY;

    const members = Int32Array.from([0, 4, 8]);
    const sim2 = new ForceSim({
      ...defaultForceParams(),
      n: 12,
      edges: ring(12),
      edgeLength: new Float32Array(12).fill(60),
      positions,
      pinned,
      constraints: {
        groups: [{ axis: 1, members, pinnedAt: pinnedY }],
        pairs: [],
      },
    });

    sim2.project();

    while (!sim2.converged()) {
      sim2.step(50);
    }

    for (const i of members) {
      expect(sim2.positions[i * 2 + 1]).to.be.closeTo(pinnedY, 1e-2);
    }
  });

  it('a violated pair with one pinned end moves the free end only', function () {
    const pinned = new Uint8Array(4);

    pinned[0] = 1;

    const positions = seededPositions(4);

    positions[0] = 500; // a at x 500, pinned
    positions[2] = 400; // b at x 400 — violated by 100 + gap

    const sim = new ForceSim({
      ...defaultForceParams(),
      n: 4,
      edges: ring(4),
      edgeLength: new Float32Array(4).fill(60),
      positions,
      pinned,
      constraints: { groups: [], pairs: [{ a: 0, b: 1, axis: 0, gap: 40 }] },
    });

    sim.project();

    // the pinned end held; the free end took the whole correction
    expect(sim.positions[0]).to.equal(500);
    expect(sim.positions[2]).to.be.at.least(540 - 1e-3);
  });
});
