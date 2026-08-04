import { expect } from 'chai';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import cytoscape from '../../src/index.mjs';

/*
Round 43: the debug harness, checked from Node.

`debug/` had no coverage of any kind, and it cost two silent failures at once:

  * round 42 moved the v3 tree to `v3/` and left `debug/networks.js` pointing at
    `../webgl/`, so four of the seven networks 404'd.  The page renders nothing
    when that happens (the fetch rejected with no `.catch`), and nothing in the
    suite noticed.  My round-42 asset check read HTML `src`/`href` attributes,
    which is exactly the wrong shape of check: these URLs are fetched from JS.
  * `sanitizeStyle` had drifted so far behind the style engine that every
    fixture rendered flat and unlabelled — a style regression that no test could
    have caught, because there was no test.

So this spec asserts the two things a headless process actually can:

  1. every fixture a network names **exists on disk** at the path the page will
     ask the server for, and
  2. every network's hand-authored sheet **compiles**, against that fixture's
     real data, through the real `cytoscape()` entry point.

(2) is the valuable half: v4 throws on an unknown style property or a mapper on
a non-mappable channel, so a sheet that has drifted fails here rather than in a
browser nobody opened.

What it deliberately does *not* check is how any of it looks.  That is what
`npm run watch` is for.
*/

const HERE = dirname( fileURLToPath( import.meta.url ) );
const ROOT = resolve( HERE, '../..' );
const DEBUG = join( ROOT, 'debug' );

/** Load one of the harness's browser globals as a script. */
const loadGlobal = name => {
  const src = readFileSync( join( DEBUG, `${name}.js` ), 'utf8' );
  // the harness's export hook is `if( module && module.exports )`, so the
  // placeholder has to be truthy
  const ctx = createContext( { module: { exports: {} }, console } );

  runInContext( src, ctx );

  return ctx.module.exports;
};

const networks = loadGlobal( 'networks' );
const fixtures = loadGlobal( 'fixtures' );
const styles = loadGlobal( 'styles' );

/** The path the browser would fetch, resolved against the repo root. */
const fixturePath = url => resolve( DEBUG, url );

/** A network's elements, from disk or from the generator. */
const elementsFor = ( id, def ) => {
  if( def.generated ){
    // the generators are random; a small size keeps the spec quick and still
    // exercises every branch (parents, nesting, compound loops)
    return fixtures.generate( def.generated, '200x400' );
  }

  const json = JSON.parse( readFileSync( fixturePath( def.url ), 'utf8' ) );

  return fixtures.derive( def.derive, fixtures.toGpuElements( json.elements ) );
};

describe( 'debug harness (round 43)', function(){

  const entries = Object.entries( networks );

  it( 'offers a non-trivial set of networks', function(){
    // the guard every audit here carries: a loader that stops finding networks
    // must not read as "all networks fine"
    expect( entries.length ).to.be.at.least( 6 );
  } );

  describe( 'every fixture resolves', function(){

    for( const [ id, def ] of entries ){
      if( def.generated ){ continue; }

      it( `${id} -> ${def.url}`, function(){
        expect(
          existsSync( fixturePath( def.url ) ),
          `${def.url} does not exist; the page will 404 and render nothing`
        ).to.equal( true );
      } );
    }

  } );

  describe( 'every sheet compiles against its own fixture', function(){

    for( const [ id, def ] of entries ){
      it( id, function(){
        this.timeout?.( 120000 );

        const elements = elementsFor( id, def );

        for( const kind of styles.kinds ){
          const sheet = styles.sheet( kind, id, elements, def );

          // headless: no container, so this is the model + style engine only
          const cy = cytoscape( {
            elements: { nodes: elements.nodes, edges: elements.edges },
            style: sheet
          } );

          expect( cy.nodes().length, `${id}/${kind} loaded no nodes` ).to.be.at.least( 1 );
          cy.destroy();
        }
      } );
    }

  } );

  describe( 'the sheets say what they mean', function(){

    it( 'labels resolve to the network\'s own key, not to ids', function(){
      // the defect round 43 fixed: `?labels=true` used to *replace* the sheet's
      // mapping with data(id), which showed UUIDs on em-web and SUIDs on NDEx
      const def = networks[ 'ndex-x-large' ];
      const elements = elementsFor( 'ndex-x-large', def );
      const cy = cytoscape( {
        elements: { nodes: elements.nodes.slice( 0, 50 ), edges: [] },
        style: styles.sheet( 'production', 'ndex-x-large', elements, def )
      } );
      const first = cy.nodes()[ 0 ];

      expect( first.label(), 'the label fell back to the id' ).to.not.equal( first.id() );
      expect( first.label() ).to.equal( first.data( 'name' ) );
      cy.destroy();
    } );

    it( 'the EnrichmentMap sheet maps NES to a diverging scale', function(){
      const def = networks[ 'em-web' ];
      const elements = elementsFor( 'em-web', def );
      const cy = cytoscape( {
        elements: { nodes: elements.nodes, edges: [] },
        style: styles.sheet( 'production', 'em-web', elements, def )
      } );
      const up = cy.nodes().max( n => n.data( 'NES' ) ).ele;
      const down = cy.nodes().min( n => n.data( 'NES' ) ).ele;

      // the whole point of the port: one declarative mapper reproduces what
      // EnrichmentMap writes as a memoized per-element function
      expect( up.style( 'background-color' ) ).to.not.equal( down.style( 'background-color' ) );
      expect( up.data( 'NES' ) ).to.be.greaterThan( 0 );
      expect( down.data( 'NES' ) ).to.be.lessThan( 0 );
      cy.destroy();
    } );

    it( 'the clustered variant really is compound', function(){
      const def = networks[ 'em-web-clustered' ];
      const elements = elementsFor( 'em-web-clustered', def );
      const cy = cytoscape( {
        elements: { nodes: elements.nodes, edges: [] },
        style: styles.sheet( 'production', 'em-web-clustered', elements, def )
      } );

      // 41 MCODE clusters over 354 of the 569 nodes, as shipped
      expect( cy.nodes( { parent: true } ).length ).to.be.at.least( 20 );
      expect( cy.nodes( { child: true } ).length ).to.be.at.least( 100 );
      cy.destroy();
    } );

  } );

} );
