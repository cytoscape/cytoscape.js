## Details

<span class="important-indicator"></span> Do not add batching to your app unless you have identified an applicable performance bottleneck.  There are restrictions on what kind of code you can run in a batch.

Normally, when you modify elements, each modification can trigger a style calculation and a redraw --- depending on timing for a redraw.  For example, the following will cause two style calculations and at least one draw:

```js
cy.$('#j')
  .data('weight', '70')   // style update
  .addClass('funny')      // style update AGAIN
  .removeClass('serious') // style update YET AGAIN

  // at least 1 redraw here
  // possibly 3 total depending on speed of above operations
  // (for one ele almost certainly 1 redraw, but consider many eles)
;
```

This is not a problem for a handful of operations on a handful of elements, but for many operations on many elements you end up with redundant style calculations and probably redundant redraws.  In the worst case, you have `eles.length * numOps` style updates and redraws --- and both style updates and redraws can be expensive.  In the worst case when using `cy.batch()`, you limit the style updates to `eles.length` and you limit the redraws to just one.

Thus, this function is useful for making many changes to elements at once.  When the specified callback function is complete, only elements that require it have their style updated and the renderer makes at most a single redraw.

This makes for very efficient modifications to elements, but it has some caveats inside a batch:

* You can not reliably read element style or dimensions (it may have changed, or computed values may be out of date).
* You probably do not want to use `eles.style()` et cetera because they force a style bypass rather than a recalculation.
* You can not apply any style-dependent operation within the batch if you have already modified style within the same batch.  Common style-dependent operations include:
  * Layout: `cy.layout()`, `eles.layout()`, etc.
  * Reading style: `ele.style()`, `ele.numericStyle()`, etc.
  * Reading dimensions: `ele.midpoint()`, `ele.boundingBox()`, etc.
  * Animation: `ele.animation()`, `cy.animate()`, etc.
  * And so on...

A batch should correspond to a single visual operation.  Usually a batch should contain calls only to the following functions:

- Modifying state: `eles.data()`, `eles.scratch()`, `eles.addClass()`, `eles.removeClass()`, etc.
- Building collections: `eles.union()`, `eles.difference()`, `eles.intersection()`, etc.
- Comparison: `eles.same()`, `eles.some()`, etc.
- Iteration: `eles.forEach()`, `eles.empty()`, etc.
- Traversal: `node.outgoers()`, `eles.bfs()`, etc.
- Algorithms: `eles.dijkstra()`, `eles.degreeCentrality()`, etc.



## Examples

Synchronous style:
```js
cy.batch(function(){
  cy.$('#j')
    .data('weight', '70')
    .addClass('funny')
    .removeClass('serious')
  ;
});
```

Asynchronous style:
```js
cy.startBatch();

cy.$('#j')
  .data('weight', '70')
  .addClass('funny')
  .removeClass('serious')
;

cy.endBatch();
```
