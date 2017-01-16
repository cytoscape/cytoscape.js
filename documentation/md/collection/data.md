## Details

Only JSON-serialisable data may be put in `ele.data()`.  For temporary data or non-serialisable data, use [`ele.scratch()`](#ele.scratch).

The following fields are immutable:

 * `id` : The `id` field is used to uniquely identify an element in the graph.
 * `source` & `target` : These fields define an edge's relationship to nodes, and this relationship can not be changed after creation.
 * `parent` : The `parent` field defines the parent (compound) node.

## Examples

```js
var j = cy.$('#j');

// set the weight field in data
j.data('weight', 60);

// set several fields at once
j.data({
  name: 'Jerry Jerry Dingleberry',
  height: 176
});

var weight = j.data('weight');
```
