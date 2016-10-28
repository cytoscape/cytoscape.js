## Examples

```js
var jAndE = cy.$('#j, #e');
var everyHeavierThan50 = jAndE.every(function( ele ){
  return ele.data('weight') > 50;
});

console.log( 'every heavier than 50 ? ' + everyHeavierThan50 );
```