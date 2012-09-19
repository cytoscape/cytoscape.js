## Examples

```js
cy.nodes().animate({
  position: { x: 100, y: 100 },
  css: { backgroundColor: 'red' }
}, {
  duration: 1000
});
```