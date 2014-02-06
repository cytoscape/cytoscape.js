var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);

describe('Core initialisation', function(){

  it('does not add a node with the same ID as an earlier one', function(done){
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

  it('does not create an edge with bad source and target', function(done){
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

  it('does not create an edge with bad target', function(done){
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

  it('creates an edge that specifies good source and target', function(done){
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

  it('adds node with self as parent but as parentless node', function(done){
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

  it('breaks a parent cycle between two nodes', function(done){
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