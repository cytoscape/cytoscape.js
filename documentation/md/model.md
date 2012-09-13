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

By default, a function returns a reference back to the calling object to allow for jQuery-like chaining.  Unless otherwise indicated in this documentation, a function is chainable in this manner unless a different return value is specified.  This applies both to the core and to collections.


## Position

There is an important distinction to make for position:  A position may be a _model_ position or a _rendered_ position.

A model position &mdash; as its name suggests &mdash; is the position stored in the model for an element.  An element's model position remains constant, despite changes to zoom and pan.

A rendered position is an on-screen location relative to the viewport.  For example, a rendered position of `{ x: 100, y: 100 }` specifies a point 100 pixels to the right and 100 pixels down from the top-left corner of the viewport.  An element's rendered position naturally changes as zoom and pan changes, because the element's on-screen position in the viewport changes as zooming and panning are applied.

In this documentation, "position" refers to model position unless otherwise stated.


## Style

Style in Cytoscape.js follows CSS conventions as closely as possible.  In most cases, a property has the same name and behaviour as its corresponding CSS namesake.  However, the properties in CSS are not sufficient to specify the style of some parts of the graph.  In that case, additional properties are introduced that are unique to Cytoscape.js.

### Types



## Event types

### User input device events

These are normal browser events that you can bind to via Cytoscape Web.  You can bind these events to the [core](Core), to the [background](Events) of the graph, and to [collection](Collection).

 * **mousedown** : when the mouse button is pressed
 * **mouseup** : when the mouse button is released
 * **click** : after mousedown then mouseup
 * **mouseover** : when the cursor is put on top of the target
 * **mouseout** : when the cursor is moved off of the target
 * **mousemove** : when the cursor is moved somewhere on top of the target
 * **touchstart** : when one or more fingers starts to touch the screen
 * **touchmove** : when one or more fingers are moved on the screen
 * **touchend** : when one or more fingers are removed from the screen

### Collection events

These events are custom to Cytoscape Web.  You can bind to these events for [collections](Collection).

 * **select** : when an element is selected
 * **unselect** : when an element is unselected
 * **lock** : when an element is locked
 * **unlock** : when an element is unlocked
 * **grab** : when an element is grabbed by the mouse cursor or a finger on a touch input
 * **drag** : when an element is grabbed and then moved
 * **free** : when an element is freed (i.e. let go from being grabbed)
 * **position** : when an element changes position
 * **data** : when an element's data is changed
 * **bypass** : when an element's bypass is changed
 * **add** : when an element is added to the graph
 * **remove** : when an element is removed from the graph

### Graph events

These events are custom to Cytoscape Web, and they occur on the [core](Core).

 * **layoutstart** : when a layout starts running
 * **layoutready** : when a layout has set positions for all the nodes
 * **layoutstop** : when a layout has finished running completely or otherwise stopped running
 * **load** : when a new graph is loaded via [`cy.load()`](Core-load)
 * **ready** : when a new instance of Cytoscape Web is ready to be interacted with
 * **done** : when a new instance of Cytoscape Web is ready to be interacted with and its initial layout has finished running
 * **pan** : when the viewport is panned
 * **zoom** : when the viewport is zoomed