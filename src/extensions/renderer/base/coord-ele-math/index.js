var util = require('../../../../util');

var BRp = {};

[
  require('./coords'),
  require('./edge-arrows'),
  require('./edge-control-points'),
  require('./edge-endpoints'),
  require('./edge-projection'),
  require('./labels'),
  require('./nodes'),
  require('./rendered-style'),
  require('./z-ordering')
].forEach(function( props ){
  util.extend( BRp, props );
});

module.exports = BRp;
