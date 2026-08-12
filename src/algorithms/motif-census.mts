/*
The triad census (round 70) — every three-node subgraph classified
into the sixteen Holland–Leinhardt isomorphism classes, labelled
mutual/asymmetric/null plus orientation: '003' … '300'.  The census
is the classical motif profile of a directed network — '030T', the
transitive triad, is the feed-forward loop of the systems-biology
literature — and motif *significance* is this census compared against
a degree-preserving random ensemble, which is why the count has to be
cheap: it runs once per randomization.

Both executors compute the same seven trace primitives over the
mutual mask M and the asymmetric mask C (S₁ = Σ C²∘C … S₇ = Σ CCᵀ∘M)
— the CPU by sparse wedge walks at O(Σ deg²), the GPU by four tiled
matmuls and Hadamard row folds — and every one of the sixteen counts
is a closed form over those traces, the dyad totals and the per-node
degree statistics (`censusFromPrimitives`), so the executors can only
disagree if a matmul disagrees with a wedge walk.  The formulas are
pinned by a brute-force triple classifier in the specs.

The undirected form is the same machinery with every edge read as
mutual: only '003' (empty), '102' (one edge), '201' (path) and '300'
(triangle) can then be non-zero.  Parallel edges collapse, loops are
excluded.  No v3 counterpart.
*/

import { subgraph } from './algo-shared.mjs';
import type { SubgraphView } from './algo-shared.mjs';
import type { Collection } from '../collection.mjs';
import { GPU_MIN_N, resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor } from './executor.mjs';
import { motifCensusGpu } from './algo-gpu-motifs.mjs';

/** The sixteen triad classes, in Holland–Leinhardt order. */
export const TRIAD_CLASSES = [
  '003',
  '012',
  '102',
  '021D',
  '021U',
  '021C',
  '111D',
  '111U',
  '030T',
  '030C',
  '201',
  '120D',
  '120U',
  '120C',
  '210',
  '300',
] as const;

export type TriadClass = (typeof TRIAD_CLASSES)[number];

export interface MotifCensusOptions {
  /** read edge direction (default true — the census is a directed
   * notion; `false` reads every edge as mutual, so only 003/102/201/
   * 300 can be non-zero) */
  directed?: boolean;
  /** where the run executes; see `AlgoExecutor` (default 'auto').
   * 'auto' routes to the GPU only on graphs dense enough that the
   * O(n³) trace products beat the CPU's O(Σ deg²) wedge walks. */
  executor?: AlgoExecutor;
}

export interface MotifCensusResult {
  /** the sixteen counts; they sum to C(n, 3) */
  counts: Record<TriadClass, number>;
}

/** The primitives every census count is a closed form over. */
export interface TriadPrimitives {
  n: number;
  /** mutual and asymmetric dyad totals */
  mutualDyads: number;
  asymDyads: number;
  /** Σ over nodes of C(out, 2), C(in, 2), in·out over asymmetric
   * arcs, and C(mutual, 2), mutual·out, mutual·in */
  wOutOut: number;
  wInIn: number;
  wInOut: number;
  wMutMut: number;
  wMutOut: number;
  wMutIn: number;
  /** the seven traces: Σ C²∘C, Σ C²∘Cᵀ, Σ C²∘M, Σ M²∘M, Σ M²∘C,
   * Σ CᵀC∘M, Σ CCᵀ∘M */
  s1: number;
  s2: number;
  s3: number;
  s4: number;
  s5: number;
  s6: number;
  s7: number;
}

/**
 * The deduped mutual/asymmetric arc structure both executors read:
 * per-node sorted lists of asymmetric out-, asymmetric in- and mutual
 * neighbors (dense indices), plus the dyad totals and degree-pair
 * sums.  `directed: false` files every edge as mutual.
 *
 * @param view — the subgraph view
 * @param directed — read arc direction
 * @returns the neighbor lists and every non-trace primitive
 */
