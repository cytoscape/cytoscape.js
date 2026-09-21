// The force layout's live, worker and GPU executors (round 130 split),
// over the closures `runOnce` prepares.

import { ForceSim } from './force-sim.mjs';
import type { Core } from '../core.mjs';
import type { ForceHostLike, ForceRuntimeLike } from '../render/gpu-force.mjs';
import { acquireForceWorker } from './force-remote.mjs';
import type { ForceWorker, RemoteSimRun } from './force-remote.mjs';
import type { ForceSimInputs } from './force-sim.mjs';
import type { ForceLayoutImpl } from './force.mjs';

/**
 * The in-thread live loop (`animateLive`, `infinite`): the sim
 * streams positions to the store per frame — the watchable-layout
 * path.  An infinite run (118.3) sleeps once the sim is idle — no
 * frame is scheduled — and a wake (a drag, a moved node, a reheat, a
 * stop) schedules the next.
 *
 * @param sim — the in-thread sim
 * @param infinite — the run has no end of its own
 * @param stepsPerFrame — iterations per frame
 * @param simIndex — node slot → sim index
 * @param positions — the sim's positions (the caller's array)
 * @param writeBack — land the current positions in the store
 * @param settle — the end-of-run adjustment and landing
 * @returns a promise that resolves at the run's end
 */
export function runLive(
  fl: ForceLayoutImpl,
  sim: ForceSim,
  infinite: boolean,
  stepsPerFrame: number,
  simIndex: Map<number, number>,
  positions: Float32Array,
  writeBack: () => void,
  settle: (arr: Float32Array) => void,
): Promise<void> {
  const tick =
    typeof requestAnimationFrame !== 'undefined'
      ? (cb: () => void) => requestAnimationFrame(cb)
      : (cb: () => void) => setTimeout(cb, 16);

  return new Promise<void>((resolve) => {
    let scheduled = false;
    let done = false;
    const frame = (): void => {
      scheduled = false;

      if (done) {
        return;
      }

      if (fl.stopped || fl.restartWanted || sim.converged()) {
        done = true;

        if (!fl.cancelled) {
          settle(positions);
        }

        resolve();

        return;
      }

      if (infinite && sim.idle()) {
        return; // asleep until a wake
      }

      sim.step(stepsPerFrame);
      writeBack();
      schedule();
    };
    const schedule = (): void => {
      if (!scheduled && !done) {
        scheduled = true;
        tick(frame);
      }
    };

    fl.current = {
      indexOf: (slot) => simIndex.get(slot),
      setPosition: (i, x, y) => {
        positions[i * 2] = x;
        positions[i * 2 + 1] = y;
      },
      setPinned: (i, flag) => sim.setPinned(i, flag),
      reheat: (alpha) => sim.reheat(alpha),
      wake: schedule,
    };

    frame();
  });
}

/**
 * The CPU simulation on the sim worker (129.3): the inputs cross as
 * one clone, the worker ticks, a live run's frames land through the
 * layout's own write-back, and the final positions settle here.  The
 * worker's failure modes fall back in-thread rather than failing the
 * run — a layout run has no rejection path — with an `error` event on
 * the core when the executor was explicit.
 *
 * @param cy — the core
 * @param inputs — the sim's inputs
 * @param live — stream per frame
 * @param infinite — the run has no end of its own
 * @param stepsPerFrame — iterations per live tick
 * @param explicit — `executor: 'workers'` was asked for
 * @param simIndex — node slot → sim index
 * @param positions — the layout's positions (the settle's array)
 * @param writeBack — land `positions` in the store
 * @param settle — the end-of-run adjustment and landing
 * @param inThreadSim — the in-thread sim, for the fallback
 * @returns a promise that resolves at the run's end
 */
export async function runRemote(
  fl: ForceLayoutImpl,
  cy: Core,
  inputs: ForceSimInputs,
  live: boolean,
  infinite: boolean,
  stepsPerFrame: number,
  explicit: boolean,
  simIndex: Map<number, number>,
  positions: Float32Array,
  writeBack: () => void,
  settle: (arr: Float32Array) => void,
  inThreadSim: () => ForceSim,
): Promise<void> {
  let worker: ForceWorker | null = null;

  try {
    worker = await acquireForceWorker();
  } catch (err) {
    if (explicit) {
      cy.emit({ type: 'error' }, [
        `force layout: ${err instanceof Error ? err.message : String(err)}` +
          ' — the run continued in-thread',
      ]);
    }
  }

  // stopped or cancelled while the worker spawned: nothing ran, and
  // the positions stand where the seed put them
  if (fl.stopped) {
    if (!fl.cancelled) {
      settle(positions);
    }

    return;
  }

  const run: RemoteSimRun | null =
    worker == null ? null : worker.start(inputs, live, stepsPerFrame);

  if (run == null) {
    // no worker, or one busy with another run: in-thread, as before
    if (live) {
      return runLive(
        fl,
        inThreadSim(),
        infinite,
        stepsPerFrame,
        simIndex,
        positions,
        writeBack,
        settle,
      );
    }

    const cpuSim = inThreadSim();

    while (!cpuSim.converged() && !fl.stopped) {
      cpuSim.step(50);
    }

    if (!fl.cancelled) {
      settle(positions);
    }

    return;
  }

  fl.current = {
    indexOf: (slot) => simIndex.get(slot),
    setPosition: (i, x, y) => {
      positions[i * 2] = x;
      positions[i * 2 + 1] = y;
      run.setPosition(i, x, y);
    },
    setPinned: (i, flag) => run.setPinned(i, flag),
    reheat: (alpha) => run.reheat(alpha),
    // a wake after a stop or a topology change ends the run instead
    // (the in-thread frame's test, posted as the verb it is)
    wake: () => {
      if (fl.stopped || fl.restartWanted) {
        run.stop();
      } else {
        run.wake();
      }
    },
  };

  if (live) {
    run.onTick((frame) => {
      positions.set(frame);
      writeBack();

      if (fl.stopped || fl.restartWanted) {
        run.stop();
      }
    });
  }

  let final: Float32Array;

  try {
    final = await run.done;
  } catch (err) {
    // the worker failed or was reset under the run: the positions as
    // last seen stand, and the run closes
    if (explicit) {
      cy.emit({ type: 'error' }, [
        `force layout: ${err instanceof Error ? err.message : String(err)}`,
      ]);
    }

    final = positions;
  }

  positions.set(final);

  if (!fl.cancelled) {
    settle(positions);
  }
}

/** Poll the device sim to convergence, then the one settle readback. */
export function runGpu(
  fl: ForceLayoutImpl,
  runtime: ForceRuntimeLike,
  renderer: ForceHostLike,
  settle: (arr: Float32Array) => void,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const poll = (): void => {
      if (!fl.stopped && !fl.restartWanted && !runtime.converged()) {
        setTimeout(poll, 60);

        return;
      }

      runtime.readPositions().then(
        (finalPositions) => {
          // release the lease before the CPU write, so the settle
          // uploads through the normal dirty-span path — and so the
          // finisher's tween, under `animate`, takes a lease of its own
          renderer.finishForce();

          // a cancelled run (128) lands nothing: the wrapper restores
          // the snapshot once fl settles, after the lease is gone
          if (!fl.cancelled) {
            settle(finalPositions);
          }

          resolve();
        },
        () => {
          // the device went away under the run (a destroy mid-sim):
          // nothing to settle, and the run must still resolve
          resolve();
        },
      );
    };

    poll();
  });
}
