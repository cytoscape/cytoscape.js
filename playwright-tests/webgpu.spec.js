import { test, expect } from '@playwright/test';
import { decodePng, diffPngs, writeDiffArtifacts } from './lib/image-diff.mjs';

/*
WebGPU prototype specs.  Run under the 'webgpu' Playwright project
(chromium channel + --enable-unsafe-webgpu, with --enable-unsafe-swiftshader
as a deterministic software fallback for CI).  Soft-skips when no adapter
can be acquired.  Must load via http://127.0.0.1:3333 — navigator.gpu is
unavailable on about:blank.
*/

const PAGE = 'http://127.0.0.1:3333/playwright-page/webgpu.html';

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

/** Composited screen pixel at CSS coords, via a screenshot decoded in-page. */
const pixelAt = async ( page, x, y ) => {
  const b64 = ( await page.screenshot() ).toString( 'base64' );

  return await page.evaluate( async ( { b64, x, y } ) => {
    const img = new Image();

    img.src = 'data:image/png;base64,' + b64;
    await img.decode();

    const canvas = document.createElement( 'canvas' );

    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext( '2d' );

    ctx.drawImage( img, 0, 0 );

    const scale = img.width / window.innerWidth; // device scale factor of the screenshot

    const d = ctx.getImageData( Math.round( x * scale ), Math.round( y * scale ), 1, 1 ).data;

    return [ d[0], d[1], d[2], d[3] ];
  }, { b64, x, y } );
};

const waitFrames = async ( page, n = 3 ) => {
  await page.evaluate( async n => {
    for( let i = 0; i < n; i++ ){
      await new Promise( resolve => requestAnimationFrame( resolve ) );
    }
  }, n );
};

/** Count dark (text-ish) pixels in a horizontal band of the composited page. */
const darkPixelsInBand = async ( page, x0, width, y ) => {
  const b64 = ( await page.screenshot() ).toString( 'base64' );

  return await page.evaluate( async ( { b64, x0, width, y } ) => {
    const img = new Image();

    img.src = 'data:image/png;base64,' + b64;
    await img.decode();

    const canvas = document.createElement( 'canvas' );

    canvas.width = img.width;
    canvas.height = img.height;

    const ctx = canvas.getContext( '2d' );

    ctx.drawImage( img, 0, 0 );

    const scale = img.width / window.innerWidth;
    const data = ctx.getImageData(
      Math.round( x0 * scale ), Math.round( y * scale ),
      Math.round( width * scale ), 1
    ).data;

    let dark = 0;

    for( let i = 0; i < data.length; i += 4 ){
      if( data[ i ] < 100 && data[ i + 1 ] < 100 && data[ i + 2 ] < 100 ){ dark++; }
    }

    return dark;
  }, { b64, x0, width, y } );
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

      const cy = cytoscapeGpu( { elements: [ { data: { id: 'a' } } ] } );

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

  test( 'columnar elements load renders and picks', async ( { page } ) => {
    test.skip( !( await hasAdapter( page ) ), 'no WebGPU adapter available' );

    // the payload converts in-page (typed arrays don't cross evaluate())
    await page.evaluate( async () => {
      const columnar = window.cytoscapeGpu.toColumnarElements( {
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
      const wire = window.cytoscapeGpu.serializeElements( {
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

      // two fingers 100 apart widen to 200 apart: zoom should double
      fire( 'pointerdown', 11, center.x - 50, center.y );
      fire( 'pointerdown', 12, center.x + 50, center.y );

      for( let step = 1; step <= 5; step++ ){
        const spread = 50 + step * 10;

        fire( 'pointermove', 11, center.x - spread, center.y );
        fire( 'pointermove', 12, center.x + spread, center.y );
      }

      fire( 'pointerup', 11, center.x - 100, center.y );

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
    await page.waitForTimeout( 400 );
    await waitFrames( page );

    // the node has visibly left its start location...
    expect( ( await pixelAt( page, center.x - 120, center.y ) )[ 1 ] ).toBeGreaterThan( 150 );

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
    await page.waitForTimeout( 900 );
    await waitFrames( page );

    const mid = await pixelAt( page, center.x, center.y );

    // the paint has visibly moved off blue (≈[93,180,206] at t=0.45)
    expect( mid[ 0 ] ).toBeGreaterThan( 30 );
    expect( mid[ 2 ] ).toBeLessThan( 245 );

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
    await page.waitForTimeout( 700 );
    await waitFrames( page );

    const mid = await pixelAt( page, center.x, center.y );

    expect( mid[ 0 ] ).toBeGreaterThan( 40 ); // white bleeding through
    expect( mid[ 0 ] ).toBeLessThan( 220 );

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
    await page.evaluate( () => window.cy.$id( 'a' ).animate( {
      position: { x: 0, y: 0 }, duration: 2000, easing: 'spring(0.7)' } ) );
    await page.waitForTimeout( 1000 );
    await waitFrames( page );

    // 35px past the target: only an overshoot puts the node here
    expect( ( await pixelAt( page, center.x + 35, center.y ) )[ 1 ] ).toBeLessThan( 80 );

    // it also runs past its perceptual duration while the ringing decays
    await page.waitForTimeout( 1200 );
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
    await page.waitForTimeout( 1800 );

    const { pixels } = await pngAndSample(
      page, {}, [ [ center.x - 200, center.y ], [ center.x, center.y ] ]
    );

    // not at the start any more...
    expect( pixels[0][3] ).toBe( 0 );
    // ...and covering the midpoint by now (the 120px body gives the timing
    // a ±0.15 window around t = 0.5)
    expect( pixels[1][0] ).toBeGreaterThan( 200 );

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

} );
