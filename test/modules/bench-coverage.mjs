import { audit, mentions } from '../../scripts/bench-coverage.mjs';
import { expect } from 'chai';

// Round 33.12.  The precedent is test/modules/throw-coverage.mjs: a
// tool's own matcher gets specs, because a matcher that silently stops
// matching reads as a clean bill of health.  What is pinned here is
// mostly the audit's *limits* — it over- and under-detects by design,
// and a reader who does not know that will quote its number as if it
// were the throw-coverage number.

describe( 'gpu benchmark coverage audit', function(){

  describe( 'mentions()', function(){
    it( 'matches call-shaped and quoted uses', function(){
      expect( mentions( 'cy.elementsInBox( 1, 2, 3, 4 )', 'elementsInBox' ) ).to.equal( true );
      expect( mentions( 'const f = boundingBox( x )', 'boundingBox' ) ).to.equal( true );
      expect( mentions( "cy.on( 'position', h )", 'position' ) ).to.equal( true );
    } );

    it( 'does not match a bare word', function(){
      // a name in prose is not a use
      expect( mentions( 'the boundingBox of a node', 'boundingBox' ) ).to.equal( false );
      expect( mentions( 'renderedOuterHeight is untested', 'renderedOuterHeight' ) ).to.equal( false );
    } );

    it( 'over-detects, which is why the audit never gates', function(){
      // a comment mentioning the call counts the same as the call, and a
      // v3-side call counts the same as a v4 one — both are recorded in
      // the script header as the reason it reports rather than gates
      expect( mentions( '// we never call data( k ) here', 'data' ) ).to.equal( true );
      expect( mentions( 'v3Node.style( name )', 'style' ) ).to.equal( true );
    } );

    it( 'escapes regex metacharacters in a member name', function(){
      expect( () => mentions( 'x', '$id' ) ).to.not.throw();
      expect( mentions( 'cy.$id( "n1" )', '$id' ) ).to.equal( true );
    } );
  } );

  describe( 'audit()', function(){
    it( 'reports per public-API file, counting callable members only', function(){
      const { perFile, covered, total, fields } = audit();

      expect( perFile.length ).to.be.greaterThan( 0 );
      expect( total ).to.be.greaterThan( 100 );  // the surface is large
      expect( covered ).to.be.at.most( total );
      expect( fields ).to.be.greaterThan( 0 );   // fields exist and are excluded

      const core = perFile.find( f => f.file === 'src/core.mts' );

      expect( core ).to.not.equal( undefined );
      expect( core.covered ).to.be.greaterThan( 0 );
      expect( core.uncovered ).to.be.an( 'array' );
    } );

    it( 'names an uncovered member with its file and line', function(){
      const { perFile } = audit();
      const withGaps = perFile.filter( f => f.uncovered.length > 0 );

      // the engine-internal files always have gaps: their members are
      // reached through the core, which a name scan cannot see
      expect( withGaps.length ).to.be.greaterThan( 0 );
      expect( withGaps[ 0 ].uncovered[ 0 ] ).to.match( /src\/[\w./-]+:\d+/ );
    } );
  } );

} );
