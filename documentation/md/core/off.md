## Examples

For all handlers:

```js
cy.on("click", function(){ /* ... */ });

// unbind all click handlers, including the one above
cy.off("click");
```

For a particular handler:

```js
var handler = function(){
  console.log("called handler");
};
cy.on("click", handler);

var otherHandler = function(){
  console.log("called other handler");
};
cy.on("click", otherHandler);

// just unbind handler
cy.off("click", handler);
```