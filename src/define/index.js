// use this module to cherry pick functions into your prototype
// (useful for functions shared between the core and collections, for example)

// e.g.
// let foo = define.foo({ /* params... */ })

let util = require('../util');

let define = {};

[
  require('./animation'),
  require('./data'),
  require('./events')
].forEach(function( m ){
  util.assign( define, m );
});

module.exports = define;
