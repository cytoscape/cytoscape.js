## Details

This function is merely a convenient way of setting the elements in the graph and applying a layout.  For more control, the developer should use [`cy.add()`](#core/graph-manipulation/cy.add) and [`cy.layout()`](#core/layout/cy.layout) etc.

Note that `eleObjs` can be specified as an array with each element specifying its `group`, or alternatively, `eleObjs` can be specified as a `group`-indexed map, following the same format as in [initialisation](#core/initialisation) and outlined in the [element JSON format](#notation/elements-json).

## Examples

As an array:
```js
cy.load([
  { data: { id: "n1" }, group: "nodes" },
  { data: { id: "n2" }, group: "nodes" },
  { data: { id: "e1", source: "n1", target: "n2" }, group: "edges" }
]);
```

As a `group`-indexed map:
```js
cy.load({
  nodes: [
    { data: { id: "n1" } },
    { data: { id: "n2" } }
  ],

  edges: [
    { data: { id: "e1", source: "n1", target: "n2" } }
  ]
});
```

With specified callbacks:
```js
cy.load([ { data: { id: "n1" }, group: "nodes" } ], function(e){
  console.log("cy loaded elements");
}, function(e){
  console.log("cy laid out elements");
});
```

This is equivalent to:
```js
cy.one("load", function(e){
  console.log("cy loaded elements");
}).one("done", function(e){
  console.log("cy laid out elements");
});

cy.load([ { data: { id: "n1" }, group: "nodes" } ]);
```