export const buildTriadStructure = (
  view: SubgraphView,
  directed: boolean,
): {
  outC: Int32Array[];
  inC: Int32Array[];
  mut: Int32Array[];
  base: Omit<TriadPrimitives, 's1' | 's2' | 's3' | 's4' | 's5' | 's6' | 's7'>;
  adjacencies: number;
} => {
  const { endpoints, index } = view;
  const n = view.nodeSlots.length;
  const outSets: Set<number>[] = new Array(n);

  for (let i = 0; i < n; i++) {
    outSets[i] = new Set();
  }

  for (const e of view.edgeSlots) {
    const sSlot = endpoints[e * 2];
    const tSlot = endpoints[e * 2 + 1];

    if (sSlot === tSlot) {
      continue;
    } // exclude loops

    const s = index.get(sSlot);
    const t = index.get(tSlot);

    if (s == null || t == null) {
      continue;
    }

    outSets[s].add(t);

    if (!directed) {
      outSets[t].add(s);
    }
  }

  const outC: number[][] = new Array(n);
  const inC: number[][] = new Array(n);
  const mut: number[][] = new Array(n);

  for (let i = 0; i < n; i++) {
    outC[i] = [];
    inC[i] = [];
    mut[i] = [];
  }

  let mutualDyads = 0;
  let asymDyads = 0;
  let adjacencies = 0;

  for (let s = 0; s < n; s++) {
    for (const t of outSets[s]) {
      adjacencies++;

      if (outSets[t].has(s)) {
        if (s < t) {
          mutualDyads++;
          mut[s].push(t);
          mut[t].push(s);
        }
      } else {
        asymDyads++;
        outC[s].push(t);
        inC[t].push(s);
      }
    }
  }

  let wOutOut = 0;
  let wInIn = 0;
  let wInOut = 0;
  let wMutMut = 0;
  let wMutOut = 0;
  let wMutIn = 0;

  for (let i = 0; i < n; i++) {
    const o = outC[i].length;
    const p = inC[i].length;
    const m = mut[i].length;

    wOutOut += (o * (o - 1)) / 2;
    wInIn += (p * (p - 1)) / 2;
    wInOut += p * o;
    wMutMut += (m * (m - 1)) / 2;
    wMutOut += m * o;
    wMutIn += m * p;
  }

  return {
    outC: outC.map((list) => Int32Array.from(list)),
    inC: inC.map((list) => Int32Array.from(list)),
    mut: mut.map((list) => Int32Array.from(list)),
    base: {
      n,
      mutualDyads,
      asymDyads,
      wOutOut,
      wInIn,
      wInOut,
      wMutMut,
      wMutOut,
      wMutIn,
    },
    adjacencies,
  };
};

/**
 * The sixteen counts as closed forms over the primitives — shared by
 * both executors, so they can only diverge in the traces themselves.
 *
 * @param p — the primitives
 * @returns the census record
 */
export const censusFromPrimitives = (
  p: TriadPrimitives,
): Record<TriadClass, number> => {
  const t030T = p.s1;
  const t030C = p.s2 / 3;
  const t120C = p.s3;
  const t300 = p.s4 / 6;
  const t210 = p.s5;
  const t120D = p.s6 / 2;
  const t120U = p.s7 / 2;
  const t021D = p.wOutOut - t030T - t120D;
  const t021U = p.wInIn - t030T - t120U;
  const t021C = p.wInOut - t030T - 3 * t030C - t120C;
  const t111U = p.wMutOut - 2 * t120U - t120C - t210;
  const t111D = p.wMutIn - 2 * t120D - t120C - t210;
  const t201 = p.wMutMut - t210 - 3 * t300;
  const t012 =
    p.asymDyads * (p.n - 2) -
    2 * (t021D + t021U + t021C) -
    (t111D + t111U) -
    3 * (t030T + t030C) -
    2 * (t120D + t120U + t120C) -
    t210;
  const t102 =
    p.mutualDyads * (p.n - 2) -
    (t111D + t111U) -
    2 * t201 -
    (t120D + t120U + t120C) -
    2 * t210 -
    3 * t300;
  const triples = (p.n * (p.n - 1) * (p.n - 2)) / 6;
  const rest =
    t012 +
    t102 +
    t021D +
    t021U +
    t021C +
    t111D +
    t111U +
    t030T +
    t030C +
    t201 +
    t120D +
    t120U +
    t120C +
    t210 +
    t300;

  return {
    '003': triples - rest,
    '012': t012,
    '102': t102,
    '021D': t021D,
    '021U': t021U,
    '021C': t021C,
    '111D': t111D,
    '111U': t111U,
    '030T': t030T,
    '030C': t030C,
    '201': t201,
    '120D': t120D,
    '120U': t120U,
    '120C': t120C,
    '210': t210,
    '300': t300,
  };
};

