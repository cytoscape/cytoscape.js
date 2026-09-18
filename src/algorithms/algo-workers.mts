/*
The worker pool behind the `'workers'` executor (round 74.2): a lazy
module singleton of plain workers — Node `worker_threads` or browser
`Worker`s — that runs the per-source-parallel algorithm families
(Brandes betweenness, the closeness BFS, heat-kernel and RWR columns)
as contiguous source ranges over a structured-cloned snapshot, results
transferred back.

What the design buys and refuses, from the 74.1 measurement (amd
i9-9900K, 8 physical cores): weighted betweenness at n = 2048 through
8 workers is 12.2× the sequential reference warm and 7.2× cold
(spawn + first run), the per-worker clone of a 103 KB CSR is 0.21 ms
against 0.10 ms for a SharedArrayBuffer — so SAB (with the COOP/COEP
demand it puts on every embedder) buys 0.1 ms per run and is declined.

The worker entry travels as **source text, not a bundle chunk**: the
pool stringifies `algoWorkerBody`, wraps it in an environment preamble
and constructs Node workers with `eval: true` and browser workers from
a Blob URL — so the five single-file bundles stay single-file and no
bundler is asked to know about a worker.  The preamble defines a no-op
`__name` because tsx wraps closure creation in one (the AGENTS
hot-path lesson); `test/modules/algo-worker-body.mjs` is the tripwire
for any other helper a transpiler might sneak into the body.

Determinism, designed honestly (74's fact 5): the range partition is a
pure function of n — `rangeCount(n)`, never the pool size — and the
merge adds partials in range order, so the executor is bit-stable
across runs, machines and pool sizes.  The per-column families are
additionally bit-identical to `'cpu'` (each column is computed whole
by one worker with the reference's own operation order); betweenness
sums across sources, and grouping those sums by range gives a
different f64 rounding from the sequential reference — f64-tight
parity, not bits.  The determinism ladder callers read in
`executor.mts`: cpu > workers > gpu.

Lifecycle copies the GPU side (`algo-gpu.mts`): one pool per
page/process, acquired on first use, `_resetAlgoWorkers()` as the test
hook; Node workers are `unref()`ed so a pool never holds a process
open.  Runs are serialized over the pool — a worker holds one snapshot
at a time — which is also what keeps two instances' runs isolated.
*/

import { algoWorkerBody } from './algo-worker-body.mjs';
import type {
  AlgoWorkerReply,
  AlgoWorkerRequest,
  AlgoWorkerSnapshot,
} from './algo-worker-body.mjs';

/** The largest pool the executor ever spawns, whatever the core count:
 * 74.1 measured 4 → 8 workers at 1.3× (n = 2048) and 1.4× (n = 4096),
 * the diminishing half of the curve on an 8-core part. */
export const WORKERS_MAX = 8;

/** The fixed range count the partition uses — a function of n alone, so
 * a result never depends on how many workers happened to run it.  Sixty
 * four ranges keep an 8-worker pool balanced against skewed sources
 * (a range is one job; a worker that finishes early takes the next). */
const RANGES_MAX = 64;

/**
 * How many contiguous ranges a run of `n` sources is cut into — the
 * partition every executor pool size merges in the same order.
 *
 * @param n — the source (or column) count
 * @returns the range count, at most `RANGES_MAX` and never above n
 */
export const rangeCount = (n: number): number => Math.min(n, RANGES_MAX);

/**
 * The contiguous `[s0, s1)` ranges of a run, in merge order.
 *
 * @param n — the source (or column) count
 * @returns the ranges
 */
export const rangesOf = (n: number): [number, number][] => {
  const count = rangeCount(n);
  const out: [number, number][] = [];

  for (let r = 0; r < count; r++) {
    out.push([Math.floor((r * n) / count), Math.floor(((r + 1) * n) / count)]);
  }

  return out;
};

