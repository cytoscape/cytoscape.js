var Benchmark = require('benchmark');
var newCytoscape = require('../../build/cytoscape.js');
var oldCytoscape = require('./cytoscape.js');

function Suite( name, opts ){
  var suite = new Benchmark.Suite( name, opts );
  var suiteAdd = suite.add;
  var oldCy, newCy;

  opts = opts || {};

  if( opts.setup ){
    oldCy = opts.setup( oldCytoscape );
  } else {
    oldCy = oldCytoscape();
  }

  if( opts.setup ){
    newCy = opts.setup( newCytoscape );
  } else {
    newCy = newCytoscape();
  }

  suite.add = function( fn, addOpts ){
    suiteAdd.apply( suite, [name + '::old', function(){ return fn(oldCy); }, addOpts ] );

    suiteAdd.apply( suite, [name + '::new', function(){ return fn(newCy); }, addOpts ] );

    return this; // chaining
  };

  return suite;
}

module.exports = Suite;
