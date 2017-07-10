let util = require('../../util');
let position = require('./position');
let bounds = require('./bounds');
let widthHeight = require('./width-height');
let edgePoints = require('./edge-points');

module.exports = util.assign( {}, position, bounds, widthHeight, edgePoints );
