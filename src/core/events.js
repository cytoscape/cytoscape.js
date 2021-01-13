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
  eventMatches: function( cy, listener, eventObj ){
    let selector = listener.qualifier;

    if( selector != null ){
      return cy !== eventObj.target && is.element( eventObj.target ) && selector.matches( eventObj.target );
    }

    return true;
  },
  addEventFields: function( cy, evt ){
    evt.cy = cy;
    evt.target = cy;
  },
  callbackContext: function( cy, listener, eventObj ){
    return listener.qualifier != null ? eventObj.target : cy;
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
    let _p = this._private;

    if( !_p.emitter ){
      _p.emitter = new Emitter( emitterOptions, this );
    }

    return this;
  },

  emitter: function(){
    return this._private.emitter;
  },

      /**
 * function(event)
 * @typedef {object} cy_on_callback_type
 * @property {object} event - The event object.
 */

/**
 * @callback cy_on_callback
 * @property {cy_on_callback_type} function(event) - cy_on_callback_type
 */

/**
 * @typedef {object} cy_collection_on
 * @property {object} events - A space separated list of event names.
 * @property {object} selector - [optional]  A selector to specify elements for which the handler runs.
 * @property {function(cy_on_callback):any} cy_on_callback -  The handler function that is called when on of the specified events occurs.
 */

/**
 * @typedef {object} cy_on
 * @property {cy_collection_on} cy_collection_on
 */

  /**
 * Listen to events that occur on the elements.
 * @memberof cy
 * @path Collection/Events
 * @pureAliases cy.bind|cy.listen|cy.addListener
 * @param {...cy_on} events - NULL
 * @methodName cy.on
 */
  on: function( events, selector, callback ){
    this.emitter().on( events, argSelector(selector), callback );

    return this;
  },

  /**
 * @typedef {object} cy_collection_removeListener
 * @property {object} events - A space separated list of event names.
 * @property {object} selector - [optional] The same selector used to listen to the events.
 * @property {object} handler - [optional] A reference to the handler function to remove.
 */

/**
 * @typedef {object} cy_removeListener
 * @property {cy_collection_removeListener} cy_collection_removeListener
 */

  /**
 * Remove one or more listeners on the elements.
 * @memberof cy
 * @path Collection/Events
 * @pureAliases cy.off|cy.unbind|cy.unlisten
 * @param {...cy_removeListener} events - NULL
 * @methodName cy.removeListener
 */
  removeListener: function( events, selector, callback ){
    this.emitter().removeListener( events, argSelector(selector), callback );

    return this;
  },

    /**
 * Remove all event handlers on the elements.
 * @memberof cy
 * @path Collection/Events
 * @methodName cy.removeAllListeners
 */
  removeAllListeners: function(){
    this.emitter().removeAllListeners();

    return this;
  },

      /**
 * function(event)
 * @typedef {object} cy_one_callback_type
 * @property {object} event - The event object.
 */

/**
 * @callback cy_one_callback
 * @property {cy_one_callback_type} function(event) - cy_one_callback_type
 */

/**
 * @typedef {object} cy_collection_one
 * @property {object} events - A space separated list of event names.
 * @property {object} selector - [optional] A selector to specify child elements for which the handler runs.
 * @property {function(cy_one_callback):any} cy_one_callback -  The handler function that is called when one of the specified events occurs.
 */

/**
 * @typedef {object} cy_one
 * @property {cy_collection_one} cy_collection_one
 */

  /**
 * Add a listener that is called once per event per element.
 * @memberof cy
 * @path Core/Events
 * @param {...cy_one} events - Determine test function
 * @methodName cy.one
 */
  one: function( events, selector, callback ){
    this.emitter().one( events, argSelector(selector), callback );

    return this;
  },

  once: function( events, selector, callback ){
    this.emitter().one( events, argSelector(selector), callback );

    return this;
  },

  /**
 * @typedef {object} cy_emit_type
 * @property {object} events - A list of event names to emit (either a space-separated string or an array)
 * @property {object} extraParams - [optional] An array of additional parameters to pass to the handler.
 */

/**
 * @typedef {object} cy_emit
 * @property {object} cy_emit_type
 */

  /**
 * Emit one or more events.
 * @memberof cy
 * @pureAliases cy.trigger
 * @path Collection/Events
 * @param {...cy_emit} events - NULL
 * @methodName cy.emit
 */
  emit: function( events, extraParams ){
    this.emitter().emit( events, extraParams );

    return this;
  },

  emitAndNotify: function( event, eles ){
    this.emit( event );

    this.notify( event, eles );

    return this;
  }
});

define.eventAliasesOn( elesfn );

export default elesfn;
