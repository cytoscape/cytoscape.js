## Details

By default, the export takes into account the current screen pixel density so that the image is of the same quality of the screen.  If the `maxWidth` or `maxHeight` options are specified, then the screen pixel density is ignored so that the image can fit in the specified dimensions.


## Examples

```js
var png64 = cy.png();

// put the png data in an img tag
$('#png-eg').attr('src', png64);
```

Example image tag:

<img id="png-eg" style="border: 1px solid #ddd; min-width: 3em; min-height: 3em;"></img>
