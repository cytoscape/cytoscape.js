import { expect } from 'chai';
import {
  ForceSim,
  seedPositions,
  defaultForceParams,
} from '../src/layout/force-sim.mjs';

// round 18.1: the CPU reference force simulation — the spec the GPU
// kernels must match (spring–electric with uniform-grid cutoff
// repulsion, gather-only, seeded and deterministic).

const ring = (n) => {
  const edges = new Uint32Array(n * 2);

  for (let i = 0; i < n; i++) {
    edges[i * 2] = i;
    edges[i * 2 + 1] = (i + 1) % n;
  }

  return edges;
};

// round 59.1's probe topologies — the shapes the round-18 model
// detonated on (explicit-Euler instability past degree ~20)
const star = (n) => {
  const list = [];

  for (let i = 1; i < n; i++) {
    list.push(0, i);
  }

  return Uint32Array.from(list);
};

const mulberry32 = (seed) => {
  let a = seed >>> 0;

  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;

    let t = Math.imul(a ^ (a >>> 15), 1 | a);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// preferential attachment: scale-free, hub degrees in the hundreds
const scaleFree = (n) => {
  const rand = mulberry32(7);
  const list = [];
  const targets = [0];

  for (let i = 1; i < n; i++) {
    for (let k = 0; k < Math.min(2, i); k++) {
      const t = targets[Math.floor(rand() * targets.length)];

      list.push(i, t);
      targets.push(t);
    }

    targets.push(i);
  }

  return Uint32Array.from(list);
};

// uniform random at ndex-like density (mean degree 2m/n)
const denseUniform = (n, m) => {
  const rand = mulberry32(42);
  const edges = new Uint32Array(m * 2);

  for (let j = 0; j < m; j++) {
    edges[j * 2] = Math.floor(rand() * n);
    edges[j * 2 + 1] = Math.floor(rand() * n);
  }

  return edges;
};

const finiteStats = (sim, n, edges) => {
  let nonFinite = 0;
  let maxR = 0;

  for (let i = 0; i < n; i++) {
    const x = sim.positions[i * 2];
    const y = sim.positions[i * 2 + 1];

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      nonFinite++;
      continue;
    }

    maxR = Math.max(maxR, Math.hypot(x, y));
  }

  const m = edges.length / 2;
  let linkSum = 0;

  for (let e = 0; e < m; e++) {
    const s = edges[e * 2];
    const t = edges[e * 2 + 1];

    linkSum += Math.hypot(
      sim.positions[s * 2] - sim.positions[t * 2],
      sim.positions[s * 2 + 1] - sim.positions[t * 2 + 1],
    );
  }

  return { nonFinite, maxR, meanLink: m > 0 ? linkSum / m : 0 };
};

const mkSim = (n, edges, over = {}) => {
  const positions = new Float32Array(n * 2);

  seedPositions(n, over.seed ?? 1, over.spread ?? 100, positions);

  const edgeLength = new Float32Array(edges.length / 2).fill(
    over.edgeLength ?? 60,
  );

  return new ForceSim({
    n,
    edges,
    edgeLength,
    positions,
    ...defaultForceParams(),
    ...over,
  });
};

