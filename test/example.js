var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape', cytoscape);

describe('Initialisation', function(){

  it('A node with the same ID as an earlier one is not added', function(done){
    cytoscape({
      renderer: {
        name: 'null'
      },
      layout: {
        name: 'null'
      },
      elements: {
        nodes: [
          { data: { id: 'n1', foo: 'one' } },
          { data: { id: 'n2', foo: 'two' } },
          { data: { id: 'n1', foo: 'what is this guy doing here' } }
        ]
      }, 
      ready: function(){
        var cy = this;

        expect( cy.elements().size() ).to.equal(2);
        expect( cy.$('#n1').data('foo') ).to.equal('one');
        
        done();
      }
    });
  });

  it('An edge with bad source and target does not get created', function(done){
    cytoscape({
      renderer: {
        name: "null"
      },
      layout: {
        name: "null"
      },
      elements: {
        edges: [ { data: { source: "n1", target: "n2" } } ]
      },
      ready: function(){
        ok( false, "Didn't get exception" );
        
        start();
      }
    });
  });


});