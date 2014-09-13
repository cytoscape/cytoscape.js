## Details


This function returns an object of the following form:

```
{
  cut, /* List of edge ids that are in the cut*/
  partition1, /* List of node ids that are in one partition */
  partition2 /* List of node ids that are in the other partition*/
}
```

the function does not require any arguments.

## Examples

```js
var res = cy.elements().kargerStein();
```