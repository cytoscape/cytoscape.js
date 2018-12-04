## Details

This function is useful for storing temporary, possibly non-JSON data.  Extensions --- like layouts, renderers, and so on --- use `ele.scratch()` namespaced on their registered name.  For example, an extension named `foo` would use the namespace `'foo'`.  

If you want to use this function for your own app-level data, you can prefix the namespaces you use by underscore to avoid collisions with extensions.  For example, using `ele.scratch('_foo')` in your app will avoid collisions with an extension named `foo`.

This function is useful for associating non-JSON data to an element.  Whereas data stored via `ele.data()` is included by `ele.json()`, data stored by `ele.scratch()` is not.  This makes it easy to temporarily store unserialisable data.


## Examples

```js
var j = cy.$('#j');

// entire scratchpad:
// be careful, since you could clobber over someone else's namespace or forget to use one at all!
var fooScratch = j.scratch()._foo = {}; 
// ... now you can modify fooScratch all you want

// set namespaced scratchpad to ele:
// safer, recommended
var fooScratch = j.scratch('_foo', {});
// ... now you can modify fooScratch all you want

// get namespaced scratchpad from ele (assumes set before)
var fooScratch = j.scratch('_foo');
// ... now you can modify fooScratch all you want

```