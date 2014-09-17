## Examples

With a collection:
```js
var j = cy.$('#j');
var nodes = cy.nodes();

nodes.not(j);
```

With a selector:
```js
cy.nodes().not('#j');
```