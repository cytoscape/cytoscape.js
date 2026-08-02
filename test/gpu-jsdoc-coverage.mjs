import { expect } from 'chai';
import { audit, PUBLIC_API } from '../scripts/gpu-jsdoc-coverage.mjs';

/*
Round 26: JSDoc is the documentation source of truth for v4 (PLAN.md
round 26, design call 1) — the release documentation is generated from
these comments rather than hand-written into a parallel markdown tree,
so the comments have to actually exist and stay existing.

Design call 5: coverage is enforced, not aspirational.  Without a gate
a 46%-covered surface silently returns to 46%.  Two mechanisms:

  - COMPLETE — files whose public surface is fully documented.  These
    are a hard ratchet: adding an undocumented public member to one of
    them fails this spec.  Each round-26 pass adds the files it closed.
  - The tier floors — a coarse net for the files not yet complete, so
    the overall number cannot slide backwards between passes.

Raise the floors when a pass raises the number; never lower them.
*/

/** Public-API files whose public members are 100% documented. */
const COMPLETE = [
  'src/gpu/core.mts',
  'src/gpu/viewport.mts'
];

/** Ratcheting tier floors, in percent. Raise as passes land. */
const PUBLIC_FLOOR = 58;
const INTERNAL_FLOOR = 49;

describe('gpu/docs: JSDoc coverage of the v4 surface (round 26)', function(){

  const result = audit();

  describe('the completed files stay complete', function(){

    for( const file of COMPLETE ){
      it(`${file} documents every public member`, function(){
        const entry = result.files.find( f => f.file === file );

        expect( entry, `${file} is not a src/gpu source file` ).to.exist;
        expect(
          entry.missing,
          `undocumented public members:\n  ${entry.missing.join( '\n  ' )}`
        ).to.deep.equal( [] );
      });
    }

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
