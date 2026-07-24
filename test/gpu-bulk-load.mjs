import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';
import { GraphStore } from '../src/gpu/store/graph-store.mjs';
import { ColumnTable } from '../src/gpu/store/table.mjs';
import { StyleEngine } from '../src/gpu/style.mjs';
import { columnSpecsForGroup } from '../src/gpu/contract.mjs';
import { partitionDefs } from '../src/gpu/element-defs.mjs';

describe('gpu/bulk-load', function(){

  describe('partitionDefs', function(){
    it('partitions a flat array by inferred group', function(){
      const { nodes, edges } = partitionDefs([
        { data: { id: 'a' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'b' } }
      ]);

      expect( nodes.map( def => def.data.id ) ).to.deep.equal([ 'a', 'b' ]);
      expect( edges.map( def => def.data.id ) ).to.deep.equal([ 'ab' ]);
    });

    it('lets the bucket decide the group in map form', function(){
      // v3 stamped the bucket's group onto each def; the bucket must win
      // even when the def looks like the other group
      const { nodes, edges } = partitionDefs({
        nodes: [ { data: { id: 'x', source: 'a', target: 'b' } } ],
        edges: []
      });

      expect( nodes ).to.have.length( 1 );
      expect( edges ).to.have.length( 0 );
    });

    it('wraps a single def', function(){
      expect( partitionDefs( { data: { id: 'a' } } ).nodes ).to.have.length( 1 );
      expect( partitionDefs( { data: { id: 'e', source: 'a', target: 'b' } } ).edges ).to.have.length( 1 );
    });

    it('respects an explicit group over the data shape', function(){
      const { nodes } = partitionDefs([ { group: 'nodes', data: { id: 'x', source: 'a', target: 'b' } } ]);

      expect( nodes ).to.have.length( 1 );
    });

    it('throws on an invalid group', function(){
      expect( () => partitionDefs([ { group: 'nope', data: { id: 'x' } } ]) ).to.throw();
    });
  });

  describe('ColumnTable.reserve', function(){
    it('grows once to the ×2 curve and reports it', function(){
      const table = new ColumnTable( 'nodes', columnSpecsForGroup( 'nodes' ), 32 );

      expect( table.reserve( 1000 ) ).to.be.true;
      expect( table.cap ).to.equal( 1024 );
      expect( table.reserve( 1000 ) ).to.be.false; // already sufficient
      expect( table.cap ).to.equal( 1024 );
    });

    it('preserves contents and generations', function(){
      const table = new ColumnTable( 'nodes', columnSpecsForGroup( 'nodes' ), 32 );
      const { slot } = table.alloc();
      const pos = table.column( 'node.position' );

      pos[ slot * 2 ] = 7;
      pos[ slot * 2 + 1 ] = 8;
      table.freeSlot( slot );
      table.alloc(); // gen 1 now lives at the reused slot

      table.reserve( 500 );

      expect( table.gen[ slot ] ).to.equal( 1 );
      expect( table.column( 'node.position' )[ slot * 2 ] ).to.equal( 0 ); // re-alloc zeroed it
      expect( table.cap ).to.equal( 512 );
    });
  });

  describe('GraphStore.reserve', function(){
    it('preallocates so a bulk add never resizes mid-loop', function(){
      const store = new GraphStore();

      store.reserve( 100, 200 );
      store.takeDelta(); // clear the reserve's own resized flag

      for( let i = 0; i < 100; i++ ){
        store.addNode( 'n' + i, i, i );
      }

      for( let i = 0; i < 200; i++ ){
        store.addEdge( 'e' + i, 'n' + ( i % 100 ), 'n' + ( ( i + 1 ) % 100 ) );
      }

      const delta = store.takeDelta();

      expect( delta.resized.nodes ).to.be.false;
      expect( delta.resized.edges ).to.be.false;
      expect( store.count( 'nodes' ) ).to.equal( 100 );
      expect( store.count( 'edges' ) ).to.equal( 200 );
    });

    it('marks resized when it grows', function(){
      const store = new GraphStore();

      store.reserve( 100, 0 );

      const delta = store.takeDelta();

      expect( delta.resized.nodes ).to.be.true;
      expect( delta.resized.edges ).to.be.false;
    });

    it('accounts for reusable free slots', function(){
      const store = new GraphStore();

      for( let i = 0; i < 20; i++ ){
        store.addNode( 'n' + i, 0, 0 );
      }

      for( let i = 0; i < 10; i++ ){
        store.removeNode( store.lookup( 'n' + i ).slot );
      }

      const cap = store.capacity( 'nodes' );

      store.reserve( 10, 0 ); // covered entirely by the free list

      expect( store.capacity( 'nodes' ) ).to.equal( cap );
    });
  });

  describe('StyleEngine.applyBulk', function(){
    const sheet = {
      node: { 'width': 11, 'height': 12, 'background-color': '#f00' },
      edge: { 'width': 3, 'line-color': '#0f0' }
    };

    const storeWith = () => {
      const store = new GraphStore();

      store.addNode( 'a', 0, 0 );
      store.addNode( 'b', 0, 0, { selected: true } );
      store.addEdge( 'ab', 'a', 'b' );

      return store;
    };

    // a minimal handle stub for fn styles in store-only tests (no core)
    const eleFor = store => ( group, slot ) => ( {
      id: () => store.idAt( group, slot )
    } );

    it('matches per-element apply exactly', function(){
      const bulk = storeWith();
      const perEle = storeWith();

      const bulkEngine = new StyleEngine( bulk, eleFor( bulk ) );
      const perEleEngine = new StyleEngine( perEle, eleFor( perEle ) );

      bulkEngine.setSheet( sheet ); // applyAll routes through applyBulk

      // the per-element reference: apply() per ref overwrites whatever
      // setSheet wrote, so the columns end up as pure apply() output
      perEleEngine.setSheet( sheet );
      perEle.forEachAlive( 'nodes', slot => perEleEngine.apply( perEle.ref( 'nodes', slot ) ) );
      perEle.forEachAlive( 'edges', slot => perEleEngine.apply( perEle.ref( 'edges', slot ) ) );

      for( const id of [ 'node.size', 'node.fillColor', 'node.shape', 'edge.width', 'edge.lineColor' ] ){
        expect( Array.from( bulk.column( id ) ), id ).to.deep.equal( Array.from( perEle.column( id ) ) );
      }
    });

    it('evaluates fn styles per element', function(){
      const store = storeWith();
      const engine = new StyleEngine( store, eleFor( store ) );

      engine.setSheet( {
        node: ele => ( { 'background-color': ele.id() === 'a' ? '#ff0' : '#00f' } )
      } );

      const fill = store.column( 'node.fillColor' );
      const a = store.lookup( 'a' ).slot;
      const b = store.lookup( 'b' ).slot;

      expect( Array.from( fill.slice( a * 4, a * 4 + 3 ) ) ).to.deep.equal([ 255, 255, 0 ]);
      expect( Array.from( fill.slice( b * 4, b * 4 + 3 ) ) ).to.deep.equal([ 0, 0, 255 ]);
    });

    it('a nullish fn return falls back to group defaults', function(){
      const store = storeWith();
      const engine = new StyleEngine( store, eleFor( store ) );

      engine.setSheet( {
        node: ele => ele.id() === 'a' ? { 'background-color': '#ff0' } : null
      } );

      const fill = store.column( 'node.fillColor' );
      const a = store.lookup( 'a' ).slot;
      const b = store.lookup( 'b' ).slot;

      expect( Array.from( fill.slice( a * 4, a * 4 + 3 ) ) ).to.deep.equal([ 255, 255, 0 ]);
      expect( Array.from( fill.slice( b * 4, b * 4 + 3 ) ) ).to.deep.equal([ 153, 153, 153 ]); // #999 default
    });
  });

  describe('factory bulk path', function(){
    const options = () => ( {
      elements: {
        nodes: [
          { data: { id: 'a' }, position: { x: 1, y: 2 } },
          { data: { id: 'b' }, position: { x: 3, y: 4 }, selected: true }
        ],
        edges: [ { data: { id: 'ab', source: 'a', target: 'b' } } ]
      },
      style: { node: { 'width': 20, 'height': 20 } }
    } );

    it('loads elements without add events and with styles applied', function(){
      const cy = cytoscapeGpu( options() );

      expect( cy.nodes() ).to.have.length( 2 );
      expect( cy.edges() ).to.have.length( 1 );
      expect( cy.getElementById( 'a' ).position() ).to.deep.equal( { x: 1, y: 2 } );
      expect( cy.getElementById( 'b' ).selected() ).to.be.true;
      expect( cy.getElementById( 'a' ).width() ).to.equal( 20 );
      expect( cy.getElementById( 'ab' ).source().id() ).to.equal( 'a' );
    });

    it('produces the same model as the per-element add path', function(){
      const bulk = cytoscapeGpu( options() );
      const incremental = cytoscapeGpu( { style: options().style } );

      incremental.add( options().elements );

      for( const id of [ 'node.position', 'node.size', 'node.flags', 'edge.endpoints' ] ){
        expect( Array.from( bulk._store.column( id ) ), id )
          .to.deep.equal( Array.from( incremental._store.column( id ) ) );
      }
    });
  });

  describe('add() event parity', function(){
    it('emits add per element when a listener exists', function(){
      const cy = cytoscapeGpu();
      const ids = [];

      cy.on( 'add', evt => ids.push( evt.target.id() ) );

      cy.add([
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ]);

      expect( ids ).to.deep.equal([ 'a', 'b', 'ab' ]);
    });

    it('returns a fully indexable collection without listeners', function(){
      const cy = cytoscapeGpu();
      const added = cy.add([
        { data: { id: 'a' } },
        { data: { id: 'b' } }
      ]);

      expect( added ).to.have.length( 2 );
      expect( added[0].id() ).to.equal( 'a' );
      expect( added[1].id() ).to.equal( 'b' );
      expect( added[0] ).to.equal( cy.getElementById( 'a' ) ); // interned handle
    });
  });
});
