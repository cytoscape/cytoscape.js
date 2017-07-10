let is = require('../is');
let Selector = require('../selector');

let elesfn = ({
  allAre: function( selector ){
    let selObj = new Selector( selector );

    return this.every(function( ele ){
      return selObj.matches( ele );
    });
  },

  is: function( selector ){
    let selObj = new Selector( selector );

    return this.some(function( ele ){
      return selObj.matches( ele );
    });
  },

  some: function( fn, thisArg ){
    for( let i = 0; i < this.length; i++ ){
      let ret = !thisArg ? fn( this[ i ], i, this ) : fn.apply( thisArg, [ this[ i ], i, this ] );

      if( ret ){
        return true;
      }
    }

    return false;
  },

  every: function( fn, thisArg ){
    for( let i = 0; i < this.length; i++ ){
      let ret = !thisArg ? fn( this[ i ], i, this ) : fn.apply( thisArg, [ this[ i ], i, this ] );

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

    return this.every(function( ele ){
      return collection.hasElementWithId( ele.id() );
    });
  },

  anySame: function( collection ){
    collection = this.cy().collection( collection );

    return this.some(function( ele ){
      return collection.hasElementWithId( ele.id() );
    });
  },

  allAreNeighbors: function( collection ){
    collection = this.cy().collection( collection );

    let nhood = this.neighborhood();

    return collection.every(function( ele ){
      return nhood.hasElementWithId( ele.id() );
    });
  },

  contains: function( collection ){
    collection = this.cy().collection( collection );

    let self = this;

    return collection.every(function( ele ){
      return self.hasElementWithId( ele.id() );
    });
  }
});

elesfn.allAreNeighbours = elesfn.allAreNeighbors;
elesfn.has = elesfn.contains;

module.exports = elesfn;
