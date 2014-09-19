## Examples

```js
cy.nodes()
  .animate({
      css: { 'background-color': 'blue' }
    }, {
      duration: 1000
    })

  .delay( 1000 )

  .animate({
    css: { 'background-color': 'yellow' }
  })
;

console.log('Animating nodes...');
```