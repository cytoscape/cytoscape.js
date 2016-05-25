'use strict';

var zIndexSort = function( a, b ){
  var cy = a.cy();
  var a_p = a._private;
  var b_p = b._private;
  var zDiff = a_p.style['z-index'].value - b_p.style['z-index'].value;
  var depthA = 0;
  var depthB = 0;
  var hasCompoundNodes = cy.hasCompoundNodes();
  var aIsNode = a_p.group === 'nodes';
  var aIsEdge = a_p.group === 'edges';
  var bIsNode = b_p.group === 'nodes';
  var bIsEdge = b_p.group === 'edges';

  // no need to calculate element depth if there is no compound node
  if( hasCompoundNodes ){
    depthA = a.zDepth();
    depthB = b.zDepth();
  }

  var depthDiff = depthA - depthB;
  var sameDepth = depthDiff === 0;

  if( sameDepth ){

    if( aIsNode && bIsEdge ){
      if( cy.zorderStrict() && zDiff !== 0 ) {
        return zDiff;  // 'z-index' specified
      } else {
        return 1; // 'a' is a node, it should be drawn later
      }

    } else if( aIsEdge && bIsNode ){
      if( cy.zorderStrict() && zDiff !== 0 ) {
        return zDiff;  // 'z-index' specified
      } else {
        return -1; // 'a' is an edge, it should be drawn first
      }

    } else { // both nodes or both edges
      if( zDiff === 0 ){ // same z-index => compare indices in the core (order added to graph w/ last on top)
        return a_p.index - b_p.index;
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
