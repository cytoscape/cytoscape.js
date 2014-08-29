;(function($$){ 'use strict';

  $$.fn.eles({
    nodes: function( selector ){
      return this.filter(function(i, element){
        return element.isNode();
      }).filter(selector);
    },

    edges: function( selector ){
      return this.filter(function(i, element){
        return element.isEdge();
      }).filter(selector);
    },

    filter: function( filter ){
      var cy = this._private.cy;
      
      if( $$.is.fn(filter) ){
        var elements = [];

        for( var i = 0; i < this.length; i++ ){
          var ele = this[i];

          if( filter.apply(ele, [i, ele]) ){
            elements.push(ele);
          }
        }
        
        return new $$.Collection(cy, elements);
      
      } else if( $$.is.string(filter) || $$.is.elementOrCollection(filter) ){
        return new $$.Selector(filter).filter(this);
      
      } else if( filter === undefined ){
        return this;
      }

      return new $$.Collection( cy ); // if not handled by above, give 'em an empty collection
    },

    not: function( toRemove ){
      var cy = this._private.cy;

      if( !toRemove ){
        return this;
      } else {
      
        if( $$.is.string( toRemove ) ){
          toRemove = this.filter( toRemove );
        }
        
        var elements = [];
        
        for( var i = 0; i < this.length; i++ ){
          var element = this[i];

          var remove = toRemove._private.ids[ element.id() ];
          if( !remove ){
            elements.push( element );
          }
        }
        
        return new $$.Collection( cy, elements );
      }
      
    },

    intersect: function( other ){
      var cy = this._private.cy;
      
      // if a selector is specified, then filter by it instead
      if( $$.is.string(other) ){
        var selector = other;
        return this.filter( selector );
      }
      
      var elements = [];
      var col1 = this;
      var col2 = other;
      var col1Smaller = this.length < other.length;
      var ids1 = col1Smaller ? col1._private.ids : col2._private.ids;
      var ids2 = col1Smaller ? col2._private.ids : col1._private.ids;
      var col = col1Smaller ? col1 : col2;
      
      for( var i = 0; i < col.length; i++ ){
        var id = col[i]._private.data.id;
        var ele = ids2[ id ];

        if( ele ){
          elements.push( ele );
        }
      }
      
      return new $$.Collection( cy, elements );
    },

    add: function( toAdd ){
      var cy = this._private.cy;    
      
      if( !toAdd ){
        return this;
      }
      
      if( $$.is.string(toAdd) ){
        var selector = toAdd;
        toAdd = cy.elements(selector);
      }
      
      var elements = [];

      for( var i = 0; i < this.length; i++ ){
        elements.push( this[i] );
      }

      for( var i = 0; i < toAdd.length; i++ ){

        var add = !this._private.ids[ toAdd[i].id() ];
        if( add ){
          elements.push( toAdd[i] );
        }
      }
      
      return new $$.Collection(cy, elements);
    },

    // in place merge on calling collection
    merge: function( toAdd ){
      var _p = this._private;
      var cy = _p.cy;    
      
      if( !toAdd ){
        return this;
      }
      
      if( $$.is.string(toAdd) ){
        var selector = toAdd;
        toAdd = cy.elements(selector);
      }

      for( var i = 0; i < toAdd.length; i++ ){
        var toAddEle = toAdd[i];
        var id = toAddEle.id();
        var add = !_p.ids[ id ];

        if( add ){
          var index = this.length++;

          this[ index ] = toAddEle;
          _p.ids[ id ] = toAddEle;
          _p.indexes[ id ] = index;
        }
      }
      
      return this; // chaining
    },

    // remove single ele in place in calling collection
    unmergeOne: function( ele ){
      ele = ele[0];

      var _p = this._private;
      var id = ele.id();
      var i = _p.indexes[ id ];

      if( i == null ){
        return this; // no need to remove
      }

      // remove ele
      this[i] = undefined;
      _p.ids[ id ] = undefined;
      _p.indexes[ id ] = undefined;

      var unmergedLastEle = i === this.length - 1;

      // replace empty spot with last ele in collection
      if( this.length > 1 && !unmergedLastEle ){
        var lastEleI = this.length - 1;
        var lastEle = this[ lastEleI ];

        this[ lastEleI ] = undefined;
        this[i] = lastEle;
        _p.indexes[ lastEle.id() ] = i;
      }

      // the collection is now 1 ele smaller
      this.length--;

      return this;
    },

    // remove eles in place on calling collection
    unmerge: function( toRemove ){
      var cy = this._private.cy;    
      
      if( !toRemove ){
        return this;
      }

      if( $$.is.string(toRemove) ){
        var selector = toRemove;
        toRemove = cy.elements(selector);
      }

      for( var i = 0; i < toRemove.length; i++ ){
        this.unmergeOne( toRemove[i] );
      }
      
      return this; // chaining
    },

    map: function( mapFn, thisArg ){
      var arr = [];
      var eles = this;

      for( var i = 0; i < eles.length; i++ ){
        var ele = eles[i];
        var ret = mapFn.apply( thisArg, [ele, i, eles] );

        arr.push( ret );
      }

      return arr;
    },

    stdFilter: function( fn, thisArg ){
      var filterEles = [];
      var eles = this;
      var cy = this._private.cy;

      for( var i = 0; i < eles.length; i++ ){
        var ele = eles[i];
        var include = fn.apply( thisArg, [ele, i, eles] );

        if( include ){
          filterEles.push( ele );
        }
      }

      return new $$.Collection( cy, filterEles );
    },

    max: function( valFn, thisArg ){
      var max = -Infinity;
      var maxEle;
      var eles = this;

      for( var i = 0; i < eles.length; i++ ){
        var ele = eles[i];
        var val = valFn.apply( thisArg, [ ele, i, eles ] );

        if( val > max ){
          max = val;
          maxEle = ele;
        }
      }

      return {
        value: max,
        ele: maxEle
      };
    },

    min: function( valFn, thisArg ){
      var min = Infinity;
      var minEle;
      var eles = this;

      for( var i = 0; i < eles.length; i++ ){
        var ele = eles[i];
        var val = valFn.apply( thisArg, [ ele, i, eles ] );

        if( val < min ){
          min = val;
          minEle = ele;
        }
      }

      return {
        value: min,
        ele: minEle
      };
    }
  });
  
})( cytoscape );