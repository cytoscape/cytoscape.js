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
