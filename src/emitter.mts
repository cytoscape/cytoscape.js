import { GpuEvent } from './event.mjs';
import type { GpuEventProps } from './event.mjs';

/*
v4's emitter (round 41.2), replacing the shared v3 emitter (now
`v3/src/emitter.mts`) — the module round 41's plan believed was the last one
v4 imported from outside itself, and a precondition of the round-42
restructure.  It was not the last: five utility modules remained, which round
42 duplicated rather than shared, so `src/` now imports nothing outside it.

It is the same *model* the core already used: one emitter per core, holding
every listener — core, delegated and per-element — told apart by a
qualifier, with the matching rules injected by `events.mts`.  What is gone:

  - **namespaces**, machinery and all.  v3 splits every registered and every
    emitted name on `.` and matches type and namespace separately.  v4's
    design has said "no namespaces" since round 9, but importing v3's
    emitter meant importing its parser, so a hand-emitted `'tap.ns'` behaved
    exactly as in v3 until this round (measured 37.4).  Here a name is a
    name: `'tap.ns'` is a type, matched whole.
  - **`bubble`/`parent`**, which v4 never used — compound bubbling is a phase
    walk driven by the core (round 14.5), not emitter recursion.
  - **the `manualCallback` emit argument**, unused by v4.
  - **the function-in-qualifier-position shorthand**: every v4 call site
    passes the qualifier explicitly (`null` when there is none), so the
    argument shifting v3 does for `on( 'tap', cb )` is unnecessary here — and
    ambiguity is what let a v3-style selector string reach the emitter and
    detonate one event later, before 29.3 closed it.

What is deliberately kept, because behaviour depends on it: the listener
snapshot at emit time (a handler that registers another listener does not
see it fire for the same event), the copy-on-`off`-during-emit, `one`
removing before the callback runs, and a handler returning `false` meaning
`stopPropagation()`.
*/

/** An event handler.  `this` is the callback context the emitter's options
 * choose — the core, or the phase element during compound bubbling. */
export type EventHandler = ( this: unknown, event: GpuEvent, ...extraParams: unknown[] ) => unknown;

/** A registered listener. */
export interface Listener<TQualifier = unknown> {
  /** the event type, matched whole (no namespace splitting) */
  type: string;
  callback: EventHandler;
  /** what restricts this listener — an element ref or a predicate */
  qualifier?: TQualifier | null;
  /** remove after the first matching emit */
  one?: boolean;
}

/** The hooks that make one emitter behave as v4's qualified-listener model;
 * `events.mts` supplies all four. */
export interface GpuEmitterOptions<TContext, TQualifier> {
  /** the emitter context — the core */
  context: TContext;
  /** whether two qualifiers denote the same restriction, for `off()` */
  qualifierCompare( q1: TQualifier | null | undefined, q2: TQualifier | null | undefined ): boolean;
  /** whether this listener should fire for this event (the phase rules) */
  eventMatches( context: TContext, listener: Listener<TQualifier>, event: GpuEvent ): boolean;
  /** fill in fields every event carries (`cy`, a default `target`) */
  addEventFields( context: TContext, props: GpuEventProps ): void;
  /** what `this` is inside the callback (v3's currentTarget semantics) */
  callbackContext( context: TContext, listener: Listener<TQualifier>, event: GpuEvent ): unknown;
}

/** Anything `emit()` accepts: one or more space-separated type names, a
 * props object, or an already-built event (the bubbling walk re-emits one). */
export type EmitInput = string | GpuEventProps | GpuEvent;

/** Split a `'tap drag'` list into names, ignoring empty entries. */
const typesOf = ( events: string ): string[] => {
  return events.split( /\s+/ ).filter( s => s.length > 0 );
};

/**
 * The one emitter a v4 core owns (round 41.2).
 *
 * @see makeCoreEmitter in `events.mts`, which is the only place one is built
 */
export class GpuEmitter<TContext = unknown, TQualifier = unknown> {
  /** every listener on this core, in registration order */
  listeners: Listener<TQualifier>[] = [];
  /** emit depth, so `off()` during an emit copies rather than mutates */
  emitting = 0;

  private opts: GpuEmitterOptions<TContext, TQualifier>;

  /**
   * @param opts — the context and the four matching hooks
   */
  constructor( opts: GpuEmitterOptions<TContext, TQualifier> ){
    this.opts = opts;
  }

