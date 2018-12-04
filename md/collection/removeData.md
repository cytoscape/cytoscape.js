## Details

Using `ele.removeData()` sets the specified fields to `undefined`.  This allows you to use a meaningful `null` value in your element data.

The following data fields are immutable, and so they can not be removed:

 * `id` : The `id` field is used to uniquely identify an element in the graph.
 * `source` & `target` : These fields define an edge's relationship to nodes, and this relationship can not be changed after creation.
 * `parent` : The `parent` field defines the parent (compound) node.

Instead of modifying those fields, you can replace an element with a modified clone using [`ele.move()`](#ele.move).