describe('gpu/layout: the force reference sim (round 18.1)', function () {
  it('seeds deterministic scatter', function () {
    const a = new Float32Array(20);
    const b = new Float32Array(20);
    const c = new Float32Array(20);

    seedPositions(10, 42, 100, a);
    seedPositions(10, 42, 100, b);
    seedPositions(10, 7, 100, c);

    expect([...a]).to.deep.equal([...b]); // same seed, same scatter
    expect([...a]).to.not.deep.equal([...c]);

    // distinct positions (no coincident pileup)
    const seen = new Set();

    for (let i = 0; i < 10; i++) {
      seen.add(`${a[i * 2]},${a[i * 2 + 1]}`);
    }

    expect(seen.size).to.equal(10);
  });

  it('runs deterministically for identical inputs', function () {
    const s1 = mkSim(30, ring(30));
    const s2 = mkSim(30, ring(30));

    s1.step(50);
    s2.step(50);

    expect([...s1.positions]).to.deep.equal([...s2.positions]);
  });

  it('relaxes springs toward the ideal edge length', function () {
    // two nodes, one spring: they settle near edgeLength apart
    const positions = new Float32Array([0, 0, 10, 0]);
    const sim = new ForceSim({
      n: 2,
      edges: new Uint32Array([0, 1]),
      edgeLength: new Float32Array([80]),
      positions,
      ...defaultForceParams(),
      gravity: 0, // isolate the spring
    });

    sim.step(500);

    const d = Math.hypot(
      positions[2] - positions[0],
      positions[3] - positions[1],
    );

    expect(d).to.be.closeTo(80, 8);
  });

  it('repels unconnected overlapping nodes apart', function () {
    const positions = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
    const sim = new ForceSim({
      n: 4,
      edges: new Uint32Array(0),
      edgeLength: new Float32Array(0),
      positions,
      ...defaultForceParams(),
      gravity: 0,
    });

    sim.step(200);

    let minDist = Infinity;

    for (let i = 0; i < 4; i++) {
      for (let j = i + 1; j < 4; j++) {
        minDist = Math.min(
          minDist,
          Math.hypot(
            positions[j * 2] - positions[i * 2],
            positions[j * 2 + 1] - positions[i * 2 + 1],
          ),
        );
      }
    }

    expect(minDist).to.be.greaterThan(20);
  });

  it('keeps disconnected components in frame via gravity', function () {
    const sim = mkSim(20, ring(10)); // 10 ring nodes + 10 singletons

    sim.step(300);

    for (let i = 0; i < 20; i++) {
      expect(
        Math.hypot(sim.positions[i * 2], sim.positions[i * 2 + 1]),
      ).to.be.lessThan(3000);
    }
  });

  it('cools: displacement decays and the sim converges', function () {
    const sim = mkSim(40, ring(40));

    sim.step(5);

    const early = sim.lastMaxDisp;

    let steps = 5;

    while (!sim.converged() && steps < 5000) {
      sim.step(5);
      steps += 5;
    }

    expect(sim.converged()).to.equal(true);
    expect(sim.lastMaxDisp).to.be.lessThan(early);
    expect(steps).to.be.lessThan(5000);
  });

  it('pins pinned nodes in place', function () {
    const pinned = new Uint8Array(30);

    pinned[0] = 1;

    const sim = mkSim(30, ring(30), { pinned });
    const x0 = sim.positions[0];
    const y0 = sim.positions[1];

    sim.step(100);

    expect(sim.positions[0]).to.equal(x0);
    expect(sim.positions[1]).to.equal(y0);
  });

  // -- round 59.1: stability on hub-heavy and dense graphs --
  //
  // The round-18 model diverged exponentially on all three of these
  // (pos += F·alpha is stable only while alpha·stiffness·degree < 2),
  // reaching 1e30+ px and NaN; these specs were written red against it.
  // The bounds are generous on purpose — they discriminate explosion
  // from layout, not good tuning from bad.

  it('a star stays finite and bounded (hub degree n−1)', function () {
    const n = 300;
    const sim = mkSim(n, star(n), {
      spread: Math.sqrt(n) * 30,
      iterations: 500,
    });

    sim.step(500);

    const { nonFinite, maxR, meanLink } = finiteStats(sim, n, star(n));

    expect(nonFinite).to.equal(0);
    expect(maxR).to.be.lessThan(Math.sqrt(n) * 60 * 3);
    expect(meanLink).to.be.lessThan(60 * 6);
    expect(sim.converged()).to.equal(true);
  });

  it('a scale-free graph stays finite and bounded', function () {
    const n = 1500;
    const edges = scaleFree(n);
    const sim = mkSim(n, edges, {
      spread: Math.sqrt(n) * 30,
      iterations: 500,
    });

    sim.step(500);

    const { nonFinite, maxR, meanLink } = finiteStats(sim, n, edges);

    expect(nonFinite).to.equal(0);
    expect(maxR).to.be.lessThan(Math.sqrt(n) * 60 * 3);
    expect(meanLink).to.be.lessThan(60 * 8);
  });

  it('an ndex-density uniform graph stays finite and bounded', function () {
    // mean degree 40 — twice the old stability bound
    const n = 600;
    const edges = denseUniform(n, 12000);
    const sim = mkSim(n, edges, {
      spread: Math.sqrt(n) * 30,
      iterations: 400,
    });

    sim.step(400);

    const { nonFinite, maxR } = finiteStats(sim, n, edges);

    expect(nonFinite).to.equal(0);
    expect(maxR).to.be.lessThan(Math.sqrt(n) * 60 * 3);
  });

  it('non-finite positions never read as settled', function () {
    // the round-18 hole: maxDisp starts at 0 and NaN > 0 is false, so a
    // fully-NaN iteration reported displacement 0 and the settle counter
    // ran out — the sim exited "converged" with every position destroyed.
    // A poisoned run may only end on the iteration cap or the alpha
    // floor, never on the displacement settle.
    const n = 20;
    const positions = new Float32Array(n * 2);

    seedPositions(n, 1, 100, positions);

    positions[0] = NaN;
    positions[1] = NaN;

    const sim = new ForceSim({
      n,
      edges: ring(n),
      edgeLength: new Float32Array(n).fill(60),
      positions,
      ...defaultForceParams(),
      iterations: 50,
    });

    sim.step(50);

    expect(sim.converged()).to.equal(true);
    // 50 iterations, not the 3-iteration displacement settle
    expect(sim.iteration).to.equal(50);
  });

  it('hub springs are degree-normalised: leaves land near the rest length', function () {
    // a 60-leaf star relaxed from a cramped start — the aggregate spring
    // pull on the hub is bounded by construction (d3's strength /
    // min(degree) rule), so the hub cannot oscillate and the leaves ring
    // it near the ideal length
    const n = 61;
    const edges = star(n);
    const sim = mkSim(n, edges, { spread: 40, iterations: 800 });

    sim.step(800);

    const { nonFinite, meanLink } = finiteStats(sim, n, edges);

    expect(nonFinite).to.equal(0);
    expect(meanLink).to.be.within(30, 200);
  });

  it('relaxes a path to rest lengths without collapsing', function () {
    // what a cutoff model guarantees: links settle near their ideal
    // length and no two nodes collapse together.  It does NOT promise
    // global straightening — a curled chain is a legitimate local
    // minimum of short-range repulsion (recorded; sfdp-style
    // multilevel untangling is future work).
    const n = 12;
    const edges = new Uint32Array((n - 1) * 2);

    for (let i = 0; i < n - 1; i++) {
      edges[i * 2] = i;
      edges[i * 2 + 1] = i + 1;
    }

    const sim = mkSim(n, edges, { spread: 30 }); // cramped start

    sim.step(2000);

    for (let i = 0; i < n - 1; i++) {
      const link = Math.hypot(
        sim.positions[(i + 1) * 2] - sim.positions[i * 2],
        sim.positions[(i + 1) * 2 + 1] - sim.positions[i * 2 + 1],
      );

      expect(link, `link ${i}`).to.be.within(35, 120);
    }

    let minDist = Infinity;

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        minDist = Math.min(
          minDist,
          Math.hypot(
            sim.positions[j * 2] - sim.positions[i * 2],
            sim.positions[j * 2 + 1] - sim.positions[i * 2 + 1],
          ),
        );
      }
    }

    expect(minDist).to.be.greaterThan(15); // nothing collapses
  });
});
