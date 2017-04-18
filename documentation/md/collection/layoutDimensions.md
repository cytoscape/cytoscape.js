This function is used to retrieve the width and height of the bounding box of a node. The way the width and height are calculated is affected by the options object which is passed in.

It returns an object containing the width and height of the calculated bounding box under the `x` and `y` keys respectively. It can be used as a direct replacement for the `boundingBox()` function assuming only `x` and `y` values are needed.

```js
var options = {
  nodeDimensionsIncludeLabels: false, // Boolean which changes whether label dimensions are included when calculating node dimensions
}
```
