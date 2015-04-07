## Examples

```js
var f = cytoscape.fabric();

f.pass([ 1, 2, 3, 4 ]).reduce(function( prev, curr ){
  return prev + curr;
}).then(function( res ){
  console.log('res is ' + res);

  f.stop();
});
```