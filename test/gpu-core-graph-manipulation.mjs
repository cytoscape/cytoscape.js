import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

describe('gpu/core: graph manipulation', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscapeGpu({
      elements: {
        nodes: [
          { data: { id: 'n1' }, position: { x: 1, y: 1 } },
          { data: { id: 'n2' }, position: { x: 2, y: 2 } },
          { data: { id: 'n3' }, position: { x: 3, y: 3 } }
        ],
        edges: [
          { data: { id: 'n1n2', source: 'n1', target: 'n2' } },
          { data: { id: 'n2n3', source: 'n2', target: 'n3' } }
        ]
      }
    });
  });

  describe('factory', function(){
    it('creates a headless instance without WebGPU', function(){
      expect( cy.container() ).to.be.null;
      expect( cy.nodes() ).to.have.length(3);
      expect( cy.edges() ).to.have.length(2);
    });

    it('resolves ready when headless', function(){
      return cy.ready;
    });

    it('reports headless dimensions', function(){
      var sized = cytoscapeGpu({ headlessWidth: 400, headlessHeight: 300 });

      expect( sized.width() ).to.equal(400);
      expect( sized.height() ).to.equal(300);
    });
  });

  describe('cy.add()', function(){
    it('adds a node from a single definition', function(){
      var eles = cy.add({ data: { id: 'foo' }, position: { x: 5, y: 6 } });

      expect( eles ).to.have.length(1);
      expect( eles.id() ).to.equal('foo');
      expect( eles.isNode() ).to.be.true;
      expect( cy.getElementById('foo').position() ).to.deep.equal({ x: 5, y: 6 });
    });

    it('adds an array of definitions', function(){
      var eles = cy.add([
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ]);

      expect( eles ).to.have.length(3);
      expect( cy.getElementById('ab').isEdge() ).to.be.true;
    });

    it('adds edges listed before their nodes (nodes first)', function(){
      var eles = cy.add([
        { data: { id: 'xy', source: 'x', target: 'y' } },
        { data: { id: 'x' } },
        { data: { id: 'y' } }
      ]);

      expect( eles ).to.have.length(3);
      expect( cy.getElementById('xy').source().id() ).to.equal('x');
    });

    it('generates unique ids when omitted', function(){
      var a = cy.add({ data: {} });
      var b = cy.add({ data: {} });

      expect( a.id() ).to.be.a('string');
      expect( a.id() ).to.not.equal( b.id() );
    });

    it('throws on a duplicate id', function(){
      expect(function(){ cy.add({ data: { id: 'n1' } }); }).to.throw();
    });

    it('throws on an edge without endpoints', function(){
      expect(function(){ cy.add({ group: 'edges', data: { id: 'e' } }); }).to.throw();
    });

    it('throws on an edge with a nonexistant endpoint', function(){
      expect(function(){ cy.add({ data: { id: 'e', source: 'n1', target: 'bogus' } }); }).to.throw();
    });

    it('emits add per element', function(){
      var ids = [];

      cy.on('add', function( e ){ ids.push( e.target.id() ); });

      cy.add([ { data: { id: 'a' } }, { data: { id: 'b' } } ]);

      expect( ids ).to.deep.equal(['a', 'b']);
    });
  });

  describe('eles.remove()', function(){
    it('removes a single element', function(){
      cy.$('#n1').remove();

      expect( cy.$('#n1') ).to.have.length(0);
      expect( cy.nodes() ).to.have.length(2);
    });

    it('removes several elements', function(){
      cy.$('#n1, #n2').remove();

      expect( cy.$('#n1') ).to.have.length(0);
      expect( cy.$('#n2') ).to.have.length(0);
    });

    it('removes edges connected to a removed node', function(){
      cy.$('#n1').remove();

      expect( cy.$('#n1n2') ).to.have.length(0);
      expect( cy.edges() ).to.have.length(1);
    });

    it('returns the removed elements including cascaded edges', function(){
      var removed = cy.$('#n2').remove();

      expect( removed ).to.have.length(3); // n2 + both edges
    });

    it('does not emit remove on an already removed element', function(){
      var n1 = cy.$('#n1');
      var emitted = false;

      n1.remove();
      n1.on('remove', function(){ emitted = true; });
      n1.remove();

      expect( emitted ).to.be.false;
    });

    it('only emits the remove event once', function(){
      var n1 = cy.$('#n1');
      var emits = 0;

      n1.on('remove', function(){ emits++; });

      n1.remove();
      n1.remove();

      expect( emits ).to.equal(1);
    });

    it('updates removed() and inside()', function(){
      var n1 = cy.$('#n1');

      expect( n1.removed() ).to.be.false;
      expect( n1.inside() ).to.be.true;

      n1.remove();

      expect( n1.removed() ).to.be.true;
      expect( n1.inside() ).to.be.false;
    });

    it('keeps id() readable on removed elements', function(){
      var n1 = cy.$('#n1');

      n1.remove();

      expect( n1.id() ).to.equal('n1');
      expect( n1.isNode() ).to.be.true;
    });

    it('removes via core with a selector', function(){
      cy.remove('#n1');

      expect( cy.$('#n1') ).to.have.length(0);
    });

    it('supports re-adding an id after removal', function(){
      var old = cy.$('#n1');

      old.remove();
      cy.add({ data: { id: 'n1' }, position: { x: 9, y: 9 } });

      var fresh = cy.$('#n1');

      expect( fresh ).to.have.length(1);
      expect( fresh.position() ).to.deep.equal({ x: 9, y: 9 });
      expect( old.same( fresh ) ).to.be.false; // stale handle !== new element
    });
  });

  describe('positions', function(){
    it('gets and sets position', function(){
      var n1 = cy.$('#n1');

      expect( n1.position() ).to.deep.equal({ x: 1, y: 1 });

      n1.position({ x: 10, y: 20 });

      expect( n1.position() ).to.deep.equal({ x: 10, y: 20 });
      expect( n1.position('x') ).to.equal(10);
    });

    it('sets a single dimension', function(){
      var n1 = cy.$('#n1');

      n1.position('x', 42);

      expect( n1.position() ).to.deep.equal({ x: 42, y: 1 });
    });

    it('sets positions via a function', function(){
      cy.nodes().positions(function( ele, i ){
        return { x: i * 100, y: 7 };
      });

      expect( cy.$('#n1').position().x ).to.equal(0);
      expect( cy.$('#n3').position().x ).to.equal(200);
    });

    it('returns undefined position for edges', function(){
      expect( cy.$('#n1n2').position() ).to.be.undefined;
    });

    it('emits position when a listener is registered', function(){
      var emits = 0;

      cy.on('position', function(){ emits++; });
      cy.$('#n1').position({ x: 5, y: 5 });

      expect( emits ).to.equal(1);
    });
  });

});
