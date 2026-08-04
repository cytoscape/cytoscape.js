## Details

This function is useful in situations where you don't want to run an animation any more.  Calling `ani.stop()` is analogous to calling `ele.stop()` in that the animation is no longer queued.  

Calling `ani.stop()` makes animation frames faster by reducing the number of animations to check per element per frame.  You should call `ani.stop()` when you want to clean up an animation, especially in situations with many animations.  You can still reuse a stopped animation, but an animation that has not been stopped can not be garbage collected unless its associated target (i.e. element or core instance) is garbage collected as well.


## Examples

```js
var j = cy.$('#j');
var jAni = j.animation({
  style: {
    'background-color': 'red',
    'width': 75
  },
  duration: 1000
});

jAni.play();

// stop about midway
setTimeout(function(){
  jAni.stop();
}, 500);
```
