import { expect } from 'chai';
import { audit, PUBLIC_API } from '../scripts/gpu-jsdoc-coverage.mjs';

/*
Round 26: JSDoc is the documentation source of truth for v4 (PLAN.md
round 26, design call 1) — the release documentation is generated from
these comments rather than hand-written into a parallel markdown tree,
so the comments have to actually exist and stay existing.

Design call 5: coverage is enforced, not aspirational.  Without a gate
a 46%-covered surface silently returns to 46%.  Two mechanisms:

  - Every file stays complete: adding a public member without a doc
    comment fails this spec, naming the member.  Round 26.4 took both
    tiers to 100%, so this is now the whole ratchet.
  - The tier floors, kept as a second net in case the per-file check is
    ever loosened.

Never lower the floors.
*/

/**
 * Both tiers reached 100% in round 26.4, so the ratchet is simply "every
 * file stays complete" — there is no partial-coverage file left to list.
 */
const PUBLIC_FLOOR = 100;
const INTERNAL_FLOOR = 100;

describe('gpu/docs: JSDoc coverage of the v4 surface (round 26)', function(){

  const result = audit();

  describe('every file stays complete', function(){

    it('no src/gpu file has an undocumented public member', function(){
      const offenders = result.files.filter( f => f.missing.length > 0 );

      expect(
        offenders.map( f => f.file ),
        'undocumented public members:\n  ' +
        offenders.flatMap( f => f.missing ).join( '\n  ' )
      ).to.deep.equal( [] );
    });

  });

  describe('the tier floors hold', function(){

    it('the public API tier stays at or above its floor', function(){
      expect(
        result.public.pct,
        `public tier fell to ${result.public.pct.toFixed( 1 )}% ` +
        `(${result.public.documented}/${result.public.total})`
      ).to.be.at.least( PUBLIC_FLOOR );
    });

    it('the internal tier stays at or above its floor', function(){
      expect(
        result.internal.pct,
        `internal tier fell to ${result.internal.pct.toFixed( 1 )}% ` +
        `(${result.internal.documented}/${result.internal.total})`
      ).to.be.at.least( INTERNAL_FLOOR );
    });

  });

  /*
  Round 31.2: the same rule applied to what a member *throws*.  Round 26
  settled that a doc comment states the contract — "what it takes, what it
  returns, what it throws" — and gated the comment's existence, but nothing
  checked that half of it.  Seven of the sixteen public members that throw
  said so; the other nine did not, and these comments are the hover text
  shipped in dist/cytoscape-gpu.d.ts.

  This is gated where round 30's *test*-coverage measurement deliberately is
  not, and the difference is the point: documentation completeness is already
  a gated concern in this repo (round 26 made that call), so keeping @throws
  complete maintains an existing gate rather than adding a new kind of one.
  Removing it is this one describe block.

  The audit under-detects on purpose — a member that throws only through a
  helper is not flagged — so this never demands a tag a human would not.
  */
  describe('a public member that throws says so', function(){

    it('every throwing public-API member carries an @throws tag', function(){
      expect(
        result.throwTags.missing,
        'public members that throw with no @throws tag:\n  ' +
        result.throwTags.missing.join( '\n  ' )
      ).to.deep.equal( [] );
    });

    it('finds a non-trivial number of throwing members to check', function(){
      // the same guard as the coverage floors: a regex change that audits
      // nothing must not read as a pass
      expect( result.throwTags.tagged ).to.be.at.least( 10 );
    });

  });

  /*
  Round 32: and the "what it takes" half.  docmaker's per-function shape
  carries a description per argument and has no return field at all, so a
  missing @param is a hole in the release documentation while a missing
  @returns is editor hover text — which is exactly where this gate stops.
  143 of 221 public members taking arguments documented them when the audit
  was written; the round took it to 221/221.

  Public tier only, for the same reason: those are the files a consumer of
  `cytoscape/gpu` holds, and they are what a generator would read.

  Round 36 widened it to the public tier's *exported functions*, which are
  public members by this script's own definition and are the entire surface
  of wire.mts and columnar.mts — but which round 32's audit never walked,
  because it only descended class bodies.  So the 221/221 it reported was
  221 of the members it could see; `serializeElements` and its neighbours
  were outside the gate.  They are inside it now, at 229/229.
  */
  describe('a public member that takes arguments describes them', function(){

    it('every public-API member with parameters carries @param', function(){
      expect(
        result.paramTags.missing,
        'public members taking arguments with no @param:\n  ' +
        result.paramTags.missing.join( '\n  ' )
      ).to.deep.equal( [] );
    });

    it('finds a non-trivial number of parameterized members to check', function(){
      expect( result.paramTags.tagged ).to.be.at.least( 150 );
    });

    it('audits exported functions, not only class members', function(){
      // wire.mts's whole public surface is exported functions, so its
      // count is 0 if the branch that walks them is ever dropped — which
      // is how round 32's audit missed them for four rounds
      const wire = result.paramTags.files.find( f => f.file === 'src/gpu/wire.mts' );

      expect( wire, 'wire.mts was not audited for @param' ).to.not.equal( undefined );
      expect( wire.tagged ).to.be.at.least( 2 );
    });

  });

  describe('the audit itself', function(){

    it('classifies every listed public-API file', function(){
      for( const file of PUBLIC_API ){
        expect(
          result.files.some( f => f.file === file ),
          `${file} is listed in PUBLIC_API but was not audited`
        ).to.equal( true );
      }
    });

    it('finds a non-trivial number of public members to check', function(){
      // guards against a regex change silently auditing nothing
      expect( result.public.total ).to.be.at.least( 300 );
      expect( result.internal.total ).to.be.at.least( 300 );
    });

  });

});
