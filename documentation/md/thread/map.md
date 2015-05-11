## Examples

```js
var t = cytoscape.Thread();

t.pass([ 1, 2, 3 ]).map(function( n ){
  return n*n;
}).then(function( data ){
  console.log( data ); // [1, 4, 9]

  t1.stop();
});
```