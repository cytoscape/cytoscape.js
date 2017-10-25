## Graph model

Cytoscape.js supports many different graph theory usecases.  It supports directed graphs, undirected graphs, mixed graphs, loops, multigraphs, compound graphs (a type of hypergraph), and so on.  

We are regularly making additions and enhancements to the library, and we gladly accept [feature requests](https://github.com/cytoscape/cytoscape.js/issues/new) and pull requests.


## Architecture & API

There are two components in the architecture that a developer need concern himself in order to use Cytoscape.js, the core (i.e. a graph instance) and the collection.  In Cytoscape.js, the core is a developer's main entry point into the library.  From the core, a developer can run layouts, alter the viewport, and perform other operations on the graph as a whole.

The core provides several functions to access elements in the graph.  Each of these functions returns a collection, a set of elements in the graph.  Functions are available on collections that allow the developer to filter the collection, perform operations on the collection, traverse the graph about the collection, get data about elements in the collection, and so on.

<span class="important-indicator"></span> Note that a collection is immutable by default, meaning that the set of elements within a collection can not be changed.  The API returns a new collection with different elements when necessary, instead of mutating the existing collection.  This allows the developer to safely use set theory operations on collections, use collections functionally, and so on.  Note that because a collection is just a list of elements, it is inexpensive to create new collections.  

<span class="important-indicator"></span> For very performance intensive code, a collection can be treated as mutable with [`eles.merge()`](#eles.merge) and [`eles.unmerge()`](#eles.unmerge).  Most apps should never need these functions.


## Functions

There are several types that different functions can be executed on, and the variable names used to denote these types in the documentation are outlined below:

| Shorthand     | Works on                                                |
| ------------- | ------------------------------------------------------- |
| `cy`          | the core                                                |
| `eles`        | a collection of one or more elements (nodes and edges)  |
| `ele`         | a collection of a single element (node or edge)         |
| `nodes`       | a collection of one or more nodes                       |
| `node`        | a collection of a single node                           |
| `edges`       | a collection of one or more edges                       |
| `edge`        | a collection of a single edge                           |
| `layout`      | a layout                                                |
| `ani `        | an animation                                            |

By default, a function returns a reference back to the calling object to allow for chaining (e.g. `obj.fn1().fn2().fn3()`).  Unless otherwise indicated in this documentation, a function is chainable in this manner unless a different return value is specified.  This applies both to the core and to collections.

For functions that return a value, note that calling a singular --- `ele`, `node`, or `edge` --- function on a collection of more than one element will return the expected value for only the first element.


## Object ownership

When passing objects to Cytoscape.js for creating elements, animations, layouts, etc., the objects are considered owned by Cytoscape.  Objects like elements have several levels to them, and doing deep copies of those objects every time they are passed to Cytoscape creates additional expense.  When desired, the dev can copy objects manually before passing them to Cytoscape.  However, copying is not necessary for most developers most of the time.


## Gestures

Cytoscape.js supports several gestures:

 * Grab and drag background to pan : touch & desktop
 * Pinch to zoom : touch & desktop (with supported trackpad)
 * Mouse wheel to zoom : desktop
 * Two finger trackpad up or down to zoom : desktop
 * Tap to select : touch & desktop
 * Tap background to unselect : desktop
 * Taphold background to unselect : desktop & touch
 * Multiple selection via modifier key (shift, command, control, alt) + tap : desktop
 * Box selection : touch (three finger swipe) & desktop (modifier key + mousedown then drag)
 * Grab and drag nodes : touch & desktop

All gesture actions can be controlled by the dev, toggling them on or off whenever needed.


## Position

A node's position refers to the centre point of its body.

There is an important distinction to make for position:  A position may be a _model_ position or a _rendered_ position.

A model position --- as its name suggests --- is the position stored in the model for an element.  An element's model position remains constant, despite changes to zoom and pan.  Numeric style property values are specified in model co-ordinates, e.g. an node with width 20px will be 20 pixels wide at zoom 1.

A rendered position is an on-screen location relative to the viewport.  For example, a rendered position of `{ x: 100, y: 100 }` specifies a point 100 pixels to the right and 100 pixels down from the top-left corner of the viewport.  The model position and rendered position are the same at zoom 1 and pan (0, 0).

An element's rendered position naturally changes as zoom and pan changes, because the element's on-screen position in the viewport changes as zooming and panning are applied.  Panning is always measured in rendered coordinates.

In this documentation, "position" refers to model position unless otherwise stated.

A node's position can be set manually, or it can be set automatically using a [layout](#layouts).  Because the positions of two nodes influence the lengths of the edges in between them, a layout effectively sets edge lengths.

## Elements JSON

Examples are given that outline format of the elements JSON used to load elements into Cytoscape.js:

```js
cytoscape({

  container: document.getElementById('cy'),

  elements: [
    { // node n1
      group: 'nodes', // 'nodes' for a node, 'edges' for an edge
      // NB the group field can be automatically inferred for you but specifying it
      // gives you nice debug messages if you mis-init elements


      data: { // element data (put json serialisable dev data here)
        id: 'n1', // mandatory (string or number) id for each element, assigned automatically on undefined
        parent: 'nparent', // indicates the compound node parent id; not defined => no parent
      },

      // scratchpad data (usually temp or nonserialisable data)
      scratch: {
        _foo: 'bar' // app fields prefixed by underscore; extension fields unprefixed
      },

      position: { // the model position of the node (optional on init, mandatory after)
        x: 100,
        y: 100
      },

      selected: false, // whether the element is selected (default false)

      selectable: true, // whether the selection state is mutable (default true)

      locked: false, // when locked a node's position is immutable (default false)

      grabbable: true, // whether the node can be grabbed and moved by the user

      classes: 'foo bar' // a space separated list of class names that the element has
    },

    { // node n2
      data: { id: 'n2' },
      renderedPosition: { x: 200, y: 200 } // can alternatively specify position in rendered on-screen pixels
    },

    { // node n3
      data: { id: 'n3', parent: 'nparent' },
      position: { x: 123, y: 234 }
    },

    { // node nparent
      data: { id: 'nparent', position: { x: 200, y: 100 } }
    },

    { // edge e1
      data: {
        id: 'e1',
        // inferred as an edge because `source` and `target` are specified:
        source: 'n1', // the source node id (edge comes from this node)
        target: 'n2'  // the target node id (edge goes to this node)
      }
    }
  ],

  layout: {
    name: 'preset'
  },

  // so we can see the ids
  style: [
    {
      selector: 'node',
      style: {
        'content': 'data(id)'
      }
    }
  ]

});
```


## Compound nodes

Compound nodes are an addition to the traditional graph model.  A compound node contains a number of child nodes, similar to how a HTML DOM element can contain a number of child elements.

Compound nodes are specified via the `parent` field in an element's `data`.  Similar to the `source` and `target` fields of edges, the `parent` field is immutable:  A node's parent can be specified when the node is added to the graph, and after that point, this parent-child relationship is immutable.  However, you can effectively move child nodes via [`eles.move()`](#collection/graph-manipulation/eles.move).

A compound parent node does not have independent dimensions (position and size), as those values are automatically inferred by the positions and dimensions of the descendant nodes.

As far as the API is concerned, compound nodes are treated just like regular nodes --- except in [explicitly compound functions](#collection/compound-nodes) like `node.parent()`.  This means that traditional graph theory functions like `eles.dijkstra()` and `eles.neighborhood()` do not make special allowances for compound nodes, so you may need to make different calls to the API depending on your usecase.

For instance:

```js
var a = cy.$('#a'); // assume a compound node

// the neighbourhood of `a` contains directly connected elements
var directlyConnected = a.neighborhood();

// you may want everything connected to its descendants instead
// because the descendants "belong" to `a`
var indirectlyConnected = a.add( a.descendants() ).neighborhood();
```
