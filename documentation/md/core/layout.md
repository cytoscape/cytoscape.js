## Options for included layouts

Several layouts are included with Cytoscape.js by default, and their options are described here with the default values specified.  Note that you must set `options.name` to the name of the layout to specify which one you want to run.

*The `random` layout:*
```js
options = {
	name: 'random',
	ready: undefined, // callback on layoutready
	stop: undefined, // callback on layoutstop
	fit: true // whether to fit to viewport
};

cy.layout( options );
```

*The `preset` layout puts nodes in the positions you specify manually:*
```js
options = {
	name: 'preset',
	fit: true, // whether to fit to viewport
	ready: undefined, // callback on layoutready
	stop: undefined, // callback on layoutstop
	positions: undefined, // map of (node id) => (position obj)
	zoom: undefined, // the zoom level to set (prob want fit = false if set)
	pan: undefined // the pan level to set (prob want fit = false if set)
};

cy.layout( options );
```

*The `grid` layout puts nodes in a well-spaced grid:*
```js
options = {
	name: 'grid',
	fit: true, // whether to fit the viewport to the graph
	rows: undefined, // force num of rows in the grid
	columns: undefined, // force num of cols in the grid
	ready: undefined, // callback on layoutready
	stop: undefined // callback on layoutstop
};

cy.layout( options );

```

*The `breadthfirst` layout puts nodes in a hierarchy:*
```js
options = {
    fit: true, // whether to fit the viewport to the graph
    ready: undefined, // callback on layoutready
    stop: undefined, // callback on layoutstop
    directed: true, // whether the tree is directed downwards (or edges can point in any direction if false)
    padding: 30, // padding on fit
    circle: false, // put depths in concentric circles if true, put depths top down if false
    roots: undefined, // the roots of the trees
    maximalAdjustments: 0 // how many times to try to position the nodes in a maximal way (i.e. no backtracking)
};

cy.layout( options );
```

*The `circle` layout puts nodes in a circle:*
```js
options = {
	name: 'circle',
    fit: true, // whether to fit the viewport to the graph
    ready: undefined, // callback on layoutready
    stop: undefined, // callback on layoutstop
    rStepSize: 10, // the step size for increasing the radius if the nodes don't fit on screen
    padding: 30, // the padding on fit
    startAngle: 3/2 * Math.PI, // the position of the first node
    counterclockwise: false // whether the layout should go counterclockwise (true) or clockwise (false)
};

cy.layout( options );
```

*The `arbor` layout uses a force-directed simulation:*
```js
options = {
	liveUpdate: true, // whether to show the layout as it's running
	ready: undefined, // callback on layoutready 
	stop: undefined, // callback on layoutstop
	maxSimulationTime: 4000, // max length in ms to run the layout
	fit: true, // reset viewport to fit default simulationBounds
	padding: [ 50, 50, 50, 50 ], // top, right, bottom, left
	simulationBounds: undefined, // [x1, y1, x2, y2]; [0, 0, width, height] by default
	ungrabifyWhileSimulating: true, // so you can't drag nodes during layout

	// forces used by arbor (use arbor default on undefined)
	repulsion: undefined,
	stiffness: undefined,
	friction: undefined,
	gravity: true,
	fps: undefined,
	precision: undefined,

	// static numbers or functions that dynamically return what these
	// values should be for each element
	nodeMass: undefined, 
	edgeLength: undefined,

	stepSize: 1, // size of timestep in simulation

	// function that returns true if the system is stable to indicate
	// that the layout can be stopped
	stableEnergy: function( energy ){
		var e = energy; 
		return (e.max <= 0.5) || (e.mean <= 0.3);
	}
};


cy.layout( options );
```

Please note that the `liveUpdate` option is expensive, so if you are concerned about running time (e.g. for large graphs), you should set it to `false`.

NB: You must reference the version of `arbor.js` included with Cytoscape.js in the `<head>` of your HTML document:

```html
<head>
	...

	<script src="arbor.js"></script>

	...
</head>
```

Arbor does some automatic path finding because it uses web workers, and so it must be included this way.  Therefore, you can not combine `arbor.js` with your other JavaScript files &mdash; as you probably would as a part of the minification of the scripts in your webapp.

*The `null` layout puts all nodes at (0, 0):*
```js
// The null layout has no options.
```


*The `CoSE` (Compound Spring Embedder) layout uses a force-directed simulation to lay out compound graphs.*<br>
It was implemented by Gerardo Huck as part of Google Summer of Code 2013.<br>
Mentors: Max Franz, Christian Lopes, Anders Riutta, Ugur Dogrusoz.<br>
Based on the article "A layout algorithm for undirected compound graphs" by Ugur Dogrusoz, Erhan Giral, Ahmet Cetintas, Ali Civril and Emek Demir.<br>

```js
options = {
	// Number of iterations between consecutive screen positions update (0 -> only updated on the end)
	refresh             : 0,
	// Whether to fit the network view after when done
	fit                 : true, 
	// Whether to randomize node positions on the beginning
	randomize           : true,
	// Whether to use the JS console to print debug messages
	debug               : false,

	// Node repulsion (non overlapping) multiplier
	nodeRepulsion       : 10000,
	// Node repulsion (overlapping) multiplier
	nodeOverlap         : 10,
	// Ideal edge (non nested) length
	idealEdgeLength     : 10,
	// Divisor to compute edge forces
	edgeElasticity      : 100,
	// Nesting factor (multiplier) to compute ideal edge length for nested edges
	nestingFactor       : 5, 
	// Gravity force (constant)
	gravity             : 250, 
	
	// Maximum number of iterations to perform
	numIter             : 100,
	// Initial temperature (maximum node displacement)
	initialTemp         : 200,
	// Cooling factor (how the temperature is reduced between consecutive iterations)
	coolingFactor       : 0.95, 
	// Lower temperature threshold (below this point the layout will end)
	minTemp             : 1
};

cy.layout( options );
```

## Examples

```js
cy.layout({ name: 'grid' });
```