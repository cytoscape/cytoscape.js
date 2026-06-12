import * as util from './util/index.mjs';
import * as is from './is.mjs';
import Event, { type EventProps } from './event.mjs';

const eventRegex = /^([^.]+)(\.(?:[^.]+))?$/; // regex for matching event strings (e.g. "click.namespace")
const universalNamespace = '.*'; // matches as if no namespace specified and prevents users from unbinding accidentally

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- handlers accept arbitrary extra emit params
export type EventHandler = ( this: any, event: Event, ...extraParams: any[] ) => unknown;

export interface Listener<TQualifier = unknown> {
  event: string | undefined; // full event string
  callback: EventHandler; // callback to run
  type: string; // the event type (e.g. 'click')
  namespace: string | null | undefined; // the event namespace (e.g. ".foo")
  qualifier?: TQualifier | null; // a restriction on whether to match this emitter
  conf?: ListenerConf | null; // additional configuration
}

export interface ListenerConf {
  one?: boolean;
}

/** Something an event can bubble up to: it can emit further. */
interface ParentEmitTarget {
  emit( events: Event, extraParams?: unknown[] ): unknown;
}

export interface EmitterOptions<TContext, TQualifier = unknown> {
  qualifierCompare?( q1: TQualifier | null | undefined, q2: TQualifier | null | undefined ): boolean;
  eventMatches?( context: TContext, listener: Listener<TQualifier>, eventObj: Event ): boolean;
  addEventFields?( context: TContext, evt: EventProps ): void;
  callbackContext?( context: TContext, listener: Listener<TQualifier>, eventObj: Event ): unknown;
  beforeEmit?( context: TContext, listener: Listener<TQualifier>, eventObj: Event ): void;
  afterEmit?( context: TContext, listener: Listener<TQualifier>, eventObj: Event ): void;
  bubble?( context: TContext ): boolean;
  parent?( context: TContext ): ParentEmitTarget | null;
  context?: TContext;
}

const defaults = {
  qualifierCompare: function( q1: unknown, q2: unknown ){
    return q1 === q2;
  },
  eventMatches: function( /*context, listener, eventObj*/ ){
    return true;
  },
  addEventFields: function( /*context, evt*/ ){
  },
  callbackContext: function( context: unknown/*, listener, eventObj*/ ){
    return context;
  },
  beforeEmit: function(/* context, listener, eventObj */){
  },
  afterEmit: function(/* context, listener, eventObj */){
  },
  bubble: function( /*context*/ ){
    return false;
  },
  parent: function( /*context*/ ){
    return null;
  },
  context: null
};

let defaultsKeys = Object.keys( defaults ) as ( keyof typeof defaults )[];
let emptyOpts = {};

export type EmitInput = string | string[] | Event | EventProps;

class Emitter<TContext = unknown, TQualifier = unknown> {
  declare qualifierCompare: ( q1: TQualifier | null | undefined, q2: TQualifier | null | undefined ) => boolean;
  declare eventMatches: ( context: TContext, listener: Listener<TQualifier>, eventObj: Event ) => boolean;
  declare addEventFields: ( context: TContext, evt: EventProps ) => void;
  declare callbackContext: ( context: TContext, listener: Listener<TQualifier>, eventObj: Event ) => unknown;
  declare beforeEmit: ( context: TContext, listener: Listener<TQualifier>, eventObj: Event ) => void;
  declare afterEmit: ( context: TContext, listener: Listener<TQualifier>, eventObj: Event ) => void;
  declare bubble: ( context: TContext ) => boolean;
  declare parent: ( context: TContext ) => ParentEmitTarget | null;
  declare context: TContext;

  listeners: Listener<TQualifier>[];
  emitting: number;

  constructor( opts: EmitterOptions<TContext, TQualifier> = emptyOpts, context?: TContext ){
    // micro-optimisation vs Object.assign() -- reduces Element instantiation time
    for( let i = 0; i < defaultsKeys.length; i++ ){
      let key = defaultsKeys[i];

      // dynamic per-key merge of opts over defaults; precisely typed per-field above
      ( this as Record<string, unknown> )[key] = ( opts as Record<string, unknown> )[key] || defaults[key];
    }

    this.context = context || this.context;
    this.listeners = [];
    this.emitting = 0;
  }

  on( events: string | string[], qualifier?: TQualifier | EventHandler | null, callback?: EventHandler, conf?: ListenerConf | null, confOverrides?: ListenerConf ): this {
    forEachEvent( this, function( self, event, type, namespace, qualifier, callback, conf ){
      if( is.fn( callback ) ){
        self.listeners.push( {
          event: event, // full event string
          callback: callback, // callback to run
          type: type, // the event type (e.g. 'click')
          namespace: namespace, // the event namespace (e.g. ".foo")
          qualifier: qualifier, // a restriction on whether to match this emitter
          conf: conf // additional configuration
        } );
      }
    }, events, qualifier, callback, conf, confOverrides );

    return this;
  }

  declare addListener: this['on'];

  one( events: string | string[], qualifier?: TQualifier | EventHandler | null, callback?: EventHandler, conf?: ListenerConf | null ): this {
    return this.on( events, qualifier, callback, conf, { one: true } );
  }

