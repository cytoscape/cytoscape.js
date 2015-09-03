'use strict';

var CRp = {};

var impl;

CRp.nodeShapeImpl = function( name ){
  var self = this;

  return ( impl || (impl = {
    'ellipse': function( context, centerX, centerY, width, height ){
      self.drawEllipsePath( context, centerX, centerY, width, height );
    },

    'polygon': function( context, centerX, centerY, width, height, points ){
      self.drawPolygonPath( context, centerX, centerY, width, height, points );
    },

    'roundrectangle': function( context, centerX, centerY, width, height ){
      self.drawRoundRectanglePath( context, centerX, centerY, width, height, 10 );
    }
  }) )[ name ];
};

module.exports = CRp;
