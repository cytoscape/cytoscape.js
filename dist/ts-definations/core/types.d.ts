declare class cy {
}

/**
 * @property eleObj - A plain object that specifies the element.
 * @property eleObjs - An array of elements specified by plain objects.
 * @property eles - A collection of elements.
 */
declare type cy_add = {
    eleObj: any;
    eleObjs: any;
    eles: any;
};

declare namespace cy {
    /**
     * Add elements to the graph and return them
     */
    namespace add { }
    /**
     * Remove elements from the graph and return them.
     */
    namespace remove { }
    /**
     * Get whether the instance of Cytoscape.js has been destroyed or not.
     */
    namespace destroyed { }
    namespace ready { }
    /**
     * A convenience function to explicitly destroy the instance.
     */
    namespace destroy { }
    /**
     * Get an element from its ID in a very performant way
     */
    namespace getElementById { }
    /**
     * Get the HTML DOM element in which the graph is visualised. A null value is returned if the instance is headless.
     */
    namespace container { }
    /**
     * Attaches the instance to the specified container for visualisation.
     */
    namespace mount { }
    /**
     * Remove the instance from its current container.
     */
    namespace unmount { }
    /**
     * Import or export the graph in the same JSON format used at initialisation.
     */
    namespace json { }
    /**
     * Get a new layout, which can be used to algorithmically position the nodes in the graph
     */
    namespace layout { }
    /**
     * Allow for manipulation of elements without triggering multiple style calculations or multiple redraws.
     */
    namespace batch { }
    /**
     * Return a new, empty collection.
     */
    namespace collection { }
    /**
     * Get elements in the graph matching a selector or a filter function.
     */
    namespace $ { }
    /**
     * Get the entry point to modify the visual style of the graph after initialisation.
     */
    namespace style { }
    /**
     * Get or set whether nodes are automatically locked (i.e. if `true`, nodes are locked despite their individual state).
     */
    namespace autolock { }
    /**
     * Get or set whether nodes are automatically ungrabified (i.e. if `true`, nodes are ungrabbale despite their individual state).
     */
    namespace autoungrabify { }
    /**
     * Get or set whether nodes are automatically unselectified (i.e. if `true`, nodes are ungrabbale despite their individual state).
     */
    namespace autounselectify { }
    /**
     * Get or set the selection type.  The `'single'` selection type is the default, tapping an element selects that element and deselects the previous elements.  The `'additive' selection type toggles the selection state of an element when tapped.`
     */
    namespace selectionType { }
    /**
     * Get or set whether panning is enabled.
     */
    namespace panningEnabled { }
    /**
     * Get or set whether panning by user events (e.g. dragging the graph background) is enabled.
     */
    namespace userPanningEnabled { }
    /**
     * Get or set whether zooming is enabled.
     */
    namespace zoomingEnabled { }
    /**
     * Get or set whether user zooming by user events (e.g. mouse wheel, pinch-to-zoom) is enabled.
     */
    namespace userZoomingEnabled { }
    /**
     * Get or set whether box selection is enabled. If enabled along with panning, the user must hold down one of shift, control, alt, or command to initiate box selection.
     */
    namespace boxSelectionEnabled { }
    /**
     * Get or set the panning position of the graph.
     */
    namespace pan { }
    /**
     * Relatively pan the graph by a specified rendered position vector.
     */
    namespace panBy { }
    /**
     * Pan and zooms the graph to fit to a collection.
     */
    namespace fit { }
    /**
     * Get or set the minimum zoom level.
     */
    namespace minZoom { }
    /**
     * Get or set the maximum zoom level.
     */
    namespace maxZoom { }
    /**
     * Get or set the zoom level of the graph.
     */
    namespace zoom { }
    /**
     * Set the viewport state (pan & zoom) in one call.
     */
    namespace viewport { }
    /**
     * Pan the graph to the centre of a collection.
     */
    namespace center { }
    /**
     * Reset the graph to the default zoom level and panning position.
     */
    namespace reset { }
    /**
     * Get the on-screen width of the viewport in pixels.
     */
    namespace width { }
    /**
     * Get the on-screen height of the viewport in pixels.
     */
    namespace height { }
    /**
     * Get the extent of the viewport, a bounding box in model co-ordinates that lets you know what model positions are visible in the viewport.
     */
    namespace extent { }
}

/**
 * @property eles - A collection of elements to remove.
 * @property selector - Elements matching this selector are removed.
 */
declare type cy_remove = {
    eles: any;
    selector: any;
};

/**
 * events [, selector], function(event)
 * @property event - The `ready` event.
 */
declare type cy_ready_callback_type = {
    event: any;
};

/**
 * @property function(event) - cy_ready_callback_type
 */
declare type cy_ready_callback = () => void;

/**
 * @property cy_ready_callback - The callback run as soon as the graph is ready.
 */
declare type cy_events_ready = {
    cy_ready_callback: (...params: any[]) => any;
};

declare type cy_ready = {
    cy_events_ready: cy_events_ready;
};

/**
 * @property id - The ID of the element to get.
 */
declare type cy_getElementById = {
    id: any;
};

/**
 * @property container - A HTML DOM element in which the graph should be rendered.
 */
