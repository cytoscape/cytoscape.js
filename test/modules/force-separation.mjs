import { expect } from 'chai';
import { separateBodies } from '../../src/layout/force.mjs';
import { computeComponents } from '../../src/layout/pack.mjs';

// Round 118.1 (item 57): the settle's separation at scale.  Round 117
// measured the 25k random scene coming out of the pass with more
// overlap than it went in with, and the per-stage measurement said
// why: on a field that is crammed *everywhere* — most nodes touching a
// neighbour, each pair by a little — the sweeps push pairs the full
// box depth into their neighbours and the proximity-stress rounds,
// local Jacobi steps, never move the field's bounding box at all.  The
// pass gained an expansion stage for that regime and a best-state
// guard for every other.  These run the pass on synthetic fields, no
// sim: the 25k case takes 200 ms here against 30 s through the layout.

/** deterministic unit floats (mulberry32) */
const prng = (seed) => {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;

    let t = a;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** square boxes of side `box`, node-local, for n nodes */
const boxesOf = (n, box) => ({
  n,
  x1: new Float32Array(n).fill(-box / 2),
  y1: new Float32Array(n).fill(-box / 2),
  x2: new Float32Array(n).fill(box / 2),
  y2: new Float32Array(n).fill(box / 2),
  maxW: box,
  maxH: box,
});

/**
 * A crammed field: a jittered lattice at `spacing` px in `box` px boxes
 * (spacing under box means nearly every node overlaps a neighbour),
 * chained into one component by a path over the lattice order.
 */
const crammedField = (n, spacing, box, jitter = 0.6, seed = 1) => {
  const rand = prng(seed);
  const cols = Math.ceil(Math.sqrt(n));
  const pos = new Float32Array(n * 2);

  for (let i = 0; i < n; i++) {
    pos[i * 2] = (i % cols) * spacing + (rand() - 0.5) * spacing * jitter;
    pos[i * 2 + 1] =
      Math.floor(i / cols) * spacing + (rand() - 0.5) * spacing * jitter;
  }

  const edges = new Uint32Array((n - 1) * 2);

  for (let i = 0; i + 1 < n; i++) {
    edges[i * 2] = i;
    edges[i * 2 + 1] = i + 1;
  }

  return { pos, dims: boxesOf(n, box), comps: computeComponents(n, edges) };
};

/** overlapping pairs of the boxes at `pos`, with the summed depth */
const overlap = (pos, dims) => {
  const n = dims.n;
  const cell = Math.max(dims.maxW, dims.maxH);
  const grid = new Map();
  const key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;

  for (let i = 0; i < n; i++) {
    const k = key(pos[i * 2], pos[i * 2 + 1]);

    (grid.get(k) ?? grid.set(k, []).get(k)).push(i);
  }

  let pairs = 0;
  let depth = 0;
  const touched = new Uint8Array(n);

  for (let i = 0; i < n; i++) {
    const cx = Math.floor(pos[i * 2] / cell);
    const cy = Math.floor(pos[i * 2 + 1] / cell);

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (j <= i) {
            continue;
          }

          const ox =
            Math.min(pos[i * 2] + dims.x2[i], pos[j * 2] + dims.x2[j]) -
            Math.max(pos[i * 2] + dims.x1[i], pos[j * 2] + dims.x1[j]);
          const oy =
            Math.min(pos[i * 2 + 1] + dims.y2[i], pos[j * 2 + 1] + dims.y2[j]) -
            Math.max(pos[i * 2 + 1] + dims.y1[i], pos[j * 2 + 1] + dims.y1[j]);

          if (ox > 0 && oy > 0) {
            pairs++;
            depth += Math.min(ox, oy);
            touched[i] = 1;
            touched[j] = 1;
          }
        }
      }
    }
  }

  let nodes = 0;

  for (let i = 0; i < n; i++) {
    nodes += touched[i];
  }

  return { pairs, depth, nodes };
};

const bounds = (pos) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < pos.length; i += 2) {
    minX = Math.min(minX, pos[i]);
    maxX = Math.max(maxX, pos[i]);
    minY = Math.min(minY, pos[i + 1]);
    maxY = Math.max(maxY, pos[i + 1]);
  }

  return { w: maxX - minX, h: maxY - minY };
};

const separate = (field, pinned, trace) =>
  separateBodies(
    field.dims.n,
    field.pos,
    field.dims,
    pinned ?? new Uint8Array(field.dims.n),
    field.comps.compOf,
    field.comps.count,
    trace,
  );

