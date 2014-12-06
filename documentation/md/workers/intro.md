A worker is a utility object that can be used for multitasking.  It gives a simple and concise API that is consistent across JS environments (using WebWorkers on browsers and forked child processes on Node.js).

A worker can be created as follows:

```js
var worker = cytoscape.worker();
```