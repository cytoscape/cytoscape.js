## Defails

In the handler function, `this` references the originally bound object, and `evt.cyTarget` references the target of the event.

## Examples

```js
cy.on('tap', function(evt){
  console.log( 'tap ' + evt.cyTarget.id() );
});
```