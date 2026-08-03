import CRp from "../../src/extensions/renderer/canvas/drawing-redraw.mjs";
import { expect } from "chai";

describe('drawing-redraw', function(){
  describe('effectiveAlpha', function() {

    it('multiplies color alpha by opacity for fill styles', function() {
      let context = {};
      CRp.colorFillStyle(context, [1, 2, 3, 0.5], 0.2);
      expect( context.fillStyle ).to.equal('rgba(1,2,3,0.1)');
    });

    it('multiplies color alpha by opacity for stroke styles', function() {
      let context = {};
      CRp.colorStrokeStyle(context, [1, 2, 3, 0.5], 0.2);
      expect( context.strokeStyle ).to.equal('rgba(1,2,3,0.1)');
    });

    it('uses opacity as the alpha channel for no-alpha fill colors', function() {
      let context = {};
      CRp.colorFillStyle(context, [1, 2, 3], 0.5);
      expect( context.fillStyle ).to.equal('rgba(1,2,3,0.5)');
    });
  });

  describe('createGradientStyleFor', function() {
    function createMockEle( stopColors, stopPositions ){
      let pstyleValues = {
        'overlay-gradient-stop-colors': { value: stopColors },
        'overlay-gradient-stop-positions': { pfValue: stopPositions },
        'overlay-gradient-direction': { value: 'to-bottom' }
      };

      return {
        isEdge: () => false,
        position: () => ({ x: 0, y: 0 }),
        paddedWidth: () => 10,
        paddedHeight: () => 10,
        pstyle: name => pstyleValues[ name ]
      };
    }

    function createMockCtx(){
      let stops = [];

      return {
        stops,
        createLinearGradient: () => ({
          addColorStop: ( pos, color ) => stops.push([ pos, color ])
        })
      };
    }

    it('multiplies each stop color\'s own alpha by opacity', function() {
      let ele = createMockEle( [ [1, 2, 3, 0.5], [4, 5, 6, 0.5] ], [0, 1] );
      let context = createMockCtx();

      CRp.createGradientStyleFor.call( { usePaths: () => false }, context, 'overlay', ele, 'linear-gradient', 0.2 );

      expect( context.stops[0] ).to.deep.equal([ 0, 'rgba(1,2,3,0.1)' ]);
      expect( context.stops[1] ).to.deep.equal([ 1, 'rgba(4,5,6,0.1)' ]);
    });

    it('uses opacity as the alpha channel for no-alpha stop colors', function() {
      let ele = createMockEle( [ [1, 2, 3], [4, 5, 6] ], [0, 1] );
      let context = createMockCtx();

      CRp.createGradientStyleFor.call( { usePaths: () => false }, context, 'overlay', ele, 'linear-gradient', 0.2 );

      expect( context.stops[0] ).to.deep.equal([ 0, 'rgba(1,2,3,0.2)' ]);
      expect( context.stops[1] ).to.deep.equal([ 1, 'rgba(4,5,6,0.2)' ]);
    });
  });
});