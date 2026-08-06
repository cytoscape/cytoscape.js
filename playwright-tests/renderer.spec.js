import { test, expect } from '@playwright/test';
import { decodePng, diffPngs, writeDiffArtifacts } from './lib/image-diff.mjs';

/*
WebGPU prototype specs.  Run under the 'webgpu' Playwright project
(chromium channel + --enable-unsafe-webgpu, with --enable-unsafe-swiftshader
as a deterministic software fallback for CI).  Soft-skips when no adapter
can be acquired.  Must load via http://127.0.0.1:3333 — navigator.gpu is
unavailable on about:blank.
*/

const PAGE = 'http://127.0.0.1:3333/playwright-page/index.html';

const RED_NODE_GRAPH = {
  elements: [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ],
  style: { nodes: {
    'background-color': 'red', 'width': 100, 'height': 100, 'shape': 'rectangle'
  } },
  zoom: 1
};

const hasAdapter = async page => {
  return await page.evaluate( async () => {
    if( navigator.gpu == null ){ return false; }

    return ( await navigator.gpu.requestAdapter() ) != null;
  } );
};

/** Whether the build exposes the WebGPU API at all, adapter or not.  Linux
 * WebKit does not, which is a different state from "an adapter could not be
 * acquired" and reaches a different guard. */
const hasGpuApi = async page => {
  return await page.evaluate( () => navigator.gpu != null );
};

/** Make the instance, await readiness and one presented frame. */
const makeReadyCy = async ( page, options ) => {
  await page.evaluate( async options => {
    const cy = window.makeCy( options );

    await cy.ready;

    // nudge the viewport so a fresh frame definitely presents after this point
    await new Promise( resolve => {
      cy.one( 'render', () => resolve() );
      cy.panBy( { x: 1, y: 0 } );
      cy.panBy( { x: -1, y: 0 } );
    } );
  }, options );
};

/** Center the graph: the model origin maps to the viewport center. */
const centerPan = async page => {
  return await page.evaluate( () => {
    const w = window.innerWidth;
    const h = window.innerHeight;

    window.cy.pan( { x: w / 2, y: h / 2 } );

    return { x: w / 2, y: h / 2 };
  } );
};

/**
 * Composited screen pixel at CSS coords.
 *
 * A clipped screenshot decoded here, rather than a full-page one shipped
 * into the page as base64 and decoded through an Image + 2D canvas: on the
 * software rasterizer CI pins, the old path measured 67 ms for the
 * screenshot and 68 ms for the in-page decode against 6 ms for a 1 px clip
 * (round 52), and this file calls it ~94 times.  Both projects run at
 * deviceScaleFactor 1, so one CSS px is one device px and the clip lands
 * on the same pixel the scaled getImageData read.
 *
 * Out-of-frame coordinates answer transparent black, which is what
 * getImageData gave for a read past the edge.
 */
const pixelAt = async ( page, x, y ) => {
  const data = await clipPixels( page, Math.round( x ), Math.round( y ), 1 );

  return data == null ? [ 0, 0, 0, 0 ] : [ data[ 0 ], data[ 1 ], data[ 2 ], data[ 3 ] ];
};

/**
 * Wait for a tween to pass through a state, instead of sampling for it at a
 * wall-clock instant.
 *
 * How far a tween has run at a given offset depends on when frames actually
 * landed, and on the software rasterizer CI pins that is neither fast nor
 * uniform.  `waitForTimeout( 900 )` followed by one sample is therefore a
 * race against frame cadence — which is what made this file's mid-flight
 * specs intermittent under load, and it got worse the busier the machine was
 * (round 53).
 *
 * Polling asserts the stronger and more honest thing: that the animation
 * *reaches* the state.
 *
 * `timeout` bounds how long a broken tween takes to *fail*; it is not what
 * keeps a spec honest, and it has to be generous.  A tween's compute
 * pipelines compile on the first `animate()` of a page — Dawn defers
 * compilation to first use — which on the software rasterizer stalls the
 * first animation by up to ~1.8 s under suite load, measured.  The tween's
 * clock starts after that stall, so a bound tight enough to "prove"
 * mid-flight would just fail on the compile.
 *
 * What keeps each of these honest is that the state cannot be observed at
 * rest.  For most of them the predicate itself cannot: a settled node does
 * not sit 35px past its target, a settled box covers x+95, a settled line
 * hides its casing.  For the four paint specs the end colour *does* satisfy
 * the predicate, and the assertion that follows the poll is what discriminates
 * — a stale CPU column, or green leading red on the OKLab path.  Keep that
 * pairing when editing one.
 *
 * Each iteration takes a screenshot, which forces a frame, so the poll also
 * drives the animation it is waiting on.
 *
 * @param read — runs against the live page and returns one sample
 * @param ok — decides whether a sample is the state being waited for
 */
const untilMidFlight = async ( page, read, ok, { timeout, what } ) => {
  const deadline = Date.now() + timeout;
  let last;

  do {
    last = await read();

    if( ok( last ) ){ return last; }
  } while( Date.now() < deadline );

  throw new Error(
    `the tween never reached ${what} in ${timeout}ms; last sample ${JSON.stringify( last )}`
  );
};

/** One row of RGBA from the composited page, or null when fully out of frame. */
const clipPixels = async ( page, x, y, width ) => {
  const view = page.viewportSize() ?? { width: Infinity, height: Infinity };
  const x0 = Math.max( 0, x );
  const w = Math.min( width - ( x0 - x ), view.width - x0 );

  if( y < 0 || y >= view.height || w <= 0 ){ return null; }

  return decodePng( await page.screenshot( { clip: { x: x0, y, width: w, height: 1 } } ) ).data;
};

const waitFrames = async ( page, n = 3 ) => {
  await page.evaluate( async n => {
    for( let i = 0; i < n; i++ ){
      await new Promise( resolve => requestAnimationFrame( resolve ) );
    }
  }, n );
};

/** Count dark (text-ish) pixels in a horizontal band of the composited page.
 * Clipped to the band rather than screenshotting the page — see pixelAt. */
const darkPixelsInBand = async ( page, x0, width, y ) => {
  const data = await clipPixels( page, Math.round( x0 ), Math.round( y ), Math.round( width ) );

  if( data == null ){ return 0; }

  let dark = 0;

  for( let i = 0; i < data.length; i += 4 ){
    if( data[ i ] < 100 && data[ i + 1 ] < 100 && data[ i + 2 ] < 100 ){ dark++; }
  }

  return dark;
};

