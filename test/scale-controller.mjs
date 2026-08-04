import { expect } from 'chai';
import { ScaleController } from '../src/render/scale-controller.mjs';

describe('gpu/render: adaptive scale controller', function(){

  // drive a full evaluation window of drawn frames at a given gpu cost
  var window_ = function( ctl, startMs, gpuMs, frames = 10 ){
    var changed = null;

    for( var i = 0; i <= frames; i++ ){
      var result = ctl.frameDrawn( startMs + ( i / frames ) * 401, gpuMs );

      if( result != null ){ changed = result; }
    }

    return changed;
  };

  it('builds quarter steps between max and min', function(){
    expect( new ScaleController( 0.5, 1 ).steps ).to.deep.equal( [ 1, 0.75, 0.5 ] );
    expect( new ScaleController( 0.25, 1 ).steps ).to.deep.equal( [ 1, 0.75, 0.5, 0.25 ] );
    expect( new ScaleController( 0.6, 1 ).steps ).to.deep.equal( [ 1, 0.75, 0.6 ] );
    expect( new ScaleController( 1, 1 ).steps ).to.deep.equal( [ 1 ] );
  });

  it('normalizes a reversed or out-of-range band', function(){
    var ctl = new ScaleController( 1, 0.5 ); // reversed

    expect( ctl.min ).to.equal( 0.5 );
    expect( ctl.max ).to.equal( 1 );
    expect( new ScaleController( 0.1, 2 ).min ).to.equal( 0.25 );
    expect( new ScaleController( 0.1, 2 ).max ).to.equal( 1 );
  });

  it('starts at max', function(){
    expect( new ScaleController( 0.5, 1 ).scale ).to.equal( 1 );
  });

  it('steps down under sustained high GPU cost, one step per window', function(){
    var ctl = new ScaleController( 0.5, 1 );

    expect( window_( ctl, 0, 30 ) ).to.equal( 0.75 );
    expect( ctl.scale ).to.equal( 0.75 );
    expect( window_( ctl, 1000, 30 ) ).to.equal( 0.5 );
    expect( ctl.scale ).to.equal( 0.5 );
  });

  it('floors at min', function(){
    var ctl = new ScaleController( 0.5, 1 );

    window_( ctl, 0, 30 );
    window_( ctl, 1000, 30 );

    expect( window_( ctl, 2000, 30 ) ).to.equal( null );
    expect( ctl.scale ).to.equal( 0.5 );
  });

  it('raises only when the projected cost at the higher step has headroom', function(){
    var ctl = new ScaleController( 0.5, 1 );

    window_( ctl, 0, 30 ); // -> 0.75

    // 8 ms at 0.75 projects to 8 * (1/0.75)^2 ≈ 14.2 ms at 1: no raise
    expect( window_( ctl, 2000, 8 ) ).to.equal( null );
    expect( ctl.scale ).to.equal( 0.75 );

    // 4 ms projects to ~7.1 ms: raise
    expect( window_( ctl, 4000, 4 ) ).to.equal( 1 );
    expect( ctl.scale ).to.equal( 1 );
  });

  it('respects the raise cooldown', function(){
    var ctl = new ScaleController( 0.25, 1 );

    window_( ctl, 0, 30 );    // -> 0.75
    window_( ctl, 1000, 30 ); // -> 0.5
    window_( ctl, 3000, 1 );  // raise -> 0.75

    expect( ctl.scale ).to.equal( 0.75 );

    // next window ends ~400 ms later: still cooling down, no second raise
    expect( window_( ctl, 3402, 1 ) ).to.equal( null );

    // well past the cooldown: raises again
    expect( window_( ctl, 5000, 1 ) ).to.equal( 1 );
  });

  it('makes no decision from sparse activity', function(){
    var ctl = new ScaleController( 0.5, 1 );

    // two slow frames far apart: not continuous drawing
    expect( ctl.frameDrawn( 0, 30 ) ).to.equal( null );
    expect( ctl.frameDrawn( 500, 30 ) ).to.equal( null );
    expect( ctl.frameDrawn( 1000, 30 ) ).to.equal( null );
    expect( ctl.scale ).to.equal( 1 );
  });

  it('falls back to backpressure stalls when GPU timing is unavailable', function(){
    var ctl = new ScaleController( 0.5, 1 );

    // a window of untimed frames with heavy stalling steps down
    var changed = null;

    for( var i = 0; i <= 10; i++ ){
      var now = ( i / 10 ) * 401;
      var result = i % 2 === 0 ? ctl.frameStalled( now ) : ctl.frameDrawn( now, 0 );

      if( result != null ){ changed = result; }
    }

    expect( changed ).to.equal( 0.75 );

    // untimed but clean windows raise back after two in a row
    expect( window_( ctl, 2000, 0 ) ).to.equal( null );
    expect( window_( ctl, 3000, 0 ) ).to.equal( 1 );
  });

  it('settles to max from below, and reports null at max', function(){
    var ctl = new ScaleController( 0.5, 1 );

    expect( ctl.settleToMax() ).to.equal( null );

    window_( ctl, 0, 30 );

    expect( ctl.scale ).to.equal( 0.75 );
    expect( ctl.settleToMax() ).to.equal( 1 );
    expect( ctl.scale ).to.equal( 1 );
  });

  it('never changes with a pinned band (min === max)', function(){
    var ctl = new ScaleController( 0.75, 0.75 );

    expect( window_( ctl, 0, 50 ) ).to.equal( null );
    expect( ctl.settleToMax() ).to.equal( null );
    expect( ctl.scale ).to.equal( 0.75 );
  });

});
