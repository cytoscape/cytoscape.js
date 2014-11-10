## Details

Note that this function does not really move the elements.  That's not possible in the semantics of a graph.  Instead, this function

* gets JSON copies of the elements,
* removes the original elements,
* modifies the JSON copies as specified, and
* adds new elements from the JSON copies and restores relationships (in the case of compound node descendants and connected edges).

This creates the same effect as though the elements have been moved while maintaining the correct semantics for a graph.


## Examples

Move an edge:
```js
cy.$('#ej').move({
  target: 'g'
})
```