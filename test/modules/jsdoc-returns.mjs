import { auditReturnTags } from '../../scripts/jsdoc-coverage.mjs';
import { expect } from 'chai';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Round 36.1.  The precedent is test/modules/throw-coverage.mjs and
// test/modules/bench-coverage.mjs: a tool's own parser gets a fixture
// rather than trust, because a parser that silently stops matching reads
// as a clean bill of health.
//
// This one earns it twice over.  The audit is *reporting-only* (round 32
// drew the gate's boundary at what docmaker emits, and round 36 wrote the
// tags without moving it), so nothing else fails when it breaks — and its
// first cut had a real bug these specs would have caught: `signatureOf`
// joined forward from a *field* declaration until it found parens, which
// swallowed the next method's signature and reported `Animation.lastNow`
// as returning the prose of the doc comment below it.  CALL_MEMBER_RE
// narrowed it to members declared with a call signature; the field spec
// below is that fix's control.

describe( 'gpu @returns audit (round 36)', function(){

  let dir;

  const audit = src => {
    const file = join( dir, 'fixture.mts' );

    writeFileSync( file, src );

    return auditReturnTags( file );
  };

  beforeEach( function(){
    dir = mkdtempSync( join( tmpdir(), 'gpu-returns-' ) );
  } );

  afterEach( function(){
    rmSync( dir, { recursive: true, force: true } );
  } );

  describe( 'what counts as needing a tag', function(){

    it( 'flags a value-returning public member with no @returns', function(){
      const r = audit( [
        'export class C {',
        '  /** does a thing */',
        '  size(): number {',
        '    return 1;',
        '  }',
        '}'
      ].join( '\n' ) );

      expect( r.tagged ).to.equal( 0 );
      expect( r.missing ).to.have.lengthOf( 1 );
      expect( r.missing[0] ).to.contain( 'C.size' );
      expect( r.missing[0] ).to.contain( '-> number' );
    } );

    it( 'counts one that has the tag', function(){
      const r = audit( [
        'export class C {',
        '  /**',
        '   * does a thing',
        '   * @returns the count of things',
        '   */',
        '  size(): number {',
        '    return 1;',
        '  }',
        '}'
      ].join( '\n' ) );

      expect( r.tagged ).to.equal( 1 );
      expect( r.missing ).to.deep.equal( [] );
    } );

    it( 'skips a member that returns nothing worth describing', function(){
      // void/Promise<void>/undefined/never say it, and `this` is a
      // chainable whose annotation already *is* the documentation.
      //
      // Note the fixture writes each member the way the sources do —
      // doc comment on its own line above.  The first version of this
      // spec put them on one line (`/** a */ a(): void {}`), which the
      // scanner does not match at all, so it passed with the exclusion
      // deliberately broken: a vacuous spec, caught by its own control.
      const r = audit( [
        'export class C {',
        '  /** a */',
        '  a(): void {}',
        '  /** b */',
        '  b(): Promise<void> { return Promise.resolve(); }',
        '  /** c */',
        '  c(): never { throw new Error( "x" ); }',
        '  /** d */',
        '  d(): this { return this; }',
        '}'
      ].join( '\n' ) );

      expect( r.tagged ).to.equal( 0 );
      expect( r.missing ).to.deep.equal( [] );
    } );

    it( 'skips a member with no return annotation rather than guessing', function(){
      // the tally is a lower bound, the direction auditThrowTags errs in too
      const r = audit( [
        'export class C {',
        '  /** a */',
        '  a() {',
        '    return 1;',
        '  }',
        '}'
      ].join( '\n' ) );

      expect( r.tagged + r.missing.length ).to.equal( 0 );
    } );

  } );

  describe( 'the shapes that broke the first cut', function(){

    it( 'does not read a field as a call signature', function(){
      // the reported bug: `lastNow = 0;` has no parens, so joining forward
      // to find them ran into the *next* member's signature
      const r = audit( [
        'export class C {',
        '  /** the shared clock */',
        '  lastNow = 0;',
        '',
        '  /** makes one */',
        '  static make(): C {',
        '    return new C();',
        '  }',
        '}'
      ].join( '\n' ) );

      expect( r.missing.map( m => m.split( ' ' )[0] ) ).to.deep.equal( [ 'C.make' ] );
      expect( r.missing[0] ).to.contain( '-> C' );
    } );

    it( 'reads the annotation past a parenthesized parameter type', function(){
      // `( fn: ( a: X ) => Y ): Z` has three parens; only the outer one
      // ends the argument list, which is why the extractor walks depth
      const r = audit( [
        'export class C {',
        '  /** maps */',
        '  map( fn: ( a: number ) => string ): string[] {',
        '    return [];',
        '  }',
        '}'
      ].join( '\n' ) );

      expect( r.missing[0] ).to.contain( '-> string[]' );
    } );

    it( 'reads a signature whose parameters wrap across lines', function(){
      const r = audit( [
        'export class C {',
        '  /** makes */',
        '  make(',
        '    a: number,',
        '    b: string',
        '  ): Position {',
        '    return null;',
        '  }',
        '}'
      ].join( '\n' ) );

      expect( r.missing[0] ).to.contain( '-> Position' );
    } );

  } );

  describe( 'the exclusions it shares with the sibling audits', function(){

    it( 'ignores private, protected and _-prefixed members', function(){
      const r = audit( [
        'export class C {',
        '  /** a */',
        '  private a(): number { return 1; }',
        '  /** b */',
        '  protected b(): number { return 1; }',
        '  /** c */',
        '  _c(): number { return 1; }',
        '}'
      ].join( '\n' ) );

      expect( r.tagged + r.missing.length ).to.equal( 0 );
    } );

    it( 'ignores members of a class that is not exported', function(){
      const r = audit( [
        'class C {',
        '  /** a */',
        '  a(): number { return 1; }',
        '}'
      ].join( '\n' ) );

      expect( r.tagged + r.missing.length ).to.equal( 0 );
    } );

    it( 'documents overload signatures and skips the implementation', function(){
      // the implementation signature is not separately documentable —
      // TypeScript hides it from callers
      const r = audit( [
        'export class C {',
        '  /** @returns the number form */',
        '  at( i: number ): number;',
        '  /** @returns the string form */',
        '  at( i: string ): string;',
        '  at( i: number | string ): number | string {',
        '    return i;',
        '  }',
        '}'
      ].join( '\n' ) );

      expect( r.tagged ).to.equal( 2 );
      expect( r.missing ).to.deep.equal( [] );
    } );

    it( 'audits top-level exported functions too', function(){
      // the coverage audit's own definition of a public member includes
      // them, and in the public tier they are wire.mts's whole surface
      const r = audit( [
        '/** converts */',
        'export const convert = ( x: number ): string => {',
        '  return String( x );',
        '};',
        '',
        '/** tests */',
        'export function isThing( x: unknown ): x is Thing {',
        '  return true;',
        '}'
      ].join( '\n' ) );

      expect( r.missing.map( m => m.split( ' ' )[0] ) )
        .to.deep.equal( [ 'convert', 'isThing' ] );
    } );

  } );

  describe( 'against the real sources', function(){

    it( 'finds a non-trivial number of tagged members', function(){
      // the guard the sibling audits carry: a regex change that audits
      // nothing must not read as a clean report
      const r = auditReturnTags(
        new URL( '../../src/collection.mts', import.meta.url ).pathname
      );

      expect( r.tagged ).to.be.at.least( 50 );
    } );

  } );

} );
