## Details

A position has two fields, `x` and `y`, that can take on numerical values.

## Examples

```js
// get x for j
var x = cy.$('#j').position('x');

// get the whole position for e
var pos = cy.$('#e').position();

// set y for j
cy.$('#j').position('y', 100);

// set multiple
cy.$('#e').position({
  x: 123,
  y: 200
});
```