import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

/*
Round 24.1: style transitions — the transition-property/-duration/-delay/
-timing-function family (per sheet group, constants-only).

A transition fires whenever a *restyle* changes an element's resolved
tweenable channel: sheet re-application, mapper re-evaluation on data
writes (case flips, scale moves, auto-domain extent shifts) and
structural restyles (leaf↔parent flips).  An element's first style
application on add is instant (v3's rule).  Interruption is the round-21
rule, uniformly: latest wins, both between transitions and user
animations.  Discrete channels and not-yet-animatable geometry numerics
snap at the transition's start (recorded); the tweenable set is the
animation system's (opacity both groups, background/border/line colors,
border-width), diffed on *stored truth* — so channel-opacity folds ride
the color they fold into, and an edge-opacity transition carries the
pre-folded arrow alphas along.

Between the triggering call and the first tick the store holds the *old*
values (the diff restores them), so sync reads during a transition-delay
report the pre-restyle state — CSS's rule.

Ticks drive deterministically via cy._animations.tick(now), as in
test/gpu-animation.mjs.
*/

describe('gpu/style: transitions (round 24.1)', function(){

  const TRANSITION = {
    'transition-property': [ 'background-color', 'opacity' ],
    'transition-duration': 100,
    'transition-timing-function': 'linear'
  };

  const makeCy = ( nodeStyle, elements ) => cytoscapeGpu({
    elements: elements ?? [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ],
    style: { nodes: nodeStyle }
  });

  const fillBytes = ( cy, id ) => {
    const slot = cy._store.lookup( id ).slot;
    const c = cy._store.column( 'node.fillColor' );

    return Array.from( c.subarray( slot * 4, slot * 4 + 4 ) );
  };

  const opacityOf = ( cy, id ) =>
    cy._store.column( 'node.opacity' )[ cy._store.lookup( id ).slot ];

  const drive = ( cy, ...times ) => { for( const t of times ){ cy._animations.tick( t ); } };

  describe('props: parse, validate, read back', function(){
    it('defaults: no properties, zero duration/delay, linear timing', function(){
      const cy = makeCy( {} );
      const a = cy.$id( 'a' );

      expect( a.style( 'transition-property' ) ).to.equal( 'none' );
      expect( a.style( 'transition-duration' ) ).to.equal( 0 );
      expect( a.style( 'transition-delay' ) ).to.equal( 0 );
      expect( a.style( 'transition-timing-function' ) ).to.equal( 'linear' );
    });

    it('reads back the configured values (list as a space-separated string)', function(){
      const cy = makeCy( {
        'transition-property': [ 'background-color', 'width' ],
        'transition-duration': 250,
        'transition-delay': 50,
        'transition-timing-function': 'ease-in-out'
      } );
      const a = cy.$id( 'a' );

      expect( a.style( 'transition-property' ) ).to.equal( 'background-color width' );
      expect( a.style( 'transition-duration' ) ).to.equal( 250 );
      expect( a.style( 'transition-delay' ) ).to.equal( 50 );
      expect( a.style( 'transition-timing-function' ) ).to.equal( 'ease-in-out' );
    });

    it('accepts the space-separated string form and none', function(){
      const cy = makeCy( { 'transition-property': 'background-color opacity', 'transition-duration': 100 } );

      expect( cy.$id( 'a' ).style( 'transition-property' ) ).to.equal( 'background-color opacity' );

      const cy2 = makeCy( { 'transition-property': 'none', 'transition-duration': 100 } );

      expect( cy2.$id( 'a' ).style( 'transition-property' ) ).to.equal( 'none' );
    });

    it('rejects unknown property names', function(){
      expect( () => makeCy( { 'transition-property': [ 'not-a-prop' ], 'transition-duration': 100 } ) )
        .to.throw( /not-a-prop/ );
    });

    it('rejects props from the wrong group', function(){
      // line-color is an edge prop; listing it in the nodes block throws
      expect( () => makeCy( { 'transition-property': [ 'line-color' ], 'transition-duration': 100 } ) )
        .to.throw( /line-color/ );
    });

    it('rejects bad durations, easings, and mapper values (constants-only)', function(){
      expect( () => makeCy( { 'transition-property': [ 'opacity' ], 'transition-duration': -5 } ) )
        .to.throw();
      expect( () => makeCy( {
        'transition-property': [ 'opacity' ], 'transition-duration': 100,
        'transition-timing-function': 'not-an-easing'
      } ) ).to.throw( /easing/ );
      expect( () => makeCy( {
        'transition-property': [ 'opacity' ],
        'transition-duration': { data: 'd' }
      } ) ).to.throw();
    });
  });

  describe('triggers', function(){
    it('sheet re-application transitions a listed color channel', function(){
      const cy = makeCy( { 'background-color': 'rgb(0,0,0)', ...TRANSITION } );

      cy.style( { nodes: { 'background-color': 'rgb(255,255,255)', ...TRANSITION } } );

      // pending: the store still holds the old value until the tween runs
      expect( fillBytes( cy, 'a' ) ).to.deep.equal( [ 0, 0, 0, 255 ] );
      expect( cy._animations.active() ).to.equal( true );

      drive( cy, 0, 50 );

      // black→white at t=0.5 in OKLab is 99 per channel (see gpu-animation.mjs)
      expect( fillBytes( cy, 'a' ).slice( 0, 3 ) ).to.deep.equal( [ 99, 99, 99 ] );

      drive( cy, 100 );
      expect( fillBytes( cy, 'a' ) ).to.deep.equal( [ 255, 255, 255, 255 ] );
      expect( cy._animations.active() ).to.equal( false );
    });

    it('an element added under a transition-configured sheet applies instantly', function(){
      const cy = makeCy( { 'background-color': 'rgb(255,0,0)', ...TRANSITION } );

      const added = cy.add( { data: { id: 'b' }, position: { x: 10, y: 10 } } );

      expect( fillBytes( cy, 'b' ) ).to.deep.equal( [ 255, 0, 0, 255 ] );
      expect( cy._animations.active() ).to.equal( false );
      expect( added.style( 'background-color' ) ).to.equal( 'rgb(255,0,0)' );
    });

    it('a case-mapper flip on a data write transitions', function(){
      const cy = makeCy( {
        'background-color': {
          case: [ { when: { data: 'status', eq: 'err' }, then: 'rgb(255,255,255)' } ],
          else: 'rgb(0,0,0)'
        },
        ...TRANSITION
      } );

      expect( fillBytes( cy, 'a' ) ).to.deep.equal( [ 0, 0, 0, 255 ] );

      cy.$id( 'a' ).data( 'status', 'err' );

      expect( fillBytes( cy, 'a' ) ).to.deep.equal( [ 0, 0, 0, 255 ] ); // pending
      expect( cy._animations.active() ).to.equal( true );

      drive( cy, 0, 50 );
      expect( fillBytes( cy, 'a' ).slice( 0, 3 ) ).to.deep.equal( [ 99, 99, 99 ] );

      drive( cy, 100 );
      expect( fillBytes( cy, 'a' ) ).to.deep.equal( [ 255, 255, 255, 255 ] );
    });

    it('a scale-mapper move on a data write transitions', function(){
      const cy = makeCy( {
        opacity: { data: 'w', domain: [ 0, 10 ], range: [ 0, 1 ] },
        'transition-property': [ 'opacity' ],
        'transition-duration': 100,
        'transition-timing-function': 'linear'
      }, [ { data: { id: 'a', w: 2 }, position: { x: 0, y: 0 } } ] );

      expect( opacityOf( cy, 'a' ) ).to.be.closeTo( 0.2, 1e-6 );

      cy.$id( 'a' ).data( 'w', 8 );

      expect( opacityOf( cy, 'a' ) ).to.be.closeTo( 0.2, 1e-6 ); // pending

      drive( cy, 0, 50 );
      expect( opacityOf( cy, 'a' ) ).to.be.closeTo( 0.5, 1e-4 );

      drive( cy, 100 );
      expect( opacityOf( cy, 'a' ) ).to.be.closeTo( 0.8, 1e-6 );
    });

    it('an auto-domain extent shift transitions the re-derived channel', function(){
      const cy = makeCy( {
        opacity: { data: 'w', range: [ 0, 1 ] }, // auto domain: live extent
        'transition-property': [ 'opacity' ],
        'transition-duration': 100,
        'transition-timing-function': 'linear'
      }, [
        { data: { id: 'a', w: 0 }, position: { x: 0, y: 0 } },
        { data: { id: 'b', w: 5 }, position: { x: 10, y: 0 } },
        { data: { id: 'c', w: 10 }, position: { x: 20, y: 0 } }
      ] );

      expect( opacityOf( cy, 'b' ) ).to.be.closeTo( 0.5, 1e-6 );

      // moving the extent to [0, 20] re-derives the whole channel: b's
      // mapping moves 0.5 → 0.25 though b's own data was never written
      cy.$id( 'c' ).data( 'w', 20 );

      expect( opacityOf( cy, 'b' ) ).to.be.closeTo( 0.5, 1e-6 ); // pending

      drive( cy, 0, 50 );
      expect( opacityOf( cy, 'b' ) ).to.be.closeTo( 0.375, 1e-4 );

      drive( cy, 100 );
      expect( opacityOf( cy, 'b' ) ).to.be.closeTo( 0.25, 1e-6 );

      // a (0 → 0) and c (1 → 1) never moved, so they never tweened
      expect( opacityOf( cy, 'a' ) ).to.equal( 0 );
      expect( opacityOf( cy, 'c' ) ).to.equal( 1 );
    });

    it('an explicit domain confines a data write to the written element', function(){
      const cy = makeCy( {
        opacity: { data: 'w', domain: [ 0, 10 ], range: [ 0, 1 ] },
        'transition-property': [ 'opacity' ],
        'transition-duration': 100,
        'transition-timing-function': 'linear'
      }, [
        { data: { id: 'a', w: 0 }, position: { x: 0, y: 0 } },
        { data: { id: 'b', w: 5 }, position: { x: 10, y: 0 } },
        { data: { id: 'c', w: 10 }, position: { x: 20, y: 0 } }
      ] );

      // out-of-range write: c clamps at 1 → no change anywhere, no tween
      cy.$id( 'c' ).data( 'w', 20 );

      expect( cy._animations.active() ).to.equal( false );
      expect( opacityOf( cy, 'b' ) ).to.be.closeTo( 0.5, 1e-6 );
      expect( opacityOf( cy, 'c' ) ).to.equal( 1 );

      // an in-range write tweens the written element only
      cy.$id( 'b' ).data( 'w', 2.5 );

      expect( cy._animations.active() ).to.equal( true );

      drive( cy, 0, 100 );
      expect( opacityOf( cy, 'b' ) ).to.be.closeTo( 0.25, 1e-6 );
      expect( opacityOf( cy, 'a' ) ).to.equal( 0 );
      expect( opacityOf( cy, 'c' ) ).to.equal( 1 );
    });

    it('a batch captures one transition per net change; batch adds are instant', function(){
      const cy = makeCy( { 'background-color': 'rgb(0,0,0)', ...TRANSITION } );

      cy.startBatch();
      cy.style( { nodes: { 'background-color': 'rgb(255,0,0)', ...TRANSITION } } );
      cy.style( { nodes: { 'background-color': 'rgb(255,255,255)', ...TRANSITION } } );
      cy.add( { data: { id: 'fresh' }, position: { x: 5, y: 5 } } );
      cy.endBatch();

      // the intermediate red never applied; the fresh element is instant
      expect( fillBytes( cy, 'a' ) ).to.deep.equal( [ 0, 0, 0, 255 ] );
      expect( fillBytes( cy, 'fresh' ) ).to.deep.equal( [ 255, 255, 255, 255 ] );

      drive( cy, 0, 50 );
      expect( fillBytes( cy, 'a' ).slice( 0, 3 ) ).to.deep.equal( [ 99, 99, 99 ] );

      drive( cy, 100 );
      expect( fillBytes( cy, 'a' ) ).to.deep.equal( [ 255, 255, 255, 255 ] );
    });

    it('a leaf→parent flip restyles through the parents overlay with a transition', function(){
      const cy = cytoscapeGpu({
        elements: [
          { data: { id: 'p' }, position: { x: 0, y: 0 } },
          { data: { id: 'c' }, position: { x: 10, y: 10 } }
        ],
        style: {
          nodes: { 'background-color': 'rgb(0,0,0)', ...TRANSITION },
          parents: { 'background-color': 'rgb(255,255,255)' }
        }
      });

      expect( fillBytes( cy, 'p' ) ).to.deep.equal( [ 0, 0, 0, 255 ] );

      cy.$id( 'c' ).move( { parent: 'p' } ); // p flips leaf → parent

      expect( fillBytes( cy, 'p' ) ).to.deep.equal( [ 0, 0, 0, 255 ] ); // pending
      expect( cy._animations.active() ).to.equal( true );

      drive( cy, 0, 50 );
      expect( fillBytes( cy, 'p' ).slice( 0, 3 ) ).to.deep.equal( [ 99, 99, 99 ] );

      drive( cy, 100 );
      expect( fillBytes( cy, 'p' ) ).to.deep.equal( [ 255, 255, 255, 255 ] );
    });

    it('show/hide never spawns a transition', function(){
      const cy = makeCy( { 'background-color': 'rgb(0,0,0)', ...TRANSITION } );

      cy.$id( 'a' ).hide();
      expect( cy._animations.active() ).to.equal( false );

      cy.$id( 'a' ).show();
      expect( cy._animations.active() ).to.equal( false );
    });

    it('zero duration means no transition machinery at all', function(){
      const cy = makeCy( {
        'background-color': 'rgb(0,0,0)',
        'transition-property': [ 'background-color' ],
        'transition-duration': 0
      } );

      cy.style( { nodes: {
        'background-color': 'rgb(255,255,255)',
        'transition-property': [ 'background-color' ],
        'transition-duration': 0
      } } );

      expect( fillBytes( cy, 'a' ) ).to.deep.equal( [ 255, 255, 255, 255 ] );
      expect( cy._animations.active() ).to.equal( false );
    });
  });

  describe('snap tiers', function(){
    it('unlisted channels snap while listed ones tween', function(){
      const cy = makeCy( {
        'background-color': 'rgb(0,0,0)',
        'border-color': 'rgb(0,0,0)',
        'border-width': 2,
        'transition-property': [ 'background-color' ],
        'transition-duration': 100,
        'transition-timing-function': 'linear'
      } );

      cy.style( { nodes: {
        'background-color': 'rgb(255,255,255)',
        'border-color': 'rgb(255,255,255)',
        'border-width': 2,
        'transition-property': [ 'background-color' ],
        'transition-duration': 100,
        'transition-timing-function': 'linear'
      } } );

      const slot = cy._store.lookup( 'a' ).slot;
      const border = cy._store.column( 'node.borderColor' );

      // border snapped instantly; fill is pending at the old value
      expect( Array.from( border.subarray( slot * 4, slot * 4 + 3 ) ) ).to.deep.equal( [ 255, 255, 255 ] );
      expect( fillBytes( cy, 'a' ) ).to.deep.equal( [ 0, 0, 0, 255 ] );
    });

    it('discrete and geometry props are accepted in the list but snap at start', function(){
      const cy = makeCy( {
        shape: 'ellipse',
        width: 30,
        height: 30,
        'background-color': 'rgb(0,0,0)',
        'transition-property': [ 'shape', 'width', 'background-color' ],
        'transition-duration': 100,
        'transition-timing-function': 'linear'
      } );

      cy.style( { nodes: {
        shape: 'rectangle',
        width: 60,
        height: 30,
        'background-color': 'rgb(255,255,255)',
        'transition-property': [ 'shape', 'width', 'background-color' ],
        'transition-duration': 100,
        'transition-timing-function': 'linear'
      } } );

      const a = cy.$id( 'a' );

      // discrete (shape) and geometry (width) snapped; the color tweens
      expect( a.style( 'shape' ) ).to.equal( 'rectangle' );
      expect( a.width() ).to.equal( 60 );
      expect( fillBytes( cy, 'a' ) ).to.deep.equal( [ 0, 0, 0, 255 ] );

      drive( cy, 0, 100 );
      expect( fillBytes( cy, 'a' ) ).to.deep.equal( [ 255, 255, 255, 255 ] );
    });
  });

  describe('interruption: latest wins, uniformly', function(){
    it('a user animation evicts a running transition and captures from its frozen value', async function(){
      const cy = makeCy( { 'background-color': 'rgb(0,0,0)', ...TRANSITION } );

      cy.style( { nodes: { 'background-color': 'rgb(255,255,255)', ...TRANSITION } } );
      drive( cy, 0, 50 );

      const frozen = fillBytes( cy, 'a' );

      expect( frozen.slice( 0, 3 ) ).to.deep.equal( [ 99, 99, 99 ] );

      const p = cy.$id( 'a' ).animation( {
        style: { 'background-color': 'rgb(255,0,0)' },
        duration: 100, easing: 'linear'
      } ).play();

      // eviction stops the transition in place: no jump at start
      expect( fillBytes( cy, 'a' ) ).to.deep.equal( frozen );

      drive( cy, 60, 160 );

      // the animation ran from the frozen value to its own target; the
      // transition's target never re-asserted itself
      expect( fillBytes( cy, 'a' ) ).to.deep.equal( [ 255, 0, 0, 255 ] );

      await p; // resolves — nothing left running
      expect( cy._animations.active() ).to.equal( false );
    });

    it('a transition evicts a running user animation (its promise resolves)', async function(){
      const cy = makeCy( { 'background-color': 'rgb(255,0,0)', ...TRANSITION } );

      const p = cy.$id( 'a' ).animation( {
        style: { 'background-color': 'rgb(0,0,0)' },
        duration: 100, easing: 'linear'
      } ).play();

      drive( cy, 0, 50 );

      const frozen = fillBytes( cy, 'a' );

      cy.style( { nodes: { 'background-color': 'rgb(255,255,255)', ...TRANSITION } } );

      await p; // the animation was evicted in place

      // the transition captured from the frozen mid-animation value
      expect( fillBytes( cy, 'a' ) ).to.deep.equal( frozen );

      drive( cy, 60, 160 );
      expect( fillBytes( cy, 'a' ) ).to.deep.equal( [ 255, 255, 255, 255 ] );
    });
  });

  describe('delay and edge channels', function(){
    it('honours transition-delay: the old value holds through the delay', function(){
      const cy = makeCy( {
        'background-color': 'rgb(0,0,0)',
        'transition-property': [ 'background-color' ],
        'transition-duration': 100,
        'transition-delay': 100,
        'transition-timing-function': 'linear'
      } );

      cy.style( { nodes: {
        'background-color': 'rgb(255,255,255)',
        'transition-property': [ 'background-color' ],
        'transition-duration': 100,
        'transition-delay': 100,
        'transition-timing-function': 'linear'
      } } );

      drive( cy, 0, 50 );
      expect( fillBytes( cy, 'a' ) ).to.deep.equal( [ 0, 0, 0, 255 ] ); // in the delay

      drive( cy, 150 );
      expect( fillBytes( cy, 'a' ).slice( 0, 3 ) ).to.deep.equal( [ 99, 99, 99 ] );

      drive( cy, 200 );
      expect( fillBytes( cy, 'a' ) ).to.deep.equal( [ 255, 255, 255, 255 ] );
    });

    it('transitions edge line-color', function(){
      const cy = cytoscapeGpu({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 100, y: 0 } },
          { data: { id: 'ab', source: 'a', target: 'b' } }
        ],
        style: { edges: {
          'line-color': 'rgb(0,0,0)',
          'transition-property': [ 'line-color' ],
          'transition-duration': 100,
          'transition-timing-function': 'linear'
        } }
      });

      cy.style( { edges: {
        'line-color': 'rgb(255,255,255)',
        'transition-property': [ 'line-color' ],
        'transition-duration': 100,
        'transition-timing-function': 'linear'
      } } );

      const slot = cy._store.lookup( 'ab' ).slot;
      const line = () => Array.from(
        cy._store.column( 'edge.lineColor' ).subarray( slot * 4, slot * 4 + 4 ) );

      expect( line() ).to.deep.equal( [ 0, 0, 0, 255 ] );

      drive( cy, 0, 50 );
      expect( line().slice( 0, 3 ) ).to.deep.equal( [ 99, 99, 99 ] );

      drive( cy, 100 );
      expect( line() ).to.deep.equal( [ 255, 255, 255, 255 ] );
    });

    it('an edge-opacity transition carries the pre-folded arrow alpha along', function(){
      const style = {
        'line-color': 'rgb(0,0,0)',
        'target-arrow-shape': 'triangle',
        'target-arrow-color': 'rgb(0,0,255)',
        opacity: 1,
        'transition-property': [ 'opacity' ],
        'transition-duration': 100,
        'transition-timing-function': 'linear'
      };
      const cy = cytoscapeGpu({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 100, y: 0 } },
          { data: { id: 'ab', source: 'a', target: 'b' } }
        ],
        style: { edges: style }
      });

      cy.style( { edges: { ...style, opacity: 0.5 } } );

      const slot = cy._store.lookup( 'ab' ).slot;
      const arrowAlpha = () => cy._store.column( 'edge.targetArrow' )[ slot * 4 + 3 ];
      const edgeOpacity = () => cy._store.column( 'edge.opacity' )[ slot ];

      expect( edgeOpacity() ).to.equal( 1 ); // pending
      expect( arrowAlpha() ).to.equal( 255 );

      drive( cy, 0, 50 );
      expect( edgeOpacity() ).to.be.closeTo( 0.75, 1e-4 );
      expect( arrowAlpha() ).to.be.closeTo( 191, 2 );

      drive( cy, 100 );
      expect( edgeOpacity() ).to.be.closeTo( 0.5, 1e-6 );
      expect( arrowAlpha() ).to.be.closeTo( 127.5, 1 );
    });
  });
});
