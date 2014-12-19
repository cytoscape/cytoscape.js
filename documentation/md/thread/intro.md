A thread is a reusable utility object that can be used for multitasking in extensions, like layouts.  It gives a simple and concise API that is consistent across JS environments (using WebWorkers on browsers and forked child processes on Node.js).

A thread can be created as follows:

```js
var thread = cytoscape.thread();
```