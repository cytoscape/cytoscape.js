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

    // round 30.1: two enforcement points this file missed.  Both reject
    // a selector string, and neither rejection had ever run — measured
    // by source-mapped coverage of the Node suite, not by inspection.
    it("the traversals reject one in the positional form too", function(){
      // the options form is pinned by the algorithms specs; the
      // positional spelling is a second guard eight lines further down
      // the same function, and nothing had taken it
      for( const call of [
        () => cy.elements().bfs('#a'),
        () => cy.elements().dfs('#a'),
        () => cy.elements().breadthFirstSearch('#a'),
        () => cy.elements().depthFirstSearch('#a')
      ] ){
        expect( call ).to.throw( /must be a collection/ );
      }

      // control: the collection form of the same call runs
      expect( cy.elements().bfs( cy.$id('a') ).path.length ).to.be.greaterThan( 0 );
    });

    it('the breadthfirst layout rejects one as its roots', function(){
      // the layout resolves its roots when it runs, not when it is made
      expect( () => cy.layout({ name: 'breadthfirst', roots: '#a' }).run() )
        .to.throw( /must be a collection or an array of node ids/ );

      // control: both supported spellings are accepted
      expect( () => cy.layout({ name: 'breadthfirst', roots: cy.$id('a') }).run() ).to.not.throw();
      expect( () => cy.layout({ name: 'breadthfirst', roots: [ 'a' ] }).run() ).to.not.throw();
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

    it('the no-dash shape spellings', function(){
      expect( sheetThrows({ shape: 'cutrectangle' }) ).to.throw( /unsupported/ );
      expect( sheetThrows({ shape: 'concavehexagon' }) ).to.throw( /unsupported/ );

      // round 37.2: and `roundrectangle`, which survived the same 2026-07-29
      // triage in the code for eight rounds while its two siblings threw.
      // The inconsistency was pinned here rather than patched, because
      // removing public API is the maintainer's call; the fifth design
      // sitting took it, and the triage is now enforced as written.
      expect( sheetThrows({ shape: 'roundrectangle' }) ).to.throw( /unsupported/ );

      // the hyphenated spelling is the one name for the concept
      const kept = cytoscapeGpu({
        elements: [ { data: { id: 'n' }, position: { x: 0, y: 0 } } ],
        style: { nodes: { shape: 'round-rectangle' } }
      });

      expect( kept.$id('n').style('shape') ).to.equal( 'round-rectangle' );
      kept.destroy();
    });

    it('the no-dash spelling in every enum that took it, not only `shape`', function(){
      // it was accepted in three places — the node shape, the overlay/
      // underlay shape, and the text background shape — so dropping it from
      // one would have moved the inconsistency rather than closed it
      expect( sheetThrows({ 'overlay-shape': 'roundrectangle' }) ).to.throw( /invalid/ );
      expect( sheetThrows({ 'text-background-shape': 'roundrectangle' }) ).to.throw( /invalid/ );

      expect( sheetThrows({ 'overlay-shape': 'round-rectangle' }) ).to.not.throw();
      expect( sheetThrows({ 'text-background-shape': 'round-rectangle' }) ).to.not.throw();
    });

    it('the shape error stops advertising the dropped spelling', function(){
      // the message lists the accepted keywords from the table itself, so
      // this follows from the drop — and is worth asserting, since a v3 user
      // hitting the throw reads this list to find the replacement
      expect( sheetThrows({ shape: 'nonsense' }) ).to.throw( /round-rectangle/ );
      expect( sheetThrows({ shape: 'nonsense' }) ).to.not.throw( /[^-]roundrectangle/ );
    });

    it('the style function form', function(){
      expect( () => cytoscapeGpu({
        elements: [], style: { nodes: ele => ( { width: 10 } ) }
      }) ).to.throw( /style function form/ );
    });

  });

  /*
  Round 37.4.  The dropped v3 *event names* are the other half of the same
  asymmetry, and the sitting decided they stay open: custom events are
  supported API (`ele.emit( 'foo' )`), so a name cannot be validated against a
  list without breaking them.  No denylist, no code — but the behaviour is now
  documented on `on()`/`emit()`, and a documented contract this repo does not
  assert is one that comes back by accident.

  What these pin is deliberately the *silent* outcome: registration succeeds
  and the handler never runs.  That is the failure mode a v3 app hits when it
  is ported, and it is why the JSDoc tells readers to port event names from
  the vocabulary rather than by trying them.
  */
  describe('dropped v3 event names register and never fire (round 17)', function(){

    it('registers the vmouse aliases and the raw mouse/touch re-emits', function(){
      let fired = 0;

      for( const name of [ 'vmousedown', 'mousedown', 'click', 'touchstart' ] ){
        expect( () => cy.on( name, () => fired++ ), name ).to.not.throw();
      }

      cy.$id('a').emit('tap');
      cy.emit('tap');

      expect( fired, 'a dropped v3 name fired' ).to.equal( 0 );
    });

    /*
    Namespaces, measured rather than assumed — and the measurement corrected
    this file's own record.  PLAN.md's contradiction 11 said `cy.on( 'tap.ns',
    h )` "never fires, not for `tap` and not for `tap.ns` either", and the
    README said the shared emitter keeps namespace parsing "only for v3".
    Both are wrong: v4 imports v3's emitter, so namespaces work in full v3
    semantics.  What is true is narrower and is what these assert — v4 never
    emits a *qualified* name, so a namespaced listener sees library events
    never and user emits normally.  Round 41 removes the machinery.
    */
    it('parses namespaces in full v3 semantics, since it shares v3s emitter', function(){
      let ns = 0;
      let plain = 0;

      cy.on( 'tap.ns', () => ns++ );
      cy.on( 'tap', () => plain++ );

      // an unqualified emit runs unqualified listeners only
      cy.emit( 'tap' );
      expect( [ plain, ns ] ).to.deep.equal( [ 1, 0 ] );

      // a qualified emit runs the matching namespace *and* the plain listener
      cy.emit( 'tap.ns' );
      expect( [ plain, ns ] ).to.deep.equal( [ 2, 1 ] );

      // a different namespace does not match
      cy.emit( 'tap.other' );
      expect( [ plain, ns ] ).to.deep.equal( [ 3, 1 ] );

      // and off() takes the qualified name
      cy.off( 'tap.ns' );
      cy.emit( 'tap.ns' );
      expect( [ plain, ns ] ).to.deep.equal( [ 4, 1 ] );
    });

    it('never fires a namespaced listener for an event v4 itself raises', function(){
      // the half that is actually true, and the half a ported app feels:
      // every event the library emits is unqualified, so `.ns` sees none of
      // them.  A data write emits 'data'.
      let namespaced = 0;
      let plain = 0;

      cy.$id('a').on( 'data.ns', () => namespaced++ );
      cy.$id('a').on( 'data', () => plain++ );
      cy.$id('a').data( 'weight', 1 );

      expect( plain, 'the unqualified listener should see the library event' ).to.equal( 1 );
      expect( namespaced, 'v4 emitted a qualified event name' ).to.equal( 0 );
    });

    it('fires a custom name, which is why none of them can be gated', function(){
      let custom = 0;

      cy.on( 'myevent', () => custom++ );
      cy.emit( 'myevent' );

      expect( custom ).to.equal( 1 );

      let onEle = 0;

      cy.$id('a').on( 'myeleevent', () => onEle++ );
      cy.$id('a').emit( 'myeleevent' );

      expect( onEle ).to.equal( 1 );
    });

  });

  /*
  Round 37.3.  The dropped *style props* above all throw; the dropped
  constructor *options* deliberately do not, and that asymmetry is a decision
  rather than an oversight — the fifth design sitting settled that strictness
  at the constructor resolves at the type layer, since tsc's excess-property
  check already rejects `{ motionBlur: true }` and v4 should not re-implement
  at runtime what the build checks.  It was found as a contradiction (round 29)
  and logged rather than patched, so what pins it now is a spec for each half:
  this one for the runtime, and `typescript/tests/gpu.test-d.ts` for the build,
  where four @ts-expect-error directives fail the typecheck if the options type
  ever stops rejecting excess keys.
  */
  describe('the constructor is permissive on purpose', function(){

    it('ignores the dropped canvas-era options rather than throwing', function(){
      for( const opt of [ 'motionBlur', 'hideEdgesOnViewport', 'textureOnViewport' ] ){
        const permissive = cytoscapeGpu({ elements: [], [ opt ]: true });

        expect( permissive.instanceString(), opt ).to.be.a( 'string' );
        permissive.destroy();
      }
    });

    it('ignores a plain typo, and round-trips it through options()', function(){
      const permissive = cytoscapeGpu({ elements: [], totallyUnknownOption: 1 });

      // kept as given: options() is a record of what was passed, not a
      // validated subset — the boundary this decision draws
      expect( permissive.options().totallyUnknownOption ).to.equal( 1 );
      permissive.destroy();
    });

    it('still throws on the unknown names that are v4 contract', function(){
      // the contrast the decision rests on: keys v4 *interprets* fail loudly
      expect( () => cytoscapeGpu({ elements: [], style: { nodes: { notAProp: 1 } } }) )
        .to.throw( /unsupported/ );
      expect( () => cytoscapeGpu({ elements: [], style: { notAGroup: {} } }) ).to.throw();
      expect( () => cy.nodes({ notAQueryKey: true }) ).to.throw();
    });

  });

  describe('the other decided removals', function(){

    it('per-element style bypass (the setter form throws)', function(){
      expect( () => cy.$id('a').style( 'background-color', 'red' ) )
        .to.throw( /bypass/ );
    });

    // round 31.1: the message has to name a replacement that works.  It
    // used to say "use the function form of the stylesheet", which round
    // 8 removed and 29.3 made throw — so following the error produced a
    // second error.  The spec asserts both halves: what it now says, and
    // that the advice actually runs.
    it('the bypass error names a replacement that v4 accepts', function(){
      var message;

      try { cy.$id('a').style( 'background-color', 'red' ); }
      catch ( e ){ message = e.message; }

      expect( message ).to.match( /case.*mapper|mapper/ );
      expect( message, 'must not send the caller at a removed form' )
        .to.not.match( /function form/ );

      // and the form it names is accepted
      expect( () => cytoscapeGpu({
        elements: [ { data: { id: 'a', kind: 'x' } } ],
        style: { nodes: { 'background-color': {
          case: [ { when: { data: 'kind', eq: 'x' }, then: 'red' } ], else: 'blue'
        } } }
      }) ).to.not.throw();
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

    it('notify / noNotifications have no v4 counterpart', function(){
      // the dirty tracker coalesces per microtask, which fires after a
      // batch's synchronous block anyway — so there is nothing for
      // notify()/noNotifications() to suspend (the batching note)
      for( const name of [ 'notify', 'noNotifications' ] ){
        expect( cy[ name ], `cy.${name}` ).to.equal( undefined );
      }
    });

    it('cy.gc is back as the alias of compact (round 39.3)', function(){
      // it was listed here as having no counterpart, on the reasoning that
      // compact() answers what gc meant.  The fifth design sitting kept the
      // *name* on top of that reasoning rather than against it: an upgrading
      // app already types `gc`, and v4 has no separate garbage-collection
      // concept for it to mean instead.
      expect( cy.gc ).to.equal( cy.compact );
      expect( cy.gc() ).to.equal( cy );
    });

    it('cytoscape.warnings is still absent, pending the error policy', function(){
      // the one part of the ledger the fifth sitting left open: it builds
      // in round 40, whose sitting decides its shape (a boolean silencer,
      // or an options form that can demote recoverable throws)
      expect( cytoscapeGpu.warnings ).to.equal( undefined );
      expect( cy.warnings ).to.equal( undefined );
    });

  });

});
