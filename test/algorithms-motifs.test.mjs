import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

/*
Round 70: the triad census, pinned by brute force.

The census computes sixteen counts as closed forms over seven trace
primitives, and the closed forms are exactly what could be wrong — a
sign, a factor of two, a mislabeled orientation.  So the load-bearing
spec here classifies EVERY triple of random digraphs directly from
the class definitions (an independent implementation: dyad counts
plus orientation rules) and requires exact agreement, across seeds
that sweep sparse through dense.  The named fixtures below pin the
labels the bio literature cares about (030T = the feed-forward loop).
*/

// the independent classifier, straight from the Holland–Leinhardt
// class definitions
const classifyTriple = (has, triple) => {
  const [a, b, c] = triple;
  const pairs = [
    [a, b],
    [a, c],
    [b, c],
  ];
  const mutual = [];
  const asym = [];

  for (const [x, y] of pairs) {
    const xy = has(x, y);
    const yx = has(y, x);

    if (xy && yx) {
      mutual.push([x, y]);
    } else if (xy) {
      asym.push([x, y]);
    } else if (yx) {
      asym.push([y, x]);
    }
  }

  const mu = mutual.length;
  const as = asym.length;

  if (mu === 0 && as === 0) {
    return '003';
  }

  if (mu === 1 && as === 0) {
    return '102';
  }

  if (mu === 0 && as === 1) {
    return '012';
  }

  if (mu === 2 && as === 0) {
    return '201';
  }

  if (mu === 3) {
    return '300';
  }

  if (mu === 2 && as === 1) {
    return '210';
  }

  if (mu === 0 && as === 2) {
    const [p, q] = asym;
    const center = triple.find(
      (v) => (p[0] === v || p[1] === v) && (q[0] === v || q[1] === v),
    );
    const outs = (p[0] === center ? 1 : 0) + (q[0] === center ? 1 : 0);

    return outs === 2 ? '021D' : outs === 0 ? '021U' : '021C';
  }

  if (mu === 1 && as === 1) {
    // arc into the mutual pair → D, out of it → U
    return mutual[0].includes(asym[0][1]) ? '111D' : '111U';
  }

  if (mu === 0 && as === 3) {
    const outdeg = new Map();

    for (const [x] of asym) {
      outdeg.set(x, (outdeg.get(x) ?? 0) + 1);
    }

    return [...outdeg.values()].some((d) => d === 2) ? '030T' : '030C';
  }

  // mu === 1 && as === 2: arcs into the pair: 2 → D, 0 → U, 1 → C
  const pair = mutual[0];
  const inward = asym.filter(([, head]) => pair.includes(head)).length;

  return inward === 2 ? '120D' : inward === 0 ? '120U' : '120C';
};

describe('algorithms: the triad census (round 70)', function () {
  it('matches a brute-force classification of every triple, sparse through dense', async function () {
    for (var seed = 1; seed <= 6; seed++) {
      var state = (seed * 2654435761) % 0x7fffffff;
      var rand = () => (state = (state * 48271) % 0x7fffffff) / 0x7fffffff;
      var n = 10 + seed;
      var prob = 0.05 + 0.08 * seed;
      var els = [];
      var arcs = new Set();

      for (var i = 0; i < n; i++) {
        els.push({ data: { id: 'n' + i } });
      }

      for (var s = 0; s < n; s++) {
        for (var t = 0; t < n; t++) {
          if (s !== t && rand() < prob) {
            els.push({ data: { source: 'n' + s, target: 'n' + t } });
            arcs.add(s + ',' + t);
          }
        }
      }

      var cy = cytoscape({ elements: els });
      var { counts } = await cy.elements().motifCensus();
      var has = (x, y) => arcs.has(x + ',' + y);
      var brute = {};

      for (var x = 0; x < n; x++) {
        for (var y = x + 1; y < n; y++) {
          for (var z = y + 1; z < n; z++) {
            var cls = classifyTriple(has, [x, y, z]);

            brute[cls] = (brute[cls] ?? 0) + 1;
          }
        }
      }

      for (var key of Object.keys(counts)) {
        expect(counts[key], `seed ${seed}: class ${key}`).to.equal(
          brute[key] ?? 0,
        );
      }

      var total = Object.values(counts).reduce((p, q) => p + q, 0);

      expect(total, `seed ${seed}: total`).to.equal(
        (n * (n - 1) * (n - 2)) / 6,
      );
    }
  });

  it('names the feed-forward loop 030T and the cycle 030C', async function () {
    var ffl = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { source: 'a', target: 'b' } },
        { data: { source: 'b', target: 'c' } },
        { data: { source: 'a', target: 'c' } },
      ],
    });
    var counts = (await ffl.elements().motifCensus()).counts;

    expect(counts['030T']).to.equal(1);
    expect(counts['030C']).to.equal(0);

    var cycle = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { source: 'a', target: 'b' } },
        { data: { source: 'b', target: 'c' } },
        { data: { source: 'c', target: 'a' } },
      ],
    });

    counts = (await cycle.elements().motifCensus()).counts;
    expect(counts['030C']).to.equal(1);
    expect(counts['030T']).to.equal(0);
  });

  it('collapses parallel arcs and drops loops', async function () {
    var cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { source: 'a', target: 'b' } },
        { data: { source: 'a', target: 'b' } }, // parallel
        { data: { source: 'a', target: 'a' } }, // loop
        { data: { source: 'b', target: 'a' } }, // completes a mutual
      ],
    });
    var counts = (await cy.elements().motifCensus()).counts;

    // one mutual dyad, two null pairs against c: the triple is 102
    expect(counts['102']).to.equal(1);
    expect(counts['003']).to.equal(0);
  });

  it('the undirected reading files everything as mutual', async function () {
    var cycle = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { source: 'a', target: 'b' } },
        { data: { source: 'b', target: 'c' } },
        { data: { source: 'c', target: 'a' } },
      ],
    });
    var counts = (await cycle.elements().motifCensus({ directed: false }))
      .counts;

    expect(counts['300']).to.equal(1);
    expect(counts['030C']).to.equal(0);
  });

  it('validates `executor` synchronously', function () {
    var cy = cytoscape({ elements: [{ data: { id: 'a' } }] });

    expect(() => cy.elements().motifCensus({ executor: 'tpu' })).to.throw(
      TypeError,
      /executor/,
    );
  });
});
