'use strict';

function NullRenderer(options){
  this.options = options;
}

var noop = function(){};

NullRenderer.prototype = {
  recalculateRenderedStyle: noop,
  notify: noop,
  init: noop
};

module.exports = NullRenderer;
