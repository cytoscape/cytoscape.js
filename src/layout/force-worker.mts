/*
The force simulation in a worker — the worker side (round 129.3).

The CPU sim is the executor every compound graph, every constrained
run, every page without an adapter and every explicit `executor:
'cpu'` takes, and its settle-then-land loop runs to convergence
synchronously: 12.8 s of held main thread on ndex-x-large (item 51).
This module is `ForceSim` itself, run inside a worker that loaded the
same bundle — the render worker's mechanism (86.3), not a stringified
kernel, because the sim is a class over `OverlapGrid` and the
constraint projection and the artifact carries all three unchanged.
So the same code runs on both sides by construction, and a run on the
worker answers the trajectory the in-thread sim answers, bit for bit.

The protocol, kept small: `start` carries one `ForceSimInputs` (a
structured clone — the layout keeps its arrays), then the run ticks
here.  A run nobody watches steps in time-boxed chunks (about 8 ms of
stepping, then a yield so a `stop` can land) and answers one `done`
with the final positions transferred; a live run (`animateLive`,
`infinite`) steps `stepsPerFrame` per ~16 ms and posts a `tick` per
frame with a copy of the positions transferred, sleeping when an
infinite run is idle until a `wake` / `reheat` / `position` arrives —
the in-thread loop's shape, message for verb.  The bundle exposes the
entry as `cytoscape.__runForceSimWorker__`; the spawn bootstrap
(`force-remote.mts`) loads the bundle in the worker and calls it.
*/

import { ForceSim } from './force-sim.mjs';
import type { ForceSimInputs } from './force-sim.mjs';

/** Main → worker. */
export type ForceWorkerRequest =
  | { type: 'ping'; id: number }
  | {
      type: 'start';
      id: number;
      inputs: ForceSimInputs;
      live: boolean;
      stepsPerFrame: number;
    }
  | { type: 'position'; id: number; i: number; x: number; y: number }
  | { type: 'pinned'; id: number; i: number; pinned: boolean }
  | { type: 'reheat'; id: number; alpha: number | undefined }
  | { type: 'wake'; id: number }
  | { type: 'stop'; id: number };

/** Worker → main. */
export type ForceWorkerReply =
  | { type: 'pong'; id: number }
  | {
      type: 'tick';
      id: number;
      positions: Float32Array;
      converged: boolean;
      idle: boolean;
      iteration: number;
    }
  | { type: 'state'; id: number; converged: boolean; idle: boolean }
  | { type: 'done'; id: number; positions: Float32Array; iteration: number }
  | { type: 'error'; id: number; message: string };

/** The port the loop talks through — Node's parentPort or the
 * browser's `self`, adapted to one shape. */
export interface ForceWorkerPort {
  on(handler: (msg: ForceWorkerRequest) => void): void;
  post(msg: ForceWorkerReply, transfer?: ArrayBuffer[]): void;
}

/** a chunk of stepping between yields for a run nobody watches: long
 * enough that the yield is not the cost, short enough that a `stop`
 * lands within a frame */
const CHUNK_MS = 8;
/** the live cadence: one tick per animation frame at 60 Hz */
const FRAME_MS = 16;

/** Adapt the worker global we were evaluated on to `ForceWorkerPort`. */
const detectPort = (): ForceWorkerPort => {
  const proc = (
    globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }
  ).process;

  if (proc != null && typeof proc.getBuiltinModule === 'function') {
    const threads = proc.getBuiltinModule('node:worker_threads') as {
      parentPort: {
        on(event: 'message', h: (msg: ForceWorkerRequest) => void): void;
        postMessage(msg: ForceWorkerReply, transfer?: ArrayBuffer[]): void;
      } | null;
    } | null;

    if (threads?.parentPort != null) {
      const port = threads.parentPort;

      return {
        on: (h) => port.on('message', h),
        post: (m, t) => port.postMessage(m, t),
      };
    }
  }

  const self = globalThis as unknown as {
    addEventListener(
      type: 'message',
      h: (e: { data: ForceWorkerRequest }) => void,
    ): void;
    postMessage(msg: ForceWorkerReply, transfer?: ArrayBuffer[]): void;
  };

  return {
    on: (h) => self.addEventListener('message', (e) => h(e.data)),
    post: (m, t) => self.postMessage(m, t ?? []),
  };
};

