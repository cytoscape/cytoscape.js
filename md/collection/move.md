## Details

Note that this function does not really move the elements.  Instead, this function

* gets JSON copies of the elements,
* removes the original elements,
* modifies the JSON copies as specified, and
* adds new elements from the JSON copies and restores relationships (in the case of compound node descendants and connected edges).

This creates the same effect as though the elements have been moved while maintaining the correct semantics for a graph.

<span class="important-indicator"></span> Because this function replaces the specified elements in the graph, you will need to update any references you are holding to the old elements in your code.


## Examples

Move an edge:
```js
var ej = cy.$('#ej');

ej = ej.move({
  target: 'g'
});
```