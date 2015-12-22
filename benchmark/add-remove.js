var Suite = require('./suite');
var suite = new Suite('cy.add(); ... cy.remove();');

suite
  .add( function( cy ){
    var N = 1000;
    var eles = [];

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
    }

    cy.add( eles );

    cy.elements().remove();
  } )
;

module.exports = suite;
