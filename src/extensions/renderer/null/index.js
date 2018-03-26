function NullRenderer( options ){
  this.options = options;
  this.notifications = 0; // for testing
}

let noop = function(){};

NullRenderer.prototype = {
  recalculateRenderedStyle: noop,
  notify: function(){ this.notifications++; },
  init: noop,
  isHeadless: function(){ return true; }
};

export default NullRenderer;
