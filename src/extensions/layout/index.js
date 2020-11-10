import breadthfirstLayout from './breadthfirst';
import circleLayout from './circle';
import concentricLayout from './concentric';
import coseLayout from './cose';
import gridLayout from './grid';
import nullLayout from './null';
import presetLayout from './preset';
import randomLayout from './random';

let layoutfn = ({
  /**
   * Start running the layout.
   * @memberof layout
   * @alias layout.start
   * @namespace layout.run
   */
  run: function( ){

  },
  /**
   * Stop running the (asynchronous/discrete) layout.
   * @memberof layout
   * @namespace layout.stop
   */
  stop: function( ){

  },
  /**
 * events [, data], function(event)
 * @typedef {object} layout_on_callback_type
 * @property {object} event - The event object.
 */

/**
 * @callback layout_on_callback
 * @property {layout_on_callback_type} function(event) - layout_on_callback_type
 */

/**
 * @typedef {object} layout_events_on
 * @property {object} events - A space separated list of event names.
 * @property {object} data - [optional] A plain object which is passed to the handler in the event object argument.
 * @property {function(layout_on_callback):any} layout_on_callback - The handler function that is called when one of the specified events occurs.
 */

/**
 * @typedef {object} layout_on
 * @property {layout_events_on} layout_events_on
 */

  /**
 * Listen to events that are emitted by the layout.
 * @memberof layout
 * @alias layout.bind|layout.listen|layout.addListener
 * @param {...layout_on} x - Listen to events.
 * @namespace layout.on
 */
  on: function(x) {

  },
/**
 * @typedef {object} layout_promiseOn
 * @property {object} events - A space separated list of event names.
 */

  /**
 * @memberof layout
 * @alias layout.pon
 * @param {...layout_promiseOn} x - Get a promise that is resolved when the layout emits the first of any of the specified events.
 * @namespace layout.promiseOn
 */
  promiseOn: function(x){

  },
  /**
 * events [, data], function(event)
 * @typedef {object} layout_one_callback_type
 * @property {object} event - The event object.
 */

/**
 * @callback layout_one_callback
 * @property {layout_one_callback_type} function(event) - layout_one_callback_type
 */

/**
 * @typedef {object} layout_events_one
 * @property {object} events - A space separated list of event names.
 * @property {object} data - [optional] A plain object which is passed to the handler in the event object argument.
 * @property {function(layout_one_callback):any} layout_one_callback - The handler function that is called when one of the specified events occurs.
 */

/**
 * @typedef {object} layout_one
 * @property {layout_events_one} layout_events_one
 */

  /**
 * @memberof layout
 * @param {...layout_one} x - Listen to events that are emitted by the layout, and run the handler only once.
 * @namespace layout.one
 */
  one: function( ){

  },
  /**
 * @typedef {object} layout_removeListener_events_selector_handler
 * @property {object} events - A space separated list of event names.
 * @property {object} handler - [optional] A reference to the handler function to remove.
 */

/**
 * @typedef {object} layout_removeListener
 * @property {layout_removeListener_events_selector_handler} layout_removeListener_events_selector_handler
 */

  /**
 * @memberof layout
 * @alias layout.off|layout.unbind|layout.unlisten
 * @param {...layout_removeListener} x - Remove event handlers on the layout.
 * @namespace layout.removeListener
 */
  removeListener: function(x){

  },
  /**
   * Remove all event handlers on the layout.
   * @memberof layout
   * @namespace layout.removeAllListeners
   */
  removeAllListeners: function( ){
    
  },
  /**
 * @typedef {object} layout_emit_events_extraParams
 * @property {object} events - A list of event names to emit (either a space-separated string or an array).
 * @property {object} extraParams - [optional] An array of additional parameters to pass to the handler.
 */

/**
 * @typedef {object} layout_emit
 * @property {layout_emit_events_extraParams} layout_emit_events_extraParams
 */

  /**
 * @memberof layout
 * @alias layout.trigger
 * @param {...layout_emit} x - Emit one or more events on the layout.
 * @namespace layout.emit
 */
  emit: function(x){

  }

})

export default [
  { name: 'breadthfirst', impl: breadthfirstLayout },
  { name: 'circle', impl: circleLayout },
  { name: 'concentric',impl: concentricLayout },
  { name: 'cose', impl: coseLayout },
  { name: 'grid', impl: gridLayout },
  { name: 'null', impl: nullLayout },
  { name: 'preset', impl: presetLayout },
  { name: 'random', impl: randomLayout }
];
