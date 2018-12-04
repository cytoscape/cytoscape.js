## Details

Note that you can specify only one of `position` and `renderedPosition`:  You can not animate to two positions at once.

## Examples

```js
cy.nodes().animate({
  position: { x: 100, y: 100 },
  style: { backgroundColor: 'red' }
}, {
  duration: 1000
});

console.log('Animating nodes...');
```