## Details

This function behaves like `Array.prototype.forEach()` with minor changes for convenience:

 * You can exit the iteration early by returning `false` in the iterating function.  The `Array.prototype.forEach()` implementation does not support this, but it is included anyway on account of its utility.


 ## Examples

 ```js
// print all the ids of the nodes in the graph
cy.nodes().forEach(function( ele ){
  console.log( ele.id() );
});
 ```