declare type cy_mount = {
    container: any;
};

/**
 * @property flatEles - Whether the resulant JSON should include the elements as a flat array (`true`) or as two keyed arrays by group (`false`, default).
 * @property cyJson - The object with the fields corresponding to the states that should be changed.
 */
declare type cy_json = {
    flatEles: any;
    cyJson: any;
};

/**
 * @property options - The layout options.
 */
declare type cy_layout = {
    options: any;
};

/**
 * @property function() - A callback within which you can make batch updates to elements.
 */
declare type cy_batch = {
    function(): any;
};

/**
 * @property function(ele,i,eles) - filter_callback_type
 */
declare type filter_callback = () => void;

/**
 * function(ele, i, eles)
 * @property ele - The current element under consideration for filtering.
 * @property i - The counter used for iteration over the elements in the graph.
 * @property eles - The collection of elements being filtered
 */
declare type filter_callback_type = {
    ele: any;
    i: any;
    eles: any;
};

/**
 * @property selector - The selector the elements should match.
 * @property selector - The selector the elements should match.
 * @property selector - The selector the nodes should match.
 * @property selector - The selector the edges should match.
 * @property selector - The selector the elements should match.
 * @property filter_callback - The filter function that returns true for elements that should be returned.
 */
declare type cy_$ = {
    selector: any;
    selector: any;
    selector: any;
    selector: any;
    selector: any;
    filter_callback: (...params: any[]) => any;
};

/**
 * @property stylesheet - Either a `cytoscape.stylesheet()` object, a string stylesheet, or a JSON stylesheet (the same formats accepted for [`options.style`](#style) at initialisation).
 */
declare type cy_style = {
    NULL: any;
    stylesheet: any;
};

/**
 * @property bool - A truthy value enables autolocking; a falsey value disables it.
 */
declare type cy_autolock = {
    NULL: any;
    bool: any;
};

/**
 * @property bool - A truthy value enables autoungrabifying; a falsey value disables it.
 */
declare type cy_autoungrabify = {
    NULL: any;
    bool: any;
};

/**
 * @property bool - A truthy value enables autounselectifying; a falsey value disables it.
 */
declare type cy_autounselectify = {
    NULL: any;
    bool: any;
};

/**
 * @property type - The selection type string; one of `'single'` (default) or `'additive'`.
 */
declare type cy_selectionType = {
    NULL: any;
    type: any;
};

/**
 * @property bool - A truthy value enables panning; a falsey value disables it.
 */
declare type cy_panningEnabled = {
    NULL: any;
    bool: any;
};

/**
 * @property bool - A truthy value enables panning; a falsey value disables it.
 */
declare type cy_userPanningEnabled = {
    NULL: any;
    bool: any;
};

/**
 * @property bool - A truthy value enables zooming; a falsey value disables it.
 */
declare type cy_zoomingEnabled = {
    NULL: any;
    bool: any;
};

/**
 * @property bool - A truthy value enables user zooming; a falsey value disables it.
 */
declare type cy_userZoomingEnabled = {
    NULL: any;
    bool: any;
};

/**
 * @property bool - A truthy value enables box selection; a falsey value disables it.
 */
declare type cy_boxSelectionEnabled = {
    NULL: any;
    bool: any;
};

/**
 * @property renderedPosition - The rendered position to pan the graph to.
 */
declare type cy_pan = {
    NULL: any;
    renderedPosition: any;
};

/**
 * @property renderedPosition - The rendered position vector to pan the graph by.
 */
declare type cy_panBy = {
    renderedPosition: any;
};

/**
 * eles, padding
 * @property eles - The collection to fit to.
 * @property padding - An amount of padding (in rendered pixels) to have around the graph (default 0).
 */
declare type cy_fit_eles_padding = {
    eles: any;
    padding: any;
};

declare type cy_fit = {
    NULL: any;
    cy_fit_eles_padding: cy_fit_eles_padding;
};

/**
 * @property zoom - The new minimum zoom level to use.
 */
declare type cy_minZoom = {
    NULL: any;
    zoom: any;
};

/**
 * @property zoom - The new maximum zoom level to use.
 */
declare type cy_maxZoom = {
    NULL: any;
    zoom: any;
};

/**
 * @property options - zoom_options_type
 */
declare type zoom_options = () => void;

/**
 * options
 * @property level - The zoom level to set.
 * @property position - The position about which to zoom.
 * @property renderedPosition - The rendered position about which to zoom.
 */
declare type zoom_options_type = {
    level: any;
    position: any;
    renderedPosition: any;
};

/**
 * @property level - The zoom level to set.
 * @property zoom_options - The options for zooming.
 */
declare type cy_zoom = {
    NULL: any;
    level: any;
    zoom_options: (...params: any[]) => any;
};

/**
 * zoom, pan
 * @property zoom - The zoom level to set.
 * @property pan - The pan to set (a rendered position).
 */
declare type cy_viewport_zoom_pan = {
    zoom: any;
    pan: any;
};

declare type cy_viewport = {
    cy_viewport_zoom_pan: cy_viewport_zoom_pan;
};

/**
 * @property eles - The collection to centre upon.
 */
declare type cy_center = {
    NULL: any;
    eles: any;
};

