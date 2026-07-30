import { test, expect } from '@playwright/test';
import { decodePng, diffPngs, maskRects, writeDiffArtifacts, compareToGolden } from './lib/image-diff.mjs';

/*
Visual regression specs for the WebGPU prototype, in two families:

- **v4 goldens**: each scene exports a png and diffs it against a PNG
  checked into playwright-tests/goldens/.  Run under the 'webgpu-visual'
  project, which pins the SwiftShader software adapter so rasterization is
  deterministic across machines.  Regenerate after an intended visual
  change with:  UPDATE_GOLDENS=1 npx playwright test --project=webgpu-visual
  Geometry goldens carry a tight bound.  The label golden uses the fixed
  Open Sans web font (an OFL devDependency, pre-loaded before instance
  creation so the lazily-caching atlas never rasters a fallback font) at
  a looser bound: the one un-pinnable layer is Chrome's atlas raster,
  which goes through CoreText on macOS vs FreeType on Linux — sub-pixel
  edge differences the SDF pipeline shrinks but cannot erase.  If CI
  proves the tolerance insufficient, per-platform golden suffixes are
  the escape hatch.

- **v3-vs-v4 parity**: the same fixture rendered by the classic canvas
  renderer and the GPU prototype in the same run, diffed with a tolerance
  (both images come from this machine, so determinism is a non-issue).
  The renderers differ by design in anti-aliasing (SDF vs canvas-2D), so
  parity asserts placement/color agreement, not pixel identity.
*/

const PAGE = 'http://127.0.0.1:3333/playwright-page/webgpu.html';
const PARITY_PAGE = 'http://127.0.0.1:3333/playwright-page/parity.html';

const hasAdapter = async page => {
  return await page.evaluate( async () => {
    if( navigator.gpu == null ){ return false; }

    return ( await navigator.gpu.requestAdapter() ) != null;
  } );
};

/** Make the instance, await readiness and one presented frame. */
const makeReadyCy = async ( page, options ) => {
  await page.evaluate( async options => {
    const cy = window.makeCy( options );

    await cy.ready;

    await new Promise( resolve => {
      cy.one( 'render', () => resolve() );
      cy.panBy( { x: 1, y: 0 } );
      cy.panBy( { x: -1, y: 0 } );
    } );
  }, options );
};

const waitFrames = async ( page, n = 3 ) => {
  await page.evaluate( async n => {
    for( let i = 0; i < n; i++ ){
      await new Promise( resolve => requestAnimationFrame( resolve ) );
    }
  }, n );
};

const exportPng = async ( page, opts = {} ) => {
  return await page.evaluate( async opts => await window.cy.png( opts ), opts );
};

