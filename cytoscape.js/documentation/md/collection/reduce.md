## Examples

Join the node IDs into a comma-separated string:

```js
var initialValue = null;
var fn = function( prevVal, ele, i, eles ){
  if( prevVal ){
    return prevVal + ',' + ele.id();
  } else {
    return ele.id();
  }
};
var ids = cy.nodes().reduce( fn, initialValue );

console.log( ids );
```
