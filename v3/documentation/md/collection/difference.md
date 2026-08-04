## Examples

With a collection:
```js
var j = cy.$('#j');
var nodes = cy.nodes();

nodes.difference(j);
```

With a selector:
```js
cy.nodes().difference('#j');
```