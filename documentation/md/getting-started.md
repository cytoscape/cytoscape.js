This section will familiarise you with the basic steps necessary to start using Cytoscape.js.



## Including Cytoscape.js

If you are using a HTML environment, then include Cytoscape.js in a `<script>` tag, e.g.:

```html
<script src="cytoscape.js"></script>
```

<span class="important-indicator"></span> Note that Cytoscape.js uses the dimensions of your HTML DOM element container for layouts and rendering at initialisation.  Thus, it is very important to place your CSS stylesheets in the `<head>` before any Cytoscape.js-related code.  Otherwise, dimensions may be sporadically reported incorrectly, resulting in undesired behaviour.

Your stylesheet may include something like this (assuming a DOM element with ID `cy` is used as the container):

```css
#cy {
  width: 300px;
  height: 300px;
  display: block;
}
```

<span class="important-indicator"></span> Also note that you should call [`cy.resize()`](#core/viewport-manipulation/cy.resize) when your code resizes the viewport.

To install Cytoscape.js via npm:

```bash
npm install cytoscape
```

To use Cytoscape.js in a CommonJS environment like Node.js:

```js
var cytoscape = require('cytoscape');
```

To use Cytoscape.js with AMD/Require.js:

```js
require(['cytoscape'], function(cytoscape){
  // ...
});
```

To install Cytoscape.js via Bower (in the terminal):

```bash
bower install cytoscape
```

To install Cytoscape.js via spm (in the terminal):

```bash
spm install cytoscape
```

To install Cytoscape.js via Meteor/Atmosphere (in the terminal):

```bash
meteor add cytoscape:cytoscape
```



## Initialisation

An instance of Cytoscape.js corresponds to a graph.  You can create an instance as follows:

```js
var cy = cytoscape({
  container: document.getElementById('cy') // container to render in
});
```

You can pass a jQuery instance as the `container` for convenience:

```js
var cy = cytoscape({
  container: $('#cy')
});
```

If you are running Cytoscape.js in Node.js or otherwise running it headlessly, you will not specify the `container` option.  When running Cytoscape.js headlessly in the browser, you should specify `options.renderer.name` as `'null'` so that the default canvas renderer is not used to draw the graph.  Outside of the browser (e.g. in Node.js) or if the convenience option `options.headless` is `true`, the null renderer is used by default.



## Specifying basic options

For visualisation, the `container`, [`elements`](#notation/elements-json), [`style`](#style), and [`layout`](#layouts) options usually should be set:

```js
var cy = cytoscape({

  container: document.getElementById('cy'), // container to render in

  elements: [ // list of graph elements to start with
    { // node a
      data: { id: 'a' }
    },
    { // node b
      data: { id: 'b' }
    },
    { // edge ab
      data: { id: 'ab', source: 'a', target: 'b' }
    }
  ],

  style: [ // the stylesheet for the graph
    {
      selector: 'node',
      style: {
        'background-color': '#666',
        'label': 'data(id)'
      }
    },

    {
      selector: 'edge',
      style: {
        'width': 3,
        'line-color': '#ccc',
        'target-arrow-color': '#ccc',
        'target-arrow-shape': 'triangle'
      }
    }
  ],

  layout: {
    name: 'grid',
    rows: 1
  }

});
```



## Next steps

Now that you have a core (graph) instance with basic options, explore the [core API](#core).  It's your entry point to all the features in Cytoscape.js.

If you have code questions about Cytoscape.js, please feel free to [post your question to Stackoverflow](http://stackoverflow.com/questions/ask?tags=cytoscape.js).
