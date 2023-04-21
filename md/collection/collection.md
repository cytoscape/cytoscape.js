A collection contains a set of nodes and edges, the set typically being immutable.  Calling a function applies the function to all elements in the collection.  When reading values from a collection, [`eles.data()`](#collection/data/eles.data) for example, the value of the first element in the collection is returned.  For example:

```js
var weight = cy.nodes().data("weight");

console.log( cy.nodes()[0].data("weight") + ' == ' + weight ); // weight is the first ele's weight
```

You can ensure that you're reading from the element you want by using a [selector](#selectors) to narrow down the collection to one element (i.e. `eles.size() === 1`) or the [`eles.eq()`](#collection/iteration/eles.eq) function.

<span class="important-indicator"></span> Note that a collection is immutable by default, meaning that the set of elements within a collection can not be changed.  The API returns a new collection with different elements when necessary, instead of mutating the existing collection.  This allows the programmer to safely use set theory operations on collections, use collections functionally, and so on.  Note that because a collection is just a list of elements, it is relatively inexpensive to create new collections.

Also note that collections are iterable for modern browsers which support the [iteration protocols](https://exploringjs.com/es6/ch_iteration.html). This enables the use of features such as the spread operator, for-of loops, and destructuring.

While collections may be accessed similarly to arrays via indices, they may also be used like sets [for formation](#collection/building--filtering) (e.g. `eles1.union(eles2)`) and [for membership testing](#collection/comparison) (e.g. `eles.has(node)`).
