var Benchmark = require('benchmark');
var newCytoscape = require('../../build/cytoscape.cjs');
var oldCytoscape = require('../../build/cytoscape.benchmark.js');

global.newCytoscape = newCytoscape;
global.oldCytoscape = oldCytoscape;

function Suite( name, suiteOpts ){
  suiteOpts = suiteOpts || {};

  var suite = new Benchmark.Suite( name, suiteOpts );
  var suiteAdd = suite.add;

  suite.on('start', function(){
    console.log('Starting benchmark:', suite.name);
  });

  suite.on('cycle', function(event) {
    console.log(String(event.target));
  });

  suite.on('complete', function(){
    console.log( 'Fastest is:' ,this.filter('fastest').map('name')[0] );
  });

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
