## Architecture & API

There are two components in the architecture that a developer need concern himself in order to use Cytoscape.js, the core and the collection.  In Cytoscape.js, the core is a developer's main entry point into the library.  From the core, a developer can run layouts, alter the viewport, and perform other operations on the graph as a whole.

The core provides several functions to access elements in the graph.  Each of these functions returns a collection, a set of elements in the graph.  A set of functions are available on collections that allow the developer to filter the collection, perform operations on the collection, traverse the graph about the collection, get data about elements in the collection, and so on.


## Notation

There are several types that different functions can be executed on, and the variable names used to denote these types in the documentation are outlined below:

```
Notation       Works on
--------       --------
cy ........... the core
eles ......... a collection of one or more elements (nodes and edges)
ele .......... a collection of a single element (node or edge)
nodes ........ a collection of one or more nodes
node ......... a collection of a single node
edges ........ a collection of one or more edges
edge ......... a collection of a single edge
 ```

By default, a function returns a reference back to the calling object to allow for jQuery-like chaining (e.g. `obj.fn1().fn2().fn3()`).  Unless otherwise indicated in this documentation, a function is chainable in this manner unless a different return value is specified.  This applies both to the core and to collections.


## Position

There is an important distinction to make for position:  A position may be a _model_ position or a _rendered_ position.

A model position &mdash; as its name suggests &mdash; is the position stored in the model for an element.  An element's model position remains constant, despite changes to zoom and pan.

A rendered position is an on-screen location relative to the viewport.  For example, a rendered position of `{ x: 100, y: 100 }` specifies a point 100 pixels to the right and 100 pixels down from the top-left corner of the viewport.  An element's rendered position naturally changes as zoom and pan changes, because the element's on-screen position in the viewport changes as zooming and panning are applied.

In this documentation, "position" refers to model position unless otherwise stated.


## Elements JSON

Examples are given that outline format of the elements JSON used to load elements into Cytoscape.js:

```js
$('#cy').cytoscape({
  
  elements: [
    { // node n1
      group: 'nodes', // 'nodes' for a node, 'edges' for an edge

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

      classes: 'foo bar' // a space separated list of class names that the element has
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
      data: { id: 'nparent' }
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

  // so we can see the ids
  style: cytoscape.stylesheet().
    selector('node')
      .css({
          'content': 'data(id)'
        })

});
```