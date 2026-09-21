// Core's lifecycle (round 130 split): the layout factory, mount and
// unmount, device-loss recovery, destroy and the in-flight run registry.

import { CustomLayout } from '../layout/contract.mjs';
import { ForceLayoutImpl } from '../layout/force.mjs';
import { FlowLayoutImpl } from '../layout/flow.mjs';
import type { CustomLayoutOptions } from '../public-types.mjs';
import { GridLayout } from '../layout/grid.mjs';
import { PresetLayout } from '../layout/preset.mjs';
import { CircleLayout } from '../layout/circle.mjs';
import { ConcentricLayout } from '../layout/concentric.mjs';
import { BreadthFirstLayout } from '../layout/breadthfirst.mjs';
import { RandomLayout } from '../layout/random.mjs';
import { RadialLayout } from '../layout/radial.mjs';
import { PackLayout } from '../layout/pack-layout.mjs';
import { whenSettled } from '../algorithms/cancel.mjs';
import type { AlgoRun } from '../algorithms/cancel.mjs';
import type { LayoutOptions } from '../public-types.mjs';
import type { Layout, Core } from '../core.mjs';

/**
 * Make a layout over the whole graph.  The layout does not run until you
 * call `.run()` on it.
 *
 * Built-ins: `grid`, `preset`, `circle`, `concentric`, `breadthfirst`,
 * `random` and `force` (the GPU-capable spring–electric layout, round
 * 18).  An external layout is passed **directly** rather than
 * registered — v4 has no `cytoscape.use` and no string registry — by
 * giving `impl`: a class or object implementing `{ run( ctx ), stop?() }`
 * (see `layout/contract.mts` for the `LayoutContext` it receives).
 *
 * Lifecycle events (`layoutstart`/`layoutready`/`layoutstop`) fire on
 * the core, once per run; layout instances are not emitters.
 *
 * @param options — `{ name }` for a built-in or `{ impl }` for an
 *   extension, plus that layout's own options and the shared
 *   `layoutPositions` plumbing (`animate`, `spacingFactor`, `transform`,
 *   `fit`, `padding`, …)
 * @returns the layout instance, unstarted
 * @throws if neither a known `name` nor an `impl` is given
 * @see Collection#layout to lay out a subset
 */
export function layout(core: Core, options: LayoutOptions): Layout {
  // the extension contract (round 17.5): direct objects, no registry
  if ((options as { impl?: unknown })?.impl != null) {
    return new CustomLayout(core, options as CustomLayoutOptions);
  }

  if (options?.name === 'grid') {
    return new GridLayout(core, options);
  }
  if (options?.name === 'preset') {
    return new PresetLayout(core, options);
  }
  if (options?.name === 'circle') {
    return new CircleLayout(core, options);
  }
  if (options?.name === 'concentric') {
    return new ConcentricLayout(core, options);
  }
  if (options?.name === 'breadthfirst') {
    return new BreadthFirstLayout(core, options);
  }
  if (options?.name === 'random') {
    return new RandomLayout(core, options);
  }
  if (options?.name === 'radial') {
    return new RadialLayout(core, options);
  }
  if (options?.name === 'pack') {
    return new PackLayout(core, options);
  }

  // the built-in force layout (round 18.2) rides the extension
  // contract — exactly what an external layout would do
  if ((options as { name?: string })?.name === 'force') {
    return new CustomLayout(core, {
      ...(options as object),
      impl: ForceLayoutImpl,
    } as CustomLayoutOptions);
  }

  // the flow layout (round 112) rides the contract the same way
  if ((options as { name?: string })?.name === 'flow') {
    return new CustomLayout(core, {
      ...(options as object),
      impl: FlowLayoutImpl,
    } as CustomLayoutOptions);
  }

  const got = (options as { name?: string } | null)?.name;

  throw new Error(
    `A layout needs a built-in name ('grid', 'preset', 'circle', 'concentric', ` +
      `'breadthfirst', 'random', 'radial', 'pack', 'force', 'flow') or an impl (the extension contract)` +
      (got != null ? `; got name '${got}'` : ''),
  );
}

/**
 * (Re)attach a renderer to a container.  Re-mounting to a different
 * container unmounts first; the fresh renderer re-uploads every column
 * from the CPU-canonical model and rebuilds all glyph runs.
 *
 * @param container — the element to render into
 * @returns this
 * @throws if no container is given, if the instance was built directly
 *   rather than through the `cytoscape` factory (there is no renderer
 *   to attach), or if WebGPU is unavailable — mounting is the one way a
 *   headless instance can demand a GPU after construction
 */