  off( events: string | string[], qualifier?: TQualifier | EventHandler | null, callback?: EventHandler, conf?: ListenerConf | null ): this {
    if( this.emitting !== 0 ){
      this.listeners = util.copyArray( this.listeners );
    }

    let listeners = this.listeners;

    for( let i = listeners.length - 1; i >= 0; i-- ){
      let listener = listeners[i];

      forEachEvent( this, function( self, event, type, namespace, qualifier, callback/*, conf*/ ){
        if(
          ( listener.type === type || events === '*' ) &&
          ( (!namespace && listener.namespace !== '.*') || listener.namespace === namespace ) &&
          ( !qualifier || self.qualifierCompare( listener.qualifier, qualifier ) ) &&
          ( !callback || listener.callback === callback )
        ){
          listeners.splice( i, 1 );

          return false;
        }
      }, events, qualifier, callback, conf );
    }

    return this;
  }

  declare removeListener: this['off'];

  removeAllListeners(): this {
    return this.off('*'); // removeListener === off (alias)
  }

  emit( events: EmitInput, extraParams?: unknown, manualCallback?: EventHandler ): this {
    let listeners = this.listeners;
    let numListenersBeforeEmit = listeners.length;

    this.emitting++;

    if( !is.array( extraParams ) ){
      extraParams = [ extraParams ];
    }

    forEachEventObj( this, function( self, eventObj ){
      if( manualCallback != null ){
        listeners = [{
          event: ( eventObj as Event & { event?: string } ).event,
          type: eventObj.type,
          namespace: eventObj.namespace,
          callback: manualCallback
        }];

        numListenersBeforeEmit = listeners.length;
      }

      for( let i = 0; i < numListenersBeforeEmit; i++ ){
        let listener = listeners[i];

        if(
          ( listener.type === eventObj.type ) &&
          ( !listener.namespace || listener.namespace === eventObj.namespace || listener.namespace === universalNamespace ) &&
          ( self.eventMatches( self.context, listener, eventObj ) )
        ){
          let args: unknown[] = [ eventObj ];

          if( extraParams != null ){
            util.push( args, extraParams as unknown[] );
          }

          self.beforeEmit( self.context, listener, eventObj );

          if( listener.conf && listener.conf.one ){
            self.listeners = self.listeners.filter( l => l !== listener );
          }

          let context = self.callbackContext( self.context, listener, eventObj );
          let ret = listener.callback.apply( context, args as [ Event, ...unknown[] ] );

          self.afterEmit( self.context, listener, eventObj );

          if( ret === false ){
            eventObj.stopPropagation();
            eventObj.preventDefault();
          }
        } // if listener matches
      } // for listener

      if( self.bubble( self.context ) && !eventObj.isPropagationStopped() ){
        self.parent( self.context )!.emit( eventObj, extraParams as unknown[] );
      }
    }, events );

    this.emitting--;

    return this;
  }

  declare trigger: this['emit'];
}

Emitter.prototype.addListener = Emitter.prototype.on;
Emitter.prototype.removeListener = Emitter.prototype.off;
Emitter.prototype.trigger = Emitter.prototype.emit;

type ForEachEventHandler<TContext, TQualifier> = (
  self: Emitter<TContext, TQualifier>,
  event: string,
  type: string,
  namespace: string | null,
  qualifier: TQualifier | null | undefined,
  callback: EventHandler | undefined,
  conf: ListenerConf | null | undefined
) => boolean | void;

let forEachEvent = function<TContext, TQualifier>(
  self: Emitter<TContext, TQualifier>,
  handler: ForEachEventHandler<TContext, TQualifier>,
  events: string | string[],
  qualifier: TQualifier | EventHandler | null | undefined,
  callback: EventHandler | undefined,
  conf: ListenerConf | null | undefined,
  confOverrides?: ListenerConf
): void {
  if( is.fn( qualifier ) ){
    callback = qualifier as EventHandler;
    qualifier = null;
  }

  if( confOverrides ){
    if( conf == null ){
      conf = confOverrides;
    } else {
      conf = util.assign( {}, conf, confOverrides );
    }
  }

  let eventList = is.array(events) ? events : events.split(/\s+/);

  for( let i = 0; i < eventList.length; i++ ){
    let evt = eventList[i];

    if( is.emptyString( evt ) ){ continue; }

    let match = evt.match( eventRegex ); // type[.namespace]

    if( match ){
      let type = match[1];
      let namespace = match[2] ? match[2] : null;
      let ret = handler( self, evt, type, namespace, qualifier as TQualifier | null | undefined, callback, conf );

      if( ret === false ){ break; } // allow exiting early
    }
  }
};

let makeEventObj = function<TContext, TQualifier>( self: Emitter<TContext, TQualifier>, obj: EventProps ): Event {
  self.addEventFields( self.context, obj );

  return new Event( obj.type, obj );
};

let forEachEventObj = function<TContext, TQualifier>(
  self: Emitter<TContext, TQualifier>,
  handler: ( self: Emitter<TContext, TQualifier>, eventObj: Event ) => void,
  events: EmitInput
): void {
  if( is.event( events ) ){
    handler( self, events );

    return;
  } else if( is.plainObject( events ) ){
    handler( self, makeEventObj( self, events ) );

    return;
  }

  let eventList = is.array(events) ? events : ( events as string ).split(/\s+/);

  for( let i = 0; i < eventList.length; i++ ){
    let evt = eventList[i] as string;

    if( is.emptyString( evt ) ){ continue; }

    let match = evt.match( eventRegex ); // type[.namespace]

    if( match ){
      let type = match[1];
      let namespace = match[2] ? match[2] : null;
      let eventObj = makeEventObj( self, {
        type: type,
        namespace: namespace,
        target: self.context
      } );

      handler( self, eventObj );
    }
  }
};

export default Emitter;
