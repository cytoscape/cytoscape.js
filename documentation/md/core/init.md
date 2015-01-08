### Script includes

To use Cytoscape.js in your HTML document:

```html
<script src="cytoscape.js"></script>
```

<span class="important-indicator"></span> Note that Cytoscape.js uses the dimensions of your HTML DOM element container for layouts and rendering at initialisation.  Thus, it is very important to place your CSS stylesheets in the `<head>` before any Cytoscape.js-related code.  Otherwise, dimensions may be sporadically reported incorrectly, resulting in undesired behaviour.

<span class="important-indicator"></span> Also note that you should call [`cy.resize()`](#core/viewport-manipulation/cy.resize) when your code resizes the viewport.

To install Cytoscape.js via npm:

```bash
npm install cytoscape
```

To use Cytoscape.js in a CommonJS environment like Node.js:

```
var cytoscape = require('cytoscape');
```

To use Cytoscape.js with AMD/Require.js:

```
require(['cytoscape'], function(cytoscape){
  // ...
});
```

To install Cytoscape.js via Bower (in the terminal):

```bash
bower install cytoscape
```

### Getting started

An instance of Cytoscape.js correponds to a graph.  You can create an instance as follows:

```js
var cy = cytoscape({
  container: document.getElementById('cy'),
  ready: function(){ console.log('ready') }
});
```

If you are running Cytoscape.js in Node.js or otherwise running it headlessly, you will not specify the `container` option.  When running Cytoscape.js headlessly in the browser, you should specify `options.renderer.name` as `'null'` so that the default canvas renderer is not used to draw the graph.  Outside of the browser (e.g. in Node.js) or if the convenience option `options.headless` is `true`, the null renderer is used by default.

You can alternatively initialise Cytoscape.js on a HTML DOM element using jQuery: 

```js
$('#cy').cytoscape({ // for some div with id 'cy'
  ready: function(){
    // you can access the core object API through cy

    console.log('ready');
  }

  // , ...
});
```

This initialises Cytoscape.js and returns back to you your instance of jQuery.  You can continue using jQuery functions, as usual for a jQuery plugin.

For example, 

```js
$('#cy').cytoscape(options)
  .css('background', 'red')
  .css('border-color', 'black'); // can use jquery functions on 'cy' div 
```

Because this style doesn't give you access to the `cy` object outside of the callback function, there is an option to get the `cy` object from a jQuery selector.

```js
$('#cy').cytoscape(options);
var cy = $('#cy').cytoscape('get'); // now we have a global reference to `cy`
```





### The ready callback

<span class="important-indicator"></span> Part of initialising Cytoscape.js is synchronous and part may be asynchronous.  The potentially asynchronous part is the initial layout, which may be used for setting the initial positions of nodes.  If you use an asynchronous (a.k.a. continuous) layout at initialisation, you may want to use `ready`.  You can guarantee that the initial layout takes no time if you specify all node positions manually in the [elements JSON](#notation/elements-json) and use the `preset` layout &mdash; which does nothing by default.




### Initialisation options

An instance of Cytoscape.js has a number of options that can be set on initialisation.  They are outlined below with their default values.

<span class="important-indicator"></span> Note that everything is optional.  By default, you get an empty graph with the default stylesheet.  Environments outside the browser (e.g. Node.js) are automatically set as headless for convenience.

```js
var cy = cytoscape({
  // very commonly used options:
  container: undefined, 
  elements: [ /* ... */ ],
  style: [ /* ... */ ],
  layout: { name: 'grid' /* , ... */ },
  ready: function(evt){ /* ... */ },

  // initial viewport state:
  zoom: 1,
  pan: { x: 0, y: 0 },
  
  // interaction options:
  minZoom: 1e-50,
  maxZoom: 1e50,
  zoomingEnabled: true,
  userZoomingEnabled: true,
  panningEnabled: true,
  userPanningEnabled: true,
  boxSelectionEnabled: false,
  selectionType: (isTouchDevice ? 'additive' : 'single'),
  touchTapThreshold: 8,
  desktopTapThreshold: 4,
  autolock: false,
  autoungrabify: false,
  autounselectify: false,

  // rendering options:
  headless: false,
  styleEnabled: true,
  hideEdgesOnViewport: false,
  hideLabelsOnViewport: false,
  textureOnViewport: false,
  motionBlur: false,
  wheelSensitivity: 1,
  pixelRatio: 1,
  initrender: function(evt){ /* ... */ },
  renderer: { /* ... */ }
});
```


### Very commonly used options

**`container`** : A HTML DOM element in which the graph should be rendered.  This is optional if Cytoscape.js is run headlessly or if you initialise using jQuery (in which case your jQuery object already has an associated DOM element).

**`elements`** : An array of [elements specified as plain objects](#notation/elements-json).  For convenience, this option can alternatively be specified as a promise that resolves to the elements JSON.

**`style`** : The [stylesheet](#style) used to style the graph.  For convenience, this option can alternatively be specified as a promise that resolves to the stylesheet.

**`layout`** : A plain object that specifies layout options.  Which layout is initially run is specified by the `name` field.  Refer to a [layout's documentation](#layouts) for the options it supports.  If you want to specify your node positions yourself in your elements JSON, you can use the `preset` layout &mdash; by default it does not set any positions, leaving your nodes in their current positions (e.g. specified in `options.elements` at initialisation time).

**`ready`** : A callback function that is called when Cytoscape.js has loaded the graph and the layout has specified initial positions of the nodes.  After this point, rendering can happen, the user can interact with the graph, et cetera.


### Initial viewport state

**`zoom`** : The initial zoom level of the graph.  Make sure to disable viewport manipulation options, such as `fit`, in your layout so that it is not overridden when the layout is applied.  You can set **`options.minZoom`** and **`options.maxZoom`** to set restrictions on the zoom level.

**`pan`** : The initial panning position of the graph.  Make sure to disable viewport manipulation options, such as `fit`, in your layout so that it is not overridden when the layout is applied.


### Interaction options

**`minZoom`** : A minimum bound on the zoom level of the graph.  The viewport can not be scaled smaller than this zoom level.

**`maxZoom`** : A maximum bound on the zoom level of the graph.  The viewport can not be scaled larger than this zoom level.

**`zoomingEnabled`** : Whether zooming the graph is enabled, both by user events and programmatically.

**`userZoomingEnabled`** : Whether user events (e.g. mouse wheel, pinch-to-zoom) are allowed to zoom the graph.  Programmatic changes to zoom are unaffected by this option. 

**`panningEnabled`** : Whether panning the graph is enabled, both by user events and programmatically.

**`userPanningEnabled`** : Whether user events (e.g. dragging the graph background) are allowed to pan the graph.  Programmatic changes to pan are unaffected by this option.

**`boxSelectionEnabled`** : Whether box selection (i.e. drag a box overlay around, and release it to select) is enabled.  If enabled, the user must taphold to pan the graph.

**`selectionType`** : A string indicating the selection behaviour from user input.  By default, this is set automatically for you based on the type of input device detected.  On touch devices, `'additive'` is default &mdash; a new selection made by the user adds to the set of currenly selected elements.  On mouse-input devices, `'single'` is default &mdash; a new selection made by the user becomes the entire set of currently selected elements (i.e. the previous elements are unselected).

**`touchTapThreshold`** & **`desktopTapThreshold`** : A nonnegative integer that indicates the maximum allowable distance that a user may move during a tap gesture, on touch devices and desktop devices respectively.  This makes tapping easier for users.  These values have sane defaults, so it is not advised to change these options unless you have very good reason for doing so.  Larger values will almost certainly have undesirable consequences.

**`autoungrabify`** : Whether nodes should be ungrabified (not grabbable by user) by default (if `true`, overrides individual node state).

**`autolock`** : Whether nodes should be locked (not draggable at all) by default (if `true`, overrides individual node state).

**`autounselectify`** : Whether nodes should be unselectified (immutable selection state) by default (if `true`, overrides individual element state).


### Rendering options

**`headless`** : A convenience option that initialises the instance to run headlessly.  You do not need to set this in environments that are implicitly headless (e.g. Node.js).  However, it is handy to set `headless: true` if you want a headless instance in a browser.

**`styleEnabled`** : A boolean that indicates whether styling should be used.  For headless (i.e. outside the browser) environments, display is not necessary and so neither is styling necessary &mdash; thereby speeding up your code.  You can manually enable styling in headless environments if you require it for a special case.  Note that it does not make sense to disable style if you plan on rendering the graph.

**`hideEdgesOnViewport`** : When set to `true`, the renderer does not render edges while the viewport is being manipulated.  This makes panning, zooming, dragging, et cetera more responsive for large graphs.

**`hideLabelsOnViewport`** : When set to `true`, the renderer does not render labels while the viewport is being manipulated.  This makes panning, zooming, dragging, et cetera more responsive for large graphs.

**`textureOnViewport`** : When set to `true`, the renderer uses a texture (if supported) during panning and zooming instead of drawing the elements, making large graphs more responsive.

**`motionBlur`** : When set to `true`, the renderer will use a motion blur effect to make the transition between frames seem smoother.  This can significantly increase the perceived performance for a large graphs.

**`wheelSensitivity`** : Changes the scroll wheel sensitivity when zooming.  This is a multiplicative modifier.  So, a value between 0 and 1 reduces the sensitivity (zooms slower), and a value greater than 1 increases the sensitivity (zooms faster).

**`pixelRatio`** : Overrides the screen pixel ratio with a manually set value (`1.0` or `0.666` recommended, if set).  This can be used to increase performance on high density displays by reducing the effective area that needs to be rendered.  If you want to use the hardware's actual pixel ratio at the expense of performance, you can set `pixelRatio: 'auto'`.

**`initrender`** : A callback function that is called when Cytoscape.js has rendered its first frame.  This is useful for grabbing screenshots etc after initialision, but in general you should use `ready` instead.

**`renderer`** : A plain object containing options for the renderer to be used.  The `options.renderer.name` field specifies which renderer is used.  You need not specify anything for the `renderer` option, unless you want to specify one of the rendering options below:

* **`renderer.name`** : The name of the renderer to use.  By default, the `'canvas'` renderer is used.  If you [build and register](#extensions) your own renderer, then you can specify its name here.

