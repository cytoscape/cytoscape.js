'use strict';

var memoize = require('./memoize');
var is = require('../is');

module.exports = {

  camel2dash: memoize( function( str ){
    return str.replace(/([A-Z])/g, function( v ){
      return '-' + v.toLowerCase();
    });
  } ),

  dash2camel: memoize( function( str ){
    return str.replace(/(-\w)/g, function( v ){
      return v[1].toUpperCase();
    });
  } ),

  capitalize: function(str){
    if( is.emptyString(str) ){
      return str;
    }

    return str.charAt(0).toUpperCase() + str.substring(1);
  }

};
