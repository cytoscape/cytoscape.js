import { expect } from 'chai';
import { GraphStore } from '../src/gpu/store/graph-store.mjs';
import { FLAG_ALIVE, FLAG_SELECTED, NO_SLOT } from '../src/gpu/contract.mjs';

/*
Round 19.1 — store-core slot compaction.  `GraphStore.compact()` moves
live elements down to a dense slot prefix with a *monotone* remap
(relative slot order preserved — the stable-draw-order call), shrinks
`highWater` to the live count (and capacity when warranted), rewrites
`edge.endpoints` for node moves, fuses the id index and insertion-order
list, rebuilds CSR, and signals the renderer through the `resized`
flags.  Moved elements get fresh generations at their new slots so
stale refs *fail* plain validation (they route to the 19.3 forwarding
repair); vacated positions bump too.
*/

/** Build a store with `n` nodes 'n0'..'n{n-1}' and a chain edge per pair. */
function chainStore( n ){
  const store = new GraphStore();

  for( let i = 0; i < n; i++ ){
    store.addNode( `n${i}`, i * 10, i );
  }

  for( let i = 0; i + 1 < n; i++ ){
    store.addEdge( `e${i}`, `n${i}`, `n${i + 1}` );
  }

  return store;
}

/** Remove node `n{i}` and its incident edges (store-level cascade). */
function removeNodeCascade( store, i ){
  const ref = store.lookup( `n${i}` );

  for( const edgeSlot of store.adj.connectedEdges( ref.slot ) ){
    store.removeEdge( edgeSlot );
  }

  store.removeNode( ref.slot );
}

