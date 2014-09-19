## Examples

With a collection:
```js
var j = cy.$('#j');
var e = cy.$('#e');

j.add(e);
```

With a selector:
```js
cy.$('#j').add('#e');
```