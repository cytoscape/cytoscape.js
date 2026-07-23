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
        expect( viaWire.$( '#' + id ).data(), id ).to.deep.equal( viaDefs.$( '#' + id ).data() );
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
});
