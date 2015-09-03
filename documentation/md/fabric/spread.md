## Examples

```js
var f = cytoscape.fabric();

f.pass([ 1, 2, 3, 4, 5, 6, 7, 8, 9 ]).spread(function( slice ){
  var res = [];
	
  for( var i = 0; i < slice.length; i++ ){
    res.push( slice[i] * slice[i] );
  }

  return res;
}).then(function( res ){
  console.log('res is ' + res);

  f.stop();
});
```