/**
 * Run the force sim worker's message loop.  One run at a time: a
 * `start` while a run is open answers an error for the new id.
 *
 * @param port — the adapted port (defaults to the worker global's)
 * @internal the spawn bootstrap's entry, never consumer API — kept out
 *   of the shipped declaration like the render worker's
 */
export function runForceSimWorker(port: ForceWorkerPort = detectPort()): void {
  let run: {
    id: number;
    sim: ForceSim;
    live: boolean;
    infinite: boolean;
    stepsPerFrame: number;
    stopped: boolean;
    scheduled: boolean;
    lastIdle: boolean;
  } | null = null;

  const now = (): number => performance.now();

  const finish = (): void => {
    if (run == null) {
      return;
    }

    const { id, sim } = run;
    const positions = Float32Array.from(sim.positions);

    run = null;
    port.post({ type: 'done', id, positions, iteration: sim.iteration }, [
      positions.buffer as ArrayBuffer,
    ]);
  };

  const frame = (): void => {
    if (run == null) {
      return;
    }

    run.scheduled = false;

    const { sim } = run;

    if (run.stopped || sim.converged()) {
      finish();

      return;
    }

    if (run.live) {
      // an infinite run at rest sleeps until a verb wakes it (118.3)
      if (run.infinite && sim.idle()) {
        if (!run.lastIdle) {
          run.lastIdle = true;
          port.post({
            type: 'state',
            id: run.id,
            converged: false,
            idle: true,
          });
        }

        return;
      }

      run.lastIdle = false;
      sim.step(run.stepsPerFrame);

      const positions = Float32Array.from(sim.positions);

      port.post(
        {
          type: 'tick',
          id: run.id,
          positions,
          converged: sim.converged(),
          idle: sim.idle(),
          iteration: sim.iteration,
        },
        [positions.buffer as ArrayBuffer],
      );
      schedule();

      return;
    }

    // a run nobody watches: step in a time-boxed chunk, then yield so
    // a `stop` posted meanwhile is read before the next chunk
    const t0 = now();

    do {
      sim.step(50);
    } while (!sim.converged() && !run.stopped && now() - t0 < CHUNK_MS);

    schedule();
  };

  const schedule = (): void => {
    if (run == null || run.scheduled) {
      return;
    }

    run.scheduled = true;
    setTimeout(frame, run.live ? FRAME_MS : 0);
  };

  port.on((msg) => {
    if (msg.type === 'ping') {
      port.post({ type: 'pong', id: msg.id });

      return;
    }

    if (msg.type === 'start') {
      if (run != null) {
        port.post({
          type: 'error',
          id: msg.id,
          message: 'the force sim worker already has a run open',
        });

        return;
      }

      try {
        const sim = new ForceSim(msg.inputs);

        // the seed is constraint-blind: project once before the first
        // tick, as the in-thread path does (85.2)
        if (msg.inputs.constraints != null) {
          sim.project();
        }

        run = {
          id: msg.id,
          sim,
          live: msg.live,
          infinite: msg.inputs.infinite === true,
          stepsPerFrame: msg.stepsPerFrame,
          stopped: false,
          scheduled: false,
          lastIdle: false,
        };
        schedule();
      } catch (err) {
        port.post({
          type: 'error',
          id: msg.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }

      return;
    }

    // every other verb names the open run; a stale id is ignored
    if (run == null || run.id !== msg.id) {
      return;
    }

    if (msg.type === 'position') {
      run.sim.positions[msg.i * 2] = msg.x;
      run.sim.positions[msg.i * 2 + 1] = msg.y;
    } else if (msg.type === 'pinned') {
      run.sim.setPinned(msg.i, msg.pinned);
    } else if (msg.type === 'reheat') {
      run.sim.reheat(msg.alpha);
    } else if (msg.type === 'stop') {
      run.stopped = true;
    }

    // a wake, a reheat, a moved node or a stop each want a frame
    schedule();
  });
}
