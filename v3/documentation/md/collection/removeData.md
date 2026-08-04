## Details

Using `ele.removeData()` sets the specified fields to `undefined`.  This allows you to use a meaningful `null` value in your element data.

The following data fields are normally immutable, and so they can not be removed:

 * `id` : The `id` field is used to uniquely identify an element in the graph.
 * `source` & `target` : These fields define an edge's relationship to nodes, and this relationship can not be changed after creation.
 * `parent` : The `parent` field defines the parent (compound) node.

To modify the topology of the graph without adding or removing elements, you must use [`ele.move()`](#ele.move).  Even so, only `parent` may be removed by `ele.move()`.  An edge always requires a valid source and target.