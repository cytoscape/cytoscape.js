## Details

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