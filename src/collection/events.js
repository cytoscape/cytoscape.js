import Emitter from '../emitter';
import define from '../define';
import * as is from '../is';
import Selector from '../selector';

let emitterOptions = {
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
      return ele !== eventObj.target && is.element( eventObj.target ) && selector.matches( eventObj.target );
    }

    return true;
  },
  addEventFields: function( ele, evt ){
    evt.cy = ele.cy();
    evt.target = ele;
  },
  callbackContext: function( ele, listener, eventObj ){
    return listener.qualifier != null ? eventObj.target : ele;
  },
  beforeEmit: function( context, listener/*, eventObj*/ ){
    if( listener.conf && listener.conf.once ){
      listener.conf.onceCollection.removeListener( listener.event, listener.qualifier, listener.callback );
    }
  },
  bubble: function(){
    return true;
  },
  parent: function( ele ){
    return ele.isChild() ? ele.parent() : ele.cy();
  }
};

let argSelector = function( arg ){
  if( is.string(arg) ){
    return new Selector( arg );
  } else {
    return arg;
  }
};

let elesfn = ({
  createEmitter: function(){
    for( let i = 0; i < this.length; i++ ){
      let ele = this[i];
      let _p = ele._private;

      if( !_p.emitter ){
        _p.emitter = new Emitter( emitterOptions, ele );
      }
    }

    return this;
  },

  emitter: function(){
    return this._private.emitter;
  },

    /**
 * function(event)
 * @typedef {object} eles_on_callback_type
 * @property {object} event - The event object.
 */

/**
 * @callback eles_on_callback
 * @property {eles_on_callback_type} function(event) - eles_on_callback_type
 */

/**
 * @typedef {object} eles_collection_on
 * @property {object} events - A space separated list of event names.
 * @property {object} selector - [optional] A delegate selector to specify child elements for which the handler runs.
 * @property {function(eles_on_callback):any} eles_on_callback -  The handler function that is called when on of the specified events occurs.
 */

/**
 * @typedef {object} eles_on
 * @property {eles_collection_on} eles_collection_on
 */

  /**
 * Listen to events that occur on the elements.
 * @memberof eles
 * @path Collection/Events
 * @pureAliases eles.bind|eles.listen|eles.addListener
 * @param {...eles_on} events - NULL
 * @methodName eles.on
 */
  on: function( events, selector, callback ){
    let argSel = argSelector(selector);

    for( let i = 0; i < this.length; i++ ){
      let ele = this[i];

      ele.emitter().on( events, argSel, callback );
    }

    return this;
  },

/**
 * @typedef {object} eles_collection_removeListener
 * @property {object} events - A space separated list of event names.
 * @property {object} selector - [optional] The same delegate selector used to listen to the events.
 * @property {object} handler - [optional] A reference to the handler function to remove.
 */

/**
 * @typedef {object} eles_removeListener
 * @property {eles_collection_removeListener} eles_collection_removeListener
 */

  /**
 * Remove one or more listeners on the elements.
 * @memberof eles
 * @path Collection/Events
 * @pureAliases eles.off|eles.unbind|eles.unlisten
 * @param {...eles_removeListener} events - NULL
 * @methodName eles.removeListener
 */
  removeListener: function( events, selector, callback ){
    let argSel = argSelector(selector);

    for( let i = 0; i < this.length; i++ ){
      let ele = this[i];

      ele.emitter().removeListener( events, argSel, callback );
    }

    return this;
  },

  /**
 * Remove all event handlers on the elements.
 * @memberof eles
 * @path Collection/Events
 * @methodName eles.removeAllListeners
 */
  removeAllListeners: function(){
    for( let i = 0; i < this.length; i++ ){
      let ele = this[i];

      ele.emitter().removeAllListeners();
    }

    return this;
  },

    /**
 * function(event)
 * @typedef {object} eles_one_callback_type
 * @property {object} event - The event object.
 */

/**
 * @callback eles_one_callback
 * @property {eles_one_callback_type} function(event) - eles_one_callback_type
 */

/**
 * @typedef {object} eles_collection_one
 * @property {object} events - A space separated list of event names.
 * @property {object} selector - [optional] A delegate selector to specify child elements for which the handler runs.
 * @property {function(eles_one_callback):any} eles_one_callback -  The handler function that is called when one of the specified events occurs.
 */

/**
 * @typedef {object} eles_one
 * @property {eles_collection_one} eles_collection_one
 */

  /**
 * Add a listener that is called once per event per element.
 * @memberof eles
 * @path Collection/Events
 * @param {...eles_one} events - Determine test function
 * @methodName eles.one
 */
  one: function( events, selector, callback ){
    let argSel = argSelector(selector);

    for( let i = 0; i < this.length; i++ ){
      let ele = this[i];

      ele.emitter().one( events, argSel, callback );
    }

    return this;
  },

    /**
 * function(event)
 * @typedef {object} eles_once_callback_type
 * @property {object} event - The event object.
 */

/**
 * @callback eles_once_callback
 * @property {eles_once_callback_type} function(event) - eles_once_callback_type
 */

/**
 * @typedef {object} eles_collection_once
 * @property {object} events - A space separated list of event names.
 * @property {object} selector - [optional] A delegate selector to specify child elements for which the handler runs.
 * @property {function(eles_once_callback):any} eles_once_callback -  The handler function that is called when once of the specified events occurs.
 */

/**
 * @typedef {object} eles_once
 * @property {eles_collection_once} eles_collection_once
 */

  /**
 * Add a listener that is called once per event per element.
 * @memberof eles
 * @path Collection/Events
 * @param {...eles_once} events - NULL
 * @methodName eles.once
 */
  once: function( events, selector, callback ){
    let argSel = argSelector(selector);

    for( let i = 0; i < this.length; i++ ){
      let ele = this[i];

      ele.emitter().on( events, argSel, callback, {
        once: true,
        onceCollection: this
      } );
    }
  },

/**
 * @typedef {object} eles_emit_type
 * @property {object} events - A list of event names to emit (either a space-separated string or an array)
 * @property {object} extraParams - [optional] An array of additional parameters to pass to the handler.
 */

/**
 * @typedef {object} eles_emit
 * @property {object} eles_emit_type
 */

  /**
 * Emit events on the elements.
 * @memberof eles
 * @pureAliases eles.trigger
 * @path Collection/Events
 * @param {...eles_emit} events - NULL
 * @methodName eles.emit
 */
  emit: function( events, extraParams ){
    for( let i = 0; i < this.length; i++ ){
      let ele = this[i];

      ele.emitter().emit( events, extraParams );
    }

    return this;
  },

  emitAndNotify: function( event, extraParams ){ // for internal use only
    if( this.length === 0 ){ return; } // empty collections don't need to notify anything

    // notify renderer
    this.cy().notify( event, this );

    this.emit( event, extraParams );

    return this;
  }
});

define.eventAliasesOn( elesfn );

export default elesfn;
