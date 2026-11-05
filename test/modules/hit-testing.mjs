import cytoscape from '../../src/test.mjs';
import coords from '../../src/extensions/renderer/base/coord-ele-math/coords.mjs';
import { describe } from 'mocha';
import { expect } from 'chai';

describe('Edge hit testing', function(){
  it('uses the shared arrow scale for every arrow', function(){
    const cy = cytoscape({
      styleEnabled: true,
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'e', source: 'a', target: 'b' } }
      ],
      style: [ { selector: 'edge', style: {
        width: 1,
        'arrow-scale': 2
      } } ]
    });

    try {
      const edge = cy.$('#e')[0];
      Object.assign(edge._private.rscratch, {
        edgeType: 'straight', allpts: [0, 0, 100, 0]
      });

      const sizes = [];
      const renderer = {
        getArrowWidth: (width, scale) => width * scale,
        arrowShapes: {
          none: {
            roughCollide: () => true,
            collide: (x, y, size) => { sizes.push(size); return false; }
          }
        }
      };

      expect(coords.checkEdgeHitAt.call(renderer, edge, 50, 50, 0)).to.equal(null);
      expect(sizes).to.deep.equal([2, 2, 2, 2]);
    } finally {
      cy.destroy();
    }
  });
});
