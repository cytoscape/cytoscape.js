## Examples

```js
cy.nodes()
  .animate({
      style: { 'background-color': 'blue' }
    }, {
      duration: 1000
    })

  .delay( 1000 )

  .animate({
    style: { 'background-color': 'yellow' }
  })
;

console.log('Animating nodes...');
```