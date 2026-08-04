## Details

This function returns a plain object of the form `{ left, right, both }` where 

* `left` is the set of elements only in the calling (i.e. left) collection,
* `right` is the set of elements only in the passed (i.e. right) collection, and
* `both` is the set of elements in both collections.

## Examples

```js
var diff = cy.$('#j, #e, #k').diff('#j, #g');
var getNodeId = function( n ){ return n.id() };

console.log( 'left: ' + diff.left.map( getNodeId ).join(', ') );
console.log( 'right: ' + diff.right.map( getNodeId ).join(', ') );
console.log( 'both: ' + diff.both.map( getNodeId ).join(', ') );
```