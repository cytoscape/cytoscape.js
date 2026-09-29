// `cy.load()` (round 103): progressive ingest — a first frame before the
// last byte.  The source is an (async) iterable of chunks, each any input
// form; every chunk lands through the bulk path, the renderer gets a turn
// between chunks, and `cy.ready` means the first chunk drawn.

import { buildColumnar, isColumnarElements } from '../columnar.mjs';
import { deserializeElements, isSerializedElements } from '../wire.mjs';
import { partitionDefs } from '../element-defs.mjs';
import { throwIfCancelled, withCancel } from '../algorithms/cancel.mjs';
import type { CancelToken } from '../algorithms/cancel.mjs';
import type { ColumnarElements, ElementsInput } from '../public-types.mjs';
import type { FlagOverride } from '../columnar.mjs';
import type { Core } from '../core.mjs';
import { _addColumnar, _emitBulkAdds } from './elements.mjs';
import { _trackRun } from './lifecycle.mjs';

/** Options for `cy.load()` (round 103). */
export interface LoadOptions {
  /**
   * Fit the viewport **once**, to the first chunk, and then hold it —
   * a load never re-fits per chunk, so the screen does not jump as the
   * graph fills in.  Default: true for an initial load (one that starts
   * on an instance holding no elements), false for a load into a
   * populated graph.
   */
  fit?: boolean;
  /** the rendered-space padding of that fit, in px (default 0, as `cy.fit()`) */
  padding?: number;
}

/** How far a load has got: the chunks ingested and the elements they added. */
export interface LoadProgress {
  /** chunks ingested so far (1 on the first `loadchunk`) */
  chunks: number;
  /** nodes added by this load so far */
  nodes: number;
  /** edges added by this load so far */
  edges: number;
}

/**
 * The promise `cy.load()` returns: it resolves with the final
 * {@link LoadProgress} once the source is exhausted and the last chunk is
 * in, and carries `cancel()` (the round-128 contract).
 */
export type LoadRun = Promise<LoadProgress> & {
  /**
   * Stop pulling chunks: the promise rejects with a `CancelledError`, the
   * source's iterator is closed (`return()`), `loadstop` fires with
   * `cancelled: true`, and every chunk already ingested stays.
   *
   * @returns true when the load was still running and is now cancelled;
   *   false when it had already settled
   */
  cancel(): boolean;
};

/** What a load in flight keeps on its core (`_load`). */
export interface LoadState {
  /** the run the caller holds (null for the instant before it exists) */
  run: LoadRun | null;
}

const OPTION_KEYS = new Set(['fit', 'padding']);

/** Validate a `load()` source, answering its iterator. */
function iteratorOf(
  source: unknown,
): AsyncIterator<ElementsInput> | Iterator<ElementsInput> {
  const s = source as {
    [Symbol.asyncIterator]?: () => AsyncIterator<ElementsInput>;
    [Symbol.iterator]?: () => Iterator<ElementsInput>;
  } | null;

  // a payload is iterable only by accident (a wire buffer's typed-array
  // view iterates bytes, an array of definitions iterates elements that
  // are not chunks) — so a single payload is refused by shape
  const payload =
    source != null &&
    (isSerializedElements(source) ||
      (typeof source === 'object' &&
        !Array.isArray(source) &&
        (source as { columnar?: unknown }).columnar === true));

  if (s == null || typeof s !== 'object' || payload) {
    throw new Error(
      'cy.load() takes an iterable or async iterable of chunks (e.g. an ' +
        'async generator yielding payloads) — to load one payload, pass ' +
        '[ payload ] or use cy.add()',
    );
  }

  if (typeof s[Symbol.asyncIterator] === 'function') {
    return s[Symbol.asyncIterator]!();
  }

  if (typeof s[Symbol.iterator] === 'function') {
    return s[Symbol.iterator]!();
  }

  throw new Error(
    'cy.load() takes an iterable or async iterable of chunks (e.g. an ' +
      'async generator yielding payloads) — to load one payload, pass ' +
      '[ payload ] or use cy.add()',
  );
}

