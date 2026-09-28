/*
The headless GPU force host (round 131.4): the device integrator
(`gpu-force.mts`) driven with no renderer — `cytoscape/headless-gpu`'s
host for an explicit force `executor: 'gpu'` (Deno's native WebGPU, a
compute-only server), and the full build's for an unmounted instance.

The renderer drives `GpuForceRuntime` from its frame loop: poll, encode
ahead of the cull pass, submit, and let vsync pace the batches.  Here
there is no frame, so the host runs its own **async** loop:

  encode (into `silentTarget()`) → submit →
  await device.queue.onSubmittedWorkDone() → pollConvergence() →
  nextBatch → encode …

The await is not optional.  `pollConvergence` maps a staging buffer
asynchronously and `converged()`/`idle()` only move in its continuation;
a synchronous loop would never let that continuation run, and would
starve the displacement copy behind `dispInFlight` besides — the batch's
max would never reach the staging buffer.  (A zero readback reads as
convergence: the round-118/119 class of defect.)

`nextBatch`'s `behind` input is the renderer's frame-skip signal, and is
never true here — so the batch grows by doubling until the price cap
(`BATCH_FRAME_BUDGET_MS` of measured device time) or `MAX_BATCH` holds
it, never by skip-driven backoff.  Stated so nobody expects the
renderer's behaviour.

Lifecycle, and what makes it safe: `startForce` answers a runtime proxy
at once (the worker host's deferred proxy, 129.2, is the precedent) and
acquires the device through the GPU registry; the loop starts when the
runtime exists.  An infinite run (118.3) parks the loop when `idle()`;
`wakeForce()` restarts it (the layout's `fl.current.wake` fires on a
reheat, a moved node, a topology change).  `finishForce()` sets the
`stopped` flag before `destroy()`, and every continuation checks it
first, so a pending await never encodes on a destroyed run.  `active()`
is what the core's compaction guard reads (`core/batching.mts`): a slot
compaction under a live run would remap `inputs.slots` beneath the
settle.
*/

import { GpuForceRuntime, nextBatch } from './gpu-force.mjs';
import { gpuRuntime } from '../algorithms/gpu-registry.mjs';
import type { Core } from '../core.mjs';
import type {
  ForceHostLike,
  ForceInputs,
  ForceRuntimeLike,
} from '../layout/force-host.mjs';

/** One run's device state, behind the proxy the layout holds. */
interface HeadlessRun {
  /** the runtime, once the device is in hand */
  rt: GpuForceRuntime | null;
  device: GPUDevice | null;
  /** acquisition failed: the run ends, and says why */
  failed: Error | null;
  /** finishForce() ran: nothing encodes after this */
  stopped: boolean;
  /** the loop is between iterations (an await is pending) */
  looping: boolean;
  /** the device's runtime answered once acquisition resolved */
  ready: Promise<void>;
  /** the run's `stepsPerFrame`, the batch floor */
  base: number;
  batch: number;
  pricedMs: number;
  pricedBatch: number;
}

/** The monotonic clock, where the platform has one. */
const now = (): number => globalThis.performance?.now() ?? Date.now();

/**
 * The compute-only host for the GPU force integrator (131.4).
 */
export class HeadlessForceHost implements ForceHostLike {
  private run: HeadlessRun | null = null;
  private readonly acquire: () => Promise<GPUDevice>;
  private readonly onError: (message: string) => void;

  /**
   * @param acquire — resolves the compute device (the GPU registry's
   *   shared one); a rejection ends the run through `onError`
   * @param onError — reports an acquisition failure (the layout's run
   *   then settles nothing and closes, as a worker failure does)
   */
  constructor(
    acquire: () => Promise<GPUDevice>,
    onError: (message: string) => void,
  ) {
    this.acquire = acquire;
    this.onError = onError;
  }

  /**
   * True while a run holds the sim (the core's compaction guard).
   *
   * @returns whether a run is open and not finished
   */
  active(): boolean {
    const run = this.run;

    return run != null && !run.stopped && run.failed == null;
  }

