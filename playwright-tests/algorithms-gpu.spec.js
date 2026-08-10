import { test, expect } from '@playwright/test';

/*
Round 65: CPU-vs-GPU parity for the async algorithm tier.

Every spec runs the same fixture through `executor: 'cpu'` (the f64
reference — the spec) and `executor: 'gpu'` (the WGSL kernels) in one
page and compares.  What is pinned is invariants, not bits: cluster
memberships, path node sequences and rank orderings are compared
exactly (they are discrete, and a kernel defect flips them), while
floating scores carry tolerances (WGSL is f32).

These are live comparisons, not goldens — the round-27 lesson: a golden
answers "did this change", a parity diff answers "do the two executors
agree *now*".  Each spec fails when its kernel is degraded (verified by
control runs — see the round-65 record in PLAN.md).

Soft-skips when no adapter can be acquired, like every GPU spec; the
instances here are headless (algorithms need no canvas), so the specs
run wherever compute works, including SwiftShader on CI.
*/

const PAGE = 'http://127.0.0.1:3333/playwright-page/index.html';

const hasAdapter = async (page) => {
  return await page.evaluate(async () => {
    if (navigator.gpu == null) {
      return false;
    }

    return (await navigator.gpu.requestAdapter()) != null;
  });
};

test.beforeEach(async ({ page }) => {
  await page.goto(PAGE);
  test.skip(!(await hasAdapter(page)), 'no WebGPU adapter available');
});

