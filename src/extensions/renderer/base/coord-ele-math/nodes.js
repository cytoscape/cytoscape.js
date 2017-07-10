var BRp = {};

BRp.getNodeShape = function( node ){
  var r = this;
  var shape = node.pstyle( 'shape' ).value;

  if( node.isParent() ){
    if( shape === 'rectangle'
    || shape === 'roundrectangle'
    || shape === 'cutrectangle'
    || shape === 'barrel' ){
      return shape;
    } else {
      return 'rectangle';
    }
  }

  if( shape === 'polygon' ){
    var points = node.pstyle( 'shape-polygon-points' ).value;

    return r.nodeShapes.makePolygon( points ).name;
  }

  return shape;
};

module.exports = BRp;
