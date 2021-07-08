var BRp = {};

import { warn } from '../../../../util';

const TOO_SMALL_CUT_RECT = 28;

let warnedCutRect = false;

BRp.getNodeShape = function( node ){
  var r = this;
  var shape = node.pstyle( 'shape' ).value;

  if( shape === 'cutrectangle' && (node.width() < TOO_SMALL_CUT_RECT || node.height() < TOO_SMALL_CUT_RECT) ){
    if( !warnedCutRect ){
      warn('The `cutrectangle` node shape can not be used at small sizes so `rectangle` is used instead');

      warnedCutRect = true;
    }

    return 'rectangle';
  }

  if( node.isParent() ){
    if( shape === 'rectangle'
    || shape === 'roundrectangle'
    || shape === 'round-rectangle'
    || shape === 'cutrectangle'
    || shape === 'cut-rectangle'
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

BRp.getOverlayShape = function( node ){
  var r = this;
  var overlayShape = node.pstyle( 'overlay-shape' ).value;

  if( overlayShape === 'auto' ) {
    return r.getNodeShape( node );
  }

  if( overlayShape === 'polygon' ){
    var points = node.pstyle( 'shape-polygon-points' ).value;

    return r.nodeShapes.makePolygon( points ).name;
  }

  return overlayShape;
};

export default BRp;
