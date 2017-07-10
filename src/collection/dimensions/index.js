let util = require('../../util');
let position = require('./position');
let bounds = require('./bounds');
let widthHeight = require('./width-height');

module.exports = util.assign( {}, position, bounds, widthHeight );