describe( 'gpu/store: slot compaction (19.1)', function(){

  it( 'is a no-op on a hole-free store', function(){
    const store = chainStore( 8 );
    const hwN = store.highWater( 'nodes' );
    const genBefore = Array.from( store.table( 'nodes' ).gen );

    const result = store.compact();

    expect( result.nodes ).to.equal( null );
    expect( result.edges ).to.equal( null );
    expect( store.highWater( 'nodes' ) ).to.equal( hwN );
    expect( Array.from( store.table( 'nodes' ).gen ) ).to.eql( genBefore );
    expect( store.lookup( 'n3' ).slot ).to.equal( 3 );
  } );

  it( 'compacts the shrink profile down to a dense prefix', function(){
    const store = chainStore( 100 );

    // cut to 10 nodes: keep every 10th (n0, n10, ..., n90)
    for( let i = 0; i < 100; i++ ){
      if( i % 10 !== 0 ){ removeNodeCascade( store, i ); }
    }

    expect( store.count( 'nodes' ) ).to.equal( 10 );
    expect( store.count( 'edges' ) ).to.equal( 0 );
    expect( store.highWater( 'nodes' ) ).to.equal( 100 );

    const result = store.compact();

    expect( result.nodes ).to.not.equal( null );
    expect( result.nodes.moved ).to.be.greaterThan( 0 );
    expect( store.highWater( 'nodes' ) ).to.equal( 10 );
    expect( store.highWater( 'edges' ) ).to.equal( 0 );

    // ids resolve to the dense prefix, in preserved relative order
    for( let k = 0; k < 10; k++ ){
      const ref = store.lookup( `n${k * 10}` );

      expect( ref.slot ).to.equal( k );
      expect( store.idAt( 'nodes', k ) ).to.equal( `n${k * 10}` );
    }
  } );

  it( 'moves positions and flags with their elements', function(){
    const store = chainStore( 20 );
    const sel = store.lookup( 'n15' );

    store.setFlag( 'nodes', sel.slot, FLAG_SELECTED, true );

    for( let i = 0; i < 15; i++ ){ removeNodeCascade( store, i ); }
    removeNodeCascade( store, 16 );

    store.compact();

    const moved = store.lookup( 'n15' );

    expect( moved.slot ).to.equal( 0 );
    expect( store.getX( moved.slot ) ).to.equal( 150 );
    expect( store.getY( moved.slot ) ).to.equal( 15 );
    expect( store.hasFlag( 'nodes', moved.slot, FLAG_SELECTED ) ).to.equal( true );
    expect( store.hasFlag( 'nodes', moved.slot, FLAG_ALIVE ) ).to.equal( true );
  } );

  it( 'rewrites edge endpoints and rebuilds adjacency on node moves', function(){
    const store = chainStore( 30 );

    // remove the first 20 nodes but keep the tail chain n20..n29 intact
    for( let i = 0; i < 20; i++ ){ removeNodeCascade( store, i ); }

    expect( store.count( 'nodes' ) ).to.equal( 10 );
    expect( store.count( 'edges' ) ).to.equal( 9 );

    store.compact();

    expect( store.highWater( 'nodes' ) ).to.equal( 10 );
    expect( store.highWater( 'edges' ) ).to.equal( 9 );

    const endpoints = store.column( 'edge.endpoints' );

    for( let k = 0; k + 1 < 10; k++ ){
      const e = store.lookup( `e${20 + k}` );
      const src = store.lookup( `n${20 + k}` );
      const tgt = store.lookup( `n${21 + k}` );

      expect( endpoints[ e.slot * 2 ] ).to.equal( src.slot );
      expect( endpoints[ e.slot * 2 + 1 ] ).to.equal( tgt.slot );

      // adjacency answers over the new slots
      expect( store.adj.outDegree( src.slot ) ).to.equal( 1 );
      expect( Array.from( store.adj.outEdges( src.slot ) ) ).to.contain( e.slot );
    }

    // total degree of an interior node
    const mid = store.lookup( 'n25' );

    expect( store.adj.outDegree( mid.slot ) + store.adj.inDegree( mid.slot ) ).to.equal( 2 );
  } );

  it( 'preserves relative slot order (monotone remap)', function(){
    const store = chainStore( 50 );

    for( let i = 0; i < 50; i += 3 ){ removeNodeCascade( store, i ); }

    const liveBefore = store.slotsOrdered( 'nodes' ).map( s => store.idAt( 'nodes', s ) );
    const result = store.compact();

    const liveAfter = store.slotsOrdered( 'nodes' ).map( s => store.idAt( 'nodes', s ) );

    expect( liveAfter ).to.eql( liveBefore );

    // monotonicity: new slots ascend in old-slot order
    const remap = result.nodes.remap;
    let prev = -1;

    for( let old = 0; old < remap.length; old++ ){
      if( remap[ old ] === NO_SLOT ){ continue; }

      expect( remap[ old ] ).to.be.greaterThan( prev );
      prev = remap[ old ];
    }
  } );

  it( 'returns a remap with NO_SLOT holes and forwards refs to moved elements', function(){
    const store = chainStore( 10 );

    const keepRef = store.ref( 'nodes', store.lookup( 'n0' ).slot ); // unmoved prefix
    const moveRef = store.ref( 'nodes', store.lookup( 'n9' ).slot ); // will move
    const deadRef = store.ref( 'nodes', store.lookup( 'n4' ).slot ); // will be removed

    for( let i = 1; i < 9; i++ ){ removeNodeCascade( store, i ); }

    const result = store.compact();
    const remap = result.nodes.remap;

    expect( remap[ keepRef.slot ] ).to.equal( 0 );
    expect( remap[ moveRef.slot ] ).to.equal( 1 );
    expect( remap[ 4 ] ).to.equal( NO_SLOT );

    // the unmoved element's ref stays current untouched; the moved one's
    // repairs in place through the forwarding chain (19.3); a removed
    // element's ref stays dead — repair never resurrects
    expect( store.isCurrent( keepRef ) ).to.equal( true );
    expect( store.isCurrent( moveRef ) ).to.equal( true );
    expect( moveRef.slot ).to.equal( 1 );
    expect( store.isCurrent( deadRef ) ).to.equal( false );
    expect( store.lookup( 'n9' ).slot ).to.equal( 1 );
  } );

  it( 'shrinks capacity on the peak-then-small profile', function(){
    const store = chainStore( 2000 );

    for( let i = 0; i < 2000; i++ ){
      if( i >= 16 ){ removeNodeCascade( store, i ); }
    }

    const capBefore = store.capacity( 'nodes' );

    store.compact();

    expect( store.capacity( 'nodes' ) ).to.be.lessThan( capBefore );
    expect( store.capacity( 'nodes' ) ).to.be.at.least( store.count( 'nodes' ) );
  } );

  it( 'marks both compacted groups resized for the renderer', function(){
    const store = chainStore( 40 );

    store.takeDelta(); // drain construction dirt

    for( let i = 10; i < 30; i++ ){ removeNodeCascade( store, i ); }

    store.takeDelta(); // drain removal dirt

    store.compact();

    const delta = store.takeDelta();

    expect( delta.resized.nodes ).to.equal( true );
    expect( delta.resized.edges ).to.equal( true );
  } );

  it( 'answers columnar scans over the compacted range', function(){
    const store = chainStore( 60 );

    for( let i = 0; i < 60; i += 2 ){
      const ref = store.lookup( `n${i}` );

      store.setFlag( 'nodes', ref.slot, FLAG_SELECTED, true );
    }

    for( let i = 1; i < 60; i += 4 ){ removeNodeCascade( store, i ); }

    store.compact();

    const out = [];

    store.scanRefsInto( out, 0, 'nodes', FLAG_ALIVE | FLAG_SELECTED, FLAG_ALIVE | FLAG_SELECTED );

    const ids = out.map( ref => store.idAt( 'nodes', ref.slot ) ).sort();
    const expected = [];

    for( let i = 0; i < 60; i += 2 ){ expected.push( `n${i}` ); }

    expect( ids ).to.eql( expected.sort() );
  } );

  it( 'supports churn: interleaved remove/re-add then compaction', function(){
    const store = chainStore( 30 );

    for( let i = 0; i < 30; i += 2 ){ removeNodeCascade( store, i ); }

    for( let i = 0; i < 5; i++ ){
      store.addNode( `fresh${i}`, i, -i );
    }

    store.compact();

    expect( store.highWater( 'nodes' ) ).to.equal( store.count( 'nodes' ) );

    for( let i = 1; i < 30; i += 2 ){
      expect( store.idAt( 'nodes', store.lookup( `n${i}` ).slot ) ).to.equal( `n${i}` );
    }

    for( let i = 0; i < 5; i++ ){
      const ref = store.lookup( `fresh${i}` );

      expect( store.getX( ref.slot ) ).to.equal( i );
      expect( store.getY( ref.slot ) ).to.equal( -i );
    }
  } );

  it( 'is idempotent', function(){
    const store = chainStore( 25 );

    for( let i = 5; i < 20; i++ ){ removeNodeCascade( store, i ); }

    const first = store.compact();

    expect( first.nodes ).to.not.equal( null );

    const second = store.compact();

    expect( second.nodes ).to.equal( null );
    expect( second.edges ).to.equal( null );
  } );

  it( 'keeps working after compaction: adds allocate above the dense prefix', function(){
    const store = chainStore( 12 );

    for( let i = 3; i < 9; i++ ){ removeNodeCascade( store, i ); }

    store.compact();

    const hw = store.highWater( 'nodes' );
    const slot = store.addNode( 'post', 1, 2 );

    expect( slot ).to.equal( hw );
    expect( store.lookup( 'post' ).slot ).to.equal( slot );

    const e = store.addEdge( 'postEdge', 'n0', 'post' );
    const endpoints = store.column( 'edge.endpoints' );

    expect( endpoints[ e * 2 ] ).to.equal( store.lookup( 'n0' ).slot );
    expect( endpoints[ e * 2 + 1 ] ).to.equal( slot );
  } );
} );
