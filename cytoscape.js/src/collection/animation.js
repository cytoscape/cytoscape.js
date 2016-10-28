'use strict';

var define = require( '../define' );

var elesfn = ({
  animate: define.animate(),
  animation: define.animation(),
  animated: define.animated(),
  clearQueue: define.clearQueue(),
  delay: define.delay(),
  delayAnimation: define.delayAnimation(),
  stop: define.stop()
});

module.exports = elesfn;