  /**
   * Register a listener for one or more space-separated event names.
   *
   * @param events — the name(s); any name is legal, and one v4 never emits
   *   simply never fires
   * @param qualifier — the restriction, or null for an unqualified listener
   * @param callback — the handler; a non-function is ignored, so
   *   `cy.on( 'tap' )` registers nothing rather than throwing
   * @param one — remove the listener after its first matching emit
   * @returns this emitter
   */
  on(
    events: string, qualifier?: TQualifier | null, callback?: EventHandler, one?: boolean
  ): this {
    if( typeof callback !== 'function' ){ return this; }

    for( const type of typesOf( events ) ){
      this.listeners.push( { type, callback, qualifier, one } );
    }

    return this;
  }

  /**
   * Register a listener that fires at most once.
   *
   * @param events — the name(s)
   * @param qualifier — the restriction, or null
   * @param callback — the handler
   * @returns this emitter
   */
  one( events: string, qualifier?: TQualifier | null, callback?: EventHandler ): this {
    return this.on( events, qualifier, callback, true );
  }

  /**
   * Remove listeners.  A listener matches when its type matches (or `events`
   * is `'*'`), its qualifier compares equal (when one is given), and its
   * callback is identical (when one is given).
   *
   * @param events — the name(s), or `'*'` for every type
   * @param qualifier — restrict the removal to this qualifier
   * @param callback — restrict the removal to this handler
   * @returns this emitter
   */
  off( events: string, qualifier?: TQualifier | null, callback?: EventHandler ): this {
    // a handler removing listeners mid-emit must not shrink the array the
    // emit loop is walking
    if( this.emitting !== 0 ){ this.listeners = this.listeners.slice(); }

    const all = events === '*';
    const types = all ? [] : typesOf( events );

    this.listeners = this.listeners.filter( listener => {
      const typeMatches = all || types.includes( listener.type );

      if( !typeMatches ){ return true; }
      if( qualifier != null && !this.opts.qualifierCompare( listener.qualifier, qualifier ) ){
        return true;
      }
      if( callback != null && listener.callback !== callback ){ return true; }

      return false; // matched: drop it
    } );

    return this;
  }

  /**
   * Remove every listener on this core.
   *
   * @returns this emitter
   */
  removeAllListeners(): this {
    return this.off( '*' );
  }

  /**
   * Emit one or more events.
   *
   * @param events — space-separated names, a props object, or a built event
   * @param extraParams — extra arguments passed to each handler after the
   *   event; a non-array is wrapped
   * @returns this emitter
   */
  emit( events: EmitInput, extraParams?: unknown ): this {
    const extra = Array.isArray( extraParams ) ? extraParams
      : extraParams === undefined ? [] : [ extraParams ];

    this.emitting++;

    try {
      if( events instanceof GpuEvent ){
        this.emitOne( events, extra );
      } else if( typeof events === 'object' && events !== null ){
        this.emitOne( this.build( events ), extra );
      } else {
        for( const type of typesOf( events ) ){
          this.emitOne( this.build( { type } ), extra );
        }
      }
    } finally {
      this.emitting--;
    }

    return this;
  }

  /** Build an event from props, letting the options fill in `cy`/`target`. */
  private build( props: GpuEventProps ): GpuEvent {
    this.opts.addEventFields( this.opts.context, props );

    return new GpuEvent( props );
  }

  /** Run one event past the listener list as it stood when the emit began. */
  private emitOne( event: GpuEvent, extra: unknown[] ): void {
    const listeners = this.listeners;
    // the snapshot: a handler registering another listener for the same type
    // does not have it fire for *this* event (v3's semantics, and what keeps
    // an `on` inside a handler from looping)
    const count = listeners.length;

    for( let i = 0; i < count; i++ ){
      const listener = listeners[ i ];

      if( listener.type !== event.type ){ continue; }
      if( !this.opts.eventMatches( this.opts.context, listener, event ) ){ continue; }

      // `one` removes before the call, so a handler that re-registers works
      if( listener.one ){ this.listeners = this.listeners.filter( l => l !== listener ); }

      const context = this.opts.callbackContext( this.opts.context, listener, event );
      const ret = listener.callback.apply( context, [ event, ...extra ] );

      if( ret === false ){
        event.stopPropagation();
        event.preventDefault();
      }
    }
  }
}

export default GpuEmitter;
