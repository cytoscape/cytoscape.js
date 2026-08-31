import { expect } from 'chai';
import cytoscape from '../src/test.mjs';
import { arrowPrefixes, getArrowScale, getMaxArrowScale } from '../src/style/arrow-scale.mjs';

describe('Style arrow scale', function(){

  var cy;
  var edge;

  var makeCy = function( style ){
    cy = cytoscape({
      styleEnabled: true,

      elements: {
        nodes: [ { data: { id: 'n1' } }, { data: { id: 'n2' } } ],
        edges: [ { data: { id: 'e1', source: 'n1', target: 'n2' } } ]
      },

      style: style
    });

    edge = cy.$('#e1');
  };

  beforeEach(function(){
    makeCy([]);
  });

  afterEach(function(){
    cy.destroy();
  });

  it('defaults every arrow to the unprefixed scale', function(){
    expect( edge.pstyle('arrow-scale').value ).to.equal( 1 );

    arrowPrefixes.forEach(function( prefix ){
      expect( edge.pstyle( prefix + '-arrow-scale' ).value ).to.equal( 'inherit' );
      expect( getArrowScale( edge, prefix ) ).to.equal( 1 );
    });
  });

  it('falls back to the unprefixed scale when no override is set', function(){
    makeCy([
      { selector: 'edge', style: { 'arrow-scale': 3 } }
    ]);

    arrowPrefixes.forEach(function( prefix ){
      expect( getArrowScale( edge, prefix ) ).to.equal( 3 );
    });
  });

  it('prefers an override over the unprefixed scale', function(){
    makeCy([
      { selector: 'edge', style: { 'arrow-scale': 3, 'target-arrow-scale': 5 } }
    ]);

    expect( getArrowScale( edge, 'target' ) ).to.equal( 5 );
    expect( getArrowScale( edge, 'source' ) ).to.equal( 3 );
    expect( getArrowScale( edge, 'mid-source' ) ).to.equal( 3 );
    expect( getArrowScale( edge, 'mid-target' ) ).to.equal( 3 );
  });

  it('honours an override that is smaller than the unprefixed scale', function(){
    makeCy([
      { selector: 'edge', style: { 'arrow-scale': 4, 'source-arrow-scale': 0.5 } }
    ]);

    expect( getArrowScale( edge, 'source' ) ).to.equal( 0.5 );
    expect( getArrowScale( edge, 'target' ) ).to.equal( 4 );
  });

  // n.b. this is why the prefixed properties default to `inherit` rather than to `1`:
  // a numeric default would make an override of `1` indistinguishable from no override
  it('honours an override of 1 against a larger unprefixed scale', function(){
    makeCy([
      { selector: 'edge', style: { 'arrow-scale': 3, 'source-arrow-scale': 1 } }
    ]);

    expect( getArrowScale( edge, 'source' ) ).to.equal( 1 );
    expect( getArrowScale( edge, 'target' ) ).to.equal( 3 );
  });

  it('rejects an override of 0', function(){
    arrowPrefixes.forEach(function( prefix ){
      makeCy([
        { selector: 'edge', style: { 'arrow-scale': 3, [ prefix + '-arrow-scale' ]: 0 } }
      ]);

      expect( edge.pstyle( prefix + '-arrow-scale' ).value ).to.equal( 'inherit' );
      expect( getArrowScale( edge, prefix ) ).to.equal( 3 );
    });
  });

  it('rejects an override of 0 set as a bypass', function(){
    arrowPrefixes.forEach(function( prefix ){
      makeCy([
        { selector: 'edge', style: { 'arrow-scale': 3 } }
      ]);

      edge.style( prefix + '-arrow-scale', 0 );

      expect( getArrowScale( edge, prefix ) ).to.equal( 3 );
    });
  });

  it('keeps getMaxArrowScale() away from 0 when every override is 0', function(){
    makeCy([
      { selector: 'edge', style: {
        'arrow-scale': 3,
        'source-arrow-scale': 0,
        'mid-source-arrow-scale': 0,
        'target-arrow-scale': 0,
        'mid-target-arrow-scale': 0
      } }
    ]);

    expect( getMaxArrowScale( edge ) ).to.equal( 3 );
  });

  it('rejects a negative override', function(){
    arrowPrefixes.forEach(function( prefix ){
      makeCy([
        { selector: 'edge', style: { 'arrow-scale': 3, [ prefix + '-arrow-scale' ]: -1 } }
      ]);

      expect( getArrowScale( edge, prefix ) ).to.equal( 3 );
    });
  });

  it('treats an explicit `inherit` as no override', function(){
    makeCy([
      { selector: 'edge', style: { 'arrow-scale': 3, 'source-arrow-scale': 'inherit' } }
    ]);

    expect( getArrowScale( edge, 'source' ) ).to.equal( 3 );
  });

  it('lets a later context override the unprefixed scale back to inherit', function(){
    makeCy([
      { selector: 'edge', style: { 'arrow-scale': 3, 'source-arrow-scale': 6 } },
      { selector: 'edge.plain', style: { 'source-arrow-scale': 'inherit' } }
    ]);

    expect( getArrowScale( edge, 'source' ) ).to.equal( 6 );

    edge.addClass('plain');

    expect( getArrowScale( edge, 'source' ) ).to.equal( 3 );
  });

  it('picks up an override set as a bypass', function(){
    makeCy([
      { selector: 'edge', style: { 'arrow-scale': 2 } }
    ]);

    edge.style('mid-target-arrow-scale', 7);

    expect( getArrowScale( edge, 'mid-target' ) ).to.equal( 7 );
    expect( getArrowScale( edge, 'target' ) ).to.equal( 2 );

    edge.removeStyle('mid-target-arrow-scale');

    expect( getArrowScale( edge, 'mid-target' ) ).to.equal( 2 );
  });

  it('falls back to the unprefixed scale when no prefix is given', function(){
    makeCy([
      { selector: 'edge', style: { 'arrow-scale': 3, 'target-arrow-scale': 5 } }
    ]);

    expect( getArrowScale( edge, null ) ).to.equal( 3 );
  });

  it('resolves an override given as a mapper', function(){
    cy = cytoscape({
      styleEnabled: true,

      elements: {
        nodes: [ { data: { id: 'n1' } }, { data: { id: 'n2' } } ],
        edges: [ { data: { id: 'e1', source: 'n1', target: 'n2', s: 6 } } ]
      },

      style: [
        { selector: 'edge', style: { 'arrow-scale': 2, 'target-arrow-scale': 'data(s)' } }
      ]
    });

    edge = cy.$('#e1');

    expect( getArrowScale( edge, 'target' ) ).to.equal( 6 );
    expect( getArrowScale( edge, 'source' ) ).to.equal( 2 );
  });

  describe('getMaxArrowScale()', function(){

    it('is the unprefixed scale when nothing is overridden', function(){
      makeCy([
        { selector: 'edge', style: { 'arrow-scale': 3 } }
      ]);

      expect( getMaxArrowScale( edge ) ).to.equal( 3 );
    });

    it('is the largest override when one exceeds the unprefixed scale', function(){
      makeCy([
        { selector: 'edge', style: {
          'arrow-scale': 3,
          'source-arrow-scale': 0.5,
          'target-arrow-scale': 5
        } }
      ]);

      expect( getMaxArrowScale( edge ) ).to.equal( 5 );
    });

    it('is the unprefixed scale when every override is smaller', function(){
      makeCy([
        { selector: 'edge', style: {
          'arrow-scale': 3,
          'source-arrow-scale': 0.5,
          'target-arrow-scale': 2
        } }
      ]);

      expect( getMaxArrowScale( edge ) ).to.equal( 3 );
    });

  });

});
