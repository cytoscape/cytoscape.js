## Details

Note that this function identifies biconnected components and cut vertices only within the subset of the graph in the calling collection.

This function returns an object of the following form:

```js
{
  cut, /* Collection of nodes identified as cut vertices */
  components /* An array of collections corresponding to each biconnected component */
}
```

## Examples

```js
var ht = cy.elements().hopcroftTarjan();

ht.components[0].select();
```
