import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/active-pannable', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'pannableNode' }, pannable: true },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'ba', source: 'b', target: 'a' }, pannable: false }
      ]
    });
  });

  describe('active state', function(){
    it('defaults to inactive', function(){
      expect( cy.$id('a').active() ).to.be.false;
      expect( cy.$id('a').inactive() ).to.be.true;
    });

    it('activates and unactivates', function(){
      cy.$id('a').activate();

      expect( cy.$id('a').active() ).to.be.true;
      expect( cy.$id('a').inactive() ).to.be.false;

      cy.$id('a').unactivate();

      expect( cy.$id('a').active() ).to.be.false;
      expect( cy.$id('a').inactive() ).to.be.true;
    });

    it('applies to a whole collection', function(){
      cy.nodes().activate();

      expect( cy.nodes().every( n => n.active() ) ).to.be.true;
    });

    it('is false for empty and removed elements', function(){
      expect( cy.collection().active() ).to.be.false;
      expect( cy.collection().inactive() ).to.be.false;

      var a = cy.$id('a');

      a.activate();
      a.remove();

      expect( a.active() ).to.be.false;
      expect( a.inactive() ).to.be.false;
    });
  });

  describe('pannable state', function(){
    it('defaults nodes to not pannable and edges to pannable, as in v3', function(){
      expect( cy.$id('a').pannable() ).to.be.false;
      expect( cy.$id('ab').pannable() ).to.be.true;
    });

    it('respects the pannable field of a definition', function(){
      expect( cy.$id('pannableNode').pannable() ).to.be.true;
      expect( cy.$id('ba').pannable() ).to.be.false;
    });

    it('panifies and unpanifies', function(){
      cy.$id('a').panify();

      expect( cy.$id('a').pannable() ).to.be.true;

      cy.$id('a').unpanify();

      expect( cy.$id('a').pannable() ).to.be.false;
    });

    it('overrides grabbable, as in v3', function(){
      expect( cy.$id('a').grabbable() ).to.be.true;

      cy.$id('a').panify();

      expect( cy.$id('a').grabbable() ).to.be.false;

      cy.$id('a').unpanify();

      expect( cy.$id('a').grabbable() ).to.be.true;
    });

    it('defaults edges added via cy.add() to pannable', function(){
      cy.add({ data: { id: 'c' } });
      cy.add({ data: { id: 'ac', source: 'a', target: 'c' } });

      expect( cy.$id('c').pannable() ).to.be.false;
      expect( cy.$id('ac').pannable() ).to.be.true;
    });

    it('defaults columnar-loaded edges to pannable', function(){
      var cy2 = cytoscape({
        elements: {
          columnar: true,
          nodes: { count: 2, ids: [ 'n0', 'n1' ] },
          edges: {
            count: 1,
            ids: [ 'e0' ],
            sources: new Uint32Array([ 0 ]),
            targets: new Uint32Array([ 1 ])
          }
        }
      });

      expect( cy2.$id('n0').pannable() ).to.be.false;
      expect( cy2.$id('e0').pannable() ).to.be.true;
    });
  });
});