describe('force: the settle separation at scale (118.1, item 57)', function () {
  it('the probe sees a crammed field as crammed', function () {
    // the control for everything below: a lattice at 18 px in 22 px
    // boxes has nearly every node touching a neighbour
    const field = crammedField(2000, 18, 22);
    const before = overlap(field.pos, field.dims);

    expect(before.nodes / 2000).to.be.greaterThan(0.9);
    expect(before.pairs).to.be.greaterThan(2000);
  });

  it('a crammed 20k field comes out overlap-free, grown under 2x, through the expansion stage', function () {
    const field = crammedField(20000, 18, 22);
    const before = bounds(field.pos);
    const stages = [];
    const t0 = performance.now();

    separate(field, null, (stage) => stages.push(stage));

    const ms = performance.now() - t0;
    const after = bounds(field.pos);

    expect(overlap(field.pos, field.dims).pairs).to.equal(0);
    expect(stages[0]).to.match(/^expand:/);
    expect(after.w / before.w).to.be.lessThan(2);
    expect(after.h / before.h).to.be.lessThan(2);
    // 25k through the layout took 30 s before the change, most of it
    // the forty stress rounds on a field they could not open
    expect(ms).to.be.lessThan(5000);
  });

  it('a crammed field under a thousand nodes is a pile: the stress rounds open it, no expansion', function () {
    // the 60-clique of labels in the quality suite fills 0.45 of its
    // field under the stress rounds and 0.33 under a uniform scale —
    // a pile keeps the local passes.  Measured: they clear crammed
    // random fields of 2k nodes and give out at 3k
    const field = crammedField(800, 18, 22);
    const before = overlap(field.pos, field.dims);
    const stages = [];

    separate(field, null, (stage) => stages.push(stage));

    const after = overlap(field.pos, field.dims);

    expect(stages.some((s) => s.startsWith('expand:'))).to.equal(false);
    expect(stages.some((s) => s.startsWith('stress:'))).to.equal(true);
    // a lattice at 18 px is harder than a settled field (every node
    // touches four neighbours): the local passes take its 1,500 pairs
    // to a few dozen shallow ones, and the guard bounds the rest
    expect(after.pairs).to.be.lessThan(before.pairs / 20);
    expect(after.depth).to.be.lessThan(before.depth / 100);
  });

  it('the guard: a field the local passes cannot open comes back no deeper than it went in', function () {
    // a pinned node holds its component back from the expansion (a
    // scale moves everything), so this crammed 6k field goes through
    // the local passes alone — the configuration round 117 measured
    // handing back a deeper field than it was given
    const field = crammedField(6000, 18, 22);
    const pinned = new Uint8Array(6000);

    pinned[3000] = 1;

    const before = overlap(field.pos, field.dims);
    const x = field.pos[6000];
    const y = field.pos[6001];
    const stages = [];

    separate(field, pinned, (stage) => stages.push(stage));

    const after = overlap(field.pos, field.dims);

    expect(stages.some((s) => s.startsWith('expand:'))).to.equal(false);
    expect(after.depth).to.be.at.most(before.depth);
    expect([field.pos[6000], field.pos[6001]]).to.deep.equal([x, y]);
  });

  it('the guard holds on a crammed random scatter through the local passes too', function () {
    // No synthetic field has been found on which the restore itself
    // fires — a jittered lattice and a uniform scatter both end with
    // the closing sweeps as their shallowest state.  It fires on the
    // real thing: round 118's probe on the sim's own 25k random field
    // with the expansion withheld (a pinned node) ends the closing
    // sweeps at 69,357 pairs, 5.66 px mean, and restores the fortieth
    // stress round's 100,417 pairs at 3.52 px — the shallower field by
    // the summed depth, and the state 117 measured being handed back
    // deeper than it was given.  That measurement is the control for
    // this contract; the synthetic fields pin the contract itself.
    const n = 8000;
    const rand = prng(5);
    const side = 20 * Math.sqrt(n);
    const pos = new Float32Array(n * 2);

    for (let i = 0; i < n; i++) {
      pos[i * 2] = rand() * side;
      pos[i * 2 + 1] = rand() * side;
    }

    const edges = new Uint32Array((n - 1) * 2);

    for (let i = 0; i + 1 < n; i++) {
      edges[i * 2] = i;
      edges[i * 2 + 1] = i + 1;
    }

    const field = {
      pos,
      dims: boxesOf(n, 22),
      comps: computeComponents(n, edges),
    };
    const pinned = new Uint8Array(n);

    pinned[0] = 1;

    const before = overlap(field.pos, field.dims);

    separate(field, pinned);

    const after = overlap(field.pos, field.dims);

    expect(before.nodes / n).to.be.greaterThan(0.6);
    expect(after.depth).to.be.at.most(before.depth);
    expect(after.pairs).to.be.lessThan(before.pairs);
  });

  it('a clear field is left exactly where it was, with no stage run', function () {
    const field = crammedField(500, 40, 22, 0.3);
    const before = field.pos.slice();
    const stages = [];

    separate(field, null, (stage) => stages.push(stage));

    expect(stages).to.deep.equal([]);
    expect(field.pos).to.deep.equal(before);
  });

  it('a sparse residue clears in the sweeps alone', function () {
    // a few overlapping pairs on an otherwise clear lattice: no
    // expansion (under the crammed fraction), no stress round
    const field = crammedField(4000, 40, 22, 0.3);

    for (let i = 0; i < 40; i++) {
      field.pos[i * 100 * 2] = field.pos[(i * 100 + 1) * 2] - 6;
    }

    const stages = [];

    separate(field, null, (stage) => stages.push(stage));

    expect(overlap(field.pos, field.dims).pairs).to.equal(0);
    expect(stages).to.deep.equal(['sweeps']);
  });
});
