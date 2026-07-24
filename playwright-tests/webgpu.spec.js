import { test, expect } from '@playwright/test';

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

  test.beforeEach( async ( { page } ) => {
    page.on( 'console', msg => console.log( `[browser] ${msg.text()}` ) );

    await page.setViewportSize( { width: 800, height: 600 } );
    await page.goto( PAGE );
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

} );
