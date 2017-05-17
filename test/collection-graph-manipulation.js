var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

describe('Collection graph manipulation', function(){

  var cy;

  // test setup
  beforeEach(function(done){
    cytoscape({
      elements: {
        nodes: [
            { data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
            { data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
            { data: { id: "n3", foo: "three", weight: 0.75 }, classes: "odd three" },
            { data: { id: "child", parent: 'n3' } }
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


  describe('eles.remove()', function(){

    it('should remove a single element', function(){
      cy.$('#n1').remove();

      expect( cy.$('#n1') ).to.have.length(0);
    });

    it('should remove several elements', function(){
      cy.$('#n1, #n2').remove();

      expect( cy.$('#n1') ).to.have.length(0);
      expect( cy.$('#n2') ).to.have.length(0);
    });

    it('should remove edges connected to removed node', function(){
      cy.$('#n1').remove();

      expect( cy.$('#n1n2') ).to.have.length(0);
    });

  });

  describe('ele.removed()', function(){

    it('should be true for removed node', function(){
      var n1 = cy.$('#n1').remove();

      expect( n1.removed() ).to.be.true;
    });

    it('should be false for inside node', function(){
      var n1 = cy.$('#n1');

      expect( n1.removed() ).to.be.false;
    });

  });

  describe('ele.inside()', function(){

    it('should be false for removed node', function(){
      var n1 = cy.$('#n1').remove();

      expect( n1.inside() ).to.be.false;
    });

    it('should be true for inside node', function(){
      var n1 = cy.$('#n1');

      expect( n1.inside() ).to.be.true;
    });

  });

  describe('ele.restore()', function(){

    it('should put back a node in the graph', function(){
      var n1 = cy.$('#n1').remove();

      n1.restore();
      expect( n1.inside() ).to.be.true;
      expect( cy.$('#n1') ).to.have.length(1);
    });

  });

  describe('eles.move()', function(){

    it('should move edge source', function(){
      cy.$('#n1n2').move({ source: 'n3' });

      expect( cy.$('#n1n2').source().id() ).to.equal('n3');
      expect( cy.$('#n1n2').target().id() ).to.equal('n2');
    });

    it('should move edge target', function(){
      cy.$('#n1n2').move({ target: 'n3' });

      expect( cy.$('#n1n2').source().id() ).to.equal('n1');
      expect( cy.$('#n1n2').target().id() ).to.equal('n3');
    });

    it('should move edge source and target', function(){
      cy.$('#n1n2').move({ source: 'n2', target: 'n1' });

      expect( cy.$('#n1n2').source().id() ).to.equal('n2');
      expect( cy.$('#n1n2').target().id() ).to.equal('n1');
    });

    it('should move node parent', function(){
      cy.$('#child').move({ parent: 'n1' });

      expect( cy.$('#child').parent().id() ).to.equal('n1');
      expect( cy.$('#n1').children().id() ).to.equal('child');
    });

    it('should move to no parent', function(){
      cy.$('#child').move({ parent: null });

      expect( cy.$('#child').parent().length ).to.equal(0);
    });

    it('should move descendants and connected edges', function(){
      cy = cytoscape({
        elements: {
          nodes: [
            { data: { id: 'a', parent: 'b' } },
            { data: { id: 'b' } },
            { data: { id: 'c'} },
            { data: { id: 'd', parent: 'c' } },
            { data: { id: 'e' } }
          ],

          edges: [
            { data: { id: 'ae', weight: 1, source: 'a', target: 'e' } },
            { data: { id: 'ab', weight: 3, source: 'a', target: 'b' } },
            { data: { id: 'be', weight: 4, source: 'b', target: 'e' } },
            { data: { id: 'bc', weight: 5, source: 'b', target: 'c' } },
            { data: { id: 'ce', weight: 6, source: 'c', target: 'e' } },
            { data: { id: 'cd', weight: 2, source: 'c', target: 'd' } },
            { data: { id: 'de', weight: 7, source: 'd', target: 'e' } }
          ]
        }
      });

      var N = cy.elements().length;
      var Nn = cy.nodes().length;
      var Ne = cy.edges().length;

      cy.$('#c').move({ parent: 'b' });

      expect( cy.elements().length ).to.equal( N );
      expect( cy.edges().length ).to.equal( Ne );
      expect( cy.nodes().length ).to.equal( Nn );

      expect( cy.$('#c').parent().id() ).to.equal( 'b' );

      expect( cy.$('#de').source().same( cy.$('#d') ) ).to.be.true;
      expect( cy.$('#de').target().same( cy.$('#e') ) ).to.be.true;

      expect( cy.$('#bc').source().same( cy.$('#b') ) ).to.be.true;
      expect( cy.$('#bc').target().same( cy.$('#c') ) ).to.be.true;

      expect( cy.$('#ce').source().same( cy.$('#c') ) ).to.be.true;
      expect( cy.$('#ce').target().same( cy.$('#e') ) ).to.be.true;

      expect( cy.$('#cd').source().same( cy.$('#c') ) ).to.be.true;
      expect( cy.$('#cd').target().same( cy.$('#d') ) ).to.be.true;
    });

    it('should move descendants and connected edges 2x', function(){
      cy = cytoscape({
        elements: {
          nodes: [
            { data: { id: 'a', parent: 'b' } },
            { data: { id: 'b' } },
            { data: { id: 'c'} },
            { data: { id: 'd', parent: 'c' } },
            { data: { id: 'e' } }
          ],

          edges: [
            { data: { id: 'ae', weight: 1, source: 'a', target: 'e' } },
            { data: { id: 'ab', weight: 3, source: 'a', target: 'b' } },
            { data: { id: 'be', weight: 4, source: 'b', target: 'e' } },
            { data: { id: 'bc', weight: 5, source: 'b', target: 'c' } },
            { data: { id: 'ce', weight: 6, source: 'c', target: 'e' } },
            { data: { id: 'cd', weight: 2, source: 'c', target: 'd' } },
            { data: { id: 'de', weight: 7, source: 'd', target: 'e' } }
          ]
        }
      });

      var N = cy.elements().length;
      var Nn = cy.nodes().length;
      var Ne = cy.edges().length;

      cy.$('#c').move({ parent: 'b' });

      cy.$('#c').move({ parent: null });

      expect( cy.elements().length ).to.equal( N );
      expect( cy.edges().length ).to.equal( Ne );
      expect( cy.nodes().length ).to.equal( Nn );

      expect( cy.$('#c').parent().empty() ).to.be.true;

      expect( cy.$('#bc').source().same( cy.$('#b') ) ).to.be.true;
      expect( cy.$('#bc').target().same( cy.$('#c') ) ).to.be.true;

      expect( cy.$('#ce').source().same( cy.$('#c') ) ).to.be.true;
      expect( cy.$('#ce').target().same( cy.$('#e') ) ).to.be.true;

      expect( cy.$('#cd').source().same( cy.$('#c') ) ).to.be.true;
      expect( cy.$('#cd').target().same( cy.$('#d') ) ).to.be.true;
    });

    it('should maintain primitive scratch data (for edge)', function(){
      cy.$('#n1n2').scratch('foo', 'bar').move({ source: 'n3' });

      expect( cy.$('#n1n2').scratch('foo') ).to.equal('bar');
    });

    it('should maintain object scratch data (for edge)', function(){
      var foo = { bar: 'baz' };

      cy.$('#n1n2').scratch( 'foo', foo ).move({ source: 'n3' });

      expect( cy.$('#n1n2').scratch('foo') ).to.equal( foo );
    });

    it('should maintain primitive scratch data (for node)', function(){
      cy.$('#child').scratch('foo', 'bar').move({ parent: 'n1' });

      expect( cy.$('#child').scratch('foo') ).to.equal('bar');
    });

    it('should maintain object scratch data (for node)', function(){
      var foo = { bar: 'baz' };

      cy.$('#child').scratch( 'foo', foo ).move({ parent: 'n1' });

      expect( cy.$('#child').scratch('foo') ).to.equal( foo );
    });

  });


});
