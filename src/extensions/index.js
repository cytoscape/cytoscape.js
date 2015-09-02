'use strict';

module.exports = [
  'layout',
  'renderer'
].map(function( type ){
  return {
    type: type,
    extensions: require('./' + type)
  };
});
