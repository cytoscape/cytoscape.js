## Examples

When `ani.apply()` has updated the element style:

```js
var jAni = cy.$('#j').animation({
  style: {
    width: 100,
    height: 200
  },
  duration: 1000
});

jAni.progress(0.5).apply().promise('frame').then(function(){
  console.log('j has now has its style at 50% of the animation');
});
```

When `ani.play()` is done:

```js
var jAni = cy.$('#j').animation({
  style: {
    width: 100,
    height: 200
  },
  duration: 1000
});

jAni.play().promise().then(function(){
  console.log('animation done');
});
```
