## Details

If plain element objects are used, then [the same format used at initialisation](#core/initialisation) must be followed.  It is important to note that the `group` attribute must be specified for plain objects, as this function can not infer whether the elements added are nodes or edges.

It is important to note that the positions of newly added nodes must be defined when calling `cy.add()`.  Nodes can not be placed in the graph without a valid position &mdash; otherwise they could not be displayed.

## Examples

Add a node from a plain object.

```js
cy.add({
	group: "nodes",
	data: { weight: 75 },
	position: { x: 200, y: 200 }
});
```

Add nodes and edges to the graph as plain objects:

```js
// can use reference to eles later
var eles = cy.add([
  { group: "nodes", data: { id: "n0" }, position: { x: 100, y: 100 } },
  { group: "nodes", data: { id: "n1" }, position: { x: 200, y: 200 } },
  { group: "edges", data: { id: "e0", source: "n0", target: "n1" } }
]);
```