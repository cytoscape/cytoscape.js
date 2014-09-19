## Examples

```js
cy.nodes().animate({
  css: { 'background-color': 'cyan' }
}, {
  duration: 5000,
  complete: function(){
    console.log('Animation complete');
  }
});

console.log('Animating nodes...');

setTimeout(function(){
  console.log('Stopping nodes animation');
  cy.nodes().stop();
}, 2500);
```