export function mount(core: Core, container: HTMLElement): Core {
  if (container == null) {
    throw new Error('mount() needs a container element');
  }

  if (core._attachFn == null) {
    throw new Error(
      'This instance cannot mount (it was not created via the cytoscape factory)',
    );
  }

  if (core._container != null) {
    if (core._container === container) {
      return core;
    }

    core.unmount();
  }

  core._container = container;
  core._readyResolved = false;
  // the old label layer consumed the dirty channel; a fresh one starts
  // empty, so every labelled slot must queue for a glyph rebuild
  core._store.markAllLabelsDirty();
  core._attachFn(container);

  return core;
}

/**
 * Detach the renderer: the instance becomes headless (the model is
 * CPU-canonical, so nothing is lost).  No-op when already headless.
 */
export function unmount(core: Core): Core {
  if (core._container == null) {
    return core;
  }

  core._pointer?.destroy();
  core._pointer = null;
  core._renderer?.destroy();
  core._renderer = null;
  core._container = null;
  core._readyResolved = true; // headless is ready by definition
  core.ready = Promise.resolve(core);

  return core;
}

/**
 * Device-loss recovery (round 10 policy): auto-recover once per loss —
 * emit 'devicelost', re-mount a fresh renderer against the same
 * container (the model is CPU-canonical, so everything rebuilds), then
 * emit 'devicerestored'.  If a loss arrives while a recovery is already
 * in flight, or re-acquisition fails, the instance goes headless-dead
 * and emits 'error' (the pre-round-10 behavior).
 */
export function _handleDeviceLost(core: Core, message: string): void {
  if (core._destroyed) {
    return;
  }

  core.emit({ type: 'devicelost' }, [message]);

  const container = core._container;

  if (core._recoveringDevice || container == null || core._attachFn == null) {
    core.unmount();
    core.emit({ type: 'error' }, [`WebGPU device lost: ${message}`]);

    return;
  }

  core._recoveringDevice = true;
  core.unmount();

  try {
    core.mount(container);
  } catch (err) {
    core._recoveringDevice = false;
    core.emit({ type: 'error' }, [
      `WebGPU device lost and could not recover: ${(err as Error).message}`,
    ]);

    return;
  }

  core.ready.then(
    () => {
      core._recoveringDevice = false;
      core.emit('devicerestored');
    },
    (err: Error) => {
      core._recoveringDevice = false;
      core.unmount();
      core.emit({ type: 'error' }, [
        `WebGPU device lost and could not recover: ${err.message}`,
      ]);
    },
  );
}

/**
 * Tear the instance down: emit `destroy`, drop every listener, and
 * release the pointer handler and the renderer (with its GPU
 * resources).  Idempotent.  The store is left intact but the instance
 * must not be used afterwards.
 *
 * @returns this core
 */
export function destroy(core: Core): Core {
  if (core._destroyed) {
    return core;
  }

  // the last cancel (round 128): a layout still running restores its
  // positions and closes its lifecycle, a pending algorithm handle
  // rejects with CancelledError — before the listeners go, so a
  // `layoutstop` still reaches them, and before the renderer goes, so
  // nothing in flight writes into a dead one
  for (const run of [...core._inflight]) {
    run.cancel();
  }

  core._inflight.clear();
  core.emit('destroy');
  core._emitter.removeAllListeners();

  core._pointer?.destroy();
  core._pointer = null;

  if (core._renderer != null) {
    core._renderer.destroy();
    core._renderer = null;
  }

  core._destroyed = true;

  return core;
}

/**
 * Register an async algorithm run for `destroy()` to cancel (round
 * 128); it leaves the registry when it settles either way.
 *
 * @param run — the handle an algorithm entry returned
 * @returns the same handle
 * @internal
 */
export function _trackRun<T>(core: Core, run: AlgoRun<T>): AlgoRun<T> {
  const done = (): void => {
    core._inflight.delete(run);
  };

  core._inflight.add(run);
  // observed through the handle's own settle promise, never through
  // `run.then` — a handler here would mark the caller's rejection as
  // handled, and a cancelled run nobody catches must stay theirs to see
  whenSettled(run).then(done);

  return run;
}
