import { expect } from 'chai';

import cytoscape from '../../src/index.mjs';
import { deserializeElements, serializeElements } from '../../src/wire.mjs';

/*
Round 48.3: the binary wire format under corruption.

The format's contract is that a malformed buffer **throws** — it does not
crash, and it does not silently load a wrong graph. Round 30 pinned two
malformed-input guards by hand; this looks for the ones nobody thought of,
by flipping bytes in a valid buffer and requiring every outcome to be one of
two things: a thrown `Error`, or a graph that loads and answers queries.

It found one on its first run, which is the argument for the file existing.
A byte landing in a dictionary column's zero-copy `indices` made an index of
2,566,914,049 against a 3-entry dictionary; `deserializeElements` accepted
it (it validates nothing it reads zero-copy, by design) and the ingest then
inflated a plain refcount array to that length and reduced over it —
`cytoscape( { elements: buffer } )` went from 0.6 ms to never returning,
with no error raised anywhere. Fixed in `DataStore.ingestColumn`, where both
branches already walk every index so the guard is free; pinned
deterministically in `test/wire.mjs`, and left here as the search that finds
the next one.

Determinism matters for a fuzzer that gates a build: the mutations come from
a seeded LCG, so a failure is reproducible from the case index alone.
*/

const SEED = 0x5eed;
const CASES = 250;

function makeBuffer(){
  const nodes = [];
  const edges = [];

  for( let i = 0; i < 40; i++ ){
    nodes.push( {
      data: { id: `n${i}`, w: i, tag: `t${i % 3}`, flag: i % 2 === 0 },
      position: { x: i, y: -i }
    } );
  }

  for( let i = 1; i < 40; i++ ){
    edges.push( { data: { id: `e${i}`, source: `n${i - 1}`, target: `n${i}` } } );
  }

  return serializeElements( { nodes, edges } );
}

/** A small deterministic PRNG — a fuzz failure must be reproducible. */
function lcg( seed ){
  let state = seed;

  return () => {
    state = ( state * 1103515245 + 12345 ) & 0x7fffffff;

    return state / 0x7fffffff;
  };
}

const GOOD = makeBuffer();

/** One mutated copy: 1–3 bytes replaced in the given region. */
function mutate( rnd, region ){
  const buffer = GOOD.slice( 0 );
  const bytes = new Uint8Array( buffer );
  const flips = 1 + ( rnd() * 3 | 0 );
  const at = [];

  for( let i = 0; i < flips; i++ ){
    const pos = region( rnd, bytes.length );

    at.push( pos );
    bytes[ pos ] = rnd() * 256 | 0;
  }

  return { buffer, at };
}

const REGIONS = {
  // the header carries magic, version, counts, flags and the total length
  header: ( rnd ) => rnd() * 24 | 0,
  // the sections: ids, positions, endpoints, selection, the data blocks
  body: ( rnd, len ) => 24 + ( rnd() * ( len - 24 ) | 0 ),
  // where the data() blocks live, which is where the format is most
  // self-describing and so most corruptible
  tail: ( rnd, len ) => ( len * 0.7 + rnd() * len * 0.3 ) | 0
};

