## Details

A position has two fields, `x` and `y`, that can take on numerical values.  Non-numerical values are ignored.

## Examples

```js
// get x for n1
var x = cy.$('#n1').position('x');

// get the whole position for n2
var pos = cy.$('#n2').position();

// set y for n1
cy.$('#n1').position('y', 100);

// set multiple
cy.$('#n2').position({
  x: 123,
  y: 456
});
```