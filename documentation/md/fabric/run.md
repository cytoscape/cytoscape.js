## Examples

```js
var f = cytoscape.fabric();

f.run(function(){
  return 2 + 2;
}).then(function( sum ){
  console.log('sum should be ' + sum + ' unless the year is 1984');

  f.stop();
});
```