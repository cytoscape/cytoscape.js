## Details

Note that `eleObjs` can be specified as an array with each element specifying its `group`, or alternatively, `eleObjs` can be specified as a `group`-indexed map, following the same format as in [initialisation](#core/initialisation).

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
}).one("layoutstop", function(e){
  console.log("cy laid out elements");
});

cy.load([ { data: { id: "n1" }, group: "nodes" } ]);
```