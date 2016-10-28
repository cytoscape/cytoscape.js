## Examples

```js
cy.nodes().filterFn(function( ele ){
  return ele.data('weight') > 50;
});
```