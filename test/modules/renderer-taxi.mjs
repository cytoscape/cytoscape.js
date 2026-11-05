import { expect } from 'chai';
import BRp from '../../src/extensions/renderer/base/coord-ele-math/edge-control-points.mjs';

describe('Taxi fallback turns (#3524)', function(){
  const cases = [
    { name: 'unequal nodes with a gap', y2: 600, srcH: 40, tgtH: 800, turn: 135 },
    { name: 'unequal nodes that touch', y2: 470, srcH: 40, tgtH: 800, turn: 70 },
    { name: 'overlapping node bounds', y2: 460, srcH: 40, tgtH: 800, turn: 255 },
    { name: 'equal-size nodes', y2: 600, srcH: 40, tgtH: 40, turn: 325 },
    { name: 'node-position distances', y2: 600, srcH: 40, tgtH: 800, turn: 325, distances: 'node-position' }
  ];

  function route( pairInfo, direction, distances = 'intersection', minDistance = 10 ){
    const rscratch = {};
    const styles = {
      'edge-distances': { value: distances },
      'taxi-direction': { value: direction },
      'taxi-turn': { units: '%', pfValue: 0.5 },
      'taxi-turn-min-distance': { pfValue: minDistance }
    };
    const edge = {
      _private: { rscratch },
      pstyle: name => styles[name]
    };

    BRp.findTaxiPoints( edge, pairInfo );

    return rscratch.segpts;
  }

  function transpose( pair ){
    const p = pair.posPts;

    return {
      posPts: { x1: p.y1, y1: p.x1, x2: p.y2, y2: p.x2 },
      srcW: pair.srcH, srcH: pair.srcW,
      tgtW: pair.tgtH, tgtH: pair.tgtW
    };
  }

  function reverse( pair ){
    const p = pair.posPts;

    return {
      posPts: { x1: p.x2, y1: p.y2, x2: p.x1, y2: p.y1 },
      srcW: pair.tgtW, srcH: pair.tgtH,
      tgtW: pair.srcW, tgtH: pair.srcH
    };
  }

  it('routes the original example through the gap with default turn settings', function(){
    const pair = {
      posPts: { x1: 200, y1: 50, x2: 150, y2: 600 },
      srcW: 200, srcH: 40, tgtW: 200, tgtH: 800
    };

    expect( route(pair, 'horizontal') ).to.deep.equal([200, 135, 150, 135]);
  });

  for( const direction of ['horizontal', 'vertical'] ){
    for( const branch of ['source', 'target'] ){
      for( const reversed of [false, true] ){
        for( const testCase of cases ){
          it(`${direction}, ${branch} fallback, reversed=${reversed}: ${testCase.name}`, function(){
            let pair = {
              posPts: { x1: 200, y1: 50, x2: 150, y2: testCase.y2 },
              srcW: 200, srcH: testCase.srcH,
              tgtW: 200, tgtH: testCase.tgtH
            };
            let expected = [200, testCase.turn, 150, testCase.turn];
            const transposeAxes = (direction === 'vertical') !== (branch === 'target');

            if( transposeAxes ){
              pair = transpose(pair);
              expected = [testCase.turn, 200, testCase.turn, 150];
            }

            if( reversed ){
              pair = reverse(pair);
              expected = [expected[2], expected[3], expected[0], expected[1]];
            }

            // Force non-ideal routing so the second fallback is covered too.
            expect( route(pair, direction, testCase.distances, 1000) ).to.deep.equal(expected);
          });
        }
      }
    }
  }
});