/** One worker as the pool drives it, whichever platform spawned it. */
interface PoolWorker {
  post(msg: unknown, transfer?: ArrayBuffer[]): void;
  onMessage(handler: (msg: AlgoWorkerReply) => void): void;
  onError(handler: (err: Error) => void): void;
  /** hold the process open while a request is in flight (Node) */
  ref(): void;
  /** let the process exit while the worker idles (Node) */
  unref(): void;
  terminate(): void;
}

/** What a run borrows: the workers plus the pool's run counters. */
export interface AlgoWorkers {
  /** how many workers the pool holds */
  readonly size: number;
  /**
   * Run one snapshot over every range of `n`, on every worker at once.
   *
   * @param snapshot — the run's inputs, cloned into each worker
   * @param n — the source (or column) count the ranges partition
   * @returns one partial per range, in range (merge) order
   */
  run(snapshot: AlgoWorkerSnapshot, n: number): Promise<Float64Array[]>;
}

/** The run counters `_algoWorkersStats()` reports — how a benchmark
 * row asserts it ran where its name says. */
export interface AlgoWorkersStats {
  /** pools spawned since the last reset */
  spawns: number;
  /** runs completed */
  runs: number;
  /** range jobs completed */
  jobs: number;
  /** workers in the live pool, 0 when none */
  workers: number;
}

const stats: AlgoWorkersStats = { spawns: 0, runs: 0, jobs: 0, workers: 0 };

let cached: Promise<AlgoWorkers> | null = null;
let live: { workers: PoolWorker[]; terminate(): void } | null = null;
let forcedSize: number | null = null;

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

/** Node's `worker_threads`, reached without an import so no bundler
 * has to resolve a `node:` specifier — `process.getBuiltinModule` is
 * Node ≥ 20.16 / 22.3; older Nodes answer null and run the CPU. */
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

/** Whether this is a browser page that can construct a Blob worker. */
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
 * Whether this environment can host the workers executor at all — the
 * sync half of availability (Node's `worker_threads` reachable, or a
 * browser page with `Worker` + `Blob`).  A `true` here does not promise
 * a pool: a CSP `worker-src` policy can refuse the Blob URL at
 * construction, which `acquireAlgoWorkers` surfaces async.
 *
 * @returns true when a worker could be constructed here
 */
export const algoWorkersSupported = (): boolean =>
  nodeThreads() != null || browserWorkers();

/**
 * The pool size the environment gets: one less than the parallelism
 * the platform reports (the main thread keeps a core), capped at
 * `WORKERS_MAX`, never below one.
 *
 * @returns the worker count a fresh pool spawns
 */
export const algoWorkersSize = (): number => {
  if (forcedSize != null) {
    return forcedSize;
  }

  let parallelism: number;
  const threads = nodeThreads();

  if (threads != null) {
    const proc = (
      globalThis as unknown as {
        process: { getBuiltinModule(id: string): unknown };
      }
    ).process;
    const os = proc.getBuiltinModule('node:os') as {
      availableParallelism?: () => number;
      cpus(): unknown[];
    };

    parallelism =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
  } else {
    parallelism =
      (globalThis as { navigator?: { hardwareConcurrency?: number } }).navigator
        ?.hardwareConcurrency ?? 4;
  }

  return Math.max(1, Math.min(WORKERS_MAX, parallelism - 1));
};

/**
 * The body as source text, wrapped for the platform's port — what a
 * worker evaluates.  Exported as the bundle's `__algoWorkerSource__`
 * so the module spec can evaluate it in a bare scope from each built
 * artifact (the self-contained claim's tripwire).
 *
 * @param node — true for the `worker_threads` preamble (the parent
 *   port through `process.getBuiltinModule`), false for the browser's
 *   `self`
 * @returns the worker's complete source
 */
