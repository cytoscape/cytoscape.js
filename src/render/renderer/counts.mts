// The renderer's viewport counts (round 75.6): the scene cull's visible
// instance counts, read back from the indirect draw args.

import { BUFFER_USAGE, MAP_MODE } from '../../gpu/webgpu-constants.mjs';
import type { CulledGroup } from '../cull.mjs';
import type { ViewportCounts } from '../../public-types.mjs';
import type { Renderer } from '../renderer.mjs';

/*
The scan dispatch writes each culled group's `instanceCount` — the frame's
visible survivors — into word 1 (byte 4) of its indirect args, on the
device, where only the indirect draw reads it.  A count is therefore a
readback, and the API is async because of it: the four element groups'
words (node + parent, straight + curved edge — disjoint by their cull
predicates) are copied into one 16-byte staging buffer *after* the cull
pass in the same submission, so the numbers are exactly that frame's,
then mapped.  Glyph streams are left out: their counts are glyph
instances, not labels.

A group the frame did not dispatch (no parents, no edges) left stale args
behind, so it reads as 0: `CulledGroup.encodes` is compared before and
after the cull pass.  Requests coalesce — every caller waiting when a
copy is encoded resolves from it; a request arriving while one is in
flight waits for the next frame's — and a clean scene gets a frame
scheduled (render-on-dirty stays intact otherwise).  Destroy and a failed
map resolve null, `picking.mts`'s patterns.
*/

/** Which groups were counted, and the requests one copy answers. */
export interface CountJob {
  live: boolean[];
  waiters: ((counts: ViewportCounts | null) => void)[];
}

/** The four element groups whose `encodes` a frame's copy compares. */
export interface CountMarks {
  groups: CulledGroup[];
  before: number[];
}

/**
 * Queue a request and make sure a scene frame comes: resolves with the
 * visible node and edge counts of the next frame drawn, or null if the
 * renderer is destroyed (or the device lost) first.
 */
export function viewportCounts(rd: Renderer): Promise<ViewportCounts | null> {
  if (rd.destroyed) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    rd.countWaiters.push(resolve);
    rd.requestRender();
  });
}

/**
 * Before the scene cull pass: note each element group's dispatch count,
 * when a request is waiting and no readback holds the staging buffer.
 */
export function markCounts(rd: Renderer): CountMarks | null {
  const cull = rd.sceneCull;

  if (rd.countWaiters.length === 0 || rd.countBusy || cull == null) {
    return null;
  }

  const groups = [cull.node, cull.parent, cull.edge, cull.curved];

  return { groups, before: groups.map((g) => g.encodes) };
}

/**
 * After the scene cull pass, outside any pass: copy each dispatched
 * group's `instanceCount` word into the staging buffer, and take the
 * waiting requests with it.
 */
export function encodeCountCopy(
  rd: Renderer,
  encoder: GPUCommandEncoder,
  marks: CountMarks | null,
): CountJob | null {
  const device = rd.device;

  if (marks == null || device == null) {
    return null;
  }

  rd.countStaging ??= device.createBuffer({
    label: 'cy-gpu:viewport-counts',
    size: 16,
    usage: BUFFER_USAGE.MAP_READ | BUFFER_USAGE.COPY_DST,
  });

  const live = marks.groups.map((g, i) => g.encodes !== marks.before[i]);

  marks.groups.forEach((g, i) => {
    if (live[i]) {
      // word 1 of the args: instanceCount (word 0 is indexCount)
      encoder.copyBufferToBuffer(g.indirect, 4, rd.countStaging!, i * 4, 4);
    }
  });

  const waiters = rd.countWaiters;

  rd.countWaiters = [];
  rd.countBusy = true;

  return { live, waiters };
}

/** After the submit: map the staging buffer and resolve the job's requests. */
export function finishCounts(rd: Renderer, job: CountJob | null): void {
  const staging = rd.countStaging;

  if (job == null || staging == null) {
    return;
  }

  const settle = (counts: ViewportCounts | null): void => {
    rd.countBusy = false;

    for (const resolve of job.waiters) {
      resolve(counts);
    }

    // requests that arrived while this one was in flight
    if (!rd.destroyed && rd.countWaiters.length > 0) {
      rd.requestRender();
    }
  };

  staging.mapAsync(MAP_MODE.READ).then(
    () => {
      const words = new Uint32Array(staging.getMappedRange().slice(0));

      staging.unmap();

      if (rd.destroyed) {
        settle(null);

        return;
      }

      const word = (i: number): number => (job.live[i] ? words[i] : 0);

      settle({ nodes: word(0) + word(1), edges: word(2) + word(3) });
    },
    () => settle(null), // destroyed or lost under the map
  );
}

/** Teardown: every waiting request resolves null (an in-flight map
 * fails with the device and resolves its own). */
export function destroyCounts(rd: Renderer): void {
  const waiters = rd.countWaiters;

  rd.countWaiters = [];

  for (const resolve of waiters) {
    resolve(null);
  }

  rd.countStaging?.destroy();
  rd.countStaging = null;
}
