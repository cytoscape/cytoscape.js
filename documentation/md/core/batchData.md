## Details

This function take a map whose indices are element IDs (e.g. `'n0'`) mapped to objects that are used to update the corresponding data object.  If an element already has data with the specified field name, then it is overwritten.

## Examples

```js
cy.batchData({
  'j': {
  	weight: 73 // too much non-fat yoghourt
  },

  'g': {
  	weight: 72,
  	height: 154 // shoe inserts
  }
});
```