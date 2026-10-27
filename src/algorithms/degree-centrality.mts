import type { Collection } from '../collection.mjs';
import {
  subgraph,
  incidentEdgesInView,
  firstNodeSlot,
  weightAt,
  resolveNormalization,
} from './algo-shared.mjs';
import type { SubgraphView, WeightFn } from './algo-shared.mjs';

export interface DegreeCentralityOptions {
  root?: Collection | null;
  weight?: WeightFn;
  directed?: boolean;
  /** 0 = count degree, 1 = weight sum (Opsahl's generalized degree) */
  alpha?: number;
  /**
   * read by `degreeCentralityNormalized` only (round 150): `'max'`
   * (default) divides by the largest degree, `'size'` by n − 1 —
   * NetworkX's `degree_centrality` and igraph's `normalized = TRUE`
   */
  normalization?: 'max' | 'size';
}

export interface UndirectedDegreeCentrality {
  degree: number;
}
export interface DirectedDegreeCentrality {
  indegree: number;
  outdegree: number;
}
export type DegreeCentralityResult =
  | UndirectedDegreeCentrality
  | DirectedDegreeCentrality;

export interface UndirectedDegreeCentralityNormalized {
  degree(node: Collection): number;
}
export interface DirectedDegreeCentralityNormalized {
  indegree(node: Collection): number;
  outdegree(node: Collection): number;
}
export type DegreeCentralityNormalizedResult =
  | UndirectedDegreeCentralityNormalized
  | DirectedDegreeCentralityNormalized;

const degreeOf = (
  view: SubgraphView,
  rootSlot: number,
  directed: boolean,
  weightOf: (edgeSlot: number) => number,
  alpha: number,
): { degree: number } & { indegree: number; outdegree: number } => {
  const { endpoints } = view;
  const edges = incidentEdgesInView(view, rootSlot);

  if (!directed) {
    let s = 0;

    for (const e of edges) {
      s += weightOf(e);
    }

    const degree = Math.pow(edges.length, 1 - alpha) * Math.pow(s, alpha);

    return { degree, indegree: degree, outdegree: degree };
  }

  let kIn = 0,
    kOut = 0,
    sIn = 0,
    sOut = 0;

  for (const e of edges) {
    const w = weightOf(e);

    // a loop counts on both sides, as in v3
    if (endpoints[e * 2 + 1] === rootSlot) {
      kIn++;
      sIn += w;
    }
    if (endpoints[e * 2] === rootSlot) {
      kOut++;
      sOut += w;
    }
  }

  const indegree = Math.pow(kIn, 1 - alpha) * Math.pow(sIn, alpha);
  const outdegree = Math.pow(kOut, 1 - alpha) * Math.pow(sOut, alpha);

  return { degree: indegree, indegree, outdegree };
};

/** Opsahl's generalized degree centrality of `root` within the calling collection. */
export const degreeCentrality = (
  coll: Collection,
  options: DegreeCentralityOptions = {},
): DegreeCentralityResult => {
  const view = subgraph(coll);
  const rootSlot = firstNodeSlot(view, options.root, 'root');

  if (rootSlot == null) {
    throw new TypeError('degreeCentrality requires a `root` node');
  }

  const directed = options.directed === true;
  const weightOf = weightAt(view, options.weight);
  const alpha = options.alpha ?? 0;
  const d = degreeOf(view, rootSlot, directed, weightOf, alpha);

  return directed
    ? { indegree: d.indegree, outdegree: d.outdegree }
    : { degree: d.degree };
};

/**
 * Divide one degree series by its normalization: the series' maximum
 * (0 when every degree is), or n − 1 — where a lone node scores 1, as
 * NetworkX's `degree_centrality` has it.
 *
 * @param values — the degrees, by dense index
 * @param normalization — 'max' or 'size'
 * @returns the scale to multiply each degree by
 */
const degreeScale = (
  values: Float64Array,
  normalization: 'max' | 'size',
): ((value: number) => number) => {
  const n = values.length;

  if (normalization === 'size') {
    return n <= 1 ? () => 1 : (value) => value / (n - 1);
  }

  let max = 0;

  for (let i = 0; i < n; i++) {
    max = Math.max(max, values[i]);
  }

  return max === 0 ? () => 0 : (value) => value / max;
};

/**
 * Degree centrality of every collection node, normalized by the
 * maximum (default) or by n − 1 (`normalization: 'size'`).
 */
export const degreeCentralityNormalized = (
  coll: Collection,
  options: DegreeCentralityOptions = {},
): DegreeCentralityNormalizedResult => {
  const normalization = resolveNormalization(
    options.normalization,
    ['max', 'size'] as const,
    'degreeCentralityNormalized',
  );
  const view = subgraph(coll);
  const { index, nodeSlots } = view;
  const directed = options.directed === true;
  const weightOf = weightAt(view, options.weight);
  const alpha = options.alpha ?? 0;
  const n = nodeSlots.length;

  const denseOf = (node: Collection): number | undefined => {
    const slot = firstNodeSlot(view, node, 'node');

    return slot == null ? undefined : index.get(slot);
  };

  if (!directed) {
    const degrees = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      degrees[i] = degreeOf(view, nodeSlots[i], false, weightOf, alpha).degree;
    }

    const scale = degreeScale(degrees, normalization);

    return {
      degree(node: Collection): number {
        const i = denseOf(node);

        return i == null ? 0 : scale(degrees[i]);
      },
    };
  }

  const indegrees = new Float64Array(n);
  const outdegrees = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const d = degreeOf(view, nodeSlots[i], true, weightOf, alpha);

    indegrees[i] = d.indegree;
    outdegrees[i] = d.outdegree;
  }

  const inScale = degreeScale(indegrees, normalization);
  const outScale = degreeScale(outdegrees, normalization);

  return {
    indegree(node: Collection): number {
      const i = denseOf(node);

      return i == null ? 0 : inScale(indegrees[i]);
    },

    outdegree(node: Collection): number {
      const i = denseOf(node);

      return i == null ? 0 : outScale(outdegrees[i]);
    },
  };
};
