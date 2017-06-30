## Details

If the layout is asynchronous (i.e. continuous), then calling `layout.run()` simply starts the layout.  Synchronous (i.e. discrete) layouts finish before `layout.run()` returns.  Whenever the layout is started, the `layoutstart` event is emitted.

The layout will emit the `layoutstop` event when it has finished or has been otherwise stopped (e.g. by calling `layout.stop()`).  The developer can bind to `layoutstop` using [`layout.on()`](#layouts/layout-events/layout.on) or setting the layout options appropriately with a callback.


## Examples

```js
var layout = cy.layout({ name: 'random' });

layout.run();
```
