## Details

For layouts included with Cytoscape.js, you can find their options documented in the [Layouts section](#layouts).  For external layouts, please refer to their accompanying documentation.

You must specify `options.name` with the name of the layout you wish to use.

This function creates and returns a layout object.  You may want to keep a reference to the layout for more advanced usecases, such as running multiple layouts simultaneously. 

<span class="important-indicator"></span> Note that you must call `.run()` on a layout in order for it to affect the graph.



## Examples

Run the grid layout:

```js
cy.layout({ name: 'grid' }).run();
```