test.describe( 'WebGPU visual goldens', () => {

  let deviceErrors = [];

  test.beforeEach( async ( { page } ) => {
    deviceErrors = [];

    page.on( 'console', msg => {
      const text = msg.text();

      if( /WGSL|is invalid|Validation error/i.test( text ) ){ deviceErrors.push( text ); }
    } );

    await page.setViewportSize( { width: 400, height: 300 } );
    await page.goto( PAGE );
  } );

  test.afterEach( () => {
    expect( deviceErrors, 'WebGPU reported validation errors' ).toEqual( [] );
  } );

  const checkGolden = ( name, uri, testInfo, opts = {} ) => {
    // throws with diff artifacts on mismatch; writes the golden under
    // UPDATE_GOLDENS=1
    compareToGolden( name, decodePng( uri ), {
      artifactsDir: testInfo.outputPath( '' ),
      ...opts
    } );
  };

  test( 'golden: nodes, borders, opacity, edges, arrows', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a', kind: 'plain' }, position: { x: -120, y: -60 } },
        { data: { id: 'b', kind: 'boxy' }, position: { x: 120, y: -60 } },
        { data: { id: 'c', kind: 'round' }, position: { x: -120, y: 60 } },
        { data: { id: 'd', kind: 'ghost' }, position: { x: 120, y: 60 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'cd', source: 'c', target: 'd' } },
        { data: { id: 'ad', source: 'a', target: 'd' } }
      ],
      style: {
        nodes: {
          'width': 50, 'height': 40,
          'shape': { case: [
            { when: { data: 'kind', eq: 'boxy' }, then: 'rectangle' },
            { when: { data: 'kind', eq: 'round' }, then: 'round-rectangle' }
          ], else: 'ellipse' },
          'background-color': { case: [
            { when: { data: 'kind', eq: 'boxy' }, then: '#2980b9' },
            { when: { data: 'kind', eq: 'round' }, then: '#27ae60' }
          ], else: '#c0392b' },
          'border-width': 3, 'border-color': '#2c3e50',
          'opacity': { case: [ { when: { data: 'kind', eq: 'ghost' }, then: 0.4 } ], else: 1 }
        },
        edges: {
          'width': 3, 'line-color': '#7f8c8d',
          'target-arrow-shape': 'triangle', 'target-arrow-color': '#8e44ad'
        }
      },
      zoom: 1,
      pan: { x: 200, y: 150 }
    } );
    await waitFrames( page );

    checkGolden( 'nodes-edges-arrows', await exportPng( page, { bg: '#fff' } ), testInfo );
  } );

  test( 'golden: selection accent rings', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -80, y: 0 }, selected: true },
        { data: { id: 'b' }, position: { x: 80, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 60, 'height': 60, 'background-color': '#ecf0f1', 'border-width': 2, 'border-color': '#95a5a6' },
        edges: { 'width': 2 }
      },
      zoom: 1,
      pan: { x: 200, y: 150 }
    } );
    await waitFrames( page );

    checkGolden( 'selection-accent', await exportPng( page, { bg: '#fff' } ), testInfo );
  } );

  test( 'golden: polygon node shapes (round 10)', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    const shapes = [
      'triangle', 'pentagon', 'hexagon', 'heptagon', 'octagon',
      'diamond', 'rhomboid', 'vee', 'star', 'tag'
    ];
    const elements = shapes.map( ( shape, i ) => ( {
      data: { id: shape, shape },
      position: { x: ( i % 5 ) * 70 - 140, y: Math.floor( i / 5 ) * 70 - 55 },
      selected: shape === 'star' // accent ring follows the polygon SDF
    } ) );

    // one anisotropic polygon: inside-ness must stay exact under stretch
    elements.push( {
      data: { id: 'wide-hex', shape: 'hexagon' },
      position: { x: 0, y: 75 }
    } );

    await makeReadyCy( page, {
      elements,
      style: {
        nodes: {
          'width': { case: [ { when: { data: 'id', eq: 'wide-hex' }, then: 130 } ], else: 50 },
          'height': { case: [ { when: { data: 'id', eq: 'wide-hex' }, then: 34 } ], else: 50 },
          'shape': { case: [
            { when: { data: 'shape', eq: 'triangle' }, then: 'triangle' },
            { when: { data: 'shape', eq: 'pentagon' }, then: 'pentagon' },
            { when: { data: 'shape', eq: 'hexagon' }, then: 'hexagon' },
            { when: { data: 'shape', eq: 'heptagon' }, then: 'heptagon' },
            { when: { data: 'shape', eq: 'octagon' }, then: 'octagon' },
            { when: { data: 'shape', eq: 'diamond' }, then: 'diamond' },
            { when: { data: 'shape', eq: 'rhomboid' }, then: 'rhomboid' },
            { when: { data: 'shape', eq: 'vee' }, then: 'vee' },
            { when: { data: 'shape', eq: 'star' }, then: 'star' },
            { when: { data: 'shape', eq: 'tag' }, then: 'tag' }
          ], else: 'ellipse' },
          'background-color': '#3498db',
          'border-width': 3, 'border-color': '#2c3e50'
        }
      },
      zoom: 1,
      pan: { x: 200, y: 150 }
    } );
    await waitFrames( page );

    checkGolden( 'polygon-shapes', await exportPng( page, { bg: '#fff' } ), testInfo );
  } );

  test( 'golden: arrowhead shapes (round 10)', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    const shapes = [ 'triangle', 'vee', 'chevron', 'circle', 'square', 'diamond', 'tee' ];
    const elements = [];

    for( let i = 0; i < shapes.length; i++ ){
      const y = i * 36 - 108;

      elements.push(
        { data: { id: `l${ i }` }, position: { x: -140, y } },
        { data: { id: `r${ i }` }, position: { x: 140, y } },
        { data: { id: `e${ i }`, source: `l${ i }`, target: `r${ i }`, shape: shapes[ i ] } }
      );
    }

    // one source-end arrow: pins the source/target byte order in the packed column
    elements.push( { data: { id: 'e-src', source: 'l0', target: 'r6', shape: 'vee', atSource: 1 } } );

    await makeReadyCy( page, {
      elements,
      style: {
        nodes: { 'width': 14, 'height': 14, 'background-color': '#95a5a6' },
        edges: {
          'width': 4, 'line-color': '#7f8c8d',
          'target-arrow-shape': { case: [
            { when: { data: 'atSource', eq: 1 }, then: 'none' },
            { when: { data: 'shape', eq: 'vee' }, then: 'vee' },
            { when: { data: 'shape', eq: 'chevron' }, then: 'chevron' },
            { when: { data: 'shape', eq: 'circle' }, then: 'circle' },
            { when: { data: 'shape', eq: 'square' }, then: 'square' },
            { when: { data: 'shape', eq: 'diamond' }, then: 'diamond' },
            { when: { data: 'shape', eq: 'tee' }, then: 'tee' }
          ], else: 'triangle' },
          'target-arrow-color': '#8e44ad',
          'source-arrow-shape': { case: [ { when: { data: 'atSource', eq: 1 }, then: 'chevron' } ], else: 'none' },
          'source-arrow-color': '#c0392b'
        }
      },
      zoom: 1,
      pan: { x: 200, y: 150 }
    } );
    await waitFrames( page );

    checkGolden( 'arrow-shapes', await exportPng( page, { bg: '#fff' } ), testInfo );
  } );

  test( 'golden: edge line styles (solid, dashed, dotted)', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    const rows = [ 'solid', 'dashed', 'dotted' ];
    const elements = [];

    for( let i = 0; i < rows.length; i++ ){
      const y = i * 60 - 60;

      elements.push(
        { data: { id: `l${ i }`, ls: rows[ i ] }, position: { x: -160, y } },
        { data: { id: `r${ i }`, ls: rows[ i ] }, position: { x: 160, y } },
        { data: { id: `e${ i }`, source: `l${ i }`, target: `r${ i }`, ls: rows[ i ] } }
      );
    }

    // a diagonal wide dashed edge: the pattern runs along the edge, not an axis
    elements.push( { data: { id: 'e-diag', source: 'l0', target: 'r2', ls: 'dashed' } } );

    await makeReadyCy( page, {
      elements,
      style: {
        nodes: { 'width': 16, 'height': 16, 'background-color': '#7f8c8d' },
        edges: {
          'width': { case: [ { when: { data: 'id', eq: 'e-diag' }, then: 6 } ], else: 3 },
          'line-color': '#2c3e50',
          'line-style': { case: [
            { when: { data: 'ls', eq: 'dashed' }, then: 'dashed' },
            { when: { data: 'ls', eq: 'dotted' }, then: 'dotted' }
          ], else: 'solid' }
        }
      },
      zoom: 1,
      pan: { x: 200, y: 150 }
    } );
    await waitFrames( page );

    checkGolden( 'line-styles', await exportPng( page, { bg: '#fff' } ), testInfo );
  } );

  test( 'golden: GPU-evaluated color mappers (viridis scale)', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await page.evaluate( async () => {
      const nodes = [];
      const edges = [];

      for( let i = 0; i < 9; i++ ){
        nodes.push( {
          data: { id: `n${i}`, weight: i / 8 },
          position: { x: ( i % 3 ) * 100 - 100, y: Math.floor( i / 3 ) * 80 - 80 }
        } );

        if( i > 0 ){
          edges.push( { data: { id: `e${i}`, source: `n${i - 1}`, target: `n${i}`, w: i / 8 } } );
        }
      }

      const cy = window.makeCy( {
        elements: [ ...nodes, ...edges ],
        style: {
          nodes: {
            'width': 40, 'height': 40,
            'background-color': { data: 'weight', domain: [ 0, 1 ], range: 'viridis' }
          },
          edges: {
            'width': 3,
            'line-color': { data: 'w', domain: [ 0, 1 ], range: [ '#e74c3c', '#3498db' ] }
          }
        },
        zoom: 1,
        pan: { x: 200, y: 150 }
      } );

      await cy.ready;
      await new Promise( resolve => {
        cy.one( 'render', () => resolve() );
        cy.panBy( { x: 1, y: 0 } );
        cy.panBy( { x: -1, y: 0 } );
      } );
    } );
    await waitFrames( page );

    checkGolden( 'mapped-colors', await exportPng( page, { bg: '#fff' } ), testInfo );
  } );

  test( 'golden: far-zoom LOD (width floors, decimation, plain discs)', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await page.evaluate( async () => {
      // a deterministic 30×20 grid with row-wise chains: at zoom 0.05 the
      // nodes collapse to plain discs and the hairline edges floor + dim
      const nodes = [];
      const edges = [];

      for( let row = 0; row < 20; row++ ){
        for( let col = 0; col < 30; col++ ){
          const i = row * 30 + col;

          nodes.push( { data: { id: `n${i}` }, position: { x: col * 120, y: row * 120 } } );

          if( col > 0 ){
            edges.push( { data: { id: `e${i}`, source: `n${i - 1}`, target: `n${i}` } } );
          }
        }
      }

      const cy = window.makeCy( {
        elements: [ ...nodes, ...edges ],
        style: {
          nodes: { 'width': 30, 'height': 30, 'background-color': '#34495e' },
          edges: { 'width': 2, 'line-color': '#7f8c8d' }
        },
        zoom: 0.05,
        pan: { x: 110, y: 90 }
      } );

      await cy.ready;
      await new Promise( resolve => {
        cy.one( 'render', () => resolve() );
        cy.panBy( { x: 1, y: 0 } );
        cy.panBy( { x: -1, y: 0 } );
      } );
    } );
    await waitFrames( page );

    checkGolden( 'far-zoom-lod', await exportPng( page, { bg: '#fff' } ), testInfo );
  } );

  test( 'golden: labels in the fixed web font (Open Sans)', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // the atlas caches lazily and forever: the font MUST be loaded before
    // the instance exists, or fallback-font glyphs get cached instead
    await page.evaluate( async () => {
      await document.fonts.load( `32px 'Open Sans'` );

      if( !document.fonts.check( `32px 'Open Sans'` ) ){
        throw new Error( 'Open Sans did not load' );
      }
    } );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'Alpha 1' }, position: { x: -100, y: -70 } },
        { data: { id: 'beta-2' }, position: { x: 100, y: -70 } },
        { data: { id: 'GAMMA_3' }, position: { x: -100, y: 50 } },
        { data: { id: 'the quick brown fox' }, position: { x: 100, y: 50 } },
        { data: { id: 'e1', source: 'Alpha 1', target: 'beta-2' } }
      ],
      style: {
        nodes: {
          'width': 40, 'height': 30, 'background-color': '#dfe6e9',
          'border-width': 1, 'border-color': '#b2bec3',
          'label': { data: 'id' }, 'font-size': 14, 'color': '#2d3436',
          'font-family': `'Open Sans', sans-serif`
        },
        edges: { 'width': 2 }
      },
      zoom: 1,
      pan: { x: 200, y: 160 }
    } );
    await waitFrames( page );

    // looser bound than geometry goldens: the OS text rasterizer under the
    // atlas differs per platform (see the header comment)
    checkGolden( 'labels-open-sans', await exportPng( page, { bg: '#fff' } ), testInfo, {
      threshold: 0.25,
      maxDiffRatio: 0.02
    } );
  } );

  test( 'golden: edge labels at midpoints (round 10)', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await page.evaluate( async () => {
      await document.fonts.load( `32px 'Open Sans'` );

      if( !document.fonts.check( `32px 'Open Sans'` ) ){
        throw new Error( 'Open Sans did not load' );
      }
    } );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -140, y: -70 } },
        { data: { id: 'b' }, position: { x: 140, y: -70 } },
        { data: { id: 'c' }, position: { x: -140, y: 30 } },
        { data: { id: 'd' }, position: { x: 140, y: 110 } },
        { data: { id: 'ab', source: 'a', target: 'b', lbl: 'connects', boxed: 0 } },
        { data: { id: 'cd', source: 'c', target: 'd', lbl: 'diagonal', boxed: 1 } }
      ],
      style: {
        // the shared atlas font is the node sheet's font-family (one font
        // per atlas), even though only edges are labelled here
        nodes: {
          'width': 20, 'height': 20, 'background-color': '#b2bec3',
          'font-family': `'Open Sans', sans-serif`
        },
        edges: {
          'width': 2, 'line-color': '#b2bec3',
          'label': { data: 'lbl' }, 'font-size': 14, 'color': '#2d3436',
          'text-background-color': '#ffeaa7',
          'text-background-opacity': { case: [ { when: { data: 'boxed', eq: 1 }, then: 1 } ], else: 0 },
          'text-background-padding': 2
        }
      },
      zoom: 1,
      pan: { x: 200, y: 150 }
    } );
    await waitFrames( page );

    checkGolden( 'edge-labels', await exportPng( page, { bg: '#fff' } ), testInfo, {
      threshold: 0.25,
      maxDiffRatio: 0.02
    } );
  } );

  test( 'golden: edge label autorotate (angles + the flip rule)', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await page.evaluate( async () => {
      await document.fonts.load( `32px 'Open Sans'` );

      if( !document.fonts.check( `32px 'Open Sans'` ) ){
        throw new Error( 'Open Sans did not load' );
      }
    } );

    await makeReadyCy( page, {
      elements: [
        // downhill left-to-right diagonal: rotates to the positive slope
        { data: { id: 'a' }, position: { x: -160, y: -100 } },
        { data: { id: 'b' }, position: { x: -20, y: 20 } },
        // the delta points left (source right of target): the flip rule
        // negates it, so the label still reads left-to-right — its
        // background box pins that the quad rotates with the text
        { data: { id: 'c' }, position: { x: 160, y: -100 } },
        { data: { id: 'd' }, position: { x: 20, y: 20 } },
        // vertical: reads top-to-bottom at +90° (the dx == 0 case)
        { data: { id: 'e' }, position: { x: 0, y: 40 } },
        { data: { id: 'f' }, position: { x: 0, y: 130 } },
        { data: { id: 'ab', source: 'a', target: 'b', lbl: 'downhill', boxed: 0 } },
        { data: { id: 'cd', source: 'c', target: 'd', lbl: 'uphill', boxed: 1 } },
        { data: { id: 'ef', source: 'e', target: 'f', lbl: 'down', boxed: 0 } }
      ],
      style: {
        nodes: {
          'width': 16, 'height': 16, 'background-color': '#b2bec3',
          'font-family': `'Open Sans', sans-serif`
        },
        edges: {
          'width': 2, 'line-color': '#b2bec3',
          'label': { data: 'lbl' }, 'font-size': 14, 'color': '#2d3436',
          'text-rotation': 'autorotate',
          'text-background-color': '#ffeaa7',
          'text-background-opacity': { case: [ { when: { data: 'boxed', eq: 1 }, then: 1 } ], else: 0 },
          'text-background-padding': 2
        }
      },
      zoom: 1,
      pan: { x: 200, y: 150 }
    } );
    await waitFrames( page );

    checkGolden( 'edge-label-autorotate', await exportPng( page, { bg: '#fff' } ), testInfo, {
      threshold: 0.25,
      maxDiffRatio: 0.02
    } );
  } );

  test( 'golden: bezier bundles (round 12a)', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        // 2-bundle: symmetric fan
        { data: { id: 'a1' }, position: { x: -140, y: -90 } },
        { data: { id: 'b1' }, position: { x: 40, y: -90 } },
        { data: { id: 'p0', source: 'a1', target: 'b1' } },
        { data: { id: 'p1', source: 'a1', target: 'b1' } },
        // 3-bundle with an antiparallel member: middle edge straight
        { data: { id: 'a2' }, position: { x: -140, y: 10 } },
        { data: { id: 'b2' }, position: { x: 40, y: 10 } },
        { data: { id: 'q0', source: 'a2', target: 'b2' } },
        { data: { id: 'q1', source: 'a2', target: 'b2' } },
        { data: { id: 'q2', source: 'b2', target: 'a2' } },
        // a lone bezier edge renders straight (the signed-off v3 rule)
        { data: { id: 'a3' }, position: { x: -140, y: 110 } },
        { data: { id: 'b3' }, position: { x: 40, y: 110 } },
        { data: { id: 'r0', source: 'a3', target: 'b3' } },
        // a dashed curved pair: dashes ride the curve's arc length
        { data: { id: 'c1' }, position: { x: 130, y: -80 } },
        { data: { id: 'c2' }, position: { x: 130, y: 100 } },
        { data: { id: 's0', source: 'c1', target: 'c2', dashed: 1 } },
        { data: { id: 's1', source: 'c1', target: 'c2', dashed: 1 } }
      ],
      style: {
        nodes: { 'width': 24, 'height': 24, 'background-color': '#3498db' },
        edges: {
          'curve-style': 'bezier',
          'width': 3, 'line-color': '#7f8c8d',
          'line-style': { case: [ { when: { data: 'dashed', eq: 1 }, then: 'dashed' } ], else: 'solid' }
        }
      },
      zoom: 1,
      pan: { x: 200, y: 150 }
    } );
    await waitFrames( page );

    checkGolden( 'bezier-bundles', await exportPng( page, { bg: '#fff' } ), testInfo );
  } );

  test( 'golden: self-loops (round 12a)', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        // one default loop: -45deg, extending upper-left
        { data: { id: 'n1' }, position: { x: -90, y: -30 } },
        { data: { id: 'l1', source: 'n1', target: 'n1' } },
        // three same-direction loops: the j-stagger
        { data: { id: 'n2' }, position: { x: 80, y: -30 } },
        { data: { id: 'l2a', source: 'n2', target: 'n2' } },
        { data: { id: 'l2b', source: 'n2', target: 'n2' } },
        { data: { id: 'l2c', source: 'n2', target: 'n2' } },
        // custom direction/sweep: opens to the right, wide sweep
        { data: { id: 'n3' }, position: { x: -90, y: 100 } },
        { data: { id: 'l3', source: 'n3', target: 'n3', wide: 1 } },
        // a straight-styled loop still draws as a loop (v4 rule)
        { data: { id: 'n4' }, position: { x: 80, y: 100 } },
        { data: { id: 'l4', source: 'n4', target: 'n4', plain: 1 } }
      ],
      style: {
        nodes: { 'width': 26, 'height': 26, 'background-color': '#3498db' },
        edges: {
          'curve-style': { case: [ { when: { data: 'plain', eq: 1 }, then: 'straight' } ], else: 'bezier' },
          'width': 3, 'line-color': '#7f8c8d',
          'loop-direction': { case: [ { when: { data: 'wide', eq: 1 }, then: '90deg' } ], else: '-45deg' },
          'loop-sweep': { case: [ { when: { data: 'wide', eq: 1 }, then: '-150deg' } ], else: '-90deg' }
        }
      },
      zoom: 1,
      pan: { x: 200, y: 150 }
    } );
    await waitFrames( page );

    checkGolden( 'self-loops', await exportPng( page, { bg: '#fff' } ), testInfo );
  } );

  test( 'golden: curved-edge arrowheads on end tangents (round 12a)', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        // a 2-bundle: the target arrows must tilt with each curve's end
        // tangent (toward the fan), not lie on the chord
        { data: { id: 'a1' }, position: { x: -140, y: -60 } },
        { data: { id: 'b1' }, position: { x: 60, y: -60 } },
        { data: { id: 'p0', source: 'a1', target: 'b1' } },
        { data: { id: 'p1', source: 'a1', target: 'b1' } },
        // an antiparallel pair: one arrow at each node, tangents mirrored
        { data: { id: 'a2' }, position: { x: -140, y: 70 } },
        { data: { id: 'b2' }, position: { x: 60, y: 70 } },
        { data: { id: 'q0', source: 'a2', target: 'b2' } },
        { data: { id: 'q1', source: 'b2', target: 'a2' } },
        // a loop: the arrow rides the loop's in-ray tangent
        { data: { id: 'n' }, position: { x: 150, y: 10 } },
        { data: { id: 'loop', source: 'n', target: 'n' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30, 'background-color': '#3498db' },
        edges: {
          'curve-style': 'bezier', 'control-point-step-size': 60,
          'width': 3, 'line-color': '#7f8c8d',
          'target-arrow-shape': 'triangle', 'target-arrow-color': '#8e44ad'
        }
      },
      zoom: 1,
      pan: { x: 200, y: 150 }
    } );
    await waitFrames( page );

    checkGolden( 'curved-arrows', await exportPng( page, { bg: '#fff' } ), testInfo );
  } );

  test( 'golden: curved-edge labels at the curve midpoint (round 12a)', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await page.evaluate( async () => {
      await document.fonts.load( `32px 'Open Sans'` );

      if( !document.fonts.check( `32px 'Open Sans'` ) ){
        throw new Error( 'Open Sans did not load' );
      }
    } );

    await makeReadyCy( page, {
      elements: [
        // a bundle: each label rides its own curve's midpoint; the boxed
        // one autorotates — on a bezier the midpoint tangent is the
        // chord, so the tilt matches the diagonal
        { data: { id: 'a' }, position: { x: -150, y: -110 } },
        { data: { id: 'b' }, position: { x: 90, y: 30 } },
        { data: { id: 'p0', source: 'a', target: 'b', lbl: 'over', rot: 1, boxed: 1 } },
        { data: { id: 'p1', source: 'a', target: 'b', lbl: 'under', rot: 0, boxed: 0 } },
        // a loop label at the loop midpoint; autorotated along the
        // loop's c1->c2 tangent
        { data: { id: 'n' }, position: { x: 120, y: 110 } },
        { data: { id: 'loop', source: 'n', target: 'n', lbl: 'loop', rot: 1, boxed: 0 } }
      ],
      style: {
        nodes: {
          'width': 22, 'height': 22, 'background-color': '#b2bec3',
          'font-family': `'Open Sans', sans-serif`
        },
        edges: {
          'curve-style': 'bezier', 'control-point-step-size': 60,
          'width': 2, 'line-color': '#b2bec3',
          'label': { data: 'lbl' }, 'font-size': 14, 'color': '#2d3436',
          'text-rotation': { case: [ { when: { data: 'rot', eq: 1 }, then: 'autorotate' } ], else: 'none' },
          'text-background-color': '#ffeaa7',
          'text-background-opacity': { case: [ { when: { data: 'boxed', eq: 1 }, then: 1 } ], else: 0 },
          'text-background-padding': 2
        }
      },
      zoom: 1,
      pan: { x: 200, y: 150 }
    } );
    await waitFrames( page );

    checkGolden( 'curved-edge-labels', await exportPng( page, { bg: '#fff' } ), testInfo, {
      threshold: 0.25,
      maxDiffRatio: 0.02
    } );
  } );

  test( 'golden: label visuals (outline, background, margins)', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await page.evaluate( async () => {
      await document.fonts.load( `32px 'Open Sans'` );

      if( !document.fonts.check( `32px 'Open Sans'` ) ){
        throw new Error( 'Open Sans did not load' );
      }
    } );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'outlined', kind: 'outline' }, position: { x: -100, y: -60 } },
        { data: { id: 'boxed', kind: 'bg' }, position: { x: 100, y: -60 } },
        { data: { id: 'shifted', kind: 'margin' }, position: { x: 0, y: 60 } }
      ],
      style: {
        nodes: {
          'width': 40, 'height': 30, 'background-color': '#dfe6e9',
          'label': { data: 'id' }, 'font-size': 16, 'color': '#ffffff',
          'font-family': `'Open Sans', sans-serif`,
          'text-outline-width': { case: [ { when: { data: 'kind', eq: 'outline' }, then: 3 } ], else: 0 },
          'text-outline-color': '#c0392b',
          'text-background-color': '#2c3e50',
          'text-background-opacity': { case: [ { when: { data: 'kind', eq: 'bg' }, then: 1 } ], else: 0 },
          'text-background-padding': 3,
          'text-margin-x': { case: [ { when: { data: 'kind', eq: 'margin' }, then: 30 } ], else: 0 },
          'text-margin-y': { case: [ { when: { data: 'kind', eq: 'margin' }, then: -60 } ], else: 0 }
        }
      },
      zoom: 1,
      pan: { x: 200, y: 150 }
    } );
    await waitFrames( page );

    checkGolden( 'label-visuals', await exportPng( page, { bg: '#888' } ), testInfo, {
      threshold: 0.25,
      maxDiffRatio: 0.02
    } );
  } );

} );

