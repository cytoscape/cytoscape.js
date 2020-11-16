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

// pause about midway
setTimeout(function(){
  jAni.pause();
}, 500);
```
