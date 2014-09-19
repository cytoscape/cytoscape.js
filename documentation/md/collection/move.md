## Details

Note that this function does not really move the elements.  That's not possible in the semantics of a graph.  Instead, this function

* gets JSON copies of the elements,
* removes the original elements,
* modifies the JSON copies as specified, and
* adds new elements from the JSON copies.

This creates the same effect as though the elements have been moved.


## Examples

Move an edge:
```js
cy.$('#ej').move({
  target: 'g'
})
```