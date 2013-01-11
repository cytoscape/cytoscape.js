## API

The extensions API is very simple, following this format:

```js
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
cytoscape('collection', 'forEach', function( fn ){
  for( var i = 0; i < this.length; i++ ){
    fn.apply( this[i], [ i, this[i] ] );
  }

  return this; // chainability
});
```


## Layouts

For an example layout, please refer to the [null layout source code](https://github.com/cytoscape/cytoscape.js/blob/master/src/extensions/cytoscape.layout.null.js).  The layout just sets each node to position (0, 0), and it is well documented.
 

## Renderers

For an example renderer, please refer to the [canvas renderer](https://github.com/cytoscape/cytoscape.js/blob/master/src/extensions/cytoscape.renderer.canvas.js).  If you're interested in writing a custom renderer for Cytoscape.js, please [send an email to Max](mailto:maxkfranz@gmail.com).