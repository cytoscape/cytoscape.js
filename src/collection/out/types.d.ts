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

