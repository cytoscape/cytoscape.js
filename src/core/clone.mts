// `cy.clone()` (round 106): a second view of a graph is a second instance,
// built over the serialize/ingest path and — with `follow` — kept current
// by a throttled round-107 `patch()` driven by a dirty-stream consumer on
// the source.  Every instance keeps one core, one viewport, one renderer.

import {
  COL,
  FLAG_GRABBABLE,
  FLAG_LOCKED,
  FLAG_PANNABLE,
  GROUP_EDGES,
  GROUP_NODES,
} from '../contract.mjs';
import type { GroupName } from '../contract.mjs';
import { createCore, NO_RENDERER_BUILD } from '../factory.mjs';
import type { CoreCaps } from '../factory.mjs';
import type { CytoscapeOptions, Stylesheet } from '../public-types.mjs';
import type { Core } from '../core.mjs';
import type { Collection } from '../collection.mjs';
import { patch as patchImpl } from './patch.mjs';

/** How a following clone keeps up (round 106). */
export interface FollowOptions {
  /**
   * The least time, in ms, between two syncs (default 50).  A sync also
   * waits at least as long as the previous one took, so following never
   * holds more than half of the main thread however large the graph.
   * `0` syncs on the first macrotask after a burst of changes.
   */
  throttle?: number;
}

/** Options for `cy.clone()` (round 106). */
export interface CloneOptions extends Omit<CytoscapeOptions, 'elements'> {
  /**
   * Keep the clone current: `true`, or `{ throttle }`.  Each sync is
   * `clone.patch( source.serialize() )` — the source's elements, data,
   * positions and hierarchy; never its sheet, viewport, selection or
   * graph-level data.  Stops when either instance is destroyed.
   */
  follow?: boolean | FollowOptions;
}

/** The default least interval between two follow syncs, in ms. */
export const FOLLOW_THROTTLE = 50;

/**
 * A core built directly (`new Core`) carries no entry's capabilities.  A
 * function, not a constant: this module and `factory.mts` import each
 * other through `core.mts`, so nothing from the factory may be read at
 * module evaluation.
 */
const bareCaps = (): CoreCaps => ({
  attach: null,
  gpu: false,
  forceHost: null,
  noRendererMessage: NO_RENDERER_BUILD,
});

/** The per-element flags the wire does not carry and a clone copies. */
const CARRIED = FLAG_LOCKED | FLAG_GRABBABLE | FLAG_PANNABLE;

const isPlain = (v: unknown): v is Record<string, unknown> =>
  v != null &&
  typeof v === 'object' &&
  (Object.getPrototypeOf(v) === Object.prototype ||
    Object.getPrototypeOf(v) === null);

/** A copy of a sheet's plain objects and arrays, so the two engines share none. */
function copySheet<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(copySheet) as T;
  }

  if (isPlain(value)) {
    const out: Record<string, unknown> = {};

    for (const key of Object.keys(value)) {
      out[key] = copySheet(value[key]);
    }

    return out as T;
  }

  return value;
}

/** Validate the follow option, answering the throttle (null: no follow). */
function followThrottle(follow: CloneOptions['follow']): number | null {
  if (follow == null || follow === false) {
    return null;
  }

  if (follow === true) {
    return FOLLOW_THROTTLE;
  }

  if (typeof follow !== 'object') {
    throw new Error(
      `clone's follow must be a boolean or { throttle }; got '${String(follow)}'`,
    );
  }

  for (const key of Object.keys(follow)) {
    if (key !== 'throttle') {
      throw new Error(`Unknown follow option '${key}'; supported: throttle`);
    }
  }

  const throttle = follow.throttle ?? FOLLOW_THROTTLE;

  if (typeof throttle !== 'number' || !(throttle >= 0) || !isFinite(throttle)) {
    throw new Error(
      `follow.throttle must be a non-negative number of ms; got '${String(throttle)}'`,
    );
  }

  return throttle;
}

/**
 * What the source's live state says, as construction options: its sheet
 * (bypasses included), viewport, and every interaction setting a setter
 * can have changed since it was built.
 */
function liveOptions(core: Core): CytoscapeOptions {
  return {
    style: copySheet(core._styleEngine.json()) as Stylesheet,
    zoom: core.zoom() as number,
    pan: { ...(core.pan() as { x: number; y: number }) },
    minZoom: core.minZoom() as number,
    maxZoom: core.maxZoom() as number,
    autolock: core.autolock() as boolean,
    autoungrabify: core.autoungrabify() as boolean,
    autounselectify: core.autounselectify() as boolean,
    panningEnabled: core.panningEnabled() as boolean,
    userPanningEnabled: core.userPanningEnabled() as boolean,
    zoomingEnabled: core.zoomingEnabled() as boolean,
    userZoomingEnabled: core.userZoomingEnabled() as boolean,
    boxSelectionEnabled: core.boxSelectionEnabled() as boolean,
    boxSelectionIncludesLabels: core.boxSelectionIncludesLabels() as boolean,
    boxSelectionMode:
      core.boxSelectionMode() as CytoscapeOptions['boxSelectionMode'],
    selectionType: core.selectionType() as 'single' | 'additive',
    multiClickDebounceTime: core.multiClickDebounceTime() as number,
    desktopTapThreshold: core.desktopTapThreshold() as number,
    touchTapThreshold: core.touchTapThreshold() as number,
    tapholdDuration: core.tapholdDuration() as number,
    wheelSensitivity: core.wheelSensitivity() as number,
    wheelBehavior: core.wheelBehavior() as CytoscapeOptions['wheelBehavior'],
    pointerCursors: core.pointerCursors() as CytoscapeOptions['pointerCursors'],
  };
}

