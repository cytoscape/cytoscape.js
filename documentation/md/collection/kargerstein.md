## Details


This function returns an object of the following form:

```js
{
  cut, /* Collection of edges that are in the cut */
  partition1, /* Collection of nodes that are in the first partition */
  partition2 /* Collection of nodes that are in the second partition */
}
```

## Examples

```js
var ks = cy.elements().kargerStein();

ks.cut.select();
```