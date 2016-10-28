## Examples

With a collection:
```js
var j = cy.$('#j');
var e = cy.$('#e');

j.union(e);
```

With a selector:
```js
cy.$('#j').union('#e');
```