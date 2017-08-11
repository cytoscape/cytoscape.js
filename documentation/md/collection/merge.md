## Details

<span class="important-indicator"></span> This function modifies the calling collection instead of returning a new one.  Use of this function should be considered for performance in some cases, but otherwise should be avoided.  Consider using `eles.union()` instead.

## Examples

With a collection:
```js
var j = cy.$('#j');
var e = cy.$('#e');

j.merge(e);
```

With a selector:
```js
cy.$('#j').merge('#e');
```