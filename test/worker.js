var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);
var $$ = cytoscape;

describe('Worker', function(){

  var cy;

  before(function(next){
    cy = cytoscape({
      ready: function(){
        next();
      }
    });
  });

  it('resolves a simple value', function( next ){
    var w = $$.Worker();

    w.run(function(){
      resolve( 3 );
    }).then(function( val ){
      expect( val ).to.equal(3);

      w.stop();

      next();
    });
  });

});