/**
 * One macrotask: the renderer's frame (and anything else queued) gets
 * its turn between two chunks, even when the source hands them over
 * synchronously.  A `MessageChannel` where there is a DOM — no 4 ms
 * nested-timer clamp — and a timer elsewhere (Node, edge isolates),
 * where an open port would hold the process alive.
 */
let channel: MessageChannel | null = null;
const queued: (() => void)[] = [];
const nextTask = (): Promise<void> =>
  new Promise((resolve) => {
    if (
      typeof MessageChannel === 'function' &&
      typeof document !== 'undefined'
    ) {
      if (channel == null) {
        channel = new MessageChannel();
        channel.port1.onmessage = () => queued.shift()?.();
      }

      queued.push(resolve);
      channel.port2.postMessage(0);

      return;
    }

    setTimeout(resolve, 0);
  });

/**
 * Ingest one chunk through the bulk path: every input form arrives
 * columnar — a definition chunk converted with node references, so its
 * cut edges take the same route as its own — and lands with one bulk
 * style pass and no per-element handle.
 *
 * @returns the slots it added
 * @throws whatever the ingest throws for a malformed chunk — a node
 *   reference naming no node throws before anything is added
 */
function ingestChunk(
  core: Core,
  input: ElementsInput,
  applyGraphData: boolean,
): { nodes: number; edges: number } {
  const payload = isSerializedElements(input)
    ? deserializeElements(input)
    : input;
  let elements: ColumnarElements;
  let nodeFlags: FlagOverride[] | undefined;
  let edgeFlags: FlagOverride[] | undefined;

  if (isColumnarElements(payload)) {
    elements = payload;
  } else {
    // 'refs' never answers null: a missing endpoint throws, an unknown
    // one becomes a reference the ingest resolves
    const bulk = buildColumnar(partitionDefs(payload), 'refs')!;

    elements = bulk.elements;
    nodeFlags = bulk.nodeFlags;
    edgeFlags = bulk.edgeFlags;
  }

  // graph-level data rides an initial load as it rides `options.elements`
  if (applyGraphData && elements.data != null) {
    Object.assign(core._graphData, elements.data);
  }

  const store = core._store;
  // the round-67 bulk window: into an empty store it closes with one pass
  // over the finished pair map; into a populated one (a later chunk) that
  // pass would mark every pair in the graph, so the window closes over
  // the chunk's own edges instead (a failed chunk falls back to the whole
  // map — correct, only slower)
  const fresh = store.nodes.count === 0 && store.edges.count === 0;
  let slots: { nodeSlots: Uint32Array; edgeSlots: Uint32Array } | null = null;

  store.beginBulkLoad();

  try {
    slots = _addColumnar(core, elements, nodeFlags, edgeFlags, 'cy.load()');
  } finally {
    store.endBulkLoad(fresh || slots == null ? undefined : slots.edgeSlots);
  }

  _emitBulkAdds(core, slots.nodeSlots, slots.edgeSlots);

  return { nodes: slots.nodeSlots.length, edges: slots.edgeSlots.length };
}

/**
 * Hold `cy.ready` until the first chunk is drawn (an initial load).
 *
 * @param base — `cy.ready` as it stood: the renderer's readiness
 * @returns the release: call once the first chunk is drawn, or once the
 *   load ends without one
 */
function holdReady(core: Core, base: Promise<Core>): () => void {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  core._readyHeld = true;
  core._readyResolved = false;
  core.ready = Promise.all([base, gate]).then(
    () => {
      core._readyHeld = false;
      core._readyResolved = true;

      return core;
    },
    (err: unknown) => {
      core._readyHeld = false;

      throw err;
    },
  );

  return release;
}

/**
 * Progressive ingest (round 103).  See `Core#load` for the contract.
 *
 * @internal
 * @throws synchronously, when the source is not an (async) iterable of
 *   chunks, on an unknown option, while another load is running, or on
 *   a destroyed instance
 */
