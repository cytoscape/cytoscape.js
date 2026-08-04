import type { Position } from './gpu-types.mjs';
import type { GpuCore } from './core.mjs';
import type { GpuCollection } from './collection.mjs';

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
     `GpuCore#on`).  Until this round v4 imported v3's emitter and so
     inherited full v3 namespace semantics, which contradicted the design and
     nobody had noticed (measured round 37.4).

`preventDefault()` is **inert for v4's own gesture defaults**, deliberately
and temporarily.  Its DOM half works (41.4): with `originalEvent` attached
it reaches the browser's default.  What it cannot do is stop a tap
selecting or a grab starting, because nothing in v4 reads
`isDefaultPrevented()`.  The fifth design sitting decided it should become
functional, but the enumeration of *which* gesture defaults it gates could
not be derived the way round 41's plan expected — v3 never reads the flag
either, so there is no v3 behaviour to port.  That enumeration is logged as
an open call; the flag is recorded here so the machinery is ready for it.
*/

/** The DOM event a gesture came from, when there was one. */
type NativeEvent = globalThis.Event;

/**
 * What an event can target: the core for core-level events (viewport
 * gestures, `layoutstart`, graph `data`), or a one-element collection for
 * element events.
 */
export type GpuEventTarget = GpuCore | GpuCollection;

/** The fields an emit may carry. */
export interface GpuEventProps {
  type?: string;
  target?: GpuEventTarget;
  cy?: GpuCore;
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
 * @see GpuCore#on for what a name may be, and which names never fire
 */
export class GpuEvent {
  /** the event type, e.g. `'tap'` — never namespaced (round 41.1) */
  type: string;
  /** the core for core-level events, the element for element events */
  target?: GpuEventTarget;
  /** the core the event was raised on */
  cy?: GpuCore;
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
   * **Recorded**: nothing in v4 reads this yet, so calling `preventDefault()`
   * suppresses no gesture default — it only forwards to the DOM event when
   * one is attached.  Making it functional is decided but not yet built; see
   * the module comment and PLAN.md's open calls.
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
  constructor( props: GpuEventProps = {} ){
    this.type = props.type ?? '';
    this.target = props.target;
    this.cy = props.cy;
    this.position = props.position;
    this.renderedPosition = props.renderedPosition;
    this.originalEvent = props.originalEvent;
    this.layout = props.layout;

    // the rendered position follows from the model one and the viewport, so
    // an emitter only has to supply the model position it actually knows
    if( this.cy != null && this.position != null && this.renderedPosition == null ){
      const zoom = this.cy.zoom() as number;
      const pan = this.cy.pan() as Position;

      this.renderedPosition = {
        x: this.position.x * zoom + pan.x,
        y: this.position.y * zoom + pan.y
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

  /**
   * Mark the event's default as prevented, and prevent the DOM event's
   * default when one is attached.
   *
   * **Inert for v4's own gesture defaults today** — no v4 code reads
   * `isDefaultPrevented()`, so this cannot stop a tap from selecting or a
   * grab from starting.  The DOM half does work: with `originalEvent`
   * populated (round 41.4) this reaches the browser's default.
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

export default GpuEvent;
