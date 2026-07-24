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

Known deviation from v3: element-vs-core listener firing order is plain
registration order on the single emitter, not v3 bubble order.
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

export const refKey = ( ref: Ref ): string => `${ref.group}:${ref.slot}:${ref.gen}`;

export const refQualifier = ( ref: Ref ): GpuQualifier => ( { key: 'ref:' + refKey( ref ), ref } );

/** Predicate qualifiers compare by function identity (for off()). */
export const predicateQualifier = ( fn: ElePredicate ): GpuQualifier => ( { fn } );

const isEleTarget = ( target: unknown ): target is EleEventTarget => {
  return target != null && typeof ( target as EleEventTarget )._eventRef === 'function';
};

const sameRef = ( a: Ref, b: Ref ): boolean => {
  return a.group === b.group && a.slot === b.slot && a.gen === b.gen;
};

/** The face the core shows the event system (the emitter context and default target). */
export interface GpuCoreLike {
  _store: GraphStore;
}

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

      if( qualifier == null ){ return true; }

      const target = eventObj.target;

      if( !isEleTarget( target ) ){ return false; }

      const ref = target._eventRef();

      if( ref == null ){ return false; }

      if( qualifier.ref != null ){
        return sameRef( qualifier.ref, ref );
      }

      if( qualifier.fn != null ){
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
      return listener.qualifier != null ? eventObj.target : ctx;
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
