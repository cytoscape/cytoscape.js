let is = require( '../is' );
let Selector = require( '../selector' );

let elesfn = ({
  nodes: function( selector ){
    return this.filter( ele => ele.isNode() ).filter( selector );
  },

  edges: function( selector ){
    return this.filter( ele => ele.isEdge() ).filter( selector );
  },

  filter: function( filter, thisArg ){
    if( filter === undefined ){ // check this first b/c it's the most common/performant case
      return this;
    } else if( is.string( filter ) || is.elementOrCollection( filter ) ){
      return new Selector( filter ).filter( this );
    } else if( is.fn( filter ) ){
      let filterEles = this.spawn();
      let eles = this;

      for( let i = 0; i < eles.length; i++ ){
        let ele = eles[ i ];
        let include = thisArg ? filter.apply( thisArg, [ ele, i, eles ] ) : filter( ele, i, eles );

        if( include ){
          filterEles.merge( ele );
        }
      }

      return filterEles;
    }

    return this.spawn(); // if not handled by above, give 'em an empty collection
  },

  not: function( toRemove ){
    if( !toRemove ){
      return this;
    } else {

      if( is.string( toRemove ) ){
        toRemove = this.filter( toRemove );
      }

      let elements = [];
      let rMap = toRemove._private.map;

      for( let i = 0; i < this.length; i++ ){
        let element = this[ i ];

        let remove = rMap.has( element.id() );
        if( !remove ){
          elements.push( element );
        }
      }

      return this.spawn( elements );
    }

  },

  absoluteComplement: function(){
    let cy = this.cy();

    return cy.mutableElements().not( this );
  },

  intersect: function( other ){
    // if a selector is specified, then filter by it instead
    if( is.string( other ) ){
      let selector = other;
      return this.filter( selector );
    }

    let elements = [];
    let col1 = this;
    let col2 = other;
    let col1Smaller = this.length < other.length;
    let map2 = col1Smaller ? col2._private.map : col1._private.map;
    let col = col1Smaller ? col1 : col2;

    for( let i = 0; i < col.length; i++ ){
      let id = col[ i ]._private.data.id;
      let entry = map2.get( id );

      if( entry ){
        elements.push( entry.ele );
      }
    }

    return this.spawn( elements );
  },

  xor: function( other ){
    let cy = this._private.cy;

    if( is.string( other ) ){
      other = cy.$( other );
    }

    let elements = [];
    let col1 = this;
    let col2 = other;

    let add = function( col, other ){
      for( let i = 0; i < col.length; i++ ){
        let ele = col[ i ];
        let id = ele._private.data.id;
        let inOther = other.hasElementWithId( id );

        if( !inOther ){
          elements.push( ele );
        }
      }

    };

    add( col1, col2 );
    add( col2, col1 );

    return this.spawn( elements );
  },

  diff: function( other ){
    let cy = this._private.cy;

    if( is.string( other ) ){
      other = cy.$( other );
    }

    let left = [];
    let right = [];
    let both = [];
    let col1 = this;
    let col2 = other;

    let add = function( col, other, retEles ){

      for( let i = 0; i < col.length; i++ ){
        let ele = col[ i ];
        let id = ele._private.data.id;
        let inOther = other.hasElementWithId( id );

        if( inOther ){
          both.push( ele );
        } else {
          retEles.push( ele );
        }
      }

    };

    add( col1, col2, left );
    add( col2, col1, right );

    return {
      left: this.spawn( left, { unique: true } ),
      right: this.spawn( right, { unique: true } ),
      both: this.spawn( both, { unique: true } )
    };
  },

  add: function( toAdd ){
    let cy = this._private.cy;

    if( !toAdd ){
      return this;
    }

    if( is.string( toAdd ) ){
      let selector = toAdd;
      toAdd = cy.mutableElements().filter( selector );
    }

    let elements = [];

    for( let i = 0; i < this.length; i++ ){
      elements.push( this[ i ] );
    }

    let map = this._private.map;

    for( let i = 0; i < toAdd.length; i++ ){

      let add = !map.has( toAdd[ i ].id() );
      if( add ){
        elements.push( toAdd[ i ] );
      }
    }

    return this.spawn( elements );
  },

  // in place merge on calling collection
  merge: function( toAdd ){
    let _p = this._private;
    let cy = _p.cy;

    if( !toAdd ){
      return this;
    }

    if( toAdd && is.string( toAdd ) ){
      let selector = toAdd;
      toAdd = cy.mutableElements().filter( selector );
    }

    let map = _p.map;

    for( let i = 0; i < toAdd.length; i++ ){
      let toAddEle = toAdd[ i ];
      let id = toAddEle._private.data.id;
      let add = !map.has( id );

      if( add ){
        let index = this.length++;

        this[ index ] = toAddEle;

        map.set( id, { ele: toAddEle, index: index } );
      } else { // replace
        let index = map.get( id ).index;

        this[ index ] = toAddEle;
        map.set( id, { ele: toAddEle, index: index } );
      }
    }

    return this; // chaining
  },

  // remove single ele in place in calling collection
  unmergeOne: function( ele ){
    ele = ele[0];

    let _p = this._private;
    let id = ele._private.data.id;
    let map = _p.map;
    let entry =  map.get( id );

    if( !entry ){
      return this; // no need to remove
    }

    let i = entry.index;

    // remove ele
    this[ i ] = undefined;
    map.delete( id );

    let unmergedLastEle = i === this.length - 1;

    // replace empty spot with last ele in collection
    if( this.length > 1 && !unmergedLastEle ){
      let lastEleI = this.length - 1;
      let lastEle = this[ lastEleI ];
      let lastEleId = lastEle._private.data.id;

      this[ lastEleI ] = undefined;
      this[ i ] = lastEle;
      map.set( lastEleId, { ele: lastEle, index: i } );
    }

    // the collection is now 1 ele smaller
    this.length--;

    return this;
  },

  // remove eles in place on calling collection
  unmerge: function( toRemove ){
    let cy = this._private.cy;

    if( !toRemove ){
      return this;
    }

    if( toRemove && is.string( toRemove ) ){
      let selector = toRemove;
      toRemove = cy.mutableElements().filter( selector );
    }

    for( let i = 0; i < toRemove.length; i++ ){
      this.unmergeOne( toRemove[ i ] );
    }

    return this; // chaining
  },

  map: function( mapFn, thisArg ){
    let arr = [];
    let eles = this;

    for( let i = 0; i < eles.length; i++ ){
      let ele = eles[ i ];
      let ret = thisArg ? mapFn.apply( thisArg, [ ele, i, eles ] ) : mapFn( ele, i, eles );

      arr.push( ret );
    }

    return arr;
  },

  reduce: function( fn, initialValue ){
    let val = initialValue;
    let eles = this;

    for( let i = 0; i < eles.length; i++ ){
      val = fn( val, eles[i], i, eles );
    }

    return val;
  },

  max: function( valFn, thisArg ){
    let max = -Infinity;
    let maxEle;
    let eles = this;

    for( let i = 0; i < eles.length; i++ ){
      let ele = eles[ i ];
      let val = thisArg ? valFn.apply( thisArg, [ ele, i, eles ] ) : valFn( ele, i, eles );

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
    let min = Infinity;
    let minEle;
    let eles = this;

    for( let i = 0; i < eles.length; i++ ){
      let ele = eles[ i ];
      let val = thisArg ? valFn.apply( thisArg, [ ele, i, eles ] ) : valFn( ele, i, eles );

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

// aliases
let fn = elesfn;
fn[ 'u' ] = fn[ '|' ] = fn[ '+' ] = fn.union = fn.or = fn.add;
fn[ '\\' ] = fn[ '!' ] = fn[ '-' ] = fn.difference = fn.relativeComplement = fn.subtract = fn.not;
fn[ 'n' ] = fn[ '&' ] = fn[ '.' ] = fn.and = fn.intersection = fn.intersect;
fn[ '^' ] = fn[ '(+)' ] = fn[ '(-)' ] = fn.symmetricDifference = fn.symdiff = fn.xor;
fn.fnFilter = fn.filterFn = fn.stdFilter = fn.filter;
fn.complement = fn.abscomp = fn.absoluteComplement;

module.exports = elesfn;
