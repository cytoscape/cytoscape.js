import type { Collection } from '../collection.mjs';
import type { Ref } from '../contract.mjs';
import { subgraph, incidentEdgesInView } from './algo-shared.mjs';

/** An edge encoded as [ edge slot, source dense index, target dense index ]. */
type EdgeIndex = [number, number, number];

export interface KargerSteinResult {
  cut: Collection;
  components: Collection[];
  partition1: Collection;
  partition2: Collection;
}

const sqrt2 = Math.sqrt(2);

// collapse the two meta nodes joined by the chosen edge, dropping the edges
// between them and re-pointing the rest — v3's pass, verbatim on indices
const collapse = (
  edgeIndex: number,
  nodeMap: Int32Array,
  remainingEdges: EdgeIndex[],
): EdgeIndex[] => {
  if (remainingEdges.length === 0) {
    throw new Error('Karger-Stein must be run on a connected (sub)graph');
  }

  const edgeInfo = remainingEdges[edgeIndex];
  const partition1 = nodeMap[edgeInfo[1]];
  const partition2 = nodeMap[edgeInfo[2]];
  const newEdges = remainingEdges; // re-use array

  for (let i = newEdges.length - 1; i >= 0; i--) {
    const edge = newEdges[i];
    const src = nodeMap[edge[1]];
    const tgt = nodeMap[edge[2]];

    if (
      (src === partition1 && tgt === partition2) ||
      (src === partition2 && tgt === partition1)
    ) {
      newEdges.splice(i, 1);
    }
  }

  for (let i = 0; i < newEdges.length; i++) {
    const edge = newEdges[i];

    if (edge[1] === partition2) {
      newEdges[i] = edge.slice() as EdgeIndex;
      newEdges[i][1] = partition1;
    } else if (edge[2] === partition2) {
      newEdges[i] = edge.slice() as EdgeIndex;
      newEdges[i][2] = partition1;
    }
  }

  for (let i = 0; i < nodeMap.length; i++) {
    if (nodeMap[i] === partition2) {
      nodeMap[i] = partition1;
    }
  }

  return newEdges;
};

const contractUntil = (
  metaNodeMap: Int32Array,
  remainingEdges: EdgeIndex[],
  size: number,
  sizeLimit: number,
): EdgeIndex[] => {
  while (size > sizeLimit) {
    const edgeIndex = Math.floor(Math.random() * remainingEdges.length);

    remainingEdges = collapse(edgeIndex, metaNodeMap, remainingEdges);
    size--;
  }

  return remainingEdges;
};

/**
 * Karger-Stein randomized minimum cut of the calling collection (undirected;
 * correct with high probability).
 */
export const kargerStein = (coll: Collection): KargerSteinResult => {
  const view = subgraph(coll);
  const { store, endpoints, index, nodeSlots } = view;
  const numNodes = nodeSlots.length;

  if (numNodes < 2) {
    throw new Error('At least 2 nodes are required for Karger-Stein algorithm');
  }

  // non-loop subgraph edges with both endpoints inside
  const edgeSlots: number[] = [];
  const edgeIndexes: EdgeIndex[] = [];

  for (const e of view.edgeSlots) {
    const s = index.get(endpoints[e * 2]);
    const t = index.get(endpoints[e * 2 + 1]);

    if (s == null || t == null || s === t) {
      continue;
    }

    edgeIndexes.push([edgeSlots.length, s, t]);
    edgeSlots.push(e);
  }

  const numIter = Math.ceil(Math.pow(Math.log(numNodes) / Math.LN2, 2));
  const stopSize = Math.floor(numNodes / sqrt2);

  let minCutSize = Infinity;
  let minCutEdgeIndexes: EdgeIndex[] = [];
  const minCutNodeMap = new Int32Array(numNodes);

  const metaNodeMap = new Int32Array(numNodes);
  const metaNodeMap2 = new Int32Array(numNodes);

  for (let iter = 0; iter <= numIter; iter++) {
    for (let i = 0; i < numNodes; i++) {
      metaNodeMap[i] = i;
    }

    const edgesState = contractUntil(
      metaNodeMap,
      edgeIndexes.slice(),
      numNodes,
      stopSize,
    );
    const edgesState2 = edgesState.slice();

    metaNodeMap2.set(metaNodeMap);

    const res1 = contractUntil(metaNodeMap, edgesState, stopSize, 2);
    const res2 = contractUntil(metaNodeMap2, edgesState2, stopSize, 2);

    if (res1.length <= res2.length && res1.length < minCutSize) {
      minCutSize = res1.length;
      minCutEdgeIndexes = res1;
      minCutNodeMap.set(metaNodeMap);
    } else if (res2.length <= res1.length && res2.length < minCutSize) {
      minCutSize = res2.length;
      minCutEdgeIndexes = res2;
      minCutNodeMap.set(metaNodeMap2);
    }
  }

  const cutEdgeSlots = new Set<number>(
    minCutEdgeIndexes.map((e) => edgeSlots[e[0]]),
  );
  const cutRefs: Ref[] = [...cutEdgeSlots].map((e) => store.ref('edges', e));

  const partition1Refs: Ref[] = [];
  const partition2Refs: Ref[] = [];
  const inPartition1 = new Uint8Array(numNodes);
  const witness = minCutNodeMap[0];

  for (let i = 0; i < numNodes; i++) {
    if (minCutNodeMap[i] === witness) {
      inPartition1[i] = 1;
      partition1Refs.push(store.ref('nodes', nodeSlots[i]));
    } else {
      partition2Refs.push(store.ref('nodes', nodeSlots[i]));
    }
  }

  // each component: the partition's nodes plus their subgraph edges not in the cut
  const constructComponent = (wantPartition1: boolean): Collection => {
    const refs: Ref[] = [];
    const seenEdges = new Set<number>();

    for (let i = 0; i < numNodes; i++) {
      if ((inPartition1[i] === 1) !== wantPartition1) {
        continue;
      }

      refs.push(store.ref('nodes', nodeSlots[i]));

      for (const e of incidentEdgesInView(view, nodeSlots[i])) {
        if (!cutEdgeSlots.has(e) && !seenEdges.has(e)) {
          seenEdges.add(e);
          refs.push(store.ref('edges', e));
        }
      }
    }

    return coll._spawnLive(refs);
  };

  return {
    cut: coll._spawnLive(cutRefs),
    components: [constructComponent(true), constructComponent(false)],

    // n.b. partitions kept for the v3 api shape
    partition1: coll._spawnLive(partition1Refs),
    partition2: coll._spawnLive(partition2Refs),
  };
};
