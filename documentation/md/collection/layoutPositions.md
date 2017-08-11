This function is called by discrete layouts to update the graph with new node positions.

A layout is only responsible for calculating new node positions; setting these positions and performing animations/ modifying viewport/ changing zoom/ etc. are handled by `layoutPositions()`, which is called by each layout at the end of its `run()` method.

The `options` object is passed to `layoutPositions()` when called by a layout extension and consists of many of the common properties shared between layouts.

```js
var options = {
  animate: false, // whether to animate changes to the layout
  animationDuration: 500, // duration of animation in ms, if enabled
  animationEasing: undefined, // easing of animation, if enabled
  animateFilter: function ( node, i ){ return true; }, // a function that determines whether the node should be animated.
  //All nodes animated by default on animate enabled.  Non-animated nodes are positioned immediately when the layout starts
  eles: someCollection, // collection of elements involved in the layout; set by cy.layout() or eles.layout()
  fit: true, // whether to fit the viewport to the graph
  padding: 30, // padding to leave between graph and viewport
  pan: undefined, // pan the graph to the provided position, given as { x, y }
  ready: undefined, // callback for the layoutready event
  stop: undefined, // callback for the layoutstop event
  spacingFactor: 1, // a positive value which adjusts spacing between nodes (>1 means greater than usual spacing)
  transform: function (node, position ){ return position; } // transform a given node position. Useful for changing flow direction in discrete layouts 
  zoom: undefined // zoom level as a positive number to set after animation
}
```

Note that if `fit` is true, it will override any values provided in `pan` or `zoom`.
