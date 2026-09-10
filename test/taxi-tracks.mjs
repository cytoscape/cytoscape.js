import { expect } from 'chai';
import {
  assignTaxiTracks,
  runDepth,
  TRACK_SOURCE,
  TRACK_TARGET,
  TRACK_FAMILY,
} from '../src/taxi-tracks.mjs';
import { TAXI_DOWNWARD, TAXI_AUTO } from '../src/curve-geometry.mjs';

// Round 124.2: the taxi-track pass, as a pure function.  Every fixture
// is 30x30 nodes (outer half 15) in a downward layered drawing: rank 0
// at y = 0, rank 1 at y = 200, so an edge's ideal band is [25, 175]
// (source bottom 15 + minD 10 .. target top 185 - 10), l = 170 and the
// 50 % turn is 85 (the line y = 100).

describe('gpu/taxi-tracks (round 124.2)', function () {
  const geom = (nodes) => {
    const pos = new Float64Array(nodes.length * 2);
    const half = new Float64Array(nodes.length * 2);

    nodes.forEach(([x, y], i) => {
      pos[i * 2] = x;
      pos[i * 2 + 1] = y;
      half[i * 2] = 15;
      half[i * 2 + 1] = 15;
    });

    return { pos, half };
  };

  const edge = (src, tgt, over = {}) => ({
    src,
    tgt,
    dir: TAXI_DOWNWARD,
    minDist: 10,
    body: true,
    group: TRACK_SOURCE,
    spacing: 10,
    ...over,
  });

  const run = (nodes, edges, over = {}) =>
    assignTaxiTracks({ ...geom(nodes), edges, ...over });

  it('a lone bundle draws the 50 % turn (the identity)', function () {
    const r = run(
      [
        [0, 0],
        [10, 200],
      ],
      [edge(0, 1)],
    );

    expect(r.turn[0]).to.equal(85);
    expect(r.bundles).to.have.length(1);
    expect(r.bundles[0].k).to.equal(1);
    expect(r.bundles[0].x).to.equal(100);
  });

  it('disjoint runs are untouched', function () {
    const r = run(
      [
        [0, 0],
        [100, 0],
        [0, 200],
        [100, 200],
      ],
      [edge(0, 2), edge(1, 3)],
    );

    expect(Array.from(r.turn)).to.deep.equal([85, 85]);
  });

  it('two overlapping fan-outs land on distinct lines, each a bus sharing one turn', function () {
    // A at x=0 fans to 100 and 200; B at x=100 fans to 0 and 300
    const nodes = [
      [0, 0],
      [100, 0],
      [100, 200],
      [200, 200],
      [0, 200],
      [300, 200],
    ];
    const r = run(nodes, [edge(0, 2), edge(0, 3), edge(1, 4), edge(1, 5)]);

    expect(r.turn[0]).to.equal(r.turn[1]); // A's bus
    expect(r.turn[2]).to.equal(r.turn[3]); // B's bus
    expect(r.turn[0]).to.not.equal(r.turn[2]);
    // the staircase: the left source (A) takes the line nearest the sources
    expect(r.turn[0]).to.equal(80); // x = 100 + (0 - 0.5) * 10
    expect(r.turn[2]).to.equal(90);
    expect(r.bundles.every((b) => b.k === 2)).to.equal(true);
  });

  it("'family' puts two sources on one trunk; per-source draws two", function () {
    // A, B at rank 0; C, D at rank 1, each with parents [A, B]
    const nodes = [
      [0, 0],
      [100, 0],
      [0, 200],
      [100, 200],
    ];
    const fam = (g) => [
      edge(0, 2, { group: g }),
      edge(0, 3, { group: g }),
      edge(1, 2, { group: g }),
      edge(1, 3, { group: g }),
    ];
    const family = run(nodes, fam(TRACK_FAMILY));
    const source = run(nodes, fam(TRACK_SOURCE));

    expect(family.bundles).to.have.length(1);
    expect(new Set(family.turn)).to.have.property('size', 1);
    expect(family.turn[0]).to.equal(85);

    expect(source.bundles).to.have.length(2);
    expect(new Set(source.turn)).to.have.property('size', 2);
  });

  it("'target' groups the edges into one node", function () {
    // A, B, C at rank 0 all into T; and A also into U — target grouping
    // gives T's three edges one turn and U's its own
    const nodes = [
      [0, 0],
      [100, 0],
      [200, 0],
      [100, 200],
      [0, 200],
    ];
    const r = run(nodes, [
      edge(0, 3, { group: TRACK_TARGET }),
      edge(1, 3, { group: TRACK_TARGET }),
      edge(2, 3, { group: TRACK_TARGET }),
      edge(0, 4, { group: TRACK_TARGET }),
    ]);

    expect(r.turn[0]).to.equal(r.turn[1]);
    expect(r.turn[1]).to.equal(r.turn[2]);
    expect(r.turn[3]).to.not.equal(r.turn[0]);
    // two target bundles whose runs overlap: two lines
    expect(r.bundles).to.have.length(2);
  });

  it('a crowded gap compresses the spacing and keeps every turn ideal', function () {
    // 20 sources across x = 0..190, every one fanning across the row
    const nodes = [];
    const edges = [];

    for (let i = 0; i < 20; i++) {
      nodes.push([i * 10, 0]);
    }

    for (let i = 0; i < 20; i++) {
      nodes.push([i * 10, 200]);
    }

    for (let i = 0; i < 20; i++) {
      edges.push(edge(i, 20), edge(i, 39)); // to the row's two ends
    }

    const r = run(nodes, edges);
    const turns = new Set();

    for (let i = 0; i < edges.length; i++) {
      const t = r.turn[i];

      // the min-distance test at both ends: never the Z-shape fallback
      expect(t).to.be.at.least(10);
      expect(170 - t).to.be.at.least(10);
      turns.add(t);
    }

    expect(turns.size).to.equal(20); // one line per bundle
    expect(r.bundles[0].k).to.equal(20);
    // 20 tracks in a 150 px band: spacing compressed below the 10 px ideal
    const sorted = [...turns].sort((a, b) => a - b);

    expect(sorted[1] - sorted[0]).to.be.below(10);
    expect(sorted[1] - sorted[0]).to.be.closeTo(150 / 21, 1e-9);
  });

  it('a node body in the run cuts the band: the run keeps the stretch nearest the source', function () {
    // a span-2 edge straight down through an intermediate node
    const nodes = [
      [0, 0],
      [0, 400],
      [0, 200],
    ];
    const clear = run(
      [
        [0, 0],
        [0, 400],
      ],
      [edge(0, 1)],
    );
    const cut = run(nodes, [edge(0, 1)], { obstacles: [2] });
    const cutTarget = run(nodes, [edge(0, 1, { group: TRACK_TARGET })], {
      obstacles: [2],
    });

    expect(clear.turn[0]).to.equal(185); // the middle of [25, 375]
    expect(cut.turn[0]).to.equal(90); // the middle of [25, 185]
    expect(cutTarget.turn[0]).to.equal(280); // the middle of [215, 375]
  });

  it('an edge too short for an ideal route keeps the 50 % turn', function () {
    const r = run(
      [
        [0, 0],
        [10, 40],
      ],
      [edge(0, 1)],
    );

    // dy = 40 - 30 = 10 < 2 * minD: excluded, 50 % of l = 5
    expect(r.turn[0]).to.equal(5);
    expect(r.bundles).to.have.length(0);
  });

  it('auto direction takes the dominant axis, like evalTaxi', function () {
    const r = run(
      [
        [0, 0],
        [200, 10],
      ],
      [edge(0, 1, { dir: TAXI_AUTO })],
    );

    expect(r.bundles[0].vert).to.equal(false);
    expect(r.turn[0]).to.equal(85);
  });

  it("the 'crossings' order overrides the staircase where the staircase costs more", function () {
    // B at x=0 runs [0,250]; A at x=100 runs [100,300].  Staircase puts
    // B nearer the sources (A's source leg crosses B's run, B's two
    // target legs cross A's run: 3); the crossing rule puts A nearer (0)
    const nodes = [
      [100, 0],
      [0, 0],
      [300, 200],
      [150, 200],
      [250, 200],
    ];
    const edges = [edge(0, 2), edge(1, 3), edge(1, 4)];
    const stair = run(nodes, edges);
    const cross = run(nodes, edges, { order: 'crossings' });
    const slotOf = (r, i) => r.bundles.find((b) => b.members.includes(i)).slot;

    expect(slotOf(stair, 1)).to.equal(0);
    expect(slotOf(stair, 0)).to.equal(1);
    expect(slotOf(cross, 0)).to.equal(0);
    expect(slotOf(cross, 1)).to.equal(1);
  });

  it('is deterministic and independent of edge order', function () {
    const nodes = [
      [0, 0],
      [100, 0],
      [100, 200],
      [200, 200],
      [0, 200],
      [300, 200],
    ];
    const edges = [edge(0, 2), edge(0, 3), edge(1, 4), edge(1, 5)];
    const a = run(nodes, edges);
    const b = run(nodes, edges);
    const c = run(nodes, [...edges].reverse());

    expect(Array.from(a.turn)).to.deep.equal(Array.from(b.turn));
    expect(Array.from(c.turn)).to.deep.equal(Array.from(a.turn).reverse());
  });

  it('runDepth counts the maximum overlap depth', function () {
    expect(runDepth([0, 5, 20], [10, 15, 30])).to.equal(2);
    expect(runDepth([0, 10], [10, 20])).to.equal(2); // touching runs conflict
    expect(runDepth([], [])).to.equal(0);
  });
});
