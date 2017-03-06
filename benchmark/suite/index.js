var Benchmark = require('benchmark');
var newCytoscape = require('../../src/index.js');
var oldCytoscape = require('./cytoscape.js');

global.newCytoscape = newCytoscape;
global.oldCytoscape = oldCytoscape;

function Suite( name, suiteOpts ){
  suiteOpts = suiteOpts || {};

  var suite = new Benchmark.Suite( name, suiteOpts );
  var suiteAdd = suite.add;

  suite.add = function( fn ){
    global.setup = suiteOpts.setup || function( cytoscape ){
      return cytoscape();
    };

    global.teardown = suiteOpts.teardown || function( cy ){
      if( cy && cy.destroy ){ cy.destroy(); }
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
