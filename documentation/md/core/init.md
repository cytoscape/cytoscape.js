### Initialisation

A graph can be created as follows:

```
var cy = cytoscape({ /* options */ });
```

You can initialise the core without any options.  If you want to use Cytoscape as a visualisation, then a `container` DOM element is required, e.g.:

```js
var cy = cytoscape({
  container: document.getElementById('cy')
});
```

The following sections go over the options in more detail.


### Initialisation options

An instance of Cytoscape.js has a number of options that can be set on initialisation.  They are outlined below with their default values.

<span class="important-indicator"></span> Note that everything is optional.  By default, you get an empty graph with the default stylesheet.  Environments outside the browser (e.g. Node.js) are automatically set as headless for convenience.

```
var cy = cytoscape({
  // very commonly used options:
  container: undefined,
  elements: [ /* ... */ ],
  style: [ /* ... */ ],
  layout: { name: 'grid' /* , ... */ },

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
  selectionType: 'single',
  touchTapThreshold: 8,
  desktopTapThreshold: 4,
  autolock: false,
  autoungrabify: false,
  autounselectify: false,

  // rendering options:
  headless: false,
  styleEnabled: true,
  zorderStrict: false,
  hideEdgesOnViewport: false,
  hideLabelsOnViewport: false,
  textureOnViewport: false,
  motionBlur: false,
  motionBlurOpacity: 0.2,
  wheelSensitivity: 1,
  pixelRatio: 'auto',
  renderer: { /* ... */ }
});
```


### Very commonly used options

**`container`** : A HTML DOM element in which the graph should be rendered.  This is optional if Cytoscape.js is run headlessly or if you initialise using jQuery (in which case your jQuery object already has an associated DOM element).

**`elements`** : An array of [elements specified as plain objects](#notation/elements-json).  For convenience, this option can alternatively be specified as a promise that resolves to the elements JSON.

**`style`** : The [stylesheet](#style) used to style the graph.  For convenience, this option can alternatively be specified as a promise that resolves to the stylesheet.

**`layout`** : A plain object that specifies layout options.  Which layout is initially run is specified by the `name` field.  Refer to a [layout's documentation](#layouts) for the options it supports.  If you want to specify your node positions yourself in your elements JSON, you can use the `preset` layout &mdash; by default it does not set any positions, leaving your nodes in their current positions (e.g. specified in `options.elements` at initialisation time).


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

**`selectionType`** : A string indicating the selection behaviour from user input.  For `'additive'`, a new selection made by the user adds to the set of currently selected elements.  For `'single'`, a new selection made by the user becomes the entire set of currently selected elements (i.e. the previous elements are unselected).

**`touchTapThreshold`** & **`desktopTapThreshold`** : A nonnegative integer that indicates the maximum allowable distance that a user may move during a tap gesture, on touch devices and desktop devices respectively.  This makes tapping easier for users.  These values have sane defaults, so it is not advised to change these options unless you have very good reason for doing so.  Larger values will almost certainly have undesirable consequences.

**`autoungrabify`** : Whether nodes should be ungrabified (not grabbable by user) by default (if `true`, overrides individual node state).

**`autolock`** : Whether nodes should be locked (not draggable at all) by default (if `true`, overrides individual node state).

**`autounselectify`** : Whether nodes should be unselectified (immutable selection state) by default (if `true`, overrides individual element state).


### Rendering options

**`headless`** : A convenience option that initialises the instance to run headlessly.  You do not need to set this in environments that are implicitly headless (e.g. Node.js).  However, it is handy to set `headless: true` if you want a headless instance in a browser.

**`styleEnabled`** : A boolean that indicates whether styling should be used.  For headless (i.e. outside the browser) environments, display is not necessary and so neither is styling necessary &mdash; thereby speeding up your code.  You can manually enable styling in headless environments if you require it for a special case.  Note that it does not make sense to disable style if you plan on rendering the graph.

**`zorderStrict`** : A boolean that indicates whether default (false) or strict (true) ordering should be used.  Strict ordering uses the z-index value to determine drawing order for nodes and edges.  Non-strict default mode always ensures nodes are drawn atop edges independent of their respective z-index values.

**`hideEdgesOnViewport`** : When set to `true`, the renderer does not render edges while the viewport is being manipulated.  This makes panning, zooming, dragging, et cetera more responsive for large graphs.

**`hideLabelsOnViewport`** : When set to `true`, the renderer does not render labels while the viewport is being manipulated.  This makes panning, zooming, dragging, et cetera more responsive for large graphs.

**`textureOnViewport`** : When set to `true`, the renderer uses a texture (if supported) during panning and zooming instead of drawing the elements, making large graphs more responsive.

**`motionBlur`** : When set to `true`, the renderer will use a motion blur effect to make the transition between frames seem smoother.  This can significantly increase the perceived performance for a large graphs.

**`motionBlurOpacity`** : When `motionBlur: true`, this value controls the opacity of motion blur frames.  Higher values make the motion blur effect more pronounced.

**`wheelSensitivity`** : Changes the scroll wheel sensitivity when zooming.  This is a multiplicative modifier.  So, a value between 0 and 1 reduces the sensitivity (zooms slower), and a value greater than 1 increases the sensitivity (zooms faster).

**`pixelRatio`** : Overrides the screen pixel ratio with a manually set value (`1.0` recommended, if set).  This can be used to increase performance on high density displays by reducing the effective area that needs to be rendered, though this is much less necessary on more recent browser releases.  If you want to use the hardware's actual pixel ratio, you can set `pixelRatio: 'auto'` (default).

**`renderer`** : A plain object containing options for the renderer to be used.  The `options.renderer.name` field specifies which renderer is used.  You need not specify anything for the `renderer` option, unless you want to specify one of the rendering options below:

* **`renderer.name`** : The name of the renderer to use.  By default, the `'canvas'` renderer is used.  If you [build and register](#extensions) your own renderer, then you can specify its name here.
