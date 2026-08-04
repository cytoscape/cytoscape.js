## Examples

```js
var jAni = cy.$('#j').animation({
  style: {
    'background-color': 'red',
    'width': 75
  },
  duration: 1000
});

// set animation to 50% and then play
jAni.progress(0.5).play();
```
