## Details

This function allows you to step directly to a particular progress of the animation while it's paused.

## Examples

```js
var jAni = cy.$('#j').animation({
  style: {
    'background-color': 'red'
  },
  duration: 1000
});

jAni.progress(0.5).apply();
```
