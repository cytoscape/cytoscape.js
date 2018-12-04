## Examples

With a selector:

```js
cy.nodes().filter('[weight > 50]');
```

With a function:

```js
cy.nodes().filter(function( ele ){
  return ele.data('weight') > 50;
});
```
