import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// round 13 A2: the core sheet group (selection-box-* / active-bg-*)

describe('gpu/core-style: core theming props (round 13 A2)', function(){

  var cy;

  it('resolves core props with v3 defaults', function(){
    cy = cytoscapeGpu({});

    var core = cy._styleEngine.core();

    expect( core.selectionBoxColor ).to.deep.equal( [ 221, 221, 221, 255 ] );
    expect( core.selectionBoxOpacity ).to.equal( 0.65 );
    expect( core.selectionBoxBorderColor ).to.deep.equal( [ 170, 170, 170, 255 ] );
    expect( core.selectionBoxBorderWidth ).to.equal( 1 );
    expect( core.activeBgColor ).to.deep.equal( [ 0, 0, 0, 255 ] );
    expect( core.activeBgOpacity ).to.equal( 0.15 );
    expect( core.activeBgSize ).to.equal( 30 );
  });

  it('parses a core sheet group (camelCase and kebab-case)', function(){
    cy = cytoscapeGpu({
      style: { core: {
        'selection-box-color': '#f00',
        selectionBoxOpacity: 0.4,
        'active-bg-size': 12
      } }
    });

    var core = cy._styleEngine.core();

    expect( core.selectionBoxColor ).to.deep.equal( [ 255, 0, 0, 255 ] );
    expect( core.selectionBoxOpacity ).to.equal( 0.4 );
    expect( core.activeBgSize ).to.equal( 12 );
    // untouched keys keep the defaults
    expect( core.activeBgOpacity ).to.equal( 0.15 );
  });

  it('a sheet without a core group resets to the defaults', function(){
    cy = cytoscapeGpu({ style: { core: { 'active-bg-size': 12 } } });

    cy.style({ nodes: {} });

    expect( cy._styleEngine.core().activeBgSize ).to.equal( 30 );
  });

  it('throws on unknown core props, mappers and bad values', function(){
    expect( () => cytoscapeGpu({ style: { core: { 'bogus-prop': 1 } } }) )
      .to.throw( /core style property/ );
    expect( () => cytoscapeGpu({ style: { core: { 'active-bg-size': { data: 'x' } } } }) )
      .to.throw( /constants only/ );
    expect( () => cytoscapeGpu({ style: { core: { 'selection-box-opacity': 3 } } }) )
      .to.throw( /within \[0, 1\]/ );
  });

  afterEach( function(){
    if( cy != null ){ cy.destroy(); cy = null; }
  });
});
