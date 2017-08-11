## Details

<span class="important-indicator"></span> This function modifies the calling collection instead of returning a new one.  Use of this function should be considered for performance in some cases, but otherwise should be avoided.  Consider using `eles.filter()` or `eles.remove()` instead.

## Examples

With a collection:
```js
var j = cy.nodes();
var e = cy.$('#e');

j.unmerge(e);
```

With a selector:
```js
cy.nodes().unmerge('#e');
