## Examples

For all handlers:

```js
cy.on('tap', function(){ /* ... */ });

// unbind all tap handlers, including the one above
cy.removeListener('tap');
```

For a particular handler:

```js
var handler = function(){
  console.log('called handler');
};
cy.on('tap', handler);

var otherHandler = function(){
  console.log('called other handler');
};
cy.on('tap', otherHandler);

// just unbind handler
cy.removeListener('tap', handler);
```
