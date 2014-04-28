## Examples

Bind to events that bubble up from elements matching the specified `node` selector:
```js
cy.on('tap', 'node', { foo: 'bar' }, function(evt){
  console.log( evt.data.foo ); // 'bar'

  var node = evt.cyTarget;
  console.log( 'tapped ' + node.id() );
});
```

Bind to all tap events that the core receives:

```js
cy.on('tap', function(event){
  // cyTarget holds a reference to the originator
  // of the event (core or element)
  var evtTarget = event.cyTarget;

  if( evtTarget === cy ){
  	console.log('tap on background');
  } else {
    console.log('tap on some element');
  }
});
```