## Details

If no elements in the graph match the selector, an empty [collection](Collection) is returned.

The function `cy.$()` acts as an alias to `cy.filter()`:  It's just convenient to save you typing.

## Examples

Get nodes with weight greater than 50:
```js
var collection = cy.nodes("[weight>50]");
```

Get edges with source node `n0`:
```js
var collection = cy.edges("[source=n0]");
```

Get all nodes and edges with weight greater than 50:
```js
var collection = cy.elements("[weight>50]");
collection = cy.filter("[weight>50]"); // works the same as the above line
```

Get nodes with weight greater than 50 with a filter function:
```js
var collection = cy.filter(function(i, element){
  if( element.isNode() && element.data("weight") > 50 ){
    return true;
  }
  return false;
});
```