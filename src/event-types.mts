// Public event-object typing surface.
//
// The runtime representation is the `Event` class in `./event.mts`; these
// interfaces are the public, narrowed view handed to event-binding callbacks
// (`cy.on`, `eles.on`, …). They mirror the hierarchy of the old hand-written
// `index.d.ts` so downstream consumers can annotate handlers with the precise
// target kind, e.g. `cy.on('tap', 'node', (e: EventObjectNode) => …)`.
import type { Position } from './types.mjs';
import type { Core } from './core/core-types.mjs';
import type { NodeSingular, EdgeSingular } from './collection/eles-types.mjs';

type NativeEvent = globalThis.Event;

/** Fields and methods common to every event object (jQuery-like). */
export interface AbstractEventObject {
  /** the corresponding core instance */
  cy: Core;
  /**
   * the element or core that first caused the event.
   *
   * Typed `any` so the narrowed `EventObjectNode`/`EventObjectEdge`/
   * `EventObjectCore` variants (which fix `target` to a specific kind) remain
   * usable as handler parameters despite function-parameter contravariance —
   * matching the original hand-written declarations. Prefer the narrowed
   * variants when the target kind is known.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above; enables narrowed-handler assignability
  target: any;
  /** the event type string (e.g. `'tap'`) */
  type: string;
  /** the event namespace string (e.g. `'foo'` for `'tap.foo'`) */
  namespace: string;
  /** Unix epoch time of the event, in milliseconds */
  timeStamp: number;

  preventDefault(): void;
  stopPropagation(): void;
  stopImmediatePropagation(): void;
  isDefaultPrevented(): boolean;
  isPropagationStopped(): boolean;
  isImmediatePropagationStopped(): boolean;
}

/** Event object for user-input device events (taps, drags, …). */
export interface InputEventObject extends AbstractEventObject {
  /** the model position of the event */
  position: Position;
  /** the rendered position of the event */
  renderedPosition: Position;
  /** the original user input device event */
  originalEvent: NativeEvent;
}

/** Event object for layout events. */
export interface LayoutEventObject extends AbstractEventObject {
  /** the layout that triggered the event */
  layout: unknown;
}

/** The event object passed to handlers; carries both input and layout fields. */
export interface EventObject extends InputEventObject, LayoutEventObject {}

/** An event whose target is a node. */
export interface EventObjectNode extends EventObject {
  target: NodeSingular;
}

/** An event whose target is an edge. */
export interface EventObjectEdge extends EventObject {
  target: EdgeSingular;
}

/** An event whose target is the core. */
export interface EventObjectCore extends EventObject {
  target: Core;
}

/** A user-supplied event-binding callback. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- emitted extra parameters are application-defined callback inputs
export type EventHandler = ( event: EventObject, ...extraParams: any[] ) => void;
