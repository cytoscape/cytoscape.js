## Details

If plain element objects are used, then [the same format used at initialisation](#core/initialisation) must be followed.

If a collection of existing elements is specified to a different core instance, then copies of those elements are added, which allows for elements to be effectively transferred between instances of Cytoscape.js.

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
