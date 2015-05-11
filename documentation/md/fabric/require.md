## Examples

```js
var f = cytoscape.fabric();

function plusplus( n ){
  return ++n;
}

f.require( plusplus ).pass([ 1, 2, 3, 4 ]).map(function( n ){
  return plusplus(n);
}).then(function( res ){
  console.log('res is ' + res);

  f.stop();
});
```