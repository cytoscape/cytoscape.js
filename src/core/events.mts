import Emitter from '../emitter.mjs';
import type { EmitterOptions, EventHandler, EmitInput } from '../emitter.mjs';
import define from '../define/index.mjs';
import * as is from '../is.mjs';
import Selector from '../selector/index.mjs';
import type { SelectorEle } from '../selector/type.mjs';
import type Event from '../event.mjs';
import type { CoreShim } from '../types.mjs';
import type { Core } from './core-types.mjs';
import type { Collection } from '../collection/eles-types.mjs';

// The qualifier carried by core-level listeners is a Selector instance.
type CoreEmitter = Emitter<Core, Selector>;

let emitterOptions: EmitterOptions<Core, Selector> = {
  qualifierCompare: function( selector1, selector2 ){
    if( selector1 == null || selector2 == null ){
      return selector1 == null && selector2 == null;
    } else {
      return selector1.sameText( selector2 );
    }
  },
  eventMatches: function( cy, listener, eventObj ){
    let selector = listener.qualifier;

    if( selector != null ){
      return cy !== eventObj.target && is.element( eventObj.target ) && selector.matches( eventObj.target as unknown as SelectorEle );
    }

    return true;
  },
  addEventFields: function( cy, evt ){
    evt.cy = cy as unknown as CoreShim;
    evt.target = cy;
  },
  callbackContext: function( cy, listener, eventObj ){
    return listener.qualifier != null ? eventObj.target : cy;
  }
};

/** Inputs accepted as the selector arg of `.on()` and friends. */
type EventSelectorArg = string | Selector | EventHandler | null | undefined;

let argSelector = function( arg: EventSelectorArg ): Selector | EventHandler | null | undefined {
  if( is.string(arg) ){
    return new Selector( arg );
  } else {
    return arg;
  }
};

export interface CoreEvents {
  /** @internal */
  createEmitter(): Core;
  /** @internal */
  emitter(): CoreEmitter;
  on( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Core;
  removeListener( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Core;
  removeAllListeners(): Core;
  one( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Core;
  /** @internal */
  once( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Core;
  emit( events: EmitInput, extraParams?: unknown[] ): Core;
  /** @internal */
  emitAndNotify( event: string, eles?: Collection ): Core;

  // aliases added by define.eventAliasesOn()
  addListener( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Core;
  listen( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Core;
  bind( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Core;
  unlisten( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Core;
  unbind( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Core;
  off( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Core;
  trigger( events: EmitInput, extraParams?: unknown[] ): Core;
  pon( events: string, selector?: EventSelectorArg ): Promise<Event>;
  promiseOn( events: string, selector?: EventSelectorArg ): Promise<Event>;
}

let elesfn = ({
  createEmitter: function( this: Core ){
    let _p = this._private;

    if( !_p.emitter ){
      _p.emitter = new Emitter<Core, Selector>( emitterOptions, this ) as unknown as Emitter<Core>;
    }

    return this;
  },

  emitter: function( this: Core ): CoreEmitter {
    return this._private.emitter as unknown as CoreEmitter;
  },

  on: function( this: Core, events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ){
    this.emitter().on( events, argSelector(selector), callback );

    return this;
  },

  removeListener: function( this: Core, events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ){
    this.emitter().removeListener( events, argSelector(selector), callback );

    return this;
  },

  removeAllListeners: function( this: Core ){
    this.emitter().removeAllListeners();

    return this;
  },

  one: function( this: Core, events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ){
    this.emitter().one( events, argSelector(selector), callback );

    return this;
  },

  once: function( this: Core, events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ){
    this.emitter().one( events, argSelector(selector), callback );

    return this;
  },

  emit: function( this: Core, events: EmitInput, extraParams?: unknown[] ){
    this.emitter().emit( events, extraParams );

    return this;
  },

  emitAndNotify: function( this: Core, event: string, eles?: Collection ){
    this.emit( event );

    this.notify( event, eles );

    return this;
  }
});

define.eventAliasesOn( elesfn );

export default elesfn as unknown as CoreEvents;
