## Details

If plain element objects are used, then [the same format used at initialisation](#core/initialisation) must be followed.  It is important to note that the `group` attribute must be specified for plain objects, as this function can not infer whether the elements added are nodes or edges.

It is important to note that the positions of newly added nodes must be defined when calling `cy.add()`.  Nodes can not be placed in the graph without a valid position &mdash; otherwise they could not be displayed.

## Examples

Add a node from a plain object.

```js
cy.add({ group: "nodes", data: { id: "n0" } });
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

Add elements:

```js
var n0 = cy.node("n1");
var n1 = cy.node("n2");
var e0 = cy.edge("e0");
n1.collection().add(n2).add(n3).remove(); // remove n0, n1, and e0

var n1e0 = n1.collection().add(e0);
cy.add(n0); // add a single element, n0
cy.add(n1e0); // add the collection of n1 and e0
```