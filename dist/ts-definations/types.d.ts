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

declare class eles {
}

/**
 * @property classes - An array (or a space-separated string) of class names that replaces the current class list.
 */
declare type eles_classes = {
    NULL: any;
    classes: any;
};

declare namespace eles {
    /**
     * Get or replace the current list of classes on the elements with the specified list.
     */
    namespace classes { }
    /**
     * Add classes to elements.  The classes should be specified in the [stylesheet](#style) in order to have an effect on the rendered style of the elements.
     */
    namespace addClass { }
    /**
     * Get whether an element has a particular class.
     */
    namespace hasClass { }
    /**
     * Toggle whether the elements have the specified classes.  The classes should be specified in the [stylesheet](#style) in order to have an effect on the rendered style of the elements.
     */
    namespace toggleClass { }
    /**
     * Remove classes from elements.  The classes should be specified in the [stylesheet](#style) in order to have an effect on the rendered style of the elements.
     */
    namespace removeClass { }
    /**
     * Add classes to the elements, and then remove the classes after a specified duration.
     */
    namespace flashClass { }
    /**
     * Determine whether all elements in the collection match a selector.
     */
    namespace allAre { }
    /**
     * Determine whether any element in this collection matches a selector.
     */
    namespace is { }
    /**
     * Determine whether any element in this collection satisfies the specified test function.
     */
    namespace some { }
    /**
     * Determine whether all elements in this collection satisfy the specified test function.
     */
    namespace every { }
    /**
     * Determine whether this collection contains exactly the same elements as another collection.
     */
    namespace same { }
    /**
     * Determine whether this collection contains any of the same elements as another collection.
     */
    namespace anySame { }
    /**
     * Determine whether all elements in the specified collection are in the neighbourhood of the calling collection.
     */
    namespace allAreNeighbors { }
    /**
     * Determine whether this collection contains all of the elements of another collection.
     */
    namespace contains { }
    /**
     * Perform a traditional left/right diff on the two collections.
     */
    namespace diff { }
    /**
     * Perform an in-place operation on the calling collection to remove the given elements.
     */
    namespace unmerge { }
    /**
     * Get an array containing values mapped from the collection.
     */
    namespace map { }
    /**
     * Reduce a single value by applying a function against an accumulator and each value of the collection.
     */
    namespace reduce { }
    /**
     * Find a maximum value and the corresponding element.
     */
    namespace max { }
    /**
     * Find a minimum value and the corresponding element.
     */
    namespace min { }
    /**
     * Iterate over the elements in the collection.
     */
    namespace forEach { }
    /**
     * Get a subset of the elements in the collection based on specified indices.
     */
    namespace slice { }
    /**
     * Get the number of elements in the collection.
     */
    namespace size { }
    /**
     * Get an element at a particular index in the collection.
     */
    namespace eq { }
    /**
     * Get whether the collection is empty, meaning it has no elements.
     */
    namespace empty { }
    /**
     * Get a new collection containing the elements sorted by the specified comparison function.
     */
    namespace sort { }
    /**
     * Get a new layout, which can be used to algorithmically position the nodes in the collection.
     */
    namespace layout { }
    /**
     * Get or override the style of the element.
     */
    namespace style { }
}

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
}

/**
 * @property selector - [optional] A selector used to filter the resultant collection.
 */
declare type nodes_parent = {
    selector: any;
};

