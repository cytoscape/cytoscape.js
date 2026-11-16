
import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('Grid layout validation', function(){
  it('should produce finite positions with zero rows', function(){
    let cy = cytoscape({
      headless: true,
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } }
      ]
    });

    try {
      cy.layout({
        name: 'grid',
        rows: 0,
        boundingBox: { x1: 0, y1: 0, w: 200, h: 200 }
      }).run();

      cy.nodes().forEach(node => {
        expect(Number.isFinite(node.position('x'))).to.equal(true);
        expect(Number.isFinite(node.position('y'))).to.equal(true);
      });
    } finally {
      cy.destroy();
    }
  });

  it('should produce finite positions with zero columns', function(){
    let cy = cytoscape({
      headless: true,
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } }
      ]
    });

    try {
      cy.layout({
        name: 'grid',
        cols: 0,
        boundingBox: { x1: 0, y1: 0, w: 200, h: 200 }
      }).run();

      cy.nodes().forEach(node => {
        expect(Number.isFinite(node.position('x'))).to.equal(true);
        expect(Number.isFinite(node.position('y'))).to.equal(true);
      });
    } finally {
      cy.destroy();
    }
  });
});
