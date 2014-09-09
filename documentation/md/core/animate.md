## Examples

Manual pan and zoom:
```js
cy.animate({
  pan: { x: 100, y: 100 },
  zoom: 2
}, {
  duration: 1000
});
```

Fit to elements:
```js
var j = cy.$('#j');

cy.animate({
  fit: {
    eles: j,
    padding: 20
  }
}, {
  duration: 1000
});
```