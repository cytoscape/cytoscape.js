import Emitter from '../emitter.mjs';
import type Event from '../event.mjs';
import type { Listener } from '../emitter.mjs';
import type { GroupName, Ref } from './contract.mjs';
import { matchesRef, parseSelector } from './selector.mjs';
import type { CompiledSelector } from './selector.mjs';
import type { GraphStore } from './store/graph-store.mjs';
import type { CoreShim } from '../types.mjs';

/*
A single core Emitter (reusing src/emitter.mts unmodified) with
slot/selector-qualified listeners instead of per-element emitters.

- `cy.on(events, cb)`                → unqualified listener
- `cy.on(events, selector, cb)`     → selector qualifier
- `eles.on(events, cb)`             → one listener per element, ref qualifier

Known deviation from v3: element-vs-core listener firing order is plain
registration order on the single emitter, not v3 bubble order.
*/

/** What a listener is restricted to: a single element ref, or a selector. */
export interface GpuQualifier {
  key: string;
  ref?: Ref;
  selector?: CompiledSelector;
}

/** The face an element handle shows the event system. */
export interface EleEventTarget {
  _eventRef(): Ref | null;
  id(): string | undefined;
  group(): GroupName | undefined;
}

export const refKey = ( ref: Ref ): string => `${ref.group}:${ref.slot}:${ref.gen}`;

export const refQualifier = ( ref: Ref ): GpuQualifier => ( { key: 'ref:' + refKey( ref ), ref } );

export const selectorQualifier = ( selector: string ): GpuQualifier => (
  { key: 'sel:' + selector, selector: parseSelector( selector ) }
);

const isEleTarget = ( target: unknown ): target is EleEventTarget => {
  return target != null && typeof ( target as EleEventTarget )._eventRef === 'function';
};

const sameRef = ( a: Ref, b: Ref ): boolean => {
  return a.group === b.group && a.slot === b.slot && a.gen === b.gen;
};

// Matches against the handle's cached id/group (not store lookups) so that
// e.g. `cy.on('remove', 'node', ...)` still matches the just-removed target.
const matchesSelectorTarget = (
  store: GraphStore, target: EleEventTarget, ref: Ref, selector: CompiledSelector
): boolean => {
  if( store.isCurrent( ref ) ){
    return matchesRef( store, ref, selector );
  }

  return selector.terms.some( term => {
    if( term.group != null && target.group() !== term.group ){ return false; }
    if( term.id != null && target.id() !== term.id ){ return false; }
    if( term.selected != null ){
      return false; // removed elements can't satisfy live state checks
    }

    return true;
  } );
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

      if( qualifier.selector != null ){
        return matchesSelectorTarget( ctx._store, target, ref, qualifier.selector );
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
