'use strict';

var memoize = require('./memoize');
var is = require('../is');

module.exports = {

  camel2dash: memoize( function( str ){
    var ret = [];

    for( var i = 0; i < str.length; i++ ){
      var ch = str[i];
      var chLowerCase = ch.toLowerCase();
      var isUpperCase = ch !== chLowerCase;

      if( isUpperCase ){
        ret.push( '-' );
        ret.push( chLowerCase );
      } else {
        ret.push( ch );
      }
    }

    var noUpperCases = ret.length === str.length;
    if( noUpperCases ){ return str; } // cheaper than .join()

    return ret.join('');
  } ),

  dash2camel: memoize( function( str ){
    var ret = [];
    var nextIsUpper = false;

    for( var i = 0; i < str.length; i++ ){
      var ch = str[i];
      var isDash = ch === '-';

      if( isDash ){
        nextIsUpper = true;
      } else {
        if( nextIsUpper ){
          ret.push( ch.toUpperCase() );
        } else {
          ret.push( ch );
        }

        nextIsUpper = false;
      }
    }

    return ret.join('');
  } ),

  capitalize: function(str){
    if( is.emptyString(str) ){
      return str;
    }

    return str.charAt(0).toUpperCase() + str.substring(1);
  }

}
