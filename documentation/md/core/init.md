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

Note that in order to guarantee custom font usage, the fonts in question must be loaded before Cytoscape is initialised.

The following sections go over the options in more detail.


### Initialisation options

An instance of Cytoscape.js has a number of options that can be set on initialisation.  They are outlined below with their default values.

<span class="important-indicator"></span> Note that everything is optional.  By default, you get an empty graph with the default stylesheet.  Environments outside the browser (e.g. Node.js) are automatically set as headless for convenience.

<pre><code>var cy = cytoscape({
  // very commonly used options
  <a href="#init-opts/container">container</a>: undefined,
  <a href="#init-opts/elements">elements</a>: [ /* ... */ ],
  <a href="#init-opts/style">style</a>: [ /* ... */ ],
  <a href="#init-opts/layout">layout</a>: { name: 'grid' /* , ... */ },

  // initial viewport state:
  <a href="#init-opts/zoom">zoom</a>: 1,
  <a href="#init-opts/pan">pan</a>: { x: 0, y: 0 },

  // interaction options:
  <a href="#init-opts/minZoom">minZoom</a>: 1e-50,
  <a href="#init-opts/maxZoom">maxZoom</a>: 1e50,
  <a href="#init-opts/zoomingEnabled">zoomingEnabled</a>: true,
  <a href="#init-opts/userZoomingEnabled">userZoomingEnabled</a>: true,
  <a href="#init-opts/panningEnabled">panningEnabled</a>: true,
  <a href="#init-opts/userPanningEnabled">userPanningEnabled</a>: true,
  <a href="#init-opts/boxSelectionEnabled">boxSelectionEnabled</a>: false,
  <a href="#init-opts/selectionType">selectionType</a>: 'single',
  <a href="#init-opts/touchTapThreshold">touchTapThreshold</a>: 8,
  <a href="#init-opts/desktopTapThreshold">desktopTapThreshold</a>: 4,
  <a href="#init-opts/autolock">autolock</a>: false,
  <a href="#init-opts/autoungrabify">autoungrabify</a>: false,
  <a href="#init-opts/autounselectify">autounselectify</a>: false,

  // rendering options:
  <a href="#init-opts/headless">headless</a>: false,
  <a href="#init-opts/styleEnabled">styleEnabled</a>: true,
  <a href="#init-opts/hideEdgesOnViewport">hideEdgesOnViewport</a>: false,
  <a href="#init-opts/hideLabelsOnViewport">hideLabelsOnViewport</a>: false,
  <a href="#init-opts/textureOnViewport">textureOnViewport</a>: false,
  <a href="#init-opts/motionBlur">motionBlur</a>: false,
  <a href="#init-opts/motionBlurOpacity">motionBlurOpacity</a>: 0.2,
  <a href="#init-opts/wheelSensitivity">wheelSensitivity</a></a>: 1,
  <a href="#init-opts/pixelRatio">pixelRatio</a></a>: 'auto'
});
</code></pre>

### Very commonly used options

<span id="init-opts/container"></span>
**`container`** : A HTML DOM element in which the graph should be rendered.  This is unspecified if Cytoscape.js is run headlessly.  The container is expected to be an empty div; the visualisation owns the div.