export function load(
  core: Core,
  source: AsyncIterable<ElementsInput> | Iterable<ElementsInput>,
  options: LoadOptions = {},
): LoadRun {
  if (core._destroyed) {
    throw new Error('cy.load() on a destroyed instance');
  }

  for (const key of Object.keys(options)) {
    if (!OPTION_KEYS.has(key)) {
      throw new Error(`Unknown load option '${key}'; supported: fit, padding`);
    }
  }

  if (core._load != null) {
    throw new Error(
      'cy.load(): a load is already running on this instance — await it ' +
        'or cancel() it first',
    );
  }

  const iterator = iteratorOf(source);
  const store = core._store;
  const initial = store.nodes.count === 0 && store.edges.count === 0;
  const fit = options.fit ?? initial;
  const padding = options.padding ?? 0;
  const base = core.ready;
  const release = initial ? holdReady(core, base) : null;
  // a renderer that never becomes usable draws nothing: its failure
  // counts as "drawn" for the load's own sequencing (`cy.ready` still
  // rejects with it)
  const undrawable = base.then(
    () => new Promise<void>(() => {}),
    () => undefined,
  );
  const progress: LoadProgress = { chunks: 0, nodes: 0, edges: 0 };
  const snapshot = (): LoadProgress => ({ ...progress });
  const token: CancelToken = { cancelled: false, done: false };
  let finished = false;
  let drawn: Promise<void> | null = null;

  const close = (): void => {
    try {
      const ret = iterator.return?.();

      // an async iterator's return() is a promise; its rejection is the
      // source's own business once the load no longer wants it
      (ret as Promise<unknown> | undefined)?.then?.(undefined, () => {});
    } catch {
      // a sync iterator whose return() throws: nothing left to release
    }
  };

  /** End the load once, whichever way: the lifecycle always closes. */
  const finish = (): void => {
    if (finished) {
      return;
    }

    finished = true;
    core._load = null;

    // a load that ingested no chunk — an empty source, or one that failed
    // or was cancelled first — releases `cy.ready` at its end (still
    // gated on the renderer); otherwise the first frame releases it
    if (progress.chunks === 0) {
      release?.();
    }

    core.emit({
      type: 'loadstop',
      progress: snapshot(),
      cancelled: token.cancelled,
    });
  };

  const pump = async (): Promise<LoadProgress> => {
    try {
      for (;;) {
        const step = await iterator.next();

        throwIfCancelled(token);

        if (step.done === true) {
          break;
        }

        const added = ingestChunk(core, step.value, initial);

        progress.chunks++;
        progress.nodes += added.nodes;
        progress.edges += added.edges;

        if (progress.chunks === 1) {
          if (fit) {
            core.fit(undefined, padding);
          }

          // drawn = the first frame after this ingest — every frame after
          // it carries the chunk; headless, the ingest itself
          drawn = Promise.race([core._nextFrame(), undrawable]).then(() => {
            release?.();

            if (!finished) {
              core.emit({ type: 'loadready', progress: snapshot() });
            }
          });
        }

        core.emit({ type: 'loadchunk', progress: snapshot() });

        // the renderer's turn: a synchronous source must not starve it
        await nextTask();
        throwIfCancelled(token);

        // the first chunk is drawn before the second is asked for: its
        // frame must not wait on later chunks' ingest (measured, 103.3:
        // with the renderer still initialising, a greedy pull put the
        // first frame anywhere from 280 to 640 ms on ndex-x-large)
        if (progress.chunks === 1 && drawn != null) {
          await drawn;
          throwIfCancelled(token);
        }
      }

      // `loadready` precedes `loadstop`, even for a source that lands
      // whole before the first frame
      if (drawn != null) {
        await drawn;
        throwIfCancelled(token);
      }
    } catch (err) {
      token.done = true;
      close();
      finish();

      throw err;
    }

    token.done = true;
    finish();

    return snapshot();
  };

  // open the lifecycle before the source is first asked for a chunk: a
  // sync iterator runs inside `pump()`'s first `next()`, and may throw
  const state: LoadState = { run: null };

  core._load = state;
  core.emit({ type: 'loadstart', progress: snapshot() });

  const run = withCancel(token, pump(), 'the load') as LoadRun;
  const cancel = run.cancel;

  run.cancel = (): boolean => {
    if (!cancel()) {
      return false;
    }

    close();
    finish();

    return true;
  };

  state.run = run;

  return _trackRun(core, run);
}
