/*
The force simulation in a worker — the main-thread side (round 129.3):
the spawn, the singleton and the run handle the layout drives.

One sim worker per page or process, spawned lazily from the artifact's
own URL (`SELF_URL`, the render worker's mechanism) and kept for the
session: the worker pays the bundle's parse once (~50–100 ms), so it
is never spawned per run.  A run is one `start` message; the handle
mirrors the worker's converged / idle state from its ticks, posts the
verbs an infinite run takes (a moved node, a pin, a reheat, a wake),
lands each live tick's positions through the layout's own write-back
and resolves `done` with the final positions transferred.  One run at
a time: a second concurrent force run while the worker is busy runs
in-thread, as `start` answering null tells the layout.

Node workers are `unref()`ed while idle and `ref()`ed for the span of
a run (the round-74 lesson: an unref'ed worker does not keep the loop
alive while the main thread awaits its reply); `_resetForceWorker()`
is the test hook.  `forceWorkerSupported()` is the sync half of
availability — a URL to load and a platform to spawn on — and the
spawn's ping is the async half, so a bundle that cannot evaluate in a
worker (a CSP refusal, an artifact served without a URL) fails
acquisition loudly rather than hanging a run.
*/

import { SELF_URL } from '../util/self-url.mjs';
import type { ForceSimInputs } from './force-sim.mjs';
import type { ForceWorkerReply, ForceWorkerRequest } from './force-worker.mjs';

/** One worker as the singleton drives it, whichever platform spawned it. */
interface SimWorker {
  post(msg: ForceWorkerRequest, transfer?: ArrayBuffer[]): void;
  onMessage(handler: (msg: ForceWorkerReply) => void): void;
  onError(handler: (err: Error) => void): void;
  ref(): void;
  unref(): void;
  terminate(): void;
}

/** A run on the worker, as the layout drives it. */
export interface RemoteSimRun {
  /** the run has ended in the worker (never for an infinite run) */
  converged(): boolean;
  /** an infinite run is at rest in the worker */
  idle(): boolean;
  setPosition(i: number, x: number, y: number): void;
  setPinned(i: number, pinned: boolean): void;
  reheat(alpha?: number): void;
  /** resume an idle infinite run */
  wake(): void;
  /** end the run at its next frame; `done` resolves with the positions
   * as they stand */
  stop(): void;
  /** a live run's per-frame positions (sim-indexed), as they land */
  onTick(handler: (positions: Float32Array) => void): void;
  /** the final positions, sim-indexed; rejects when the worker failed
   * the run or was reset under it */
  done: Promise<Float32Array>;
}

/** The singleton as a run borrows it. */
export interface ForceWorker {
  /**
   * Open a run.
   *
   * @param inputs — the sim's inputs, cloned into the worker
   * @param live — tick per frame and post each frame's positions
   * @param stepsPerFrame — iterations per live tick
   * @returns the run, or null while another run is open
   */
  start(
    inputs: ForceSimInputs,
    live: boolean,
    stepsPerFrame: number,
  ): RemoteSimRun | null;
  /** a run is open */
  readonly busy: boolean;
}

/** The counters `_forceWorkerStats()` reports. */
export interface ForceWorkerStats {
  /** workers spawned since the last reset */
  spawns: number;
  /** runs completed (done or stopped) */
  runs: number;
  /** live ticks landed */
  ticks: number;
}

const stats: ForceWorkerStats = { spawns: 0, runs: 0, ticks: 0 };

/** the source tree's loader (test setup only): given the entry's URL
 * as a JSON string literal, the expression that imports it inside a
 * Node worker; null loads the URL directly, which is what a bundle
 * needs */
let sourceLoader: ((url: string) => string) | null = null;

let cached: Promise<ForceWorker> | null = null;
let live: { terminate(): void } | null = null;

interface NodeWorkerThreads {
  Worker: new (
    src: string,
    options: { eval: boolean },
  ) => {
    postMessage(msg: unknown, transfer?: ArrayBuffer[]): void;
    on(event: string, handler: (arg: never) => void): void;
    ref(): void;
    unref(): void;
    terminate(): Promise<number>;
  };
}

const nodeThreads = (): NodeWorkerThreads | null => {
  const proc = (
    globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } }
  ).process;

  if (proc == null || typeof proc.getBuiltinModule !== 'function') {
    return null;
  }

  try {
    return (
      (proc.getBuiltinModule('node:worker_threads') as NodeWorkerThreads) ??
      null
    );
  } catch {
    return null;
  }
};

