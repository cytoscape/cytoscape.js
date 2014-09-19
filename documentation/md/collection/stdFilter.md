## Examples

```js
cy.nodes().stdFilter(function( ele ){
  return ele.data('weight') > 50;
});
```