test.describe('gpu-vs-cpu algorithm parity', () => {
  test('markovClustering: identical clusters on the reference fixture', async ({
    page,
  }) => {
    const out = await page.evaluate(async () => {
      const edge = (s, t, w) => ({ data: { source: s, target: t, weight: w } });
      const cy = cytoscape({
        elements: [
          ...[
            '11',
            '22',
            '33',
            '44',
            '55',
            '66',
            '77',
            '88',
            '99',
            '123',
            '456',
            '2147483647',
          ].map((id) => ({ data: { id } })),
          edge('11', '22', 2),
          edge('11', '66', 3.4),
          edge('11', '77', 3),
          edge('11', '123', 8),
          edge('22', '11', 2),
          edge('22', '33', 3.8),
          edge('22', '55', 8.1),
          edge('33', '22', 3.8),
          edge('33', '44', 7),
          edge('33', '55', 6.2),
          edge('44', '33', 7),
          edge('44', '88', 5.7),
          edge('44', '99', 7.0),
          edge('44', '456', 3),
          edge('55', '22', 8.1),
          edge('55', '33', 6.2),
          edge('55', '77', 2.9),
          edge('55', '88', 3.0),
          edge('66', '11', 3.4),
          edge('66', '123', 5.1),
          edge('77', '11', 3),
          edge('77', '55', 2.9),
          edge('77', '123', 1.5),
          edge('88', '44', 5.7),
          edge('88', '55', 3.0),
          edge('88', '99', 3.0),
          edge('88', '456', 4.2),
          edge('99', '44', 7.0),
          edge('99', '88', 3.0),
          edge('99', '456', 1.8),
          edge('99', '2147483647', 3.9),
          edge('123', '11', 8),
          edge('123', '66', 5.1),
          edge('123', '77', 1.5),
          edge('456', '44', 3),
          edge('456', '88', 4.2),
          edge('456', '99', 1.8),
          edge('456', '2147483647', 6.3),
          edge('2147483647', '99', 3.9),
          edge('2147483647', '456', 6.3),
        ],
      });
      const opts = {
        inflateFactor: 1.8,
        attributes: [(e) => e.data('weight')],
      };
      const ids = (c) => c.map((e) => e.id());
      const cpu = await cy
        .elements()
        .markovClustering({ ...opts, executor: 'cpu' });
      const gpu = await cy
        .elements()
        .markovClustering({ ...opts, executor: 'gpu' });

      return { cpu: cpu.map(ids), gpu: gpu.map(ids) };
    });

    expect(out.gpu).toEqual(out.cpu);
    expect(out.cpu.length).toBe(3); // the fixture's known partition
  });

  test('pageRank: same ordering, ranks within 1e-4, sums to 1', async ({
    page,
  }) => {
    const out = await page.evaluate(async () => {
      const els = [];
      const n = 60;

      for (let i = 0; i < n; i++) {
        els.push({ data: { id: 'n' + i } });
      }

      for (let i = 0; i < n; i++) {
        els.push({ data: { source: 'n' + i, target: 'n' + ((i + 1) % n) } });

        if (i % 3 === 0) {
          els.push({ data: { source: 'n' + i, target: 'n0' } });
        }
      }

      const cy = cytoscape({ elements: els });
      const cpu = await cy.elements().pageRank({ executor: 'cpu' });
      const gpu = await cy.elements().pageRank({ executor: 'gpu' });
      let maxDelta = 0;
      let gpuSum = 0;
      const nodes = cy.nodes();

      nodes.forEach((node) => {
        maxDelta = Math.max(
          maxDelta,
          Math.abs(cpu.rank(node) - gpu.rank(node)),
        );
        gpuSum += gpu.rank(node);
      });

      // ordering: the ring fixture has genuinely *tied* ranks, which
      // f32 and f64 break differently — so the pinned invariant is
      // that every clearly separated pair keeps its order, not that
      // a total sort agrees within the ties
      let inversions = 0;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = 0; j < nodes.length; j++) {
          const ci = cpu.rank(nodes[i]);
          const cj = cpu.rank(nodes[j]);

          if (ci > cj + 1e-4 && gpu.rank(nodes[i]) <= gpu.rank(nodes[j])) {
            inversions++;
          }
        }
      }

      return { maxDelta, gpuSum, inversions };
    });

    expect(out.maxDelta).toBeLessThan(1e-4);
    expect(Math.abs(out.gpuSum - 1)).toBeLessThan(1e-4);
    expect(out.inversions).toBe(0);
  });

  test('floydWarshall: distances within 1e-4 and identical paths, both directions', async ({
    page,
  }) => {
    const out = await page.evaluate(async () => {
      const cy = cytoscape({
        elements: [
          ...['a', 'b', 'c', 'd', 'e'].map((id) => ({ data: { id } })),
          { data: { id: 'ab', source: 'a', target: 'b', w: 3 } },
          { data: { id: 'ae', source: 'a', target: 'e', w: 1 } },
          { data: { id: 'bc', source: 'b', target: 'c', w: 5 } },
          { data: { id: 'ce', source: 'c', target: 'e', w: 6 } },
          { data: { id: 'cd', source: 'c', target: 'd', w: 2 } },
          { data: { id: 'de', source: 'd', target: 'e', w: 7 } },
        ],
      });
      const weight = (e) => e.data('w');
      const nodeIds = (p) => p.filter((x) => x.isNode()).map((x) => x.id());
      const mismatches = [];

      for (const directed of [true, false]) {
        const cpu = await cy
          .elements()
          .floydWarshall({ directed, weight, executor: 'cpu' });
        const gpu = await cy
          .elements()
          .floydWarshall({ directed, weight, executor: 'gpu' });

        for (const from of ['a', 'b', 'c', 'd', 'e']) {
          for (const to of ['a', 'b', 'c', 'd', 'e']) {
            const dc = cpu.distance(cy.$id(from), cy.$id(to));
            const dg = gpu.distance(cy.$id(from), cy.$id(to));
            const pc = nodeIds(cpu.path(cy.$id(from), cy.$id(to))).join();
            const pg = nodeIds(gpu.path(cy.$id(from), cy.$id(to))).join();
            const distOk =
              dc === dg || // covers Infinity === Infinity
              Math.abs(dc - dg) < 1e-4;

            if (!distOk || pc !== pg) {
              mismatches.push({ directed, from, to, dc, dg, pc, pg });
            }
          }
        }
      }

      return mismatches;
    });

    expect(out).toEqual([]);
  });

  test('floydWarshall: multi-block parity at n=100 (65.8 blocked kernels)', async ({
    page,
  }) => {
    const out = await page.evaluate(async () => {
      // n=100 spans four 32-wide k-panels, so every blocked phase —
      // diagonal, row/column panels, the min-plus remainder, and the
      // padded edge blocks — runs; the 5-node fixture above is a
      // single phase-1 block and would pass with phases 2–3 broken
      const els = [];
      const n = 100;

      for (let i = 0; i < n; i++) {
        els.push({ data: { id: 'n' + i } });
      }

      for (let i = 0; i < n; i++) {
        els.push({
          data: {
            source: 'n' + i,
            target: 'n' + ((i + 1) % n),
            w: 1 + ((i * 37) % 97) / 10,
          },
        });

        if (i % 5 === 0) {
          els.push({
            data: {
              source: 'n' + i,
              target: 'n' + ((i * 13 + 7) % n),
              w: 1 + ((i * 53) % 89) / 10,
            },
          });
        }
      }

      const cy = cytoscape({ elements: els });
      const weight = (e) => e.data('w');
      const cpu = await cy
        .elements()
        .floydWarshall({ weight, executor: 'cpu' });
      const gpu = await cy
        .elements()
        .floydWarshall({ weight, executor: 'gpu' });
      let maxRel = 0;
      let badPaths = 0;
      const nodes = cy.nodes();

      for (let i = 0; i < n; i += 7) {
        for (let j = 0; j < n; j += 3) {
          const dc = cpu.distance(nodes[i], nodes[j]);
          const dg = gpu.distance(nodes[i], nodes[j]);

          if (dc === Infinity || dg === Infinity) {
            if (dc !== dg) {
              badPaths++;
            }

            continue;
          }

          maxRel = Math.max(
            maxRel,
            Math.abs(dc - dg) / Math.max(1, Math.abs(dc)),
          );

          // the GPU path must be internally consistent: its edge
          // weights must sum to the GPU distance (tie-tolerant, unlike
          // comparing node sequences across f32/f64 executors)
          const path = gpu.path(nodes[i], nodes[j]);
          let sum = 0;

          path.forEach((ele) => {
            if (ele.isEdge()) {
              sum += ele.data('w');
            }
          });

          if (i !== j && Math.abs(sum - dg) > 1e-3 * Math.max(1, dg)) {
            badPaths++;
          }
        }
      }

      return { maxRel, badPaths };
    });

    expect(out.maxRel).toBeLessThan(1e-4);
    expect(out.badPaths).toBe(0);
  });

  test('affinityPropagation: identical partition of separated data', async ({
    page,
  }) => {
    const out = await page.evaluate(async () => {
      const cy = cytoscape({
        elements: ['a1', 'a2', 'a3', 'b1', 'b2', 'b3'].map((id, i) => ({
          data: { id, v: i < 3 ? 1 + i * 0.1 : 8 + (i - 3) * 0.1 },
        })),
      });
      const opts = {
        distance: 'euclidean',
        preference: 'median',
        damping: 0.8,
        attributes: [(n) => n.data('v')],
      };
      const key = (clusters) =>
        clusters
          .map((c) =>
            c
              .map((n) => n.id())
              .sort()
              .join(','),
          )
          .sort();
      const cpu = await cy
        .elements()
        .affinityPropagation({ ...opts, executor: 'cpu' });
      const gpu = await cy
        .elements()
        .affinityPropagation({ ...opts, executor: 'gpu' });

      return { cpu: key(cpu), gpu: key(gpu) };
    });

    expect(out.gpu).toEqual(out.cpu);
    expect(out.cpu.length).toBe(2);
  });

  test('kMeans + kMedoids: identical clusters with fixed seeds', async ({
    page,
  }) => {
    const out = await page.evaluate(async () => {
      const kmCy = cytoscape({
        elements: [
          { data: { id: '1', attrA: 1.0, attrB: 1.0 } },
          { data: { id: '2', attrA: 1.5, attrB: 2.0 } },
          { data: { id: '3', attrA: 3.0, attrB: 4.0 } },
          { data: { id: '4', attrA: 5.0, attrB: 7.0 } },
          { data: { id: '5', attrA: 3.5, attrB: 5.0 } },
          { data: { id: '6', attrA: 4.5, attrB: 5.0 } },
          { data: { id: '7', attrA: 3.5, attrB: 4.5 } },
        ],
      });
      const ids = (c) => c.map((e) => e.id());
      const attrs = [(n) => n.data('attrA'), (n) => n.data('attrB')];
      const kmOpts = {
        k: 2,
        distance: 'euclidean',
        maxIterations: 10,
        attributes: attrs,
        testMode: true,
        testCentroids: [
          [1.0, 1.0],
          [5.0, 7.0],
        ],
      };
      const kmCpu = await kmCy
        .elements()
        .kMeans({ ...kmOpts, executor: 'cpu' });
      const kmGpu = await kmCy
        .elements()
        .kMeans({ ...kmOpts, executor: 'gpu' });

      const kmedCy = cytoscape({
        elements: [
          { data: { id: '1', attrA: 2, attrB: 6 } },
          { data: { id: '2', attrA: 3, attrB: 4 } },
          { data: { id: '3', attrA: 3, attrB: 8 } },
          { data: { id: '4', attrA: 4, attrB: 7 } },
          { data: { id: '5', attrA: 6, attrB: 2 } },
          { data: { id: '6', attrA: 6, attrB: 4 } },
          { data: { id: '7', attrA: 7, attrB: 3 } },
          { data: { id: '8', attrA: 7, attrB: 4 } },
          { data: { id: '9', attrA: 8, attrB: 5 } },
          { data: { id: '10', attrA: 7, attrB: 6 } },
        ],
      });
      const kmedOpts = {
        k: 2,
        distance: 'manhattan',
        maxIterations: 10,
        attributes: attrs,
        testMode: true,
        testCentroids: [kmedCy.$id('2'), kmedCy.$id('8')],
      };
      const kmedCpu = await kmedCy
        .elements()
        .kMedoids({ ...kmedOpts, executor: 'cpu' });
      const kmedGpu = await kmedCy
        .elements()
        .kMedoids({ ...kmedOpts, executor: 'gpu' });

      return {
        kmCpu: kmCpu.map(ids),
        kmGpu: kmGpu.map(ids),
        kmedCpu: kmedCpu.map(ids),
        kmedGpu: kmedGpu.map(ids),
      };
    });

    expect(out.kmGpu).toEqual(out.kmCpu);
    expect(out.kmedGpu).toEqual(out.kmedCpu);
  });

  test('fuzzyCMeans: separated partition, memberships summing to 1', async ({
    page,
  }) => {
    const out = await page.evaluate(async () => {
      const cy = cytoscape({
        elements: [
          [0, 4],
          [0, 3],
          [1, 5],
          [2, 4],
          [3, 3],
          [2, 2],
          [2, 1],
          [1, 0],
          [5, 5],
          [6, 5],
          [7, 6],
          [5, 3],
          [7, 3],
          [6, 2],
          [6, 1],
          [8, 1],
        ].map(([a, b], i) => ({
          data: { id: String(i + 1), attrA: a, attrB: b },
        })),
      });
      // random init: the pinned invariant is the crisp partition of
      // well-separated data plus row-stochastic memberships, as the
      // CPU specs pin it
      const res = await cy.elements().fuzzyCMeans({
        m: 2,
        distance: 'manhattan',
        maxIterations: 10,
        attributes: [(n) => n.data('attrA'), (n) => n.data('attrB')],
        executor: 'gpu',
      });
      const clusters = res.clusters;
      const first = clusters[0].contains(cy.$id('1')) ? 0 : 1;
      const ids = (c) => c.map((e) => Number(e.id())).sort((a, b) => a - b);
      let rowErr = 0;

      for (const row of res.degreeOfMembership) {
        rowErr = Math.max(rowErr, Math.abs(row.reduce((a, b) => a + b, 0) - 1));
      }

      return {
        low: ids(clusters[first]),
        high: ids(clusters[(first + 1) % 2]),
        rowErr,
      };
    });

    expect(out.low).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(out.high).toEqual([9, 10, 11, 12, 13, 14, 15, 16]);
    expect(out.rowErr).toBeLessThan(1e-5);
  });

  test('hierarchicalClustering: identical clusters at dendrogram depths 0–3', async ({
    page,
  }) => {
    const out = await page.evaluate(async () => {
      const cy = cytoscape({
        elements: [
          { data: { id: 'A', X1: 1, X2: 1 } },
          { data: { id: 'B', X1: 1.5, X2: 1.5 } },
          { data: { id: 'C', X1: 5, X2: 5 } },
          { data: { id: 'D', X1: 3, X2: 4 } },
          { data: { id: 'E', X1: 4, X2: 4 } },
          { data: { id: 'F', X1: 3, X2: 3.5 } },
        ],
      });
      const ids = (c) => c.map((e) => e.id());
      const rows = [];

      for (const dendrogramDepth of [0, 1, 2, 3]) {
        const opts = {
          distance: 'euclidean',
          linkage: 'min',
          attributes: [(n) => n.data('X1'), (n) => n.data('X2')],
          mode: 'dendrogram',
          dendrogramDepth,
        };
        const cpu = await cy
          .elements()
          .hierarchicalClustering({ ...opts, executor: 'cpu' });
        const gpu = await cy
          .elements()
          .hierarchicalClustering({ ...opts, executor: 'gpu' });

        rows.push({ cpu: cpu.map(ids), gpu: gpu.map(ids) });
      }

      return rows;
    });

    for (const row of out) {
      expect(row.gpu).toEqual(row.cpu);
    }
  });

  test('betweennessCentrality: exact on the fixture, ≤1e-3 relative at n=200', async ({
    page,
  }) => {
    const out = await page.evaluate(async () => {
      const cy = cytoscape({
        elements: [
          ...['a', 'b', 'c', 'd', 'e'].map((id) => ({ data: { id } })),
          { data: { id: 'ab', source: 'a', target: 'b' } },
          { data: { id: 'ae', source: 'a', target: 'e' } },
          { data: { id: 'bc', source: 'b', target: 'c' } },
          { data: { id: 'ce', source: 'c', target: 'e' } },
          { data: { id: 'cd', source: 'c', target: 'd' } },
          { data: { id: 'de', source: 'd', target: 'e' } },
        ],
      });
      const rows = {};

      for (const directed of [false, true]) {
        const cpu = await cy
          .elements()
          .betweennessCentrality({ directed, executor: 'cpu' });
        const gpu = await cy
          .elements()
          .betweennessCentrality({ directed, executor: 'gpu' });
        let maxErr = 0;

        cy.nodes().forEach((node) => {
          maxErr = Math.max(
            maxErr,
            Math.abs(cpu.betweenness(node) - gpu.betweenness(node)),
          );
        });
        rows[directed ? 'directed' : 'undirected'] = maxErr;
      }

      // a 200-node ring with chords: multiple shortest paths, deeper
      // BFS levels, batching over several source batches
      const els = [];
      const n = 200;

      for (let i = 0; i < n; i++) {
        els.push({ data: { id: 'n' + i } });
      }

      for (let i = 0; i < n; i++) {
        els.push({ data: { source: 'n' + i, target: 'n' + ((i + 1) % n) } });

        if (i % 7 === 0) {
          els.push({
            data: { source: 'n' + i, target: 'n' + ((i * 13 + 29) % n) },
          });
        }
      }

      const big = cytoscape({ elements: els });
      const cpuB = await big
        .elements()
        .betweennessCentrality({ executor: 'cpu' });
      const gpuB = await big
        .elements()
        .betweennessCentrality({ executor: 'gpu' });
      let maxRel = 0;

      big.nodes().forEach((node) => {
        const c = cpuB.betweenness(node);
        const g = gpuB.betweenness(node);

        maxRel = Math.max(maxRel, Math.abs(c - g) / Math.max(1, Math.abs(c)));
      });
      rows.big = maxRel;

      return rows;
    });

    expect(out.undirected).toBe(0);
    expect(out.directed).toBe(0);
    expect(out.big).toBeLessThan(1e-3);
  });

  test("routing: a custom distance fn has no GPU path under executor 'gpu'", async ({
    page,
  }) => {
    const out = await page.evaluate(async () => {
      const cy = cytoscape({
        elements: [{ data: { id: 'x', v: 1 } }, { data: { id: 'y', v: 2 } }],
      });

      // custom fn: 'gpu' must reject with the reason, 'auto' must
      // answer via the CPU — the executor contract, in a browser that
      // *does* have an adapter
      const rejection = await cy
        .elements()
        .kMeans({
          k: 2,
          attributes: [(n) => n.data('v')],
          distance: (len, getP, getQ) => Math.abs(getP(0) - getQ(0)),
          testMode: true,
          testCentroids: [[1], [2]],
          executor: 'gpu',
        })
        .then(
          () => null,
          (err) => err.message,
        );
      const auto = await cy.elements().kMeans({
        k: 2,
        attributes: [(n) => n.data('v')],
        distance: (len, getP, getQ) => Math.abs(getP(0) - getQ(0)),
        testMode: true,
        testCentroids: [[1], [2]],
        executor: 'auto',
      });

      return { rejection, autoLength: auto.length };
    });

    expect(out.rejection).toMatch(/custom distance function/);
    expect(out.autoLength).toBe(2);
  });
});
