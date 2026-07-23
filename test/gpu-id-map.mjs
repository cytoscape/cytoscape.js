import { expect } from 'chai';
import { IdMap } from '../src/gpu/store/id-map.mjs';

const packIds = ids => {
  const encoder = new TextEncoder();
  const parts = ids.map( id => encoder.encode( id ?? '' ) );
  const offsets = new Uint32Array( ids.length + 1 );

  let total = 0;

  for( let i = 0; i < parts.length; i++ ){
    total += parts[ i ].length;
    offsets[ i + 1 ] = total;
  }

  const blob = new Uint8Array( total );

  for( let i = 0; i < parts.length; i++ ){ blob.set( parts[ i ], offsets[ i ] ); }

  return { offsets, blob };
};

describe('gpu/store: id map', function(){

  it('round-trips set/get/has/idAt across both groups', function(){
    const ids = new IdMap();

    ids.set( 'a', 'nodes', 0 );
    ids.set( 'b', 'nodes', 1 );
    ids.set( 'ab', 'edges', 0 );

    expect( ids.get( 'a' ) ).to.deep.equal( { group: 'nodes', slot: 0 } );
    expect( ids.get( 'ab' ) ).to.deep.equal( { group: 'edges', slot: 0 } );
    expect( ids.get( 'nope' ) ).to.be.undefined;
    expect( ids.has( 'b' ) ).to.be.true;
    expect( ids.idAt( 'nodes', 1 ) ).to.equal( 'b' );
    expect( ids.idAt( 'edges', 0 ) ).to.equal( 'ab' );
    expect( ids.idAt( 'nodes', 99 ) ).to.be.undefined;
    expect( ids.size ).to.equal( 3 );
  });

  it('throws on duplicate ids, across groups too', function(){
    const ids = new IdMap();

    ids.set( 'x', 'nodes', 0 );

    expect( () => ids.set( 'x', 'nodes', 1 ) ).to.throw( /second element/ );
    expect( () => ids.set( 'x', 'edges', 0 ) ).to.throw( /second element/ );
  });

  it('removes and allows re-adding the same id', function(){
    const ids = new IdMap();

    ids.set( 'a', 'nodes', 0 );
    ids.remove( 'a' );

    expect( ids.has( 'a' ) ).to.be.false;
    expect( ids.idAt( 'nodes', 0 ) ).to.be.undefined;
    expect( ids.size ).to.equal( 0 );

    ids.set( 'a', 'nodes', 3 );

    expect( ids.get( 'a' ) ).to.deep.equal( { group: 'nodes', slot: 3 } );
  });

  it('ingests packed ids without strings and resolves them', function(){
    const ids = new IdMap();
    const slots = new Uint32Array([ 0, 1, 2 ]);

    ids.setBulk( 'nodes', slots, packIds([ 'a', 'bee', 'c' ]), () => 'gen' );

    expect( ids.get( 'bee' ) ).to.deep.equal( { group: 'nodes', slot: 1 } );
    expect( ids.idAt( 'nodes', 2 ) ).to.equal( 'c' );
    expect( ids.size ).to.equal( 3 );
  });

  it('auto-generates on packed holes', function(){
    const ids = new IdMap();
    let n = 0;

    ids.setBulk( 'nodes', new Uint32Array([ 0, 1, 2 ]), packIds([ 'a', undefined, 'c' ]), () => 'gen-' + n++ );

    expect( ids.idAt( 'nodes', 1 ) ).to.equal( 'gen-0' );
    expect( ids.get( 'gen-0' ) ).to.deep.equal( { group: 'nodes', slot: 1 } );
  });

  it('throws on duplicates inside a packed bulk', function(){
    const ids = new IdMap();

    expect( () => ids.setBulk( 'nodes', new Uint32Array([ 0, 1 ]), packIds([ 'dup', 'dup' ]), () => 'g' ) )
      .to.throw( /second element with id 'dup'/ );
  });

  it('handles non-ASCII ids through both forms', function(){
    const ids = new IdMap();

    ids.set( 'nöde', 'nodes', 0 );
    ids.setBulk( 'nodes', new Uint32Array([ 1 ]), packIds([ '🚀' ]), () => 'g' );

    expect( ids.get( 'nöde' ) ).to.deep.equal( { group: 'nodes', slot: 0 } );
    expect( ids.get( '🚀' ) ).to.deep.equal( { group: 'nodes', slot: 1 } );
    expect( ids.idAt( 'nodes', 0 ) ).to.equal( 'nöde' );
    expect( ids.idAt( 'nodes', 1 ) ).to.equal( '🚀' );
  });

  it('survives growth and rehash with removals mixed in', function(){
    const ids = new IdMap();
    const N = 10000;

    for( let i = 0; i < N; i++ ){ ids.set( 'id-' + i, i % 2 === 0 ? 'nodes' : 'edges', i ); }
    for( let i = 0; i < N; i += 3 ){ ids.remove( 'id-' + i ); }
    for( let i = 0; i < N; i += 3 ){ ids.set( 'id-' + i, 'nodes', N + i ); } // tombstone reuse

    for( let i = 0; i < N; i++ ){
      const entry = ids.get( 'id-' + i );

      if( i % 3 === 0 ){
        expect( entry, 'id-' + i ).to.deep.equal( { group: 'nodes', slot: N + i } );
      } else {
        expect( entry, 'id-' + i ).to.deep.equal( { group: i % 2 === 0 ? 'nodes' : 'edges', slot: i } );
      }
    }
  });

  it('distinguishes ids that collide in prefix', function(){
    const ids = new IdMap();

    ids.set( 'n', 'nodes', 0 );
    ids.set( 'n1', 'nodes', 1 );
    ids.set( 'n11', 'nodes', 2 );

    expect( ids.get( 'n' ).slot ).to.equal( 0 );
    expect( ids.get( 'n1' ).slot ).to.equal( 1 );
    expect( ids.get( 'n11' ).slot ).to.equal( 2 );
    expect( ids.get( 'n111' ) ).to.be.undefined;
  });
});
