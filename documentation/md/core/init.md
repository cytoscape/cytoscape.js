### Script includes

To use Cytoscape.js in your HTML document:

```html
<script src="cytoscape.js"></script>
```

To use Cytoscape.js in Node.js:

```
var cytoscape = require('cytoscape');
```

### Getting started

An instance of Cytoscape.js correeponds to a graph.  You can create an instance as follows:

```js
cytoscape({
  container: document.getElementById('cy'),
  ready: function(){ console.log('ready') }
});
```

If you are running Cytoscape.js in Node.js or otherwise running it headlessly, you will not specify the `container` option.

If you've included jQuery on a HTML document, you can alternatively initialise Cytoscape.js on a HTML DOM element using the traditional jQuery style: 

```js
$("#cy").cytoscape({ // for some div with id 'cy'
  ready: function(){
    // you can access the core object API through cy

    console.log("ready");
  }

  // , ...
});
```

This initialises Cytoscape.js and returns back to you your instance of jQuery.  You can continue using jQuery functions, as usual for a jQuery plugin.

For example, 

```js
$("#cy").cytoscape(options)
  .css("background", "red")
  .css("border-color", "black"); // can use jquery functions on 'cy' div 
```

Because this style doesn't give you access to the `cy` object outside of the callback function, there is an option to get the `cy` object from a jQuery selector.

```js
$("#cy").cytoscape(options);
var cy = $("#cy").cytoscape("get"); // now we have a global reference to `cy`
```





### The ready callback

All of your code that uses the core object API, i.e. through the `cy` object in the examples above, must do so after the `ready` callback function has executed.  You can specify the `ready` callback in the initialisation options, outlined in the following section.

Because the `ready` event may occur before you can bind to the core, you can use this shortcut to spread your code among several JavaScript files without having to call a bunch of global functions in `options.ready`.

**NB: You should never call layouts, load elements into the graph, etc on ready.  The graph is still performing the initial load at that point, so you can't modify things like that.  You should use the initialisation options to properly set the elements and layout you want to use.**

```js
// in foo.js
$(function(){ // on jquery ready

  $("#cy").cytoscape(function(eventObject){ // on Cytoscape.js ready on the `cy` div
    // this code executes when Cytoscape.js is ready even though we
    // don't actually initialise Cytoscape.js on the `cy` div until
    // bar.js is loaded

    var cy = this; // `this` holds the reference to the core object

    console.log("Ready, Freddie!");
  });

});

// in bar.js (should be after foo.js in your js includes)
$(function(){ // on jquery ready
  $("#cy").cytoscape(options);
});
```


### Initialisation options

An instance of Cytoscape.js has a number of options that can be set on initialisation.  They are outlined below.

```js
$("#cy").cytoscape({
  showOverlay: false,
  layout: { /* ... */ },
  zoom: 1,
  minZoom: 1e-50,
  maxZoom: 1e50,
  pan: { x: 0, y: 0 },
  renderer: { /* ... */ },
  style: undefined /* ... */,
  ready: function(evt){ /* ... */ },
  initrender: function(evt){ /* ... */ },
  elements: [ /* ... */ ]
});
```

**layout** : A plain object that specifies layout options.  Which layout is initially run is specified by the `name` field.  Refer to a layout's documentation for the options it supports.

**zoom** : The initial zoom level of the graph.  Make sure to disable viewport manipulation options, such as `fit`, in your layout so that it is not overridden when the layout is applied.  You can set **minZoom** and **maxZoom** to set restrictions on the zoom level.

**pan** : The initial panning position of the graph.  Make sure to disable viewport manipulation options, such as `fit`, in your layout so that it is not overridden when the layout is applied. 

**renderer** : A plain object containing options for the renderer to be used.  The `name` field specifies which renderer is used.  You need not specify anything for this option, unless you want to use a custom renderer.  

**style** : The stylesheet used to style the document.

For example:

```js
$("#cy").cytoscape({
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

**ready** : A callback function that is called when Cytoscape.js is ready to be interacted with.  You can not call functions on the `cy` object before this function executes.

**initrender** : A callback function that is called when Cytoscape.js has rendered its first frame.  This is useful for grabbing screenshots etc after initialision, but in general you should use `ready` instead.

**showOverlay** : A boolean, indacating whether you'd like to see the "cytoscape.js" overlay in the bottom right of the viewport (default `true`).

**elements** : An array of elements specified as plain objects.

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