const browserWorkers = (): boolean => {
  const g = globalThis as {
    Worker?: unknown;
    Blob?: unknown;
    URL?: { createObjectURL?: unknown };
    document?: unknown;
  };

  return (
    typeof g.Worker === 'function' &&
    typeof g.Blob === 'function' &&
    g.URL != null &&
    typeof g.URL.createObjectURL === 'function' &&
    g.document != null
  );
};

/**
 * Whether a sim worker could be spawned here: the artifact's URL is
 * known and a worker platform exists.  The spawn's ping is the async
 * half (a bundle that fails to evaluate in the worker).
 *
 * @returns true when a worker could be constructed
 */
export const forceWorkerSupported = (): boolean =>
  SELF_URL != null && (nodeThreads() != null || browserWorkers());

/** The bootstrap a worker evaluates: load the artifact, call the entry. */
const bootstrap = (node: boolean): string => {
  const url = JSON.stringify((SELF_URL as { url: string }).url);

  if (node || (SELF_URL as { module: boolean }).module) {
    // buffer messages until the import lands, then replay them — the
    // browser's queue only; Node's parent port queues until a
    // listener attaches
    if (node) {
      // a bundle loads by its URL; the source tree (a `.mts` entry —
      // the repo's own dev mode) loads through the loader the test
      // setup installs, since a worker thread inherits the loader's
      // hooks but not its `.mjs` → `.mts` aliasing (measured
      // 2026-09-18) and the library itself names no loader
      const load = sourceLoader != null ? sourceLoader(url) : `import(${url})`;

      return `${load}.then((m) => { (m.default ?? m).__runForceSimWorker__(); });`;
    }

    return (
      'const q=[];self.onmessage=(e)=>q.push(e);' +
      `import(${url}).then((m)=>{` +
      '(m.default??m).__runForceSimWorker__();' +
      'self.onmessage=null;' +
      'for(const e of q){self.dispatchEvent(new MessageEvent("message",{data:e.data}));}' +
      '});'
    );
  }

  return `importScripts(${url});self.cytoscape.__runForceSimWorker__();`;
};

const spawnWorker = (): SimWorker => {
  const threads = nodeThreads();

  if (threads != null) {
    const w = new threads.Worker(bootstrap(true), { eval: true });

    return {
      post: (msg, transfer) => w.postMessage(msg, transfer),
      onMessage: (handler) => {
        w.on('message', handler as (arg: never) => void);
        w.unref();
      },
      onError: (handler) => {
        w.on('error', handler as (arg: never) => void);
        w.unref();
      },
      ref: () => w.ref(),
      unref: () => w.unref(),
      terminate: () => {
        void w.terminate();
      },
    };
  }

  const module = (SELF_URL as { module: boolean }).module;
  const url = URL.createObjectURL(
    new Blob([bootstrap(false)], { type: 'text/javascript' }),
  );
  const w = new Worker(url, module ? { type: 'module' } : undefined);

  return {
    post: (msg, transfer) => w.postMessage(msg, transfer ?? []),
    onMessage: (handler) => {
      w.onmessage = (e: MessageEvent<ForceWorkerReply>) => handler(e.data);
    },
    onError: (handler) => {
      w.onerror = (e: ErrorEvent) =>
        handler(new Error(e.message || 'worker error'));
    },
    ref: () => undefined,
    unref: () => undefined,
    terminate: () => w.terminate(),
  };
};

/**
 * Acquire (or reuse) the sim worker.  Cached across calls; a spawn or
 * ping failure rejects and is not cached, so a later call retries.
 *
 * @returns the worker
 * @throws if no worker can be constructed here, or the artifact fails
 *   to evaluate in one (a CSP refusal, no URL to load)
 */
