var Suite = require('./suite');
var suite = new Suite('cy.add()');

var eles = [];
var N = 100;

for( var i = 0; i < N; i++ ){
  eles.push({
    group: 'nodes',
    data: { id: 'node-'+i }
  });

  if( i >= 1 ){
    eles.push({
      group: 'edges',
      data: { source: 'node-'+(i-1), target: 'node-'+(i) }
    });
  }
};

global.elesJson = JSON.stringify( eles );

suite
  .add( function( cy ){
    cy.add( eles );
  }, {
    setup: function( cytoscape ){
      global.eles = JSON.parse( elesJson );

      return cytoscape();
    }
  } )
;

module.exports = suite;
