declare class layout {
}

declare namespace layout {
    /**
     * Start running the layout.
     */
    namespace run { }
    /**
     * Stop running the (asynchronous/discrete) layout.
     */
    namespace stop { }
    /**
     * Listen to events that are emitted by the layout.
     */
    namespace on { }
    namespace promiseOn { }
    namespace one { }
    namespace removeListener { }
    /**
     * Remove all event handlers on the layout.
     */
    namespace removeAllListeners { }
    namespace emit { }
}

/**
 * events [, data], function(event)
 * @property event - The event object.
 */
declare type layout_on_callback_type = {
    event: any;
};

/**
 * @property function(event) - layout_on_callback_type
 */
declare type layout_on_callback = () => void;

/**
 * @property events - A space separated list of event names.
 * @property data - [optional] A plain object which is passed to the handler in the event object argument.
 * @property layout_on_callback - The handler function that is called when one of the specified events occurs.
 */
declare type layout_events_on = {
    events: any;
    data: any;
    layout_on_callback: (...params: any[]) => any;
};

declare type layout_on = {
    layout_events_on: layout_events_on;
};

/**
 * @property events - A space separated list of event names.
 */
declare type layout_promiseOn = {
    events: any;
};

/**
 * events [, data], function(event)
 * @property event - The event object.
 */
declare type layout_one_callback_type = {
    event: any;
};

/**
 * @property function(event) - layout_one_callback_type
 */
declare type layout_one_callback = () => void;

/**
 * @property events - A space separated list of event names.
 * @property data - [optional] A plain object which is passed to the handler in the event object argument.
 * @property layout_one_callback - The handler function that is called when one of the specified events occurs.
 */
declare type layout_events_one = {
    events: any;
    data: any;
    layout_one_callback: (...params: any[]) => any;
};

declare type layout_one = {
    layout_events_one: layout_events_one;
};

/**
 * @property events - A space separated list of event names.
 * @property handler - [optional] A reference to the handler function to remove.
 */
declare type layout_removeListener_events_selector_handler = {
    events: any;
    handler: any;
};

declare type layout_removeListener = {
    layout_removeListener_events_selector_handler: layout_removeListener_events_selector_handler;
};

/**
 * @property events - A list of event names to emit (either a space-separated string or an array).
 * @property extraParams - [optional] An array of additional parameters to pass to the handler.
 */
declare type layout_emit_events_extraParams = {
    events: any;
    extraParams: any;
};

declare type layout_emit = {
    layout_emit_events_extraParams: layout_emit_events_extraParams;
};

