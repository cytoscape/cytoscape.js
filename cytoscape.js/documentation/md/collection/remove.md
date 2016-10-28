## Details

This function removes the calling elements from the graph.  The elements are not deleted --- they still exist in memory --- but they are no longer in the graph.

<span class="important-indicator"></span> A removed element just exists to be added back to its originating core instance or some other core instance.  A removed element is not functional, because it is no longer a part of the graph: Nothing really makes sense for it anymore outside of the context of a graph.  It merely exists in this limbo state so you can later add it back to some core instance.

## Examples

Remove selected elements:

```js
cy.$(':selected').remove();
```