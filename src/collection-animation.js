;(function( $$ ){ 'use strict';

  $$.fn.eles({
    animated: $$.define.animated(),
    clearQueue: $$.define.clearQueue(),
    delay: $$.define.delay(),
    delayPromise: $$.define.delayPromise(),
    animate: $$.define.animate(),
    animatePromise: $$.define.animatePromise(),
    stop: $$.define.stop()
  });

})( cytoscape );
