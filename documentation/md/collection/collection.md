A collection contains a set of nodes and edges.  Calling a function applies the function to all elements in the collection.  When reading values from a collection, `eles.data()` for example, the value of the first element in the collection is returned.  This follows the jQuery convention.  For example:

```js
// assume graph:
// n1[weight = 10], n2[weight = 60], n3[weight = 90]

var weight = cy.nodes().data("weight"); // returns 10
```

You can insure that you're reading from the element you want by using a [selector](#selectors) to narrow down the collection to one element (i.e. `eles.size() === 1`) or the `eles.eq()` function.