import type { Collection } from '../collection.mjs';
import type { Ref } from '../contract.mjs';
import { subgraph, firstNodeSlot, weightAt } from './algo-shared.mjs';
import type { WeightFn } from './algo-shared.mjs';

export interface FloydWarshallOptions {
  weight?: WeightFn;
  directed?: boolean;
}

export interface FloydWarshallResult {
  distance(from: Collection, to: Collection): number | undefined;
  path(from: Collection, to: Collection): Collection;
}

/** All-pairs shortest paths over the calling collection (dense N² matrices). */
export const floydWarshall = (
  coll: Collection,
  options: FloydWarshallOptions = {},
): FloydWarshallResult => {
  const view = subgraph(coll);
  const { cy, store, endpoints, index, nodeSlots } = view;
  const directed = options.directed === true;
  const weightOf = weightAt(view, options.weight);

  const n = nodeSlots.length;
  const nsq = n * n;
  const dist = new Float64Array(nsq).fill(Infinity);
  const next = new Int32Array(nsq).fill(-1); // dense index
  const edgeNext = new Int32Array(nsq).fill(-1); // edge slot

  for (let i = 0; i < n; i++) {
    dist[i * n + i] = 0;
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

    const w = weightOf(e);
    const st = s * n + t;

    // parallel edges: keep the lightest
    if (dist[st] > w) {
      dist[st] = w;
      next[st] = t;
      edgeNext[st] = e;
    }

    if (!directed) {
      const ts = t * n + s;

      if (dist[ts] > w) {
        dist[ts] = w;
        next[ts] = s;
        edgeNext[ts] = e;
      }
    }
  }

  for (let k = 0; k < n; k++) {
    const kn = k * n;

    for (let i = 0; i < n; i++) {
      const rowI = i * n;
      const ik = rowI + k;
      const dik = dist[ik];

      // Infinity relaxes nothing (Inf + x is never < anything finite or
      // not), so an unreachable (i, k) pair skips its whole j row — a
      // real win on sparse graphs early in k, and a no-op otherwise.
      if (dik === Infinity) {
        continue;
      }

      // dist[ik] is loop-invariant across j: the only ij aliasing ik is
      // j === k, where the update needs dist[kk] < 0 — a negative cycle,
      // on which Floyd–Warshall is undefined either way (v3 reloads and
      // is equally undefined there).  Running ij/kj indices replace the
      // two per-iteration multiplies, and the sum is computed once.
      for (let j = 0, ij = rowI, kj = kn; j < n; j++, ij++, kj++) {
        const alt = dik + dist[kj];

        if (alt < dist[ij]) {
          dist[ij] = alt;
          next[ij] = next[ik];
        }
      }
    }
  }

  const denseOf = (node: Collection, name: string): number | undefined => {
    const slot = firstNodeSlot(view, node, name);

    return slot == null ? undefined : index.get(slot);
  };

  return {
    distance(from: Collection, to: Collection): number | undefined {
      const i = denseOf(from, 'from');
      const j = denseOf(to, 'to');

      return i == null || j == null ? undefined : dist[i * n + j];
    },

    path(from: Collection, to: Collection): Collection {
      let i = denseOf(from, 'from');
      const j = denseOf(to, 'to');

      if (i == null || j == null) {
        return cy.collection();
      }

      if (i === j) {
        return cy._ele('nodes', nodeSlots[i]);
      }

      if (next[i * n + j] < 0) {
        return cy.collection();
      }

      const refs: Ref[] = [store.ref('nodes', nodeSlots[i])];

      while (i !== j) {
        const prev = i;

        i = next[i * n + j];
        refs.push(store.ref('edges', edgeNext[prev * n + i]));
        refs.push(store.ref('nodes', nodeSlots[i]));
      }

      return coll._spawn(refs);
    },
  };
};
