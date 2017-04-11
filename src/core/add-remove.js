'use strict';

var is = require( '../is' );
var util = require( '../util' );
var Collection = require( '../collection' );
var Element = require( '../collection/element' );

var corefn = {
  add: function( opts ){

    var elements;
    var cy = this;

    // add the elements
    if( is.elementOrCollection( opts ) ){
      var eles = opts;

      if( eles._private.cy === cy ){ // same instance => just restore
        elements = eles.restore();

      } else { // otherwise, copy from json
        var jsons = [];

        for( var i = 0; i < eles.length; i++ ){
          var ele = eles[ i ];
          jsons.push( ele.json() );
        }

        elements = new Collection( cy, jsons );
      }
    }

    // specify an array of options
    else if( is.array( opts ) ){
      var jsons = opts;

      elements = new Collection( cy, jsons );
    }

    // specify via opts.nodes and opts.edges
    else if( is.plainObject( opts ) && (is.array( opts.nodes ) || is.array( opts.edges )) ){
      var elesByGroup = opts;
      var jsons = [];

      var grs = [ 'nodes', 'edges' ];
      for( var i = 0, il = grs.length; i < il; i++ ){
        var group = grs[ i ];
        var elesArray = elesByGroup[ group ];

        if( is.array( elesArray ) ){

          for( var j = 0, jl = elesArray.length; j < jl; j++ ){
            var json = util.extend( { group: group }, elesArray[ j ] );

            jsons.push( json );
          }
        }
      }

      elements = new Collection( cy, jsons );
    }

    // specify options for one element
    else {
      var json = opts;
      elements = (new Element( cy, json )).collection();
    }

    return elements;
  },

  remove: function( collection ){
    if( is.elementOrCollection( collection ) ){
      // already have right ref
    } else if( is.string( collection ) ){
      var selector = collection;
      collection = this.$( selector );
    }

    return collection.remove();
  }
};

module.exports = corefn;
