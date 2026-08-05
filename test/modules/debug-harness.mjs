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

    it( 'the compound fixture lays out into disjoint parent boxes', function(){
      // The maintainer's report: the compound fixture "is not laid out like it
      // is in the debug page in v3, making it hard to read".  Two causes, both
      // in this directory — round 43 re-sorted the node list while claiming a
      // verbatim port of `v3/debug/compound.js`, and dropped that page's
      // `cols: 3`.  Grid places leaves in declaration order and parents derive
      // their boxes from where their children land, so between them the
      // families interleaved and n1's auto-box swallowed n2's.
      //
      // The property worth pinning is the readable one rather than the
      // transcription: two parents that are not ancestor and descendant must
      // not overlap.  It fails on either cause alone.
      const def = networks[ 'compound-fixture' ];
      const elements = elementsFor( 'compound-fixture', def );
      const cy = cytoscape( {
        elements: { nodes: elements.nodes, edges: elements.edges },
        style: styles.sheet( 'production', 'compound-fixture', elements, def ),
        layout: def.layout,
        // grid picks its column count from the container's aspect ratio when
        // the layout does not say, so a *headless* default (800 x 600) picks 3
        // and the spec passes with `cols` removed — measured, and it is the
        // vacuous-spec trap this repo keeps re-learning.  These are the debug
        // page's real dimensions, where the default is 2.
        headlessWidth: 930, headlessHeight: 900
      } );
      const parents = cy.nodes( { parent: true } );

      expect( parents.length, 'the fixture stopped being compound' ).to.equal( 4 );

      for( let i = 0; i < parents.length; i++ ){
        for( let j = i + 1; j < parents.length; j++ ){
          const a = parents[ i ];
          const b = parents[ j ];

          if( a.isAncestorOf?.( b ) || b.isAncestorOf?.( a )
            || a.ancestors().contains( b ) || b.ancestors().contains( a ) ){ continue; }

          const ba = a.boundingBox();
          const bb = b.boundingBox();
          const overlaps = ba.x1 < bb.x2 && bb.x1 < ba.x2 && ba.y1 < bb.y2 && bb.y1 < ba.y2;

          expect( overlaps, `${a.id()} and ${b.id()} overlap: unrelated parents must not` ).to.equal( false );
        }
      }

      // the parents block overlays the nodes block, so a `shape` mapper on the
      // nodes group reaches parents; v3's `:parent` default is a rectangle and
      // the sheet has to say so
      expect( parents[ 0 ].style( 'shape' ) ).to.equal( 'rectangle' );
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

  describe( 'the event log', function(){

    /* The maintainer's second report: box selection raised Chrome's
       "[Violation] Forced reflow while executing JavaScript took 40ms".
       It was this section, not the library.  `append` used to write a row and
       then read `el.scrollHeight` to keep the view pinned to the bottom, and a
       DOM write followed by a layout read forces a synchronous layout.  Box
       selection emits `box` + `boxselect` + `select` per element, so on em-web
       one gesture cost 22406 forced layouts — measured 5659 ms of layout in a
       6055 ms pointerup handler, against 40 ms with this section's filter off.

       So the property to hold is "the log reads layout once per frame, not
       once per event", which is checkable here with a DOM stub: the real
       failure is a *ratio*, and a ratio does not need a browser. */
    const runEventLog = ( { events, frames } ) => {
      const reads = { scrollHeight: 0 };
      const rows = [];
      const raf = [];
      const el = {
        get scrollHeight(){ reads.scrollHeight++; return rows.length * 10; },
        set scrollTop( _v ){},
        get childElementCount(){ return rows.length; },
        get firstChild(){ return rows[ 0 ]; },
        appendChild( n ){ rows.push( ...( n.__frag ?? [ n ] ) ); },
        removeChild( n ){ rows.splice( rows.indexOf( n ), 1 ); },
        set textContent( _v ){ rows.length = 0; },
        addEventListener(){},
        checked: false
      };
      const node = () => ( { className: '', textContent: '' } );
      const handlers = [];
      const ctx = createContext( {
        console,
        $: () => el,
        $$: () => [],
        document: {
          createElement: node,
          createDocumentFragment: () => {
            const frag = [];

            return { __frag: frag, appendChild: n => frag.push( n ) };
          }
        },
        requestAnimationFrame: fn => raf.push( fn ),
        window: { onCy: fn => fn( { on: ( type, a, b ) => handlers.push( { type, fn: b ?? a } ) } ) }
      } );

      runInContext( readFileSync( join( DEBUG, 'events.js' ), 'utf8' ), ctx );

      const target = { id: () => 'n1' };
      // an enabled family and not one of the NOISY names, so nothing gates it
      const handler = handlers.find( h => h.type === 'tapstart' );

      expect( handler, 'events.js stopped registering tapstart' ).to.not.equal( undefined );

      const fire = () => handler.fn( { target } );

      for( let f = 0; f < frames; f++ ){
        for( let i = 0; i < events; i++ ){ fire(); }

        for( const fn of raf.splice( 0 ) ){ fn(); }
      }

      return { reads, rowCount: rows.length };
    };

    it( 'reads layout once per frame, not once per event', function(){
      const many = runEventLog( { events: 5000, frames: 1 } );

      expect( many.reads.scrollHeight, '5000 events must not force 5000 layouts' ).to.equal( 1 );
      expect( many.rowCount, 'the visible window is still capped' ).to.equal( 400 );

      // the control for the control: the count really does track frames
      const spread = runEventLog( { events: 10, frames: 7 } );

      expect( spread.reads.scrollHeight ).to.equal( 7 );
    } );

  } );

} );
