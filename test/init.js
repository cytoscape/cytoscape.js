var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);

describe('Initialisation', function(){

  it('A node with the same ID as an earlier one is not added', function(done){
    cytoscape({
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
      elements: {
        edges: [ { data: { source: "n1", target: "n2" } } ]
      },
      ready: function(){
        var cy = this;

        expect( cy.elements().length ).to.equal(0);
        
        done();
      }
    });
  });

  it('An edge with bad target does not get created', function(done){
    cytoscape({
      elements: {
        nodes: [ { data: { id: "n1" } } ],
        edges: [ { data: { source: "n1", target: "n2" } } ]
      },
      ready: function(){
        var cy = this;

        expect( cy.edges().size() ).to.equal( 0 );
        expect( cy.nodes().size() ).to.equal( 1 );

        done();
      }
    });
  });

  it('An edge that specifies good source and target gets created', function(done){
    cytoscape({
      elements: {
        nodes: [ { data: { id: "n1" } }, { data: { id: "n2" } } ],
        edges: [ { data: { source: "n1", target: "n2" } } ]
      },
      ready: function(){
        var cy = this;

        expect( cy.edges().size() ).to.equal(1);
        expect( cy.nodes().size() ).to.equal(2);
        
        done();
      }
    });
  });

  it('A node with self as parent is added but is parentless', function(done){
    cytoscape({
      elements: {
        nodes: [ { data: { id: "n1", parent: "n1" } } ]
      },
      ready: function(){
        var cy = this;

        expect( cy.$("#n1").parent().size() ).to.equal(0);
        
        done();
      }
    });
  });

  it('A parent cycle between two nodes is broken when added', function(done){
    cytoscape({
      elements: {
        nodes: [
          { data: { id: "n1", parent: "n2" } },
          { data: { id: "n2", parent: "n1" } }
        ]
      },
      ready: function(){
        var cy = this;

        expect( cy.$("#n1").parent().parent().length ).to.equal(0);

        done();
      }
    });
  });

});