describe( 'soak: wire-format fuzzing', () => {
  it( 'has a valid buffer to corrupt', () => {
    // The control: if the fixture stopped being a real payload, every case
    // below would throw immediately and the suite would pass having tested
    // nothing.
    const parsed = deserializeElements( GOOD );

    expect( parsed.nodes.count ).to.equal( 40 );
    expect( parsed.edges.count ).to.equal( 39 );
    expect( parsed.nodes.data.tag.dict.length ).to.be.greaterThan( 1 );

    const cy = cytoscape( { elements: GOOD } );

    expect( cy.elements().length ).to.equal( 79 );
    cy.destroy();
  } );

  for( const [ name, region ] of Object.entries( REGIONS ) ){
    it( `survives corruption in the ${name}`, () => {
      const rnd = lcg( SEED );
      const outcomes = { threw: 0, loaded: 0, loadThrew: 0 };
      let slowest = 0;

      for( let i = 0; i < CASES; i++ ){
        const { buffer, at } = mutate( rnd, region );
        const started = performance.now();
        let parsed = null;

        try {
          parsed = deserializeElements( buffer );
        } catch( e ){
          expect( e, `case ${i} @${at} threw a non-Error` ).to.be.an.instanceOf( Error );
          outcomes.threw++;
        }

        if( parsed != null ){
          try {
            const cy = cytoscape( { elements: buffer } );

            // exercise it: a graph that loads must also answer
            cy.elements().map( ele => ele.id() );
            cy.nodes().forEach( n => n.data() );
            cy.destroy();
            outcomes.loaded++;
          } catch( e ){
            expect( e, `case ${i} @${at} threw a non-Error on load` ).to.be.an.instanceOf( Error );
            outcomes.loadThrew++;
          }
        }

        const elapsed = performance.now() - started;

        slowest = Math.max( slowest, elapsed );

        // The bound that would have caught the round-48.3 defect. A
        // corrupt buffer must fail fast; the fixture is 40 nodes, and a
        // clean load is well under a millisecond.
        expect( elapsed, `case ${i} @${at} took ${elapsed.toFixed( 0 )} ms` ).to.be.below( 250 );
      }

      // Non-vacuity, both ways: a run where nothing was rejected, or
      // nothing loaded, is exercising one path and calling it two.
      expect( outcomes.threw + outcomes.loadThrew + outcomes.loaded ).to.equal( CASES );
      expect( outcomes.threw + outcomes.loadThrew, `${name}: nothing was rejected` )
        .to.be.greaterThan( 0 );
      expect( outcomes.loaded, `${name}: nothing loaded` ).to.be.greaterThan( 0 );

      // And the shape each region should have. The header is almost all
      // structure, so most corruption of it is caught; the body is mostly
      // payload bytes where any value is legal (a position float, an id
      // character), so most of that still loads. The tail is the data
      // blocks — self-describing, and so mostly rejected — which is why it
      // gets no ratio of its own: measured at 17/250 loading, and a
      // threshold written from the header's intuition would have failed
      // the library for behaving correctly.
      if( name === 'header' ){
        expect( outcomes.threw, 'header corruption should usually be rejected' )
          .to.be.greaterThan( CASES / 4 );
      } else if( name === 'body' ){
        // measured at 62/250 after round 48.3's guards, which reject a good
        // deal more than the first run did — the threshold is a
        // non-vacuity floor with margin, not a pinned distribution
        expect( outcomes.loaded, 'body corruption is often a legal payload byte' )
          .to.be.greaterThan( CASES / 10 );
      }

      expect( slowest, 'no case should be anywhere near the per-case bound' ).to.be.below( 250 );
    } );
  }

  it( 'never loads a graph it cannot then answer for', () => {
    // The subtler failure than a throw: a buffer that loads into a graph
    // whose invariants are broken — ids that do not resolve, edges whose
    // endpoints are not in the graph, a length that disagrees with what
    // iteration yields.
    const rnd = lcg( SEED ^ 0xa5a5 );

    for( let i = 0; i < CASES; i++ ){
      const { buffer } = mutate( rnd, REGIONS.body );
      let cy = null;

      try {
        cy = cytoscape( { elements: buffer } );
      } catch( e ){
        expect( e ).to.be.an.instanceOf( Error );
        continue;
      }

      const ids = cy.elements().map( ele => ele.id() );

      expect( ids.length, `case ${i}: elements() disagrees with its own length` )
        .to.equal( cy.elements().length );
      expect( new Set( ids ).size, `case ${i}: duplicate ids after load` ).to.equal( ids.length );

      cy.edges().forEach( edge => {
        expect( edge.source().length, `case ${i}: edge with no source` ).to.equal( 1 );
        expect( edge.target().length, `case ${i}: edge with no target` ).to.equal( 1 );
      } );

      cy.destroy();
    }
  } );
} );
