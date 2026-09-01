import { expect } from 'chai';
import {
  buildScope,
  splitComponents,
  greedyFAS,
  dfsFAS,
} from '../../src/layout/flow-graph.mjs';
import {
  rankLongestPath,
  rankNetworkSimplex,
  normalizeRanks,
} from '../../src/layout/flow-rank.mjs';
import {
  buildLayers,
  orderLayers,
  countBilayer,
  countTotalCrossings,
} from '../../src/layout/flow-order.mjs';
import { assignX } from '../../src/layout/flow-position.mjs';

// round 112.2: the flow layout's internals, exercised at module level —
// seeded fuzz against brute force (the BJM counter versus the O(E^2)
// count; BK's separation invariant over random DAGs) plus the two
// defect throws the public API cannot reach (FAS guarantees acyclicity,
// ranking guarantees positive spans).

const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** Build the scope→components pipeline from plain edge pairs. */
const makeComp = (n, pairs) => {
  const flat = new Uint32Array(pairs.length * 2);

  pairs.forEach(([s, t], i) => {
    flat[i * 2] = s;
    flat[i * 2 + 1] = t;
  });

  const m = pairs.length;
  const scope = buildScope(
    n,
    flat,
    Array.from({ length: m }, (_, i) => i),
    new Float64Array(m).fill(1),
    new Int32Array(m).fill(1),
    new Float64Array(n).fill(15),
    new Float64Array(n).fill(15),
  );

  return splitComponents(scope);
};

/** Random connected DAG-ish edge set (may contain cycles). */
const randomGraph = (rand, n, extra) => {
  const pairs = [];

  for (let v = 1; v < n; v++) {
    pairs.push([Math.floor(rand() * v), v]); // connected by construction
  }

  for (let i = 0; i < extra; i++) {
    const a = Math.floor(rand() * n);
    const b = Math.floor(rand() * n);

    if (a !== b) {
      pairs.push([a, b]);
    }
  }

  return pairs;
};

const isAcyclic = (comp) => {
  const indeg = new Int32Array(comp.n);

  for (let e = 0; e < comp.m; e++) {
    indeg[comp.tgt[e]]++;
  }

  const queue = [];

  for (let v = 0; v < comp.n; v++) {
    if (indeg[v] === 0) {
      queue.push(v);
    }
  }

  let seen = 0;

  while (queue.length > 0) {
    const v = queue.pop();

    seen++;

    for (let i = comp.outOff[v]; i < comp.outOff[v + 1]; i++) {
      if (--indeg[comp.tgt[comp.outAdj[i]]] === 0) {
        queue.push(comp.tgt[comp.outAdj[i]]);
      }
    }
  }

  return seen === comp.n;
};

