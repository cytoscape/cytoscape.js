## Details

Note that this function performs a breadth-first search on only the subset of the graph in the calling collection.

This function returns an object that contains two collections (`{ path: eles, found: node }`), the node found by the search and the path of the search:

 * If no node was found, then `found` is empty.
 * If your handler function returns `false`, then the only the path up to that point is returned.
 * The path returned includes edges such that if `path[i]` is a node, then `path[i - 1]` is the edge used to get to that node.

## Examples

```js
var bfs = cy.elements().bfs({
  roots: '#e',
  visit: function(i, depth){
    console.log( 'visit ' + this.id() );

    // example of finding desired node
    if( this.data('weight') > 70 ){
      return true;
    }

    // example of exiting search early
    if( this.data('weight') < 0 ){
      return false;
    }
  },
  directed: false
});

var path = bfs.path; // path to found node
var found = bfs.found; // found node

// select the path
path.select();
```
