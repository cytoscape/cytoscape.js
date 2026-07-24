import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

describe('gpu/collection: comparison', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' }, selected: true },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ]
    });
  });

  describe('eles.same()', function(){
    it('is true for equal sets regardless of order', function(){
      expect( cy.$id('a').union( cy.$id('b') ).same( cy.$id('b').union( cy.$id('a') ) ) ).to.be.true;
    });

    it('is false for different sets', function(){
      expect( cy.$id('a').same( cy.$id('b') ) ).to.be.false;
      expect( cy.$id('a').union( cy.$id('b') ).same( cy.$id('a') ) ).to.be.false;
    });
  });

  describe('eles.anySame()', function(){
    it('is true on overlap', function(){
      expect( cy.$id('a').union( cy.$id('b') ).anySame( cy.$id('b').union( cy.$id('c') ) ) ).to.be.true;
    });

    it('is false on disjoint sets', function(){
      expect( cy.$id('a').anySame( cy.$id('b').union( cy.$id('c') ) ) ).to.be.false;
    });
  });

  describe('eles.contains()', function(){
    it('is true for subsets', function(){
      expect( cy.nodes().contains( cy.$id('a') ) ).to.be.true;
      expect( cy.elements().has( cy.nodes() ) ).to.be.true;
    });

    it('is false otherwise', function(){
      expect( cy.$id('a').contains( cy.nodes() ) ).to.be.false;
    });
  });

  describe('eles.allAre()', function(){
    it('checks every element against a selector', function(){
      expect( cy.nodes().allAre({ group: 'nodes' }) ).to.be.true;
      expect( cy.elements().allAre({ group: 'nodes' }) ).to.be.false;
      expect( cy.collection().allAre({ group: 'nodes' }) ).to.be.true; // vacuously true, as in v3
    });
  });

  describe('eles.some() / eles.every()', function(){
    it('pass (ele, i, eles) to the callback', function(){
      var nodes = cy.nodes();

      nodes.some(function( ele, i, eles ){
        expect( ele.isNode() ).to.be.true;
        expect( i ).to.be.a('number');
        expect( eles.same( nodes ) ).to.be.true;

        return false; // visit them all
      });

      nodes.every(function( ele, i, eles ){
        expect( ele.length ).to.equal(1);
        expect( eles.length ).to.equal( nodes.length );

        return true;
      });
    });
  });

  describe('eles.is()', function(){
    it('checks whether any element matches', function(){
      expect( cy.elements().is({ group: 'edges' }) ).to.be.true;
      expect( cy.nodes().is({ group: 'edges' }) ).to.be.false;
      expect( cy.nodes().is({ selected: true }) ).to.be.true;
    });
  });

});
