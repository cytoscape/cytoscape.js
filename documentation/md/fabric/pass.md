## Examples

```js
var f = cytoscape.fabric();

f.pass([ 1, 2, 3, 4 ]).map(function( n ){
  return n*n;
}).then(function( res ){
  console.log('res is ' + res);

  f.stop();
});
```