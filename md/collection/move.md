## Details

This function moves the elements in-place, so no `remove` or `add` events are generated.  A `move` event is emitted on the moved elements.

## Examples

Move an edge:
```js
var ej = cy.$('#ej');

ej = ej.move({
  target: 'g'
});
```