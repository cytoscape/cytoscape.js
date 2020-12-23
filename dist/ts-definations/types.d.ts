declare class cy {
    /**
     * Add elements to the graph and return them
     * @param opts - Add a specified element to the graph. | Add the specified elements to the graph. | Add the specified elements to the graph.
     */
    static add(...opts: cy_add[]): void;
    /**
     * Remove elements from the graph and return them.
     * @param x - Remove the specified elements. | Remove elements in the graph matching the specified selector.
     */
    static remove(...x: cy_remove[]): void;
    /**
     * Get whether the instance of Cytoscape.js has been destroyed or not.
     */
    static destroyed(): void;
    /**
     * @param fn - Run a callback as soon as the graph becomes ready (i.e. intitial data loaded and initial layout completed).  If the graph is already ready, then the callback is called immediately.  If data is loaded synchronously and the layout used is discrete/synchronous/unanimated/unspecified, then you don't need `cy.ready()`.
     */
    static ready(...fn: cy_ready[]): void;
    /**
     * A convenience function to explicitly destroy the instance.
     */
    static destroy(): void;
    /**
     * Get an element from its ID in a very performant way
     * @param id - Get ID
     */
    static getElementById(...id: cy_getElementById[]): void;
    /**
     * Get the HTML DOM element in which the graph is visualised. A null value is returned if the instance is headless.
     */
    static container(): void;
    /**
     * Attaches the instance to the specified container for visualisation.
     * @param container - To mount
     */
    static mount(...container: cy_mount[]): void;
    /**
     * Remove the instance from its current container.
     */
    static unmount(): void;
    /**
     * Import or export the graph in the same JSON format used at initialisation.
     * @param obj - Export the graph as JSON. | Import the graph as JSON, updating only the fields specified.
     */
    static json(...obj: cy_json[]): void;
    /**
     * Get a new layout, which can be used to algorithmically position the nodes in the graph
     * @param options - Get layouts
     */
    static layout(...options: cy_layout[]): void;
    /**
     * Allow for manipulation of elements without triggering multiple style calculations or multiple redraws.
     * @param callback - callback | Starts batching manually (useful for asynchronous cases). | Ends batching manually (useful for asynchronous cases).
     */
    static batch(...callback: cy_batch[]): void;
    /**
     * Return a new, empty collection.
     */
    static collection(): void;
    /**
     * Get elements in the graph matching a selector or a filter function.
     * @param selector - Get elements in the graph matching the specified selector. | Get elements in the graph matching the specified selector. | Get nodes in the graph matching the specified selector. | Get edges in the graph matching the specified selector. | Get elements in the graph matching the specified selector. | Get elements in the graph matching the specified filter function.
     */
    static $(...selector: cy_$[]): void;
    /**
     * Get the entry point to modify the visual style of the graph after initialisation.
     * @param newStyle - Get the current style object. | Assign a new stylesheet to replace the existing one.
     */
    static style(...newStyle: cy_style[]): void;
    /**
     * Get or set whether nodes are automatically locked (i.e. if `true`, nodes are locked despite their individual state).
     * @param bool - Get whether autolocking is enabled. | Set whether autolocking is enabled.
     */
    static autolock(...bool: cy_autolock[]): void;
    /**
     * Get or set whether nodes are automatically ungrabified (i.e. if `true`, nodes are ungrabbale despite their individual state).
     * @param bool - Get whether autoungrabifying is enabled. | Set whether autoungrabifying is enabled.
     */
    static autoungrabify(...bool: cy_autoungrabify[]): void;
    /**
     * Get or set whether nodes are automatically unselectified (i.e. if `true`, nodes are ungrabbale despite their individual state).
     * @param bool - Get whether autounselectifying is enabled. | Set whether autounselectifying is enabled.
     */
    static autounselectify(...bool: cy_autounselectify[]): void;
    /**
     * Get or set the selection type.  The `'single'` selection type is the default, tapping an element selects that element and deselects the previous elements.  The `'additive' selection type toggles the selection state of an element when tapped.`
     * @param selType - Get the selection type string. | Set the selection type.
     */
    static selectionType(...selType: cy_selectionType[]): void;
    /**
     * Get or set whether panning is enabled.
     * @param bool - Get whether panning is enabled. | Set whether panning is enabled
     */
    static panningEnabled(...bool: cy_panningEnabled[]): void;
    /**
     * Get or set whether panning by user events (e.g. dragging the graph background) is enabled.
     * @param bool - Get whether user panning is enabled. | Set whether user panning is enabled
     */
    static userPanningEnabled(...bool: cy_userPanningEnabled[]): void;
    /**
     * Get or set whether zooming is enabled.
     * @param bool - Get whether zooming is enabled. | Set whether zooming is enabled
     */
    static zoomingEnabled(...bool: cy_zoomingEnabled[]): void;
    /**
     * Get or set whether user zooming by user events (e.g. mouse wheel, pinch-to-zoom) is enabled.
     * @param bool - Get whether user zooming is enabled. | Set whether zooming is enabled
     */
    static userZoomingEnabled(...bool: cy_userZoomingEnabled[]): void;
    /**
     * Get or set whether box selection is enabled. If enabled along with panning, the user must hold down one of shift, control, alt, or command to initiate box selection.
     * @param bool - Get whether box selection is enabled. | Set whether box selection is enabled.
     */
    static boxSelectionEnabled(...bool: cy_boxSelectionEnabled[]): void;
    /**
     * Get or set the panning position of the graph.
     * @param renderedPosition - Get the current panning position. | Set the current panning position.
     */
    static pan(...renderedPosition: cy_pan[]): void;
    /**
     * Relatively pan the graph by a specified rendered position vector.
     * @param arg0 - The rendered position
     */
    static panBy(...arg0: cy_panBy[]): void;
    /**
     * Pan and zooms the graph to fit to a collection.
     * @param elements - Fit to all elements in the graph. | Fit to the specified elements.
     */
    static fit(...elements: cy_fit[]): void;
    /**
     * Get or set the minimum zoom level.
     * @param zoom - Get the minimum zoom level. | Set the minimum zoom level.
     */
    static minZoom(...zoom: cy_minZoom[]): void;
    /**
     * Get or set the maximum zoom level.
     * @param zoom - Get the maximum zoom level. | Set the maximum zoom level.
     */
    static maxZoom(...zoom: cy_maxZoom[]): void;
    /**
     * Get or set the zoom level of the graph.
     * @param params - Get the zoom level. | Set the zoom level. | Set the zoom level.
     */
    static zoom(...params: cy_zoom[]): void;
    /**
     * Set the viewport state (pan & zoom) in one call.
     * @param opts - Set viewport
     */
    static viewport(...opts: cy_viewport[]): void;
    /**
     * Pan the graph to the centre of a collection.
     * @param elements - Centre on all elements in the graph. | Centre on the specified elements.
     */
    static center(...elements: cy_center[]): void;
    /**
     * Reset the graph to the default zoom level and panning position.
     */
    static reset(): void;
    /**
     * Get the on-screen width of the viewport in pixels.
     */
    static width(): void;
    /**
     * Get the on-screen height of the viewport in pixels.
     */
    static height(): void;
    /**
     * Get the extent of the viewport, a bounding box in model co-ordinates that lets you know what model positions are visible in the viewport.
     */
    static extent(): void;
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

declare class eles {
    /**
     * Get or replace the current list of classes on the elements with the specified list.
     * @param classes - Get the list of classes as an array for the element. | Replace the list of classes for all elements in the collection.
     */
    static classes(...classes: eles_classes[]): void;
    /**
     * Add classes to elements.  The classes should be specified in the [stylesheet](#style) in order to have an effect on the rendered style of the elements.
     * @param classes - Adding Class
     */
    static addClass(...classes: eles_addClass[]): void;
    /**
     * Get whether an element has a particular class.
     * @param className - Adding Class
     */
    static hasClass(...className: eles_hasClass[]): void;
    /**
     * Toggle whether the elements have the specified classes.  The classes should be specified in the [stylesheet](#style) in order to have an effect on the rendered style of the elements.
     * @param toggle - Toggle Event
     */
    static toggleClass(...toggle: eles_toggleClass[]): void;
    /**
     * Remove classes from elements.  The classes should be specified in the [stylesheet](#style) in order to have an effect on the rendered style of the elements.
     * @param classes - Adding Class
     */
    static removeClass(...classes: eles_removeClass[]): void;
    /**
     * Add classes to the elements, and then remove the classes after a specified duration.
     * @param duration - flash Event
     */
    static flashClass(...duration: eles_flashClass[]): void;
    /**
     * Determine whether all elements in the collection match a selector.
     * @param selector - Matching Selector
     */
    static allAre(...selector: eles_allAre[]): void;
    /**
     * Determine whether any element in this collection matches a selector.
     * @param selector - Matching Selector
     */
    static is(...selector: eles_is[]): void;
    /**
     * Determine whether any element in this collection satisfies the specified test function.
     * @param fn - Listen to events that bubble up from elements matching the specified node selector:
     */
    static some(...fn: eles_some[]): void;
    /**
     * Determine whether all elements in this collection satisfy the specified test function.
     * @param fn - Determine test function
     */
    static every(...fn: eles_every[]): void;
    /**
     * Determine whether this collection contains exactly the same elements as another collection.
     * @param collection - Determine same collection
     */
    static same(...collection: eles_same[]): void;
    /**
     * Determine whether this collection contains any of the same elements as another collection.
     * @param collection - Determine any same collection
     */
    static anySame(...collection: eles_anySame[]): void;
    /**
     * Determine whether all elements in the specified collection are in the neighbourhood of the calling collection.
     * @param collection - Determine neighbourhood collection
     */
    static allAreNeighbors(...collection: eles_allAreNeighbors[]): void;
    /**
     * Determine whether this collection contains all of the elements of another collection.
     * @param collection - Determine another collection
     */
    static contains(...collection: eles_contains[]): void;
    /**
     * Perform a traditional left/right diff on the two collections.
     * @param other - diff Event | diff Event
     */
    static diff(...other: eles_diff[]): void;
    /**
     * Perform an in-place operation on the calling collection to remove the given elements.
     * @param toRemove - unmerge Event | unmerge Event
     */
    static unmerge(...toRemove: eles_unmerge[]): void;
    /**
     * Get an array containing values mapped from the collection.
     * @param mapFn - Determine test function
     */
    static map(...mapFn: eles_map[]): void;
    /**
     * Reduce a single value by applying a function against an accumulator and each value of the collection.
     * @param fn - Determine reduce function
     */
    static reduce(...fn: eles_reduce[]): void;
    /**
     * Find a maximum value and the corresponding element.
     * @param valFn - Determine max function
     */
    static max(...valFn: eles_max[]): void;
    /**
     * Find a minimum value and the corresponding element.
     * @param valFn - Determine min function
     */
    static min(...valFn: eles_min[]): void;
    /**
     * Iterate over the elements in the collection.
     * @param fn - Determine forEach function
     */
    static forEach(...fn: eles_forEach[]): void;
    /**
     * Get a subset of the elements in the collection based on specified indices.
     * @param start - Slice
     */
    static slice(...start: eles_slice[]): void;
    /**
     * Get the number of elements in the collection.
     */
    static size(): void;
    /**
     * Get an element at a particular index in the collection.
     * @param i - Get the index of the element. | Get the first element in the collection. | Get the last element in the collection.
     */
    static eq(...i: eles_eq[]): void;
    /**
     * Get whether the collection is empty, meaning it has no elements.
     * @param x - Get whether the collection is empty. | Get whether the collection is nonempty.
     */
    static empty(...x: eles_empty[]): void;
    /**
     * Get a new collection containing the elements sorted by the specified comparison function.
     * @param sortFn - The sorting comparison function.
     */
    static sort(...sortFn: eles_sort[]): void;
    /**
     * Get a new layout, which can be used to algorithmically position the nodes in the collection.
     * @param options - The layouting comparison function.
     */
    static layout(...options: eles_layout[]): void;
    /**
     * Get or override the style of the element.
     * @param value - Get a name-value pair object containing visual style properties and their values for the element. | Get a particular style property value. | Set a particular style property value. | Set several particular style property values. | Remove all style overrides. | Remove specific style overrides.
     */
    static style(...value: eles_style[]): void;
}

/**
 * @property classes - An array (or a space-separated string) of class names that replaces the current class list.
 */
declare type eles_classes = {
    NULL: any;
    classes: any;
};

/**
 * @property classes - An array (or a space-separated string) of class names to add to the elements.
 */
declare type eles_addClass = {
    classes: any;
};

/**
 * @property className - The name of the class to test for.
 */
declare type eles_hasClass = {
    className: any;
};

/**
 * @property classes - An array (or a space-separated string) of class names to toggle on the elements.
 * @property toggle - [optional] Instead of automatically toggling, adds the classes on truthy values or removes them on falsey values.
 */
declare type eles_toggleClass_type = {
    classes: any;
    toggle: any;
};

declare type eles_toggleClass = {
    eles_toggleClass_type: eles_toggleClass_type;
};

/**
 * @property classes - An array (or a space-separated string) of class names to add to the elements.
 */
declare type eles_removeClass = {
    classes: any;
};

/**
 * @property classes - An array (or a space-separated string) of class names to flash on the elements.
 * @property duration - [optional] The duration in milliseconds that the classes should be added on the elements. After the duration, the classes are removed.
 */
declare type eles_flashClass_type = {
    classes: any;
    duration: any;
};

declare type eles_flashClass = {
    eles_flashClass_type: eles_flashClass_type;
};

declare class eles {
    /**
     * Get or replace the current list of classes on the elements with the specified list.
     * @param classes - Get the list of classes as an array for the element. | Replace the list of classes for all elements in the collection.
     */
    static classes(...classes: eles_classes[]): void;
    /**
     * Add classes to elements.  The classes should be specified in the [stylesheet](#style) in order to have an effect on the rendered style of the elements.
     * @param classes - Adding Class
     */
    static addClass(...classes: eles_addClass[]): void;
    /**
     * Get whether an element has a particular class.
     * @param className - Adding Class
     */
    static hasClass(...className: eles_hasClass[]): void;
    /**
     * Toggle whether the elements have the specified classes.  The classes should be specified in the [stylesheet](#style) in order to have an effect on the rendered style of the elements.
     * @param toggle - Toggle Event
     */
    static toggleClass(...toggle: eles_toggleClass[]): void;
    /**
     * Remove classes from elements.  The classes should be specified in the [stylesheet](#style) in order to have an effect on the rendered style of the elements.
     * @param classes - Adding Class
     */
    static removeClass(...classes: eles_removeClass[]): void;
    /**
     * Add classes to the elements, and then remove the classes after a specified duration.
     * @param duration - flash Event
     */
    static flashClass(...duration: eles_flashClass[]): void;
    /**
     * Determine whether all elements in the collection match a selector.
     * @param selector - Matching Selector
     */
    static allAre(...selector: eles_allAre[]): void;
    /**
     * Determine whether any element in this collection matches a selector.
     * @param selector - Matching Selector
     */
    static is(...selector: eles_is[]): void;
    /**
     * Determine whether any element in this collection satisfies the specified test function.
     * @param fn - Listen to events that bubble up from elements matching the specified node selector:
     */
    static some(...fn: eles_some[]): void;
    /**
     * Determine whether all elements in this collection satisfy the specified test function.
     * @param fn - Determine test function
     */
    static every(...fn: eles_every[]): void;
    /**
     * Determine whether this collection contains exactly the same elements as another collection.
     * @param collection - Determine same collection
     */
    static same(...collection: eles_same[]): void;
    /**
     * Determine whether this collection contains any of the same elements as another collection.
     * @param collection - Determine any same collection
     */
    static anySame(...collection: eles_anySame[]): void;
    /**
     * Determine whether all elements in the specified collection are in the neighbourhood of the calling collection.
     * @param collection - Determine neighbourhood collection
     */
    static allAreNeighbors(...collection: eles_allAreNeighbors[]): void;
    /**
     * Determine whether this collection contains all of the elements of another collection.
     * @param collection - Determine another collection
     */
    static contains(...collection: eles_contains[]): void;
    /**
     * Perform a traditional left/right diff on the two collections.
     * @param other - diff Event | diff Event
     */
    static diff(...other: eles_diff[]): void;
    /**
     * Perform an in-place operation on the calling collection to remove the given elements.
     * @param toRemove - unmerge Event | unmerge Event
     */
    static unmerge(...toRemove: eles_unmerge[]): void;
    /**
     * Get an array containing values mapped from the collection.
     * @param mapFn - Determine test function
     */
    static map(...mapFn: eles_map[]): void;
    /**
     * Reduce a single value by applying a function against an accumulator and each value of the collection.
     * @param fn - Determine reduce function
     */
    static reduce(...fn: eles_reduce[]): void;
    /**
     * Find a maximum value and the corresponding element.
     * @param valFn - Determine max function
     */
    static max(...valFn: eles_max[]): void;
    /**
     * Find a minimum value and the corresponding element.
     * @param valFn - Determine min function
     */
    static min(...valFn: eles_min[]): void;
    /**
     * Iterate over the elements in the collection.
     * @param fn - Determine forEach function
     */
    static forEach(...fn: eles_forEach[]): void;
    /**
     * Get a subset of the elements in the collection based on specified indices.
     * @param start - Slice
     */
    static slice(...start: eles_slice[]): void;
    /**
     * Get the number of elements in the collection.
     */
    static size(): void;
    /**
     * Get an element at a particular index in the collection.
     * @param i - Get the index of the element. | Get the first element in the collection. | Get the last element in the collection.
     */
    static eq(...i: eles_eq[]): void;
    /**
     * Get whether the collection is empty, meaning it has no elements.
     * @param x - Get whether the collection is empty. | Get whether the collection is nonempty.
     */
    static empty(...x: eles_empty[]): void;
    /**
     * Get a new collection containing the elements sorted by the specified comparison function.
     * @param sortFn - The sorting comparison function.
     */
    static sort(...sortFn: eles_sort[]): void;
    /**
     * Get a new layout, which can be used to algorithmically position the nodes in the collection.
     * @param options - The layouting comparison function.
     */
    static layout(...options: eles_layout[]): void;
    /**
     * Get or override the style of the element.
     * @param value - Get a name-value pair object containing visual style properties and their values for the element. | Get a particular style property value. | Set a particular style property value. | Set several particular style property values. | Remove all style overrides. | Remove specific style overrides.
     */
    static style(...value: eles_style[]): void;
}

/**
 * @property selector - The selector to match against.
 */
declare type eles_allAre = {
    selector: any;
};

/**
 * @property selector - The selector to match against.
 */
declare type eles_is = {
    selector: any;
};

/**
 * function(ele, i, eles) [, thisArg]
 * @property ele - The event object.
 * @property i - The index of the current element.
 * @property eles - The collection of elements being tested.
 */
declare type eles_some_callback_type = {
    ele: any;
    i: any;
    eles: any;
};

/**
 * @property function(ele,i,eles) - eles_some_callback_type
 */
declare type eles_some_callback = () => void;

/**
 * @property eles_some_callback - The test function that returns truthy values for elements that satisfy the test and falsey values for elements that do not satisfy the test.
 * @property thisArg - [optional] The value for `this` within the test function.
 */
declare type eles_collection_some = {
    eles_some_callback: (...params: any[]) => any;
    thisArg: any;
};

declare type eles_some = {
    eles_collection_some: eles_collection_some;
};

/**
 * function(ele, i, eles) [, thisArg]
 * @property ele - The event object.
 * @property i - The index of the current element.
 * @property eles - The collection of elements being tested.
 */
declare type eles_every_callback_type = {
    ele: any;
    i: any;
    eles: any;
};

/**
 * @property function(ele,i,eles) - eles_every_callback_type
 */
declare type eles_every_callback = () => void;

/**
 * @property eles_every_callback - The test function that returns truthy values for elements that satisfy the test and falsey values for elements that do not satisfy the test.
 * @property thisArg - [optional] The value for `this` within the test function.
 */
declare type eles_collection_every = {
    eles_every_callback: (...params: any[]) => any;
    thisArg: any;
};

declare type eles_every = {
    eles_collection_every: eles_collection_every;
};

/**
 * @property eles - The other elements to compare to.
 */
declare type eles_same = {
    eles: any;
};

/**
 * @property eles - The other elements to compare to.
 */
declare type eles_anySame = {
    eles: any;
};

/**
 * @property eles - The other elements to compare to.
 */
declare type eles_allAreNeighbors = {
    eles: any;
};

/**
 * @property eles - The other elements to compare to.
 */
declare type eles_contains = {
    eles: any;
};

declare class nodes {
    /**
     * Get the compound parent node of each node in the collection.
     * @param selector - Get Parent Node.
     */
    static parent(...selector: nodes_parent[]): void;
    /**
     * Get all compound ancestors common to all the nodes in the collection, starting with the closest and getting progressively farther.
     * @param selector - Get commonAncestors Node.
     */
    static commonAncestors(...selector: nodes_commonAncestors[]): void;
    /**
     * Get all orphan (i.e. has no compound parent) nodes in the calling collection.
     * @param selector - Get orphans Node.
     */
    static orphans(...selector: nodes_orphans[]): void;
    /**
     * Get all nonorphan (i.e. has no compound parent) nodes in the calling collection.
     * @param selector - Get nonorphans Node.
     */
    static nonorphans(...selector: nodes_nonorphans[]): void;
    /**
     * Get all compound child (i.e. direct descendant) nodes of each node in the collection.
     */
    static children: any;
    /**
     * Get all sibling (i.e. same compound parent) nodes of each node in the collection.
     * @param selector - Get siblings Node.
     */
    static siblings(...selector: nodes_siblings[]): void;
    /**
     * Get whether the node is a compound parent (i.e. a node containing one or more child nodes)
     */
    static isParent(): void;
    /**
     * Get whether the node is childless (i.e. a node with no child nodes)
     */
    static isChildless(): void;
    /**
     * Get whether the node is a compound child (i.e. contained within a node)
     */
    static isChild(): void;
    /**
     * Get whether the node is an orphan (i.e. a node with no parent)
     */
    static isOrphan(): void;
    /**
     * Get all compound descendant (i.e. children, children's children, etc.) nodes of each node in the collection.
     * @param selector - Get descendants Node.
     */
    static descendants(...selector: nodes_descendants[]): void;
    /**
     * Get all elements in the graph that are not in the calling collection.
     */
    static absoluteComplement(): void;
    /**
     * Get whether the element is a node.
     */
    static isNode(): void;
    /**
     * Get whether the element is an edge.
     */
    static isEdge(): void;
    /**
     * Get whether the edge is a loop (i.e. same source and target).
     */
    static isLoop(): void;
    /**
     * Get whether the edge is simple (i.e. different source and target).
     */
    static isSimple(): void;
    /**
     * Get the group string that defines the type of the element.
     */
    static group(): void;
    /**
     * Get the collection as an array, maintaining the order of the elements.
     */
    static toArray(): void;
    /**
     * Position the nodes for a discrete/synchronous layout.
     * @param options - Position the nodes.
     */
    static layoutPositions(...options: nodes_layoutPositions[]): void;
    /**
     * From the set of calling nodes, get the nodes which are roots (i.e. no incoming edges, as in a directed acyclic graph).
     */
    static roots: any;
    /**
     * From the set of calling nodes, get the nodes which are leaves (i.e. no outgoing edges, as in a directed acyclic graph).
     */
    static leaves: any;
    /**
     * Get edges (and their targets) coming out of the nodes in the collection.
     */
    static outgoers: any;
    /**
     * Recursively get edges (and their targets) coming out of the nodes in the collection (i.e. the outgoers, the outgoers' outgoers, ...).
     */
    static successors: any;
    /**
     * Get edges (and their sources) coming into the nodes in the collection.
     */
    static incomers: any;
    /**
     * Recursively get edges (and their sources) coming into the nodes in the collection (i.e. the incomers, the incomers' incomers, ...).
     */
    static predecessors: any;
}

/**
 * @property selector - [optional] A selector used to filter the resultant collection.
 */
declare type nodes_parent = {
    selector: any;
};

/**
 * @property selector - [optional] A selector used to filter the resultant collection.
 */
declare type nodes_commonAncestors = {
    selector: any;
};

/**
 * @property selector - [optional] A selector used to filter the resultant collection.
 */
declare type nodes_orphans = {
    selector: any;
};

/**
 * @property selector - [optional] A selector used to filter the resultant collection.
 */
declare type nodes_nonorphans = {
    selector: any;
};

/**
 * @property selector - [optional] A selector used to filter the resultant collection.
 */
declare type nodes_children = {
    selector: any;
};

/**
 * @property selector - [optional] A selector used to filter the resultant collection.
 */
declare type nodes_siblings = {
    selector: any;
};

/**
 * @property selector - [optional] A selector used to filter the resultant collection.
 */
declare type nodes_descendants = {
    selector: any;
};

/**
 * @property eles - The elements on the right side of the diff.
 * @property selector - A selector representing the elements on the right side of the diff. All elements in the graph matching the selector are used as the passed collection.
 */
declare type eles_diff = {
    eles: any;
    selector: any;
};

/**
 * @property eles - The elements to remove in-place.
 * @property selector - A selector representing the elements to remove. All elements in the graph matching the selector are used as the passed collection.
 */
declare type eles_unmerge = {
    eles: any;
    selector: any;
};

/**
 * function(ele, i, eles) [, thisArg]
 * @property ele - The current element.
 * @property i - The index of the current element.
 * @property eles - The collection of elements being mapped.
 */
declare type eles_map_callback_type = {
    ele: any;
    i: any;
    eles: any;
};

/**
 * @property function(ele,i,eles) - eles_map_callback_type
 */
declare type eles_map_callback = () => void;

/**
 * @property eles_map_callback - The function that returns the mapped value for each element.
 * @property thisArg - [optional] The value for `this` within the iterating function.
 */
declare type eles_collection_map = {
    eles_map_callback: (...params: any[]) => any;
    thisArg: any;
};

declare type eles_map = {
    eles_collection_map: eles_collection_map;
};

/**
 * function(prevVal, ele, i, eles)
 * @property prevVal - The value accumulated from previous elements.
 * @property ele - The current element.
 * @property i - The index of the current element.
 * @property eles - The collection of elements being reduced.
 */
declare type eles_reduce_callback_type = {
    prevVal: any;
    ele: any;
    i: any;
    eles: any;
};

/**
 * @property function(prevVal,ele,i,eles) - eles_reduce_callback_type
 */
declare type eles_reduce_callback = () => void;

/**
 * @property eles_reduce_callback - The function that returns the accumulated value given the previous value and the current element.
 */
declare type eles_collection_reduce = {
    eles_reduce_callback: (...params: any[]) => any;
};

declare type eles_reduce = {
    eles_collection_reduce: eles_collection_reduce;
};

/**
 * function(ele, i, eles) [, thisArg]
 * @property ele - The current element.
 * @property i - The index of the current element.
 * @property eles - The collection of elements being searched.
 */
declare type eles_max_callback_type = {
    ele: any;
    i: any;
    eles: any;
};

/**
 * @property function(ele,i,eles) - eles_max_callback_type
 */
declare type eles_max_callback = () => void;

/**
 * @property eles_max_callback - The function that returns the value to compare for each element.
 * @property thisArg - [optional] The value for `this` within the iterating function.
 */
declare type eles_collection_max = {
    eles_max_callback: (...params: any[]) => any;
    thisArg: any;
};

declare type eles_max = {
    eles_collection_max: eles_collection_max;
};

/**
 * function(ele, i, eles) [, thisArg]
 * @property ele - The current element.
 * @property i - The index of the current element.
 * @property eles - The collection of elements being searched.
 */
declare type eles_min_callback_type = {
    ele: any;
    i: any;
    eles: any;
};

/**
 * @property function(ele,i,eles) - eles_min_callback_type
 */
declare type eles_min_callback = () => void;

/**
 * @property eles_min_callback - The function that returns the value to compare for each element.
 * @property thisArg - [optional] The value for `this` within the iterating function.
 */
declare type eles_collection_min = {
    eles_min_callback: (...params: any[]) => any;
    thisArg: any;
};

declare type eles_min = {
    eles_collection_min: eles_collection_min;
};

/**
 * function(ele, i, eles) [, thisArg]
 * @property ele - The current element.
 * @property i - The index of the current element.
 * @property eles - The collection of elements being searched.
 */
declare type eles_forEach_callback_type = {
    ele: any;
    i: any;
    eles: any;
};

/**
 * @property function(ele,i,eles) - eles_forEach_callback_type
 */
declare type eles_forEach_callback = () => void;

/**
 * @property eles_forEach_callback - The function executed each iteration.
 * @property thisArg - [optional] The value for `this` within the iterating function.
 */
declare type eles_collection_forEach = {
    eles_forEach_callback: (...params: any[]) => any;
    thisArg: any;
};

declare type eles_forEach = {
    eles_collection_forEach: eles_collection_forEach;
};

/**
 * @property start - [optional] An integer that specifies where to start the selection. The first element has an index of 0. Use negative numbers to select from the end of an array.
 * @property end - [optional] An integer that specifies where to end the selection. If omitted, all elements from the start position and to the end of the array will be selected. Use negative numbers to select from the end of an array.
 */
declare type eles_events_slice = {
    start: any;
    end: any;
};

declare type eles_slice = {
    eles_events_slice: eles_events_slice;
};

/**
 * name, value
 * @property index - The index of the element to get.
 */
declare type eles_eq_index = {
    index: any;
};

/**
 * @property eles_eq_index - Set a particular data field.
 */
declare type eles_eq = {
    eles_eq_index: eles_eq_index;
    NULL: any;
    NULL: any;
};

declare type eles_empty = {
    NULL: any;
    NULL: any;
};

/**
 * @property function(ele1,ele2) - Get a new collection containing the elements sorted by the specified comparison function.
 */
declare type eles_sort = {
    function(ele1,ele2): any;
};

declare class node {
    /**
     * Get the node width and height. This function is intended for use in layout positioning to do overlap detection.
     * @param options - The node layoutDimensionsing function.
     */
    static layoutDimensions(...options: node_layoutDimensions[]): void;
}

/**
 * @property options - The layout options object.
 */
declare type node_layoutDimensions = {
    options: any;
};

/**
 * layout, options, function(ele, i)
 * @property ele - The node being iterated over for which the function should return a position to set.
 * @property i - The index of the current node while iterating over the nodes in the layout.
 */
declare type nodes_layoutPositions_callback_type = {
    ele: any;
    i: any;
};

/**
 * @property function(ele,i) - nodes_layoutPositions_callback_type
 */
declare type nodes_layoutPositions_callback = () => void;

/**
 * @property layout - The layout.
 * @property options - The layout options object.
 * @property nodes_layoutPositions_callback - A function that returns the new position for the specified node.
 */
declare type nodes_layouts_layoutPositions = {
    layout: any;
    options: any;
    nodes_layoutPositions_callback: (...params: any[]) => any;
};

declare type nodes_layoutPositions = {
    nodes_layouts_layoutPositions: nodes_layouts_layoutPositions;
};

/**
 * @property options - The layout options.
 */
declare type eles_layout = {
    options: any;
};

declare class ele {
    /**
     * Get the numeric value of a style property in preferred units that can be used for calculations.
     * @param property - The numericStyle function.
     */
    static numericStyle(...property: ele_numericStyle[]): void;
    /**
     * Get the units that `ele.numericStyle()` is expressed in, for a particular property.
     * @param property - The numericStyleUnits function.
     */
    static numericStyleUnits(...property: ele_numericStyleUnits[]): void;
    /**
     * Get the effective opacity of the element (i.e. on-screen opacity), which takes into consideration parent node opacity.
     */
    static effectiveOpacity(): void;
    /**
     * Get whether the element's effective opacity is completely transparent, which takes into consideration parent node opacity.
     */
    static transparent(): void;
}

/**
 * @property name - The name of the style property to get.
 */
declare type ele_numericStyle = {
    name: any;
};

/**
 * @property name - The name of the style property to get.
 */
declare type ele_numericStyleUnits = {
    name: any;
};

/**
 * name, value
 * @property name - The name of the visual style property to set.
 * @property value - The value of the visual style property to set.
 */
declare type eles_style_name_val = {
    name: any;
    value: any;
};

/**
 * @property name - The name of the visual style property to get.
 * @property eles_style_name_val - Set a particular style property value.
 * @property obj - An object of style property name-value pairs to set.
 * @property names - A space-separated list of property names to remove overrides.
 */
declare type eles_style = {
    NULL: any;
    name: any;
    eles_style_name_val: eles_style_name_val;
    obj: any;
    NULL: any;
    names: any;
};

declare class edge {
    /**
     * Get source node of this edge.
     */
    static source: any;
    /**
     * Get target node of this edge.
     */
    static target: any;
    /**
     * Get source nodes connected to the edges in the collection.
     */
    static sources: any;
    /**
     * Get target nodes connected to the edges in the collection.
     */
    static targets: any;
}

/**
 * @property selector - [optional] An optional selector that is used to filter the resultant collection.
 */
declare type nodes_roots = {
    selector: any;
};

/**
 * @property selector - [optional] An optional selector that is used to filter the resultant collection.
 */
declare type nodes_leaves = {
    selector: any;
};

/**
 * @property selector - [optional] An optional selector that is used to filter the resultant collection.
 */
declare type nodes_outgoers = {
    selector: any;
};

/**
 * @property selector - [optional] An optional selector that is used to filter the resultant collection.
 */
declare type nodes_successors = {
    selector: any;
};

/**
 * @property selector - [optional] An optional selector that is used to filter the resultant collection.
 */
declare type nodes_incomers = {
    selector: any;
};

/**
 * @property selector - [optional] An optional selector that is used to filter the resultant collection.
 */
declare type nodes_predecessors = {
    selector: any;
};

/**
 * @property selector - [optional] An optional selector that is used to filter the resultant collection.
 */
declare type edge_source = {
    selector: any;
};

/**
 * @property selector - [optional] An optional selector that is used to filter the resultant collection.
 */
declare type edge_target = {
    selector: any;
};

/**
 * @property selector - [optional] An optional selector that is used to filter the resultant collection.
 */
declare type edge_sources = {
    selector: any;
};

/**
 * @property selector - [optional] An optional selector that is used to filter the resultant collection.
 */
declare type edge_targets = {
    selector: any;
};

declare class ani {
    /**
     * Requests that the animation be played, starting on the next frame. If the animation is complete, it restarts from the beginning.
     */
    static play(): void;
    /**
     * Get whether the animation is currently playing.
     */
    static playing(): void;
    /**
     * Apply the animation at its current progress.
     */
    static apply(): void;
    /**
     * Get whether the animation is currently applying.
     */
    static applying(): void;
    /**
     * Pause the animation, maintaining the current progress.
     */
    static pause(): void;
    /**
     * Stop the animation, maintaining the current progress and removing the animation from any associated queues.
     */
    static stop(): void;
    /**
     * Get or set how far along the animation has progressed.
     * @param x - Get the progress of the animation in percent. | Set the progress of the animation in percent. | Get the progress of the animation in milliseconds. | Set the progress of the animation in milliseconds. | Rewind the animation to the beginning. | Fastforward the animation to the end.
     */
    static progress(...x: ani_progress[]): void;
    /**
     * Get whether the animation has progressed to the end.
     */
    static completed(): void;
    /**
     * Reverse the animation such that its starting conditions and ending conditions are reversed.
     */
    static reverse(): void;
    /**
     * Get a promise that is fulfilled with the specified animation event.
     * @param x - Get a promise that is fulfilled with the next `completed` event. | Get a promise that is fulfilled with the specified animation event.
     */
    static promise(...x: ani_promise[]): void;
}

/**
 * @property progress - The progress in percent (i.e. between 0 and 1 inclusive) to set to the animation.
 * @property time - The progress in milliseconds (i.e. between 0 and the duration inclusive) to set to the animation.
 */
declare type ani_progress = {
    NULL: any;
    progress: any;
    NULL: any;
    time: any;
    NULL: any;
    NULL: any;
};

/**
 * @property animationEvent - A string for the event name; `completed` or `complete` for completing the animation or `frame` for the next frame of the animation.
 */
declare type ani_promise = {
    NULL: any;
    animationEvent: any;
};

declare class layout {
    /**
     * Start running the layout.
     */
    static run(): void;
    /**
     * Stop running the (asynchronous/discrete) layout.
     */
    static stop(): void;
    /**
     * Listen to events that are emitted by the layout.
     * @param x - Listen to events.
     */
    static on(...x: layout_on[]): void;
    /**
     * @param x - Get a promise that is resolved when the layout emits the first of any of the specified events.
     */
    static promiseOn(...x: layout_promiseOn[]): void;
    /**
     * @param x - Listen to events that are emitted by the layout, and run the handler only once.
     */
    static one(...x: layout_one[]): void;
    /**
     * @param x - Remove event handlers on the layout.
     */
    static removeListener(...x: layout_removeListener[]): void;
    /**
     * Remove all event handlers on the layout.
     */
    static removeAllListeners(): void;
    /**
     * @param x - Emit one or more events on the layout.
     */
    static emit(...x: layout_emit[]): void;
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