test.describe( 'v3-vs-v4 render parity', () => {

  /*
  The same fixture rendered by the classic canvas renderer and the GPU
  prototype in the same run, exports diffed with a tolerance.  Interiors
  of solid shapes must agree exactly; the renderers' anti-aliasing
  differs by design (analytic SDF vs canvas-2D), so the assertions bound
  the mismatch ratio instead of demanding pixel identity.  Labels are
  excluded outright: glyph rasterization and placement policy both differ
  by design.
  */

  // shared element defs (both sides accept the v3 definition form); the
  // ghost node exercises opacity compositing over the bg
  const PARITY_ELEMENTS = [
    { data: { id: 'a', kind: 'plain' }, position: { x: -120, y: -60 } },
    { data: { id: 'b', kind: 'boxy' }, position: { x: 120, y: -60 } },
    { data: { id: 'c', kind: 'plain' }, position: { x: -120, y: 60 } },
    { data: { id: 'd', kind: 'ghost' }, position: { x: 120, y: 60 } },
    { data: { id: 'ab', source: 'a', target: 'b' } },
    { data: { id: 'cd', source: 'c', target: 'd' } },
    { data: { id: 'ad', source: 'a', target: 'd' } }
  ];

  // one look, two dialects: v3 selectors vs v4 case mappers
  const V3_STYLE = [
    { selector: 'node', style: {
      'width': 50, 'height': 40, 'shape': 'ellipse',
      'background-color': '#c0392b', 'border-width': 3, 'border-color': '#2c3e50'
    } },
    { selector: 'node[kind = "boxy"]', style: { 'shape': 'rectangle', 'background-color': '#2980b9' } },
    { selector: 'node[kind = "ghost"]', style: { 'opacity': 0.4 } },
    { selector: 'edge', style: { 'width': 3, 'line-color': '#7f8c8d', 'curve-style': 'straight' } }
  ];

  const V4_STYLE = {
    nodes: {
      'width': 50, 'height': 40,
      'shape': { case: [ { when: { data: 'kind', eq: 'boxy' }, then: 'rectangle' } ], else: 'ellipse' },
      'background-color': { case: [ { when: { data: 'kind', eq: 'boxy' }, then: '#2980b9' } ], else: '#c0392b' },
      'border-width': 3, 'border-color': '#2c3e50',
      'opacity': { case: [ { when: { data: 'kind', eq: 'ghost' }, then: 0.4 } ], else: 1 }
    },
    edges: { 'width': 3, 'line-color': '#7f8c8d' }
  };

  const MAX_PARITY_RATIO = 0.02;

  let deviceErrors = [];

  test.beforeEach( async ( { page } ) => {
    deviceErrors = [];

    page.on( 'console', msg => {
      const text = msg.text();

      if( /WGSL|is invalid|Validation error/i.test( text ) ){ deviceErrors.push( text ); }
    } );

    await page.setViewportSize( { width: 820, height: 320 } );
    await page.goto( PARITY_PAGE );
  } );

  test.afterEach( () => {
    expect( deviceErrors, 'WebGPU reported validation errors' ).toEqual( [] );
  } );

  /** Render both sides at the given viewport and export both as pngs. */
  const exportBoth = async ( page, viewport ) => {
    return await page.evaluate( async ( { elements, v3Style, v4Style, viewport } ) => {
      // per-side deep copies: v3 adopts position objects by reference and
      // its default layout is 'grid', so it must get an explicit preset
      // layout (fit: false keeps the option viewport) and its own defs
      const cloneEles = () => JSON.parse( JSON.stringify( elements ) );
      const cy3 = window.makeV3( {
        elements: cloneEles(), style: v3Style, layout: { name: 'preset', fit: false }, ...viewport
      } );
      const cy4 = window.makeV4( { elements: cloneEles(), style: v4Style, ...viewport } );

      await cy4.ready;
      await new Promise( resolve => requestAnimationFrame( resolve ) );
      await new Promise( resolve => requestAnimationFrame( resolve ) );

      return {
        v3uri: cy3.png( { bg: '#fff' } ), // v3 export is synchronous
        v4uri: await cy4.png( { bg: '#fff' } )
      };
    }, { elements: PARITY_ELEMENTS, v3Style: V3_STYLE, v4Style: V4_STYLE, viewport } );
  };

  const expectParity = ( v3uri, v4uri, name, testInfo ) => {
    const actual = decodePng( v4uri );
    const expected = decodePng( v3uri );
    const { mismatched, ratio, diff } = diffPngs( actual, expected, { threshold: 0.2 } );

    console.log( `[parity] ${name}: ${mismatched} px differ (${( ratio * 100 ).toFixed( 3 )}%)` );

    if( ratio > MAX_PARITY_RATIO ){
      writeDiffArtifacts( testInfo.outputPath( '' ), name, actual, expected, diff );
    }

    expect( ratio, `v3-vs-v4 mismatch ratio for ${name}` ).toBeLessThanOrEqual( MAX_PARITY_RATIO );
  };

  test( 'parity: nodes, borders, opacity and straight edges', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    const { v3uri, v4uri } = await exportBoth( page, { zoom: 1, pan: { x: 200, y: 150 } } );

    expectParity( v3uri, v4uri, 'parity-basic', testInfo );
  } );

  test( 'parity: the viewport transform (zoom + pan) agrees', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    const { v3uri, v4uri } = await exportBoth( page, { zoom: 1.7, pan: { x: 57, y: 23 } } );

    expectParity( v3uri, v4uri, 'parity-transform', testInfo );
  } );

  test( 'parity: bezier bundles + self-loops (round 12a)', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // v3's default look, opted into explicitly on both sides: a 3-bundle
    // with an antiparallel member (odd middle renders straight), a
    // 2-bundle, and a default self-loop.  Circle nodes keep the boundary
    // math exact on both sides; no arrows ('none' has gap 0, so v3 draws
    // boundary-to-boundary exactly like v4).
    const elements = [
      { data: { id: 'a' }, position: { x: -120, y: -60 } },
      { data: { id: 'b' }, position: { x: 120, y: -60 } },
      { data: { id: 'q0', source: 'a', target: 'b' } },
      { data: { id: 'q1', source: 'a', target: 'b' } },
      { data: { id: 'q2', source: 'b', target: 'a' } },
      { data: { id: 'c' }, position: { x: -120, y: 80 } },
      { data: { id: 'd' }, position: { x: 120, y: 80 } },
      { data: { id: 'p0', source: 'c', target: 'd' } },
      { data: { id: 'p1', source: 'c', target: 'd' } },
      { data: { id: 'n' }, position: { x: 20, y: 30 } },
      { data: { id: 'loop', source: 'n', target: 'n' } }
    ];
    // wide strokes on purpose: pixelmatch skips AA-classified pixels,
    // and a 3px curve is nearly all AA — 8px strokes have solid
    // interiors, so a misplaced curve produces real mismatches
    const v3Style = [
      { selector: 'node', style: {
        'width': 30, 'height': 30, 'shape': 'ellipse', 'background-color': '#c0392b'
      } },
      { selector: 'edge', style: { 'width': 8, 'line-color': '#7f8c8d', 'curve-style': 'bezier' } }
    ];
    const v4Style = {
      nodes: { 'width': 30, 'height': 30, 'background-color': '#c0392b' },
      edges: { 'width': 8, 'line-color': '#7f8c8d', 'curve-style': 'bezier' }
    };

    const { v3uri, v4uri } = await page.evaluate( async ( { elements, v3Style, v4Style } ) => {
      const cloneEles = () => JSON.parse( JSON.stringify( elements ) );
      const viewport = { zoom: 1, pan: { x: 200, y: 150 } };
      const cy3 = window.makeV3( {
        elements: cloneEles(), style: v3Style, layout: { name: 'preset', fit: false }, ...viewport
      } );
      const cy4 = window.makeV4( { elements: cloneEles(), style: v4Style, ...viewport } );

      await cy4.ready;
      await new Promise( resolve => requestAnimationFrame( resolve ) );
      await new Promise( resolve => requestAnimationFrame( resolve ) );

      return {
        v3uri: cy3.png( { bg: '#fff' } ),
        v4uri: await cy4.png( { bg: '#fff' } )
      };
    }, { elements, v3Style, v4Style } );

    // curves are nearly all AA fringe (the highest perimeter-to-area of
    // any parity scene), so the bound is looser than the solid-shape
    // scenes' 2% — placement agreement is what this pins
    const actual = decodePng( v4uri );
    const expected = decodePng( v3uri );

    // a 0% diff must mean matching ink, not two blank images
    const inked = png => {
      let n = 0;

      for( let i = 0; i < png.data.length; i += 4 ){
        if( png.data[ i ] < 250 || png.data[ i + 1 ] < 250 || png.data[ i + 2 ] < 250 ){ n++; }
      }

      return n;
    };

    expect( inked( actual ), 'v4 rendered ink' ).toBeGreaterThan( 2000 );
    expect( inked( expected ), 'v3 rendered ink' ).toBeGreaterThan( 2000 );
    const { mismatched, ratio, diff } = diffPngs( actual, expected, { threshold: 0.2 } );

    console.log( `[parity] parity-curves: ${mismatched} px differ (${( ratio * 100 ).toFixed( 3 )}%)` );

    if( ratio > 0.03 ){
      writeDiffArtifacts( testInfo.outputPath( '' ), 'parity-curves', actual, expected, diff );
    }

    expect( ratio, 'v3-vs-v4 mismatch ratio for parity-curves' ).toBeLessThanOrEqual( 0.03 );
  } );

} );
