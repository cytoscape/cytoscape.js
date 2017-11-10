## Details

<span class="important-indicator"></span> You should use this function very sparingly for setting:

- There are very few valid usecases for setting with `ele.style()`.
- It *overrides* the style of an element, despite the state and classes that it has.
- In general, it's much better to specify a better stylesheet at initialisation that reflects your application state rather than programmatically modifying style.
- You can not serialise or deserialise overridden style via `ele.json()`.

Only [defined visual style properties](#style) are supported.

If you would like to remove a particular overridden style property, you can set `null` or `''` (the empty string) to it.