describe('modules/layout-flow-internals (round 112.2)', () => {
  it('greedyFAS and dfsFAS leave every fuzzed graph acyclic', () => {
    const rand = mulberry32(112);

    for (let trial = 0; trial < 30; trial++) {
      const n = 5 + Math.floor(rand() * 30);
      const pairs = randomGraph(rand, n, n * 2);

      for (const fas of [greedyFAS, dfsFAS]) {
        const { comps } = makeComp(n, pairs);

        for (const comp of comps) {
          fas(comp);
          expect(isAcyclic(comp), `${fas.name} trial ${trial}`).to.equal(true);
        }
      }
    }
  });

  it('the BJM bilayer counter matches brute force on fuzzed bilayers', () => {
    const rand = mulberry32(212);

    for (let trial = 0; trial < 40; trial++) {
      const upper = 2 + Math.floor(rand() * 8);
      const lower = 2 + Math.floor(rand() * 8);
      const pairs = [];

      for (let i = 0; i < upper + lower * 2; i++) {
        pairs.push([
          Math.floor(rand() * upper),
          upper + Math.floor(rand() * lower),
        ]);
      }

      const { comps } = makeComp(upper + lower, pairs);

      for (const comp of comps) {
        greedyFAS(comp);

        const rank = rankLongestPath(comp);
        const rankCount = normalizeRanks(rank);
        const L = buildLayers(comp, rank, rankCount);

        // brute force: every unit-edge pair between adjacent ranks
        let brute = 0;

        for (let e1 = 0; e1 < L.usrc.length; e1++) {
          for (let e2 = e1 + 1; e2 < L.usrc.length; e2++) {
            if (L.rank[L.usrc[e1]] !== L.rank[L.usrc[e2]]) {
              continue;
            }

            const a1 = L.pos[L.usrc[e1]] - L.pos[L.usrc[e2]];
            const a2 = L.pos[L.utgt[e1]] - L.pos[L.utgt[e2]];

            if (a1 * a2 < 0) {
              brute += L.uweight[e1] * L.uweight[e2];
            }
          }
        }

        let fast = 0;

        for (let r = 1; r < L.layers.length; r++) {
          fast += countBilayer(L, r);
        }

        expect(fast, `trial ${trial}`).to.be.closeTo(brute, 1e-9);
      }
    }
  });

  it('ordering never increases the crossing count of the initial order', () => {
    const rand = mulberry32(312);

    for (let trial = 0; trial < 15; trial++) {
      const n = 8 + Math.floor(rand() * 25);
      const { comps } = makeComp(n, randomGraph(rand, n, n));

      for (const comp of comps) {
        greedyFAS(comp);

        const rank = rankLongestPath(comp);
        const rankCount = normalizeRanks(rank);
        const L = buildLayers(comp, rank, rankCount);
        const before = countTotalCrossings(L);

        orderLayers(L, 7);
        expect(countTotalCrossings(L), `trial ${trial}`).to.be.at.most(
          before + 1e-9,
        );
      }
    }
  });

  it('BK keeps separation and order within every fuzzed layer', () => {
    const rand = mulberry32(412);

    for (let trial = 0; trial < 20; trial++) {
      const n = 6 + Math.floor(rand() * 30);
      const { comps } = makeComp(n, randomGraph(rand, n, n));

      for (const comp of comps) {
        greedyFAS(comp);

        const rank = rankLongestPath(comp);

        rankNetworkSimplex(comp, rank, 500);

        const rankCount = normalizeRanks(rank);
        const L = buildLayers(comp, rank, rankCount);

        orderLayers(L, 5);

        const x = assignX(L, comp.halfW, { nodeSep: 20 });

        for (const layer of L.layers) {
          for (let i = 0; i + 1 < layer.length; i++) {
            const v = layer[i];
            const w = layer[i + 1];
            const halfV = v < comp.n ? comp.halfW[v] : 1;
            const halfW_ = w < comp.n ? comp.halfW[w] : 1;
            const minGap =
              halfV + halfW_ + (v < comp.n && w < comp.n ? 20 : 10);

            expect(
              x[w] - x[v],
              `trial ${trial}: layer order/separation`,
            ).to.be.at.least(minGap - 1e-6);
          }
        }
      }
    }
  });

  it('network simplex never worsens the weighted span objective', () => {
    const rand = mulberry32(512);

    for (let trial = 0; trial < 15; trial++) {
      const n = 6 + Math.floor(rand() * 25);
      const { comps } = makeComp(n, randomGraph(rand, n, n));

      for (const comp of comps) {
        greedyFAS(comp);

        const objective = (rank) => {
          let sum = 0;

          for (let e = 0; e < comp.m; e++) {
            sum += comp.weight[e] * (rank[comp.tgt[e]] - rank[comp.src[e]]);
          }

          return sum;
        };

        const lp = rankLongestPath(comp);
        const before = objective(lp);
        const rank = lp.slice();

        rankNetworkSimplex(comp, rank, 500);
        expect(objective(rank), `trial ${trial}`).to.be.at.most(before);

        // still feasible
        for (let e = 0; e < comp.m; e++) {
          expect(
            rank[comp.tgt[e]] - rank[comp.src[e]],
            `trial ${trial}: feasibility`,
          ).to.be.at.least(comp.minLen[e]);
        }
      }
    }
  });

  it('rankLongestPath reports a residual cycle as a defect', () => {
    // hand the ranker a cyclic component directly (FAS is bypassed;
    // buildScope would collapse an anti-parallel pair, so build by hand)
    const cyclic = {
      n: 2,
      m: 2,
      src: Uint32Array.from([0, 1]),
      tgt: Uint32Array.from([1, 0]),
      weight: Float64Array.from([1, 1]),
      minLen: Int32Array.from([1, 1]),
      reversed: new Uint8Array(2),
      outOff: Uint32Array.from([0, 1, 2]),
      outAdj: Uint32Array.from([0, 1]),
      inOff: Uint32Array.from([0, 1, 2]),
      inAdj: Uint32Array.from([1, 0]),
      scopeOf: Uint32Array.from([0, 1]),
      halfW: new Float64Array(2),
      halfH: new Float64Array(2),
    };

    expect(() => rankLongestPath(cyclic)).to.throw(/residual cycle/);
  });

  it('buildLayers reports a non-positive edge span as a defect', () => {
    const flat = {
      n: 2,
      m: 1,
      src: Uint32Array.from([0]),
      tgt: Uint32Array.from([1]),
      weight: Float64Array.from([1]),
      minLen: Int32Array.from([1]),
      reversed: new Uint8Array(1),
      outOff: Uint32Array.from([0, 1, 1]),
      outAdj: Uint32Array.from([0]),
      inOff: Uint32Array.from([0, 0, 1]),
      inAdj: Uint32Array.from([0]),
      scopeOf: Uint32Array.from([0, 1]),
      halfW: new Float64Array(2),
      halfH: new Float64Array(2),
    };

    // a hand-made zero-span ranking (the pipeline can never produce one)
    expect(() => buildLayers(flat, Int32Array.from([0, 0]), 1)).to.throw(
      /non-positive edge span/,
    );
  });
});
