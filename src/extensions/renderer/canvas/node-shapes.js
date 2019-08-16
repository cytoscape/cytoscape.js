var CRp = {};

CRp.nodeShapeImpl = function( name, context, centerX, centerY, width, height, points ){
  switch( name ){
    case 'ellipse':
      return this.drawEllipsePath( context, centerX, centerY, width, height );
    case 'polygon':
      return this.drawPolygonPath( context, centerX, centerY, width, height, points );
    case 'round-polygon':
      return this.drawRoundPolygonPath(context, centerX, centerY, width, height, points );
    case 'roundrectangle':
    case 'round-rectangle':
      return this.drawRoundRectanglePath( context, centerX, centerY, width, height );
    case 'cutrectangle':
    case 'cut-rectangle':
      return this.drawCutRectanglePath( context, centerX, centerY, width, height );
    case 'bottomroundrectangle':
    case 'bottom-round-rectangle':
      return this.drawBottomRoundRectanglePath( context, centerX, centerY, width, height );
    case 'barrel':
      return this.drawBarrelPath( context, centerX, centerY, width, height );
  }
};

export default CRp;
