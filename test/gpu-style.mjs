import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';
import {
  SHAPE_CIRCLE, SHAPE_ELLIPSE, SHAPE_RECTANGLE, SHAPE_ROUND_RECTANGLE
} from '../src/gpu/contract.mjs';

describe('gpu/style', function(){

  var cy;

  var fillOf = id => {
    var ref = cy._store.lookup(id);
    var column = cy._store.column('node.fillColor');

    return Array.from( column.slice(ref.slot * 4, ref.slot * 4 + 4) );
  };

  var lineOf = id => {
    var ref = cy._store.lookup(id);
    var column = cy._store.column('edge.lineColor');

    return Array.from( column.slice(ref.slot * 4, ref.slot * 4 + 4) );
  };

  var shapeOf = id => {
    var ref = cy._store.lookup(id);

    return cy._store.column('node.shape')[ref.slot];
  };

  beforeEach(function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ]
    });
  });

  describe('defaults', function(){
    it('applies v3-like defaults on add', function(){
      expect( cy.$('#a').width() ).to.equal(30);
      expect( cy.$('#a').height() ).to.equal(30);
      expect( fillOf('a') ).to.deep.equal([153, 153, 153, 255]); // #999
      expect( cy.$('#ab').width() ).to.equal(2);
      expect( lineOf('ab') ).to.deep.equal([153, 153, 153, 255]);
    });

    it('compiles default equal-sized ellipses to circles', function(){
      expect( shapeOf('a') ).to.equal(SHAPE_CIRCLE);
    });
  });

  describe('cy.style()', function(){
    it('applies constant blocks to matching elements', function(){
      cy.style([
        { selector: 'node', style: { 'background-color': 'red', 'width': 50, 'height': 40 } },
        { selector: 'edge', style: { 'line-color': '#00f', 'width': 5 } }
      ]);

      expect( fillOf('a') ).to.deep.equal([255, 0, 0, 255]);
      expect( cy.$('#a').width() ).to.equal(50);
      expect( cy.$('#a').height() ).to.equal(40);
      expect( shapeOf('a') ).to.equal(SHAPE_ELLIPSE); // unequal ⇒ true ellipse
      expect( lineOf('ab') ).to.deep.equal([0, 0, 255, 255]);
      expect( cy.$('#ab').width() ).to.equal(5);
    });

    it('applies later blocks over earlier ones', function(){
      cy.style([
        { selector: 'node', style: { 'background-color': 'red' } },
        { selector: '#a', style: { 'background-color': 'rgb(0, 255, 0)' } }
      ]);

      expect( fillOf('a') ).to.deep.equal([0, 255, 0, 255]);
      expect( fillOf('b') ).to.deep.equal([255, 0, 0, 255]);
    });

    it('applies to elements added later', function(){
      cy.style([ { selector: 'node', style: { 'background-color': 'black' } } ]);

      cy.add({ data: { id: 'c' } });

      expect( fillOf('c') ).to.deep.equal([0, 0, 0, 255]);
    });

    it('supports shapes', function(){
      cy.style([
        { selector: '#a', style: { shape: 'rectangle' } },
        { selector: '#b', style: { shape: 'round-rectangle' } }
      ]);

      expect( shapeOf('a') ).to.equal(SHAPE_RECTANGLE);
      expect( shapeOf('b') ).to.equal(SHAPE_ROUND_RECTANGLE);
    });

    it('supports border and opacity channels', function(){
      cy.style([
        { selector: 'node', style: { 'border-width': 3, 'border-color': 'white', 'opacity': 0.5 } }
      ]);

      var ref = cy._store.lookup('a');

      expect( cy._store.column('node.borderWidth')[ref.slot] ).to.equal(3);
      expect( cy._store.column('node.opacity')[ref.slot] ).to.equal(0.5);
      expect( cy.$('#a').outerWidth() ).to.equal(33);
    });

    it('re-applies on selection change (:selected blocks)', function(){
      cy.style([
        { selector: 'node', style: { 'background-color': 'red' } },
        { selector: 'node:selected', style: { 'background-color': 'blue' } }
      ]);

      expect( fillOf('a') ).to.deep.equal([255, 0, 0, 255]);

      cy.$('#a').select();

      expect( fillOf('a') ).to.deep.equal([0, 0, 255, 255]);

      cy.$('#a').unselect();

      expect( fillOf('a') ).to.deep.equal([255, 0, 0, 255]);
    });

    it('emits a style event', function(){
      var emitted = 0;

      cy.on('style', function(){ emitted++; });
      cy.style([]);

      expect( emitted ).to.equal(1);
    });

    it('returns the current blocks from json()', function(){
      var blocks = [ { selector: 'node', style: { width: 10 } } ];

      cy.style( blocks );

      expect( cy.style().json() ).to.deep.equal( blocks );
    });

    it('honours the style init option', function(){
      var styled = cytoscapeGpu({
        style: [ { selector: 'node', style: { width: 77 } } ],
        elements: [ { data: { id: 'x' } } ]
      });

      expect( styled.$('#x').width() ).to.equal(77);
    });

    it('throws on unsupported properties', function(){
      expect(function(){
        cy.style([ { selector: 'node', style: { 'label': 'nope' } } ]);
      }).to.throw();
    });

    it('throws on mapper-style values', function(){
      expect(function(){
        cy.style([ { selector: 'node', style: { 'width': 'data(weight)' } } ]);
      }).to.throw();
    });

    it('throws on unsupported selectors', function(){
      expect(function(){
        cy.style([ { selector: '.cls', style: { 'width': 10 } } ]);
      }).to.throw();
    });
  });

});
