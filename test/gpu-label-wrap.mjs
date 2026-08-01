import { expect } from 'chai';
import {
  breakLines, layoutLabelBlock, estimateBlock,
  WRAP_NONE, WRAP_WRAP, WRAP_ELLIPSIS, OFLOW_WHITESPACE, OFLOW_ANYWHERE,
  JUSTIFY_LEFT, JUSTIFY_CENTER, JUSTIFY_RIGHT
} from '../src/gpu/label-wrap.mjs';

// round 16.1: the multiline shaping engine — line breaking (v3's
// text-wrap semantics), justification, ellipsis and the block metrics —
// as a pure module shared by the renderer (atlas advances) and the
// store's headless estimator (flat advances).

/** fixed-width fake metrics: every glyph advances 10, ink 8x10 */
const adv = ch => ( ch === ' ' ? 6 : 10 );
const metricsFor = ch => ( {
  advance: adv( ch ),
  w: ch === ' ' ? 0 : 8,
  h: 10,
  planeX: 0,
  planeY: 0,
  u0: 0, v0: 0, u1: 1, v1: 1
} );

const EM = 32; // SDF_FONT_SIZE stand-in

const opts = ( over = {} ) => ( {
  wrap: WRAP_NONE,
  maxWidth: Infinity,
  overflowWrap: OFLOW_WHITESPACE,
  justification: JUSTIFY_CENTER,
  lineHeight: 1,
  ...over
} );

describe('gpu/render: label wrap (round 16.1)', function(){

  describe('breakLines', function(){

    it('keeps a single line under wrap: none, collapsing newlines', function(){
      const lines = breakLines( 'ab\ncd', adv, opts() );

      expect( lines.length ).to.equal( 1 );
      expect( lines[ 0 ].text ).to.equal( 'ab cd' );
      expect( lines[ 0 ].width ).to.equal( 10 + 10 + 6 + 10 + 10 );
    });

    it('honors embedded newlines under wrap: wrap', function(){
      const lines = breakLines( 'ab\ncd', adv, opts( { wrap: WRAP_WRAP } ) );

      expect( lines.map( l => l.text ) ).to.deep.equal( [ 'ab', 'cd' ] );
    });

    it('greedily wraps words at max-width', function(){
      // words are 2 glyphs = 20 wide, spaces 6: 'aa bb cc' at 50 fits
      // 'aa bb' (46) but not '+ cc' (72)
      const lines = breakLines( 'aa bb cc', adv, opts( { wrap: WRAP_WRAP, maxWidth: 50 } ) );

      expect( lines.map( l => l.text ) ).to.deep.equal( [ 'aa bb', 'cc' ] );
    });

    it('overflows long words under whitespace, breaks them under anywhere', function(){
      const over = breakLines( 'aaaaaa', adv, opts( { wrap: WRAP_WRAP, maxWidth: 25 } ) );

      expect( over.map( l => l.text ) ).to.deep.equal( [ 'aaaaaa' ] ); // v3: whole word overflows

      const broken = breakLines( 'aaaaaa', adv,
        opts( { wrap: WRAP_WRAP, maxWidth: 25, overflowWrap: OFLOW_ANYWHERE } ) );

      expect( broken.map( l => l.text ) ).to.deep.equal( [ 'aa', 'aa', 'aa' ] );
    });

    it('truncates with an ellipsis under wrap: ellipsis', function(){
      // ellipsis advances 10; 'abcdef' at maxWidth 45 keeps 'abc' (30)
      // + '…' (10) = 40 <= 45
      const lines = breakLines( 'abcdef', adv, opts( { wrap: WRAP_ELLIPSIS, maxWidth: 45 } ) );

      expect( lines.length ).to.equal( 1 );
      expect( lines[ 0 ].text ).to.equal( 'abc…' );
      expect( lines[ 0 ].width ).to.equal( 40 );
    });

    it('keeps short ellipsis text untouched', function(){
      const lines = breakLines( 'ab', adv, opts( { wrap: WRAP_ELLIPSIS, maxWidth: 100 } ) );

      expect( lines[ 0 ].text ).to.equal( 'ab' );
    });

  });

  describe('layoutLabelBlock', function(){

    it('lays a single line exactly like the legacy layout', function(){
      const block = layoutLabelBlock( 'ab', metricsFor, 24, EM, opts() );

      expect( block.lines ).to.equal( 1 );
      expect( block.width ).to.equal( 20 );
      expect( block.glyphs.length ).to.equal( 2 );
      // centered about x = 0
      expect( block.glyphs[ 0 ].x ).to.equal( -10 );
      expect( block.glyphs[ 1 ].x ).to.equal( 0 );
    });

    it('stacks wrapped lines by the line advance', function(){
      const block = layoutLabelBlock( 'aa\nbb', metricsFor, 24, EM,
        opts( { wrap: WRAP_WRAP, lineHeight: 1.5 } ) );

      expect( block.lines ).to.equal( 2 );
      expect( block.height ).to.equal( EM * 1.5 + EM ); // (n-1)·advance + em

      const firstY = block.glyphs[ 0 ].y;
      const lastY = block.glyphs[ 2 ].y;

      expect( lastY - firstY ).to.equal( EM * 1.5 );
    });

    it('justifies short lines inside the block', function(){
      const make = justification => layoutLabelBlock( 'aaaa\nbb', metricsFor, 24, EM,
        opts( { wrap: WRAP_WRAP, justification } ) );

      // block width 40; 'bb' is 20 wide
      const left = make( JUSTIFY_LEFT );
      const center = make( JUSTIFY_CENTER );
      const right = make( JUSTIFY_RIGHT );

      // the short line's first glyph: left flush = -20, centered = -10,
      // right flush = 0
      expect( left.glyphs[ 4 ].x ).to.equal( -20 );
      expect( center.glyphs[ 4 ].x ).to.equal( -10 );
      expect( right.glyphs[ 4 ].x ).to.equal( 0 );
    });

  });

  describe('estimateBlock (the headless bb term)', function(){

    it('estimates dims with the same breaking logic', function(){
      const single = estimateBlock( 'abcd', 16, opts() );

      expect( single.lines ).to.equal( 1 );
      expect( single.width ).to.be.greaterThan( 0 );
      expect( single.height ).to.equal( 16 );

      const wrapped = estimateBlock( 'aa\nbb', 16, opts( { wrap: WRAP_WRAP, lineHeight: 2 } ) );

      expect( wrapped.lines ).to.equal( 2 );
      expect( wrapped.height ).to.equal( 16 * 2 + 16 );
      expect( wrapped.width ).to.be.lessThan( single.width );
    });

    it('scales linearly with font size', function(){
      const small = estimateBlock( 'abc', 10, opts() );
      const big = estimateBlock( 'abc', 20, opts() );

      expect( big.width ).to.be.closeTo( small.width * 2, 1e-9 );
    });

  });

});
