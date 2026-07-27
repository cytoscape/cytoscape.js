import { test, expect } from '@playwright/test';
import { decodePng, diffPngs, maskRects, writeDiffArtifacts, compareToGolden } from './lib/image-diff.mjs';

/*
Visual regression specs for the WebGPU prototype, in two families:

- **v4 goldens**: each scene exports a png and diffs it against a PNG
  checked into playwright-tests/goldens/.  Run under the 'webgpu-visual'
  project, which pins the SwiftShader software adapter so rasterization is
  deterministic across machines.  Regenerate after an intended visual
  change with:  UPDATE_GOLDENS=1 npx playwright test --project=webgpu-visual
  Goldens are label-free: SDF glyphs come from a canvas-2D raster of OS
  fonts, which is not cross-platform stable (label pixels are covered by
  the WYSIWYG self-diff and the label specs in webgpu.spec.js).

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

} );
