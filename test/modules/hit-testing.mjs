import cytoscape from '../../src/test.mjs';
import coords from '../../src/extensions/renderer/base/coord-ele-math/coords.mjs';
import { describe } from 'mocha';
import { expect } from 'chai';

describe('Edge hit testing', function(){
  it('uses each arrow scale override and inherits the shared scale', function(){
    const cy = cytoscape({
      styleEnabled: true,
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'e', source: 'a', target: 'b' } }
      ],
      style: [ { selector: 'edge', style: {
        width: 1,
        'arrow-scale': 2,
        'source-arrow-scale': 4,
        'mid-target-arrow-scale': 6
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
      expect(sizes).to.deep.equal([4, 2, 2, 6]);
    } finally {
      cy.destroy();
    }
  });
});
