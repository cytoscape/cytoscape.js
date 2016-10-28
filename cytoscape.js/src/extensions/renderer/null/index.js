'use strict';

function NullRenderer( options ){
  this.options = options;
  this.notifications = 0; // for testing
}

var noop = function(){};

NullRenderer.prototype = {
  recalculateRenderedStyle: noop,
  notify: function(){ this.notifications++; },
  init: noop
};

module.exports = NullRenderer;
