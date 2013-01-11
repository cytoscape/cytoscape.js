## Details

The following fields are immutable:

 * `id` : The `id` field is used to uniquely identify an element in the graph.
 * `source` & `target` : These fields define an edge's relationship to nodes, and this relationship can not be changed after creation.
 * `parent` : The `parent` field is a reserved field for the future implementation of compound nodes.

## Examples

```js
var n1 = cy.$('#n1');

// set the weight field in data
n1.data('weight', 75);

// set several fields at once
n1.data({
  foo: 'some value',
  bar: 'another value',
  baz: 'yet another value'
});

var weight = n1.data('weight');
```