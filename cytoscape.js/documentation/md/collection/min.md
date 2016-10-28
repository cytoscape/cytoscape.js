## Details

This function returns an object with the following fields:

* `value` : The minimum value found.
* `ele` : The element that corresponds to the minimum value.


## Examples

Find the node with the minimum weight:
```js
var min = cy.nodes().min(function(){
  return this.data('weight');
});

console.log( 'min val: ' + min.value + ' for element ' + min.ele.id() );
```