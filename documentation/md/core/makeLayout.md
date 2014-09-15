You must specify `options.name` with the name of the layout you wish to use.

This function creates and returns a [layout object](#layouts).  You may want to keep a reference to the layout for more advanced usecases, such as running multiple layouts simultaneously. 

<span class="important-indicator"></span> Note that you must call `.run()` on a layout in order for it to affect the graph.

## Examples

```js
var layout = cy.makeLayout({
  name: 'random'
});

layout.run();
```