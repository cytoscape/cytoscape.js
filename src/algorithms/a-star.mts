import type { Collection } from '../collection.mjs';
import type { Ref } from '../contract.mjs';
import {
  subgraph,
  eachIncident,
  firstNodeSlot,
  weightAt,
  NodeHeap,
} from './algo-shared.mjs';
import type { WeightFn } from './algo-shared.mjs';

export type AStarHeuristicFn = (node: Collection) => number;

export interface AStarOptions {
  root?: Collection | null;
  goal?: Collection | null;
  weight?: WeightFn;
  heuristic?: AStarHeuristicFn;
  directed?: boolean;
}

export interface AStarResult {
  found: boolean;
  distance: number | undefined;
  path: Collection | undefined;
  steps: number;
}

/** A* shortest path from `root` to `goal` over the calling collection. */
export const aStar = (
  coll: Collection,
  options: AStarOptions = {},
): AStarResult => {
  const view = subgraph(coll);
  const { cy, store, index, nodeSlots } = view;
  const rootSlot = firstNodeSlot(view, options.root, 'root');
  const goalSlot = firstNodeSlot(view, options.goal, 'goal');

  if (
    rootSlot == null ||
    !index.has(rootSlot) ||
    goalSlot == null ||
    !index.has(goalSlot)
  ) {
    throw new TypeError(
      'aStar requires `root` and `goal` nodes in the calling collection',
    );
  }

  const directed = options.directed === true;
  const weightOf = weightAt(view, options.weight);
  const heuristic = options.heuristic ?? (() => 0);
  const n = nodeSlots.length;

  const gScore = new Float64Array(n).fill(Infinity);
  const fScore = new Float64Array(n).fill(Infinity);
  const closed = new Uint8Array(n);
  const cameFrom = new Int32Array(n).fill(-1); // dense index
  const cameFromEdge = new Int32Array(n).fill(-1); // edge slot
  const open = new NodeHeap(n, fScore);

  const s = index.get(rootSlot) as number;
  const t = index.get(goalSlot) as number;

  gScore[s] = 0;
  fScore[s] = heuristic(cy._ele('nodes', rootSlot));
  open.push(s);

  let steps = 0;

  while (open.size > 0) {
    const c = open.pop();

    steps++;

    if (c === t) {
      const refs: Ref[] = [];
      let u = c;

      refs.push(store.ref('nodes', nodeSlots[u]));

      while (cameFrom[u] >= 0) {
        refs.unshift(store.ref('edges', cameFromEdge[u]));
        u = cameFrom[u];
        refs.unshift(store.ref('nodes', nodeSlots[u]));
      }

      return {
        found: true,
        distance: gScore[c],
        path: coll._spawnLive(refs),
        steps,
      };
    }

    closed[c] = 1;

    eachIncident(view, nodeSlots[c], directed, (edgeSlot, otherSlot) => {
      const w = index.get(otherSlot) as number;

      if (closed[w]) {
        return;
      }

      const tempScore = gScore[c] + weightOf(edgeSlot);

      if (!open.has(w)) {
        gScore[w] = tempScore;
        fScore[w] = tempScore + heuristic(cy._ele('nodes', otherSlot));
        cameFrom[w] = c;
        cameFromEdge[w] = edgeSlot;
        open.push(w);
      } else if (tempScore < gScore[w]) {
        gScore[w] = tempScore;
        fScore[w] = tempScore + heuristic(cy._ele('nodes', otherSlot));
        cameFrom[w] = c;
        cameFromEdge[w] = edgeSlot;
        open.update(w);
      }
    });
  }

  return { found: false, distance: undefined, path: undefined, steps };
};
