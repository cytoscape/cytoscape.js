import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';
import { toColumnarElements } from '../src/gpu/columnar.mjs';
import { deserializeElements, isSerializedElements, serializeElements } from '../src/gpu/wire.mjs';

// deserialized ids stay packed (blob + offsets); decode for assertions
const idsOf = packed => {
  const { offsets, blob } = packed;
  const decoder = new TextDecoder();
  const out = [];

  for( let i = 0; i + 1 < offsets.length; i++ ){
    out.push( offsets[ i + 1 ] > offsets[ i ]
      ? decoder.decode( blob.subarray( offsets[ i ], offsets[ i + 1 ] ) )
      : undefined );
  }

  return out;
};

const FIXTURE = {
  nodes: [
    { data: { id: 'a' }, position: { x: 1, y: 2 } },
    { data: { id: 'b' }, position: { x: 3, y: 4 }, selected: true },
    { data: { id: 'c' }, position: { x: 5, y: 6 }, selectable: false }
  ],
  edges: [
    { data: { id: 'ab', source: 'a', target: 'b' } },
    { data: { id: 'bc', source: 'b', target: 'c' }, selected: true }
  ]
};

describe('gpu/wire', function(){

  describe('round trip', function(){
    it('preserves every column of a columnar payload', function(){
      const payload = toColumnarElements( FIXTURE );
      const buffer = serializeElements( payload );

      expect( buffer ).to.be.an.instanceOf( ArrayBuffer );
      expect( isSerializedElements( buffer ) ).to.be.true;

      const out = deserializeElements( buffer );

      expect( out.columnar ).to.be.true;
      expect( out.nodes.count ).to.equal( 3 );
      expect( idsOf( out.nodes.ids ) ).to.deep.equal([ 'a', 'b', 'c' ]);
      expect( Array.from( out.nodes.positions ) ).to.deep.equal([ 1, 2, 3, 4, 5, 6 ]);
      expect( Array.from( out.nodes.selected ) ).to.deep.equal([ 0, 1, 0 ]);
      expect( Array.from( out.nodes.selectable ) ).to.deep.equal([ 1, 1, 0 ]);
      expect( out.edges.count ).to.equal( 2 );
      expect( idsOf( out.edges.ids ) ).to.deep.equal([ 'ab', 'bc' ]);
      expect( Array.from( out.edges.sources ) ).to.deep.equal([ 0, 1 ]);
      expect( Array.from( out.edges.targets ) ).to.deep.equal([ 1, 2 ]);
      expect( Array.from( out.edges.selected ) ).to.deep.equal([ 0, 1 ]);
      expect( out.edges.selectable ).to.be.undefined;
    });

    it('accepts the definition form directly', function(){
      const out = deserializeElements( serializeElements( FIXTURE ) );

      expect( idsOf( out.nodes.ids ) ).to.deep.equal([ 'a', 'b', 'c' ]);
      expect( Array.from( out.edges.sources ) ).to.deep.equal([ 0, 1 ]);
    });

    it('preserves id holes for auto-generation', function(){
      const out = deserializeElements( serializeElements([ { data: {} }, { data: { id: 'x' } } ]) );

      expect( idsOf( out.nodes.ids ) ).to.deep.equal([ undefined, 'x' ]);
    });

    it('round-trips non-ASCII ids', function(){
      const out = deserializeElements( serializeElements([
        { data: { id: 'nöde' } },
        { data: { id: '🚀' } },
        { data: { id: 'plain' } },
        { data: { id: 'e', source: '🚀', target: 'nöde' } }
      ]) );

      expect( idsOf( out.nodes.ids ) ).to.deep.equal([ 'nöde', '🚀', 'plain' ]);
      expect( Array.from( out.edges.sources ) ).to.deep.equal([ 1 ]);
      expect( Array.from( out.edges.targets ) ).to.deep.equal([ 0 ]);
    });

    it('round-trips an empty graph and a nodes-only graph', function(){
      const empty = deserializeElements( serializeElements([]) );

      expect( empty.nodes.count ).to.equal( 0 );
      expect( empty.edges ).to.be.undefined;

      const nodesOnly = deserializeElements( serializeElements([ { data: { id: 'n' } } ]) );

      expect( nodesOnly.nodes.count ).to.equal( 1 );
      expect( nodesOnly.edges ).to.be.undefined;
    });

    it('accepts a view and realigns a misaligned one', function(){
      const buffer = serializeElements( FIXTURE );
      const aligned = new Uint8Array( buffer );

      expect( idsOf( deserializeElements( aligned ).nodes.ids ) ).to.deep.equal([ 'a', 'b', 'c' ]);

      const shifted = new Uint8Array( buffer.byteLength + 1 );

      shifted.set( aligned, 1 );

      const misaligned = new Uint8Array( shifted.buffer, 1, buffer.byteLength );
      const out = deserializeElements( misaligned );

      expect( idsOf( out.nodes.ids ) ).to.deep.equal([ 'a', 'b', 'c' ]);
      expect( Array.from( out.nodes.positions ) ).to.deep.equal([ 1, 2, 3, 4, 5, 6 ]);
    });

    it('ignores trailing padding past the recorded length', function(){
      const buffer = serializeElements( FIXTURE );
      const padded = new Uint8Array( buffer.byteLength + 8 );

      padded.set( new Uint8Array( buffer ) );

      expect( idsOf( deserializeElements( padded ).edges.ids ) ).to.deep.equal([ 'ab', 'bc' ]);
    });
  });

  describe('data() columns', function(){
    const DATA_FIXTURE = {
      nodes: [
        { data: { id: 'a', name: 'Alpha', weight: 1.5, flagged: true } },
        { data: { id: 'b', name: 'Beta', meta: { deep: [1] } } },
        { data: { id: 'c', weight: 2.25 } }
      ],
      edges: [ { data: { id: 'ab', source: 'a', target: 'b', kind: 'likes' } } ]
    };

    it('round-trips numeric columns as zero-copy f64 with NaN holes', function(){
      const out = deserializeElements( serializeElements( DATA_FIXTURE ) );

      expect( out.nodes.data.weight ).to.be.an.instanceOf( Float64Array );
      expect( out.nodes.data.weight[0] ).to.equal( 1.5 );
      expect( Number.isNaN( out.nodes.data.weight[1] ) ).to.be.true;
      expect( out.nodes.data.weight[2] ).to.equal( 2.25 );
    });

    it('round-trips string columns as dictionaries', function(){
      const out = deserializeElements( serializeElements( DATA_FIXTURE ) );

      expect( out.nodes.data.name.dict ).to.deep.equal([ 'Alpha', 'Beta' ]);
      expect( Array.from( out.nodes.data.name.indices ) ).to.deep.equal([ 1, 2, 0 ]);
      expect( out.edges.data.kind.dict ).to.deep.equal([ 'likes' ]);
    });

    it('round-trips mixed columns through the JSON fallback', function(){
      const out = deserializeElements( serializeElements( DATA_FIXTURE ) );

      expect( out.nodes.data.flagged ).to.deep.equal([ true, undefined, undefined ]);
      expect( out.nodes.data.meta[1] ).to.deep.equal({ deep: [1] });
    });

    it('ingests to full data() parity with the defs path', function(){
      const viaDefs = cytoscapeGpu( { elements: DATA_FIXTURE } );
      const viaWire = cytoscapeGpu( { elements: serializeElements( DATA_FIXTURE ) } );

      for( const id of [ 'a', 'b', 'c', 'ab' ] ){
        expect( viaWire.$id( id ).data(), id ).to.deep.equal( viaDefs.$id( id ).data() );
      }
    });

    it('survives a 4-but-not-8-aligned view (f64 realign)', function(){
      const buffer = serializeElements( DATA_FIXTURE );
      const shifted = new Uint8Array( buffer.byteLength + 4 );

      shifted.set( new Uint8Array( buffer ), 4 );

      const out = deserializeElements( new Uint8Array( shifted.buffer, 4, buffer.byteLength ) );

      expect( out.nodes.data.weight[2] ).to.equal( 2.25 );
      expect( out.nodes.data.name.dict ).to.deep.equal([ 'Alpha', 'Beta' ]);
    });
  });

  /*
  Round 39.2: graph-level data on the wire.  `cy.json()` has always
  exported it and the binary format never carried it, so a serialize →
  load round trip silently lost `cy.data()`.

  The load asymmetry is the round's one real decision, taken at the fifth
  design sitting: `options.elements` applies graph data, `cy.add( buffer )`
  ignores it.  Adding elements to a populated graph must not overwrite that
  graph's own data(), and there is no third answer that is right in both
  places — so both halves get a spec, and the `add` one is the more
  important of the two because "it silently did nothing" is what it pins.
  */
  describe('graph-level data (round 39.2)', function(){

    it('round-trips through serialize/deserialize', function(){
      const payload = { ...toColumnarElements( FIXTURE ), data: { name: 'g', n: 7, deep: { k: [ 1, 2 ] } } };
      const back = deserializeElements( serializeElements( payload ) );

      expect( back.data ).to.deep.equal( { name: 'g', n: 7, deep: { k: [ 1, 2 ] } } );
    });

    it('costs nothing when there is none', function(){
      // the flag is absent, so the section is absent — a graph with no
      // data() serializes to exactly the bytes it did before this round
      const payload = toColumnarElements( FIXTURE );
      const withEmpty = { ...payload, data: {} };

      expect( serializeElements( withEmpty ).byteLength )
        .to.equal( serializeElements( payload ).byteLength );
      expect( deserializeElements( serializeElements( payload ) ).data ).to.equal( undefined );
    });

    it('carries cy.data() out through cy.serialize()', function(){
      const cy = cytoscapeGpu( { elements: FIXTURE } );

      cy.data( { title: 'my graph', version: 2 } );

      expect( deserializeElements( cy.serialize() ).data )
        .to.deep.equal( { title: 'my graph', version: 2 } );

      cy.destroy();
    });

    it('applies it through options.elements', function(){
      const source = cytoscapeGpu( { elements: FIXTURE } );

      source.data( 'title', 'my graph' );

      const loaded = cytoscapeGpu( { elements: source.serialize() } );

      expect( loaded.data( 'title' ) ).to.equal( 'my graph' );

      source.destroy();
      loaded.destroy();
    });

    it('ignores it in cy.add(), leaving the target graph data alone', function(){
      const source = cytoscapeGpu( { elements: FIXTURE } );

      source.data( 'title', 'the source graph' );

      const target = cytoscapeGpu( { elements: [] } );

      target.data( 'title', 'the target graph' );
      target.add( source.serialize() );

      expect( target.data( 'title' ), 'add() overwrote the target graph data' )
        .to.equal( 'the target graph' );
      expect( target.nodes().length ).to.equal( 3 ); // the elements did land

      source.destroy();
      target.destroy();
    });

    it('leaves it reachable for a caller who does want it after add()', function(){
      // the documented escape hatch, so the drop is a default rather than
      // a wall
      const source = cytoscapeGpu( { elements: FIXTURE } );

      source.data( 'title', 'the source graph' );

      const buffer = source.serialize();
      const target = cytoscapeGpu( { elements: [] } );

      target.add( buffer );
      target.data( deserializeElements( buffer ).data );

      expect( target.data( 'title' ) ).to.equal( 'the source graph' );

      source.destroy();
      target.destroy();
    });

    it('reads a pre-v4 buffer, which simply has no section', function(){
      // the 14.8 precedent: older buffers keep loading.  A v3 buffer is
      // byte-identical to a v4 one with no graph data, so forging the
      // version number is the whole difference.
      const buffer = serializeElements( toColumnarElements( FIXTURE ) );

      new DataView( buffer ).setUint32( 4, 3, true );

      const back = deserializeElements( buffer );

      expect( back.data ).to.equal( undefined );
      expect( back.nodes.count ).to.equal( 3 );
    });

  });

  describe('validation', function(){
    it('rejects a buffer without the magic header', function(){
      expect( () => deserializeElements( new ArrayBuffer( 64 ) ) ).to.throw( /serialized elements/i );
      expect( () => deserializeElements( new ArrayBuffer( 4 ) ) ).to.throw( /serialized elements/i );
    });

    it('rejects a truncated buffer', function(){
      const buffer = serializeElements( FIXTURE );

      expect( () => deserializeElements( buffer.slice( 0, buffer.byteLength - 4 ) ) ).to.throw( /truncated/ );
    });

    it('rejects an unsupported version', function(){
      const buffer = serializeElements( FIXTURE );

      new DataView( buffer ).setUint32( 4, 999, true );

      expect( () => deserializeElements( buffer ) ).to.throw( /version/ );
    });

    it('rejects short columns at serialize time', function(){
      expect( () => serializeElements( { columnar: true, nodes: { count: 2, positions: new Float32Array( 2 ) } } ) )
        .to.throw( /position values/ );
      expect( () => serializeElements( { columnar: true, edges: { count: 2, sources: new Uint32Array( 1 ), targets: new Uint32Array( 2 ) } } ) )
        .to.throw( /sources and targets/ );
      expect( () => serializeElements( { columnar: true, nodes: { count: 2, selected: new Uint8Array( 1 ) } } ) )
        .to.throw( /selected column/ );
    });
  });

  describe('ingest', function(){
    it('matches the definition path column for column', function(){
      const viaDefs = cytoscapeGpu( { elements: FIXTURE } );
      const viaWire = cytoscapeGpu( { elements: serializeElements( FIXTURE ) } );

      for( const id of [ 'node.position', 'node.size', 'node.flags', 'node.fillColor', 'edge.endpoints', 'edge.flags', 'edge.width' ] ){
        expect( Array.from( viaWire._store.column( id ) ), id )
          .to.deep.equal( Array.from( viaDefs._store.column( id ) ) );
      }

      expect( viaWire._store.slotsOrdered( 'nodes' ) ).to.deep.equal( viaDefs._store.slotsOrdered( 'nodes' ) );
      expect( viaWire._store.slotsOrdered( 'edges' ) ).to.deep.equal( viaDefs._store.slotsOrdered( 'edges' ) );
    });

    it('add() accepts a serialized buffer and a view over one', function(){
      const cy = cytoscapeGpu();
      const added = cy.add( serializeElements( FIXTURE ) );

      expect( added ).to.have.length( 5 );
      expect( added[0].id() ).to.equal( 'a' );
      expect( cy.getElementById( 'ab' ).source().id() ).to.equal( 'a' );

      const cy2 = cytoscapeGpu();

      expect( cy2.add( new Uint8Array( serializeElements( FIXTURE ) ) ) ).to.have.length( 5 );
    });

    it('selection state survives the wire', function(){
      const cy = cytoscapeGpu( { elements: serializeElements( FIXTURE ) } );

      expect( cy.getElementById( 'b' ).selected() ).to.be.true;
      expect( cy.getElementById( 'bc' ).selected() ).to.be.true;
      expect( cy.getElementById( 'a' ).selected() ).to.be.false;
    });
  });

  // round 30.1: the format's two malformed-input guards.  Everything
  // above feeds the reader buffers the writer produced, so neither guard
  // had ever fired — and a wire format exists precisely to be handed
  // bytes from elsewhere (a static asset, an older writer, a truncated
  // fetch), which is when they are the only thing standing between a
  // bad buffer and silent garbage in the columns.
  describe('malformed input', function(){
    it('rejects an unknown data column kind rather than reading past it', function(){
      const buffer = serializeElements( {
        nodes: [ { data: { id: 'a', weight: 1 } } ], edges: []
      } );
      const bytes = new Uint8Array( buffer );

      // the block is (u32 nameLen, name bytes, u32 kind, column), so the
      // kind word sits at the 4-aligned position after the key name
      const name = new TextEncoder().encode( 'weight' );
      let at = -1;

      for( let i = 0; i + name.length <= bytes.length && at < 0; i++ ){
        if( name.every( ( b, k ) => bytes[ i + k ] === b ) ){ at = i; }
      }

      expect( at, 'the key name is in the buffer' ).to.be.greaterThan( 0 );

      const kindAt = ( at + name.length + 3 ) & ~3;

      expect( new Uint32Array( buffer, kindAt, 1 )[ 0 ], 'kind 0 = numeric' ).to.equal( 0 );

      new Uint32Array( buffer, kindAt, 1 )[ 0 ] = 7;

      expect( () => deserializeElements( buffer ) )
        .to.throw( /Unknown serialized data column kind 7/ );
    });

    it('rejects packed ids whose offsets are short of count + 1', function(){
      const short = {
        columnar: true,
        nodes: {
          count: 3,
          // 3 ids need 4 offsets; this carries 3
          ids: { offsets: new Uint32Array([ 0, 1, 2 ]), blob: new Uint8Array([ 97, 98 ]) }
        },
        edges: { count: 0, sources: new Uint32Array( 0 ), targets: new Uint32Array( 0 ) }
      };

      expect( () => serializeElements( short ) ).to.throw( /Packed ids must have 4 offsets/ );

      // control: the same payload with the full offset array serializes
      short.nodes.ids.offsets = new Uint32Array([ 0, 1, 2, 2 ]);

      expect( serializeElements( short ) ).to.be.an.instanceOf( ArrayBuffer );
    });
  });
});
