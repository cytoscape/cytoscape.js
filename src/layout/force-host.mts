/*
The force layout's device-host seam (round 129.2; its own module since
131.1): what a run hands the GPU integrator and what the layout drives
while one is on a device.  Types only, and in the layout tier rather than
beside the integrator (`gpu/gpu-force.mts`) so that the layout's value
graph never reaches the device code — a headless build (131) walks
`layout/` and must not find `gpu/` or `render/` at the end of an import.
Implemented by the same-thread renderer, the worker host's proxy
(`render/worker-renderer.mts`) and the headless GPU host
(`gpu/headless-force-host.mts`).
*/

import type { ForceExtents, ForceParams } from './force-sim.mjs';

export interface ForceInputs {
  n: number;
  edges: Uint32Array;
  edgeLength: Float32Array;
  positions: Float32Array;
  pinned: Uint8Array;
  /** per-node gravity anchors, 2n interleaved (59.2) */
  anchors: Float32Array;
  /** per-node boxes the repulsion keeps apart (116.1), or null for
   * the point sim — the CPU sim's `extents` */
  extents?: ForceExtents | null;
  /** sim index → node slot (the publish map) */
  slots: number[];
  params: ForceParams;
  cutoff: number;
  /** the fixed grid frame for the whole run */
  frame: { x: number; y: number; w: number; h: number };
  /** the run has no end of its own (118.3): `converged()` is never
   * true, `idle()` says when encoding would move nothing */
  infinite?: boolean;
}

/**
 * What the force layout drives while a run is on a device, whichever
 * host owns it (129.2): the GPU runtime itself on the same-thread host,
 * or the worker host's proxy of one.
 */
export interface ForceRuntimeLike {
  /** the run has ended (never true for an infinite run) */
  converged(): boolean;
  /** an infinite run is at rest and encoding would move nothing */
  idle(): boolean;
  /** restore alpha (a drag, a moved node, `layout.reheat()`) */
  reheat(alpha?: number): void;
  /** move one sim node (a drag under an infinite run) */
  setPosition(i: number, x: number, y: number): void;
  /** pin or release one sim node */
  setPinned(i: number, pinned: boolean): void;
  /** the one readback: the final positions, sim-indexed */
  readPositions(): Promise<Float32Array>;
}

/**
 * What the force layout asks of a renderer that can host the integrator
 * (129.2): the same three verbs on the same-thread renderer and the
 * worker host's proxy.
 */
export interface ForceHostLike {
  /** start a run, or null where none can start (not ready, one open) */
  startForce(
    inputs: ForceInputs,
    stepsPerFrame: number,
    present?: boolean,
  ): ForceRuntimeLike | null;
  /** release the run after its readback */
  finishForce(): void;
  /** ask for a frame so an idle infinite run's reheat lands */
  wakeForce(): void;
}
