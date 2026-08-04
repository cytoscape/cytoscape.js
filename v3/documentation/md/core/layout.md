You must specify `options.name` with the name of the layout you wish to use.

This function creates and returns a [layout object](#layouts).  You may want to keep a reference to the layout for more advanced usecases, such as running multiple layouts simultaneously.

<span class="important-indicator"></span> Note that you must call [`layout.run()`](#layouts/layout-manipulation/layout.run) in order for it to affect the graph.

The layout includes all elements in the graph at the moment `cy.layout()` is called, as `cy.layout()` is equivalent to `cy.elements().layout()`.  You can use [`eles.layout()`](#collection/layout/eles.layout) to run a layout on a subset of the elements in the graph.


## Examples

```js
var layout = cy.layout({
  name: 'random'
});

layout.run();
```