export const acquireForceWorker = (): Promise<ForceWorker> => {
  if (cached == null) {
    cached = (async () => {
      if (!forceWorkerSupported()) {
        throw new Error(
          "force layout: executor 'workers' needs a worker platform (Node's " +
            'worker_threads, or a browser page with Worker and Blob) and a ' +
            'bundle loaded from a URL, neither of which this environment ' +
            "has — use 'cpu' or 'auto'",
        );
      }

      const w = spawnWorker();
      let nextId = 1;
      let current: {
        id: number;
        resolve: (positions: Float32Array) => void;
        reject: (err: Error) => void;
        onTick: ((positions: Float32Array) => void) | null;
        state: { converged: boolean; idle: boolean };
      } | null = null;
      let pong: ((ok: boolean, message?: string) => void) | null = null;

      const fail = (err: Error): void => {
        pong?.(false, err.message);
        pong = null;

        if (current != null) {
          const run = current;

          current = null;
          w.unref();
          run.reject(err);
        }
      };

      w.onMessage((msg) => {
        if (msg.type === 'pong') {
          pong?.(true);
          pong = null;

          return;
        }

        if (current == null || msg.id !== current.id) {
          return;
        }

        if (msg.type === 'tick') {
          current.state = { converged: msg.converged, idle: msg.idle };
          stats.ticks++;
          current.onTick?.(msg.positions);
        } else if (msg.type === 'state') {
          current.state = { converged: msg.converged, idle: msg.idle };
        } else if (msg.type === 'done') {
          const run = current;

          current = null;
          stats.runs++;
          w.unref();
          run.state = { converged: true, idle: true };
          run.resolve(msg.positions);
        } else if (msg.type === 'error') {
          fail(new Error(`the force sim worker failed: ${msg.message}`));
        }
      });
      w.onError((err) => fail(err));

      // the liveness probe: an artifact that does not evaluate in the
      // worker fails here, before any run depends on it
      w.ref();

      const ok = await new Promise<{ ok: boolean; message?: string }>(
        (resolve) => {
          pong = (ok, message) => resolve({ ok, message });
          w.post({ type: 'ping', id: nextId++ });
        },
      );

      w.unref();

      if (!ok.ok) {
        w.terminate();
        throw new Error(
          'the force sim worker failed to start' +
            (ok.message != null ? `: ${ok.message}` : ''),
        );
      }

      stats.spawns++;
      live = {
        terminate: () => {
          // a run open under a reset rejects, so the layout closes
          fail(new Error('the force sim worker was reset'));
          w.terminate();
        },
      };

      const worker: ForceWorker = {
        get busy() {
          return current != null;
        },
        start: (inputs, isLive, stepsPerFrame) => {
          if (current != null) {
            return null;
          }

          const id = nextId++;
          let resolve!: (positions: Float32Array) => void;
          let reject!: (err: Error) => void;
          const done = new Promise<Float32Array>((res, rej) => {
            resolve = res;
            reject = rej;
          });
          const run = {
            id,
            resolve,
            reject,
            onTick: null as ((positions: Float32Array) => void) | null,
            state: { converged: false, idle: false },
          };

          current = run;
          w.ref();
          w.post({ type: 'start', id, inputs, live: isLive, stepsPerFrame });

          return {
            converged: () => run.state.converged,
            idle: () => run.state.idle,
            setPosition: (i, x, y) => w.post({ type: 'position', id, i, x, y }),
            setPinned: (i, pinned) => w.post({ type: 'pinned', id, i, pinned }),
            reheat: (alpha) => w.post({ type: 'reheat', id, alpha }),
            wake: () => w.post({ type: 'wake', id }),
            stop: () => w.post({ type: 'stop', id }),
            onTick: (handler) => {
              run.onTick = handler;
            },
            done,
          };
        },
      };

      return worker;
    })();

    cached.catch(() => {
      cached = null;
    });
  }

  return cached;
};

/**
 * Test-setup hook: how a Node worker loads the entry when the library
 * runs from its source tree — the expression, given the entry URL as
 * a JSON string literal, that resolves to the entry module.  The
 * suites install tsx's in-worker registration here; a bundle needs
 * nothing (a `.mts` entry with no loader fails acquisition loudly,
 * which `'auto'` treats as no worker).
 *
 * @param loader — the loader, or null to load the URL directly
 */
export const _setForceWorkerLoader = (
  loader: ((url: string) => string) | null,
): void => {
  sourceLoader = loader;
};

/**
 * Test hook: terminate the sim worker and drop the cache so the next
 * run spawns afresh; a run open under the reset rejects.
 */
export const _resetForceWorker = (): void => {
  live?.terminate();
  live = null;
  cached = null;
};

/**
 * Test and benchmark hook: the worker's counters.
 *
 * @returns a copy of the counters
 */
export const _forceWorkerStats = (): ForceWorkerStats => ({ ...stats });
