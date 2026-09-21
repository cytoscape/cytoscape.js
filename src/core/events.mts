// Core's event surface (round 130 split): `on`/`one`/`off` and the
// per-element emit with compound bubbling.

import { Collection } from '../collection.mjs';
import { hasListeners, predicateQualifier } from '../events.mjs';
import type { ElePredicate, PhasedEvent } from '../events.mjs';
import { Event } from '../event.mjs';
import type { EventHandler } from '../emitter.mjs';
import type { EventProps } from '../event.mjs';
import { GROUP_NODES } from '../contract.mjs';
import type { Core } from '../core.mjs';

/** Emit an event on one element with compound bubbling: the element's own listeners, then each ancestor's, then the core's, stopping when a handler stops propagation. */
export function _emitOnEle(
  core: Core,
  type: string,
  ele: Collection,
  extraParams?: unknown[],
  props?: Partial<EventProps>,
): void {
  // Round 34.3: nothing listens for core type, so there is nothing to
  // do.  Sound because v4's emitter has no bubbling of its own (round
  // 41.2 dropped v3's `bubble`/`parent`; compound bubbling is the
  // phase walk below) — so an emit with no matching listener is
  // observably a no-op.
  //
  // Most callers gate already; the *pointer layer's* sixteen do not
  // (mouseover/mouseout, the pointer pair, tap, tapselect, the box
  // family), and those fire on hover transitions and pointer moves.
  // On a compound graph an ungated emit built an Event, interned a
  // handle per ancestor and emitted once per phase before discovering
  // that nobody cared: 338 ns for a node two ancestors deep against
  // 159 ns for an orphan.
  if (!hasListeners(core._emitter, type)) {
    return;
  }

  const store = core._store;

  if (store.hasCompounds()) {
    const ref = ele._eventRef();

    if (
      ref != null &&
      ref.group === GROUP_NODES &&
      store.parentOf(ref.slot) >= 0
    ) {
      // compound bubbling (round 14.5): origin -> ancestors -> core in
      // phases on one shared Event, so stopPropagation carries between
      // them.  event.target stays the originator; each phase's element
      // rides _phaseRef/_phaseEle (see events.mts).
      const eventObj = new Event({
        type,
        target: ele,
        ...props,
      }) as PhasedEvent;

      eventObj._phaseRef = ref;
      eventObj._phaseEle = ele;
      core._emitter.emit(eventObj, extraParams);

      for (let p = store.parentOf(ref.slot); p >= 0; p = store.parentOf(p)) {
        if (eventObj.isPropagationStopped()) {
          return;
        }

        const phaseEle = core._ele(GROUP_NODES, p);

        eventObj._phaseRef = phaseEle._eventRef();
        eventObj._phaseEle = phaseEle;
        core._emitter.emit(eventObj, extraParams);
      }

      if (eventObj.isPropagationStopped()) {
        return;
      }

      eventObj._phaseRef = null;
      eventObj._phaseEle = null;
      core._emitter.emit(eventObj, extraParams);

      return;
    }
  }

  core._emitter.emit({ type, target: ele, ...props }, extraParams);
}

/** The `on()` implementation behind its overloads: bind a handler to the space-separated event names, optionally qualified by a predicate or element filter. */
export function on(
  core: Core,
  events: string,
  predicateOrCb?: ElePredicate | EventHandler,
  callback?: EventHandler,
): Core {
  if (callback != null) {
    core._emitter.on(
      events,
      predicateQualifier(predicateOrCb as ElePredicate),
      callback,
    );
  } else {
    core._emitter.on(events, null, predicateOrCb as EventHandler | undefined);
  }

  return core;
}

/** The `one()` implementation behind its overloads: like `on()`, unbinding after the first call. */
export function one(
  core: Core,
  events: string,
  predicateOrCb?: ElePredicate | EventHandler,
  callback?: EventHandler,
): Core {
  if (callback != null) {
    core._emitter.one(
      events,
      predicateQualifier(predicateOrCb as ElePredicate),
      callback,
    );
  } else {
    core._emitter.one(events, null, predicateOrCb as EventHandler | undefined);
  }

  return core;
}

/** The `off()` implementation behind its overloads: unbind by event names, and optionally by qualifier and handler. */
export function off(
  core: Core,
  events: string,
  predicateOrCb?: ElePredicate | EventHandler,
  callback?: EventHandler,
): Core {
  if (callback != null) {
    core._emitter.off(
      events,
      predicateQualifier(predicateOrCb as ElePredicate),
      callback,
    );
  } else {
    core._emitter.off(events, null, predicateOrCb as EventHandler | undefined);
  }

  return core;
}
