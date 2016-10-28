## Details

This function behaves like the jQuery `.each()` function.  For a more standard implementation, you may want to use [`eles.forEach()`](#collection/iteration/eles.forEach).

<span class="important-indicator"></span> Note that although this function is convenient in some cases, it is less efficient than making your own loop:

```js
var eles = cy.elements();
for( var i = 0; i < eles.length; i++ ){
	var ele = ele[i];

	console.log( ele.id() + ' is ' + ( ele.selected() ? 'selected' : 'not selected' ) );
}
```

## Examples

```js
cy.elements().each(function(i, ele){
  console.log( ele.id() + ' is ' + ( ele.selected() ? 'selected' : 'not selected' ) );
});
```