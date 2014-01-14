## Details

You can use this function to gain access to the visual style after initialisation.  This is useful if you need to change the entire stylesheet at runtime, though this is strongly not advised for most developers.  It's akin to changing the CSS files you're using on a HTML document on-the-fly.

This example sets an entirely new style to the graph, specifying [selectors](#selectors) and [style properties](#style):

```js
cy.style()
  .resetToDefault() // start a fresh default stylesheet

  // and then define new styles
  .selector('node')
  	.css('background-color', 'blue')

  // ...

  .update() // update the elements in the graph with the new style
```

You can also set the style from plain JSON:

```js
cy.style()
  .fromJson([
    {
      selector: 'node',
      css: {
        'background-color': 'blue'
      }
    }

    // , ...
  ])

  .update() // update the elements in the graph with the new style
  ```

You can also set the style from a style string (that you would probably pull from a file on your server):

```js
cy.style()
  .fromString('node { background-color: blue; }')

  .update() // update the elements in the graph with the new style
  ```