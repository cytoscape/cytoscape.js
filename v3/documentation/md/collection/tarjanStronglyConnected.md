## Details

Note that this function identifies strongly connected components only within the subset of the graph in the calling collection.

This function returns an object of the following form:

```js
{
  cut, /* Collection of edges which adjoin pairs of strongly connected components */
  components /* Array of collections corresponding to each strongly connected component */
}
```

## Examples

```js
var tsc = cy.elements().tarjanStronglyConnected();

tsc.components[0].select();
```
