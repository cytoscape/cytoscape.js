'use strict';

var is = require( '../is' );
var zIndexSort = require( './zsort' );

var elesfn = ({
  each: function( fn ){
    if( is.fn( fn ) ){
      for( var i = 0; i < this.length; i++ ){
        var ele = this[ i ];
        var ret = fn.apply( ele, [ i, ele ] );

        if( ret === false ){ break; } // exit each early on return false
      }
    }
    return this;
  },

  forEach: function( fn, thisArg ){
    if( is.fn( fn ) ){

      for( var i = 0; i < this.length; i++ ){
        var ele = this[ i ];
        var ret = thisArg ? fn.apply( thisArg, [ ele, i, this ] ) : fn( ele, i, this );

        if( ret === false ){ break; } // exit each early on return false
      }
    }

    return this;
  },

  toArray: function(){
    var array = [];

    for( var i = 0; i < this.length; i++ ){
      array.push( this[ i ] );
    }

    return array;
  },

  slice: function( start, end ){
    var array = [];
    var thisSize = this.length;

    if( end == null ){
      end = thisSize;
    }

    if( start == null ){
      start = 0;
    }

    if( start < 0 ){
      start = thisSize + start;
    }

    if( end < 0 ){
      end = thisSize + end;
    }

    for( var i = start; i >= 0 && i < end && i < thisSize; i++ ){
      array.push( this[ i ] );
    }

    return this.spawn( array );
  },

  size: function(){
    return this.length;
  },

  eq: function( i ){
    return this[ i ] || this.spawn();
  },

  first: function(){
    return this[0] || this.spawn();
  },

  last: function(){
    return this[ this.length - 1 ] || this.spawn();
  },

  empty: function(){
    return this.length === 0;
  },

  nonempty: function(){
    return !this.empty();
  },

  sort: function( sortFn ){
    if( !is.fn( sortFn ) ){
      return this;
    }

    var sorted = this.toArray().sort( sortFn );

    return this.spawn( sorted );
  },

  sortByZIndex: function(){
    return this.sort( zIndexSort );
  },

  zDepth: function(){
    var ele = this[0];
    if( !ele ){ return undefined; }

    // var cy = ele.cy();
    var _p = ele._private;
    var group = _p.group;

    if( group === 'nodes' ){
      var depth = _p.data.parent ? ele.parents().size() : 0;

      if( !ele.isParent() ){
        return Number.MAX_VALUE; // childless nodes always on top
      }

      return depth;
    } else {
      var src = _p.source;
      var tgt = _p.target;
      var srcDepth = src.zDepth();
      var tgtDepth = tgt.zDepth();

      return Math.max( srcDepth, tgtDepth, 0 ); // depth of deepest parent
    }
  }
});

module.exports = elesfn;
