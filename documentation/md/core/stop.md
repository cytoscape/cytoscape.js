## Examples

```js
cy.animate({
  fit: { eles: '#j' }
}, { duration: 2000 });

// stop in the middle
setTimeout(function(){
  cy.stop();
}, 1000);
```