## Examples

With a collection:
```js
var j = cy.$('#j');
var nodes = cy.nodes();

nodes.diff(j);
```

With a selector:
```js
cy.nodes().diff('#j');
```