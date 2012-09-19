## Defails

In the handler function, `this` references the element that triggered the event.

## Examples

```js
cy.on('click', function(evt){
  console.log( 'clicked ' + this.id() );
});
```