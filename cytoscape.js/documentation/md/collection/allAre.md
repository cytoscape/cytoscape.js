## Examples

```js
var jAndE = cy.$('#j, #e');

console.log( 'j and e all have weight > 50 ? ' + jAndE.allAre('[weight > 50]') );
```