## Examples

```js
var f = cytoscape.fabric();

f.pass([ -2, -1, 0, 1, 2 ]).filter(function( n ){
  return n > 0;
}).then(function( res ){
  console.log('res is ' + res);

  f.stop();
});
```