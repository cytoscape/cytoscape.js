The above extensions are a curated list.  To add your extension, please submit a pull request that adds your extension to [the documentation configuration JSON file](https://github.com/cytoscape/cytoscape.js/blob/master/documentation/docmaker.json).  Once pulled in, your extension will be listed with the next publish of the documentation.

## API

The API makes it very easy to write an extension, following this format:

```
cytoscape( type, name, extension );
```

The value of `type` can take on the following values:

 * `core` : The extension adds a core function.
 * `collection` : The extension adds a collection function.
 * `layout` : The extension registers a layout prototype.
 * `renderer` : The extension registers a renderer prototype.

The `name` argument indicates the name of the extension, which should be a single word in lower case.



## Functions

Functions should be chainable, unless they need to return some other value.  To make a function chainable, make sure to `return this;` at the end of your function.

Here is an example collection function:

```js
cytoscape('collection', 'foo', function( fn ){
  for( var i = 0; i < this.length; i++ ){
    this[i].data('foo', 'bar');
  }

  return this; // chainability
});

cy.elements().foo();
```



## Layouts

A layout modifies the positions of nodes in the graph.  A layout has number of options, which are specific to the particular layout.

Layouts may be blocking if they are fast &mdash; meaning you can execute your code to run after the layout on the line following the layout call.  Layouts may also be continuous, in which case, callback functions are provided to know when the layout finishes.

A layout has two events that must be triggereed on the core, including `layoutready` and `layoutstop`:

 * `layoutready` : This is triggered on the core (via `cy.trigger('layoutready')`) when the layout has set the positions on every node at least once.  This lets the core know that the nodes now have valid positions and can be rendered.  It is important to trigger `layoutready` on continuous layouts so that the nodes are shown moving.  For blocking (non-continous) layouts, `layoutready` can just be triggered after the layout is done but before `layoutstop`.

 * `layoutstop` : This is triggered on the core (via `cy.trigger('layoutstop')`) when the layout has finished.  It should be triggered after `layoutready`.  The layout should not change node positions after triggering `layoutstop`.

For an example layout, please refer to the [null layout source code](https://github.com/cytoscape/cytoscape.js/blob/master/src/extensions/layout.null.js).  The layout just sets each node to position (0, 0), and it is well documented.  The [Arbor layout](https://github.com/cytoscape/cytoscape.js/blob/master/src/extensions/layout.arbor.js) is a good example of a continuous layout.
 


## Renderers

For an example renderer, please refer to the [canvas renderer](https://github.com/cytoscape/cytoscape.js/tree/master/src/extensions).

The API of the renderer follows the actor model, and so it has a single main entry point, the `notify()` function.  The core uses the `notify()` function to send event objects to the renderer.  The format of the event object is as follows:

 * `event.type` : A string containing the name of the event that has occured.
 * `event.collection` : A collection of elements associated with the event.

If you're interested in writing a custom renderer for Cytoscape.js, please [file an issue](https://github.com/cytoscape/cytoscape.js/issues) for more help if needed.