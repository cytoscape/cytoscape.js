## Details

You can use this function to gain access to the visual style after initialisation.  This is useful if you need to change the entire stylesheet at runtime, though this is strongly not advised for most developers.  It's akin to changing the CSS files you're using on a HTML document on-the-fly.

This example sets an entirely new style to the graph, specifying [selectors](#selectors) and [style properties](#style):

```js
cy.style()
  .resetToDefault() // start a fresh default stylesheet

  // and then define new styles
  .selector('node')
  	.css('background-color', 'blue')
  .selector('node:selected')
    .css({
      'background-color': 'red',

      // , ...
    })

  // ...

  .update()
```