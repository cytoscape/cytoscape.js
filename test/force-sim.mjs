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
