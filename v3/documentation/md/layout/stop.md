## Details

Calling `layout.stop()` stops an asynchronous (continuous) layout.  It's useful if you want to prematurely stop a running layout.


## Examples

```js
var layout = cy.layout({ name: 'cose' });

layout.run();

// some time later...
setTimeout(function(){
  layout.stop();
}, 100);
```
