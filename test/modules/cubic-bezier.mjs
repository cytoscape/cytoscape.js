import { expect } from 'chai';
import generateCubicBezier from '../../src/core/animation/cubic-bezier.mjs';

// x(t) and y(t) of a unit cubic bezier, to check the easing against points of the curve
function point( x1, y1, x2, y2, t ){
  let s = 1 - t;
  return [
    3 * x1 * t * s * s + 3 * x2 * t * t * s + t * t * t,
    3 * y1 * t * s * s + 3 * y2 * t * t * s + t * t * t
  ];
}

describe('cubic-bezier', function(){

  it('matches points of the curve', function(){
    let curves = [ [0.25, 0.1, 0.25, 1], [0.42, 0, 1, 1], [0, 0, 0.58, 1], [0.42, 0, 0.58, 1], [0.68, -0.55, 0.265, 1.55], [0, 0, 0, 1] ];

    curves.forEach(function( c ){
      let easing = generateCubicBezier( c[0], c[1], c[2], c[3] );

      for( let i = 1; i < 100; i++ ){
        let p = point( c[0], c[1], c[2], c[3], i / 100 );

        expect( easing( p[0] ) ).to.be.closeTo( p[1], 1e-12 );
      }
    });
  });

  it('is monotonic on steep curves', function(){
    // cubic-bezier(1, 0, 0, 1) used to go backwards around x = 0.5
    let easing = generateCubicBezier( 1, 0, 0, 1 );
    let previous = 0;

    for( let i = 0; i <= 10000; i++ ){
      let y = easing( 0.49 + 0.02 * i / 10000 );

      expect( y ).to.be.at.least( previous );
      previous = y;
    }
  });

  it('saturates outside of [0, 1] and keeps linear curves', function(){
    let easing = generateCubicBezier( 0.25, 0.1, 0.25, 1 );

    expect( easing( 0 ) ).to.equal( 0 );
    expect( easing( 1 ) ).to.equal( 1 );
    expect( easing( -0.5 ) ).to.equal( 0 );
    expect( easing( 1.5 ) ).to.equal( 1 );
    expect( generateCubicBezier( 0.3, 0.3, 0.7, 0.7 )( 0.4 ) ).to.equal( 0.4 );
  });

});
