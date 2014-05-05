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
      return this[i];
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
    }
  });


  $$.Collection.zIndexSort = function(a, b) {
    var elementDepth = function(ele) {
      if (ele._private.group === 'nodes')
      {
        return ele._private.data.parent ? ele.parents().size() : 0;
      }
      else if (ele._private.group === 'edges')
      {
        var source = ele._private.source;
        var target = ele._private.target;

        var sourceDepth = source._private.data.parent ? source.parents().size() : 0;
        var targetDepth = target._private.data.parent ? target.parents().size() : 0;

        return Math.max(sourceDepth, targetDepth);
      }
      else
      {
        return 0;
      }
    };

    var result = a._private.style['z-index'].value - b._private.style['z-index'].value;

    var depthA = 0;
    var depthB = 0;

    // no need to calculate element depth if there is no compound node
    if ( a.cy().hasCompoundNodes() )
    {
      depthA = elementDepth(a);
      depthB = elementDepth(b);
    }

    // if both elements has same depth,
    // then edges should be drawn first
    if (depthA - depthB === 0)
    {
      // 'a' is a node, it should be drawn later
      if (a._private.group === 'nodes'
        && b._private.group === 'edges')
      {
        return 1;
      }
      
      // 'a' is an edge, it should be drawn first
      else if (a._private.group === 'edges'
        && b._private.group === 'nodes')
      {
        return -1;
      }

      // both nodes or both edges
      else
      {
        if( result === 0 ){ // same z-index => compare indices in the core (order added to graph w/ last on top)
          return a._private.index - b._private.index;
        } else {
          return result;
        }
      }
    }

    // elements on different level
    else
    {
      // deeper element should be drawn later
      return depthA - depthB;
    }

    // return zero if z-index values are not the same
    return 0;
  };
  
})( cytoscape );
