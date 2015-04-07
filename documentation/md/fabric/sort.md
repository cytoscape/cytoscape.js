## Examples

```js
var f = cytoscape.fabric();

f.pass([ 4, 1, 2, 5, 3 ]).sort().then(function( res ){
  console.log('res is ' + res);

  f.stop();
});
```