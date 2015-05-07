## Details

<span class="important-indicator"></span> The JPEG format is lossy, whereas PNG is not.  This means that `cy.jpg()` is useful for cases where filesize is more important than pixel-perfect images.  JPEG compression will make your images (especially edge lines) blurry and distorted.


## Examples

```js
var jpg64 = cy.jpg();

// put the png data in an img tag
$('#jpg-eg').attr('src', jpg64);
```

Example image tag:

<img id="jpg-eg" style="border: 1px solid #ddd; min-width: 3em; min-height: 3em;"></img>
