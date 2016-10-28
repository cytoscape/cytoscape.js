'use strict';

module.exports = [
  { name: 'breadthfirst', impl: require( './breadthfirst' ) },
  { name: 'circle', impl: require( './circle' ) },
  { name: 'concentric',impl: require( './concentric' ) },
  { name: 'cose', impl: require( './cose' ) },
  { name: 'grid', impl: require( './grid' ) },
  { name: 'null', impl: require( './null' ) },
  { name: 'preset', impl: require( './preset' ) },
  { name: 'random', impl: require( './random' ) }
];
