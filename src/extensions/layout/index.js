'use strict';

module.exports = [
  'arbor',
  'breadthfirst',
  'circle',
  'cola',
  'concentric',
  //'cose2', // TODO refactor
  'cose',
  'dagre',
  'grid',
  'null',
  'preset',
  'random',
  //'spread', // TODO threads
  'springy'
].map(function( name ){
  var path = './' + name;
  var impl = require( path );

  return {
    name: name,
    impl: impl
  };
});
