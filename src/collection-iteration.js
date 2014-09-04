;(function($$){ 'use strict';
  
  // Functions for iterating over collections
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  
  $$.fn.eles({
    each: function(fn){
      if( $$.is.fn(fn) ){
        for(var i = 0; i < this.length; i++){
          var ele = this[i];
          var ret = fn.apply( ele, [ i, ele ] );

          if( ret === false ){ break; } // exit each early on return false
        }
      }
      return this;
    },

    toArray: function(){
      var array = [];
      
      for(var i = 0; i < this.length; i++){
        array.push( this[i] );
      }
      
      return array;
    },

    slice: function(start, end){
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
      
      for(var i = start; i >= 0 && i < end && i < thisSize; i++){
        array.push( this[i] );
      }
      
      return new $$.Collection(this.cy(), array);
    },

    size: function(){
      return this.length;
    },

    eq: function(i){
      return this[i] || new $$.Collection( this.cy() );
    },

    empty: function(){
      return this.length === 0;
    },

    nonempty: function(){
      return !this.empty();
    },

    sort: function( sortFn ){
      if( !$$.is.fn( sortFn ) ){
        return this;
      }

      var cy = this.cy();      
      var sorted = this.toArray().sort( sortFn );

      return new $$.Collection(cy, sorted);
    },

    sortByZIndex: function(){
      return this.sort( $$.Collection.zIndexSort );
    },

    zDepth: function(){
      var ele = this[0];
      if( !ele ){ return undefined; }

      var _p = ele._private;
      var group = _p.group;

      if( group === 'nodes' ){
        return _p.data.parent ? ele.parents().size() : 0;
      } else {
        var src = _p.source;
        var tgt = _p.target;
        var srcDepth = src._private.data.parent ? src.parents().size() : 0;
        var tgtDepth = tgt._private.data.parent ? tgt.parents().size() : 0;

        return Math.max( srcDepth - 1, tgtDepth - 1, 0 ) + 0.5; // depth of deepest parent and just a bit above
      }
    }
  });

  $$.Collection.zIndexSort = function(a, b){
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
        return 1; // 'a' is a node, it should be drawn later       
      
      } else if( aIsEdge && bIsNode ){
        return -1; // 'a' is an edge, it should be drawn first

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
  
})( cytoscape );
