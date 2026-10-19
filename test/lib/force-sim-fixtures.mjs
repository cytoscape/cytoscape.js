// Shared by test/force-sim.mjs and test/force-sim-dense.mjs.
import {
  ForceSim,
  seedPositions,
  defaultForceParams,
} from '../../src/layout/force-sim.mjs';

export const mkSim = (n, edges, over = {}) => {
  const positions = new Float32Array(n * 2);

  seedPositions(n, over.seed ?? 1, over.spread ?? 100, positions);

  const edgeLength = new Float32Array(edges.length / 2).fill(
    over.edgeLength ?? 60,
  );

  return new ForceSim({
    n,
    edges,
    edgeLength,
    positions,
    ...defaultForceParams(),
    ...over,
  });
};

// equal square boxes of `size` px padded by `pad` (half per side),
// the shape the layout hands the sim under avoidOverlap
export const boxes = (n, size, pad = 10) => {
  const half = size / 2 + pad / 2;

  return {
    x1: new Float32Array(n).fill(-half),
    y1: new Float32Array(n).fill(-half),
    x2: new Float32Array(n).fill(half),
    y2: new Float32Array(n).fill(half),
    maxW: 2 * half,
    maxH: 2 * half,
  };
};

// overlapping pairs and the smallest axis gap between two boxes
export const probe = (pos, n, ext) => {
  let overlaps = 0;
  let minGap = Infinity;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = Math.abs(pos[j * 2] - pos[i * 2]);
      const dy = Math.abs(pos[j * 2 + 1] - pos[i * 2 + 1]);
      const w = ext.x2[i] - ext.x1[j];
      const h = ext.y2[i] - ext.y1[j];

      if (dx < w && dy < h) {
        overlaps++;
      }

      minGap = Math.min(minGap, Math.max(dx - w, dy - h));
    }
  }

  return { overlaps, minGap };
};