/** Copy the lock / grab / pan deviations the wire does not carry, slot for slot. */
function carryFlags(source: Core, clone: Core, group: GroupName): void {
  const from = source._store;
  const to = clone._store;
  const fromSlots = from.slotsOrdered(group);
  const toSlots = to.slotsOrdered(group);
  const fromFlags = from.column(
    group === GROUP_NODES ? COL.NODE_FLAGS : COL.EDGE_FLAGS,
  ) as Uint32Array;
  const toFlags = to.column(
    group === GROUP_NODES ? COL.NODE_FLAGS : COL.EDGE_FLAGS,
  ) as Uint32Array;

  for (let i = 0; i < fromSlots.length; i++) {
    const want = fromFlags[fromSlots[i]] & CARRIED;
    const slot = toSlots[i];
    const diff = (toFlags[slot] & CARRIED) ^ want;

    if (diff === 0) {
      continue;
    }

    for (const bit of [FLAG_LOCKED, FLAG_GRABBABLE, FLAG_PANNABLE]) {
      if ((diff & bit) !== 0) {
        to.setFlag(group, slot, bit, (want & bit) !== 0);
      }
    }
  }
}

/** Copy the lock / grab / pan flags of a sync's added elements, by id. */
function carryAdded(source: Core, follower: Core, added: Collection): void {
  const from = source._store;
  const to = follower._store;

  // by id through the handles: the batch's end may have compacted, and a
  // handle repairs its ref where a raw slot would not
  for (let i = 0; i < added.length; i++) {
    const id = added[i].id() as string;
    const src = from.lookup(id);
    const dst = to.lookup(id);

    if (src == null || dst == null || src.group !== dst.group) {
      continue;
    }

    const col = dst.group === GROUP_NODES ? COL.NODE_FLAGS : COL.EDGE_FLAGS;
    const want = (from.column(col) as Uint32Array)[src.slot] & CARRIED;
    const diff = ((to.column(col) as Uint32Array)[dst.slot] & CARRIED) ^ want;

    for (const bit of [FLAG_LOCKED, FLAG_GRABBABLE, FLAG_PANNABLE]) {
      if ((diff & bit) !== 0) {
        to.setFlag(dst.group, dst.slot, bit, (want & bit) !== 0);
      }
    }
  }
}

/**
 * Make an independent instance holding a copy of this one's graph.  See
 * `Core#clone` for the contract.
 *
 * @param core — the source
 * @param options — construction options over the carried ones, and `follow`
 * @returns the clone
 */
export function clone(core: Core, options: CloneOptions = {}): Core {
  if ((options as CytoscapeOptions).elements !== undefined) {
    throw new Error(
      "clone() takes no 'elements': a clone's elements are its source's",
    );
  }

  const { follow, ...rest } = options;
  const throttle = followThrottle(follow);
  const {
    elements: _elements,
    container: _container,
    layout: _layout,
    ...built
  } = core._options;
  const merged: CytoscapeOptions = {
    ...built,
    ...liveOptions(core),
    ...rest,
  };
  const cy = createCore(
    { ...merged, elements: core.serialize() },
    core._caps ?? bareCaps(),
  );

  // the options it reads back are the ones it was built with, minus the
  // buffer — a clone of a large graph must not retain its payload
  cy._options = merged;

  cy.batch(() => {
    carryFlags(core, cy, GROUP_NODES);
    carryFlags(core, cy, GROUP_EDGES);
  });

  if (throttle != null) {
    follow_(core, cy, throttle);
  }

  return cy;
}

/** One source → clone follow: a dirty-stream consumer driving a throttled patch. */
function follow_(source: Core, follower: Core, throttle: number): void {
  const store = source._store;
  const consumer = store.registerConsumer();
  const now = (): number =>
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let lastSync = -Infinity;
  let lastCost = 0;
  let structure = store.structureEpoch;
  let hierarchy = store.hierarchyEpoch;
  let moves = store.positionEpoch;

  // the clone was built from this very state: drop the full sync
  consumer.take();
  consumer.takeMapperSpans();

  const link = {
    stop(): void {
      if (stopped) {
        return;
      }

      stopped = true;

      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }

      consumer.dispose();
      source._follows.delete(link);
      follower._follows.delete(link);
    },
  };

  const sync = (): void => {
    timer = null;

    if (stopped || !consumer.hasDirty()) {
      return;
    }

    const delta = consumer.take();

    consumer.takeMapperSpans();

    // only a change the payload carries is worth a patch: a restyle, a
    // hover or a selection on the source moves none of these (a restyle
    // that resizes a compound's children moves the parent, but that
    // position is derived, and a position span alone cannot tell it from
    // a drag — hence the store's epochs rather than the spans)
    const relevant =
      delta.resized.nodes ||
      delta.resized.edges ||
      delta.dataWritten === true ||
      store.structureEpoch !== structure ||
      store.hierarchyEpoch !== hierarchy ||
      store.positionEpoch !== moves ||
      delta.spans.some((s) => s.column === COL.EDGE_ENDPOINTS);

    if (!relevant) {
      return;
    }

    structure = store.structureEpoch;
    hierarchy = store.hierarchyEpoch;
    moves = store.positionEpoch;

    const t0 = now();

    const diff = patchImpl(follower, source.serialize(), undefined, true);

    // an element the sync added starts as a clone's elements start: with
    // the source's lock / grab / pan flags, which the wire does not carry
    if (diff.added.length > 0) {
      carryAdded(source, follower, diff.added);
    }

    lastSync = now();
    lastCost = lastSync - t0;
  };

  consumer.onInvalidate(() => {
    if (stopped || timer != null) {
      return;
    }

    const wait = Math.max(0, lastSync + Math.max(throttle, lastCost) - now());

    timer = setTimeout(sync, wait);
  });

  source._follows.add(link);
  follower._follows.add(link);
}
