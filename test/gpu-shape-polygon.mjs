import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';
import { GraphStore } from '../src/gpu/store/graph-store.mjs';
import { pickNodeAt } from '../src/gpu/render/cpu-pick.mjs';
import { SHAPE_POLYGON_CUSTOM } from '../src/gpu/contract.mjs';

// round 13 C3: shape: 'polygon' + shape-polygon-points — per-element
// unit points in the poly blob, read by the FS SDF and CPU pick alike

describe('gpu/style: shape-polygon-points (round 13 C3)', function(){

  var cy;

  var makeCy = nodeStyle => cytoscapeGpu({
    elements: [ { data: { id: 'n' }, position: { x: 0, y: 0 } } ],
    style: nodeStyle == null ? undefined : { nodes: nodeStyle }
  });

  it('parses shape polygon with points and reads both back', function(){
    cy = makeCy({
      'shape': 'polygon',
      'shape-polygon-points': [ 0, -1, 1, 1, -1, 1 ] // triangle
    });

    var n = cy.$id('n');

    expect( n.style('shape') ).to.equal( 'polygon' );
    expect( n.style('shape-polygon-points') ).to.equal( '0 -1 1 1 -1 1' );
  });

  it('accepts a space-separated string and defaults to the unit square', function(){
    cy = makeCy({ 'shape': 'polygon', 'shape-polygon-points': '-1 0 0 -1 1 0 0 1' });

    expect( cy.$id('n').style('shape-polygon-points') ).to.equal( '-1 0 0 -1 1 0 0 1' );

    cy.style({ nodes: { 'shape': 'polygon' } }); // v3's default points

    expect( cy.$id('n').style('shape-polygon-points') ).to.equal( '-1 -1 1 -1 1 1 -1 1' );
  });

  it('throws on odd counts, short lists and out-of-range values', function(){
    expect( () => makeCy({ 'shape-polygon-points': [ 0, -1, 1 ] }) )
      .to.throw( /even number/ );
    expect( () => makeCy({ 'shape-polygon-points': [ 0, -1, 1, 1 ] }) )
      .to.throw( /at least 3/ );
    expect( () => makeCy({ 'shape-polygon-points': [ 0, -2, 1, 1, -1, 1 ] }) )
      .to.throw( /outside \[-1, 1\]/ );
  });

  it('stores the points in the poly blob with a packed borderGeom ref', function(){
    cy = makeCy({ 'shape': 'polygon', 'shape-polygon-points': [ 0, -1, 1, 1, -1, 1 ] });

    var store = cy._store;
    var slot = 0;
    var geom = store.column( 'node.borderGeom' );
    var ref = geom[ slot * 4 ];

    expect( ( geom[ slot * 4 + 1 ] >>> 16 ) & 0xf ).to.equal( SHAPE_POLYGON_CUSTOM );
    expect( ref >>> 24 ).to.equal( 3 ); // point count
    expect( Array.from( store.polygonPointsAt( slot ) ) ).to.eql( [ 0, -1, 1, 1, -1, 1 ] );
  });

  it('a non-polygon restyle frees the blob record', function(){
    cy = makeCy({ 'shape': 'polygon', 'shape-polygon-points': [ 0, -1, 1, 1, -1, 1 ] });

    expect( cy._store.polygonPointsAt( 0 ) ).to.not.equal( null );

    cy.style({ nodes: { 'shape': 'rectangle' } });

    expect( cy._store.polygonPointsAt( 0 ) ).to.equal( null );
    expect( cy.$id('n').style('shape') ).to.equal( 'rectangle' );
  });

  it('is constants-only: a mapper on shape-polygon-points throws', function(){
    expect( () => makeCy({
      'shape': 'polygon',
      'shape-polygon-points': { data: 'pts' }
    }) ).to.throw();
  });

  it('throws on the edges group', function(){
    expect( () => cytoscapeGpu({ style: { edges: { 'shape-polygon-points': [ 0, -1, 1, 1, -1, 1 ] } } }) )
      .to.throw( /node style property/ );
  });

  afterEach( function(){
    if( cy != null ){ cy.destroy(); cy = null; }
  });
});

describe('gpu/render: CPU pick over custom polygons (round 13 C3)', function(){

  var frame = { panXPx: 0, panYPx: 0, zoomDpr: 1, hidePx: 1, nodeLodPx: 3 };

  it('tests inside-ness against the blob points, not the bounding box', function(){
    var store = new GraphStore();
    var slot = store.addNode( 'a', 0, 0 );

    store.setPair( 'node.size', slot, 40, 40 );
    store.setScalar( 'node.shape', slot, SHAPE_POLYGON_CUSTOM );

    // downward triangle: apex at the bottom center
    var ref = store.setPolygonPoints( slot, [ -1, -1, 1, -1, 0, 1 ] );

    store.setBorderGeom( slot, -1, 0, 0, 0, 0, SHAPE_POLYGON_CUSTOM, ref );

    expect( pickNodeAt( store, frame, 0, 0 ) ).to.equal( slot );      // center
    expect( pickNodeAt( store, frame, 0, -19 ) ).to.equal( slot );    // near the top edge
    expect( pickNodeAt( store, frame, 18, 18 ) ).to.equal( null );    // box corner, outside the triangle
    expect( pickNodeAt( store, frame, -18, 18 ) ).to.equal( null );
  });

  it('pick agrees with the ref after a pool rewrite', function(){
    var store = new GraphStore();
    var slot = store.addNode( 'a', 0, 0 );

    store.setPair( 'node.size', slot, 40, 40 );
    store.setScalar( 'node.shape', slot, SHAPE_POLYGON_CUSTOM );

    var ref = store.setPolygonPoints( slot, [ -1, -1, 1, -1, 0, 1 ] );

    store.setBorderGeom( slot, -1, 0, 0, 0, 0, SHAPE_POLYGON_CUSTOM, ref );

    // rewrite with an upward triangle: the same slot, new inside-ness
    ref = store.setPolygonPoints( slot, [ 0, -1, 1, 1, -1, 1 ] );
    store.setBorderGeom( slot, -1, 0, 0, 0, 0, SHAPE_POLYGON_CUSTOM, ref );

    expect( pickNodeAt( store, frame, 18, -18 ) ).to.equal( null ); // was inside before
    expect( pickNodeAt( store, frame, 18, 18 ) ).to.equal( slot ); // and vice versa
  });
});
