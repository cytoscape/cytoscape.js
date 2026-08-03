import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

/*
Round 29.3: the decided-design drops, pinned at the API boundary.

v4's most permanent decisions are the *removals* — no selector strings,
no classes, no z-index, no per-element bypass, no style functions — and
until this file they were pinned by three specs in the algorithms files.
A decision nothing asserts is a decision that comes back by accident.

Each spec below cites the ledger entry it pins (src/gpu/README.md's
"Design decisions" section and PLAN.md's decided-drops triage).

Three of these rejections did not exist before this pass; the survey
that produced this file is what found them.  A v3-style
`cy.on( 'tap', 'node', cb )` was accepted at registration and then threw
a TypeError *inside the emitter* on the next tap; a style group written
as `( ele ) => props` was silently ignored, so a ported v3 sheet gave an
unstyled graph with no error at all; and the collection methods crashed
on `other._refs` or, in `same()`'s case, quietly answered false.
*/

const graph = () => cytoscapeGpu({
  elements: [
    { data: { id: 'a' }, position: { x: 0, y: 0 } },
    { data: { id: 'b' }, position: { x: 50, y: 0 } },
    { data: { id: 'ab', source: 'a', target: 'b' } }
  ]
});

describe('gpu/decided drops (29.3)', function(){

  var cy;

  beforeEach(function(){ cy = graph(); });
  afterEach(function(){ cy.destroy(); });

  describe('no selector strings, anywhere', function(){

    // README: "v4 drops the selector language outright — there is no
    // parser, no dialect of v3 selectors, and no plan to grow one back."

    it('the query entry points reject one, naming the replacement', function(){
      const entries = [
        () => cy.filter('#a'),
        () => cy.nodes('#a'),
        () => cy.edges('#ab'),
        () => cy.elements('node'),
        () => cy.elements().filter('#a'),
        () => cy.$id('a').neighborhood('#b')
      ];

      for( const call of entries ){
        expect( call ).to.throw( /selector string/ );
      }
    });

    it('the collection methods reject one instead of crashing on _refs', function(){
      const a = cy.$id('a');
      const entries = [
        () => a.same('#a'),
        () => a.anySame('#a'),
        () => a.contains('#a'),
        () => a.allAreNeighbors('#b'),
        () => a.union('#b'),
        () => a.difference('#b'),
        () => a.intersection('#b'),
        () => a.symmetricDifference('#b'),
        () => a.diff('#b'),
        () => a.indexOf('#a'),
        () => a.edgesWith('#b'),
        () => a.edgesTo('#b')
      ];

      for( const call of entries ){
        expect( call ).to.throw( /takes a collection/ );
      }
    });

    it('same() rejects rather than answering false', function(){
      // the silent case is the dangerous one: a v3 comparison that
      // always answers "not the same" reads as working code
      expect( () => cy.$id('a').same('#a') ).to.throw( /takes a collection/ );
    });

    it('event delegation rejects one at registration, not at emit', function(){
      expect( () => cy.on( 'tap', 'node', () => {} ) ).to.throw( /predicate function/ );
      expect( () => cy.one( 'tap', 'node', () => {} ) ).to.throw( /predicate function/ );
      expect( () => cy.off( 'tap', 'node', () => {} ) ).to.throw( /predicate function/ );
    });

    it('predicate delegation is the supported form', function(){
      var hits = 0;

      cy.on( 'tap', ele => ele.isNode(), () => hits++ );
      cy.$id('a').emit('tap');
      cy.$id('ab').emit('tap');

      expect( hits ).to.equal( 1 );
    });

  });

  describe('no classes', function(){

    // README: "The role classes played in v3 ... belongs to the
    // columnar data() sidecar plus mappers and predicates."

    it('the class methods are absent from the core and collections', function(){
      for( const name of [ 'addClass', 'removeClass', 'hasClass', 'toggleClass', 'classes' ] ){
        expect( cy[ name ], `cy.${name}` ).to.equal( undefined );
        expect( cy.elements()[ name ], `eles.${name}` ).to.equal( undefined );
      }
    });

    it('cy.$ is gone (id lookup is cy.$id)', function(){
      expect( cy.$ ).to.equal( undefined );
      expect( cy.$id('a').id() ).to.equal( 'a' );
    });

  });

  describe('the sheet rejects the dropped properties', function(){

    const sheetThrows = props => () => cytoscapeGpu({ elements: [], style: { nodes: props } });

    it('z-index and its companions (decided 2026-08-01)', function(){
      for( const prop of [ 'z-index', 'z-compound-depth', 'z-index-compare' ] ){
        expect( sheetThrows({ [ prop ]: 1 } ), prop ).to.throw( /unsupported/ );
      }
    });

    it('the 2026-07-29 triage drops', function(){
      // background-blacken (subsumed by colour mappers), bounds-expansion
      // (a bb escape hatch), and the legacy aliases
      for( const prop of [ 'background-blacken', 'bounds-expansion', 'content', 'padding-left' ] ){
        expect( sheetThrows({ [ prop ]: 1 } ), prop ).to.throw( /unsupported/ );
      }
    });

    it('the no-dash shape spellings — except the recorded inconsistency', function(){
      expect( sheetThrows({ shape: 'cutrectangle' }) ).to.throw( /unsupported/ );
      expect( sheetThrows({ shape: 'concavehexagon' }) ).to.throw( /unsupported/ );

      // recorded in the README next to the shape vocabulary: this one
      // survived the same triage and is still accepted.  Pinned so the
      // inconsistency is visible rather than forgotten — when the call
      // is taken, this line is what has to change.
      const kept = cytoscapeGpu({
        elements: [ { data: { id: 'n' }, position: { x: 0, y: 0 } } ],
        style: { nodes: { shape: 'roundrectangle' } }
      });

      expect( kept.$id('n').style('shape') ).to.equal( 'round-rectangle' );
      kept.destroy();
    });

    it('the style function form', function(){
      expect( () => cytoscapeGpu({
        elements: [], style: { nodes: ele => ( { width: 10 } ) }
      }) ).to.throw( /style function form/ );
    });

  });

  describe('the other decided removals', function(){

    it('per-element style bypass (the setter form throws)', function(){
      expect( () => cy.$id('a').style( 'background-color', 'red' ) )
        .to.throw( /bypass/ );
    });

    it('cy.json( obj ) — export only', function(){
      expect( () => cy.json( {} ) ).to.throw( /export-only/ );
    });

    it('a custom easing function', function(){
      expect( () => cy.$id('a').animate( {
        position: { x: 1, y: 1 }, easing: t => t
      } ) ).to.throw( /easing function/ );
    });

    it('the animation queue and step callback (round 21)', function(){
      expect( () => cy.$id('a').animate( { position: { x: 1, y: 1 }, queue: false } ) )
        .to.throw( /queue/ );
      expect( () => cy.$id('a').animate( { position: { x: 1, y: 1 }, step: () => {} } ) )
        .to.throw( /step/ );
    });

    it('cy.gc / cytoscape.warnings / notify have no v4 counterpart', function(){
      // gc is answered by compact() (round 19); notify/noNotifications by
      // the dirty tracker's per-microtask coalescing (the batching note)
      for( const name of [ 'gc', 'warnings', 'notify', 'noNotifications' ] ){
        expect( cy[ name ], `cy.${name}` ).to.equal( undefined );
      }

      expect( typeof cy.compact ).to.equal( 'function' );
    });

  });

});
