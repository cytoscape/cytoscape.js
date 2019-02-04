## Details

By default, the export takes into account the current screen pixel density so that the image is of the same quality of the screen.  If the `maxWidth` or `maxHeight` options are specified, then the screen pixel density is ignored so that the image can fit in the specified dimensions.

<span class="important-indicator"></span> Specifying `output:'blob-promise'` is the only way to make this function non-blocking.  Other outputs may hang the browser until finished, especially for a large image.


## Examples

```js
var png64 = cy.png();

// put the png data in an img tag
document.querySelector('#png-eg').setAttribute('src', png64);
```

Example image tag:

<img id="png-eg"></img>
