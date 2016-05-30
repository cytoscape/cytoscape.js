'use strict';

module.exports = [
  {
    type: 'layout',
    extensions: require( './layout' )
  },

  {
    type: 'renderer',
    extensions: require( './renderer' )
  }
];
