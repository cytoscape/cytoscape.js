## Examples

```js
var j = cy.$('#j');
var jAni = j.animation({
  style: {
    width: 100,
    height: 200
  },
  duration: 1000
});

jAni.play();

// pause about midway
setTimeout(function(){
  jAni.pause();
}, 500);
