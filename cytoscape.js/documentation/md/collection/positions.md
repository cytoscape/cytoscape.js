## Examples

```js
cy.nodes().positions(function( i, node ){
  return {
    x: i * 100,
    y: 100
  };
});
```