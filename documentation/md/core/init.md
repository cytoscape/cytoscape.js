### Script includes

To use Cytoscape.js in your HTML document:

```html
<script src="cytoscape.js"></script>
```

**Cytoscape.js uses the dimensions of your HTML DOM element container for layouts and rendering at initialisation.  Thus, it is very important to place your CSS stylesheets in the `<head>` before any Cytoscape.js scripts.  Otherwise, dimensions may be sporadically reported incorrectly, resulting in undesired behaviour.**

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
cytoscape({
  container: document.getElementById('cy'),
  ready: function(){ console.log('ready') }
});
```

If you are running Cytoscape.js in Node.js or otherwise running it headlessly, you will not specify the `container` option.  When running Cytoscape.js headlessly in the browser, you should specify `options.renderer.name` as `'null'` so that the default canvas renderer is not used to draw the graph.  Outside of the browser (e.g. in Node.js), the null renderer is used by default.

If you've included jQuery on a HTML document, you can alternatively initialise Cytoscape.js on a HTML DOM element using the traditional jQuery style: 

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

All of your code that uses the core object API, i.e. through the `cy` object in the examples above, must do so after the `ready` callback function has executed.  You can specify the `ready` callback in the initialisation options, outlined in the following section.

Because the `ready` event may occur before you can bind to the core, you can use this shortcut to spread your code among several JavaScript files without having to call a bunch of global functions in `options.ready`.

**NB: You should never call layouts, load elements into the graph, etc on ready.  The graph is still performing the initial load at that point, so you can't modify things like that.  You should use the initialisation options to properly set the elements and layout you want to use.**

```js
// in foo.js
$(function(){ // on jquery ready

  $('#cy').cytoscape(function(eventObject){ // on Cytoscape.js ready on the `cy` div
    // this code executes when Cytoscape.js is ready even though we
    // don't actually initialise Cytoscape.js on the `cy` div until
    // bar.js is loaded

    var cy = this; // `this` holds the reference to the core object

    console.log('Ready, Freddie!');
  });

});

// in bar.js (should be after foo.js in your js includes)
$(function(){ // on jquery ready
  $('#cy').cytoscape(options);
});
```


### Initialisation options

An instance of Cytoscape.js has a number of options that can be set on initialisation.  They are outlined below with their default values.

```js
$('#cy').cytoscape({
  selectionType: (isTouchDevice ? 'additive' : 'single'),
  layout: { name: 'grid' /* , ... */ },
  zoom: 1,
  minZoom: 1e-50,
  maxZoom: 1e50,
  zoomingEnabled: true,
  userZoomingEnabled: true,
  pan: { x: 0, y: 0 },
  panningEnabled: true,
  hideEdgesOnViewport: false,
  renderer: { /* ... */ },
  style: undefined /* ... */,
  ready: function(evt){ /* ... */ },
  initrender: function(evt){ /* ... */ },
  elements: [ /* ... */ ]
});
```

**`selectionType`** : A string indicating the selection behaviour from user input.  By default, this is set automatically for you based on the type of input device detected.  On touch devices, `'additive'` is default &mdash; a new selection made by the user adds to the set of currenly selected elements.  On mouse-input devices, `'single'` is default &mdash; a new selection made by the user becomes the entire set of currently selected elements (i.e. the previous elements are unselected).

**`layout`** : A plain object that specifies layout options.  Which layout is initially run is specified by the `name` field.  Refer to a layout's documentation for the options it supports, as described in [`cy.layout()`](#core/visuals/cy.layout).

**`zoom`** : The initial zoom level of the graph.  Make sure to disable viewport manipulation options, such as `fit`, in your layout so that it is not overridden when the layout is applied.  You can set **`options.minZoom`** and **`options.maxZoom`** to set restrictions on the zoom level.

**`zoomingEnabled`** : Whether zooming the graph is enabled, both by user events and programmatically.

**`userZoomingEnabled`** : Whether user events (e.g. mouse wheel, pinch-to-zoom) are allowed to zoom the graph.  Programmatic changes to zoom are unaffected by this option.

**`pan`** : The initial panning position of the graph.  Make sure to disable viewport manipulation options, such as `fit`, in your layout so that it is not overridden when the layout is applied. 

**`panningEnabled`** : Whether panning the graph is enabled, both by user events and programmatically.

**`userPanningEnabled`** : Whether user events (e.g. dragging the graph background) are allowed to pan the graph.  Programmatic changes to pan are unaffected by this option.

**`hideEdgesOnViewport`** : When set to `true`, the renderer does not render edges while the viewport is being manipulated.  This makes panning and zooming more responsive for large graphs.

**`renderer`** : A plain object containing options for the renderer to be used.  The `options.renderer.name` field specifies which renderer is used.  You need not specify anything for the `renderer` option, unless you want to specify one of the rendering options below:

* **`renderer.name`** : The name of the renderer to use.  By default, the `'canvas'` renderer is used.  If you [build and register](#extensions) your own renderer, then you can specify its name here.

**`style`** : The stylesheet used to style the document.

For example:

```js
$('#cy').cytoscape({
  /* ... */

  style: cytoscape.stylesheet()
    .selector('node')
      .css({
        'background-color': 'red',
        'border-color': '#ffff00'
      })
    .selector('edge')
      .css({
        'line-color': 'blue'
      })

  /* ... */
});
```

**`ready`** : A callback function that is called when Cytoscape.js is ready to be interacted with.  You can not call functions on the `cy` object before this function executes.

**`initrender`** : A callback function that is called when Cytoscape.js has rendered its first frame.  This is useful for grabbing screenshots etc after initialision, but in general you should use `ready` instead.

**`elements`** : An array of elements specified as plain objects.

For example:

```js
$('#cy').cytoscape({
  /* ... */

  elements: [
    {
      data: { id: 'foo' }, 
      group: 'nodes'
    },

    {
      data: { id: 'bar' },
      group: 'nodes'
    },

    {
      data: { weight: 100 }, // elided id => autogenerated id 
      group: 'nodes',
      position: {
        x: 100,
        y: 100
      },
      classes: 'className1 className2',
      selected: true,
      selectable: true,
      locked: true,
      grabbable: true
    },

    {
      data: { id: 'baz', source: 'foo', target: 'bar' },
      group: 'edges'
    }
  ]

  /* ... */
});
```

You can alternatively specify separate arrays indexed in a object by the group names so you don't have to specify the `group` property over and over for each element:

```js
$('#cy').cytoscape({
  /* ... */

  elements: {
    nodes: [
      { data: { id: 'foo' } }, // NB no group specified
      
      { data: { id: 'bar' } },
      
      {
        data: { weight: 100 }, // elided id => autogenerated id 
        group: 'nodes',
        position: {
          x: 100,
          y: 100
        },
        classes: 'className1 className2',
        selected: true,
        selectable: true,
        locked: true,
        grabbable: true
      }
    ],

    edges: [
      { data: { id: 'baz', source: 'foo', target: 'bar' } } // NB no group specified
    ]
  }

  /* ... */
});
```
