var Benchmark = require('benchmark');
var newCytoscape = require('../../src/index.js');
var oldCytoscape = require('./cytoscape.js');

global.newCytoscape = newCytoscape;
global.oldCytoscape = oldCytoscape;

function Suite( name, suiteOpts ){
  var suite = new Benchmark.Suite( name, suiteOpts );
  var suiteAdd = suite.add;

  suite.add = function( fn, opts ){
    var opts = global.opts = opts || {};

    global.setup = opts.setup || function( cytoscape ){
      return oldCytoscape();
    };

    global.teardown = opts.teardown || function( cy ){
      if( cy.destroy ){ cy.destroy(); }
    };

    global.fn = fn;

    suiteAdd.apply( suite, [ name + '::old', function(){ return fn( cy ); }, {
      setup: function(){
        global.cy = setup( oldCytoscape );
      },
      teardown: function(){
        teardown( cy );
      }
    } ] );

    suiteAdd.apply( suite, [ name + '::new', function(){ return fn( cy ); }, {
      setup: function(){
        global.cy = setup( newCytoscape );
      },
      teardown: function(){
        teardown( cy );
      }
    } ] );

    return this; // chaining
  };

  return suite;
}

module.exports = Suite;
