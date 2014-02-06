var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);

describe('Core graph manipulation', function(){

  var cy;

  // test setup
  beforeEach(function(done){
    cytoscape({
      elements: {
        nodes: [
            { data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
            { data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
            { data: { id: "n3", foo: "three", weight: 0.75 }, classes: "odd three" }
        ],
        
        edges: [
            { data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
            { data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
        ]
      },
      ready: function(){
        cy = this;

        done();
      }
    });
  });

  describe('eles.add()', function(){

    it('adds via single object', function(){

      cy.add({
        group: 'nodes',
        data: { id: 'new-node' }
      });

      expect( cy.$('#new-node') ).to.have.length(1);
      expect( cy.nodes() ).to.have.length(4);

    });

    it('adds via array of objects', function(){

      cy.add([
        {
          group: 'edges',
          data: { id: 'new-edge', source: 'n1', target: 'new-node' }
        },

        {
          group: 'nodes',
          data: { id: 'new-node' }
        }
      ]);

      expect( cy.$('#new-node') ).to.have.length(1);
      expect( cy.$('#new-node').inside() ).to.be.true;
      expect( cy.$('#new-edge') ).to.have.length(1);
      expect( cy.$('#new-edge').inside() ).to.be.true;

    });

    it('adds via collection', function(){

      var edges = cy.$('edge').remove();

      cy.add( edges );

      expect( cy.$('#n1n2') ).to.have.length(1);
      expect( cy.$('#n1n2').inside() ).to.be.true;
      expect( cy.$('#n2n3') ).to.have.length(1);
      expect( cy.$('#n2n3').inside() ).to.be.true;

    });

  });

  describe('eles.remove()', function(){

    it('removes a single node', function(){
      var n1 = cy.$('#n1').remove();
      
      expect( cy.nodes() ).to.have.length(2);
      expect( cy.$('#n2') ).to.have.length(1);
      expect( cy.$('#n3') ).to.have.length(1);
      expect( n1.removed() ).to.be.true;
      expect( cy.$('#n1') ).to.have.length(0);

    });

    it('correctly removes an edge repeatedly', function(){
      var n1n2 = cy.$('#n1n2');
      
      for( var i = 0; i < 10; i++ ){
        n1n2.remove();

        expect( cy.edges() ).to.have.length(1);
        expect( cy.$('#n1') ).to.have.length(1);
        expect( cy.$('#n2') ).to.have.length(1);
        expect( cy.$('#n3') ).to.have.length(1);
        expect( cy.$('#n2n3') ).to.have.length(1);
        expect( n1n2.removed() ).to.be.true;
        expect( cy.$("#n1").degree() ).to.equal(0);
        expect( cy.$("#n2").degree() ).to.equal(1);

        n1n2.restore();

        expect( cy.$("#n1").degree() ).to.equal(1);
        expect( cy.$("#n2").degree() ).to.equal(2);
        expect( cy.$('#n1n2') ).to.have.length(1);
        expect( n1n2.removed() ).to.be.false;
      }

    });

    it('removes via selector', function(){
      cy.remove('edge');

      expect( cy.edges() ).to.have.length(0);
    }); 

  });

  describe('eles.restore()', function(){

    it('restores a node', function(){
      var n1 = cy.$('#n1');
      
      n1.remove();
      expect( n1.removed() ).to.be.true;
      expect( cy.$('#n1') ).to.have.length(0);
      
      n1.restore();
      expect( n1.removed() ).to.be.false;
      expect( cy.$('#n1') ).to.have.length(1);
      expect( n1.degree() ).to.equal(0);
    });

  });

  describe('cy.remove()', function(){

    it('removes a node', function(){
      var n1 = cy.$('#n1');
      
      cy.remove( n1 );

      expect( cy.nodes() ).to.have.length(2);
      expect( cy.$('#n2') ).to.have.length(1);
      expect( cy.$('#n3') ).to.have.length(1);
      expect( n1.removed() ).to.be.true;
    });

  });
  
  describe('cy.load()', function(){

    it('loads a single node graph on top of the current graph', function(done){
      var readyCalled = false;

      cy.load({
        nodes: [
                {
                  data: { id: "foo" }
                }
                ]
      }, function(){
        // on ready
        
        expect( cy.elements() ).to.have.length( 1 );
        expect( cy.nodes().data('id') ).to.equal('foo');
        expect( cy.$('#foo') ).to.have.length(1);
        
        readyCalled = true;
      }, function(){
        // on done

        expect( readyCalled ).to.be.true;

        done();
      });
    });

  });

  describe('cy.batchData()', function(){

    it('changes specified nodes with unspecified nodes unchanged', function(){
      cy.batchData({
        'n1': { foo: 1 },
        'n2': { foo: 2 }
      });

      expect( cy.$('#n1').data('foo') ).to.equal(1);
      expect( cy.$('#n2').data('foo') ).to.equal(2);
      expect( cy.$('#n3').data('foo') ).to.equal('three');

      expect( cy.$('#n1').data('weight') ).to.equal(0.25);
      expect( cy.$('#n2').data('weight') ).to.equal(0.5);
      expect( cy.$('#n3').data('weight') ).to.equal(0.75);
    });

  });

  describe('cy.collection()', function(){

    it('gets an empty collection', function(){
      var col = cy.collection();

      expect( col ).to.have.length(0);
      expect( col[0] ).to.be.undefined;
    });

  });

  describe('cy.$() et al', function(){

    it('cy.$()', function(){
      expect( cy.$('node#n1') ).to.have.length(1);
    });

    it('cy.elements()', function(){
      expect( cy.elements('node#n1') ).to.have.length(1);
    });

    it('cy.nodes()', function(){
      expect( cy.nodes('#n1') ).to.have.length(1);
    });

    it('cy.edges()', function(){
      expect( cy.edges('#n1n2') ).to.have.length(1);
    });

    it('cy.filter() with selector', function(){
      expect( cy.filter('node#n1') ).to.have.length(1);
    });
    
    it('cy.filter() with function', function(){
      expect( cy.filter(function(i, ele){
        return ele.id() === 'n1';
      }) ).to.have.length(1);
    });

  });

});