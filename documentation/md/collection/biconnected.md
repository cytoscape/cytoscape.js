## Details

Note that this function searches for biconnected components only within the subset of the graph in the calling collection.

This function returns an object of the following form:

```js
{
  cutVertices, /* Collection of nodes identified as cut vertices */
  components /* An array, whose members are collections of edges corresponding to each biconnected component */
}
```

## Examples

```js
var biconnected = cy.elements().biconnected();

biconnected.components[0].select();
```
