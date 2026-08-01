import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';
import { GraphStore } from '../src/gpu/store/graph-store.mjs';
import { pickNodeAt } from '../src/gpu/render/cpu-pick.mjs';
import { FLAG_NO_EVENTS, SHAPE_CIRCLE } from '../src/gpu/contract.mjs';

// Round 20.2: the 'events' style prop — v3's pointer transparency.
// 'no' makes an element invisible to every pointer path (picking,
// hover, tap/grab targeting, the box gesture) while it still renders.
describe('gpu/style: the events prop (round 20.2)', function(){

  var makeCy = function( style ){
    return cytoscapeGpu({
      elements: [
        { data: { id: 'a', kind: 'ui' }, position: { x: 0, y: 0 } },
        { data: { id: 'b', kind: 'data' }, position: { x: 100, y: 0 } },
        { data: { id: 'e', source: 'a', target: 'b' } }
      ],
      style
    });
  };

  it('defaults to yes on both groups and reads back stored truth', function(){
    var cy = makeCy();

    expect( cy.$id( 'a' ).style( 'events' ) ).to.equal( 'yes' );
    expect( cy.$id( 'e' ).style( 'events' ) ).to.equal( 'yes' );
    expect( cy.$id( 'a' ).interactive() ).to.equal( true );
    expect( cy.$id( 'e' ).interactive() ).to.equal( true );
  });

  it('a constant no reads back and folds into interactive(), not visible()', function(){
    var cy = makeCy( {
      nodes: { events: 'no' },
      edges: { events: 'no' }
    } );

    expect( cy.$id( 'a' ).style( 'events' ) ).to.equal( 'no' );
    expect( cy.$id( 'e' ).style( 'events' ) ).to.equal( 'no' );
    expect( cy.$id( 'a' ).interactive() ).to.equal( false );
    expect( cy.$id( 'e' ).interactive() ).to.equal( false );
    expect( cy.$id( 'a' ).visible() ).to.equal( true ); // still rendered
    expect( cy.$id( 'e' ).visible() ).to.equal( true );
  });

  it('rejects values outside yes | no', function(){
    expect( () => makeCy( { nodes: { events: 'maybe' } } ) ).to.throw();
    expect( () => makeCy( { nodes: { events: 42 } } ) ).to.throw();
  });

  it('takes a case mapper and re-evaluates on data writes', function(){
    var cy = makeCy( {
      nodes: {
        events: { case: [ { when: { data: 'kind', eq: 'ui' }, then: 'no' } ], else: 'yes' }
      }
    } );

    expect( cy.$id( 'a' ).style( 'events' ) ).to.equal( 'no' );
    expect( cy.$id( 'b' ).style( 'events' ) ).to.equal( 'yes' );
    expect( cy.$id( 'a' ).interactive() ).to.equal( false );

    cy.$id( 'a' ).data( 'kind', 'data' ); // the mapped key: the channel refreshes

    expect( cy.$id( 'a' ).style( 'events' ) ).to.equal( 'yes' );
    expect( cy.$id( 'a' ).interactive() ).to.equal( true );
  });

  it('elementsInBox stays a pure geometric query (recorded scope note)', function(){
    var cy = makeCy( { nodes: { events: 'no' }, edges: { events: 'no' } } );

    // the box *gesture* filters to interactive elements (browser-tested);
    // the public query does not
    var inBox = cy.elementsInBox( -200, -200, 200, 200 );

    expect( inBox.length ).to.equal( 3 );
  });

  it('the CPU node pick skips FLAG_NO_EVENTS and falls through to the node beneath', function(){
    var store = new GraphStore();
    var frame = { panXPx: 0, panYPx: 0, zoomDpr: 1, hidePx: 1, nodeLodPx: 3 };

    var under = store.addNode( 'under', 0, 0 );

    store.setPair( 'node.size', under, 30, 30 );
    store.setScalar( 'node.shape', under, SHAPE_CIRCLE );
    store.setBorderGeom( under, -1, 0, 0, 0, 0 );

    var over = store.addNode( 'over', 0, 0 ); // higher slot: drawn on top

    store.setPair( 'node.size', over, 30, 30 );
    store.setScalar( 'node.shape', over, SHAPE_CIRCLE );
    store.setBorderGeom( over, -1, 0, 0, 0, 0 );

    expect( pickNodeAt( store, frame, 0, 0 ) ).to.equal( over );

    store.setFlag( 'nodes', over, FLAG_NO_EVENTS, true );

    expect( pickNodeAt( store, frame, 0, 0 ) ).to.equal( under ); // pass-through

    store.setFlag( 'nodes', under, FLAG_NO_EVENTS, true );

    expect( pickNodeAt( store, frame, 0, 0 ) ).to.equal( null );
  });

});
