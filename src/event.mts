import type { Position } from './public-types.mjs';
import type { Core } from './core.mjs';
import type { Collection } from './collection.mjs';

/*
v4's own event object (round 41.1), replacing the shared v3 `src/event.mts`.

Three things change, and none of them is the event *semantics* — bubbling,
phase order and `stopPropagation()` behave exactly as round 14.5 built them:

  1. **`target` is typed.**  v3's Event types it `unknown`, so every handler
     in a typed codebase began with a cast; a v4 event's target is the core
     or a single-element collection, and says so.  Narrowing between the two
     is `isNode`/`isEdge` in `target`, or `target === event.cy`.
  2. **`originalEvent` is populated** by the interaction layer (41.4), so the
     DOM event that caused a gesture is finally reachable from the handler.
     v4 previously emitted `{ position }` only, which left the field on the
     type and never on an object.
  3. **No namespaces.**  There is no `namespace` field and nothing parses
     one.  A name containing a dot is just a name: `on( 'tap.ns' )` registers
     a listener for the literal type `'tap.ns'`, which v4 never emits, so it
     never fires — the same rule as any other name v4 does not raise (see
     `Core#on`).  Until this round v4 imported v3's emitter and so
     inherited full v3 namespace semantics, which contradicted the design and
     nobody had noticed (measured round 37.4).

`preventDefault()` is **browser-level only, by decided design** (the
seventh sitting, 2026-08-09).  With `originalEvent` attached (41.4) it
reaches the browser's default, and that is the whole contract: nothing in
v4 reads `isDefaultPrevented()`, so it cannot stop a tap selecting or a
grab starting.  Gesture defaults are controlled by their explicit toggles
instead — `autoungrabify`, `autounselectify`, `boxSelectionEnabled`,
`userPanningEnabled`/`userZoomingEnabled`, and the per-element grains
(`ungrabify()`, `unselectify()`).  This spent two sittings as an open
question (v3 never reads the flag either, so there was no behaviour to
port); the maintainer closed it by declining the proposed gesture rows —
the toggles were already sufficient at every grain the rows offered.
*/

/** The DOM event a gesture came from, when there was one. */
type NativeEvent = globalThis.Event;

/**
 * What an event can target: the core for core-level events (viewport
 * gestures, `layoutstart`, graph `data`), or a one-element collection for
 * element events.
 */
export type EventTarget = Core | Collection;

/** The fields an emit may carry. */
export interface EventProps {
  type?: string;
  target?: EventTarget;
  cy?: Core;
  /** model-space position, for pointer-derived events */
  position?: Position;
  /** rendered-space position; derived from `position` when omitted */
  renderedPosition?: Position;
  /** the DOM event behind a gesture (round 41.4) */
  originalEvent?: NativeEvent;
  /** the layout instance, on `layoutstart`/`layoutready`/`layoutstop` */
  layout?: unknown;
  timeStamp?: number;
}

const returnFalse = (): boolean => false;
const returnTrue = (): boolean => true;

/**
 * A v4 event (round 41.1).  Handlers receive one of these; `cy.emit()` and
 * `eles.emit()` accept either a type string or a props object, and build it.
 *
 * @see Core#on for what a name may be, and which names never fire
 */
export class Event {
  // -- what happened --

  /** the event type, e.g. `'tap'` — never namespaced (round 41.1) */
  type: string;
  /** the core for core-level events, the element for element events */
  target?: EventTarget;
  /** the core the event was raised on */
  cy?: Core;
  /** model-space position, on pointer-derived events */
  position?: Position;
  /** rendered-space position; derived from `position` and the viewport */
  renderedPosition?: Position;
  /** the DOM event behind a gesture, when there was one (round 41.4) */
  originalEvent?: NativeEvent;
  /** the layout instance, on the layout lifecycle events */
  layout?: unknown;
  /** when the event was built, `Date.now()` unless the caller supplied one */
  timeStamp: number;

  /**
   * Whether `preventDefault()` has been called.
   *
   * **Recorded, never read by v4**: by decided design `preventDefault()`
   * suppresses no gesture default — it forwards to the DOM event when one
   * is attached, and gesture defaults are controlled by their explicit
   * toggles instead.  See the module comment.
   */
  isDefaultPrevented: () => boolean = returnFalse;
  /** Whether `stopPropagation()` has been called — read by the compound
   * bubbling walk (round 14.5), where it halts the phase sequence. */
  isPropagationStopped: () => boolean = returnFalse;

  /**
   * Build an event.
   *
   * @param props — the fields to carry; `type` is required in practice and
   *   defaults to the empty string so a malformed emit is inert rather than
   *   throwing inside a handler loop
   */
  constructor(props: EventProps = {}) {
    this.type = props.type ?? '';
    this.target = props.target;
    this.cy = props.cy;
    this.position = props.position;
    this.renderedPosition = props.renderedPosition;
    this.originalEvent = props.originalEvent;
    this.layout = props.layout;

    // the rendered position follows from the model one and the viewport, so
    // an emitter only has to supply the model position it actually knows
    if (
      this.cy != null &&
      this.position != null &&
      this.renderedPosition == null
    ) {
      const zoom = this.cy.zoom() as number;
      const pan = this.cy.pan() as Position;

      this.renderedPosition = {
        x: this.position.x * zoom + pan.x,
        y: this.position.y * zoom + pan.y,
      };
    }

    this.timeStamp = props.timeStamp ?? Date.now();
  }

  /**
   * v3's type tag, kept because `is.event()`-style checks and user code read
   * it.
   *
   * @returns the string `'event'`
   */
  instanceString(): string {
    return 'event';
  }

  // -- controlling propagation --

  /**
   * Mark the event's default as prevented, and prevent the DOM event's
   * default when one is attached.
   *
   * **Browser-level only, by decided design** — no v4 code reads
   * `isDefaultPrevented()`, so this cannot stop a tap from selecting or a
   * grab from starting; use the explicit toggles (`autoungrabify`,
   * `autounselectify`, `boxSelectionEnabled`, …) for gesture control.
   * With `originalEvent` populated (round 41.4) this reaches the
   * browser's default.
   */
  preventDefault(): void {
    this.isDefaultPrevented = returnTrue;
    this.originalEvent?.preventDefault?.();
  }

  /**
   * Stop the event bubbling to further phases: the remaining ancestors and
   * the core do not see it (round 14.5).  Returning `false` from a handler
   * does the same.  With `originalEvent` attached (round 41.4) this also
   * calls the DOM event's `stopPropagation()`, so an outer DOM listener
   * stops seeing it too.
   */
  stopPropagation(): void {
    this.isPropagationStopped = returnTrue;
    this.originalEvent?.stopPropagation?.();
  }
}

export default Event;
