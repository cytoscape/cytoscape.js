import Emitter from '../emitter.mjs';
import type Event from '../event.mjs';
import type { Listener } from '../emitter.mjs';
import type { GroupName, Ref } from './contract.mjs';
import type { GraphStore } from './store/graph-store.mjs';
import type { GpuCollection } from './collection.mjs';
import type { CoreShim } from '../types.mjs';

/*
A single core Emitter (reusing src/emitter.mts unmodified) with
slot/predicate-qualified listeners instead of per-element emitters.

- `cy.on(events, cb)`                → unqualified listener
- `cy.on(events, predicate, cb)`    → predicate qualifier (delegation)
- `eles.on(events, cb)`             → one listener per element, ref qualifier

v4 has no selector strings: delegation takes a predicate function over
the event target, e.g. `cy.on('tap', ele => ele.isNode(), cb)`.  The
predicate only runs for element targets; on `remove` events the target
handle's cached `id()`/`group()` stay readable, while live state reads
(`selected()` etc.) report the removed element as not having the state.

Compound bubbling (round 14.5): an element event on a node with
ancestors runs in *phases* — the origin element, each ancestor in
child->parent order, then the core — driven by `_emitOnEle` re-emitting
one Event object with a moving `_gpuPhaseRef`.  Per phase:

- element (ref-qualified) listeners fire in their own element's phase,
  with the callback context set to that element (v3's currentTarget)
  while `event.target` stays the originator;
- unqualified core listeners fire once, in the core phase;
- predicate listeners keep v3 delegation semantics: once, against the
  originator, when the event reaches the core.

`stopPropagation()` (or a callback returning false) between phases
halts the walk — the shared Event object carries the flag.  Flat emits
(no compounds, orphan/edge targets) never set `_gpuPhaseRef` and take
exactly the old single-emit path.

Known deviation from v3: listener firing order *within a phase* is
plain registration order on the single emitter; cross-phase order is
v3's bubble order.
*/

/** A delegation predicate over an element event target. */
export type ElePredicate = ( ele: GpuCollection ) => boolean;

/** What a listener is restricted to: a single element ref, or a predicate. */
export interface GpuQualifier {
  key?: string;
  ref?: Ref;
  fn?: ElePredicate;
}

/** The face an element handle shows the event system. */
export interface EleEventTarget {
  _eventRef(): Ref | null;
  id(): string | undefined;
  group(): GroupName | undefined;
}

/** A ref's identity as a string, generation included — so a recycled
 * slot never collides with the listeners of the element it replaced. */
export const refKey = ( ref: Ref ): string => `${ref.group}:${ref.slot}:${ref.gen}`;

/** Element qualifier for `eles.on()`.  Ref qualifiers compare by `key`,
 * so `off()` matches a listener registered through a different handle
 * for the same element. */
export const refQualifier = ( ref: Ref ): GpuQualifier => ( { key: 'ref:' + refKey( ref ), ref } );

/**
 * Predicate qualifiers compare by function identity (for off()).
 *
 * @param fn — the delegation predicate
 * @throws if given anything but a function — v4 has no selector strings,
 *   and a v3-style `cy.on('tap', 'node', cb)` used to be accepted here
 *   and then throw a TypeError inside the emitter on the *next* event of
 *   that type, which is both late and somewhere else (29.3)
 */
export const predicateQualifier = ( fn: ElePredicate ): GpuQualifier => {
  if( typeof fn !== 'function' ){
    throw new Error(
      `Event delegation takes a predicate function, not ${typeof fn === 'string'
        ? `the selector string '${fn}'` : `a ${typeof fn}`} — ` +
      `v4 has no selector strings; use e.g. cy.on( 'tap', ele => ele.isNode(), handler )` );
  }

  return { fn };
};

const isEleTarget = ( target: unknown ): target is EleEventTarget => {
  return target != null && typeof ( target as EleEventTarget )._eventRef === 'function';
};

const sameRef = ( a: Ref, b: Ref ): boolean => {
  return a.group === b.group && a.slot === b.slot && a.gen === b.gen;
};

/** The bubbling-phase fields _emitOnEle stamps onto the shared Event
 * (round 14.5): a ref during element phases, null during the core
 * phase, absent entirely on flat emits. */
export interface PhasedEvent extends Event {
  _gpuPhaseRef?: Ref | null;
  _gpuPhaseEle?: unknown;
}

/** The face the core shows the event system (the emitter context and default target). */
export interface GpuCoreLike {
  _store: GraphStore;
}

/**
 * Build the one Emitter a core owns.  Every listener in v4 — core,
 * delegated, and per-element — lives on this single emitter and is told
 * apart by its qualifier, so the store keeps no per-element emitters.
 * The wiring here is what implements the phase rules described above:
 * `eventMatches` decides which listeners fire in which bubbling phase,
 * and `callbackContext` supplies v3's `currentTarget` semantics.
 *
 * @param cy — the core; becomes the emitter context and the default
 *   `event.target`
 * @returns the emitter, to be stored on the core
 */
export const makeCoreEmitter = <TCy extends GpuCoreLike>( cy: TCy ): Emitter<TCy, GpuQualifier> => {
  return new Emitter<TCy, GpuQualifier>( {
    context: cy,

    qualifierCompare: ( q1, q2 ) => {
      if( q1 == null || q2 == null ){
        return q1 == null && q2 == null;
      }

      if( q1.fn != null || q2.fn != null ){
        return q1.fn === q2.fn;
      }

      return q1.key === q2.key;
    },

    eventMatches: ( ctx: TCy, listener: Listener<GpuQualifier>, eventObj: Event ): boolean => {
      const qualifier = listener.qualifier;
      const phaseRef = ( eventObj as PhasedEvent )._gpuPhaseRef;

      if( qualifier == null ){
        // unqualified listeners fire once: in the core phase (or flat mode)
        return phaseRef === undefined || phaseRef === null;
      }

      const target = eventObj.target;

      if( !isEleTarget( target ) ){ return false; }

      const ref = target._eventRef();

      if( ref == null ){ return false; }

      if( qualifier.ref != null ){
        // phased mode: an element listener fires in its element's phase
        if( phaseRef !== undefined ){
          return phaseRef != null && sameRef( qualifier.ref, phaseRef );
        }

        return sameRef( qualifier.ref, ref );
      }

      if( qualifier.fn != null ){
        // predicates keep v3 delegation: once, against the originator,
        // when the event reaches the core
        if( phaseRef !== undefined && phaseRef !== null ){ return false; }

        return qualifier.fn( target as unknown as GpuCollection );
      }

      return false;
    },

    addEventFields: ( ctx: TCy, evt ) => {
      evt.cy = ctx as unknown as CoreShim;

      if( evt.target == null ){
        evt.target = ctx;
      }
    },

    callbackContext: ( ctx: TCy, listener: Listener<GpuQualifier>, eventObj: Event ) => {
      if( listener.qualifier != null ){
        // during an ancestor phase the context is the phase element
        // (v3's currentTarget); event.target stays the originator
        return ( eventObj as PhasedEvent )._gpuPhaseEle ?? eventObj.target;
      }

      return ctx;
    }
  } );
};

/** Whether any listener is registered for the given event type (used to skip hot-path emits). */
export const hasListeners = ( emitter: { listeners: { type: string }[] }, type: string ): boolean => {
  const listeners = emitter.listeners;

  for( let i = 0; i < listeners.length; i++ ){
    if( listeners[ i ].type === type ){ return true; }
  }

  return false;
};