declare namespace nodes {
    /**
     * Get the compound parent node of each node in the collection.
     */
    namespace parent { }
    /**
     * Get all compound ancestors common to all the nodes in the collection, starting with the closest and getting progressively farther.
     */
    namespace commonAncestors { }
    /**
     * Get all orphan (i.e. has no compound parent) nodes in the calling collection.
     */
    namespace orphans { }
    /**
     * Get all nonorphan (i.e. has no compound parent) nodes in the calling collection.
     */
    namespace nonorphans { }
    /**
     * Get all compound child (i.e. direct descendant) nodes of each node in the collection.
     */
    namespace children { }
    /**
     * Get all sibling (i.e. same compound parent) nodes of each node in the collection.
     */
    namespace siblings { }
    /**
     * Get whether the node is a compound parent (i.e. a node containing one or more child nodes)
     */
    namespace isParent { }
    /**
     * Get whether the node is childless (i.e. a node with no child nodes)
     */
    namespace isChildless { }
    /**
     * Get whether the node is a compound child (i.e. contained within a node)
     */
    namespace isChild { }
    /**
     * Get whether the node is an orphan (i.e. a node with no parent)
     */
    namespace isOrphan { }
    /**
     * Get all compound descendant (i.e. children, children's children, etc.) nodes of each node in the collection.
     */
    namespace descendants { }
    /**
     * Get all elements in the graph that are not in the calling collection.
     */
    namespace absoluteComplement { }
    /**
     * Get whether the element is a node.
     */
    namespace isNode { }
    /**
     * Get whether the element is an edge.
     */
    namespace isEdge { }
    /**
     * Get whether the edge is a loop (i.e. same source and target).
     */
    namespace isLoop { }
    /**
     * Get whether the edge is simple (i.e. different source and target).
     */
    namespace isSimple { }
    /**
     * Get the group string that defines the type of the element.
     */
    namespace group { }
    /**
     * Get the collection as an array, maintaining the order of the elements.
     */
    namespace toArray { }
    /**
     * Position the nodes for a discrete/synchronous layout.
     */
    namespace layoutPositions { }
    /**
     * From the set of calling nodes, get the nodes which are roots (i.e. no incoming edges, as in a directed acyclic graph).
     */
    namespace roots { }
    /**
     * From the set of calling nodes, get the nodes which are leaves (i.e. no outgoing edges, as in a directed acyclic graph).
     */
    namespace leaves { }
    /**
     * Get edges (and their targets) coming out of the nodes in the collection.
     */
    namespace outgoers { }
    /**
     * Recursively get edges (and their targets) coming out of the nodes in the collection (i.e. the outgoers, the outgoers' outgoers, ...).
     */
    namespace successors { }
    /**
     * Get edges (and their sources) coming into the nodes in the collection.
     */
    namespace incomers { }
    /**
     * Recursively get edges (and their sources) coming into the nodes in the collection (i.e. the incomers, the incomers' incomers, ...).
     */
    namespace predecessors { }
}

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
}

/**
 * @property options - The layout options object.
 */
declare type node_layoutDimensions = {
    options: any;
};

declare namespace node {
    /**
     * Get the node width and height. This function is intended for use in layout positioning to do overlap detection.
     */
    namespace layoutDimensions { }
}

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
}

/**
 * @property name - The name of the style property to get.
 */
declare type ele_numericStyle = {
    name: any;
};

declare namespace ele {
    /**
     * Get the numeric value of a style property in preferred units that can be used for calculations.
     */
    namespace numericStyle { }
    /**
     * Get the units that `ele.numericStyle()` is expressed in, for a particular property.
     */
    namespace numericStyleUnits { }
    /**
     * Get the effective opacity of the element (i.e. on-screen opacity), which takes into consideration parent node opacity.
     */
    namespace effectiveOpacity { }
    /**
     * Get whether the element's effective opacity is completely transparent, which takes into consideration parent node opacity.
     */
    namespace transparent { }
}

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

declare namespace edge {
    /**
     * Get source node of this edge.
     */
    namespace source { }
    /**
     * Get target node of this edge.
     */
    namespace target { }
    /**
     * Get source nodes connected to the edges in the collection.
     */
    namespace sources { }
    /**
     * Get target nodes connected to the edges in the collection.
     */
    namespace targets { }
}

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
}

declare namespace ani {
    /**
     * Requests that the animation be played, starting on the next frame. If the animation is complete, it restarts from the beginning.
     */
    namespace play { }
    /**
     * Get whether the animation is currently playing.
     */
    namespace playing { }
    /**
     * Apply the animation at its current progress.
     */
    namespace apply { }
    /**
     * Get whether the animation is currently applying.
     */
    namespace applying { }
    /**
     * Pause the animation, maintaining the current progress.
     */
    namespace pause { }
    /**
     * Stop the animation, maintaining the current progress and removing the animation from any associated queues.
     */
    namespace stop { }
    /**
     * Get or set how far along the animation has progressed.
     */
    namespace progress { }
    /**
     * Get whether the animation has progressed to the end.
     */
    namespace completed { }
    /**
     * Reverse the animation such that its starting conditions and ending conditions are reversed.
     */
    namespace reverse { }
    /**
     * Get a promise that is fulfilled with the specified animation event.
     */
    namespace promise { }
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

