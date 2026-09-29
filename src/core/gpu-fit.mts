// The model side of round 138's device pre-flight: an add that would
// grow a table past what the mounted renderer's device can bind throws
// before the store changes.  See `src/device-fit.mts` for the limits and
// the rule.

import { GpuUnfitError } from '../algorithms/gpu-registry.mjs';
import { GROUP_EDGES, GROUP_NODES } from '../contract.mjs';
import { groupUnfit } from '../device-fit.mjs';
import type { Core } from '../core.mjs';

/**
 * Refuse an add the device cannot hold (round 138): with a renderer
 * mounted, the capacity each group would grow to is checked against the
 * device's limits and the widest column the renderer allocates for that
 * group, and a `GpuUnfitError` is thrown **before anything is added** —
 * so the store, the ids and the events are exactly as they were.  No-op
 * headless, and before a mount's device is in hand (the renderer's own
 * init runs the same check against whatever the store then holds, and
 * rejects `cy.ready` with the same error).
 *
 * @param core — the instance being added to
 * @param what — the calling method, for the message (`'cy.add()'`)
 * @param nodes — nodes the call would add
 * @param edges — edges the call would add
 * @param freedNodes — node slots a removal ahead of the add frees
 * @param freedEdges — edge slots a removal ahead of the add frees
 * @throws GpuUnfitError when either group would outgrow the device
 */
export function _assertGpuFit(
  core: Core,
  what: string,
  nodes: number,
  edges: number,
  freedNodes: number = 0,
  freedEdges: number = 0,
): void {
  const fit = core._gpuFit;

  if (fit == null) {
    return;
  }

  const store = core._store;

  for (const [group, adding, freeing, widest] of [
    [GROUP_NODES, nodes, freedNodes, fit.nodes],
    [GROUP_EDGES, edges, freedEdges, fit.edges],
  ] as const) {
    if (adding <= 0) {
      continue;
    }

    const { highWater, capacity } = store
      .table(group)
      .growthFor(adding, freeing);
    const reason = groupUnfit(group, highWater, capacity, widest, fit.limits);

    if (reason != null) {
      throw new GpuUnfitError(
        `${what}: adding ${adding} ${group} would ${reason}; nothing was ` +
          `added`,
      );
    }
  }
}