export const _algoWorkerSource = (node: boolean): string => {
  const body = `(${algoWorkerBody.toString()})`;
  // the Node port comes through `process.getBuiltinModule`, not
  // `require`: an eval-mode worker inherits the process's `--input-type`,
  // and under `--input-type=module` its source is ESM, where `require`
  // does not exist (found 2026-09-18 by the soak's child-process spec)
  const port = node
    ? "const { parentPort } = process.getBuiltinModule('node:worker_threads');" +
      'const port = { on: (h) => parentPort.on("message", h), ' +
      'post: (m, t) => parentPort.postMessage(m, t) };'
    : 'const port = { on: (h) => self.addEventListener("message", (e) => h(e.data)), ' +
      'post: (m, t) => self.postMessage(m, t) };';

  // tsx wraps every closure creation in `__name(fn, "name")`; the
  // bundles carry no such helper, but the body must evaluate under both
  return `const __name = (f) => f;\n${port}\n${body}(port);`;
};

/** Spawn one worker on whichever platform is here. */
const spawnWorker = (): PoolWorker => {
  const threads = nodeThreads();

  if (threads != null) {
    const w = new threads.Worker(_algoWorkerSource(true), { eval: true });

    // an idle worker is `unref()`ed so a pool never holds a process
    // open, and `ref()`ed for exactly the span of a request — an
    // unref'ed worker does not keep the event loop alive while the
    // main thread awaits its reply (measured 2026-09-18: the process
    // exited mid-run with code 13, an unsettled top-level await).
    // Order matters too: adding a 'message' listener refs the port
    // again, so the unref follows the listeners.
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

  const url = URL.createObjectURL(
    new Blob([_algoWorkerSource(false)], { type: 'text/javascript' }),
  );
  // the URL stays valid for the pool's life: a worker fetches its
  // script asynchronously, so revoking here would race the load
  const w = new Worker(url);

  return {
    post: (msg, transfer) => w.postMessage(msg, transfer ?? []),
    onMessage: (handler) => {
      w.onmessage = (e: MessageEvent<AlgoWorkerReply>) => handler(e.data);
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
 * Acquire (or reuse) the shared pool.  Cached across calls; a spawn or
 * ping failure rejects (and is not cached, so a later call retries),
 * which `executor: 'auto'` treats like a missing GPU adapter and
 * `executor: 'workers'` surfaces to the caller.
 *
 * @returns the shared pool
 * @throws if no worker platform exists, or a worker fails to construct
 *   or to evaluate the body (a CSP refusal, a transpiler helper)
 */
export const acquireAlgoWorkers = (): Promise<AlgoWorkers> => {
  if (cached == null) {
    cached = (async () => {
      if (!algoWorkersSupported()) {
        throw new Error(
          "executor 'workers' requires worker threads (Node's " +
            'worker_threads, or a browser page with Worker and Blob), ' +
            "which are unavailable in this environment — use 'cpu' or 'auto'",
        );
      }

      const size = algoWorkersSize();
      const workers: PoolWorker[] = [];
      let nextId = 1;
      let queue: Promise<unknown> = Promise.resolve();

      const terminate = (): void => {
        for (const w of workers) {
          w.terminate();
        }

        workers.length = 0;
        stats.workers = 0;
      };

      // per worker: the pending replies, keyed by request id
      const pending: Map<number, (reply: AlgoWorkerReply) => void>[] = [];
      let failure: Error | null = null;
      const failAll = (err: Error): void => {
        failure = err;

        for (const map of pending) {
          for (const resolve of map.values()) {
            resolve({ type: 'error', id: -1, message: err.message });
          }

          map.clear();
        }
      };

      try {
        for (let i = 0; i < size; i++) {
          const w = spawnWorker();
          const map = new Map<number, (reply: AlgoWorkerReply) => void>();

          workers.push(w);
          pending.push(map);
          w.onMessage((reply) => {
            const resolve = map.get(reply.id);

            if (resolve != null) {
              map.delete(reply.id);
              resolve(reply);
            }
          });
          w.onError((err) => failAll(err));
        }
      } catch (err) {
        terminate();
        throw err;
      }

      type Request = AlgoWorkerRequest extends infer R
        ? R extends { id: number }
          ? Omit<R, 'id'>
          : never
        : never;
      const ask = (
        i: number,
        msg: Request,
        transfer?: ArrayBuffer[],
      ): Promise<AlgoWorkerReply> =>
        new Promise((resolve) => {
          if (failure != null) {
            resolve({ type: 'error', id: -1, message: failure.message });

            return;
          }

          const id = nextId++;

          pending[i].set(id, resolve);
          workers[i].post({ ...msg, id }, transfer);
        });

      const hold = (): void => {
        for (const w of workers) {
          w.ref();
        }
      };
      const release = (): void => {
        for (const w of workers) {
          w.unref();
        }
      };

      // the liveness probe: a body that does not evaluate (a stray
      // helper reference) errors here, before any caller depends on it
      hold();

      let pongs: AlgoWorkerReply[];

      try {
        pongs = await Promise.all(
          workers.map((_, i) => ask(i, { type: 'ping' })),
        );
      } finally {
        release();
      }

      for (const reply of pongs) {
        if (reply.type !== 'pong') {
          terminate();
          throw new Error(
            'the algorithm worker failed to start' +
              (reply.type === 'error' ? `: ${reply.message}` : ''),
          );
        }
      }

      stats.spawns++;
      stats.workers = workers.length;
      live = { workers, terminate };

      const runOnce = async (
        snapshot: AlgoWorkerSnapshot,
        n: number,
      ): Promise<Float64Array[]> => {
        const readies = await Promise.all(
          workers.map((_, i) => ask(i, { type: 'snapshot', snapshot })),
        );

        for (const reply of readies) {
          if (reply.type !== 'ready') {
            throw new Error(
              'the algorithm worker rejected its snapshot' +
                (reply.type === 'error' ? `: ${reply.message}` : ''),
            );
          }
        }

        const ranges = rangesOf(n);
        const parts: Float64Array[] = new Array(ranges.length);
        let next = 0;
        let jobError: Error | null = null;

        // a free worker takes the next range: dynamic assignment over a
        // fixed partition, so the merge order never sees the pool size
        const drain = async (i: number): Promise<void> => {
          while (next < ranges.length && jobError == null) {
            const r = next++;
            const [s0, s1] = ranges[r];
            const reply = await ask(i, { type: 'job', s0, s1 });

            if (reply.type === 'done') {
              parts[r] = reply.out;
              stats.jobs++;
            } else if (jobError == null) {
              jobError = new Error(
                'the algorithm worker failed a job' +
                  (reply.type === 'error' ? `: ${reply.message}` : ''),
              );
            }
          }
        };

        await Promise.all(workers.map((_, i) => drain(i)));

        if (jobError != null) {
          throw jobError;
        }

        stats.runs++;

        return parts;
      };

      const pool: AlgoWorkers = {
        size,
        run: (snapshot, n) => {
          // runs are serialized: a worker holds one snapshot at a time
          const turn = queue.then(async () => {
            hold();

            try {
              return await runOnce(snapshot, n);
            } finally {
              release();
            }
          });

          queue = turn.catch(() => undefined);

          return turn;
        },
      };

      return pool;
    })();

    // an acquisition failure must not poison every later attempt
    cached.catch(() => {
      cached = null;
    });
  }

  return cached;
};

/**
 * Test hook: terminate the live pool and drop the cache so the next run
 * spawns afresh — and, with a size, force the pool that spawns next to
 * that many workers (the pool-size-independence specs run 1, 2 and 3).
 *
 * @param size — the forced size for the next pool, or null for the
 *   environment's own
 */
export const _resetAlgoWorkers = (size: number | null = null): void => {
  live?.terminate();
  live = null;
  cached = null;
  forcedSize = size;
};

/**
 * Test and benchmark hook: the pool's run counters, so a row can assert
 * it ran on the workers (and a `cpu` row that the pool stayed untouched).
 *
 * @returns a copy of the counters
 */
export const _algoWorkersStats = (): AlgoWorkersStats => ({ ...stats });
