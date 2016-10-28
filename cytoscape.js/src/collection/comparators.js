'use strict';

var elesfn = ({
  allAre: function( selector ){
    return this.filter( selector ).length === this.length;
  },

  is: function( selector ){
    return this.filter( selector ).length > 0;
  },

  some: function( fn, thisArg ){
    for( var i = 0; i < this.length; i++ ){
      var ret = !thisArg ? fn( this[ i ], i, this ) : fn.apply( thisArg, [ this[ i ], i, this ] );

      if( ret ){
        return true;
      }
    }

    return false;
  },

  every: function( fn, thisArg ){
    for( var i = 0; i < this.length; i++ ){
      var ret = !thisArg ? fn( this[ i ], i, this ) : fn.apply( thisArg, [ this[ i ], i, this ] );

      if( !ret ){
        return false;
      }
    }

    return true;
  },

  same: function( collection ){
    collection = this.cy().collection( collection );

    // cheap extra check
    if( this.length !== collection.length ){
      return false;
    }

    return this.intersect( collection ).length === this.length;
  },

  anySame: function( collection ){
    collection = this.cy().collection( collection );

    return this.intersect( collection ).length > 0;
  },

  allAreNeighbors: function( collection ){
    collection = this.cy().collection( collection );

    return this.neighborhood().intersect( collection ).length === collection.length;
  }
});

elesfn.allAreNeighbours = elesfn.allAreNeighbors;

module.exports = elesfn;