  /**
   * Start a run: a proxy now, the device and the loop when acquisition
   * resolves.  `present` is ignored — there is nothing to present into;
   * every headless run is silent (87.2's non-presenting semantics).
   *
   * @param inputs — the compacted simulation
   * @param stepsPerFrame — the batch floor
   * @returns the runtime proxy, or null while another run is open
   */
  startForce(
    inputs: ForceInputs,
    stepsPerFrame: number,
    present?: boolean,
  ): ForceRuntimeLike | null {
    void present;

    if (this.run != null) {
      return null;
    }

    const base = Math.max(1, stepsPerFrame);
    const run: HeadlessRun = {
      rt: null,
      device: null,
      failed: null,
      stopped: false,
      looping: false,
      ready: Promise.resolve(),
      base,
      batch: base,
      pricedMs: 0,
      pricedBatch: 0,
    };

    this.run = run;
    run.ready = this.acquire().then(
      (device) => {
        if (run.stopped) {
          return;
        }

        run.device = device;
        run.rt = new GpuForceRuntime(device, inputs);
        void this.loop(run);
      },
      (err: unknown) => {
        run.failed = err instanceof Error ? err : new Error(String(err));

        // the layout's readback rejects and its run closes without a
        // finishForce(), so the slot is released here
        if (this.run === run) {
          this.run = null;
        }

        if (!run.stopped) {
          this.onError(run.failed.message);
        }
      },
    );

    return {
      // an acquisition failure ends the run: the layout's poller then
      // asks for the readback, which rejects, and the run closes
      converged: () => run.failed != null || (run.rt?.converged() ?? false),
      idle: () => run.rt?.idle() ?? false,
      // before the device exists the run has not cooled at all (it
      // starts at alpha 1), so an early reheat has nothing to restore
      reheat: (alpha?: number) => run.rt?.reheat(alpha),
      // before the device exists the inputs are what the runtime will
      // upload, so a write there lands
      setPosition: (i: number, x: number, y: number) => {
        if (run.rt != null) {
          run.rt.setPosition(i, x, y);
        } else {
          inputs.positions[i * 2] = x;
          inputs.positions[i * 2 + 1] = y;
        }
      },
      setPinned: (i: number, pinned: boolean) => {
        if (run.rt != null) {
          run.rt.setPinned(i, pinned);
        } else {
          inputs.pinned[i] = pinned ? 1 : 0;
        }
      },
      readPositions: async () => {
        await run.ready;

        if (run.failed != null) {
          throw run.failed;
        }

        return (run.rt as GpuForceRuntime).readPositions();
      },
    };
  }

  /** Release the run after its readback: stop the loop, then destroy. */
  finishForce(): void {
    const run = this.run;

    if (run == null) {
      return;
    }

    // the flag first: a continuation pending on the device checks it
    // before it touches the runtime
    run.stopped = true;
    run.rt?.destroy();
    this.run = null;
  }

  /** Restart a parked loop (an infinite run's reheat, a moved node). */
  wakeForce(): void {
    const run = this.run;

    if (run != null && run.rt != null && !run.looping && !run.stopped) {
      void this.loop(run);
    }
  }

  /**
   * The async tick loop: one batch per await, until the run converges,
   * parks idle, or is finished.
   */
  private async loop(run: HeadlessRun): Promise<void> {
    run.looping = true;

    try {
      const rt = run.rt as GpuForceRuntime;
      const device = run.device as GPUDevice;

      while (!run.stopped && !rt.converged() && !rt.idle()) {
        run.batch = nextBatch(
          run.batch,
          run.base,
          false,
          run.pricedMs,
          run.pricedBatch,
        );

        const encoder = device.createCommandEncoder({
          label: 'cy-gpu:force-headless',
        });

        rt.encode(encoder, rt.silentTarget(), run.batch);

        const submittedAt = now();

        device.queue.submit([encoder.finish()]);
        await device.queue.onSubmittedWorkDone();

        if (run.stopped) {
          return;
        }

        run.pricedMs = now() - submittedAt;
        run.pricedBatch = run.batch;
        rt.pollConvergence();
      }
    } finally {
      run.looping = false;
    }
  }
}

/**
 * The `forceHost` capability (`factory.mts`'s `CoreCaps`): the instance's
 * headless host, made on first use and kept on the core so the
 * compaction guard can ask it.  Null where the build registered no GPU
 * runtime or `navigator.gpu` is absent — the layout's explicit `'gpu'`
 * then throws at start, as it always has.
 *
 * @param cy — the instance whose force layout asks
 * @returns the host, or null
 */
export const headlessForceHost = (cy: Core): HeadlessForceHost | null => {
  const rt = gpuRuntime();

  if (rt == null || !rt.supported()) {
    return null;
  }

  if (cy._forceHost == null) {
    cy._forceHost = new HeadlessForceHost(
      async () => (await rt.acquire()).device,
      (message) => {
        cy.emit({ type: 'error' }, [`force layout: ${message}`]);
      },
    );
  }

  return cy._forceHost as HeadlessForceHost;
};
