## Examples

```js
var jAndE = cy.$('#j, #e');
var someHeavierThan50 = jAndE.some(function( ele ){
  return ele.data('weight') > 50;
});

console.log( 'some heavier than 50 ? ' + someHeavierThan50 );
```