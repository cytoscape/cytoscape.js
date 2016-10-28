## Details

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

This makes for very efficient modifications to elements, but it has some caveats.  While inside the batch callback,

* you can not reliably read element style or dimensions (it may have changed, or computed values may be out of date),
* you probably do not want to use `eles.style()` et cetera because they force a style bypass rather than a recalculation.


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
