'use strict';

var CRp = {};

CRp.nodeShapeImpl = function( name, context, centerX, centerY, width, height, points ){
  switch( name ){
    case 'ellipse':
      return this.drawEllipsePath( context, centerX, centerY, width, height );
    case 'polygon':
      return this.drawPolygonPath( context, centerX, centerY, width, height, points );
    case 'roundrectangle':
      return this.drawRoundRectanglePath( context, centerX, centerY, width, height );
  }
};

module.exports = CRp;
