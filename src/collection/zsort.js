'use strict';

var zIndexSort = function( a, b ){
  var cy = a.cy();
  var zDiff = a.pstyle( 'z-index' ).value - b.pstyle( 'z-index' ).value;
  var depthA = 0;
  var depthB = 0;
  var hasCompoundNodes = cy.hasCompoundNodes();
  var aIsNode = a.isNode();
  var aIsEdge = !aIsNode;
  var bIsNode = b.isNode();
  var bIsEdge = !bIsNode;

  // no need to calculate element depth if there is no compound node
  if( hasCompoundNodes ){
    depthA = a.zDepth();
    depthB = b.zDepth();
  }

  var depthDiff = depthA - depthB;
  var sameDepth = depthDiff === 0;

  if( sameDepth ){

    if( aIsNode && bIsEdge ){
      return 1; // 'a' is a node, it should be drawn later

    } else if( aIsEdge && bIsNode ){
      return -1; // 'a' is an edge, it should be drawn first

    } else { // both nodes or both edges
      if( zDiff === 0 ){ // same z-index => compare indices in the core (order added to graph w/ last on top)
        return a.poolIndex() - b.poolIndex();
      } else {
        return zDiff;
      }
    }

  // elements on different level
  } else {
    return depthDiff; // deeper element should be drawn later
  }

};

module.exports = zIndexSort;
