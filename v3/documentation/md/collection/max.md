## Details

This function returns an object with the following fields:

* `value` : The maximum value found.
* `ele` : The element that corresponds to the maximum value.


## Examples

Find the node with the maximum weight:
```js
var max = cy.nodes().max(function(){
  return this.data('weight');
});

console.log( 'max val: ' + max.value + ' for element ' + max.ele.id() );
```