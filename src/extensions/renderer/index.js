'use strict';

module.exports = [
  'null'
].map(function( name ){
  var path = './' + name;
  var impl = require( path );

  return {
    name: name,
    impl: impl
  };
});
