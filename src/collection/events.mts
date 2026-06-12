import Emitter from '../emitter.mjs';
import type { EmitterOptions, EventHandler, EmitInput, ListenerConf } from '../emitter.mjs';
import define from '../define/index.mjs';
import * as is from '../is.mjs';
import Selector from '../selector/index.mjs';
import type { SelectorEle } from '../selector/type.mjs';
import type Event from '../event.mjs';
import type { EventProps } from '../event.mjs';
import type { CoreShim } from '../types.mjs';
import type { Collection, Element, ElementPrivate } from './eles-types.mjs';

// The qualifier carried by per-element listeners is a Selector instance.
type EleEmitter = Emitter<Element, Selector>;

// `.once()` stashes its own config onto the listener; the base ListenerConf
// only models `one`, so widen it locally.
interface OnceListenerConf {
  once?: boolean;
  onceCollection?: Collection;
}

let emitterOptions: EmitterOptions<Element, Selector> = {
  qualifierCompare: function( selector1, selector2 ){
    if( selector1 == null || selector2 == null ){
      return selector1 == null && selector2 == null;
    } else {
      return selector1.sameText( selector2 );
    }
  },
  eventMatches: function( ele, listener, eventObj ){
    let selector = listener.qualifier;

    if( selector != null ){
      return ele !== eventObj.target && is.element( eventObj.target ) && selector.matches( eventObj.target as unknown as SelectorEle );
    }

    return true;
  },
  addEventFields: function( ele, evt ){
    evt.cy = ele.cy() as unknown as CoreShim;
    evt.target = ele;
  },
  callbackContext: function( ele, listener, eventObj ){
    return listener.qualifier != null ? eventObj.target : ele;
  },
  beforeEmit: function( context, listener/*, eventObj*/ ){
    let conf = listener.conf as OnceListenerConf | null | undefined;

    if( conf && conf.once ){
      conf.onceCollection!.removeListener( listener.event!, listener.qualifier, listener.callback );
    }
  },
  bubble: function(){
    return true;
  },
  parent: function( ele ){
    // TODO(eles-types): isChild()/parent() come from the compounds mixin, not
    // yet exposed on Element via eles-types; cast until that mixin is converted
    let eleCompound = ele as unknown as { isChild(): boolean; parent(): Element };

    // both Element and Core expose emit() and so satisfy the emitter's parent
    // target contract; the structural target type isn't exported
    let target = eleCompound.isChild() ? eleCompound.parent() : ele.cy();

    return target as unknown as { emit( events: Event, extraParams?: unknown[] ): unknown };
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

export interface CollectionEvents {
  /** @internal */
  createEmitter(): Collection;
  /** @internal */
  emitter(): EleEmitter;
  on( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Collection;
  removeListener( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Collection;
  removeAllListeners(): Collection;
  one( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Collection;
  once( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): void;
  emit( events: EmitInput, extraParams?: unknown[] ): Collection;
  /** @internal */
  emitAndNotify( event: string, extraParams?: unknown[] ): Collection | undefined;

  // aliases added by define.eventAliasesOn()
  addListener( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Collection;
  listen( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Collection;
  bind( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Collection;
  unlisten( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Collection;
  unbind( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Collection;
  off( events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ): Collection;
  trigger( events: EmitInput, extraParams?: unknown[] ): Collection;
  pon( events: string, selector?: EventSelectorArg ): Promise<Event>;
  promiseOn( events: string, selector?: EventSelectorArg ): Promise<Event>;
}

let elesfn = ({
  createEmitter: function( this: Collection ){
    for( let i = 0; i < this.length; i++ ){
      let ele = this[i];
      let _p = ele._private;

      if( !_p.emitter ){
        _p.emitter = new Emitter<Element, Selector>( emitterOptions, ele ) as unknown as Emitter<Element>;
      }
    }

    return this;
  },

  emitter: function( this: Collection ): EleEmitter {
    return ( this._private as ElementPrivate ).emitter as unknown as EleEmitter;
  },

  on: function( this: Collection, events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ){
    let argSel = argSelector(selector);

    for( let i = 0; i < this.length; i++ ){
      let ele = this[i];

      ele.emitter().on( events, argSel, callback );
    }

    return this;
  },

  removeListener: function( this: Collection, events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ){
    let argSel = argSelector(selector);

    for( let i = 0; i < this.length; i++ ){
      let ele = this[i];

      ele.emitter().removeListener( events, argSel, callback );
    }

    return this;
  },

  removeAllListeners: function( this: Collection ){
    for( let i = 0; i < this.length; i++ ){
      let ele = this[i];

      ele.emitter().removeAllListeners();
    }

    return this;
  },

  one: function( this: Collection, events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ){
    let argSel = argSelector(selector);

    for( let i = 0; i < this.length; i++ ){
      let ele = this[i];

      ele.emitter().one( events, argSel, callback );
    }

    return this;
  },

  once: function( this: Collection, events: string | string[], selector?: EventSelectorArg, callback?: EventHandler ){
    let argSel = argSelector(selector);

    for( let i = 0; i < this.length; i++ ){
      let ele = this[i];

      ele.emitter().on( events, argSel, callback, {
        once: true,
        onceCollection: this
      } as OnceListenerConf as unknown as ListenerConf );
    }
  },

  emit: function( this: Collection, events: EmitInput, extraParams?: unknown[] ){
    for( let i = 0; i < this.length; i++ ){
      let ele = this[i];

      ele.emitter().emit( events, extraParams );
    }

    return this;
  },

  emitAndNotify: function( this: Collection, event: string, extraParams?: unknown[] ){ // for internal use only
    if( this.length === 0 ){ return; } // empty collections don't need to notify anything

    // notify renderer
    this.cy().notify( event, this );

    this.emit( event, extraParams );

    return this;
  }
});

define.eventAliasesOn( elesfn );

export default elesfn as unknown as CollectionEvents;
