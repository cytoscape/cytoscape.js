import type { Collection } from '../collection.mjs';
import type { Ref } from '../contract.mjs';
import { subgraph, weightAt } from './algo-shared.mjs';
import type { WeightFn } from './algo-shared.mjs';

/**
 * Kruskal's minimum spanning tree (forest) over the calling collection,
 * treated as undirected.  Returns the collection's nodes plus the accepted
 * edges, in acceptance order — v3's result shape.
 */
export const kruskal = (coll: Collection, weight?: WeightFn): Collection => {
  const view = subgraph(coll);
  const { store, endpoints, index, nodeSlots } = view;
  const weightOf = weightAt(view, weight);
  const n = nodeSlots.length;

  // union-find with path compression
  const parent = new Int32Array(n);

  for (let i = 0; i < n; i++) {
    parent[i] = i;
  }

  const find = (i: number): number => {
    let root = i;

    while (parent[root] !== root) {
      root = parent[root];
    }

    while (parent[i] !== root) {
      const up = parent[i];

      parent[i] = root;
      i = up;
    }

    return root;
  };

  const sorted = view.edgeSlots
    .map((e) => ({ e, w: weightOf(e) }))
    .sort((a, b) => a.w - b.w); // stable: insertion order among equal weights

  const refs: Ref[] = [];

  for (const slot of nodeSlots) {
    refs.push(store.ref('nodes', slot));
  }

  for (const { e } of sorted) {
    const s = index.get(endpoints[e * 2]);
    const t = index.get(endpoints[e * 2 + 1]);

    if (s == null || t == null) {
      continue;
    } // endpoint outside the collection

    const rs = find(s);
    const rt = find(t);

    if (rs !== rt) {
      parent[rt] = rs;
      refs.push(store.ref('edges', e));
    }
  }

  return coll._spawnLive(refs);
};
