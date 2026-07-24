import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';
import { isColumnarElements, toColumnarElements } from '../src/gpu/columnar.mjs';
import { GraphStore } from '../src/gpu/store/graph-store.mjs';
import { FLAG_SELECTABLE } from '../src/gpu/contract.mjs';

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

describe('gpu/columnar', function(){

  describe('toColumnarElements', function(){
    it('converts nodes: ids, interleaved positions', function(){
      const out = toColumnarElements( FIXTURE );

      expect( isColumnarElements( out ) ).to.be.true;
      expect( out.nodes.count ).to.equal( 3 );
      expect( out.nodes.ids ).to.deep.equal([ 'a', 'b', 'c' ]);
      expect( Array.from( out.nodes.positions ) ).to.deep.equal([ 1, 2, 3, 4, 5, 6 ]);
    });

    it('converts edges: endpoints as node indices', function(){
      const out = toColumnarElements( FIXTURE );

      expect( out.edges.count ).to.equal( 2 );
      expect( out.edges.ids ).to.deep.equal([ 'ab', 'bc' ]);
      expect( Array.from( out.edges.sources ) ).to.deep.equal([ 0, 1 ]);
      expect( Array.from( out.edges.targets ) ).to.deep.equal([ 1, 2 ]);
    });

    it('builds selection columns only on deviation', function(){
      const out = toColumnarElements( FIXTURE );

      expect( Array.from( out.nodes.selected ) ).to.deep.equal([ 0, 1, 0 ]);
      expect( Array.from( out.nodes.selectable ) ).to.deep.equal([ 1, 1, 0 ]);
      expect( Array.from( out.edges.selected ) ).to.deep.equal([ 0, 1 ]);
      expect( out.edges.selectable ).to.be.undefined;

      const plain = toColumnarElements([ { data: { id: 'x' } } ]);

      expect( plain.nodes.selected ).to.be.undefined;
      expect( plain.nodes.selectable ).to.be.undefined;
    });

    it('accepts the flat array form', function(){
      const out = toColumnarElements([
        { data: { id: 'n' } },
        { data: { id: 'e', source: 'n', target: 'n' } }
      ]);

      expect( out.nodes.count ).to.equal( 1 );
      expect( out.edges.count ).to.equal( 1 );
      expect( out.edges.sources[0] ).to.equal( 0 );
    });

    it('leaves missing node ids as holes for auto-generation', function(){
      const out = toColumnarElements([ { data: {} }, { data: { id: 'x' } } ]);

      expect( out.nodes.ids ).to.deep.equal([ undefined, 'x' ]);
    });

    it('throws on an edge endpoint outside the payload', function(){
      expect( () => toColumnarElements([
        { data: { id: 'a' } },
        { data: { id: 'e', source: 'a', target: 'ghost' } }
      ]) ).to.throw( /self-contained/ );
    });

    it('throws on an edge without a source and target', function(){
      expect( () => toColumnarElements([ { group: 'edges', data: { id: 'e' } } ]) ).to.throw( /source and target/ );
    });
  });

  describe('store ingest', function(){
    it('matches the definition path column for column', function(){
      const viaDefs = cytoscapeGpu( { elements: FIXTURE } );
      const viaColumnar = cytoscapeGpu( { elements: toColumnarElements( FIXTURE ) } );

      for( const id of [ 'node.position', 'node.size', 'node.flags', 'node.fillColor', 'edge.endpoints', 'edge.flags', 'edge.width' ] ){
        expect( Array.from( viaColumnar._store.column( id ) ), id )
          .to.deep.equal( Array.from( viaDefs._store.column( id ) ) );
      }

      expect( viaColumnar._store.slotsOrdered( 'nodes' ) ).to.deep.equal( viaDefs._store.slotsOrdered( 'nodes' ) );
      expect( viaColumnar._store.slotsOrdered( 'edges' ) ).to.deep.equal( viaDefs._store.slotsOrdered( 'edges' ) );
      expect( viaColumnar._store.boundingBox() ).to.deep.equal( viaDefs._store.boundingBox() );
    });

    it('allocates contiguously on a fresh store and reuses freed slots later', function(){
      const store = new GraphStore();
      const newId = ( () => { let n = 0; return () => 'gen-' + n++; } )();

      const slots = store.addNodesColumnar( { count: 3, positions: new Float32Array([ 1, 1, 2, 2, 3, 3 ]) }, newId );

      expect( Array.from( slots ) ).to.deep.equal([ 0, 1, 2 ]);

      store.removeNode( 1 );

      const more = store.addNodesColumnar( { count: 2, positions: new Float32Array([ 8, 8, 9, 9 ]) }, newId );

      expect( Array.from( more ) ).to.deep.equal([ 1, 3 ]); // freed slot first, then fresh

      const pos = store.column( 'node.position' );

      expect( pos[ 1 * 2 ] ).to.equal( 8 ); // scattered write into the reused slot
      expect( pos[ 3 * 2 ] ).to.equal( 9 ); // memcpy into the fresh run
      expect( store.count( 'nodes' ) ).to.equal( 4 );
    });

    it('zeroes reused slots before writing', function(){
      const store = new GraphStore();
      const newId = () => 'z';

      store.addNodesColumnar( { count: 1 }, () => 'n0' );
      store.setScalar( 'node.borderWidth', 0, 7 );
      store.removeNode( 0 );

      store.addNodesColumnar( { count: 1 }, newId );

      expect( store.column( 'node.borderWidth' )[ 0 ] ).to.equal( 0 );
    });

    it('applies selection flags', function(){
      const cy = cytoscapeGpu( { elements: toColumnarElements( FIXTURE ) } );

      expect( cy.getElementById( 'b' ).selected() ).to.be.true;
      expect( cy.getElementById( 'a' ).selected() ).to.be.false;
      expect( cy._store.hasFlag( 'nodes', cy._store.lookup( 'c' ).slot, FLAG_SELECTABLE ) ).to.be.false;
      expect( cy.getElementById( 'bc' ).selected() ).to.be.true;
    });

    it('builds adjacency', function(){
      const cy = cytoscapeGpu( { elements: toColumnarElements( FIXTURE ) } );

      expect( cy.getElementById( 'b' ).outgoers({ group: 'nodes' })[0].id() ).to.equal( 'c' );
      expect( cy.getElementById( 'ab' ).source().id() ).to.equal( 'a' );
      expect( cy.getElementById( 'ab' ).target().id() ).to.equal( 'b' );
    });

    it('throws on duplicate ids and short endpoint arrays', function(){
      const store = new GraphStore();
      const newId = () => 'g';

      store.addNodesColumnar( { count: 1, ids: [ 'a' ] }, newId );

      expect( () => store.addNodesColumnar( { count: 1, ids: [ 'a' ] }, newId ) ).to.throw( /second element/ );
      expect( () => store.addEdgesColumnar( { count: 1, sources: new Uint32Array( 0 ), targets: new Uint32Array( 0 ) }, new Uint32Array([ 0 ]), newId ) )
        .to.throw( /sources and targets/ );
      expect( () => store.addEdgesColumnar( { count: 1, sources: new Uint32Array([ 5 ]), targets: new Uint32Array([ 0 ]) }, new Uint32Array([ 0 ]), newId ) )
        .to.throw( /self-contained/ );
    });

    it('marks one coalesced dirty span when not resized', function(){
      const store = new GraphStore();

      store.reserve( 8, 0 );
      store.takeDelta(); // clear the reserve's resized flag

      store.addNodesColumnar( { count: 3 }, ( () => { let n = 0; return () => 'n' + n++; } )() );

      const delta = store.takeDelta();
      const span = column => delta.spans.find( s => s.column === column );

      expect( delta.resized.nodes ).to.be.false;
      expect( span( 'node.position' ) ).to.deep.include( { start: 0, end: 3 } );
      expect( span( 'node.flags' ) ).to.deep.include( { start: 0, end: 3 } );
    });
  });

  describe('core API', function(){
    it('auto-generates ids for holes', function(){
      const cy = cytoscapeGpu( { elements: toColumnarElements([ { data: {} }, { data: { id: 'x' } } ]) } );

      expect( cy.nodes() ).to.have.length( 2 );
      expect( cy.getElementById( 'x' ) ).to.have.length( 1 );
    });

    it('add() accepts columnar payloads and returns the collection', function(){
      const cy = cytoscapeGpu();
      const added = cy.add( toColumnarElements( FIXTURE ) );

      expect( added ).to.have.length( 5 );
      expect( added[0].id() ).to.equal( 'a' );
      expect( added[4].id() ).to.equal( 'bc' );
    });

    it('add() emits per element when a listener exists', function(){
      const cy = cytoscapeGpu();
      const ids = [];

      cy.on( 'add', evt => ids.push( evt.target.id() ) );
      cy.add( toColumnarElements( FIXTURE ) );

      expect( ids ).to.deep.equal([ 'a', 'b', 'c', 'ab', 'bc' ]);
    });

    it('styles apply to columnar-loaded elements', function(){
      const cy = cytoscapeGpu( {
        elements: toColumnarElements( FIXTURE ),
        style: { nodes: { 'width': 21, 'height': 22 } }
      } );

      expect( cy.getElementById( 'a' ).width() ).to.equal( 21 );
      expect( cy.getElementById( 'a' ).height() ).to.equal( 22 );
    });
  });
});
