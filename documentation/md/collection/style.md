## Details

You should use this function very sparingly for setting, because it *overrides* the style of an element, despite the state and classes that it has.  In general, it's much better to specify a better stylesheet at initialisation that reflects your application state rather than programmatically modifying style.

Only [defined visual style properties](#style) are supported.

If you would like to remove a particular overridden style property, set `null` or `''` (the empty string) to it.
