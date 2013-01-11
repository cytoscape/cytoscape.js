## Details

This function removes the calling elements from the graph.  The elements are not deleted &mdash; they still exist in memory &mdash; but they are no longer in the graph.

## Examples

Remove selected elements:

```js
cy.$(':selected').remove();
```