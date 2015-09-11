'use strict';

var define = require('../define');

var elesfn = ({
  animation: define.animation(),
  animated: define.animated(),
  clearQueue: define.clearQueue(),
  delay: define.delay(),
  delayPromise: define.delayPromise(),
  animate: define.animate(),
  animatePromise: define.animatePromise(),
  stop: define.stop()
});

module.exports = elesfn;
