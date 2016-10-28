'use strict';

var is = require( '../is' );

module.exports = {
  // has anything been set in the map
  mapEmpty: function( map ){
    var empty = true;

    if( map != null ){
      return Object.keys( map ).length === 0;
    }

    return empty;
  },

  // pushes to the array at the end of a map (map may not be built)
  pushMap: function( options ){
    var array = this.getMap( options );

    if( array == null ){ // if empty, put initial array
      this.setMap( this.extend( {}, options, {
        value: [ options.value ]
      } ) );
    } else {
      array.push( options.value );
    }
  },

  // sets the value in a map (map may not be built)
  setMap: function( options ){
    var obj = options.map;
    var key;
    var keys = options.keys;
    var l = keys.length;

    for( var i = 0; i < l; i++ ){
      var key = keys[ i ];

      if( is.plainObject( key ) ){
        this.error( 'Tried to set map with object key' );
      }

      if( i < keys.length - 1 ){

        // extend the map if necessary
        if( obj[ key ] == null ){
          obj[ key ] = {};
        }

        obj = obj[ key ];
      } else {
        // set the value
        obj[ key ] = options.value;
      }
    }
  },

  // gets the value in a map even if it's not built in places
  getMap: function( options ){
    var obj = options.map;
    var keys = options.keys;
    var l = keys.length;

    for( var i = 0; i < l; i++ ){
      var key = keys[ i ];

      if( is.plainObject( key ) ){
        this.error( 'Tried to get map with object key' );
      }

      obj = obj[ key ];

      if( obj == null ){
        return obj;
      }
    }

    return obj;
  },

  // deletes the entry in the map
  deleteMap: function( options ){
    var obj = options.map;
    var keys = options.keys;
    var l = keys.length;
    var keepChildren = options.keepChildren;

    for( var i = 0; i < l; i++ ){
      var key = keys[ i ];

      if( is.plainObject( key ) ){
        this.error( 'Tried to delete map with object key' );
      }

      var lastKey = i === options.keys.length - 1;
      if( lastKey ){

        if( keepChildren ){ // then only delete child fields not in keepChildren
          var children = Object.keys( obj );

          for( var j = 0; j < children.length; j++ ){
            var child = children[j];

            if( !keepChildren[ child ] ){
              obj[ child ] = undefined;
            }
          }
        } else {
          obj[ key ] = undefined;
        }

      } else {
        obj = obj[ key ];
      }
    }
  }
};