<span id="init-opts/elements"></span>
**`elements`** : An array of [elements specified as plain objects](#notation/elements-json).  For convenience, this option can alternatively be specified as a promise that resolves to the elements JSON.

<span id="init-opts/style"></span>
**`style`** : The [stylesheet](#style) used to style the graph.  For convenience, this option can alternatively be specified as a promise that resolves to the stylesheet.

<span id="init-opts/layout"></span>
**`layout`** : A plain object that specifies layout options.  Which layout is initially run is specified by the `name` field.  Refer to a [layout's documentation](#layouts) for the options it supports.  If you want to specify your node positions yourself in your elements JSON, you can use the `preset` layout --- by default it does not set any positions, leaving your nodes in their current positions (e.g. specified in `options.elements` at initialisation time).


### Initial viewport state

<span id="init-opts/zoom"></span>
**`zoom`** : The initial zoom level of the graph.  Make sure to disable viewport manipulation options, such as `fit`, in your layout so that it is not overridden when the layout is applied.  You can set **`options.minZoom`** and **`options.maxZoom`** to set restrictions on the zoom level.

<span id="init-opts/pan"></span>
**`pan`** : The initial panning position of the graph.  Make sure to disable viewport manipulation options, such as `fit`, in your layout so that it is not overridden when the layout is applied.


### Interaction options

<span id="init-opts/minZoom"></span>
**`minZoom`** : A minimum bound on the zoom level of the graph.  The viewport can not be scaled smaller than this zoom level.

<span id="init-opts/maxZoom"></span>
**`maxZoom`** : A maximum bound on the zoom level of the graph.  The viewport can not be scaled larger than this zoom level.

<span id="init-opts/zoomingEnabled"></span>
**`zoomingEnabled`** : Whether zooming the graph is enabled, both by user events and programmatically.

<span id="init-opts/userZoomingEnabled"></span>
**`userZoomingEnabled`** : Whether user events (e.g. mouse wheel, pinch-to-zoom) are allowed to zoom the graph.  Programmatic changes to zoom are unaffected by this option.

<span id="init-opts/panningEnabled"></span>
**`panningEnabled`** : Whether panning the graph is enabled, both by user events and programmatically.

<span id="init-opts/userPanningEnabled"></span>
**`userPanningEnabled`** : Whether user events (e.g. dragging the graph background) are allowed to pan the graph.  Programmatic changes to pan are unaffected by this option.

<span id="init-opts/boxSelectionEnabled"></span>
**`boxSelectionEnabled`** : Whether box selection (i.e. drag a box overlay around, and release it to select) is enabled.  If enabled, the user must taphold to pan the graph.

<span id="init-opts/selectionType"></span>
**`selectionType`** : A string indicating the selection behaviour from user input.  For `'additive'`, a new selection made by the user adds to the set of currently selected elements.  For `'single'`, a new selection made by the user becomes the entire set of currently selected elements (i.e. the previous elements are unselected).

<span id="init-opts/touchTapThreshold"></span>
<span id="init-opts/desktopTapThreshold"></span>
**`touchTapThreshold`** & **`desktopTapThreshold`** : A nonnegative integer that indicates the maximum allowable distance that a user may move during a tap gesture, on touch devices and desktop devices respectively.  This makes tapping easier for users.  These values have sane defaults, so it is not advised to change these options unless you have very good reason for doing so.  Larger values will almost certainly have undesirable consequences.

<span id="init-opts/autoungrabify"></span>
**`autoungrabify`** : Whether nodes should be ungrabified (not grabbable by user) by default (if `true`, overrides individual node state).

<span id="init-opts/autolock"></span>
**`autolock`** : Whether nodes should be locked (not draggable at all) by default (if `true`, overrides individual node state).

<span id="init-opts/autounselectify"></span>
**`autounselectify`** : Whether nodes should be unselectified (immutable selection state) by default (if `true`, overrides individual element state).


### Rendering options

<span id="init-opts/headless"></span>
**`headless`** : A convenience option that initialises the instance to run headlessly.  You do not need to set this in environments that are implicitly headless (e.g. Node.js).  However, it is handy to set `headless: true` if you want a headless instance in a browser.

<span id="init-opts/styleEnabled"></span>
**`styleEnabled`** : A boolean that indicates whether styling should be used.  For headless (i.e. outside the browser) environments, display is not necessary and so neither is styling necessary --- thereby speeding up your code.  You can manually enable styling in headless environments if you require it for a special case.  Note that it does not make sense to disable style if you plan on rendering the graph.

<span id="init-opts/hideEdgesOnViewport"></span>
**`hideEdgesOnViewport`** : A rendering hint that when set to `true` makes the renderer not render edges while the viewport is being manipulated.  This makes panning, zooming, dragging, et cetera more responsive for large graphs.  This option is now largely moot, as a result of performance enhancements.

<span id="init-opts/textureOnViewport"></span>
**`textureOnViewport`** : A rendering hint that when set to `true` makes the renderer use a texture  during panning and zooming instead of drawing the elements, making large graphs more responsive.  This option is now largely moot, as a result of performance enhancements.

<span id="init-opts/motionBlur"></span>
**`motionBlur`** : A rendering hint that when set to `true` makes the renderer use a motion blur effect to make the transition between frames seem smoother.  This can increase the perceived performance for a large graphs.  This option is now largely moot, as a result of performance enhancements.

<span id="init-opts/motionBlurOpacity"></span>
**`motionBlurOpacity`** : When `motionBlur: true`, this value controls the opacity of motion blur frames.  Higher values make the motion blur effect more pronounced.  This option is now largely moot, as a result of performance enhancements.

<span id="init-opts/wheelSensitivity"></span>
**`wheelSensitivity`** : Changes the scroll wheel sensitivity when zooming.  This is a multiplicative modifier.  So, a value between 0 and 1 reduces the sensitivity (zooms slower), and a value greater than 1 increases the sensitivity (zooms faster).  This option is set to a sane value that works well for mainstream mice (Apple, Logitech, Microsoft) on Linux, Mac, and Windows.  If the default value seems too fast or too slow on your particular system, you may have non-default mouse settings in your OS or a niche mouse.  You should not change this value unless your app is meant to work only on specific hardware.  Otherwise, you risk making zooming too slow or too fast for most users.

<span id="init-opts/pixelRatio"></span>
**`pixelRatio`** : Overrides the screen pixel ratio with a manually set value (`1.0` recommended, if set).  This can be used to increase performance on high density displays by reducing the effective area that needs to be rendered, though this is much less necessary on more recent browser releases.  If you want to use the hardware's actual pixel ratio, you can set `pixelRatio: 'auto'` (default).