/**
 * The async census entry point behind `eles.motifCensus()`: validates
 * `executor` synchronously, then routes to the CPU wedge walks or the
 * WGSL trace matmuls.
 *
 * @param coll — the calling collection
 * @param options — `{ directed, executor }`
 * @returns a promise of `{ counts }`
 * @throws if `executor` is invalid
 */
export const motifCensusAsync = (
  coll: Collection,
  options: MotifCensusOptions = {},
): Promise<MotifCensusResult> => {
  const executor = resolveExecutor(options.executor);
  const directed = options.directed !== false;
  const view = subgraph(coll);
  const structure = buildTriadStructure(view, directed);
  const n = view.nodeSlots.length;

  // the CPU walks wedges at O(Σ deg²) where the trace products are
  // O(n³) regardless — the triangle family's density gate
  const dense = structure.adjacencies >= (n * n) / 32;

  return runAlgo(
    executor,
    n,
    dense ? GPU_MIN_N : Infinity,
    () => motifCensus(structure),
    (ctx) => motifCensusGpu(ctx, structure),
  );
};

/**
 * The CPU reference: accumulate the seven traces by walking wedges
 * around every center — asymmetric in×out pairs for S₁–S₃, mutual
 * pairs for S₄–S₅, out×out and in×in pairs for S₆–S₇ — with O(1)
 * membership probes against per-node sets.
 *
 * @param structure — from `buildTriadStructure`
 * @returns `{ counts }`
 */
export const motifCensus = (
  structure: ReturnType<typeof buildTriadStructure>,
): MotifCensusResult => {
  const { outC, inC, mut, base } = structure;
  const n = base.n;
  const outSets: Set<number>[] = new Array(n);
  const mutSets: Set<number>[] = new Array(n);

  for (let i = 0; i < n; i++) {
    outSets[i] = new Set(outC[i]);
    mutSets[i] = new Set(mut[i]);
  }

  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  let s5 = 0;
  let s6 = 0;
  let s7 = 0;

  for (let j = 0; j < n; j++) {
    const into = inC[j];
    const outOf = outC[j];
    const mutual = mut[j];

    // asymmetric paths i→j→k: (C²)_ik once each
    for (let a = 0; a < into.length; a++) {
      const i = into[a];

      for (let b = 0; b < outOf.length; b++) {
        const k = outOf[b];

        if (i === k) {
          continue;
        }

        if (outSets[i].has(k)) {
          s1++;
        }

        if (outSets[k].has(i)) {
          s2++;
        }

        if (mutSets[i].has(k)) {
          s3++;
        }
      }
    }

    // mutual wedges x−j−y: (M²)_xy over ordered pairs
    for (let a = 0; a < mutual.length; a++) {
      const x = mutual[a];

      for (let b = 0; b < mutual.length; b++) {
        const y = mutual[b];

        if (x === y) {
          continue;
        }

        if (mutSets[x].has(y)) {
          s4++;
        }

        if (outSets[x].has(y) && !mutSets[x].has(y)) {
          s5++;
        }
      }
    }

    // out-out wedges x←j→y: (CᵀC)... (S₆ gathers at the *source*
    // center: Σ_j C_jx·C_jy·M_xy), and in-in wedges x→j←y for S₇
    for (let a = 0; a < outOf.length; a++) {
      const x = outOf[a];

      for (let b = 0; b < outOf.length; b++) {
        const y = outOf[b];

        if (x !== y && mutSets[x].has(y)) {
          s6++;
        }
      }
    }

    for (let a = 0; a < into.length; a++) {
      const x = into[a];

      for (let b = 0; b < into.length; b++) {
        const y = into[b];

        if (x !== y && mutSets[x].has(y)) {
          s7++;
        }
      }
    }
  }

  return {
    counts: censusFromPrimitives({ ...base, s1, s2, s3, s4, s5, s6, s7 }),
  };
};
