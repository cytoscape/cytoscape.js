## Examples

```js
var jAni = cy.$('#j').animation({
  style: {
    'background-color': 'red',
    'width': 75
  },
  duration: 1000
});

jAni
  .play() // start
  .promise('completed').then(function(){ // on next completed
    jAni
      .reverse() // switch animation direction
      .rewind() // optional but makes intent clear
      .play() // start again
    ;
  })
;
```
