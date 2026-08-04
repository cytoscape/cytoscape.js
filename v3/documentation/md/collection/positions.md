## Examples

```js
cy.nodes().positions(function( node, i ){
  return {
    x: i * 100,
    y: 100
  };
});
```
