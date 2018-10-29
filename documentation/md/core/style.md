## Details

You can use this function to gain access to the visual style (stylesheet) after initialisation.  This is useful if you need to change the entire stylesheet at runtime.

Set a new style by reference:

```js
// here a string stylesheet is used, but you could also use json or a cytoscape.stylesheet() object
var stringStylesheet = 'node { background-color: cyan; }';
cy.style( stringStylesheet );
```

Set an entirely new style to the graph, specifying [selectors](#selectors) and [style properties](#style) via function calls:

```js
cy.style()
  .resetToDefault() // start a fresh default stylesheet

  // and then define new styles
  .selector('node')
  	.style('background-color', 'magenta')

  // ...

  .update() // indicate the end of your new stylesheet so that it can be updated on elements
;
```

Add to the existing stylesheet:
```js
cy.style()
  .selector('node')
    .style({
      'background-color': 'yellow'
    })

  .update() // indicate the end of your new stylesheet so that it can be updated on elements
;
```

Set the style from plain JSON:

```js
cy.style()
  .fromJson([
    {
      selector: 'node',
      style: {
        'background-color': 'red'
      }
    }

    // , ...
  ])

  .update() // indicate the end of your new stylesheet so that it can be updated on elements
;
```

Set the style from a style string (that you would probably pull from a file on your server):

```js
cy.style()
  .fromString('node { background-color: blue; }')

  .update() // update the elements in the graph with the new style
;
```

Get the current style as JSON:

```js
var styleJson = cy.style().json();
var serializedJson = JSON.stringify( styleJson );
```