test.describe( 'WebGPU renderer', () => {

  // device-side validation (a bad shader, a bad bind group) only reaches the
  // console: without this an invalid pipeline is a silent no-op and a spec can
  // still pass on stale buffer contents
  let deviceErrors = [];

  test.beforeEach( async ( { page } ) => {
    deviceErrors = [];

    page.on( 'console', msg => {
      const text = msg.text();

      console.log( `[browser] ${text}` );

      if( /WGSL|is invalid|Validation error/i.test( text ) ){ deviceErrors.push( text ); }
    } );

    await page.setViewportSize( { width: 800, height: 600 } );
    await page.goto( PAGE );
  } );

  test.afterEach( () => {
    expect( deviceErrors, 'WebGPU reported validation errors' ).toEqual( [] );
  } );

  test( 'hard error when WebGPU is unavailable', async ( { page } ) => {
    const message = await page.evaluate( () => {
      Object.defineProperty( navigator, 'gpu', { value: undefined } );

      try {
        window.makeCy( {} );

        return null;
      } catch( err ){
        return err.message;
      }
    } );

    expect( message ).toContain( 'WebGPU' );
  } );

  test( 'headless instances never require WebGPU', async ( { page } ) => {
    const count = await page.evaluate( () => {
      Object.defineProperty( navigator, 'gpu', { value: undefined } );

      const cy = cytoscape( { elements: [ { data: { id: 'a' } } ] } );

      return cy.nodes().length;
    } );

    expect( count ).toBe( 1 );
  } );

  test( 'ready resolves with a device', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    const readyResolved = await page.evaluate( async () => {
      const cy = window.makeCy( {} );

      await cy.ready;

      return true;
    } );

    expect( readyResolved ).toBe( true );
  } );

  test( 'renders a red node on white (premultiplied compositing)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );

    const center = await centerPan( page );

    await waitFrames( page );

    const centerPixel = await pixelAt( page, center.x, center.y );
    const cornerPixel = await pixelAt( page, 5, 5 );

    // node body: red
    expect( centerPixel[0] ).toBeGreaterThan( 200 );
    expect( centerPixel[1] ).toBeLessThan( 60 );
    expect( centerPixel[2] ).toBeLessThan( 60 );

    // background: the white container shows through the transparent canvas
    expect( cornerPixel[0] ).toBeGreaterThan( 240 );
    expect( cornerPixel[1] ).toBeGreaterThan( 240 );
    expect( cornerPixel[2] ).toBeGreaterThan( 240 );
  } );

  test( 'pick() resolves the node under the point and background elsewhere', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );

    const center = await centerPan( page );

    await waitFrames( page );

    const onNode = await page.evaluate( async center => {
      const ele = await window.cy.pick( center.x, center.y );

      return ele == null ? null : ele.id();
    }, center );

    const onBackground = await page.evaluate( async () => {
      const ele = await window.cy.pick( 5, 5 );

      return ele == null ? null : ele.id();
    } );

    expect( onNode ).toBe( 'a' );
    expect( onBackground ).toBe( null );
  } );

  test( 'pick() resolves an edge between nodes', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: 0 } },
        { data: { id: 'b' }, position: { x: 150, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30 },
        edges: { 'width': 4 }
        },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // the midpoint of the edge is far from both node bodies
    const onEdge = await page.evaluate( async center => {
      const ele = await window.cy.pick( center.x, center.y );

      return ele == null ? null : ele.id();
    }, center );

    expect( onEdge ).toBe( 'ab' );
  } );

  test( 'saturating edge picks across frames never yields spurious nulls', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: 0 } },
        { data: { id: 'b' }, position: { x: 150, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30 },
        edges: { 'width': 4 }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // fire un-awaited picks over the edge midpoint on consecutive frames,
    // jiggling the pan each frame so the cached pick tile is invalidated
    // and every request goes through the GPU tile + staging ring.  A full
    // ring must defer requests (bounded latency), never resolve them null
    // — spurious nulls are indistinguishable from background at the API.
    const result = await page.evaluate( async center => {
      const cy = window.cy;
      const raf = () => new Promise( r => requestAnimationFrame( r ) );
      const picks = [];

      for( let i = 0; i < 10; i++ ){
        // horizontal jiggle along the horizontal edge: the canvas center
        // stays on the line while the viewport write drops the pick cache
        cy.panBy( { x: i % 2 === 0 ? 2 : -2, y: 0 } );
        picks.push( cy.pick( center.x, center.y ) );
        await raf();
      }

      const eles = await Promise.all( picks );

      return {
        ids: eles.map( ele => ( ele == null ? null : ele.id() ) ),
        deferrals: cy.renderer().stats().pickDeferrals
      };
    }, center );

    expect( result.ids ).toEqual( Array( 10 ).fill( 'ab' ) );
    expect( result.deferrals ).toBeGreaterThanOrEqual( 0 ); // stat exists
  } );

  test( 'slot compaction is a visual no-op and keeps picking + labels working (19.4)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    const elements = [];

    for( let i = 0; i < 30; i++ ){
      elements.push( { data: { id: `x${i}` }, position: { x: -400 + i * 10, y: -200 } } );
    }

    elements.push(
      { data: { id: 'a', name: 'alpha' }, position: { x: -60, y: 0 } },
      { data: { id: 'b', name: 'beta' }, position: { x: 60, y: 0 } },
      { data: { id: 'c' }, position: { x: -60, y: 80 } },
      { data: { id: 'd' }, position: { x: 60, y: 80 } },
      { data: { id: 'p' } },
      { data: { id: 'k1', parent: 'p' }, position: { x: -20, y: -70 } },
      { data: { id: 'k2', parent: 'p' }, position: { x: 30, y: -55 } },
      { data: { id: 'ab1', source: 'a', target: 'b' } },
      { data: { id: 'ab2', source: 'b', target: 'a' } },
      { data: { id: 'cd', source: 'c', target: 'd' } }
    );

    await makeReadyCy( page, {
      elements,
      style: {
        nodes: { 'width': 24, 'height': 24, 'label': { data: 'name' }, 'font-size': 12 },
        edges: { 'width': 4, 'curve-style': 'bezier' }
      },
      renderer: { renderScaleMin: 1, renderScaleMax: 1 }
    } );

    const center = await centerPan( page );

    await page.evaluate( () => {
      window.cy.getElementById( 'a' ).select();

      for( let i = 0; i < 30; i++ ){ window.cy.getElementById( `x${i}` ).remove(); }
    } );
    await waitFrames( page, 6 );

    const before = ( await page.screenshot() ).toString( 'base64' );

    const hw = await page.evaluate( () => {
      window.cy._compact();

      return {
        nodes: window.cy._store.highWater( 'nodes' ),
        edges: window.cy._store.highWater( 'edges' )
      };
    } );

    expect( hw.nodes ).toBe( 7 ); // a b c d p k1 k2
    expect( hw.edges ).toBe( 3 );

    await waitFrames( page, 6 );

    const after = ( await page.screenshot() ).toString( 'base64' );

    expect( after ).toBe( before ); // stable draw order: a visual no-op

    // picking answers through the moved slots (CPU node pick + GPU tile)
    const picked = await page.evaluate( async center => {
      const node = await window.cy.pick( center.x - 60, center.y );
      const edge = await window.cy.pick( center.x, center.y + 80 );

      return {
        node: node == null ? null : node.id(),
        edge: edge == null ? null : edge.id()
      };
    }, center );

    expect( picked.node ).toBe( 'a' );
    expect( picked.edge ).toBe( 'cd' );

    // glyph runs rebuilt against the new owner slots
    const glyphs = await page.evaluate( () => window.cy.renderer().stats().glyphs );

    expect( glyphs ).toBeGreaterThan( 0 );
  } );

  test( 'a mid-flight animation survives a compaction and completes (19.4)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    const elements = [];

    for( let i = 0; i < 20; i++ ){
      elements.push( { data: { id: `x${i}` }, position: { x: -300 + i * 10, y: -150 } } );
    }

    elements.push( { data: { id: 'a' }, position: { x: -100, y: 0 } } );

    await makeReadyCy( page, { elements } );

    const finalPos = await page.evaluate( async () => {
      const cy = window.cy;
      const played = cy.getElementById( 'a' )
        .animation( { position: { x: 100, y: 0 }, duration: 500, easing: 'linear' } )
        .play();

      await new Promise( resolve => setTimeout( resolve, 150 ) );

      for( let i = 0; i < 20; i++ ){ cy.getElementById( `x${i}` ).remove(); }

      cy._compact(); // settles the GPU lease, repairs the tween's slots

      await played;

      return cy.getElementById( 'a' ).position();
    } );

    expect( finalPos ).toEqual( { x: 100, y: 0 } );
  } );

  test( 'columnar elements load renders and picks', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // the payload converts in-page (typed arrays don't cross evaluate())
    await page.evaluate( async () => {
      const columnar = window.cytoscape.toColumnarElements( {
        nodes: [
          { data: { id: 'a' }, position: { x: -150, y: 0 } },
          { data: { id: 'b' }, position: { x: 150, y: 0 } }
        ],
        edges: [ { data: { id: 'ab', source: 'a', target: 'b' } } ]
      } );
      const cy = window.makeCy( {
        elements: columnar,
        style: {
          nodes: { 'width': 30, 'height': 30 },
          edges: { 'width': 4 }
          },
        zoom: 1
      } );

      await cy.ready;

      await new Promise( resolve => {
        cy.one( 'render', () => resolve() );
        cy.panBy( { x: 1, y: 0 } );
        cy.panBy( { x: -1, y: 0 } );
      } );
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    const picked = await page.evaluate( async center => {
      const node = await window.cy.pick( center.x - 150, center.y );
      const edge = await window.cy.pick( center.x, center.y );

      return {
        node: node == null ? null : node.id(),
        edge: edge == null ? null : edge.id()
      };
    }, center );

    expect( picked ).toEqual( { node: 'a', edge: 'ab' } );
  } );

  test( 'binary elements payload fetches, loads and picks', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await page.evaluate( async () => {
      const wire = window.cytoscape.serializeElements( {
        nodes: [
          { data: { id: 'a' }, position: { x: -150, y: 0 } },
          { data: { id: 'b' }, position: { x: 150, y: 0 } }
        ],
        edges: [ { data: { id: 'ab', source: 'a', target: 'b' } } ]
      } );

      // round trip through a real binary fetch, as a producer would serve it
      const url = URL.createObjectURL( new Blob( [ wire ] ) );
      const fetched = await ( await fetch( url ) ).arrayBuffer();

      URL.revokeObjectURL( url );

      const cy = window.makeCy( {
        elements: fetched,
        style: {
          nodes: { 'width': 30, 'height': 30 },
          edges: { 'width': 4 }
          },
        zoom: 1
      } );

      await cy.ready;

      await new Promise( resolve => {
        cy.one( 'render', () => resolve() );
        cy.panBy( { x: 1, y: 0 } );
        cy.panBy( { x: -1, y: 0 } );
      } );
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    const picked = await page.evaluate( async center => {
      const node = await window.cy.pick( center.x - 150, center.y );
      const edge = await window.cy.pick( center.x, center.y );

      return {
        node: node == null ? null : node.id(),
        edge: edge == null ? null : edge.id()
      };
    }, center );

    expect( picked ).toEqual( { node: 'a', edge: 'ab' } );
  } );

  test( 'target arrowheads render at the node boundary', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    const graph = arrows => ( {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: 0 } },
        { data: { id: 'b' }, position: { x: 150, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30, 'background-color': '#00ff00' },
        edges: {
          'width': 8,
          'line-color': '#0000ff',
          ...( arrows ? { 'target-arrow-shape': 'triangle', 'target-arrow-color': '#ff0000' } : {} )
        }
      },
      zoom: 1
    } );

    await makeReadyCy( page, graph( true ) );

    const center = await centerPan( page );

    await waitFrames( page );

    // just behind the target node boundary (node radius 15): inside the arrowhead
    const arrowX = center.x + 150 - 15 - 8;
    const arrowPixel = await pixelAt( page, arrowX, center.y );
    const linePixel = await pixelAt( page, center.x, center.y );

    expect( arrowPixel[0] ).toBeGreaterThan( 180 ); // red arrowhead over the line
    expect( arrowPixel[2] ).toBeLessThan( 80 );
    expect( linePixel[2] ).toBeGreaterThan( 180 ); // the line itself stays blue

    // control: same spot without arrows shows the blue line
    await page.evaluate( () => window.cy.destroy() );
    await makeReadyCy( page, graph( false ) );
    await centerPan( page );
    await waitFrames( page );

    const controlPixel = await pixelAt( page, arrowX, center.y );

    expect( controlPixel[2] ).toBeGreaterThan( 180 );
    expect( controlPixel[0] ).toBeLessThan( 80 );
  } );

  test( 'mouse drag moves the node in the model and on screen', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );

    const center = await centerPan( page );

    await waitFrames( page );

    // hover so the pan-vs-grab pick resolves over the node
    await page.evaluate( () => {
      window.__hovered = false;
      window.cy.on( 'mouseover', () => { window.__hovered = true; } );
    } );

    await page.mouse.move( center.x - 10, center.y - 10 );
    await page.mouse.move( center.x, center.y, { steps: 5 } );
    await expect.poll( () => page.evaluate( () => window.__hovered ), { timeout: 5000 } ).toBe( true );

    // drag by (+120, +60)
    await page.mouse.down();
    await page.mouse.move( center.x + 120, center.y + 60, { steps: 10 } );
    await page.mouse.up();

    const pos = await page.evaluate( () => window.cy.$id( 'a' ).position() );

    expect( pos.x ).toBeCloseTo( 120, 0 );
    expect( pos.y ).toBeCloseTo( 60, 0 );

    await waitFrames( page );

    // the node now renders at its new location (edges/positions followed)
    const movedPixel = await pixelAt( page, center.x + 120, center.y + 60 );
    const oldPixel = await pixelAt( page, center.x - 45, center.y - 45 ); // old node corner area

    expect( movedPixel[0] ).toBeGreaterThan( 150 );
    expect( movedPixel[1] ).toBeLessThan( 100 );
    expect( oldPixel[0] ).toBeGreaterThan( 240 );
    expect( oldPixel[1] ).toBeGreaterThan( 240 );
  } );

  test( 'unmount() goes headless; mount() rebuilds from the CPU-canonical model (round 10)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'a', name: 'A' }, position: { x: 0, y: 0 } } ],
      style: { nodes: {
        'width': 60, 'height': 60, 'background-color': 'red', 'shape': 'rectangle',
        'label': { data: 'name' }, 'font-size': 20, 'color': '#000'
      } },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // unmount: headless, canvas gone, png rejects
    const afterUnmount = await page.evaluate( async () => {
      window.cy.unmount();

      let pngRejected = false;

      try { await window.cy.png(); } catch ( _e ){ pngRejected = true; }

      return {
        headless: window.cy.headless(),
        canvases: document.querySelectorAll( 'canvas' ).length,
        pngRejected
      };
    } );

    expect( afterUnmount.headless ).toBe( true );
    expect( afterUnmount.canvases ).toBe( 0 );
    expect( afterUnmount.pngRejected ).toBe( true );

    // mutate while headless: move the node, recolor, relabel, add another
    await page.evaluate( () => {
      window.cy.$id( 'a' ).position( { x: 80, y: 40 } );
      window.cy.$id( 'a' ).data( 'name', 'MOVED' );
      window.cy.add( { data: { id: 'b' }, position: { x: -80, y: -40 }, selected: true } );
    } );

    // re-mount to the same container and wait for the fresh pipeline
    await page.evaluate( async () => {
      window.cy.mount( document.getElementById( 'cytoscape' ) );
      await window.cy.ready;
    } );
    await waitFrames( page );
    await waitFrames( page );

    // the red rectangle renders at its headless-move position...
    const moved = await pixelAt( page, center.x + 80, center.y + 40 );
    const old = await pixelAt( page, center.x - 20, center.y - 20 );

    expect( moved[0] ).toBeGreaterThan( 150 );
    expect( moved[1] ).toBeLessThan( 100 );
    expect( old[0] ).toBeGreaterThan( 240 );
    expect( old[1] ).toBeGreaterThan( 240 );

    // ...and the node added while headless renders too (red, per the sheet)
    const added = await pixelAt( page, center.x - 80, center.y - 40 );

    expect( added[0] ).toBeGreaterThan( 150 );
    expect( added[1] ).toBeLessThan( 100 );

    // label glyphs rebuilt after mount: dark pixels exist below the node
    const png = decodePng( await page.evaluate( () => window.cy.png( { bg: '#fff' } ) ) );
    let dark = 0;

    for( let i = 0; i < png.data.length; i += 4 ){
      if( png.data[ i ] < 100 && png.data[ i + 1 ] < 100 && png.data[ i + 2 ] < 100 ){ dark++; }
    }

    expect( dark ).toBeGreaterThan( 50 );
  } );

  test( 'device loss auto-recovers: devicelost, rebuild, devicerestored (round 10)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );

    const center = await centerPan( page );

    await waitFrames( page );

    // destroy the device out from under the renderer: a real external loss
    await page.evaluate( () => {
      window.__lost = false;
      window.__restored = false;
      window.cy.on( 'devicelost', () => { window.__lost = true; } );
      window.cy.on( 'devicerestored', () => { window.__restored = true; } );
      window.cy.renderer()._debugLoseDevice();
    } );

    await expect.poll( () => page.evaluate( () => window.__lost ), { timeout: 5000 } ).toBe( true );
    await expect.poll( () => page.evaluate( () => window.__restored ), { timeout: 10000 } ).toBe( true );

    // the recovered pipeline renders the model, including post-loss writes
    await page.evaluate( () => window.cy.$id( 'a' ).position( { x: 90, y: 0 } ) );
    await waitFrames( page );
    await waitFrames( page );

    const moved = await pixelAt( page, center.x + 90, center.y );

    expect( moved[0] ).toBeGreaterThan( 150 );
    expect( moved[1] ).toBeLessThan( 100 );
  } );

  test( 'pointer re-emits + the tap family (round 17.1)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );

    const center = await centerPan( page );

    await waitFrames( page );

    await page.evaluate( () => {
      window.__events = [];

      for( const type of [
        'pointerdown', 'pointermove', 'pointerup', 'pointerover', 'pointerout',
        'tapstart', 'tapdrag', 'tapend'
      ] ){
        window.cy.on( type, e =>
          window.__events.push( type + ':' + ( e.target === window.cy ? 'cy' : e.target.id() ) ) );
      }
    } );

    // hover onto the node: pointerover rides mouseover; moves re-emit
    await page.mouse.move( center.x - 150, center.y - 120 );
    await page.mouse.move( center.x, center.y, { steps: 4 } );

    await expect.poll( () => page.evaluate( () => window.__events.join( ',' ) ) )
      .toContain( 'pointerover:a' );

    const moved = await page.evaluate( () => window.__events );

    expect( moved.join( ',' ) ).toContain( 'pointermove' );
    // no press yet: the normalized drag events wait for one
    expect( moved.join( ',' ) ).not.toContain( 'tapdrag' );

    // a press-drag-release over the node: tapstart on the node,
    // tapdrag during, tapend at release; the raw pointer family beside
    await page.evaluate( () => { window.__events = []; } );
    await page.mouse.down();
    await page.mouse.move( center.x + 40, center.y + 20, { steps: 4 } );
    await page.mouse.up();

    const seq = await page.evaluate( () => window.__events.join( ',' ) );

    expect( seq ).toContain( 'pointerdown:a' );
    expect( seq ).toContain( 'tapstart:a' );
    expect( seq ).toContain( 'tapdrag' );
    expect( seq ).toContain( 'tapend:a' );
    expect( seq ).toContain( 'pointerup:a' );

    // off the node: pointerout, and background events target the core
    await page.evaluate( () => { window.__events = []; } );
    await page.mouse.move( center.x - 150, center.y - 120, { steps: 4 } );

    await expect.poll( () => page.evaluate( () => window.__events.join( ',' ) ) )
      .toContain( 'pointerout:a' );

    await page.evaluate( () => { window.__events = []; } );
    await page.mouse.down();
    await page.mouse.up();

    const bg = await page.evaluate( () => window.__events.join( ',' ) );

    expect( bg ).toContain( 'pointerdown:cy' );
    expect( bg ).toContain( 'tapstart:cy' );
    expect( bg ).toContain( 'tapend:cy' );
  } );

  /*
  Round 31.3: the two names in the round-17 vocabulary that no test
  mentioned.  Surveying every event name in the vocabulary against the
  whole corpus, `mouseout` and `pointercancel` were the only two that
  appeared nowhere — `mouseover` is asserted six times in this file and
  its sibling zero, the shape 29.2 and 30.3 both hit.
  */
  test( 'mouseout fires when the hover leaves the node (the mouseover sibling)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );

    const center = await centerPan( page );

    await waitFrames( page );
    await page.evaluate( () => {
      window.__events = [];

      for( const type of [ 'mouseover', 'mouseout' ] ){
        window.cy.on( type, e =>
          window.__events.push( type + ':' + ( e.target === window.cy ? 'cy' : e.target.id() ) ) );
      }
    } );

    await page.mouse.move( center.x - 150, center.y - 120 );
    await page.mouse.move( center.x, center.y, { steps: 4 } );

    await expect.poll( () => page.evaluate( () => window.__events.join( ',' ) ) )
      .toContain( 'mouseover:a' );

    // still on the node: moving within it must not fire the out event
    await page.mouse.move( center.x + 5, center.y + 5, { steps: 2 } );

    expect( ( await page.evaluate( () => window.__events.join( ',' ) ) ) )
      .not.toContain( 'mouseout' );

    await page.mouse.move( center.x - 150, center.y - 120, { steps: 4 } );

    await expect.poll( () => page.evaluate( () => window.__events.join( ',' ) ) )
      .toContain( 'mouseout:a' );
  } );

  test( 'pointercancel aborts the gesture: free without dragfree (17.1/17.2)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );

    const center = await centerPan( page );

    await waitFrames( page );

    // driven with synthetic PointerEvents so the cancel carries the same
    // pointerId as the press — which is what the handler matches on
    const result = await page.evaluate( async center => {
      window.__events = [];

      for( const type of [ 'pointercancel', 'grab', 'drag', 'free', 'freeon', 'dragfree', 'tapend' ] ){
        window.cy.on( type, e =>
          window.__events.push( type + ':' + ( e.target === window.cy ? 'cy' : e.target.id() ) ) );
      }

      const canvas = document.querySelector( 'canvas' );
      const send = ( type, x, y ) => canvas.dispatchEvent( new PointerEvent( type, {
        pointerId: 7, pointerType: 'mouse', isPrimary: true, bubbles: true,
        clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1
      } ) );

      send( 'pointerdown', center.x, center.y );
      send( 'pointermove', center.x + 30, center.y + 15 );

      const dragged = window.cy.$id( 'a' ).position();
      const grabbedMidGesture = window.cy.$id( 'a' ).grabbed();

      send( 'pointercancel', center.x + 30, center.y + 15 );

      return {
        events: window.__events.join( ',' ),
        dragged, grabbedMidGesture,
        grabbedAfter: window.cy.$id( 'a' ).grabbed()
      };
    }, center );

    // the gesture really was in progress, so the cancel has something to abort
    expect( result.grabbedMidGesture ).toBe( true );
    expect( result.dragged.x ).toBeCloseTo( 30, 0 );

    expect( result.events ).toContain( 'pointercancel:cy' );

    // v4's recorded rule: a cancelled gesture still frees, but never
    // reports dragfree — the drag aborted rather than completing
    expect( result.events ).toContain( 'free:a' );
    expect( result.events ).toContain( 'freeon:a' );
    expect( result.events ).not.toContain( 'dragfree' );
    expect( result.events ).not.toContain( 'tapend' );

    expect( result.grabbedAfter ).toBe( false );
  } );

  test( 'the drag-state family: grab/drag/free with companions (round 17.2)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 }, selected: true },
        { data: { id: 'b' }, position: { x: 120, y: 0 }, selected: true }
      ],
      style: { nodes: { 'width': 60, 'height': 60, 'shape': 'rectangle', 'background-color': '#888' } },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    await page.evaluate( () => {
      window.__events = [];

      for( const type of [ 'grab', 'grabon', 'drag', 'free', 'freeon', 'dragfree', 'dragfreeon' ] ){
        window.cy.on( type, e =>
          window.__events.push( type + ':' + ( e.target === window.cy ? 'cy' : e.target.id() ) ) );
      }
    } );

    // drag the selected node a: its selected companion b rides along.
    // -on variants fire only on the directly grabbed element (v3).
    await page.mouse.move( center.x, center.y );
    await page.mouse.down();
    await page.mouse.move( center.x + 60, center.y + 30, { steps: 4 } );
    await page.mouse.up();

    const seq = await page.evaluate( () => window.__events );
    const joined = seq.join( ',' );
    const count = name => seq.filter( x => x === name ).length;

    expect( count( 'grab:a' ) ).toBe( 1 );
    expect( count( 'grabon:a' ) ).toBe( 1 );
    expect( count( 'grab:b' ) ).toBe( 1 );
    expect( count( 'grabon:b' ) ).toBe( 0 ); // companions never get -on
    expect( count( 'drag:a' ) ).toBeGreaterThan( 0 );
    expect( count( 'drag:b' ) ).toBeGreaterThan( 0 );
    expect( count( 'free:a' ) ).toBe( 1 );
    expect( count( 'free:b' ) ).toBe( 1 );
    expect( count( 'freeon:a' ) ).toBe( 1 );
    expect( count( 'freeon:b' ) ).toBe( 0 );
    expect( count( 'dragfree:a' ) ).toBe( 1 );
    expect( count( 'dragfree:b' ) ).toBe( 1 );
    expect( count( 'dragfreeon:a' ) ).toBe( 1 );
    // ordering: grab before drag before free
    expect( joined.indexOf( 'grab:a' ) ).toBeLessThan( joined.indexOf( 'drag:a' ) );
    expect( joined.indexOf( 'drag:a' ) ).toBeLessThan( joined.indexOf( 'free:a' ) );

    // a press-release without movement grabs and frees, but never dragfrees
    await page.evaluate( () => { window.__events = []; } );
    await page.mouse.move( center.x + 60, center.y + 30 );
    await page.mouse.down();
    await page.mouse.up();

    const still = await page.evaluate( () => window.__events );

    expect( still.filter( x => x.startsWith( 'grab' ) ).length ).toBeGreaterThan( 0 );
    expect( still.filter( x => x.startsWith( 'free' ) ).length ).toBeGreaterThan( 0 );
    expect( still.join( ',' ) ).not.toContain( 'dragfree' );
    expect( still.join( ',' ) ).not.toContain( 'drag:' );
  } );

  test( 'tapselect/tapunselect + hover-during-drag events (round 17.3)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );

    const center = await centerPan( page );

    await waitFrames( page );

    await page.evaluate( () => {
      window.__events = [];

      for( const type of [ 'tapselect', 'tapunselect', 'tapdragover', 'tapdragout', 'cxtdragover', 'cxtdragout' ] ){
        window.cy.on( type, e =>
          window.__events.push( type + ':' + ( e.target === window.cy ? 'cy' : e.target.id() ) ) );
      }
    } );

    // tap the node: selected by the gesture -> tapselect; tap again:
    // the toggle-off -> tapunselect
    await page.mouse.click( center.x, center.y );
    await expect.poll( () => page.evaluate( () => window.__events.join( ',' ) ) )
      .toContain( 'tapselect:a' );

    await page.mouse.click( center.x, center.y );
    await expect.poll( () => page.evaluate( () => window.__events.join( ',' ) ) )
      .toContain( 'tapunselect:a' );

    // a background press dragged across the node: tapdragover on
    // entry, tapdragout on exit (nodes only — the sync pick; recorded).
    // Panning must not apply, else the content follows the cursor and
    // nothing is ever crossed — the box gesture keeps the scene still.
    await page.evaluate( () => { window.cy.userPanningEnabled( false ); window.__events = []; } );
    await page.mouse.move( center.x - 150, center.y );
    await page.mouse.down();

    for( let i = 0; i <= 10; i++ ){
      await page.mouse.move( center.x - 150 + i * 30, center.y );
      await page.waitForTimeout( 35 ); // beyond the hover throttle
    }

    await page.mouse.up();

    const seq = await page.evaluate( () => window.__events.join( ',' ) );

    expect( seq ).toContain( 'tapdragover:a' );
    expect( seq ).toContain( 'tapdragout:a' );

    // the right-button drag gets the cxt pair
    await page.evaluate( () => { window.__events = []; } );
    await page.mouse.move( center.x - 150, center.y );
    await page.mouse.down( { button: 'right' } );

    for( let i = 0; i <= 10; i++ ){
      await page.mouse.move( center.x - 150 + i * 30, center.y );
      await page.waitForTimeout( 35 );
    }

    await page.mouse.up( { button: 'right' } );

    const cxtSeq = await page.evaluate( () => window.__events.join( ',' ) );

    expect( cxtSeq ).toContain( 'cxtdragover:a' );
    expect( cxtSeq ).toContain( 'cxtdragout:a' );
  } );

  test( 'gesture parity: cxttap family, dbltap, taphold (round 10)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );

    const center = await centerPan( page );

    await waitFrames( page );

    await page.evaluate( () => {
      window.__events = [];

      for( const type of [ 'cxttapstart', 'cxttap', 'cxttapend', 'cxtdrag', 'dbltap', 'onetap', 'taphold' ] ){
        window.cy.on( type, e => window.__events.push( type + ':' + ( e.target === window.cy ? 'cy' : e.target.id() ) ) );
      }
    } );

    // right-click on the node: cxttapstart + cxttapend + cxttap
    await page.mouse.click( center.x, center.y, { button: 'right' } );

    await expect.poll( () => page.evaluate( () => window.__events.join() ) )
      .toContain( 'cxttapstart:a,cxttapend:a,cxttap:a' );

    // right-drag on the background: cxtdrag, no cxttap
    await page.evaluate( () => { window.__events = []; } );
    await page.mouse.move( center.x + 150, center.y );
    await page.mouse.down( { button: 'right' } );
    await page.mouse.move( center.x + 190, center.y + 40, { steps: 5 } );
    await page.mouse.up( { button: 'right' } );

    const cxtDragged = await page.evaluate( () => window.__events );

    expect( cxtDragged.join() ).toContain( 'cxtdrag:cy' );
    expect( cxtDragged.join() ).toContain( 'cxttapend:cy' );
    expect( cxtDragged.join() ).not.toContain( 'cxttap:cy,' );

    // double-click the node: two taps then dbltap on the same target
    await page.evaluate( () => { window.__events = []; } );
    await page.mouse.click( center.x, center.y );
    await page.mouse.click( center.x, center.y );

    await expect.poll( () => page.evaluate( () => window.__events.join() ) ).toContain( 'dbltap:a' );

    // press and hold: taphold after ~500ms without moving
    await page.evaluate( () => { window.__events = []; } );
    await page.mouse.move( center.x, center.y );
    await page.mouse.down();
    await page.waitForTimeout( 700 );
    await page.mouse.up();

    await expect.poll( () => page.evaluate( () => window.__events.join() ) ).toContain( 'taphold:a' );
  } );

  test( 'interaction options: wheelSensitivity, desktopTapThreshold, tapholdDuration (round 20.1)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );

    const center = await centerPan( page );

    await waitFrames( page );

    // -- wheelSensitivity: a multiplier on the zoom-per-tick exponent --

    await page.mouse.move( center.x, center.y );

    const zoomAfterWheel = async () => {
      const before = await page.evaluate( () => window.cy.zoom() );

      await page.mouse.wheel( 0, 120 );
      await expect.poll( () => page.evaluate( () => window.cy.zoom() ) ).not.toBe( before );

      return { before, after: await page.evaluate( () => window.cy.zoom() ) };
    };

    const base = await zoomAfterWheel();

    await page.evaluate( () => window.cy.wheelSensitivity( 2 ) );

    const doubled = await zoomAfterWheel();

    // log-ratio doubles with sensitivity 2 (same tick size)
    const baseExp = Math.log10( base.after / base.before );
    const doubledExp = Math.log10( doubled.after / doubled.before );

    expect( doubledExp / baseExp ).toBeCloseTo( 2, 1 );

    // -- desktopTapThreshold: a 6 px press-move drags at 4, taps at 10 --

    await page.evaluate( () => {
      window.cy.zoom( 1 );
      window.cy.$id( 'a' ).position( { x: 0, y: 0 } );
      window.__taps = 0;
      window.cy.$id( 'a' ).on( 'tap', () => window.__taps++ );
    } );
    await centerPan( page );
    await waitFrames( page );

    const smallDrag = async () => {
      await page.mouse.move( center.x, center.y );
      await page.mouse.down();
      await page.mouse.move( center.x + 6, center.y, { steps: 2 } );
      await page.mouse.up();

      return await page.evaluate( () => ( {
        x: window.cy.$id( 'a' ).position().x,
        taps: window.__taps
      } ) );
    };

    const atDefault = await smallDrag();

    expect( atDefault.x ).toBeCloseTo( 6, 0 ); // threshold 4: it dragged
    expect( atDefault.taps ).toBe( 0 );

    await page.evaluate( () => {
      window.cy.desktopTapThreshold( 10 );
      window.cy.$id( 'a' ).position( { x: 0, y: 0 } );
    } );
    await waitFrames( page );

    const atTen = await smallDrag();

    expect( atTen.x ).toBeCloseTo( 0, 0 ); // threshold 10: still a tap
    expect( atTen.taps ).toBe( 1 );

    // -- tapholdDuration: configurable (v3 hardcodes 500) --

    await page.evaluate( () => {
      window.__tapholds = 0;
      window.cy.on( 'taphold', () => window.__tapholds++ );
      window.cy.tapholdDuration( 5000 );
    } );

    await page.mouse.move( center.x, center.y );
    await page.mouse.down();
    await page.waitForTimeout( 350 );
    await page.mouse.up();

    expect( await page.evaluate( () => window.__tapholds ) ).toBe( 0 ); // 5000 ms: never fired

    await page.evaluate( () => window.cy.tapholdDuration( 150 ) );

    await page.mouse.down();
    await page.waitForTimeout( 350 );
    await page.mouse.up();

    await expect.poll( () => page.evaluate( () => window.__tapholds ) ).toBe( 1 ); // 150 ms: fired
  } );

  test( 'dragging a selected node drags the whole selection (round 10)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 }, selected: true },
        { data: { id: 'b' }, position: { x: 100, y: 0 }, selected: true },
        { data: { id: 'c' }, position: { x: 0, y: 100 } } // unselected: stays put
      ],
      style: { nodes: { 'width': 40, 'height': 40, 'background-color': 'red' } },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    await page.evaluate( () => {
      window.__hovered = false;
      window.cy.on( 'mouseover', () => { window.__hovered = true; } );
    } );
    await page.mouse.move( center.x - 10, center.y - 10 );
    await page.mouse.move( center.x, center.y, { steps: 5 } );
    await expect.poll( () => page.evaluate( () => window.__hovered ), { timeout: 5000 } ).toBe( true );

    await page.mouse.down();
    await page.mouse.move( center.x + 50, center.y + 30, { steps: 8 } );
    await page.mouse.up();

    const positions = await page.evaluate( () => ( {
      a: window.cy.$id( 'a' ).position(),
      b: window.cy.$id( 'b' ).position(),
      c: window.cy.$id( 'c' ).position()
    } ) );

    // both selected nodes moved by the drag delta; the unselected one didn't
    expect( positions.a.x ).toBeCloseTo( 50, 0 );
    expect( positions.a.y ).toBeCloseTo( 30, 0 );
    expect( positions.b.x ).toBeCloseTo( 150, 0 );
    expect( positions.b.y ).toBeCloseTo( 30, 0 );
    expect( positions.c.x ).toBeCloseTo( 0, 0 );
    expect( positions.c.y ).toBeCloseTo( 100, 0 );
  } );

  test( 'a locked node does not drag; the gesture pans instead', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );

    const center = await centerPan( page );

    await waitFrames( page );

    await page.evaluate( () => {
      window.cy.$id( 'a' ).lock();
      window.__hovered = false;
      window.cy.on( 'mouseover', () => { window.__hovered = true; } );
    } );

    await page.mouse.move( center.x - 10, center.y - 10 );
    await page.mouse.move( center.x, center.y, { steps: 5 } );
    await expect.poll( () => page.evaluate( () => window.__hovered ), { timeout: 5000 } ).toBe( true );

    const panBefore = await page.evaluate( () => window.cy.pan() );

    // drag by (+120, +60): a locked node stays put and the viewport pans
    await page.mouse.down();
    await page.mouse.move( center.x + 120, center.y + 60, { steps: 10 } );
    await page.mouse.up();

    const pos = await page.evaluate( () => window.cy.$id( 'a' ).position() );
    const panAfter = await page.evaluate( () => window.cy.pan() );

    expect( pos.x ).toBeCloseTo( 0, 0 ); // model position unchanged
    expect( pos.y ).toBeCloseTo( 0, 0 );
    expect( panAfter.x - panBefore.x ).toBeCloseTo( 120, 0 ); // the viewport panned
    expect( panAfter.y - panBefore.y ).toBeCloseTo( 60, 0 );
  } );

  test( 'hide() removes a node from both rendering and picking', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );

    const center = await centerPan( page );

    await waitFrames( page );

    // visible first: red pixels + a node pick
    const shownPixel = await pixelAt( page, center.x, center.y );

    expect( shownPixel[0] ).toBeGreaterThan( 150 );
    expect( shownPixel[1] ).toBeLessThan( 100 );

    const shownPick = await page.evaluate( async ( { x, y } ) => {
      const ele = await window.cy.pick( x, y );

      return ele == null ? null : ele.id();
    }, center );

    expect( shownPick ).toBe( 'a' );

    // hide, then it's gone from pixels and picks as background
    await page.evaluate( () => new Promise( resolve => {
      window.cy.one( 'render', () => resolve() );
      window.cy.$id( 'a' ).hide();
    } ) );

    await waitFrames( page );

    const hiddenPixel = await pixelAt( page, center.x, center.y );

    expect( hiddenPixel[0] ).toBeGreaterThan( 240 ); // white background
    expect( hiddenPixel[1] ).toBeGreaterThan( 240 );

    const hiddenPick = await page.evaluate( async ( { x, y } ) => {
      const ele = await window.cy.pick( x, y );

      return ele == null ? null : ele.id();
    }, center );

    expect( hiddenPick ).toBe( null );
  } );

  test.describe( 'SDF labels', () => {
    const LABELLED_GRAPH = {
      elements: [ { data: { id: 'n0' }, position: { x: 0, y: 0 } } ],
      style: { nodes: {
        'background-color': 'red', 'width': 60, 'height': 60,
        'label': 'HELLO', 'font-size': 30, 'color': 'black'
      } }
    };

    // node bottom edge is 30 below center; label top = +4 margin; mid-text ≈ +50
    const LABEL_ROW_OFFSET = 50;

    test( 'renders below the node', async ( { page } ) => {
      test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

      await makeReadyCy( page, LABELLED_GRAPH );

      const center = await centerPan( page );

      await waitFrames( page );

      const inLabelRow = await darkPixelsInBand( page, center.x - 120, 240, center.y + LABEL_ROW_OFFSET );
      const aboveNode = await darkPixelsInBand( page, center.x - 120, 240, center.y - 100 );

      expect( inLabelRow ).toBeGreaterThan( 5 );
      expect( aboveNode ).toBe( 0 );

      expect( await page.evaluate( () => window.cy._renderer.stats().glyphs ) ).toBe( 5 );
    } );

    test( 'follows a node move on-GPU without a glyph rebuild', async ( { page } ) => {
      test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

      await makeReadyCy( page, LABELLED_GRAPH );

      const center = await centerPan( page );

      await waitFrames( page );

      const uploadDelta = await page.evaluate( async () => {
        const before = window.cy._renderer.stats().uploadedBytes;

        window.cy.$id( 'n0' ).position( { x: -150, y: -100 } );
        await new Promise( resolve => { window.cy.one( 'render', () => resolve() ); } );

        return window.cy._renderer.stats().uploadedBytes - before;
      } );

      // only the node's position row uploads; glyph instances are untouched
      expect( uploadDelta ).toBeLessThanOrEqual( 64 );

      await waitFrames( page );

      const atNewSpot = await darkPixelsInBand(
        page, center.x - 150 - 120, 240, center.y - 100 + LABEL_ROW_OFFSET
      );
      const atOldSpot = await darkPixelsInBand( page, center.x - 120, 240, center.y + LABEL_ROW_OFFSET );

      expect( atNewSpot ).toBeGreaterThan( 5 );
      expect( atOldSpot ).toBe( 0 );
    } );

    test( 'fades out below the LOD threshold', async ( { page } ) => {
      test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

      await makeReadyCy( page, LABELLED_GRAPH );

      const center = await centerPan( page );

      await page.evaluate( () => window.cy.zoom( { level: 0.05, renderedPosition: window.cy.pan() } ) );
      await waitFrames( page );

      let dark = 0;

      for( let dy = -10; dy <= 10; dy += 2 ){
        dark += await darkPixelsInBand( page, center.x - 120, 240, center.y + dy );
      }

      expect( dark ).toBe( 0 );
    } );
  } );

  test( 'viewport gesture events: dragpan, scrollzoom, pinchzoom (round 17.4)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );

    const center = await centerPan( page );

    await waitFrames( page );

    await page.evaluate( () => {
      window.__events = [];

      for( const type of [ 'dragpan', 'scrollzoom', 'pinchzoom' ] ){
        window.cy.on( type, () => window.__events.push( type ) );
      }
    } );

    // wheel zoom -> scrollzoom
    await page.mouse.move( center.x, center.y );
    await page.mouse.wheel( 0, -120 );
    await expect.poll( () => page.evaluate( () => window.__events.join( ',' ) ) )
      .toContain( 'scrollzoom' );

    // background drag-pan -> dragpan
    await page.evaluate( () => { window.__events = []; } );
    await page.mouse.move( center.x - 150, center.y - 100 );
    await page.mouse.down();
    await page.mouse.move( center.x - 100, center.y - 60, { steps: 4 } );
    await page.mouse.up();

    const panned = await page.evaluate( () => window.__events );

    expect( panned ).toContain( 'dragpan' );
    expect( panned ).not.toContain( 'scrollzoom' );

    // a synthetic two-finger pinch -> pinchzoom
    const pinched = await page.evaluate( center => {
      window.__events = [];

      const canvas = document.querySelector( 'canvas' );
      const rect = canvas.getBoundingClientRect();
      const fire = ( type, id, x, y ) => canvas.dispatchEvent( new PointerEvent( type, {
        pointerId: id, pointerType: 'touch',
        clientX: rect.left + x, clientY: rect.top + y,
        button: 0, buttons: 1, bubbles: true
      } ) );

      // fingers >= 200 css px apart pinch immediately (a closer pair
      // would start the 20.4 two-finger cxt gesture instead)
      fire( 'pointerdown', 21, center.x - 110, center.y );
      fire( 'pointerdown', 22, center.x + 110, center.y );
      fire( 'pointermove', 21, center.x - 160, center.y );
      fire( 'pointermove', 22, center.x + 160, center.y );
      fire( 'pointerup', 21, center.x - 160, center.y );
      fire( 'pointerup', 22, center.x + 160, center.y );

      return window.__events;
    }, center );

    expect( pinched ).toContain( 'pinchzoom' );
    expect( pinched ).not.toContain( 'dragpan' );
  } );

  test( 'the GPU force integrator holds the lease and settles (round 18.3)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: ( () => {
        const els = [];

        for( let i = 0; i < 40; i++ ){
          els.push( { data: { id: 'n' + i }, position: { x: 0, y: 0 } } );
          els.push( { data: { id: 'e' + i, source: 'n' + i, target: 'n' + ( ( i + 1 ) % 40 ) } } );
        }

        return els;
      } )(),
      style: { nodes: { 'width': 12, 'height': 12, 'background-color': '#c0392b' } },
      zoom: 1,
      pan: { x: 200, y: 150 }
    } );
    await waitFrames( page );

    const result = await page.evaluate( async () => {
      const cy = window.cy;
      const before = { ...cy.$id( 'n7' ).position() };
      // a provably long run: threshold 0 never settles by displacement
      // and the tiny decay keeps alpha hot, so the 300ms sample below
      // is guaranteed mid-run; stop() then triggers the settle readback
      const layout = cy.layout( {
        name: 'force', seed: 9, animate: true, fit: false,
        iterations: 100000, threshold: 0, decay: 0.0005, stepsPerFrame: 6
      } );

      let resolved = false;

      layout.run();
      layout.promise().then( () => { resolved = true; } );

      // mid-run: the CPU column is leased to the GPU — sync reads stay
      // at their pre-run values while pixels move (the tween contract)
      await new Promise( resolve => setTimeout( resolve, 300 ) );

      const midRun = { ...cy.$id( 'n7' ).position() };
      const staleDuring = midRun.x === before.x && midRun.y === before.y;
      const stillRunning = !resolved;

      layout.stop();
      await layout.promise();

      const after = { ...cy.$id( 'n7' ).position() };

      // settled: the one readback landed real simulated coordinates
      const settledMoved = Math.hypot( after.x - before.x, after.y - before.y ) > 20;

      // the ring spread out from the coincident seed pile
      const a = cy.$id( 'n3' ).position();
      const b = cy.$id( 'n4' ).position();
      const linkLen = Math.hypot( b.x - a.x, b.y - a.y );

      return { staleDuring, stillRunning, settledMoved, linkLen };
    } );

    expect( result.stillRunning, 'the run outlived the sample' ).toBe( true );
    expect( result.staleDuring, 'CPU reads stale mid-run (the lease)' ).toBe( true );
    expect( result.settledMoved, 'settle readback landed' ).toBe( true );
    expect( result.linkLen ).toBeGreaterThan( 10 );
    expect( result.linkLen ).toBeLessThan( 250 );
  } );

  test( 'GPU and CPU force executors agree on invariants (round 18.4)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // ring + chords: enough structure that a broken kernel (wrong
    // spring gather, bad grid, NaN blowup) lands far outside the bounds
    await makeReadyCy( page, {
      elements: ( () => {
        const els = [];

        for( let i = 0; i < 60; i++ ){
          els.push( { data: { id: 'n' + i }, position: { x: 0, y: 0 } } );
          els.push( { data: { id: 'e' + i, source: 'n' + i, target: 'n' + ( ( i + 1 ) % 60 ) } } );

          if( i % 6 === 0 ){
            els.push( { data: { id: 'c' + i, source: 'n' + i, target: 'n' + ( ( i + 17 ) % 60 ) } } );
          }
        }

        return els;
      } )(),
      style: { nodes: { 'width': 10, 'height': 10 } },
      zoom: 1,
      pan: { x: 200, y: 150 }
    } );
    await waitFrames( page );

    const stats = await page.evaluate( async () => {
      const cy = window.cy;
      const collect = () => {
        const out = { linkSum: 0, links: 0, nan: 0, maxR: 0 };
        const edges = cy.edges();

        for( let i = 0; i < edges.length; i++ ){
          const s = edges[ i ].source().position();
          const t = edges[ i ].target().position();
          const d = Math.hypot( t.x - s.x, t.y - s.y );

          if( !isFinite( d ) ){ out.nan++; continue; }

          out.linkSum += d;
          out.links++;
        }

        const nodes = cy.nodes();

        for( let i = 0; i < nodes.length; i++ ){
          const p = nodes[ i ].position();

          if( !isFinite( p.x ) || !isFinite( p.y ) ){ out.nan++; continue; }

          out.maxR = Math.max( out.maxR, Math.hypot( p.x, p.y ) );
        }

        return out;
      };
      const opts = { name: 'force', seed: 11, fit: false, iterations: 400 };

      // the CPU executor (animate: false takes the reference path)
      await cy.layout( { ...opts, animate: false } ).run().promise();

      const cpu = collect();
      const cpuBb = cy.elements().boundingBox( { includeLabels: false } );

      // the GPU executor (animate: true on a flat rendered graph)
      await cy.layout( { ...opts, animate: true, stepsPerFrame: 8 } ).run().promise();

      const gpu = collect();
      const gpuBb = cy.elements().boundingBox( { includeLabels: false } );

      return { cpu, gpu, cpuBb, gpuBb };
    } );

    // hard invariants: no NaN, everything in frame
    expect( stats.cpu.nan ).toBe( 0 );
    expect( stats.gpu.nan ).toBe( 0 );
    expect( stats.gpu.maxR ).toBeLessThan( 5000 );

    // soft parity: the two executors' layouts share summary statistics
    // (trajectories are deliberately not bit-agreed — recorded)
    const cpuMean = stats.cpu.linkSum / stats.cpu.links;
    const gpuMean = stats.gpu.linkSum / stats.gpu.links;

    expect( gpuMean ).toBeGreaterThan( cpuMean * 0.6 );
    expect( gpuMean ).toBeLessThan( cpuMean * 1.7 );
    expect( stats.gpuBb.w ).toBeGreaterThan( stats.cpuBb.w * 0.4 );
    expect( stats.gpuBb.w ).toBeLessThan( stats.cpuBb.w * 2.5 );

    // and the settle flushed derived geometry: the bb reflects the
    // settled coordinates (layoutstop ordering)
    expect( stats.gpuBb.w ).toBeGreaterThan( 100 );
  } );

  test( 'two-finger pinch zooms about the midpoint', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );

    const center = await centerPan( page );

    await waitFrames( page );

    const result = await page.evaluate( async center => {
      const canvas = document.querySelector( 'canvas' );
      const rect = canvas.getBoundingClientRect();
      const fire = ( type, id, x, y ) => canvas.dispatchEvent( new PointerEvent( type, {
        pointerId: id,
        pointerType: 'touch',
        clientX: rect.left + x,
        clientY: rect.top + y,
        button: 0,
        buttons: 1,
        bubbles: true
      } ) );

      const before = {
        zoom: window.cy.zoom(),
        underMid: window.cy._viewport.renderedToModel( center )
      };

      // two fingers 220 apart widen to 440 apart: zoom should double
      // (>= 200 apart pinches immediately; a closer pair would start
      // the 20.4 two-finger cxt gesture)
      fire( 'pointerdown', 11, center.x - 110, center.y );
      fire( 'pointerdown', 12, center.x + 110, center.y );

      for( let step = 1; step <= 5; step++ ){
        const spread = 110 + step * 22;

        fire( 'pointermove', 11, center.x - spread, center.y );
        fire( 'pointermove', 12, center.x + spread, center.y );
      }

      fire( 'pointerup', 11, center.x - 220, center.y );

      // the leftover finger must be inert: moving it must not pan
      const panBeforeDrag = window.cy.pan();

      fire( 'pointermove', 12, center.x + 40, center.y + 40 );

      const panAfterDrag = window.cy.pan();

      fire( 'pointerup', 12, center.x + 40, center.y + 40 );

      return {
        before,
        after: {
          zoom: window.cy.zoom(),
          underMid: window.cy._viewport.renderedToModel( center )
        },
        deadTouchPanned: panAfterDrag.x !== panBeforeDrag.x || panAfterDrag.y !== panBeforeDrag.y
      };
    }, center );

    expect( result.after.zoom ).toBeCloseTo( result.before.zoom * 2, 1 );
    expect( result.after.underMid.x ).toBeCloseTo( result.before.underMid.x, 0 );
    expect( result.after.underMid.y ).toBeCloseTo( result.before.underMid.y, 0 );
    expect( result.deadTouchPanned ).toBe( false );
  } );

  test( 'two-finger cxt gesture: cxttap family on touch (round 20.4)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH ); // node 'a', 100x100 at the origin

    const center = await centerPan( page );

    await waitFrames( page );

    const run = await page.evaluate( async center => {
      const canvas = document.querySelector( 'canvas' );
      const rect = canvas.getBoundingClientRect();
      const fire = ( type, id, x, y ) => canvas.dispatchEvent( new PointerEvent( type, {
        pointerId: id, pointerType: 'touch',
        clientX: rect.left + x, clientY: rect.top + y,
        button: 0, buttons: 1, bubbles: true
      } ) );
      const record = () => {
        window.__events = [];

        for( const type of [ 'cxttapstart', 'cxtdrag', 'cxttapend', 'cxttap', 'pinchzoom' ] ){
          window.cy.on( type, e => window.__events.push(
            type + ':' + ( e.target === window.cy ? 'cy' : e.target.id() ) ) );
        }
      };

      record();

      // 1. close pair on the node, no movement: cxttapstart -> cxttapend + cxttap on 'a'
      fire( 'pointerdown', 31, center.x - 30, center.y );
      fire( 'pointerdown', 32, center.x + 30, center.y );
      fire( 'pointerup', 31, center.x - 30, center.y );
      fire( 'pointerup', 32, center.x + 30, center.y );

      const tapRun = window.__events.slice();

      // 2. close pair on the background, dragged: cxtdrag, no cxttap
      window.__events = [];
      const bgX = center.x + 250;

      fire( 'pointerdown', 41, bgX - 30, center.y );
      fire( 'pointerdown', 42, bgX + 30, center.y );

      for( let step = 1; step <= 4; step++ ){ // parallel move: spread stays 60
        fire( 'pointermove', 41, bgX - 30 + step * 8, center.y );
        fire( 'pointermove', 42, bgX + 30 + step * 8, center.y );
      }

      fire( 'pointerup', 41, bgX + 2, center.y );
      fire( 'pointerup', 42, bgX + 62, center.y );

      const dragRun = window.__events.slice();

      // 3. close pair spreading out: cxttapend, then the pinch takes over
      window.__events = [];
      const zoomBefore = window.cy.zoom();

      fire( 'pointerdown', 51, center.x - 40, center.y );
      fire( 'pointerdown', 52, center.x + 40, center.y );

      for( let step = 1; step <= 4; step++ ){ // 80 -> 240 apart (past 1.5x and 150 px)
        fire( 'pointermove', 51, center.x - 40 - step * 20, center.y );
        fire( 'pointermove', 52, center.x + 40 + step * 20, center.y );
      }

      fire( 'pointerup', 51, center.x - 120, center.y );
      fire( 'pointerup', 52, center.x + 120, center.y );

      const spreadRun = window.__events.slice();
      const zoomAfter = window.cy.zoom();

      // 4. far pair: pinch immediately, no cxt events
      window.__events = [];
      fire( 'pointerdown', 61, center.x - 110, center.y );
      fire( 'pointerdown', 62, center.x + 110, center.y );
      fire( 'pointermove', 61, center.x - 130, center.y );
      fire( 'pointermove', 62, center.x + 130, center.y );
      fire( 'pointerup', 61, center.x - 130, center.y );
      fire( 'pointerup', 62, center.x + 130, center.y );

      return { tapRun, dragRun, spreadRun, farRun: window.__events.slice(), zoomBefore, zoomAfter };
    }, center );

    expect( run.tapRun ).toEqual( [ 'cxttapstart:a', 'cxttapend:a', 'cxttap:a' ] );

    expect( run.dragRun[ 0 ] ).toBe( 'cxttapstart:cy' );
    expect( run.dragRun ).toContain( 'cxtdrag:cy' );
    expect( run.dragRun ).toContain( 'cxttapend:cy' );
    expect( run.dragRun ).not.toContain( 'cxttap:cy' );
    expect( run.dragRun ).not.toContain( 'pinchzoom:cy' );

    expect( run.spreadRun[ 0 ] ).toBe( 'cxttapstart:a' );
    expect( run.spreadRun ).toContain( 'cxttapend:a' );
    expect( run.spreadRun ).toContain( 'pinchzoom:cy' ); // the pinch took over
    expect( run.spreadRun ).not.toContain( 'cxttap:a' );
    expect( run.zoomAfter ).toBeGreaterThan( run.zoomBefore ); // it actually zoomed

    expect( run.farRun ).toContain( 'pinchzoom:cy' );
    expect( run.farRun.some( ev => ev.startsWith( 'cxt' ) ) ).toBe( false );
  } );

  test( 'three-finger box selection on touch (round 20.5)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 60, y: 40 } },
        { data: { id: 'far' }, position: { x: 400, y: 0 } }
      ],
      style: { nodes: { width: 40, height: 40, 'background-color': 'red' } },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    const run = await page.evaluate( async center => {
      const canvas = document.querySelector( 'canvas' );
      const rect = canvas.getBoundingClientRect();
      const fire = ( type, id, x, y ) => canvas.dispatchEvent( new PointerEvent( type, {
        pointerId: id, pointerType: 'touch',
        clientX: rect.left + x, clientY: rect.top + y,
        button: 0, buttons: 1, bubbles: true
      } ) );

      window.__events = [];

      for( const type of [ 'boxstart', 'boxend', 'cxttapstart', 'cxttapend', 'cxttap', 'pinchzoom', 'dragpan' ] ){
        window.cy.on( type, e => window.__events.push( type ) );
      }

      window.cy.on( 'boxselect', e => window.__events.push( 'boxselect:' + e.target.id() ) );

      const before = { zoom: window.cy.zoom(), pan: window.cy.pan() };

      // three fingers land close together (a cxt pair + a third — the
      // third converts the undragged cxt gesture to the box gesture),
      // centroid starting past the top-left of the nodes...
      const sx = center.x - 120, sy = center.y - 100;

      fire( 'pointerdown', 71, sx - 30, sy );
      fire( 'pointerdown', 72, sx + 30, sy - 20 );
      fire( 'pointerdown', 73, sx, sy + 20 );

      // ...then swipe the centroid to past the bottom-right of a and b
      for( let step = 1; step <= 6; step++ ){
        const dx = step * 40, dy = step * 30;

        fire( 'pointermove', 71, sx - 30 + dx, sy + dy );
        fire( 'pointermove', 72, sx + 30 + dx, sy - 20 + dy );
        fire( 'pointermove', 73, sx + dx, sy + 20 + dy );
      }

      fire( 'pointerup', 71, sx + 210, sy + 180 );

      const afterApply = window.cy.elements( { selected: true } ).map( ele => ele.id() ).sort();

      // the two leftover fingers must be inert: moving them must not zoom/pan
      fire( 'pointermove', 72, sx + 300, sy + 200 );
      fire( 'pointermove', 73, sx + 320, sy + 260 );
      fire( 'pointerup', 72, sx + 300, sy + 200 );
      fire( 'pointerup', 73, sx + 320, sy + 260 );

      return {
        events: window.__events.slice(),
        selected: afterApply,
        zoomUnchanged: window.cy.zoom() === before.zoom,
        panUnchanged: window.cy.pan().x === before.pan.x && window.cy.pan().y === before.pan.y
      };
    }, center );

    expect( run.events ).toContain( 'cxttapstart' ); // the close pair started cxt...
    expect( run.events ).toContain( 'cxttapend' );   // ...and the third finger ended it
    expect( run.events ).not.toContain( 'cxttap' );
    expect( run.events ).toContain( 'boxstart' );
    expect( run.events ).toContain( 'boxend' );
    expect( run.events ).toContain( 'boxselect:a' );
    expect( run.events ).toContain( 'boxselect:b' );
    expect( run.events ).not.toContain( 'pinchzoom' );
    expect( run.events ).not.toContain( 'dragpan' );
    expect( run.selected ).toEqual( [ 'a', 'b' ] ); // 'far' is outside the swept box
    expect( run.zoomUnchanged ).toBe( true );
    expect( run.panUnchanged ).toBe( true );

    // with boxSelectionEnabled off, the same gesture selects nothing
    const disabled = await page.evaluate( async center => {
      window.cy.elements( { selected: true } ).unselect();
      window.cy.boxSelectionEnabled( false );
      window.__events = [];

      const canvas = document.querySelector( 'canvas' );
      const rect = canvas.getBoundingClientRect();
      const fire = ( type, id, x, y ) => canvas.dispatchEvent( new PointerEvent( type, {
        pointerId: id, pointerType: 'touch',
        clientX: rect.left + x, clientY: rect.top + y,
        button: 0, buttons: 1, bubbles: true
      } ) );
      const sx = center.x - 120, sy = center.y - 100;

      fire( 'pointerdown', 81, sx - 30, sy );
      fire( 'pointerdown', 82, sx + 30, sy - 20 );
      fire( 'pointerdown', 83, sx, sy + 20 );

      for( let step = 1; step <= 6; step++ ){
        const dx = step * 40, dy = step * 30;

        fire( 'pointermove', 81, sx - 30 + dx, sy + dy );
        fire( 'pointermove', 82, sx + 30 + dx, sy - 20 + dy );
        fire( 'pointermove', 83, sx + dx, sy + 20 + dy );
      }

      fire( 'pointerup', 81, sx + 210, sy + 180 );
      fire( 'pointerup', 82, sx + 270, sy + 160 );
      fire( 'pointerup', 83, sx + 240, sy + 200 );

      window.cy.boxSelectionEnabled( true );

      return {
        events: window.__events.slice(),
        selected: window.cy.elements( { selected: true } ).length
      };
    }, center );

    expect( disabled.events ).not.toContain( 'boxstart' );
    expect( disabled.selected ).toBe( 0 );
  } );

  test( 'pixelRatio pins the backing-store resolution; picking stays in css px (round 20.6)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, Object.assign( {}, RED_NODE_GRAPH, { pixelRatio: 1 } ) );

    const at1 = await page.evaluate( () => {
      const canvas = document.querySelector( 'canvas' );

      return { w: canvas.width, h: canvas.height, cssW: canvas.clientWidth, cssH: canvas.clientHeight };
    } );

    expect( at1.w ).toBe( at1.cssW );
    expect( at1.h ).toBe( at1.cssH );

    await page.evaluate( () => window.cy.destroy() );
    await makeReadyCy( page, Object.assign( {}, RED_NODE_GRAPH, { pixelRatio: 2 } ) );

    const at2 = await page.evaluate( () => {
      const canvas = document.querySelector( 'canvas' );

      return { w: canvas.width, h: canvas.height, cssW: canvas.clientWidth, cssH: canvas.clientHeight };
    } );

    expect( at2.w ).toBe( at2.cssW * 2 );
    expect( at2.h ).toBe( at2.cssH * 2 );

    // picking is css-px addressed whatever the backing resolution
    const center = await centerPan( page );

    await waitFrames( page );

    const picked = await page.evaluate(
      center => window.cy.pick( center.x, center.y ).then( ele => ele == null ? null : ele.id() ),
      center );

    expect( picked ).toBe( 'a' );
  } );

  test( 'tap selects and background tap clears', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );

    const center = await centerPan( page );

    await waitFrames( page );

    await page.evaluate( () => {
      window.__hovered = false;
      window.cy.on( 'mouseover', () => { window.__hovered = true; } );
    } );

    await page.mouse.move( center.x - 10, center.y - 10 );
    await page.mouse.move( center.x, center.y, { steps: 5 } );
    await expect.poll( () => page.evaluate( () => window.__hovered ), { timeout: 5000 } ).toBe( true );

    await page.mouse.click( center.x, center.y );

    expect( await page.evaluate( () => window.cy.$id( 'a' ).selected() ) ).toBe( true );

    // background tap clears; wait for the hover pick to resolve off the node
    await page.mouse.move( 10, 10 );
    await expect.poll(
      () => page.evaluate( () => window.cy.pick( 10, 10 ).then( ele => ele == null ) ),
      { timeout: 5000 }
    ).toBe( true );

    await page.mouse.click( 10, 10 );

    expect( await page.evaluate( () => window.cy.$id( 'a' ).selected() ) ).toBe( false );
  } );

  test( 'shift-drag box-selects the contained elements', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -30, y: -30 } },
        { data: { id: 'b' }, position: { x: 30, y: 30 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'far' }, position: { x: 300, y: 0 } }
      ],
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    await page.evaluate( () => {
      window.__boxEvents = [];
      window.cy.on( 'boxstart', e => window.__boxEvents.push( e.type ) );
      window.cy.on( 'boxend', e => window.__boxEvents.push( e.type ) );
      window.cy.on( 'boxselect', e => window.__boxEvents.push( 'boxselect:' + e.target.id() ) );
    } );

    await page.keyboard.down( 'Shift' );
    await page.mouse.move( center.x - 100, center.y - 100 );
    await page.mouse.down();
    await page.mouse.move( center.x + 100, center.y + 100, { steps: 8 } );
    await page.mouse.up();
    await page.keyboard.up( 'Shift' );

    const selected = await page.evaluate(
      () => window.cy.elements( { selected: true } ).map( ele => ele.id() ).sort()
    );

    expect( selected ).toEqual( [ 'a', 'ab', 'b' ] );

    const events = await page.evaluate( () => window.__boxEvents );

    expect( events[ 0 ] ).toBe( 'boxstart' );
    expect( events ).toContain( 'boxend' );
    expect( events ).toContain( 'boxselect:a' );
    expect( events ).toContain( 'boxselect:b' );

    // the gesture boxed, not panned
    const pan = await page.evaluate( () => window.cy.pan() );

    expect( pan.x ).toBeCloseTo( center.x, 0 );
    expect( pan.y ).toBeCloseTo( center.y, 0 );

    // a plain background tap clears the box selection (selectionType single)
    await page.mouse.click( center.x - 150, center.y - 150 );

    expect( await page.evaluate( () => window.cy.elements( { selected: true } ).length ) ).toBe( 0 );
  } );

  test( 'events carry the DOM event as originalEvent (round 41.4)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // v4 emitted `{ position }` only, so `originalEvent` was on the type and
    // never on an object — recorded since round 27's fact-check.  The pointer
    // layer now attaches the DOM event it is handling.
    await makeReadyCy( page, {
      elements: [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ],
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    await page.evaluate( () => {
      window.__orig = [];

      const record = name => e => window.__orig.push( {
        name,
        has: e.originalEvent != null,
        domType: e.originalEvent?.type ?? null,
        // the DOM event's own coordinates, to prove it is *this* event and
        // not some retained earlier one
        clientX: e.originalEvent?.clientX ?? null
      } );

      window.cy.on( 'tap', record( 'tap' ) );
      window.cy.on( 'pointerdown', record( 'pointerdown' ) );
      window.cy.$id( 'a' ).on( 'tap', record( 'ele-tap' ) );
    } );

    await page.mouse.click( center.x, center.y );

    const seen = await page.evaluate( () => window.__orig );

    expect( seen.length ).toBeGreaterThan( 0 );

    for( const rec of seen ){
      expect( rec.has, `${rec.name} carried no originalEvent` ).toBe( true );
      expect( rec.clientX, `${rec.name}'s originalEvent has no coordinates` )
        .toBeCloseTo( center.x, 0 );
    }

    // pointerdown carries a pointerdown, not whatever came last
    const down = seen.find( r => r.name === 'pointerdown' );

    expect( down.domType ).toBe( 'pointerdown' );

    // and preventDefault() reaches the DOM event, which is the half of it
    // that works today — the gesture-default half is an open call, so this
    // asserts exactly what is built and no more
    await page.evaluate( () => {
      window.__prevented = null;

      window.cy.one( 'pointerdown', e => {
        e.preventDefault();
        window.__prevented = [ e.isDefaultPrevented(), e.originalEvent.defaultPrevented ];
      } );
    } );

    await page.mouse.click( center.x, center.y );

    expect( await page.evaluate( () => window.__prevented ) ).toEqual( [ true, true ] );
  } );

  test( 'boxSelectionMode overlap catches what the band touches (round 39.1)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // the same gesture, run twice against the same scene under each mode:
    // the Node specs pin the query, and this pins that the *gesture* is
    // what reads the option — the seam between them is where the mode
    // could silently do nothing.
    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -200, y: 0 } },
        { data: { id: 'b' }, position: { x: 200, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'straddles' }, position: { x: -60, y: 0 } }
      ],
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // a tall band across the middle: it holds no node whole, cuts the
    // 'straddles' node, and crosses the a-b edge with both ends outside
    const drag = async () => {
      await page.evaluate( () => window.cy.elements().unselect() );
      await page.keyboard.down( 'Shift' );
      await page.mouse.move( center.x - 50, center.y - 120 );
      await page.mouse.down();
      await page.mouse.move( center.x + 10, center.y + 120, { steps: 8 } );
      await page.mouse.up();
      await page.keyboard.up( 'Shift' );

      return page.evaluate(
        () => window.cy.elements( { selected: true } ).map( ele => ele.id() ).sort()
      );
    };

    expect( await drag() ).toEqual( [] ); // 'contain' is the default

    await page.evaluate( () => window.cy.boxSelectionMode( 'overlap' ) );

    expect( await drag() ).toEqual( [ 'ab', 'straddles' ] );
  } );

  test( "events: 'no' elements are pointer-transparent but still render (round 20.2)", async ( { page } ) => {
    await page.goto( PAGE );
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'under', kind: 'plain' }, position: { x: 0, y: 0 } },
        { data: { id: 'top', kind: 'ui' }, position: { x: 0, y: 0 } }, // higher slot: drawn over 'under'
        { data: { id: 'x1', kind: 'plain' }, position: { x: -60, y: 150 } },
        { data: { id: 'x2', kind: 'plain' }, position: { x: 60, y: 150 } },
        { data: { id: 'ex', source: 'x1', target: 'x2' } }
      ],
      style: {
        nodes: {
          width: 60, height: 60, shape: 'rectangle',
          'background-color': { case: [ { when: { data: 'kind', eq: 'ui' }, then: 'blue' } ], else: 'red' },
          events: { case: [ { when: { data: 'kind', eq: 'ui' }, then: 'no' } ], else: 'yes' }
        },
        edges: { width: 8, events: 'no' }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // still rendered: the events:'no' node draws on top (blue wins the pixel)
    const px = await pixelAt( page, center.x, center.y );

    expect( px[ 2 ] ).toBeGreaterThan( 150 ); // blue
    expect( px[ 0 ] ).toBeLessThan( 100 );

    // hover passes through to the node beneath
    await page.evaluate( () => {
      window.__hovers = [];
      window.cy.on( 'mouseover', e => window.__hovers.push( e.target.id() ) );
    } );
    await page.mouse.move( center.x - 40, center.y - 40 );
    await page.mouse.move( center.x, center.y, { steps: 4 } );

    await expect.poll( () => page.evaluate( () => window.__hovers ) ).toContain( 'under' );
    expect( await page.evaluate( () => window.__hovers ) ).not.toContain( 'top' );

    // a drag grabs the node beneath, never the transparent one
    await page.mouse.down();
    await page.mouse.move( center.x + 40, center.y, { steps: 4 } );
    await page.mouse.up();

    const dragged = await page.evaluate( () => ( {
      under: window.cy.$id( 'under' ).position(),
      top: window.cy.$id( 'top' ).position()
    } ) );

    expect( dragged.under.x ).toBeCloseTo( 40, 0 );
    expect( dragged.top.x ).toBeCloseTo( 0, 0 );

    // the GPU edge pick skips events:'no' edges; a restyle flips it live
    // (this also pins pick-cache invalidation: same cursor, flag change)
    const edgePick1 = await page.evaluate( () => {
      const w = window.innerWidth, h = window.innerHeight;

      return window.cy.pick( w / 2, h / 2 + 150 ).then( ele => ele == null ? null : ele.id() );
    } );

    expect( edgePick1 ).toBe( null );

    await page.evaluate( () => {
      window.cy.style( {
        nodes: { width: 60, height: 60, shape: 'rectangle', 'background-color': 'red' },
        edges: { width: 8, events: 'yes' }
      } );
    } );
    await waitFrames( page );

    const edgePick2 = await page.evaluate( () => {
      const w = window.innerWidth, h = window.innerHeight;

      return window.cy.pick( w / 2, h / 2 + 150 ).then( ele => ele == null ? null : ele.id() );
    } );

    expect( edgePick2 ).toBe( 'ex' );

    // the box gesture skips events:'no' elements (v3's interactive rule)
    await page.evaluate( () => {
      window.cy.style( {
        nodes: {
          width: 60, height: 60, shape: 'rectangle',
          events: { case: [ { when: { data: 'kind', eq: 'ui' }, then: 'no' } ], else: 'yes' }
        },
        edges: { width: 8, events: 'no' }
      } );
      window.__boxed = [];
      window.cy.on( 'box', e => window.__boxed.push( e.target.id() ) );
    } );
    await waitFrames( page );

    await page.keyboard.down( 'Shift' );
    await page.mouse.move( center.x - 150, center.y - 100 );
    await page.mouse.down();
    await page.mouse.move( center.x + 150, center.y + 220, { steps: 8 } );
    await page.mouse.up();
    await page.keyboard.up( 'Shift' );

    const boxSelected = await page.evaluate(
      () => window.cy.elements( { selected: true } ).map( ele => ele.id() ).sort()
    );

    expect( boxSelected ).toEqual( [ 'under', 'x1', 'x2' ] ); // no 'top', no 'ex'
    expect( await page.evaluate( () => window.__boxed.sort() ) ).toEqual( [ 'under', 'x1', 'x2' ] );
  } );

  test( "text-events: 'yes' makes the label box tap the node (round 20.3)", async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    const style = textEvents => ( {
      nodes: {
        width: 40, height: 40, shape: 'rectangle', 'background-color': 'red',
        label: 'HELLO WORLD', 'font-size': 18, 'text-events': textEvents
      }
    } );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ],
      style: style( 'no' ), // v3's default: the label is pointer-transparent
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // the label center in rendered coords (zoom 1: model + pan)
    const label = await page.evaluate( () => {
      const bb = window.cy.$id( 'a' ).labelBoundingBox();
      const pan = window.cy.pan();

      return { x: ( bb.x1 + bb.x2 ) / 2 + pan.x, y: ( bb.y1 + bb.y2 ) / 2 + pan.y };
    } );

    expect( label.y ).toBeGreaterThan( center.y + 20 ); // below the node body

    await page.mouse.click( label.x, label.y );

    expect( await page.evaluate( () => window.cy.$id( 'a' ).selected() ) ).toBe( false ); // background tap

    await page.evaluate( s => window.cy.style( s ), style( 'yes' ) );
    await waitFrames( page );

    await page.mouse.click( label.x, label.y );

    await expect.poll( () => page.evaluate( () => window.cy.$id( 'a' ).selected() ) ).toBe( true );
  } );

  test( "visibility: 'hidden' blanks pixels but keeps space (round 22)", async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    const style = vis => ( {
      nodes: {
        width: 60, height: 60, shape: 'rectangle', 'background-color': 'red',
        label: 'GHOST', 'font-size': 16,
        visibility: { case: [ { when: { data: 'kind', eq: 'ghosty' }, then: vis } ], else: 'visible' }
      },
      edges: { width: 8, 'line-color': 'red' }
    } );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a', kind: 'ghosty' }, position: { x: 0, y: 0 } },
        { data: { id: 'b', kind: 'plain' }, position: { x: 150, y: 0 } },
        { data: { id: 'e', source: 'a', target: 'b' } },
        { data: { id: 'far', kind: 'plain' }, position: { x: 400, y: 300 } }
      ],
      style: style( 'hidden' ),
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // the invisible node paints nothing (background white), and its
    // incident edge (invisible endpoint) is gone too
    const nodePx = await pixelAt( page, center.x, center.y );
    const edgePx = await pixelAt( page, center.x + 75, center.y );

    expect( nodePx[ 0 ] ).toBeGreaterThan( 200 ); // white, not red
    expect( nodePx[ 1 ] ).toBeGreaterThan( 200 );
    expect( edgePx[ 1 ] ).toBeGreaterThan( 200 );

    // no label either (the glyph stream reads the same bit)
    const labelDark = await darkPixelsInBand( page, center.x - 60, 120, center.y + 45 );

    expect( labelDark ).toBe( 0 );

    // but the space holds: fit() frames the invisible node too
    await page.evaluate( () => window.cy.fit() );

    const fitWithInvisible = await page.evaluate( () => window.cy.zoom() );

    // a tap where the invisible node sits is a background tap
    await page.evaluate( () => { window.cy.zoom( 1 ); } );
    await centerPan( page );
    await waitFrames( page );
    await page.evaluate( () => {
      window.__bgTaps = 0;
      window.cy.on( 'tap', e => { if( e.target === window.cy ){ window.__bgTaps++; } } );
    } );
    await page.mouse.click( center.x, center.y );
    await expect.poll( () => page.evaluate( () => window.__bgTaps ) ).toBe( 1 );

    // restyle to visible: pixels return (pick/pixel state both flip live)
    await page.evaluate( s => window.cy.style( s ), style( 'visible' ) );
    await waitFrames( page );

    const backPx = await pixelAt( page, center.x, center.y );

    expect( backPx[ 0 ] ).toBeGreaterThan( 150 ); // red again
    expect( backPx[ 1 ] ).toBeLessThan( 100 );

    // display-tier hide() gives up the space: fit() zooms in further
    await page.evaluate( () => { window.cy.$id( 'far' ).hide(); window.cy.fit(); } );

    const fitWithoutFar = await page.evaluate( () => window.cy.zoom() );

    expect( fitWithoutFar ).toBeGreaterThan( fitWithInvisible * 1.2 );
  } );

  test( 'mapped opacity evaluates on the GPU: a data write repaints without a CPU restyle', async ( { page } ) => {
    await page.goto( PAGE );
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'a', o: 1 }, position: { x: 0, y: 0 } } ],
      style: { nodes: {
        'background-color': 'red', 'width': 100, 'height': 100, 'shape': 'rectangle',
        'opacity': { data: 'o', domain: [ 0, 1 ], range: [ 0, 1 ] }
      } },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    const before = await pixelAt( page, center.x, center.y );

    expect( before[ 0 ] ).toBeGreaterThan( 200 ); // opaque red
    expect( before[ 1 ] ).toBeLessThan( 60 );

    const stats = await page.evaluate( async () => {
      const cy = window.cy;
      const renderer = cy.renderer();
      const s0 = renderer.stats();

      await new Promise( resolve => {
        cy.one( 'render', () => resolve() );
        cy.$id( 'a' ).data( 'o', 0.1 );
      } );

      const s1 = renderer.stats();

      return {
        mapperBytes: s1.mapperUploadedBytes - s0.mapperUploadedBytes,
        dispatches: s1.mapperDispatches - s0.mapperDispatches,
        opacityRead: cy.$id( 'a' ).numericStyle( 'opacity' )
      };
    } );

    // the write cost data bytes + a dispatch, not a column restyle
    expect( stats.dispatches ).toBeGreaterThan( 0 );
    expect( stats.mapperBytes ).toBeGreaterThan( 0 );
    expect( stats.mapperBytes ).toBeLessThan( 64 );
    expect( stats.opacityRead ).toBeCloseTo( 0.1, 2 ); // lazy IR getter

    await waitFrames( page );

    // 10% red over the white page: green floods in
    const after = await pixelAt( page, center.x, center.y );

    expect( after[ 1 ] ).toBeGreaterThan( 150 );
  } );

  test( 'animate() tweens a node position to the target over time', async ( { page } ) => {
    await page.goto( PAGE );
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'a' }, position: { x: -100, y: 0 } } ],
      style: { nodes: { 'background-color': 'red', 'width': 60, 'height': 60, 'shape': 'rectangle' } },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // red node vs white page: the green channel distinguishes (node g≈0,
    // background g≈255).  Node starts 100px left of centre.
    expect( ( await pixelAt( page, center.x - 100, center.y ) )[ 1 ] ).toBeLessThan( 80 );
    expect( ( await pixelAt( page, center.x, center.y ) )[ 1 ] ).toBeGreaterThan( 200 );

    // animate to centre and wait for completion
    await page.evaluate( async () => {
      await window.cy.$id( 'a' ).animation( { position: { x: 0, y: 0 }, duration: 200 } ).play();
    } );
    await waitFrames( page );

    const finalPos = await page.evaluate( () => window.cy.$id( 'a' ).position() );

    expect( finalPos.x ).toBeCloseTo( 0, 3 );

    // the red node is now at centre (green drops there)
    expect( ( await pixelAt( page, center.x, center.y ) )[ 1 ] ).toBeLessThan( 80 );
    expect( await page.evaluate( () => window.cy.$id( 'a' ).animated() ) ).toBe( false );
  } );

  test( 'GPU position tween holds the lease: CPU position stays stale while the node moves', async ( { page } ) => {
    await page.goto( PAGE );
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'a' }, position: { x: -120, y: 0 } } ],
      style: { nodes: { 'background-color': 'red', 'width': 50, 'height': 50, 'shape': 'rectangle' } },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // a long animation so we can sample mid-flight
    await page.evaluate( () => window.cy.$id( 'a' ).animate( { position: { x: 120, y: 0 }, duration: 1500, easing: 'linear' } ) );

    // the node has visibly left its start location...  The settled node
    // would clear this pixel too; the stale-CPU assertion below is what
    // makes this a mid-flight observation (see untilMidFlight)
    await untilMidFlight( page,
      () => pixelAt( page, center.x - 120, center.y ),
      px => px[ 1 ] > 150,
      { timeout: 6000, what: 'the node leaving its start location' } );

    // ...but the CPU position column is still the start value: the GPU owns
    // node.position during the tween (the lease), so sync reads are stale
    expect( await page.evaluate( () => window.cy.$id( 'a' ).position().x ) ).toBe( -120 );

    // grabbing is forbidden while it animates
    expect( await page.evaluate( () => window.cy.$id( 'a' ).grabbed() ) ).toBe( false );

    // finishing settles the final value onto the CPU columns
    await page.evaluate( () => window.cy.$id( 'a' ).animation( { position: { x: 120, y: 0 }, duration: 1 } ).play() );
    await waitFrames( page );

    expect( await page.evaluate( () => window.cy.$id( 'a' ).position().x ) ).toBeCloseTo( 120, 0 );
    expect( await page.evaluate( () => window.cy.$id( 'a' ).animated() ) ).toBe( false );
  } );

  test( 'GPU paint tween holds the lease: pixels fade while the CPU style stays stale', async ( { page } ) => {
    await page.goto( PAGE );
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ],
      style: { nodes: {
        'background-color': 'rgb(0,0,255)', 'width': 100, 'height': 100, 'shape': 'rectangle' } },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // blue node on the white page
    expect( ( await pixelAt( page, center.x, center.y ) ).slice( 0, 3 ) ).toEqual( [ 0, 0, 255 ] );

    // a long tween towards yellow, so we can sample mid-flight
    await page.evaluate( () => window.cy.$id( 'a' ).animate( {
      style: { 'background-color': 'rgb(255,255,0)' }, duration: 2000, easing: 'linear' } ) );
    // the paint has visibly moved off blue (≈[93,180,206] at t=0.45).  Yellow
    // satisfies this too; the stale-CPU assertion below is the discriminator
    const mid = await untilMidFlight( page,
      () => pixelAt( page, center.x, center.y ),
      px => px[ 0 ] > 30 && px[ 2 ] < 245,
      { timeout: 6000, what: 'the paint moving off blue' } );

    // ...and it went through OKLab, not per-channel sRGB: at any point on the
    // blue→yellow OKLab path green leads red (sRGB would keep them equal)
    expect( mid[ 1 ] ).toBeGreaterThan( mid[ 0 ] );

    // but the CPU column is still the start colour: the device owns
    // node.fillColor for the flight, so style() reads are stale
    expect( await page.evaluate( () => window.cy.$id( 'a' ).style( 'background-color' ) ) )
      .toBe( 'rgb(0,0,255)' );

    // finishing settles the exact target onto the CPU columns, and the mapper
    // pass has nothing to reclaim here (a constant, not a mapping)
    await page.evaluate( () => window.cy.$id( 'a' ).animation( {
      style: { 'background-color': 'rgb(255,255,0)' }, duration: 1 } ).play() );
    await waitFrames( page );

    expect( await page.evaluate( () => window.cy.$id( 'a' ).style( 'background-color' ) ) )
      .toBe( 'rgb(255,255,0)' );
    expect( await page.evaluate( () => window.cy.$id( 'a' ).animated() ) ).toBe( false );
    expect( ( await pixelAt( page, center.x, center.y ) ).slice( 0, 3 ) ).toEqual( [ 255, 255, 0 ] );
  } );

  test( 'a paint tween outranks the mapper, and the mapper reclaims the channel on settle', async ( { page } ) => {
    await page.goto( PAGE );
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'a', o: 1 }, position: { x: 0, y: 0 } } ],
      style: { nodes: {
        'background-color': 'rgb(0,0,255)', 'width': 100, 'height': 100, 'shape': 'rectangle',
        'opacity': { data: 'o', domain: [ 0, 1 ], range: [ 0, 1 ] }
      } },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // fully opaque blue: the mapper evaluates o=1
    expect( ( await pixelAt( page, center.x, center.y ) )[ 2 ] ).toBeGreaterThan( 200 );

    // the tween and the mapper both target node.opacity every frame; the tween
    // is encoded after the eval dispatch in the same pass, so it wins
    await page.evaluate( () => window.cy.$id( 'a' ).animate( {
      style: { opacity: 0 }, duration: 2000, easing: 'linear' } ) );
    // white bleeding through, but not yet fully: at opacity 0 the pixel is
    // white (255), so the upper bound is only satisfiable mid-flight
    await untilMidFlight( page,
      () => pixelAt( page, center.x, center.y ),
      px => px[ 0 ] > 40 && px[ 0 ] < 220,
      { timeout: 6000, what: 'the node fading part-way' } );

    // stopping releases the lease, and the settle's CPU write dirties an owned
    // column — which is exactly the mapper's reclaim trigger, so the mapped
    // value comes straight back with no extra machinery
    await page.evaluate( () => window.cy.$id( 'a' ).stop() );
    await waitFrames( page );

    expect( await page.evaluate( () => window.cy.$id( 'a' ).animated() ) ).toBe( false );
    expect( ( await pixelAt( page, center.x, center.y ) )[ 2 ] ).toBeGreaterThan( 200 );

    // and the reclaimed channel still tracks data writes on the GPU
    await page.evaluate( async () => {
      await new Promise( resolve => {
        window.cy.one( 'render', () => resolve() );
        window.cy.$id( 'a' ).data( 'o', 0.1 );
      } );
    } );
    await waitFrames( page );

    expect( ( await pixelAt( page, center.x, center.y ) )[ 0 ] ).toBeGreaterThan( 200 );
  } );

  test( 'a style transition rides the GPU tween path and lands on the resolved end state (24.2)', async ( { page } ) => {
    await page.goto( PAGE );
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter' );

    const TRANSITION = {
      'transition-property': [ 'background-color' ],
      'transition-duration': 2000,
      'transition-timing-function': 'linear'
    };

    await makeReadyCy( page, {
      elements: [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ],
      style: { nodes: {
        'background-color': 'rgb(0,0,255)', 'width': 100, 'height': 100, 'shape': 'rectangle',
        ...TRANSITION
      } },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );
    expect( ( await pixelAt( page, center.x, center.y ) ).slice( 0, 3 ) ).toEqual( [ 0, 0, 255 ] );

    // a restyle triggers the transition — an all-paint preset offloads
    // to the GPU tween kernels, so pixels move while the CPU column
    // holds the pre-restyle value (the motion-staleness rule)
    await page.evaluate( ( t ) => window.cy.style( { nodes: {
      'background-color': 'rgb(255,255,0)', 'width': 100, 'height': 100, 'shape': 'rectangle', ...t
    } } ), TRANSITION );

    // visibly off blue — settled yellow satisfies this pair too, and the
    // OKLab check below (green leads red; yellow has them equal) is what
    // rules it out
    const mid = await untilMidFlight( page,
      () => pixelAt( page, center.x, center.y ),
      px => px[ 0 ] > 30 && px[ 2 ] < 245,
      { timeout: 6000, what: 'the paint moving off blue' } );
    expect( mid[ 1 ] ).toBeGreaterThan( mid[ 0 ] ); // ...through OKLab (green leads red)

    expect( await page.evaluate( () => window.cy.$id( 'a' ).style( 'background-color' ) ) )
      .toBe( 'rgb(0,0,255)' );

    // completion settles the exact resolved end state onto the CPU.  Polled
    // rather than slept: the mid-flight wait above ends when the tween
    // reaches its state, not at a fixed offset, so there is no fixed
    // remainder left to sleep — and the assertion is about the end state
    // arriving, not about when.
    await expect.poll(
      () => page.evaluate( () => ( {
        colour: window.cy.$id( 'a' ).style( 'background-color' ),
        animated: window.cy.$id( 'a' ).animated()
      } ) ),
      { timeout: 5000, message: 'the transition settles on the resolved end state' }
    ).toEqual( { colour: 'rgb(255,255,0)', animated: false } );

    await waitFrames( page );

    expect( ( await pixelAt( page, center.x, center.y ) ).slice( 0, 3 ) ).toEqual( [ 255, 255, 0 ] );
  } );

  test( 'a mapped-channel transition works under the renderer: listing a prop demotes its kernel eval (24.2)', async ( { page } ) => {
    await page.goto( PAGE );
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter' );

    // background-color is a single-key scale mapper — kernel-ownable —
    // but it is listed in transition-property, so its eval stays CPU
    // (the diff needs fresh stored bytes) and a data write transitions
    // instead of snapping through the narrow GPU-owned refresh path
    await makeReadyCy( page, {
      elements: [ { data: { id: 'a', w: 0 }, position: { x: 0, y: 0 } } ],
      style: { nodes: {
        'background-color': { data: 'w', domain: [ 0, 1 ], range: [ 'rgb(0,0,255)', 'rgb(255,255,0)' ] },
        'width': 100, 'height': 100, 'shape': 'rectangle',
        'transition-property': [ 'background-color' ],
        'transition-duration': 2000,
        'transition-timing-function': 'linear'
      } },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );
    expect( ( await pixelAt( page, center.x, center.y ) ).slice( 0, 3 ) ).toEqual( [ 0, 0, 255 ] );

    await page.evaluate( () => window.cy.$id( 'a' ).data( 'w', 1 ) );

    // tweening, not snapped — a snap lands on yellow, which the OKLab check
    // below rejects (green leads red on the path; yellow has them equal)
    const mid = await untilMidFlight( page,
      () => pixelAt( page, center.x, center.y ),
      px => px[ 0 ] > 30 && px[ 2 ] < 245,
      { timeout: 6000, what: 'the mapped channel tweening' } );
    expect( mid[ 1 ] ).toBeGreaterThan( mid[ 0 ] );

    // the settled end state is the mapper's resolved value at w=1 — polled,
    // for the reason the style-transition spec above records
    await expect.poll(
      () => page.evaluate( () => window.cy.$id( 'a' ).style( 'background-color' ) ),
      { timeout: 5000, message: 'the transition settles on the mapper\'s value at w=1' }
    ).toBe( 'rgb(255,255,0)' );

    await waitFrames( page );

    expect( ( await pixelAt( page, center.x, center.y ) ).slice( 0, 3 ) ).toEqual( [ 255, 255, 0 ] );
  } );

  test( 'a size transition tweens pixels mid-flight with the label anchor riding (25.6)', async ( { page } ) => {
    await page.goto( PAGE );
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter' );

    const TRANSITION = {
      'transition-property': [ 'width' ],
      'transition-duration': 2000,
      'transition-timing-function': 'linear'
    };
    const block = width => ( {
      'background-color': 'rgb(255,0,0)', width, height: 40, shape: 'rectangle',
      label: { data: 'id' }, 'text-halign': 'left',
      ...TRANSITION
    } );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ],
      style: { nodes: block( 40 ) },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );
    // x+40 is outside the 40px-wide box (half 20)
    expect( ( await pixelAt( page, center.x + 40, center.y ) )[ 1 ] ).toBeGreaterThan( 200 );

    await page.evaluate( ( b ) => window.cy.style( { nodes: b } ), block( 200 ) );

    // mid-flight the box has grown past x+40 but not to its target half-width
    // yet: half = 20 + 80t, so the window is t ∈ (0.25, 0.94) of the 2000ms
    // transition.  Both ends come out of *one* row read, so they are the same
    // instant rather than two screenshots apart, and 1700 < 1875 keeps the
    // upper bound a real constraint.
    await untilMidFlight( page,
      async () => {
        const row = await clipPixels(
          page, Math.round( center.x + 40 ), Math.round( center.y ), 56 );

        return row == null ? null : { inner: row[ 1 ], outer: row[ 55 * 4 + 1 ] };
      },
      px => px != null && px.inner < 80 && px.outer > 200,
      { timeout: 6000, what: 'the box past x+40 but short of x+95' } );

    // geometry tweens are never stale: the sync read is the mid-flight
    // value (unlike a leased paint transition, which holds pre-restyle);
    // width and anchor read in one evaluate — no tick between them
    const midState = await page.evaluate( () => ( {
      width: window.cy.$id( 'a' ).width(),
      anchorX: window.cy._store.labelAt( window.cy._store.lookup( 'a' ).slot, 'nodes' ).anchorX
    } ) );

    expect( midState.width ).toBeGreaterThan( 50 );
    expect( midState.width ).toBeLessThan( 190 );

    // the hanging label re-anchors in step (-w/2 at text-halign left)
    expect( midState.anchorX ).toBeCloseTo( -midState.width / 2, 3 );

    // settled — polled, for the reason the style-transition spec records
    await expect.poll(
      () => page.evaluate( () => window.cy.$id( 'a' ).width() ),
      { timeout: 5000, message: 'the width transition settles on 200' }
    ).toBe( 200 );

    await waitFrames( page );

    expect( ( await pixelAt( page, center.x + 95, center.y ) )[ 1 ] ).toBeLessThan( 80 );
  } );

  test( 'an edge-width transition thickens the casing in step (25.6)', async ( { page } ) => {
    await page.goto( PAGE );
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter' );

    const TRANSITION = {
      'transition-property': [ 'width' ],
      'transition-duration': 3000,
      'transition-timing-function': 'linear'
    };
    const block = width => ( {
      width, 'line-color': 'rgb(255,0,0)',
      'line-outline-width': 6, 'line-outline-color': 'rgb(0,0,0)',
      ...TRANSITION
    } );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -60, y: 0 } },
        { data: { id: 'b' }, position: { x: 60, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { width: 20, height: 20 },
        edges: block( 2 )
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );
    // y+8 clears the initial casing entirely (half = (2+6)/2 = 4)
    expect( ( await pixelAt( page, center.x, center.y + 8 ) )[ 1 ] ).toBeGreaterThan( 200 );

    await page.evaluate( ( b ) => window.cy.style( { edges: b } ), block( 30 ) );

    // mid-flight, y+8 sits in the black casing band while the line is
    // still short of it — casing half (w+6)/2 > 8 while line half
    // w/2 < 8, i.e. w ∈ (10, 16): a ~640ms window under the linear
    // 3s tween.  Only a riding stroke ever puts casing pixels here.
    //
    // This one polled before the rest of the file did, but it gave up the
    // moment it saw the red line — so a late first sample, which is exactly
    // what a loaded software rasterizer produces, failed it outright.  Poll
    // to the bound instead: a genuinely missed window still fails, and it
    // fails with the pixel it last saw.
    await untilMidFlight( page,
      () => pixelAt( page, center.x, center.y + 8 ),
      px => px[ 0 ] < 80 && px[ 1 ] < 80,
      { timeout: 6000, what: 'the casing band riding over y+8' } );

    await page.waitForTimeout( 3200 );
    await waitFrames( page );

    // settled: the line itself (half 15) covers y+8 in red
    const end = await pixelAt( page, center.x, center.y + 8 );

    expect( end[ 0 ] ).toBeGreaterThan( 200 );
    expect( end[ 1 ] ).toBeLessThan( 80 );
  } );

  test( 'spring() overshoots on the device: the node passes the target, then settles on it', async ( { page } ) => {
    await page.goto( PAGE );
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'a' }, position: { x: -100, y: 0 } } ],
      style: { nodes: { 'background-color': 'red', 'width': 40, 'height': 40, 'shape': 'rectangle' } },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    /*
    A spring compiles to a progression array on the CPU, so this exercises the
    kernel's points evaluator.  bounce 0.7 is ζ=0.3, whose first peak is 37%
    past the target half a perceptual duration in — and the curve is flat
    around that peak, so a wide sampling window still lands well past 1.
    */
    await page.evaluate( () => {
      window.__springStart = performance.now();
      window.cy.$id( 'a' ).animate( {
        position: { x: 0, y: 0 }, duration: 2000, easing: 'spring(0.7)' } );
    } );
    // 35px past the target: only an overshoot puts the node here, and the
    // settled node (half-width 20, centred on the target) never does — so
    // this cannot pass by sampling after the ringing decays
    await untilMidFlight( page,
      () => pixelAt( page, center.x + 35, center.y ),
      px => px[ 1 ] < 80,
      { timeout: 6000, what: 'the node overshooting 35px past the target' } );

    // it also runs past its perceptual duration while the ringing decays.
    // Anchored to the animation's own start rather than to whenever the
    // overshoot poll above returned: 2200ms is past the 2000ms perceptual
    // duration, and drifting later would land after the ringing has decayed
    // and assert nothing.
    await page.evaluate( () => new Promise( resolve => {
      const wait = () => {
        if( performance.now() - window.__springStart >= 2200 ){ resolve(); }
        else { requestAnimationFrame( wait ); }
      };

      wait();
    } ) );

    expect( await page.evaluate( () => window.cy.$id( 'a' ).animated() ) ).toBe( true );

    // and it lands exactly on the target, overshoot or not
    await page.evaluate( () => window.cy.$id( 'a' ).stop( true, true ) );
    await waitFrames( page );

    expect( await page.evaluate( () => window.cy.$id( 'a' ).position().x ) ).toBeCloseTo( 0, 3 );
    expect( ( await pixelAt( page, center.x + 35, center.y ) )[ 1 ] ).toBeGreaterThan( 200 );
    expect( ( await pixelAt( page, center.x, center.y ) )[ 1 ] ).toBeLessThan( 80 );
  } );

  test( 'a steep named easing is evaluated on the device, not treated as linear', async ( { page } ) => {
    await page.goto( PAGE );
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'a' }, position: { x: -100, y: 0 } } ],
      style: { nodes: { 'background-color': 'red', 'width': 40, 'height': 40, 'shape': 'rectangle' } },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // ease-in-expo is ~0.03 of the way at 40% of the time; linear would be at
    // 0.4, which is 76px further along — far more than the node is wide
    await page.evaluate( () => window.cy.$id( 'a' ).animate( {
      position: { x: 100, y: 0 }, duration: 2000, easing: 'ease-in-expo' } ) );
    await page.waitForTimeout( 800 );
    await waitFrames( page );

    expect( ( await pixelAt( page, center.x - 95, center.y ) )[ 1 ] ).toBeLessThan( 80 );
    expect( ( await pixelAt( page, center.x - 20, center.y ) )[ 1 ] ).toBeGreaterThan( 200 );

    await page.evaluate( () => window.cy.$id( 'a' ).stop( true, true ) );
    await waitFrames( page );

    expect( ( await pixelAt( page, center.x + 100, center.y ) )[ 1 ] ).toBeLessThan( 80 );
  } );

  test( 'mapped colors render the OKLab interpolation the getters report', async ( { page } ) => {
    await page.goto( PAGE );
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'a', s: 0 }, position: { x: 0, y: 0 } } ],
      style: { nodes: {
        'width': 100, 'height': 100, 'shape': 'rectangle',
        'background-color': { data: 's', domain: [ 0, 1 ], range: 'viridis' }
      } },
      zoom: 1
    } );

    const center = await centerPan( page );
    const readRgb = async () => await page.evaluate( () => {
      const match = /rgb\((\d+),(\d+),(\d+)\)/.exec( window.cy.$id( 'a' ).style( 'background-color' ) );

      return [ Number( match[ 1 ] ), Number( match[ 2 ] ), Number( match[ 3 ] ) ];
    } );

    await waitFrames( page );

    const before = await pixelAt( page, center.x, center.y );

    expect( before.slice( 0, 3 ) ).toEqual( [ 0x44, 0x01, 0x54 ] ); // viridis start, exact

    await page.evaluate( async () => {
      await new Promise( resolve => {
        window.cy.one( 'render', () => resolve() );
        window.cy.$id( 'a' ).data( 's', 0.5 );
      } );
    } );
    await waitFrames( page );

    // the rendered pixel and the lazily-evaluated getter agree ±1/byte
    const expected = await readRgb();
    const after = await pixelAt( page, center.x, center.y );

    for( let c = 0; c < 3; c++ ){
      expect( Math.abs( after[ c ] - expected[ c ] ) ).toBeLessThanOrEqual( 1 );
    }

    // and it is an OKLab midpoint, not the old bytes
    expect( Math.abs( after[ 1 ] - before[ 1 ] ) ).toBeGreaterThan( 40 );
  } );

  /** Export a png in-page, decode it, and sample pixels at output coords. */
  const pngAndSample = async ( page, opts, samples ) => {
    return await page.evaluate( async ( { opts, samples } ) => {
      const uri = await window.cy.png( opts );
      const img = new Image();

      img.src = uri;
      await img.decode();

      const canvas = document.createElement( 'canvas' );

      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext( '2d' );

      ctx.drawImage( img, 0, 0 );

      const pixels = samples.map( ( [ x, y ] ) => {
        const d = ctx.getImageData( x, y, 1, 1 ).data;

        return [ d[0], d[1], d[2], d[3] ];
      } );

      return { width: img.width, height: img.height, pixels, prefix: uri.slice( 0, 22 ) };
    }, { opts, samples } );
  };

  test( 'png() exports the viewport: dimensions, node pixels, transparent background', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );

    const center = await centerPan( page );

    await waitFrames( page );

    const { width, height, pixels, prefix } = await pngAndSample(
      page, {}, [ [ center.x, center.y ], [ 5, 5 ] ]
    );

    expect( prefix ).toBe( 'data:image/png;base64,' );
    expect( width ).toBe( 800 );
    expect( height ).toBe( 600 );

    // node body: red, opaque
    expect( pixels[0][0] ).toBeGreaterThan( 200 );
    expect( pixels[0][1] ).toBeLessThan( 60 );
    expect( pixels[0][2] ).toBeLessThan( 60 );
    expect( pixels[0][3] ).toBe( 255 );

    // background: transparent (no bg option)
    expect( pixels[1][3] ).toBe( 0 );
  } );

  test( 'png() full export sizes to the graph bounds; scale and maxWidth apply', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a', kind: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b', kind: 'b' }, position: { x: 200, y: 100 } }
      ],
      style: { nodes: {
        'width': 100, 'height': 100, 'shape': 'rectangle',
        'background-color': { data: 'kind', scale: 'ordinal', domain: [ 'a', 'b' ], range: [ 'red', 'blue' ] }
      } },
      zoom: 1
    } );
    await waitFrames( page );

    // bb: x -50..250, y -50..150 → 300×200 at scale 1, panned to the origin
    const full = await pngAndSample( page, { full: true }, [ [ 50, 50 ], [ 250, 150 ] ] );

    expect( full.width ).toBe( 300 );
    expect( full.height ).toBe( 200 );

    // node a (red) at model (0,0) → export px (50,50)
    expect( full.pixels[0][0] ).toBeGreaterThan( 200 );
    expect( full.pixels[0][2] ).toBeLessThan( 60 );

    // node b (blue) at model (200,100) → export px (250,150)
    expect( full.pixels[1][0] ).toBeLessThan( 60 );
    expect( full.pixels[1][2] ).toBeGreaterThan( 200 );

    const scaled = await pngAndSample( page, { full: true, scale: 2 }, [ [ 100, 100 ] ] );

    expect( scaled.width ).toBe( 600 );
    expect( scaled.height ).toBe( 400 );
    expect( scaled.pixels[0][0] ).toBeGreaterThan( 200 ); // node a still red at 2×

    const capped = await pngAndSample( page, { full: true, maxWidth: 150 }, [] );

    expect( capped.width ).toBe( 150 );
    expect( capped.height ).toBe( 100 );
  } );

  test( 'png() bg option fills the background; jpg() defaults to white', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );
    await centerPan( page );
    await waitFrames( page );

    const { pixels } = await pngAndSample( page, { bg: '#00ff00' }, [ [ 5, 5 ] ] );

    expect( pixels[0] ).toEqual( [ 0, 255, 0, 255 ] );

    const jpg = await page.evaluate( async () => {
      const uri = await window.cy.jpg( { quality: 0.9 } );
      const img = new Image();

      img.src = uri;
      await img.decode();

      const canvas = document.createElement( 'canvas' );

      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext( '2d' );

      ctx.drawImage( img, 0, 0 );

      const d = ctx.getImageData( 5, 5, 1, 1 ).data;

      return { prefix: uri.slice( 0, 23 ), corner: [ d[0], d[1], d[2] ] };
    } );

    expect( jpg.prefix ).toBe( 'data:image/jpeg;base64,' );

    // JPEG has no alpha: the default white bg shows at the corner
    for( const channel of jpg.corner ){
      expect( channel ).toBeGreaterThan( 240 );
    }
  } );

  test( 'png() output forms: blob and raw base64', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );
    await waitFrames( page );

    const forms = await page.evaluate( async () => {
      const blob = await window.cy.png( { output: 'blob' } );
      const base64 = await window.cy.png( { output: 'base64' } );

      return {
        isBlob: blob instanceof Blob,
        blobType: blob.type,
        base64Head: base64.slice( 0, 5 ),
        base64Decodes: atob( base64 ).length > 0
      };
    } );

    expect( forms.isBlob ).toBe( true );
    expect( forms.blobType ).toBe( 'image/png' );
    expect( forms.base64Head ).not.toContain( 'data:' );
    expect( forms.base64Decodes ).toBe( true );
  } );

  /*
  Round 30.2: the export path's own guards.  Every export spec above
  hands `png()` options it accepts, so the five throws in
  `computeExportView`/`exportImage` had never run — measured by
  source-mapped coverage of the Node suite, where they are unreachable
  because there is no renderer at all.  They are public contract:
  `bg` and `scale` come straight from the caller, and the other three
  are the states a real app reaches (an empty graph, a hidden
  container, a figure scaled past the device limit).

  Each message is asserted, not just the rejection, because four of the
  five live in one method and a rejection alone would not say which
  guard fired.
  */
  const exportErrors = async ( page, calls ) => {
    return await page.evaluate( async calls => {
      const out = {};

      for( const [ name, opts ] of Object.entries( calls ) ){
        try {
          await window.cy.png( opts );
          out[ name ] = 'resolved';
        } catch ( e ){
          out[ name ] = String( e?.message ?? e );
        }
      }

      return out;
    }, calls );
  };

  test( 'png() rejects on bad options, naming the option at fault', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );
    await waitFrames( page );

    const errors = await exportErrors( page, {
      bg: { bg: 'octarine' },
      scale: { scale: -1 },
      nan: { scale: 'big' },
      huge: { full: true, scale: 100000 },
      ok: {} // control: the same instance still exports
    } );

    expect( errors.bg ).toMatch( /not a valid colour for 'bg'/ );
    expect( errors.scale ).toMatch( /Invalid image export scale -1/ );
    expect( errors.nan ).toMatch( /Invalid image export scale/ );
    expect( errors.huge ).toMatch( /exceeds?.*texture limit/ );
    expect( errors.ok ).toBe( 'resolved' );
  } );

  test( 'png() rejects a full export of an empty graph', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, { elements: [] } );
    await waitFrames( page );

    const errors = await exportErrors( page, {
      empty: { full: true },
      viewport: {} // control: the viewport export of an empty graph is fine
    } );

    expect( errors.empty ).toMatch( /full-graph image of an empty graph/ );
    expect( errors.viewport ).toBe( 'resolved' );
  } );

  test( 'png() rejects a viewport export of a zero-sized container', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );
    await waitFrames( page );

    // a display:none container is the state a tabbed/collapsed UI reaches
    await page.evaluate( () => {
      document.getElementById( 'cytoscape' ).style.display = 'none';
    } );

    const hidden = await exportErrors( page, { viewport: {}, full: { full: true } } );

    expect( hidden.viewport ).toMatch( /zero-sized container/ );

    // the full export measures the graph, not the container, so it is
    // unaffected — which is what makes this guard specific to the
    // viewport branch rather than to exporting at all
    expect( hidden.full ).toBe( 'resolved' );

    await page.evaluate( () => {
      document.getElementById( 'cytoscape' ).style.display = '';
    } );
  } );

  test( 'png() rejects once the renderer is destroyed', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );
    await waitFrames( page );

    const result = await page.evaluate( async () => {
      const before = await window.cy.png();

      window.cy.renderer().destroy(); // the core still holds the renderer

      try {
        await window.cy.png();

        return { before: before.slice( 0, 22 ), after: 'resolved' };
      } catch ( e ){
        return { before: before.slice( 0, 22 ), after: String( e?.message ?? e ) };
      }
    } );

    expect( result.before ).toBe( 'data:image/png;base64,' );
    expect( result.after ).toMatch( /renderer is destroyed/ );
  } );

  /*
  Round 36.4: the rest of the browser-only throw tier.

  `gpu-throw-coverage` classifies 13 sites as needing a device, a canvas
  or a pointer.  Round 30.2 pinned six of them — the export guards above
  — and its record says the browser tier "is pinned in the webgpu
  project instead", which was true of those six and of nothing else.
  These are the four of the remaining seven that any input or environment
  can actually reach.  The other three are internal invariants that
  nothing a caller supplies can trigger, and are classified UNREACHABLE
  in the script with their reasons rather than given specs that would
  have to fake their preconditions.

  Each asserts the *message*, since three of the four are init-path
  failures that would otherwise be indistinguishable from "the renderer
  did not come up".
  */

  test( 'ready rejects when no adapter can be acquired', async ( { page } ) => {
    // This takes the adapter away rather than faking the environment, so it
    // needs an environment to take it away *from*: on a build with no
    // navigator.gpu at all — Linux WebKit, which the renderer-webkit project
    // drives — there is nothing to stub, and the graph is in the other
    // failure state, the one 'hard error when WebGPU is unavailable' covers.
    test.skip( !( await hasGpuApi( page ) ), 'no navigator.gpu to take an adapter away from' );

    // the README's own headline for the headless/rendered boundary, and
    // the state a blocklisted or software-less machine is really in — no
    // stub can produce it on a box that has an adapter, so the adapter is
    // taken away rather than the environment faked
    const message = await page.evaluate( async () => {
      const real = navigator.gpu.requestAdapter.bind( navigator.gpu );

      navigator.gpu.requestAdapter = async () => null;

      try {
        const cy = window.makeCy( {} );

        await cy.ready;

        return 'resolved';
      } catch ( e ){
        return String( e?.message ?? e );
      } finally {
        navigator.gpu.requestAdapter = real;
      }
    } );

    expect( message ).toMatch( /no adapter could be acquired/ );
  } );

  test( 'ready rejects when the canvas gives no webgpu context', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // the guard past the adapter: a device is acquired and the *canvas*
    // then refuses.  Only 'webgpu' is refused — the glyph atlas and the
    // export path both want '2d', and blanking those would move the
    // failure somewhere else and still read as a pass
    const message = await page.evaluate( async () => {
      const real = HTMLCanvasElement.prototype.getContext;

      HTMLCanvasElement.prototype.getContext = function( type, ...rest ){
        return type === 'webgpu' ? null : real.call( this, type, ...rest );
      };

      try {
        const cy = window.makeCy( {} );

        await cy.ready;

        return 'resolved';
      } catch ( e ){
        return String( e?.message ?? e );
      } finally {
        HTMLCanvasElement.prototype.getContext = real;
      }
    } );

    expect( message ).toMatch( /webgpu canvas context/ );
  } );

  test( 'ready rejects when glyph rasterization has no 2d context', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // the label pipeline's atlas rasters glyphs through a 2d canvas and
    // is built during renderer init, so this surfaces on ready() rather
    // than on the first label — which is the fact the spec pins, since a
    // lazy atlas would fail inside the frame loop with nowhere to report
    const message = await page.evaluate( async () => {
      const real = HTMLCanvasElement.prototype.getContext;

      HTMLCanvasElement.prototype.getContext = function( type, ...rest ){
        return type === '2d' ? null : real.call( this, type, ...rest );
      };

      try {
        const cy = window.makeCy( {} );

        await cy.ready;

        return 'resolved';
      } catch ( e ){
        return String( e?.message ?? e );
      } finally {
        HTMLCanvasElement.prototype.getContext = real;
      }
    } );

    expect( message ).toMatch( /2d canvas context for glyph rasterization/ );
  } );

  test( 'a background image that 404s warns once and renders imageless', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // the decoder's HTTP guard is the one throw of the four a *caller*
    // reaches, with nothing but a wrong url.  The registry catches it, so
    // what the contract promises is the warning and the graph carrying on
    // — which is why the node's own pixels are the control here
    const result = await page.evaluate( async () => {
      const warnings = [];
      const realWarn = console.warn;

      // both arguments: the registry passes the decoder's own error as the
      // second, which is where `HTTP 404` appears — asserting it is what
      // pins *this* guard rather than "an image failed somehow"
      console.warn = ( ...args ) => { warnings.push( args.map( String ).join( ' ' ) ); };

      try {
        const cy = window.makeCy( {
          elements: [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ],
          style: {
            nodes: {
              'width': 80, 'height': 80,
              'background-color': '#e74c3c',
              'background-image': '/playwright-page/no-such-image-36-4.png'
            }
          }
        } );

        await cy.ready;

        cy.pan( { x: window.innerWidth / 2, y: window.innerHeight / 2 } );

        // the decode is async and off the frame path; wait for the warn
        for( let i = 0; i < 200 && warnings.length === 0; i++ ){
          await new Promise( r => setTimeout( r, 25 ) );
        }

        // a second style pass over the same failed url must not re-warn
        cy.style( {
          nodes: {
            'width': 80, 'height': 80,
            'background-color': '#e74c3c',
            'background-image': '/playwright-page/no-such-image-36-4.png'
          }
        } );

        await new Promise( r => setTimeout( r, 300 ) );

        return { warnings, alive: cy.nodes().length };
      } finally {
        console.warn = realWarn;
      }
    } );

    const failures = result.warnings.filter( w => /failed to load/.test( w ) );

    expect( result.alive ).toBe( 1 );
    expect( failures ).toHaveLength( 1 );
    expect( failures[ 0 ] ).toMatch( /HTTP 404/ );

    // the node still draws: the failure is confined to the image
    const [ r, g ] = await pixelAt( page, 400, 300 );

    expect( r ).toBeGreaterThan( 150 );
    expect( g ).toBeLessThan( 120 );
  } );

  test( 'export WYSIWYG: a viewport export at scale 1 pixel-matches the screen', async ( { page }, testInfo ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // nodes + edge + arrow + label: every pipeline contributes pixels
    await makeReadyCy( page, {
      elements: [
        { data: { id: 'left lbl' }, position: { x: -120, y: 0 } },
        { data: { id: 'right lbl' }, position: { x: 120, y: 40 } },
        { data: { id: 'e', source: 'left lbl', target: 'right lbl' } }
      ],
      style: {
        nodes: {
          'width': 60, 'height': 60, 'shape': 'round-rectangle',
          'background-color': '#c0392b', 'border-width': 4, 'border-color': '#2c3e50',
          'label': { data: 'id' }, 'font-size': 14, 'color': '#222'
        },
        edges: { 'width': 3, 'line-color': '#7f8c8d', 'target-arrow-shape': 'triangle' }
      },
      zoom: 1
    } );
    await centerPan( page );
    await waitFrames( page );

    // the export and the screen render from the same uniforms at dpr 1 /
    // scale 1, so the pixels must agree — this pins the export path to the
    // screen path (and vice versa) with no golden needed
    const uri = await page.evaluate( () => window.cy.png( { bg: '#ffffff' } ) );
    const clip = await page.evaluate( () => {
      const rect = document.getElementById( 'cytoscape' ).getBoundingClientRect();

      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    } );
    const actual = decodePng( uri );
    const expected = decodePng( await page.screenshot( { clip } ) );
    const { ratio, diff } = diffPngs( actual, expected, { threshold: 0.1 } );

    if( ratio > 0.001 ){
      writeDiffArtifacts( testInfo.outputPath( '' ), 'wysiwyg', actual, expected, diff );
    }

    expect( ratio ).toBeLessThanOrEqual( 0.001 );

    // second phase (round 15.6): the same pin with background images in
    // the scene — the export path shares the image pass and, at scale 1,
    // promotion no-ops, so the pixels must still agree exactly
    await page.evaluate( () => {
      const quad = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAASUlEQVR4AaXBQQ2DQAAAwWVTPSVBBg5QUDkVwQs5/BGBA3Bwn52ZrmV+GDh+JyMSSSSRRBJJJNFn3XZG/veXEYkkkkgiiSSS6AV8gQcyZv0HPAAAAABJRU5ErkJggg==';

      window.cy.style( {
        nodes: {
          'width': 60, 'height': 60, 'shape': 'round-rectangle',
          'background-color': '#c0392b', 'border-width': 4, 'border-color': '#2c3e50',
          'background-image': quad, 'background-fit': 'contain',
          'label': { data: 'id' }, 'font-size': 14, 'color': '#222'
        },
        edges: { 'width': 3, 'line-color': '#7f8c8d', 'target-arrow-shape': 'triangle' }
      } );
    } );
    await page.waitForFunction( () => window.cy._store.images.pendingCount() === 0 );
    await waitFrames( page, 4 );

    const uri2 = await page.evaluate( () => window.cy.png( { bg: '#ffffff' } ) );
    const actual2 = decodePng( uri2 );
    const expected2 = decodePng( await page.screenshot( { clip } ) );
    const imaged = diffPngs( actual2, expected2, { threshold: 0.1 } );

    if( imaged.ratio > 0.001 ){
      writeDiffArtifacts( testInfo.outputPath( '' ), 'wysiwyg-imaged', actual2, expected2, imaged.diff );
    }

    expect( imaged.ratio, 'imaged WYSIWYG self-diff' ).toBeLessThanOrEqual( 0.001 );
  } );

  test( 'the shaping memo shares laid blocks across same-text labels (round 16.5)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: Array.from( { length: 120 }, ( _, i ) => ( {
        data: { id: 'n' + i }, position: { x: ( i % 12 ) * 40, y: Math.floor( i / 12 ) * 40 }
      } ) ),
      style: { nodes: {
        'width': 20, 'height': 20,
        'label': 'shared label', 'font-size': 12,
        'text-wrap': 'wrap', 'text-max-width': 50
      } },
      zoom: 1
    } );
    await waitFrames( page );

    const stats = await page.evaluate( () => window.cy.renderer().stats() );

    // 120 identical (text, wrap params) labels shape once
    expect( stats.labelShapeMisses ).toBeLessThanOrEqual( 3 );
    expect( stats.labelShapeHits ).toBeGreaterThanOrEqual( 117 );
  } );

  test( 'font-family change re-rasters the atlas and re-lays-out labels live', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ],
      style: { nodes: {
        'width': 40, 'height': 40, 'background-color': '#ddd',
        'label': 'Wide Label', 'font-size': 20, 'color': '#000'
      } },
      zoom: 1
    } );
    await centerPan( page );
    await waitFrames( page );

    const shot = async () => decodePng( await page.evaluate( () => window.cy.png( { bg: '#fff' } ) ) );
    const darkCount = png => {
      let n = 0;

      for( let i = 0; i < png.data.length; i += 4 ){
        if( png.data[ i ] < 100 && png.data[ i + 1 ] < 100 && png.data[ i + 2 ] < 100 ){ n++; }
      }

      return n;
    };

    const before = await shot();

    await page.evaluate( async () => {
      await new Promise( resolve => {
        window.cy.one( 'render', () => resolve() );
        window.cy.style( { nodes: {
          'width': 40, 'height': 40, 'background-color': '#ddd',
          'label': 'Wide Label', 'font-size': 20, 'color': '#000',
          'font-family': 'monospace'
        } } );
      } );
    } );
    await waitFrames( page );

    const after = await shot();

    // the label survives the swap...
    expect( darkCount( before ) ).toBeGreaterThan( 100 );
    expect( darkCount( after ) ).toBeGreaterThan( 100 );

    // ...and its pixels changed (sans-serif vs monospace glyphs), which
    // proves the atlas reset + full re-layout happened live — the only
    // styled difference between the two renders is the font
    const { ratio } = diffPngs( after, before, { threshold: 0.1 } );

    expect( ratio ).toBeGreaterThan( 0.0005 );
  } );

  test( 'glyphs re-raster when a web font finishes loading after label build', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // 'Late Font' is not registered yet, so glyphs raster from the
    // sans-serif fallback and are cached in the atlas (an @font-face
    // family would already start loading from the atlas's own canvas use)
    await makeReadyCy( page, {
      elements: [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ],
      style: { nodes: {
        'width': 40, 'height': 40, 'background-color': '#ddd',
        'label': 'Wide Label', 'font-size': 20, 'color': '#000',
        'font-family': `'Late Font', sans-serif`
      } },
      zoom: 1
    } );
    await centerPan( page );
    await waitFrames( page );

    const shot = async () => decodePng( await page.evaluate( () => window.cy.png( { bg: '#fff' } ) ) );
    const before = await shot();

    // registering + loading the face fires document.fonts 'loadingdone',
    // which the renderer hooks to reset the atlas and rebuild every glyph run
    await page.evaluate( async () => {
      const face = new FontFace( 'Late Font',
        `url('../node_modules/@fontsource/open-sans/files/open-sans-latin-400-normal.woff2') format('woff2')` );

      document.fonts.add( face );

      const rendered = new Promise( resolve => window.cy.one( 'render', resolve ) );

      // a set-initiated load, so the FontFaceSet fires 'loadingdone'
      await document.fonts.load( `32px 'Late Font'` );

      if( !document.fonts.check( `32px 'Late Font'` ) ){
        throw new Error( 'Late Font did not load' );
      }

      await rendered; // the hook re-rastered and redrew
    } );
    await waitFrames( page );
    await waitFrames( page );

    const after = await shot();

    // label pixels exist in both renders, and they changed (fallback face
    // vs Open Sans) — the re-raster happened without any style write
    const darkCount = png => {
      let n = 0;

      for( let i = 0; i < png.data.length; i += 4 ){
        if( png.data[ i ] < 100 && png.data[ i + 1 ] < 100 && png.data[ i + 2 ] < 100 ){ n++; }
      }

      return n;
    };

    expect( darkCount( before ) ).toBeGreaterThan( 100 );
    expect( darkCount( after ) ).toBeGreaterThan( 100 );

    const { ratio } = diffPngs( after, before, { threshold: 0.1 } );

    expect( ratio ).toBeGreaterThan( 0.0005 );
  } );

  test( 'edge labels render at the midpoint and follow endpoint moves on-GPU', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -100, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 10, 'height': 10, 'background-color': '#eee' },
        edges: { 'width': 1, 'line-color': '#eee', 'label': 'MIDPOINT', 'font-size': 24, 'color': '#000' }
      },
      zoom: 1
    } );
    await centerPan( page );
    await waitFrames( page );

    const darkRows = png => {
      // dark-pixel count in the top and bottom halves
      let top = 0, bottom = 0;

      for( let y = 0; y < png.height; y++ ){
        for( let x = 0; x < png.width; x++ ){
          const i = ( y * png.width + x ) * 4;

          if( png.data[ i ] < 100 && png.data[ i + 1 ] < 100 && png.data[ i + 2 ] < 100 ){
            if( y < png.height / 2 ){ top++; } else { bottom++; }
          }
        }
      }

      return { top, bottom };
    };

    const shot = async () => decodePng( await page.evaluate( () => window.cy.png( { bg: '#fff' } ) ) );
    const before = darkRows( await shot() );

    // the label sits at the midpoint, i.e. the vertical center
    expect( before.top + before.bottom ).toBeGreaterThan( 100 );

    // move one endpoint down: the midpoint (and so the label) moves into
    // the bottom half — a position write only, no label rebuild
    const uploadedBefore = await page.evaluate( () => window.cy.renderer().stats().uploadedBytes );

    await page.evaluate( () => window.cy.$id( 'b' ).position( { x: 100, y: 260 } ) );
    await waitFrames( page );

    const after = darkRows( await shot() );
    const uploadedAfter = await page.evaluate( () => window.cy.renderer().stats().uploadedBytes );

    expect( after.bottom ).toBeGreaterThan( before.bottom + 50 );
    expect( uploadedAfter - uploadedBefore ).toBeLessThanOrEqual( 64 ); // one position row, no glyph re-upload
  } );

  test( 'edge label autorotate rotates the run and follows the angle on-GPU', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // a vertical edge: horizontal labels read wide-and-short, autorotated
    // ones tall-and-narrow (the flip rule reads verticals at +90°)
    const sheet = rotation => ( {
      nodes: { 'width': 10, 'height': 10, 'background-color': '#eee' },
      edges: {
        'width': 1, 'line-color': '#eee',
        'label': 'ROTATED TEXT', 'font-size': 24, 'color': '#000',
        'text-rotation': rotation
      }
    } );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: -120 } },
        { data: { id: 'b' }, position: { x: 0, y: 120 } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ],
      style: sheet( 'none' ),
      zoom: 1
    } );
    await centerPan( page );
    await waitFrames( page );

    const darkBox = png => {
      // bounding box of dark (label) pixels
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, n = 0;

      for( let y = 0; y < png.height; y++ ){
        for( let x = 0; x < png.width; x++ ){
          const i = ( y * png.width + x ) * 4;

          if( png.data[ i ] < 100 && png.data[ i + 1 ] < 100 && png.data[ i + 2 ] < 100 ){
            minX = Math.min( minX, x );
            minY = Math.min( minY, y );
            maxX = Math.max( maxX, x );
            maxY = Math.max( maxY, y );
            n++;
          }
        }
      }

      return { w: maxX - minX, h: maxY - minY, n };
    };

    const shot = async () => decodePng( await page.evaluate( () => window.cy.png( { bg: '#fff' } ) ) );
    const horizontal = darkBox( await shot() );

    expect( horizontal.n ).toBeGreaterThan( 100 );
    expect( horizontal.w ).toBeGreaterThan( horizontal.h * 2 );

    await page.evaluate( sheet => window.cy.style( sheet ), sheet( 'autorotate' ) );
    await waitFrames( page );

    const vertical = darkBox( await shot() );

    expect( vertical.n ).toBeGreaterThan( 100 );
    expect( vertical.h ).toBeGreaterThan( vertical.w * 2 );

    // the rotation angle reads live positions: making the edge horizontal
    // re-rotates the label with a position-row upload only, no glyph rebuild
    const uploadedBefore = await page.evaluate( () => window.cy.renderer().stats().uploadedBytes );

    await page.evaluate( () => window.cy.$id( 'b' ).position( { x: 240, y: -120 } ) );
    await waitFrames( page );

    const rotatedBack = darkBox( await shot() );
    const uploadedAfter = await page.evaluate( () => window.cy.renderer().stats().uploadedBytes );

    expect( rotatedBack.n ).toBeGreaterThan( 100 );
    expect( rotatedBack.w ).toBeGreaterThan( rotatedBack.h * 2 );
    expect( uploadedAfter - uploadedBefore ).toBeLessThanOrEqual( 64 );
  } );

  test( 'png() export mid-animation snapshots the GPU-owned position', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'a' }, position: { x: -200, y: 0 } } ],
      style: { nodes: { 'background-color': 'red', 'width': 120, 'height': 60, 'shape': 'rectangle' } },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // a slow linear tween: at export time the node is somewhere between the
    // endpoints — the export must show it there (the lease's stale CPU
    // position would put it at the start)
    await page.evaluate( () => window.cy.$id( 'a' ).animate( {
      position: { x: 200, y: 0 }, duration: 4000, easing: 'linear'
    } ) );
    // not at the start any more, and covering the midpoint: the 120px body
    // over a 400px trip gives a window of t ∈ (0.35, 0.65), which the settled
    // node at +200 does not satisfy — so this cannot pass at rest
    await untilMidFlight( page,
      async () => ( await pngAndSample(
        page, {}, [ [ center.x - 200, center.y ], [ center.x, center.y ] ]
      ) ).pixels,
      px => px[ 0 ][ 3 ] === 0 && px[ 1 ][ 0 ] > 200,
      { timeout: 8000, what: 'the export showing the node off the start and over the midpoint' } );

    await page.evaluate( () => window.cy.$id( 'a' ).stop( true, true ) );
  } );

  test( 'bezier bundle: curves render off the chord and follow a drag on-GPU', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: 0 } },
        { data: { id: 'b' }, position: { x: 150, y: 0 } },
        { data: { id: 'e0', source: 'a', target: 'b' } },
        { data: { id: 'e1', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30, 'background-color': '#2c3e50' },
        edges: {
          'curve-style': 'bezier', 'control-point-step-size': 80,
          'width': 6, 'line-color': '#e74c3c'
        }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // the chord between the two fanned curves is background...
    const chordPixel = await pixelAt( page, center.x, center.y );

    expect( chordPixel[ 1 ] ).toBeGreaterThan( 180 );

    // ...and the pixels at each curve's CPU-computed midpoint are line
    // color — the dual-implementation guarantee (CPU twin == pixels)
    const mids = await page.evaluate( () => [
      window.cy.$id( 'e0' ).renderedMidpoint(),
      window.cy.$id( 'e1' ).renderedMidpoint()
    ] );

    for( const mid of mids ){
      const px = await pixelAt( page, mid.x, mid.y );

      expect( px[ 0 ] ).toBeGreaterThan( 180 );
      expect( px[ 1 ] ).toBeLessThan( 140 );
    }

    // a node drag re-shapes the curves with a position-row upload only —
    // the zero-rebuild property (params are position-independent)
    const uploadedBefore = await page.evaluate( () => window.cy.renderer().stats().uploadedBytes );

    await page.evaluate( () => window.cy.$id( 'b' ).position( { x: 150, y: 120 } ) );
    await waitFrames( page );

    const uploadedAfter = await page.evaluate( () => window.cy.renderer().stats().uploadedBytes );

    expect( uploadedAfter - uploadedBefore ).toBeLessThanOrEqual( 64 );

    const movedMid = await page.evaluate( () => window.cy.$id( 'e0' ).renderedMidpoint() );
    const movedPx = await pixelAt( page, movedMid.x, movedMid.y );

    expect( movedPx[ 0 ] ).toBeGreaterThan( 180 );
    expect( movedPx[ 1 ] ).toBeLessThan( 140 );
  } );

  test( 'pick() hits a curved edge on its bulge, background on the chord', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: 0 } },
        { data: { id: 'b' }, position: { x: 150, y: 0 } },
        { data: { id: 'e0', source: 'a', target: 'b' } },
        { data: { id: 'e1', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30 },
        edges: { 'curve-style': 'bezier', 'control-point-step-size': 80, 'width': 6 }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    const picks = await page.evaluate( async center => {
      const mid = window.cy.$id( 'e0' ).renderedMidpoint();
      const onCurve = await window.cy.pick( mid.x, mid.y );
      const onChord = await window.cy.pick( center.x, center.y );

      return {
        onCurve: onCurve == null ? null : onCurve.id(),
        onChord: onChord == null ? null : onChord.id()
      };
    }, center );

    // the GPU pick tile draws the same segment strips the render does
    expect( picks.onCurve ).toBe( 'e0' );
    expect( picks.onChord ).toBe( null );
  } );

  test( 'curved-edge labels anchor at the curve midpoint and follow drags', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: 0 } },
        { data: { id: 'b' }, position: { x: 150, y: 0 } },
        { data: { id: 'e0', source: 'a', target: 'b', lbl: 'curved' } },
        { data: { id: 'e1', source: 'a', target: 'b', lbl: 'label' } }
      ],
      style: {
        nodes: { 'width': 24, 'height': 24, 'background-color': '#dfe6e9' },
        edges: {
          'curve-style': 'bezier', 'control-point-step-size': 100,
          'width': 2, 'line-color': '#dfe6e9', // light, so only glyphs read dark
          'label': { data: 'lbl' }, 'font-size': 16, 'color': '#000000'
        }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // glyphs at each curve's CPU-computed midpoint, none at the chord's
    const mid = await page.evaluate( () => window.cy.$id( 'e0' ).renderedMidpoint() );

    expect( await darkPixelsInBand( page, mid.x - 40, 80, mid.y ) ).toBeGreaterThan( 5 );
    expect( await darkPixelsInBand( page, center.x - 40, 80, center.y ) ).toBe( 0 );

    // a node drag re-anchors the label with a position-row upload only
    const uploadedBefore = await page.evaluate( () => window.cy.renderer().stats().uploadedBytes );

    await page.evaluate( () => window.cy.$id( 'b' ).position( { x: 150, y: 140 } ) );
    await waitFrames( page );

    const uploadedAfter = await page.evaluate( () => window.cy.renderer().stats().uploadedBytes );
    const movedMid = await page.evaluate( () => window.cy.$id( 'e0' ).renderedMidpoint() );

    expect( uploadedAfter - uploadedBefore ).toBeLessThanOrEqual( 64 );
    expect( await darkPixelsInBand( page, movedMid.x - 40, 80, movedMid.y ) ).toBeGreaterThan( 5 );
  } );

  test( 'self-loops render as loops (not degenerate points)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'loop', source: 'a', target: 'a' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30, 'background-color': '#2c3e50' },
        edges: { 'width': 6, 'line-color': '#e74c3c' }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // the default -45deg loop extends to the upper left: the curve
    // passes through its CPU-computed midpoint (-28, -28)
    const mid = await page.evaluate( () => window.cy.$id( 'loop' ).renderedMidpoint() );
    const loopPx = await pixelAt( page, mid.x, mid.y );

    expect( loopPx[ 0 ] ).toBeGreaterThan( 180 );
    expect( loopPx[ 1 ] ).toBeLessThan( 140 );

    // and the mirror region (lower right) stays background
    const mirrorPx = await pixelAt( page, 2 * center.x - mid.x, 2 * center.y - mid.y );

    expect( mirrorPx[ 1 ] ).toBeGreaterThan( 180 );
  } );

  test( 'segments edges render the polyline and follow drags on-GPU (12b)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: 0 } },
        { data: { id: 'b' }, position: { x: 150, y: 0 } },
        { data: { id: 'e0', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30, 'background-color': '#2c3e50' },
        edges: {
          'curve-style': 'segments', 'segment-distances': 60,
          'width': 6, 'line-color': '#e74c3c'
        }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // the chord midpoint is background (the polyline detours through the
    // segment point)...
    const chordPx = await pixelAt( page, center.x, center.y );

    expect( chordPx[ 1 ] ).toBeGreaterThan( 180 );

    // ...and the CPU-computed segment point is line color — the
    // dual-implementation guarantee for the route evaluator
    const mid = await page.evaluate( () => window.cy.$id( 'e0' ).renderedMidpoint() );
    const midPx = await pixelAt( page, mid.x, mid.y );

    expect( midPx[ 0 ] ).toBeGreaterThan( 180 );
    expect( midPx[ 1 ] ).toBeLessThan( 140 );

    // a node drag re-routes with a position-row upload only (the blob
    // record is position-independent)
    const uploadedBefore = await page.evaluate( () => window.cy.renderer().stats().uploadedBytes );

    await page.evaluate( () => window.cy.$id( 'b' ).position( { x: 150, y: 140 } ) );
    await waitFrames( page );

    const uploadedAfter = await page.evaluate( () => window.cy.renderer().stats().uploadedBytes );

    expect( uploadedAfter - uploadedBefore ).toBeLessThanOrEqual( 64 );

    const movedMid = await page.evaluate( () => window.cy.$id( 'e0' ).renderedMidpoint() );
    const movedPx = await pixelAt( page, movedMid.x, movedMid.y );

    expect( movedPx[ 0 ] ).toBeGreaterThan( 180 );
    expect( movedPx[ 1 ] ).toBeLessThan( 140 );
  } );

  test( 'taxi edges route axis-aligned and pick on their legs (12b)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: -100 } },
        { data: { id: 'b' }, position: { x: 150, y: 100 } },
        { data: { id: 'e0', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30, 'background-color': '#2c3e50' },
        edges: { 'curve-style': 'taxi', 'width': 6, 'line-color': '#e74c3c' }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // the CPU-computed turn points carry line color...
    const segpts = await page.evaluate( () => window.cy.$id( 'e0' ).renderedSegmentPoints() );

    expect( segpts.length ).toBe( 2 );

    for( const pt of segpts ){
      const px = await pixelAt( page, pt.x, pt.y );

      expect( px[ 0 ] ).toBeGreaterThan( 180 );
      expect( px[ 1 ] ).toBeLessThan( 140 );
    }

    // ...the diagonal chord's quarter point is background (axis-aligned
    // routing never goes there)...
    const offRoutePx = await pixelAt( page, center.x - 75, center.y - 20 );

    expect( offRoutePx[ 1 ] ).toBeGreaterThan( 180 );

    // ...and picking agrees with pixels: a leg hits, the diagonal misses
    const picks = await page.evaluate( async center => {
      const mid = window.cy.$id( 'e0' ).renderedMidpoint();
      const onLeg = await window.cy.pick( mid.x, mid.y );
      const offRoute = await window.cy.pick( center.x - 75, center.y - 20 );

      return {
        onLeg: onLeg == null ? null : onLeg.id(),
        offRoute: offRoute == null ? null : offRoute.id()
      };
    }, center );

    expect( picks.onLeg ).toBe( 'e0' );
    expect( picks.offRoute ).toBe( null );
  } );

  test( 'round-segments corners are rounded to the arc (12b)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    const scene = round => ( {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: 0 } },
        { data: { id: 'b' }, position: { x: 150, y: 0 } },
        { data: { id: 'e0', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30, 'background-color': '#2c3e50' },
        edges: {
          // a sharp corner + big radius so the arc cuts ~9px inside the
          // corner point — beyond the stroke half-width
          'curve-style': round ? 'round-segments' : 'segments',
          'segment-distances': 120, 'segment-radii': 30,
          'width': 4, 'line-color': '#e74c3c'
        }
      },
      zoom: 1
    } );

    // sharp: the corner point itself carries line color
    await makeReadyCy( page, scene( false ) );
    await centerPan( page );
    await waitFrames( page );

    const cornerPt = await page.evaluate( () => window.cy.$id( 'e0' ).renderedSegmentPoints()[ 0 ] );
    const sharpPx = await pixelAt( page, cornerPt.x, cornerPt.y );

    expect( sharpPx[ 0 ] ).toBeGreaterThan( 180 );

    // round: the arc cuts ~9px inside the corner, so the sharp corner
    // point reads background — while the CPU midpoint (the arc apex)
    // carries line color.  (Tear the first instance down: makeCy stacks
    // a fresh canvas over the container otherwise.)
    await page.evaluate( () => window.cy.destroy() );
    await makeReadyCy( page, scene( true ) );
    await centerPan( page );
    await waitFrames( page );

    const roundCornerPx = await pixelAt( page, cornerPt.x, cornerPt.y );

    expect( roundCornerPx[ 1 ] ).toBeGreaterThan( 180 );

    const apex = await page.evaluate( () => window.cy.$id( 'e0' ).renderedMidpoint() );
    const apexPx = await pixelAt( page, apex.x, apex.y );

    expect( apexPx[ 0 ] ).toBeGreaterThan( 180 );
    expect( apexPx[ 1 ] ).toBeLessThan( 140 );
  } );

  test( 'unbundled bezier splines through its control points (12b)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: 0 } },
        { data: { id: 'b' }, position: { x: 150, y: 0 } },
        { data: { id: 'e0', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30, 'background-color': '#2c3e50' },
        edges: {
          'curve-style': 'unbundled-bezier',
          'control-point-distances': [ 70, -70 ],
          'control-point-weights': [ 0.25, 0.75 ],
          'width': 6, 'line-color': '#e74c3c'
        }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // the S-curve passes through the inserted midpoint between the two
    // controls — which is the chord midpoint here (even-count rule)
    const mid = await page.evaluate( () => window.cy.$id( 'e0' ).renderedMidpoint() );
    const midPx = await pixelAt( page, mid.x, mid.y );

    expect( midPx[ 0 ] ).toBeGreaterThan( 180 );
    expect( midPx[ 1 ] ).toBeLessThan( 140 );

    // scan the vertical line through the source-side half: the S bulges
    // toward the first control (+y in model space, below the chord on
    // screen) and stays clear of the mirrored band above it
    const scan = await page.evaluate( async xy => {
      const uri = await window.cy.png();
      const img = new Image();

      img.src = uri;
      await img.decode();

      const canvas = document.createElement( 'canvas' );

      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext( '2d' );

      ctx.drawImage( img, 0, 0 );

      const ink = ( x, y0, y1 ) => {
        let count = 0;

        for( let y = y0; y <= y1; y++ ){
          const d = ctx.getImageData( Math.round( x ), Math.round( y ), 1, 1 ).data;

          if( d[ 3 ] > 0 ){ count++; }
        }

        return count;
      };

      return {
        below: ink( xy.x, xy.y + 8, xy.y + 60 ),
        above: ink( xy.x, xy.y - 60, xy.y - 8 )
      };
    }, { x: center.x - 75, y: center.y } );

    expect( scan.below ).toBeGreaterThan( 2 );
    expect( scan.above ).toBe( 0 );
  } );

  test( 'taxi arrows ride the final leg into the node (12b)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: -100 } },
        { data: { id: 'b' }, position: { x: 150, y: 100 } },
        { data: { id: 'e0', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30, 'background-color': '#2c3e50' },
        edges: {
          'curve-style': 'taxi', 'width': 4, 'line-color': '#e74c3c',
          'target-arrow-shape': 'triangle', 'target-arrow-color': '#8e44ad'
        }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // auto direction is horizontal here (dx > dy): the final leg runs in
    // +x into the target, so the arrow sits just outside the target's
    // boundary on that leg — purple, not line red
    const arrowPx = await pixelAt( page, center.x + 150 - 15 - 8, center.y + 100 );

    expect( arrowPx[ 2 ] ).toBeGreaterThan( 120 ); // blue channel: #8e44ad
    expect( arrowPx[ 0 ] ).toBeLessThan( 200 );

    // the chord's diagonal near the target stays background — the arrow
    // did not point along the chord
    const chordPx = await pixelAt( page, center.x + 150 - 40, center.y + 100 - 27 );

    expect( chordPx[ 1 ] ).toBeGreaterThan( 180 );
  } );

  test( 'route labels anchor at the route midpoint and follow drags (12b)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: 0 } },
        { data: { id: 'b' }, position: { x: 150, y: 0 } },
        { data: { id: 'e0', source: 'a', target: 'b', lbl: 'seg' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30, 'background-color': '#ecf0f1' },
        edges: {
          'curve-style': 'segments', 'segment-distances': 60,
          'width': 4, 'line-color': '#e74c3c',
          'label': { data: 'lbl' }, 'font-size': 16, 'color': '#000'
        }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // text ink sits at the CPU route midpoint (the segment point), not
    // the chord midpoint
    const mid = await page.evaluate( () => window.cy.$id( 'e0' ).renderedMidpoint() );

    expect( await darkPixelsInBand( page, mid.x - 40, 80, mid.y ) ).toBeGreaterThan( 3 );
    expect( await darkPixelsInBand( page, center.x - 40, 80, center.y - 20 ) ).toBe( 0 );

    // a node drag re-anchors the label on-GPU (position rows only)
    const uploadedBefore = await page.evaluate( () => window.cy.renderer().stats().uploadedBytes );

    await page.evaluate( () => window.cy.$id( 'b' ).position( { x: 150, y: 120 } ) );
    await waitFrames( page );

    const uploadedAfter = await page.evaluate( () => window.cy.renderer().stats().uploadedBytes );
    const movedMid = await page.evaluate( () => window.cy.$id( 'e0' ).renderedMidpoint() );

    expect( uploadedAfter - uploadedBefore ).toBeLessThanOrEqual( 64 );
    expect( await darkPixelsInBand( page, movedMid.x - 40, 80, movedMid.y ) ).toBeGreaterThan( 3 );
  } );

  test( 'haystack edges draw between their offset points and stay pickable (12c)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: 0 } },
        { data: { id: 'b' }, position: { x: 150, y: 0 } },
        { data: { id: 'e0', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 60, 'height': 60, 'background-color': '#ecf0f1' },
        edges: { 'curve-style': 'haystack', 'haystack-radius': 1, 'width': 6, 'line-color': '#e74c3c' }
      },
      zoom: 1
    } );

    await centerPan( page );
    await waitFrames( page );

    // the CPU-computed haystack midpoint carries line color (the offset
    // line, not necessarily the center chord)...
    const mid = await page.evaluate( () => window.cy.$id( 'e0' ).renderedMidpoint() );
    const midPx = await pixelAt( page, mid.x, mid.y );

    expect( midPx[ 0 ] ).toBeGreaterThan( 180 );
    expect( midPx[ 1 ] ).toBeLessThan( 140 );

    // ...picking agrees with the drawn line...
    const picked = await page.evaluate( async mid => {
      const hit = await window.cy.pick( mid.x, mid.y );

      return hit == null ? null : hit.id();
    }, mid );

    expect( picked ).toBe( 'e0' );

    // ...and the endpoints sit inside the node bodies (radius 1 = at
    // most the outer half from each center)
    const ends = await page.evaluate( () => {
      const e = window.cy.$id( 'e0' );
      const s = e.sourceEndpoint();
      const t = e.targetEndpoint();

      return {
        sOff: Math.hypot( s.x - ( -150 ), s.y ),
        tOff: Math.hypot( t.x - 150, t.y )
      };
    } );

    expect( ends.sOff ).toBeLessThanOrEqual( 30.5 );
    expect( ends.tOff ).toBeLessThanOrEqual( 30.5 );
  } );

  test( 'straight-triangle edges taper from a wide base to the target apex (12c)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: 0 } },
        { data: { id: 'b' }, position: { x: 150, y: 0 } },
        { data: { id: 'e0', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30, 'background-color': '#2c3e50' },
        edges: { 'curve-style': 'straight-triangle', 'width': 24, 'line-color': '#e74c3c' }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // thickness near the source base far exceeds thickness near the apex
    const thickness = async x => {
      let count = 0;

      for( let dy = -20; dy <= 20; dy += 2 ){
        const px = await pixelAt( page, x, center.y + dy );

        if( px[ 0 ] > 180 && px[ 1 ] < 140 ){ count++; }
      }

      return count;
    };

    const nearBase = await thickness( center.x - 100 );
    const nearApex = await thickness( center.x + 110 );

    expect( nearBase ).toBeGreaterThan( 4 );
    expect( nearApex ).toBeLessThan( nearBase );
    expect( nearApex ).toBeGreaterThan( 0 ); // still inked, just thin

    // picking matches the taper: near the base edge of the triangle a
    // lateral offset hits; the same offset near the apex misses
    const picks = await page.evaluate( async center => {
      const wide = await window.cy.pick( center.x - 100, center.y + 8 );
      const narrow = await window.cy.pick( center.x + 110, center.y + 8 );

      return {
        wide: wide == null ? null : wide.id(),
        narrow: narrow == null ? null : narrow.id()
      };
    }, center );

    expect( picks.wide ).toBe( 'e0' );
    expect( picks.narrow ).toBe( null );
  } );

  test( 'manual endpoints move the drawn edge and follow drags on-GPU (12c)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: 0 } },
        { data: { id: 'b' }, position: { x: 150, y: 0 } },
        { data: { id: 'e0', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30, 'background-color': '#2c3e50' },
        // launch the edge 60 px below the source center: the line runs
        // visibly off the center chord
        edges: { 'source-endpoint': '0 60', 'width': 6, 'line-color': '#e74c3c' }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // ink at the CPU-resolved source endpoint (the manual point)...
    const src = await page.evaluate( () => window.cy.$id( 'e0' ).renderedSourceEndpoint() );

    expect( Math.abs( src.x - ( center.x - 150 ) ) ).toBeLessThan( 1 );
    expect( Math.abs( src.y - ( center.y + 60 ) ) ).toBeLessThan( 1 );

    const srcPx = await pixelAt( page, src.x, src.y + 1 );

    expect( srcPx[ 0 ] ).toBeGreaterThan( 180 );
    expect( srcPx[ 1 ] ).toBeLessThan( 140 );

    // ...no ink on the center chord near the source (the edge left it)
    const chordPx = await pixelAt( page, center.x - 120, center.y );

    expect( chordPx[ 1 ] ).toBeGreaterThan( 180 );

    // dragging the source re-anchors the manual endpoint on-GPU with a
    // position-row upload only
    const uploadedBefore = await page.evaluate( () => window.cy.renderer().stats().uploadedBytes );

    await page.evaluate( () => window.cy.$id( 'a' ).position( { x: -150, y: -80 } ) );
    await waitFrames( page );

    const uploadedAfter = await page.evaluate( () => window.cy.renderer().stats().uploadedBytes );
    const movedSrc = await page.evaluate( () => window.cy.$id( 'e0' ).renderedSourceEndpoint() );

    expect( uploadedAfter - uploadedBefore ).toBeLessThanOrEqual( 64 );
    expect( Math.abs( movedSrc.y - ( center.y - 80 + 60 ) ) ).toBeLessThan( 1 );

    const movedPx = await pixelAt( page, movedSrc.x, movedSrc.y + 1 );

    expect( movedPx[ 0 ] ).toBeGreaterThan( 180 );
  } );

  test( 'arrows sit at manual endpoints along the chord tangent (12c)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: 0 } },
        { data: { id: 'b' }, position: { x: 150, y: 0 } },
        { data: { id: 'e0', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30, 'background-color': '#ecf0f1' },
        // pull the target endpoint 50 px short of the node: the arrow
        // must sit at the shortened point, in free space
        edges: {
          'target-distance-from-node': 50, 'width': 4, 'line-color': '#95a5a6',
          'target-arrow-shape': 'triangle', 'target-arrow-color': '#8e44ad'
        }
      },
      zoom: 1
    } );

    await centerPan( page );
    await waitFrames( page );

    // the arrow's purple lands just behind the CPU-resolved target
    // endpoint (which sits 50 px shy of the boundary, in free space)
    const tgt = await page.evaluate( () => window.cy.$id( 'e0' ).renderedTargetEndpoint() );
    const arrowPx = await pixelAt( page, tgt.x - 5, tgt.y );

    expect( arrowPx[ 2 ] ).toBeGreaterThan( 120 ); // blue-ish purple
    expect( arrowPx[ 1 ] ).toBeLessThan( 120 );

    // and past the endpoint (between it and the node) there is no line ink
    const gapPx = await pixelAt( page, tgt.x + 20, tgt.y );

    expect( gapPx[ 0 ] ).toBeGreaterThan( 200 );
    expect( gapPx[ 1 ] ).toBeGreaterThan( 200 );
  } );

  test( 'ghosts duplicate the node body at the offset and follow drags (A1)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'n' }, position: { x: 0, y: 0 } } ],
      style: {
        nodes: {
          'width': 40, 'height': 40, 'background-color': '#c0392b',
          'ghost': 'yes', 'ghost-offset-x': 70, 'ghost-offset-y': 0, 'ghost-opacity': 0.5
        }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // the ghost body at the offset: red at half opacity over white reads
    // as a light red — clearly red-tinted, clearly not the full body red
    const ghostPx = await pixelAt( page, center.x + 70, center.y );
    const bodyPx = await pixelAt( page, center.x, center.y );

    expect( ghostPx[ 0 ] ).toBeGreaterThan( bodyPx[ 0 ] ); // lighter than the body
    expect( ghostPx[ 0 ] ).toBeGreaterThan( 180 );
    expect( ghostPx[ 1 ] ).toBeLessThan( 200 ); // but visibly red-tinted
    expect( ghostPx[ 1 ] ).toBeGreaterThan( bodyPx[ 1 ] );

    // ghosts are not pickable: picking at the ghost hits nothing
    const picked = await page.evaluate( async p => {
      const hit = await window.cy.pick( p.x, p.y );

      return hit == null ? null : hit.id();
    }, { x: center.x + 70, y: center.y } );

    expect( picked ).toBe( null );

    // a drag moves the ghost with its node on-GPU (one position row)
    await page.evaluate( () => window.cy.$id( 'n' ).position( { x: 0, y: -60 } ) );
    await waitFrames( page );

    const movedGhostPx = await pixelAt( page, center.x + 70, center.y - 60 );
    const oldGhostPx = await pixelAt( page, center.x + 70, center.y );

    expect( movedGhostPx[ 1 ] ).toBeLessThan( 200 ); // ghost at the new offset
    expect( oldGhostPx[ 1 ] ).toBeGreaterThan( 240 ); // old spot back to white
  } );

  test( 'overlay washes over the body; underlay peeks out under it (A2)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'n' }, position: { x: 0, y: 0 } } ],
      style: {
        nodes: {
          'width': 60, 'height': 60, 'background-color': '#ffffff',
          'shape': 'rectangle',
          'overlay-color': '#0000ff', 'overlay-opacity': 0.5, 'overlay-padding': 0,
          'underlay-color': '#00aa00', 'underlay-opacity': 1, 'underlay-padding': 20,
          'underlay-shape': 'round-rectangle'
        }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // the body center: white washed 50% blue
    const bodyPx = await pixelAt( page, center.x, center.y );

    expect( bodyPx[ 2 ] ).toBeGreaterThan( 200 );
    expect( bodyPx[ 0 ] ).toBeLessThan( 180 );
    expect( bodyPx[ 0 ] ).toBeGreaterThan( 80 );

    // the underlay ring outside the body (padding band): opaque green
    const ringPx = await pixelAt( page, center.x + 40, center.y );

    expect( ringPx[ 1 ] ).toBeGreaterThan( 120 );
    expect( ringPx[ 0 ] ).toBeLessThan( 100 );
    expect( ringPx[ 2 ] ).toBeLessThan( 100 );
  } );

  test( 'core theming styles the selection box and active-bg circle (A2)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'n' }, position: { x: 0, y: 0 } } ],
      style: {
        nodes: { 'width': 20, 'height': 20, 'background-color': '#2c3e50' },
        core: {
          'selection-box-color': '#ff0000', 'selection-box-opacity': 0.5,
          'selection-box-border-color': '#00ff00', 'selection-box-border-width': 2,
          'active-bg-color': '#0000ff', 'active-bg-opacity': 0.4, 'active-bg-size': 25
        }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    // shift-drag a selection box over empty background: the DOM box takes
    // the themed colors
    await page.keyboard.down( 'Shift' );
    await page.mouse.move( center.x + 60, center.y + 60 );
    await page.mouse.down();
    await page.mouse.move( center.x + 140, center.y + 130 );

    const boxStyle = await page.evaluate( () => {
      const el = [ ...document.querySelectorAll( 'div' ) ]
        .find( d => d.style.display === 'block' && d.style.border.includes( 'solid' ) );

      return el == null ? null : { background: el.style.background, border: el.style.border };
    } );

    expect( boxStyle ).not.toBe( null );
    expect( boxStyle.background ).toContain( '255, 0, 0' );
    expect( boxStyle.background ).toContain( '0.5' );
    expect( boxStyle.border ).toContain( '2px' );

    await page.mouse.up();
    await page.keyboard.up( 'Shift' );

    // a plain background press shows the active-bg circle at the point
    await page.mouse.move( center.x - 80, center.y - 40 );
    await page.mouse.down();

    const circle = await page.evaluate( () => {
      const el = [ ...document.querySelectorAll( 'div' ) ]
        .find( d => d.style.borderRadius === '50%' && d.style.display === 'block' );

      return el == null ? null : {
        background: el.style.background, width: el.style.width
      };
    } );

    expect( circle ).not.toBe( null );
    expect( circle.background ).toContain( '0, 0, 255' );
    expect( circle.width ).toBe( '50px' );

    await page.mouse.up();

    const hidden = await page.evaluate( () => {
      const el = [ ...document.querySelectorAll( 'div' ) ]
        .find( d => d.style.borderRadius === '50%' );

      return el == null ? 'gone' : el.style.display;
    } );

    expect( hidden ).toBe( 'none' );
  } );

  test( 'the active-bg circle follows the background drag (round 43.7)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'n' }, position: { x: 0, y: 0 } } ],
      style: {
        nodes: { 'width': 20, 'height': 20, 'background-color': '#2c3e50' },
        core: { 'active-bg-color': '#0000ff', 'active-bg-opacity': 0.4, 'active-bg-size': 25 }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    // The circle is anchored to the *model* point pressed (v3's rule), and a
    // background drag pans the graph — so the anchor travels with the cursor.
    // Before round 43 `showActiveBg` was called once, from pointerdown, and
    // nothing ever moved the element again: it stayed at the press point while
    // the graph slid out from under it.
    const circlePos = () => page.evaluate( () => {
      const el = [ ...document.querySelectorAll( 'div' ) ]
        .find( d => d.style.borderRadius === '50%' && d.style.display === 'block' );

      return el == null ? null : { left: parseFloat( el.style.left ), top: parseFloat( el.style.top ) };
    } );

    await page.mouse.move( center.x - 80, center.y - 40 );
    await page.mouse.down();

    const at0 = await circlePos();

    expect( at0 ).not.toBe( null );

    await page.mouse.move( center.x - 20, center.y - 10 );

    const at1 = await circlePos();

    await page.mouse.move( center.x + 60, center.y + 50 );

    const at2 = await circlePos();

    await page.mouse.up();

    // it tracks the cursor: each move carries the circle by the same delta
    expect( at1.left - at0.left ).toBeCloseTo( 60, 0 );
    expect( at1.top - at0.top ).toBeCloseTo( 30, 0 );
    expect( at2.left - at1.left ).toBeCloseTo( 80, 0 );
    expect( at2.top - at1.top ).toBeCloseTo( 60, 0 );
  } );

  test( 'the active-bg circle stays put when panning is disabled (round 43.7)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // The other half of the model-anchoring rule, and the reason the fix is
    // not simply "re-place it at the cursor": with nothing panning, the graph
    // does not move, so neither does the point that was pressed.  v3 behaves
    // the same way, for the same reason.
    //
    // Reaching this state takes *both* switches: a background drag with
    // panning off becomes a box gesture (which shows no indicator at all), so
    // box selection has to be off too before the press stays in 'pan' mode.
    await makeReadyCy( page, {
      elements: [ { data: { id: 'n' }, position: { x: 0, y: 0 } } ],
      style: {
        nodes: { 'width': 20, 'height': 20, 'background-color': '#2c3e50' },
        core: { 'active-bg-color': '#0000ff', 'active-bg-opacity': 0.4, 'active-bg-size': 25 }
      },
      zoom: 1,
      userPanningEnabled: false,
      boxSelectionEnabled: false
    } );

    const center = await centerPan( page );
    const circlePos = () => page.evaluate( () => {
      const el = [ ...document.querySelectorAll( 'div' ) ]
        .find( d => d.style.borderRadius === '50%' && d.style.display === 'block' );

      return el == null ? null : { left: parseFloat( el.style.left ), top: parseFloat( el.style.top ) };
    } );

    await page.mouse.move( center.x - 80, center.y - 40 );
    await page.mouse.down();

    const at0 = await circlePos();

    await page.mouse.move( center.x + 40, center.y + 40 );

    const at1 = await circlePos();

    await page.mouse.up();

    expect( at0 ).not.toBe( null );
    expect( at1.left ).toBeCloseTo( at0.left, 1 );
    expect( at1.top ).toBeCloseTo( at0.top, 1 );
  } );

  test( 'arrow scalars: hollow rings and scaled heads (B7)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: 0 } },
        { data: { id: 'b' }, position: { x: 150, y: 0 } },
        { data: { id: 'e0', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 24, 'height': 24, 'background-color': '#ecf0f1' },
        edges: {
          'width': 8, 'line-color': '#bdc3c7',
          'target-arrow-shape': 'triangle', 'target-arrow-color': '#c0392b',
          'target-arrow-fill': 'hollow', 'target-arrow-width': 2, 'arrow-scale': 2
        }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // the hollow arrow near the target: its outline is red but the
    // interior shows the line/background through (not solid red).
    // Arrow length ≈ (8·3+2)·2 = 52 px back from the boundary at x=138.
    const outlineProbe = await pixelAt( page, center.x + 137, center.y ); // near the tip
    const interiorProbe = await pixelAt( page, center.x + 110, center.y ); // mid-arrow

    expect( outlineProbe[ 0 ] ).toBeGreaterThan( 140 );
    expect( outlineProbe [ 1 ] ).toBeLessThan( 120 ); // red outline

    // the interior is the grey line, not solid red
    expect( interiorProbe[ 1 ] ).toBeGreaterThan( 150 );
  } );

  test( 'mid arrows sit at straight and curved midpoints (C1)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: -60 } },
        { data: { id: 'b' }, position: { x: 150, y: -60 } },
        { data: { id: 'straight', source: 'a', target: 'b' } },
        { data: { id: 'c' }, position: { x: -150, y: 60 } },
        { data: { id: 'd' }, position: { x: 150, y: 60 } },
        { data: { id: 'q1', source: 'c', target: 'd', curved: 1 } },
        { data: { id: 'q2', source: 'c', target: 'd', curved: 1 } }
      ],
      style: {
        nodes: { 'width': 24, 'height': 24, 'background-color': '#ecf0f1' },
        edges: {
          'width': 4, 'line-color': '#bdc3c7',
          'curve-style': { case: [ { when: { data: 'curved', eq: 1 }, then: 'bezier' } ], else: 'straight' },
          'mid-target-arrow-shape': 'triangle', 'mid-target-arrow-color': '#8e44ad',
          'arrow-scale': 1.5
        }
      },
      zoom: 1
    } );

    await centerPan( page );
    await waitFrames( page );

    // the straight edge's mid arrow: purple at the chord midpoint
    const straightMid = await page.evaluate( () => window.cy.$id( 'straight' ).renderedMidpoint() );
    const sPx = await pixelAt( page, straightMid.x - 3, straightMid.y );

    expect( sPx[ 2 ] ).toBeGreaterThan( 100 );
    expect( sPx[ 1 ] ).toBeLessThan( 120 );

    // the curved edge's mid arrow rides the curve midpoint (off-chord)
    const curveMid = await page.evaluate( () => window.cy.$id( 'q1' ).renderedMidpoint() );
    const cPx = await pixelAt( page, curveMid.x - 3, curveMid.y );

    expect( cPx[ 2 ] ).toBeGreaterThan( 100 );
    expect( cPx[ 1 ] ).toBeLessThan( 120 );
  } );

  test( 'custom polygons draw and pick by their point list (C3)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'n' }, position: { x: 0, y: 0 } } ],
      style: {
        nodes: {
          'width': 100, 'height': 100, 'background-color': '#e74c3c',
          'shape': 'polygon',
          'shape-polygon-points': [ -1, -1, 1, -1, 0, 1 ] // downward triangle
        }
      },
      zoom: 1
    } );

    const c = await centerPan( page );
    await waitFrames( page );

    // inside the triangle: the center and the wide top edge are red...
    const centerPx = await pixelAt( page, c.x, c.y );
    const topRightPx = await pixelAt( page, c.x + 40, c.y - 40 );

    for( const px of [ centerPx, topRightPx ] ){
      expect( px[ 0 ] ).toBeGreaterThan( 180 );
      expect( px[ 1 ] ).toBeLessThan( 140 );
    }

    // ...the box corner beside the bottom apex is background, not node
    const bottomRightPx = await pixelAt( page, c.x + 40, c.y + 40 );

    expect( bottomRightPx[ 0 ] ).toBeGreaterThan( 230 );
    expect( bottomRightPx[ 1 ] ).toBeGreaterThan( 230 );

    // picking agrees with the drawn coverage (the same blob record)
    const picks = await page.evaluate( async c => {
      const at = async ( x, y ) => {
        const hit = await window.cy.pick( x, y );

        return hit == null ? null : hit.id();
      };

      return {
        inside: await at( c.x + 40, c.y - 40 ),
        outside: await at( c.x + 40, c.y + 40 )
      };
    }, c );

    expect( picks.inside ).toBe( 'n' );
    expect( picks.outside ).toBe( null );
  } );

  test( 'font-weight thickens label ink and font-style reshapes it (D1)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'n' }, position: { x: 0, y: 0 } } ],
      style: {
        nodes: {
          'width': 40, 'height': 40, 'background-color': '#ecf0f1',
          'label': 'Illustrious', 'font-size': 20, 'color': '#000'
        }
      },
      zoom: 1
    } );

    const c = await centerPan( page );
    await waitFrames( page );

    // the label row sits under the node: half-height 20 + margin + ascent
    const labelInk = async () => {
      let ink = 0;

      for( const dy of [ 30, 34, 38 ] ){
        ink += await darkPixelsInBand( page, c.x - 120, 240, c.y + dy );
      }

      return ink;
    };

    const normalInk = await labelInk();

    expect( normalInk ).toBeGreaterThan( 20 );

    // bold: the same glyphs raster with thicker strokes → more dark ink
    await page.evaluate( () => {
      window.cy.style( { nodes: {
        'width': 40, 'height': 40, 'background-color': '#ecf0f1',
        'label': 'Illustrious', 'font-size': 20, 'color': '#000',
        'font-weight': 'bold'
      } } );
    } );
    await waitFrames( page );

    const boldInk = await labelInk();

    expect( boldInk ).toBeGreaterThan( normalInk * 1.1 );

    // italic: the face changes, so the rendered label pixels move —
    // diff two exports of the same viewport
    const boldUri = await page.evaluate( async () => await window.cy.png( { bg: '#fff' } ) );

    await page.evaluate( () => {
      window.cy.style( { nodes: {
        'width': 40, 'height': 40, 'background-color': '#ecf0f1',
        'label': 'Illustrious', 'font-size': 20, 'color': '#000',
        'font-weight': 'bold', 'font-style': 'italic'
      } } );
    } );
    await waitFrames( page );

    const italicUri = await page.evaluate( async () => await window.cy.png( { bg: '#fff' } ) );
    const diff = await page.evaluate( async ( { a, b } ) => {
      const load = async uri => {
        const img = new Image();

        img.src = uri;
        await img.decode();

        const canvas = document.createElement( 'canvas' );

        canvas.width = img.width;
        canvas.height = img.height;

        const ctx = canvas.getContext( '2d' );

        ctx.drawImage( img, 0, 0 );

        return ctx.getImageData( 0, 0, img.width, img.height ).data;
      };
      const [ da, db ] = [ await load( a ), await load( b ) ];
      let n = 0;

      for( let i = 0; i < Math.min( da.length, db.length ); i += 4 ){
        if( Math.abs( da[ i ] - db[ i ] ) > 32 ){ n++; }
      }

      return n;
    }, { a: boldUri, b: italicUri } );

    expect( diff ).toBeGreaterThan( 50 );
  } );

  test( 'min-zoomed-font-size hides only the floored label on zoom-out (D2)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'floored', floor: 16 }, position: { x: -80, y: 0 } },
        { data: { id: 'free', floor: 0 }, position: { x: 80, y: 0 } }
      ],
      style: {
        nodes: {
          'width': 30, 'height': 30, 'background-color': '#ecf0f1',
          'label': 'LABELLED', 'font-size': 20, 'color': '#000',
          'min-zoomed-font-size': { data: 'floor', scale: 'linear', domain: [ 0, 16 ], range: [ 0, 16 ] }
        }
      },
      zoom: 1
    } );

    await centerPan( page );
    await waitFrames( page );

    // ink under a node across the label rows at the current zoom
    const labelInk = async id => {
      const p = await page.evaluate( id => window.cy.$id( id ).renderedPosition(), id );
      const zoom = await page.evaluate( () => window.cy.zoom() );
      let ink = 0;

      for( const dy of [ 26, 31, 36 ] ){
        ink += await darkPixelsInBand( page, p.x - 70, 140, p.y + dy * zoom );
      }

      return ink;
    };

    // zoom 1: fontSize x zoomDpr = 20 >= 16, both labels draw
    expect( await labelInk( 'floored' ) ).toBeGreaterThan( 20 );
    expect( await labelInk( 'free' ) ).toBeGreaterThan( 20 );

    // zoom 0.7: 14 < 16 hides the floored label; the free one stays
    await page.evaluate( () => { window.cy.zoom( 0.7 ); } );
    await waitFrames( page );

    expect( await labelInk( 'floored' ) ).toBe( 0 );
    expect( await labelInk( 'free' ) ).toBeGreaterThan( 10 );

    // zooming back in restores it (a pure cull, not a rebuild)
    await page.evaluate( () => { window.cy.zoom( 1 ); } );
    await waitFrames( page );

    expect( await labelInk( 'floored' ) ).toBeGreaterThan( 20 );
  } );

  test( 'text-valign/-halign move the label around the node (D3)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [ { data: { id: 'n' }, position: { x: 0, y: 0 } } ],
      style: {
        nodes: {
          'width': 40, 'height': 40, 'background-color': '#ecf0f1',
          'label': 'WIDE LABEL', 'font-size': 16, 'color': '#000',
          'text-halign': 'left', 'text-valign': 'top'
        }
      },
      zoom: 1
    } );

    const c = await centerPan( page );
    await waitFrames( page );

    const band = async ( x0, w, y ) => await darkPixelsInBand( page, x0, w, y );

    // top-left: ink fully above and left of the node...
    let above = 0, below = 0;

    for( const dy of [ 28, 32, 36 ] ){
      above += await band( c.x - 150, 130, c.y - dy );
      below += await band( c.x - 150, 300, c.y + dy );
    }

    expect( above ).toBeGreaterThan( 20 );
    expect( below ).toBe( 0 );

    // ...and none to the right of the node's left edge (run ends there)
    let rightOfEdge = 0;

    for( const dy of [ 28, 32, 36 ] ){
      rightOfEdge += await band( c.x - 18, 170, c.y - dy );
    }

    expect( rightOfEdge ).toBe( 0 );

    // restyle to bottom-right: ink moves below and right
    await page.evaluate( () => {
      window.cy.style( { nodes: {
        'width': 40, 'height': 40, 'background-color': '#ecf0f1',
        'label': 'WIDE LABEL', 'font-size': 16, 'color': '#000',
        'text-halign': 'right', 'text-valign': 'bottom'
      } } );
    } );
    await waitFrames( page );

    let belowRight = 0, aboveNow = 0;

    for( const dy of [ 28, 32, 36 ] ){
      belowRight += await band( c.x + 22, 150, c.y + dy );
      aboveNow += await band( c.x - 150, 300, c.y - dy );
    }

    expect( belowRight ).toBeGreaterThan( 20 );
    expect( aboveNow ).toBe( 0 );
  } );

  test( 'source/target labels sit at their arc offsets and follow restyles (D4)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, {
      elements: [
        { data: { id: 'a' }, position: { x: -150, y: 0 } },
        { data: { id: 'b' }, position: { x: 150, y: 0 } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ],
      style: {
        nodes: { 'width': 30, 'height': 30, 'background-color': '#ecf0f1' },
        edges: {
          'width': 2, 'line-color': '#ecf0f1',
          'source-label': 'SRC', 'source-text-offset': 40,
          'target-label': 'TGT', 'target-text-offset': 40,
          'font-size': 14, 'color': '#000'
        }
      },
      zoom: 1
    } );

    const c = await centerPan( page );
    await waitFrames( page );

    const inkAround = async x => {
      let ink = 0;

      for( const dy of [ -4, 0, 4 ] ){
        ink += await darkPixelsInBand( page, x - 20, 40, c.y + dy );
      }

      return ink;
    };

    // source boundary at x = -135; offset 40 -> anchor at -95 (target
    // mirrored at +95); the midpoint stays clear
    expect( await inkAround( c.x - 95 ) ).toBeGreaterThan( 10 );
    expect( await inkAround( c.x + 95 ) ).toBeGreaterThan( 10 );
    expect( await inkAround( c.x ) ).toBe( 0 );

    // a bigger source offset slides the label along the edge
    await page.evaluate( () => {
      window.cy.style( { nodes: { 'width': 30, 'height': 30, 'background-color': '#ecf0f1' },
        edges: {
          'width': 2, 'line-color': '#ecf0f1',
          'source-label': 'SRC', 'source-text-offset': 100,
          'font-size': 14, 'color': '#000'
        } } );
    } );
    await waitFrames( page );

    expect( await inkAround( c.x - 35 ) ).toBeGreaterThan( 10 );
    expect( await inkAround( c.x - 95 ) ).toBe( 0 );
    expect( await inkAround( c.x + 95 ) ).toBe( 0 ); // target label removed
  } );

  test( 'compound parents draw under children and edges, and pick around them (round 14.9)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // p (green, padding 20) > a red child at the origin; q leaf far right;
    // edge a-q crosses p's padding band on its way out
    await makeReadyCy( page, {
      elements: [
        { data: { id: 'p' } },
        { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
        { data: { id: 'q' }, position: { x: 200, y: 0 } },
        { data: { id: 'aq', source: 'a', target: 'q' } }
      ],
      style: {
        nodes: { 'width': 60, 'height': 60, 'shape': 'rectangle', 'background-color': 'red' },
        parents: { 'background-color': 'rgb(0,128,0)', 'border-width': 0, padding: 20 },
        edges: { 'width': 8, 'line-color': 'rgb(0,0,255)' }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await page.evaluate( () => new Promise( resolve => requestAnimationFrame( () => requestAnimationFrame( resolve ) ) ) );

    // the child draws over its parent...
    const [ childR, childG ] = await pixelAt( page, center.x, center.y );

    expect( childR ).toBeGreaterThan( 200 );
    expect( childG ).toBeLessThan( 80 );

    // ...the padding band shows the parent...
    const [ bandR, bandG ] = await pixelAt( page, center.x, center.y - 40 );

    expect( bandG ).toBeGreaterThan( 100 );
    expect( bandR ).toBeLessThan( 80 );

    // ...and the edge draws over the parent band on its way out (x=44 is
    // inside p's box [-50, 50], outside the child)
    const atEdge = await pixelAt( page, center.x + 44, center.y );

    expect( atEdge[ 2 ] ).toBeGreaterThan( 200 );

    // picking mirrors draw order: child at the center, parent in the band
    const picked = await page.evaluate( async ( { x, y } ) => ( {
      child: ( await window.cy.pick( x, y ) )?.id(),
      band: ( await window.cy.pick( x, y - 40 ) )?.id()
    } ), { x: center.x, y: center.y } );

    expect( picked.child ).toBe( 'a' );
    expect( picked.band ).toBe( 'p' );

    // dragging the child re-derives the parent on-GPU state via the
    // normal column path: the old band pixel clears once the child moves
    await page.evaluate( () => {
      window.cy.$id( 'a' ).position( { x: -150, y: 0 } );
    } );
    await page.evaluate( () => new Promise( resolve => requestAnimationFrame( () => requestAnimationFrame( resolve ) ) ) );

    const bandAfter = await pixelAt( page, center.x, center.y - 40 );

    // parent followed its child away: the old band pixel is background now
    expect( bandAfter[ 0 ] ).toBeGreaterThan( 200 );
    expect( bandAfter[ 1 ] ).toBeGreaterThan( 200 );
    expect( bandAfter[ 2 ] ).toBeGreaterThan( 200 );
  } );

  test( 'dragging a parent moves its subtree; a selected parent+child pair moves once (round 14.11)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // p (padding 20) > a at the origin; q leaf far right
    await makeReadyCy( page, {
      elements: [
        { data: { id: 'p' } },
        { data: { id: 'a', parent: 'p' }, position: { x: 0, y: 0 } },
        { data: { id: 'q' }, position: { x: 220, y: 0 } }
      ],
      style: {
        nodes: { 'width': 60, 'height': 60, 'shape': 'rectangle', 'background-color': 'red' },
        parents: { 'background-color': 'rgb(0,128,0)', 'border-width': 0, padding: 20 }
      },
      zoom: 1
    } );

    const center = await centerPan( page );

    await waitFrames( page );

    // hover-resolve then grab the parent by its padding band (above the child)
    await page.evaluate( () => {
      window.__hovered = false;
      window.cy.on( 'mouseover', () => { window.__hovered = true; } );
    } );
    await page.mouse.move( center.x - 10, center.y - 50 );
    await page.mouse.move( center.x, center.y - 40, { steps: 5 } );
    await expect.poll( () => page.evaluate( () => window.__hovered ), { timeout: 5000 } ).toBe( true );

    await page.mouse.down();
    await page.mouse.move( center.x + 80, center.y + 10, { steps: 10 } );
    await page.mouse.up();

    const dragged = await page.evaluate( () => ( {
      p: window.cy.$id( 'p' ).position(),
      a: window.cy.$id( 'a' ).position()
    } ) );

    // the subtree followed the parent drag (v3's beforePositionSet):
    // the pointer moved (+80, +50) from the grab point
    expect( dragged.a.x ).toBeCloseTo( 80, 0 );
    expect( dragged.a.y ).toBeCloseTo( 50, 0 );
    expect( dragged.p.x ).toBeCloseTo( 80, 0 );
    expect( dragged.p.y ).toBeCloseTo( 50, 0 );

    // drag-all-selected with the parent AND its child selected: the
    // shift dedupe moves the child exactly once
    await page.evaluate( () => {
      window.cy.$id( 'p' ).select();
      window.cy.$id( 'a' ).select();
    } );
    await waitFrames( page );

    // grab p's padding band at its new spot (p spans y [0, 100] there;
    // the child body starts at y = 20)
    await page.mouse.move( center.x + 80, center.y + 10 );
    await page.mouse.down();
    await page.mouse.move( center.x + 80, center.y + 110, { steps: 10 } );
    await page.mouse.up();

    const after = await page.evaluate( () => ( {
      p: window.cy.$id( 'p' ).position(),
      a: window.cy.$id( 'a' ).position()
    } ) );

    expect( after.a.y ).toBeCloseTo( dragged.a.y + 100, 0 ); // once, not twice
    expect( after.p.y ).toBeCloseTo( dragged.p.y + 100, 0 );
  } );


  /*
  Round 48.5: device loss **under load**.

  Round 10's spec loses the device on an idle instance, which is the easy
  case: nothing owns a column, nothing is mid-readback, and the rebuild has
  only the model to replay.  The cases below lose it while something is
  actually in flight — a GPU-leased tween, a pending export readback, a live
  force run — which is where a lease that is never released, or a promise
  that is never settled, would show up as a hang rather than an error.
  */

  const loseDevice = async page => {
    await page.evaluate( () => {
      window.__lost = false;
      window.__restored = false;
      window.cy.on( 'devicelost', () => { window.__lost = true; } );
      window.cy.on( 'devicerestored', () => { window.__restored = true; } );
      window.cy.renderer()._debugLoseDevice();
    } );

    await expect.poll( () => page.evaluate( () => window.__lost ), { timeout: 5000 } ).toBe( true );
  };

  test( 'device loss mid-animation settles the lease and completes (round 48.5)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );
    await centerPan( page );
    await waitFrames( page );

    // a position animation is the GPU-leased case: node.position is
    // device-owned for the run, and the CPU reads stale until it settles
    await page.evaluate( () => {
      window.__done = false;
      window.__ani = window.cy.$id( 'a' ).animation( {
        position: { x: 120, y: 0 }, duration: 3000
      } );
      // play() resolves when the animation finishes (or is stopped)
      window.__ani.play().then( () => { window.__done = true; } );
    } );

    await waitFrames( page );
    await loseDevice( page );

    // the promise must settle rather than hang on a device that is gone
    await expect.poll( () => page.evaluate( () => window.__done ), { timeout: 15000 } ).toBe( true );
    await expect.poll( () => page.evaluate( () => window.__restored ), { timeout: 15000 } ).toBe( true );

    // and the model must be readable and sane afterwards — the lease
    // released, not stranded
    const after = await page.evaluate( () => window.cy.$id( 'a' ).position() );

    expect( Number.isFinite( after.x ) ).toBe( true );
    expect( Number.isFinite( after.y ) ).toBe( true );
    expect( after.x ).toBeGreaterThan( -1 );
    expect( after.x ).toBeLessThanOrEqual( 120 );

    // the recovered renderer still draws, and still responds to writes
    await page.evaluate( () => window.cy.$id( 'a' ).position( { x: 0, y: 0 } ) );
    await waitFrames( page );
    await waitFrames( page );

    const center = await page.evaluate( () => (
      { x: window.innerWidth / 2, y: window.innerHeight / 2 } ) );
    const px = await pixelAt( page, center.x, center.y );

    expect( px[0] ).toBeGreaterThan( 150 );
    expect( px[1] ).toBeLessThan( 100 );
  } );

  test( 'device loss mid-export rejects rather than hanging (round 48.5)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    await makeReadyCy( page, RED_NODE_GRAPH );
    await centerPan( page );
    await waitFrames( page );

    // an export is the one readback in the architecture: it encodes in the
    // frame loop and maps a staging buffer afterwards, so losing the device
    // between those two points is the case with a promise in mid-air.
    //
    // The spec accepts *either* outcome — a resolved export or a rejected
    // one — because both are correct and which one you get depends on how
    // far the readback had progressed. That makes the settling assertion
    // alone non-discriminating: with no loss at all the export simply
    // resolves and the spec passes. So the loss itself is asserted, which
    // is what a control on `_debugLoseDevice` then fails.
    await page.evaluate( () => {
      window.__lost = false;
      window.__restored = false;
      window.cy.on( 'devicelost', () => { window.__lost = true; } );
      window.cy.on( 'devicerestored', () => { window.__restored = true; } );

      window.__export = window.cy.png( { output: 'blob' } ).then(
        blob => ( { settled: 'resolved', size: blob?.size ?? -1 } ),
        e => ( { settled: 'rejected', error: e instanceof Error, message: String( e.message ).slice( 0, 80 ) } )
      );

      window.cy.renderer()._debugLoseDevice();
    } );

    // the loss really happened, mid-export
    await expect.poll( () => page.evaluate( () => window.__lost ), { timeout: 5000 } ).toBe( true );

    // and the promise settled rather than being stranded on a dead device
    const outcome = await page.evaluate( () => window.__export );

    expect( [ 'resolved', 'rejected' ] ).toContain( outcome.settled );

    if( outcome.settled === 'rejected' ){
      expect( outcome.error, `export rejected with a non-Error: ${outcome.message}` ).toBe( true );
    }

    // and the instance recovers regardless of which way the export went
    await expect.poll( () => page.evaluate( () => window.cy.renderer() != null ), { timeout: 15000 } )
      .toBe( true );

    await page.evaluate( () => window.cy.$id( 'a' ).position( { x: 40, y: 0 } ) );
    await waitFrames( page );
    await waitFrames( page );

    const later = await page.evaluate( () => window.cy.$id( 'a' ).position() );

    expect( later.x ).toBe( 40 );
  } );

  test( 'device loss mid-force-run leaves readable positions (round 48.5)', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // a force run is the other lease, and the stronger one: the sim owns the
    // position column for its whole run and settles it with the one readback
    // in the architecture, so losing the device mid-run is the case where a
    // column could be left owned by a device that no longer exists
    await makeReadyCy( page, {
      elements: ( () => {
        const elements = [];

        for( let i = 0; i < 60; i++ ){
          elements.push( { data: { id: 'n' + i }, position: { x: ( i % 10 ) * 20, y: ( ( i / 10 ) | 0 ) * 20 } } );
        }

        for( let i = 1; i < 60; i++ ){
          elements.push( { data: { id: 'e' + i, source: 'n' + ( i - 1 ), target: 'n' + i } } );
        }

        return elements;
      } )(),
      style: { nodes: { 'background-color': 'red', width: 10, height: 10 } },
      zoom: 1
    } );

    await waitFrames( page );

    await page.evaluate( () => {
      window.__layoutStopped = false;
      window.cy.on( 'layoutstop', () => { window.__layoutStopped = true; } );
      window.cy.layout( { name: 'force', animate: true, iterations: 100000, randomize: true } ).run();
    } );

    await waitFrames( page );
    await loseDevice( page );

    await expect.poll( () => page.evaluate( () => window.__restored ), { timeout: 20000 } ).toBe( true );

    // whatever the run did, the model must be readable and finite — never
    // NaN, never stuck behind a lease held by a dead device
    const positions = await page.evaluate( () => {
      window.cy.$id( 'n0' ).position( { x: 7, y: 7 } );

      return window.cy.nodes().map( n => n.position() );
    } );

    expect( positions.length ).toBe( 60 );
    expect( positions.every( p => Number.isFinite( p.x ) && Number.isFinite( p.y ) ) ).toBe( true );

    // the write after recovery took, which is what proves the column is
    // CPU-owned again
    const n0 = await page.evaluate( () => window.cy.$id( 'n0' ).position() );

    expect( n0.x ).toBe( 7 );
    expect( n0.y ).toBe( 7 );
  } );

} );
