## Graph model

Cytoscape.js supports many different graph theory usecases.  It supports directed graphs, undirected graphs, mixed graphs, loops, multigraphs, compound graphs (a type of hypergraph), and so on.  

We are regularly making additions and enhancements to the library, and we gladly accept [feature requests](https://github.com/cytoscape/cytoscape.js/issues/new) and pull requests.


## Architecture & API

There are two components in the architecture that a developer need concern himself in order to use Cytoscape.js, the core (i.e. a graph instance) and the collection.  In Cytoscape.js, the core is a developer's main entry point into the library.  From the core, a developer can run layouts, alter the viewport, and perform other operations on the graph as a whole.

The core provides several functions to access elements in the graph.  Each of these functions returns a collection, a set of elements in the graph.  Functions are available on collections that allow the developer to filter the collection, perform operations on the collection, traverse the graph about the collection, get data about elements in the collection, and so on.


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

By default, a function returns a reference back to the calling object to allow for chaining (e.g. `obj.fn1().fn2().fn3()`).  Unless otherwise indicated in this documentation, a function is chainable in this manner unless a different return value is specified.  This applies both to the core and to collections.

For functions that return a value, note that calling a singular &mdash; `ele`, `node`, or `edge` &mdash; function on a collection of more than one element will return the expected value for only the first element.


## Position

A node's position refers to the centre point of its bounding box.

There is an important distinction to make for position:  A position may be a _model_ position or a _rendered_ position.

A model position &mdash; as its name suggests &mdash; is the position stored in the model for an element.  An element's model position remains constant, despite changes to zoom and pan.

A rendered position is an on-screen location relative to the viewport.  For example, a rendered position of `{ x: 100, y: 100 }` specifies a point 100 pixels to the right and 100 pixels down from the top-left corner of the viewport.  An element's rendered position naturally changes as zoom and pan changes, because the element's on-screen position in the viewport changes as zooming and panning are applied.  Panning is always measured in rendered coordinates.

In this documentation, "position" refers to model position unless otherwise stated.

## Elements JSON

Examples are given that outline format of the elements JSON used to load elements into Cytoscape.js:

```js
cytoscape({

  container: document.getElementById('cy'),
  
  elements: [
    { // node n1
      group: 'nodes', // 'nodes' for a node, 'edges' for an edge

      // NB: id fields must be strings
      data: { // element data (put dev data here)
        id: 'n1', // mandatory for each element, assigned automatically on undefined
        parent: 'nparent', // indicates the compound node parent id; not defined => no parent
      },

      position: { // the model position of the node (optional on init, mandatory after)
        x: 100,
        y: 100
      },

      selected: false, // whether the element is selected (default false)

      selectable: true, // whether the selection state is mutable (default true)

      locked: false, // when locked a node's position is immutable (default false)

      grabbable: true, // whether the node can be grabbed and moved by the user

      classes: 'foo bar', // a space separated list of class names that the element has

      // NB: you should only use `css` for very special cases; use classes instead
      css: { 'background-color': 'red' } // overriden style properties
    },

    { // node n2
      group: 'nodes',
      data: { id: 'n2' },
      renderedPosition: { x: 200, y: 200 } // can alternatively specify position in rendered on-screen pixels
    },

    { // node n3
      group: 'nodes',
      data: { id: 'n3', parent: 'nparent' },
      position: { x: 123, y: 234 }
    },

    { // node nparent
      group: 'nodes',
      data: { id: 'nparent', position: { x: 200, y: 100 } }
    },

    { // edge e1
      group: 'edges',
      data: {
        id: 'e1',
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
      css: {
        'content': 'data(id)'
      }
    }
  ]

});
```

## Compound nodes

Compound nodes are an addition to the traditional graph model.  A compound node contains a number of child nodes, similar to how a HTML DOM element can contain a number of child elements.

Compound nodes are specified via the `parent` field in an element's `data`.  Similar to the `source` and `target` fields of edges, the `parent` field is immutable:  A node's parent can be specified when the node is added to the graph, and after that point, this parent-child relationship is immutable.  However, you can effectively move child nodes via [eles.move](#collection/graph-manipulation/eles.move).

As far as the API is concerned, compound nodes are treated just like regular nodes &mdash; except in [explicitly compound functions](#collection/compound-nodes) like `node.parent()`.  This means that traditional graph theory functions like `eles.dijkstra()` and `eles.neighborhood()` do not make special allowances for compound nodes, so you may need to make different calls to the API depending on your usecase.

For instance:

```js
var a = cy.$('#a'); // assume a compound node

// the neighbourhood of `a` contains directly connected elements
var directlyConnected = a.neighborhood();

// you may want everything connected to its descendants instead
// because the descendants "belong" to `a`
var indirectlyConnected = a.add( a.descendants() ).neighborhood();
```