import { auditStrandedComments } from '../../scripts/jsdoc-coverage.mjs';
import { expect } from 'chai';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Round 36.6.  The stranded doc block is this codebase's most repeated
// defect — eleven instances across rounds 26.1, 26.3, 26.4, 34.4, 34.5
// and 36.2 — and the coverage gate catches it only by accident, when the
// displaced block happens to leave some member with no comment at all.
// When it lands on another *documented* member instead, coverage stays
// at 100% and two members carry each other's prose.  That was the
// style.mts case 36.2 found, which was shipping in the .d.ts.
//
// The check reports and never gates, so these specs are what stands
// behind it.  What they pin most carefully is its *limits*: it detects
// two shapes and cannot detect the third, and it cannot tell a
// deliberately free-standing note from a displaced block.

describe( 'gpu stranded-doc-block audit (round 36)', function(){

  let dir;

  const audit = src => {
    const file = join( dir, 'fixture.mts' );

    writeFileSync( file, src );

    return auditStrandedComments( file );
  };

  beforeEach( function(){
    dir = mkdtempSync( join( tmpdir(), 'gpu-stranded-' ) );
  } );

  afterEach( function(){
    rmSync( dir, { recursive: true, force: true } );
  } );

  describe( 'what it detects', function(){

    it( 'flags a doc block whose next non-blank line opens another', function(){
      // the style.mts shape: arrowBase's block above lineOpacityConst's
      const r = audit( [
        'export class C {',
        '  /**',
        '   * the first block, documenting nothing',
        '   */',
        '  /** the second block, documenting the member */',
        '  size(): number {',
        '    return 1;',
        '  }',
        '}'
      ].join( '\n' ) );

      expect( r.stranded ).to.have.lengthOf( 1 );
      expect( r.stranded[0] ).to.contain( ':2' );
    } );

    it( 'flags a block that trails off the end of a class', function(){
      const r = audit( [
        'export class C {',
        '  /** a */',
        '  a(): number { return 1; }',
        '',
        '  /** documents nothing at all */',
        '}'
      ].join( '\n' ) );

      expect( r.stranded ).to.have.lengthOf( 1 );
      expect( r.stranded[0] ).to.contain( ':5' );
    } );

    it( 'flags a one-line block stranded above another', function(){
      const r = audit( [
        '/** the orphan */',
        '/** the real one */',
        'export const x = ( a ) => a;'
      ].join( '\n' ) );

      expect( r.stranded ).to.have.lengthOf( 1 );
      expect( r.stranded[0] ).to.contain( ':1' );
    } );

  } );

  describe( 'what it deliberately does not flag', function(){

    it( 'accepts a narrative block above a doc block', function(){
      // the normal, deliberate shape throughout src: a `/* */` note
      // explaining a section, then the `/** */` documenting the member
      const r = audit( [
        '/*',
        'A long narrative note about the section below.',
        '*/',
        '/** the member */',
        'export function f( a ){ return a; }'
      ].join( '\n' ) );

      expect( r.stranded ).to.deep.equal( [] );
    } );

    it( 'accepts a doc block directly above its member', function(){
      const r = audit( [
        'export class C {',
        '  /** a */',
        '  a(): number { return 1; }',
        '',
        '  /**',
        '   * b',
        '   */',
        '  b(): number { return 2; }',
        '}'
      ].join( '\n' ) );

      expect( r.stranded ).to.deep.equal( [] );
    } );

    it( 'cannot see a block displaced onto a *different* documented member', function(){
      // the third shape, and the reason this reports rather than gates:
      // the comment attaches to something, and only a reader knows it is
      // the wrong thing.  Both members here are documented and the audit
      // is silent — which is a limit, pinned so nobody reads a clean
      // report as proof
      const r = audit( [
        'export class C {',
        '  /** this text describes b, not a */',
        '  a(): number { return 1; }',
        '',
        '  /** and this describes a */',
        '  b(): number { return 2; }',
        '}'
      ].join( '\n' ) );

      expect( r.stranded ).to.deep.equal( [] );
    } );

  } );

  describe( 'against the real sources', function(){

    it( 'is quiet on a file with no stranded block', function(){
      // core.mts had one until 36.6 moved _query's block back onto
      // _query; it is the file the round's own fix touched, so a
      // regression there shows up here
      const r = auditStrandedComments(
        new URL( '../../src/core.mts', import.meta.url ).pathname
      );

      expect( r.stranded ).to.deep.equal( [] );
    } );

  } );

} );
