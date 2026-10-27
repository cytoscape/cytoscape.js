import type { Collection } from '../collection.mjs';
import type { Ref } from '../contract.mjs';
import {
  subgraph,
  eachIncident,
  firstNodeSlot,
  weightAt,
  NodeHeap,
} from './algo-shared.mjs';
import type { SubgraphView, WeightFn } from './algo-shared.mjs';
import { GROUP_EDGES, GROUP_NODES } from '../contract.mjs';

export interface DijkstraOptions {
  root?: Collection | null;
  weight?: WeightFn;
  directed?: boolean;
}

export interface DijkstraResult {
  distanceTo(node: Collection): number | undefined;
  pathTo(node: Collection): Collection;
}

export type DijkstraArgs = [
  (DijkstraOptions | Collection)?,
  WeightFn?,
  boolean?,
];

const isCollection = (value: unknown): value is Collection =>
  value != null &&
  typeof value === 'object' &&
  (value as Collection)._refs != null;

/**
 * Dijkstra's walk over a subgraph view by dense index — the core of
 * `dijkstra`, and of the single-root `closenessCentrality`, whose
 * incoming direction walks the transposed graph (`reverse`, round 150).
 *
 * @param view — the subgraph view
 * @param root — the source's dense index
 * @param weightOf — the edge weight by slot
 * @param directed — follow edge direction
 * @param reverse — when directed, walk in-edges instead (distances *to*
 *   the root)
 * @returns per-dense-index distances and the predecessor node and edge
 */
export const dijkstraDense = (
  view: SubgraphView,
  root: number,
  weightOf: (edgeSlot: number) => number,
  directed: boolean,
  reverse = false,
): { dist: Float64Array; prevNode: Int32Array; prevEdge: Int32Array } => {
  const { index, nodeSlots } = view;
  const n = nodeSlots.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prevNode = new Int32Array(n).fill(-1); // dense index
  const prevEdge = new Int32Array(n).fill(-1); // edge slot

  dist[root] = 0;

  const heap = new NodeHeap(n, dist);

  for (let i = 0; i < n; i++) {
    heap.push(i);
  }

  while (heap.size > 0) {
    const u = heap.pop();

    if (dist[u] === Infinity) {
      continue;
    }

    eachIncident(
      view,
      nodeSlots[u],
      directed,
      (edgeSlot, otherSlot) => {
        const w = index.get(otherSlot) as number;

        if (!heap.has(w)) {
          return;
        } // already settled

        const alt = dist[u] + weightOf(edgeSlot);

        if (alt < dist[w]) {
          dist[w] = alt;
          prevNode[w] = u;
          prevEdge[w] = edgeSlot;
          heap.update(w);
        }
      },
      reverse,
    );
  }

  return { dist, prevNode, prevEdge };
};

/** Single-source shortest paths (non-negative weights) over the calling collection. */
export const dijkstra = (
  coll: Collection,
  args: DijkstraArgs,
): DijkstraResult => {
  let options: DijkstraOptions;

  if (
    args[0] != null &&
    !isCollection(args[0]) &&
    typeof args[0] === 'object'
  ) {
    options = args[0];
  } else {
    options = {
      root: args[0] as Collection | undefined,
      weight: args[1],
      directed: args[2],
    };
  }

  const view = subgraph(coll);
  const { store, index, nodeSlots } = view;
  const rootSlot = firstNodeSlot(view, options.root, 'root');

  if (rootSlot == null || !index.has(rootSlot)) {
    throw new TypeError(
      'dijkstra requires a `root` node in the calling collection',
    );
  }

  const { dist, prevNode, prevEdge } = dijkstraDense(
    view,
    index.get(rootSlot) as number,
    weightAt(view, options.weight),
    options.directed === true,
  );

  const denseOf = (node: Collection): number | undefined => {
    const slot = firstNodeSlot(view, node, 'node');

    return slot == null ? undefined : index.get(slot);
  };

  return {
    distanceTo(node: Collection): number | undefined {
      const i = denseOf(node);

      return i == null ? undefined : dist[i];
    },

    pathTo(node: Collection): Collection {
      const target = denseOf(node);
      const refs: Ref[] = [];

      if (target != null) {
        let u = target;

        refs.push(store.ref(GROUP_NODES, nodeSlots[u]));

        while (prevNode[u] >= 0) {
          refs.unshift(store.ref(GROUP_EDGES, prevEdge[u]));
          u = prevNode[u];
          refs.unshift(store.ref(GROUP_NODES, nodeSlots[u]));
        }
      }

      return coll._spawnLive(refs);
    },
  };
};
