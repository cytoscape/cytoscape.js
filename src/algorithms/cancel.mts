/*
Cancellation for the async algorithm tier and the layouts (round 128).

The execution model rounds 65, 72, 74 and 110 settled — CPU, GPU and
worker executors, Promise completion, the error contract — had no
cancellation contract: nothing defined what a caller does with a
whole-graph run it no longer wants.  The maintainer's design call
(2026-09-18): a **`.cancel()` handle**, not an `AbortSignal` option —
the promise an async algorithm returns carries `cancel()`, and a
layout gains `cancel()` beside `stop()`.  What cancelling reclaims is
per executor, and the record says so rather than pretending: a `'cpu'`
run has already completed inside the call (nothing to cancel, so
`cancel()` answers false); a `'gpu'` run's device work cannot be
recalled once submitted, so the pending readback is abandoned and its
result never decoded into a result object; a `'workers'` run stops
posting ranges, discards the partials still in flight and leaves the
pool standing.
*/

/**
 * Thrown (as a rejection) by a cancelled run: an async algorithm whose
 * handle's `cancel()` was called, a layout's `promise()` after
 * `layout.cancel()`, or either when `cy.destroy()` ran while the run
 * was in flight.  `error.name` is `'CancelledError'`, so a `.catch`
 * can tell a cancellation from a defect without importing the class.
 */
export class CancelledError extends Error {
  /**
   * @param message — what was cancelled; a default names the run
   */
  constructor(message = 'the run was cancelled') {
    super(message);
    this.name = 'CancelledError';
  }
}

/**
 * The promise an async algorithm returns: a `Promise` of the result
 * plus `cancel()`.  A caller that never cancels sees an ordinary
 * promise.
 */
export type AlgoRun<T> = Promise<T> & {
  /**
   * Cancel the run: the promise rejects with a `CancelledError` and
   * whatever the executor can reclaim is reclaimed (see the module
   * note).
   *
   * @returns true when the run was still pending and is now rejected;
   *   false when it had already settled — a `'cpu'` run always answers
   *   false, since the reference completes inside the call
   */
  cancel(): boolean;
};

/** The flag a run's lanes poll between their awaits. */
export interface CancelToken {
  /** set by `cancel()`; every await point in a lane checks it */
  cancelled: boolean;
  /** set by the router the moment a lane's value is in hand, so a
   * `cancel()` that lands after the fact answers false */
  done: boolean;
}

/**
 * Build a run: race the routed promise against the cancel flag and
 * attach the handle.  A cancel rejects the returned promise at once;
 * the routed promise runs on to whatever its next await point is,
 * throws there, and its late rejection is swallowed (the caller's
 * promise is the one already rejected — there is nothing unhandled).
 *
 * @param token — the token the routed promise polls
 * @param routed — the run, already started
 * @param what — the run's name, for the rejection message
 * @returns the promise with `cancel()` attached
 */
export const withCancel = <T,>(
  token: CancelToken,
  routed: Promise<T>,
  what = 'the run',
): AlgoRun<T> => {
  let rejectRun!: (err: unknown) => void;
  let settle!: () => void;

  // the registry's view of the run (`whenSettled`): a promise of its
  // own, so observing the settle never marks the caller's handle as
  // handled — a cancelled run nobody catches stays an unhandled
  // rejection, which is theirs to see.  Settled *before* the handle
  // resolves, so a registry reaction runs ahead of the caller's
  const settled = new Promise<void>((resolve) => {
    settle = resolve;
  });

  const run = new Promise<T>((resolve, reject) => {
    rejectRun = reject;
    routed.then(
      (value) => {
        settle();
        resolve(value);
      },
      (err) => {
        settle();
        reject(err);
      },
    );
  }) as AlgoRun<T>;

  run.cancel = (): boolean => {
    if (token.done || token.cancelled) {
      return false;
    }

    token.cancelled = true;
    rejectRun(new CancelledError(`${what} was cancelled`));
    settle();

    return true;
  };

  Object.defineProperty(run, SETTLED, { value: settled, enumerable: false });

  return run;
};

/** the hidden key the registry's settle promise hangs on */
const SETTLED = Symbol('cy:settled');

/**
 * When a run has settled — resolved, rejected or cancelled — without
 * touching the run's own promise (see `withCancel`).
 *
 * @param run — a handle from `withCancel`
 * @returns a promise resolving at the settle; for a promise that is
 *   not a `withCancel` handle, a handled view of it
 */
export const whenSettled = (run: AlgoRun<unknown>): Promise<void> => {
  const own = (run as unknown as Record<symbol, Promise<void> | undefined>)[
    SETTLED
  ];

  return (
    own ??
    run.then(
      () => undefined,
      () => undefined,
    )
  );
};

/**
 * The check a lane makes after each await.
 *
 * @param token — the run's token
 * @throws CancelledError when the run was cancelled meanwhile
 */
export const throwIfCancelled = (token: CancelToken | undefined): void => {
  if (token?.cancelled === true) {
    throw new CancelledError();
  }
};
