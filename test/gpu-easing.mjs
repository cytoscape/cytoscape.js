import { expect } from 'chai';
import v3Easings from '../src/core/animation/easings.mjs';
import {
  BEZIER_EASINGS, EASING_KIND, EASING_NAMES, compileEasing, parseLinearPoints, springPoints
} from '../src/gpu/easing.mjs';

// The curve layer both executors share: the CPU calls `fn`, the tween kernel
// reads kind/bezier/points (see render/gpu-tween.mts for the WGSL twin).

const SAMPLES = 101;
const ts = Array.from( { length: SAMPLES }, ( _, i ) => i / ( SAMPLES - 1 ) );

// the points array is f32, to match what the kernel reads
const expectPoints = ( points, expected ) => {
  expect( points.length, 'point count' ).to.equal( expected.length );

  for( let i = 0; i < expected.length; i++ ){
    expect( points[ i ], `point ${i}` ).to.be.closeTo( expected[ i ], 1e-6 );
  }
};

describe('gpu/easing', function(){

  describe('the v3 enum', function(){
    it('names exactly what v3 names (minus the parameterized forms)', function(){
      const v3Names = Object.keys( v3Easings ).filter( n => n !== 'spring' && n !== 'cubic-bezier' );

      expect( [ ...EASING_NAMES ].sort() ).to.deep.equal( v3Names.sort() );
    });

    it('matches v3 curve for curve', function(){
      for( const name of EASING_NAMES ){
        const ours = compileEasing( name ).fn;
        const theirs = t => v3Easings[ name ]( 0, 1, t );

        for( const t of ts ){
          expect( ours( t ), `${name} at ${t}` ).to.be.closeTo( theirs( t ), 1e-5 );
        }
      }
    });

    it('compiles the names to bezier programs (linear excepted)', function(){
      expect( compileEasing('linear').kind ).to.equal( EASING_KIND.linear );

      for( const [ name, p ] of Object.entries( BEZIER_EASINGS ) ){
        const prog = compileEasing( name );

        expect( prog.kind, name ).to.equal( EASING_KIND.bezier );
        expect( prog.bezier, name ).to.deep.equal( p );
        expect( prog.durationScale, name ).to.equal( 1 );
      }
    });

    it('pins the endpoints and stays monotonic for the enum', function(){
      for( const name of EASING_NAMES ){
        const fn = compileEasing( name ).fn;

        expect( fn( 0 ), name ).to.equal( 0 );
        expect( fn( 1 ), name ).to.equal( 1 );

        let prev = 0;

        for( const t of ts ){
          const v = fn( t );

          expect( v, `${name} at ${t}` ).to.be.at.least( prev - 1e-6 );
          prev = v;
        }
      }
    });

    it('defaults to ease', function(){
      expect( compileEasing( undefined ) ).to.equal( compileEasing('ease') );
    });
  });

  describe('cubic-bezier()', function(){
    it('parses four control points', function(){
      const prog = compileEasing('cubic-bezier(0.25, 0.1, 0.25, 1)');

      expect( prog.kind ).to.equal( EASING_KIND.bezier );
      expect( prog.bezier ).to.deep.equal( [ 0.25, 0.1, 0.25, 1 ] );

      // same numbers as the named curve
      for( const t of ts ){
        expect( prog.fn( t ) ).to.be.closeTo( compileEasing('ease').fn( t ), 1e-12 );
      }
    });

    it('clamps x into [0, 1] but leaves y free, so the curve can overshoot', function(){
      const prog = compileEasing('cubic-bezier(-0.5, 1.6, 1.4, 1)');

      expect( prog.bezier[ 0 ] ).to.equal( 0 );
      expect( prog.bezier[ 2 ] ).to.equal( 1 );
      expect( prog.bezier[ 1 ] ).to.equal( 1.6 );

      expect( Math.max( ...ts.map( prog.fn ) ) ).to.be.above( 1 );
    });

    it('rejects the wrong arity and non-numbers', function(){
      expect( () => compileEasing('cubic-bezier(0, 0, 1)') ).to.throw( /four control points/ );
      expect( () => compileEasing('cubic-bezier(0, 0, 1, 1, 1)') ).to.throw( /four control points/ );
      expect( () => compileEasing('cubic-bezier(0, 0, 1, x)') ).to.throw( /not a number/ );
    });
  });

  describe('linear()', function(){
    const at = ( src, t ) => compileEasing( src ).fn( t );

    it('interpolates a bare progression array over evenly spread stops', function(){
      const prog = compileEasing('linear(0, 0.25, 1)');

      expect( prog.kind ).to.equal( EASING_KIND.points );
      expectPoints( prog.points, [ 0, 0, 0.5, 0.25, 1, 1 ] );

      expect( prog.fn( 0 ) ).to.equal( 0 );
      expect( prog.fn( 0.25 ) ).to.be.closeTo( 0.125, 1e-6 );
      expect( prog.fn( 0.5 ) ).to.be.closeTo( 0.25, 1e-6 );
      expect( prog.fn( 0.75 ) ).to.be.closeTo( 0.625, 1e-6 );
      expect( prog.fn( 1 ) ).to.equal( 1 );
    });

    it('honours explicit percentage stops', function(){
      const prog = compileEasing('linear(0, 0.9 20%, 1)');

      expectPoints( prog.points, [ 0, 0, 0.2, 0.9, 1, 1 ] );
      expect( prog.fn( 0.1 ) ).to.be.closeTo( 0.45, 1e-6 );
    });

    it('reads two stops on one entry as a flat segment', function(){
      const prog = compileEasing('linear(0, 0.5 25% 75%, 1)');

      expectPoints( prog.points, [ 0, 0, 0.25, 0.5, 0.75, 0.5, 1, 1 ] );
      expect( prog.fn( 0.3 ) ).to.be.closeTo( 0.5, 1e-6 );
      expect( prog.fn( 0.7 ) ).to.be.closeTo( 0.5, 1e-6 );
    });

    it('pulls a decreasing stop up to the largest one before it (CSS clamping)', function(){
      // 30% comes after 60%, so it is clamped to 60% — a jump, not a rewind
      const points = parseLinearPoints( '0, 0.4 60%, 0.8 30%, 1', 'linear(...)' );

      expectPoints( points, [ 0, 0, 0.6, 0.4, 0.6, 0.8, 1, 1 ] );

      const fn = compileEasing('linear(0, 0.4 60%, 0.8 30%, 1)').fn;

      expect( fn( points[ 2 ] ) ).to.be.closeTo( 0.8, 1e-6 ); // the far side of the jump
      expect( fn( 0.59 ) ).to.be.below( 0.4 );               // still climbing to it
    });

    it('spreads a run of missing stops evenly between the fixed ones', function(){
      const points = parseLinearPoints( '0 0%, 1, 2, 3, 4 100%', 'linear(...)' );

      expectPoints( points, [ 0, 0, 0.25, 1, 0.5, 2, 0.75, 3, 1, 4 ] );
    });

    it('does not force the values into [0, 1] — a progression array may overshoot', function(){
      expect( at( 'linear(0, 1.3 60%, 1)', 0.6 ) ).to.be.closeTo( 1.3, 1e-6 );
      expect( at( 'linear(0, -0.2 30%, 1)', 0.3 ) ).to.be.closeTo( -0.2, 1e-6 );
    });

    it('clamps outside [first stop, last stop]', function(){
      const fn = compileEasing('linear(0.1 10%, 0.9 90%)').fn;

      expect( fn( 0 ) ).to.be.closeTo( 0.1, 1e-6 );
      expect( fn( 1 ) ).to.be.closeTo( 0.9, 1e-6 );
    });

    it('rejects too few points, bad stops, and junk', function(){
      expect( () => compileEasing('linear(0.5)') ).to.throw( /at least two points/ );
      expect( () => compileEasing('linear(0, 0.5 half, 1)') ).to.throw( /not a percentage/ );
      expect( () => compileEasing('linear(0, 0.5 10% 20% 30%, 1)') ).to.throw( /at most two stops/ );
      expect( () => compileEasing('linear(0, nope, 1)') ).to.throw( /not a number/ );
    });
  });

  describe('spring(bounce)', function(){
    /* the closed form the compiler samples, for an independent check */
    const step = ( zeta, t ) => {
      const w0 = 2 * Math.PI;

      if( zeta < 1 ){
        const wd = w0 * Math.sqrt( 1 - zeta * zeta );

        return 1 - Math.exp( -zeta * w0 * t ) * ( Math.cos( wd * t ) + ( zeta * w0 / wd ) * Math.sin( wd * t ) );
      }

      return 1 - ( 1 + w0 * t ) * Math.exp( -w0 * t );
    };

    it('compiles to a progression array, so the kernel only needs the points path', function(){
      const prog = compileEasing('spring(0.5)');

      expect( prog.kind ).to.equal( EASING_KIND.points );
      expect( prog.bezier ).to.equal( null );
      expect( prog.points.length % 2 ).to.equal( 0 );
    });

    it('starts at 0 and lands exactly on 1', function(){
      for( const bounce of [ -0.5, 0, 0.2, 0.5, 0.8 ] ){
        const prog = compileEasing( `spring(${bounce})` );

        expect( prog.fn( 0 ), `${bounce} at 0` ).to.be.closeTo( 0, 1e-6 );
        expect( prog.fn( 1 ), `${bounce} at 1` ).to.equal( 1 );
      }
    });

    it('reads bounce as the damping ratio: 0 is critical, positive overshoots', function(){
      const peak = bounce => Math.max( ...ts.map( compileEasing( `spring(${bounce})` ).fn ) );

      expect( peak( 0 ) ).to.be.closeTo( 1, 1e-3 );   // critically damped: no overshoot
      expect( peak( -0.5 ) ).to.be.closeTo( 1, 1e-3 );// overdamped
      expect( peak( 0.3 ) ).to.be.above( 1.02 );
      expect( peak( 0.6 ) ).to.be.above( peak( 0.3 ) );
    });

    it('dips back below the target after overshooting (it rings)', function(){
      const fn = compileEasing('spring(0.7)').fn;
      const vals = ts.map( fn );
      const peakAt = vals.indexOf( Math.max( ...vals ) );

      expect( Math.min( ...vals.slice( peakAt ) ) ).to.be.below( 1 );
    });

    it('reports the settling window as durationScale, so duration stays perceptual', function(){
      // bounce 0 rings not at all and still needs ~1.5 perceptual durations to
      // settle; a bouncy spring needs many more
      const scale = bounce => compileEasing( `spring(${bounce})` ).durationScale;

      expect( scale( 0 ) ).to.be.within( 1, 2.5 );
      expect( scale( 0.5 ) ).to.be.above( scale( 0 ) );
      expect( scale( 0.9 ) ).to.be.above( scale( 0.5 ) );
    });

    it('tracks the closed form everywhere, to within the settling epsilon', function(){
      // the chord error between samples is smaller than the residual the
      // compiler treats as settled, so that residual bounds the whole curve
      for( const bounce of [ 0, 0.3, 0.6, 0.9 ] ){
        const { durationScale } = springPoints( bounce );
        const zeta = 1 - bounce;
        const fn = compileEasing( `spring(${bounce})` ).fn;

        for( let i = 0; i <= 1000; i++ ){
          const t = i / 1000;

          expect( fn( t ), `${bounce} at ${t}` )
            .to.be.closeTo( step( zeta, t * durationScale ), 2.5e-3 );
        }
      }
    });

    it('samples in proportion to the settling window', function(){
      const n = bounce => springPoints( bounce ).points.length / 2;

      expect( n( 0 ) ).to.be.at.least( 25 );  // the floor, even with no ringing
      expect( n( 0.8 ) ).to.be.above( n( 0.3 ) );
      expect( n( 0.99 ) ).to.be.at.most( 513 ); // and a ceiling on the buffer
    });

    it('clamps the bounce factor rather than diverging', function(){
      expect( compileEasing('spring(5)').durationScale )
        .to.equal( compileEasing('spring(0.9)').durationScale );
      expect( compileEasing('spring(-5)').durationScale )
        .to.equal( compileEasing('spring(-0.9)').durationScale );
    });

    it('rejects v3\'s two-argument form', function(){
      expect( () => compileEasing('spring(500, 20)') ).to.throw( /one bounce factor/ );
    });
  });

  describe('rejections', function(){
    it('throws on an unknown name, listing the enum', function(){
      expect( () => compileEasing('ease-in-out-bounce') )
        .to.throw( /not a known easing.*ease-in-out-circ.*cubic-bezier\(\), linear\(\) or spring\(\)/ );
    });

    it('throws on an unknown function form', function(){
      expect( () => compileEasing('steps(4, end)') ).to.throw( /not a known easing/ );
    });

    it('throws on a custom function, since it cannot cross to the device', function(){
      expect( () => compileEasing( t => t * t ) ).to.throw( /custom easing function/ );
    });
  });
});
