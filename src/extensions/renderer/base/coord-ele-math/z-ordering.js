var zIndexSort = require( '../../../../collection/zsort' );

var BRp = {};

BRp.updateCachedGrabbedEles = function(){
  var eles = this.cachedZSortedEles;

  if( !eles ){
    // just let this be recalculated on the next z sort tick
    return;
  }

  eles.drag = [];
  eles.nondrag = [];

  var grabTargets = [];

  for( var i = 0; i < eles.length; i++ ){
    var ele = eles[i];
    var rs = ele._private.rscratch;

    if( ele.grabbed() && !ele.isParent() ){
      grabTargets.push( ele );
    } else if( rs.inDragLayer ){
      eles.drag.push( ele );
    } else {
      eles.nondrag.push( ele );
    }
  }

  // put the grab target nodes last so it's on top of its neighbourhood
  for( var i = 0; i < grabTargets.length; i++ ){
    var ele = grabTargets[i];

    eles.drag.push( ele );
  }
};

BRp.invalidateCachedZSortedEles = function(){
  this.cachedZSortedEles = null;
};

BRp.getCachedZSortedEles = function( forceRecalc ){
  if( forceRecalc || !this.cachedZSortedEles ){
    //console.time('cachezorder')

    var eles = this.cy.mutableElements().toArray();

    eles.sort( zIndexSort );

    eles.interactive = eles.filter(function( ele ){
      return ele.interactive();
    });

    this.cachedZSortedEles = eles;

    this.updateCachedGrabbedEles();
  } else {
    eles = this.cachedZSortedEles;
  }

  return eles;
};

module.exports = BRp
