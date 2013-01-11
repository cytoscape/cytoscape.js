## Examples

```js
cy.elements().each(function(i, ele){
  console.log( ele.id() + ' is ' + ( ele.selected() ? 'selected' : 'not selected' ) );
});
```