import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { Core } from '../src/core.mjs';

describe('gpu/core: introspection, data, scratch, renderer, aliases', function () {
  var cy;

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'n1' } },
        { data: { id: 'n2' } },
        { data: { id: 'e1', source: 'n1', target: 'n2' } },
      ],
    });
  });

  it('instanceString()', function () {
    expect(cy.instanceString()).to.equal('core');
  });

  it('isReady() true when headless', function () {
    expect(cy.isReady()).to.equal(true);
  });

  it('headless() / styleEnabled() / hasCompoundNodes()', function () {
    expect(cy.headless()).to.equal(true);
    expect(cy.styleEnabled()).to.equal(true);
    expect(cy.hasCompoundNodes()).to.equal(false);
  });

  it('hasElementWithId()', function () {
    expect(cy.hasElementWithId('n1')).to.equal(true);
    expect(cy.hasElementWithId('nope')).to.equal(false);
  });

  it('$id alias for getElementById', function () {
    expect(cy.$id('n1').id()).to.equal('n1');
    expect(cy.$id).to.equal(cy.getElementById);
  });

  it('options() returns the ctor options', function () {
    var opts = { headlessWidth: 123 };
    var cy2 = cytoscape(opts);

    expect(cy2.options()).to.equal(opts);
    expect(cy2.options().headlessWidth).to.equal(123);
  });

  it('window() is null in node', function () {
    expect(cy.window()).to.equal(null);
  });

  it('graph-level data() getter/setter + event', function () {
    var fired = 0;
    cy.on('data', () => fired++);

    cy.data('name', 'G');
    expect(cy.data('name')).to.equal('G');
    expect(cy.data()).to.deep.equal({ name: 'G' });
    expect(fired).to.equal(1);

    cy.data({ a: 1, b: 2 });
    expect(cy.data()).to.deep.equal({ name: 'G', a: 1, b: 2 });
  });

  it('graph-level removeData()', function () {
    cy.data({ a: 1, b: 2 });
    cy.removeData('a');
    expect(cy.data()).to.deep.equal({ b: 2 });

    cy.removeData();
    expect(cy.data()).to.deep.equal({});
  });

  it('attr / removeAttr aliases', function () {
    cy.attr('x', 1);
    expect(cy.attr('x')).to.equal(1);
    cy.removeAttr('x');
    expect(cy.attr('x')).to.equal(undefined);
  });

  it('scratch() does not emit and stores', function () {
    var fired = 0;
    cy.on('data', () => fired++);

    cy.scratch('_k', 5);
    expect(cy.scratch('_k')).to.equal(5);
    expect(fired).to.equal(0);

    cy.removeScratch('_k');
    expect(cy.scratch('_k')).to.equal(undefined);
  });

  it('renderer()/stats() are null when headless; resize is a no-op', function () {
    // renderer() is @internal since round 90 but stays at runtime
    expect(cy.renderer()).to.equal(null);
    expect(cy.stats()).to.equal(null);
    expect(cy.resize()).to.equal(cy);
  });

  it('resize() emits resize', function () {
    var fired = 0;
    cy.on('resize', () => fired++);
    cy.resize();
    expect(fired).to.equal(1);
  });

  it("on('render') observes frames (onRender/offRender removed, round 90)", function () {
    var fired = 0;
    var cb = () => fired++;

    cy.on('render', cb);
    cy.emit('render');
    expect(fired).to.equal(1);

    cy.off('render', cb);
    cy.emit('render');
    expect(fired).to.equal(1);
  });

  it('event aliases: once, listen/bind, unlisten/unbind, pon', function () {
    var count = 0;
    cy.once('tap', () => count++);
    cy.emit('tap');
    cy.emit('tap');
    expect(count).to.equal(1);

    expect(cy.listen).to.equal(cy.on);
    expect(cy.bind).to.equal(cy.on);
    expect(cy.unlisten).to.equal(cy.off);
    expect(cy.unbind).to.equal(cy.off);
    expect(typeof cy.pon).to.equal('function');
  });

  it('makeLayout / createLayout aliases build a layout without running it', function () {
    var layout = cy.makeLayout({ name: 'grid' });

    expect(typeof layout.run).to.equal('function');
    expect(cy.makeLayout).to.equal(cy.layout);
    expect(cy.createLayout).to.equal(cy.layout);
  });

  it('multiClickDebounceTime is a validated getter/setter with a ctor option', function () {
    var cy = cytoscape({});

    expect(cy.multiClickDebounceTime()).to.equal(250); // v3's default
    expect(cy.multiClickDebounceTime(400)).to.equal(cy);
    expect(cy.multiClickDebounceTime()).to.equal(400);
    expect(() => cy.multiClickDebounceTime(-1)).to.throw();

    var cy2 = cytoscape({ multiClickDebounceTime: 100 });

    expect(cy2.multiClickDebounceTime()).to.equal(100);
  });

  // round 30.1: the headless/rendered boundary's own guards.  The
  // README's first claim about headless mode is that "the factory
  // throws synchronously when navigator.gpu is missing", and no spec
  // had ever taken that throw — Node is exactly the environment where
  // it fires, since a container is checked before any DOM is touched.
  describe('the headless boundary throws', function () {
    it('the factory rejects a container with no WebGPU present, before doing any work', function () {
      expect(globalThis.navigator?.gpu, 'Node has no WebGPU').to.equal(
        undefined,
      );

      expect(() => cytoscape({ container: {} })).to.throw(
        /WebGPU is required to render.*omit the container option to run headless/s,
      );

      // *Before* any work is the discriminating half.  The renderer
      // attach path carries its own copy of this guard, so a spec that
      // only asserts "constructing with a container throws" passes with
      // the factory's own check deleted — measured, and it is why this
      // spec feeds a payload that would itself throw during ingest:
      // the container problem has to be the one reported.
      const badEdge = [{ group: 'edges', data: { id: 'e' } }];

      expect(() => cytoscape({ container: {}, elements: badEdge })).to.throw(
        /WebGPU is required to render/,
      );

      // control: with no container the same payload reaches ingest
      expect(() => cytoscape({ elements: badEdge })).to.throw(
        /without a source and target/,
      );

      // control: the same options without a container construct headless
      expect(cytoscape({}).headless()).to.equal(true);
    });

    it('mount() needs a container', function () {
      expect(() => cy.mount()).to.throw(/mount\(\) needs a container element/);
      expect(() => cy.mount(null)).to.throw(
        /mount\(\) needs a container element/,
      );
    });

    it('mount() refuses on a core built without the factory', function () {
      // the factory installs _attachFn; `new Core()` has no renderer
      // attach path at all, and the guard says so instead of failing
      // later with a null dereference
      expect(() => new Core({}).mount({})).to.throw(
        /cannot mount \(it was not created via the cytoscape factory\)/,
      );
    });

    it('mount() on a container reaches the same WebGPU guard', function () {
      // the factory guard fires at construction; this is the re-attach
      // path's copy of it, which is what cy.mount() after unmount() hits
      expect(() => cy.mount({})).to.throw(/WebGPU is required to render/);
    });
  });

  // Round 34.2: elements() / nodes() / edges() with no query are memoized
  // against the store's structure epoch.  These specs are about the
  // *invalidation*, which is the only part that can be wrong: a cache
  // that never dropped would pass a "returns the right elements" test on
  // a graph nobody mutated.
  describe('the unfiltered-collection memo (34.2)', function () {
    it('returns the same object while nothing structural changes', function () {
      expect(cy.elements()).to.equal(cy.elements());
      expect(cy.nodes()).to.equal(cy.nodes());
      expect(cy.edges()).to.equal(cy.edges());

      // the three are still distinct collections from each other
      expect(cy.nodes()).to.not.equal(cy.elements());
    });

    it('drops on add and on remove', function () {
      var before = cy.elements();

      var added = cy.add({ data: { id: 'n3' } });

      expect(cy.elements()).to.not.equal(before);
      expect(cy.elements().length).to.equal(4);
      expect(
        cy.nodes().map(function (n) {
          return n.id();
        }),
      ).to.include('n3');

      var afterAdd = cy.elements();

      added.remove();

      expect(cy.elements()).to.not.equal(afterAdd);
      expect(cy.elements().length).to.equal(3);
      expect(
        cy.nodes().map(function (n) {
          return n.id();
        }),
      ).to.not.include('n3');
    });

    // the hazard the epoch exists for: a *count* would read these two
    // calls as identical, and the second would answer with a dead ref
    // and no 'n4'
    it('drops when one element is added and another removed between calls', function () {
      // an isolated node, so removing it cascades no edges and the count
      // really is unchanged across the pair
      cy.add({ data: { id: 'iso' } });

      var before = cy.elements();
      var ids = before
        .map(function (e) {
          return e.id();
        })
        .sort();

      cy.add({ data: { id: 'n4' } });
      cy.$id('iso').remove();

      var after = cy.elements();

      expect(after).to.not.equal(before);
      expect(after.length).to.equal(before.length); // same count, different set
      expect(
        after
          .map(function (e) {
            return e.id();
          })
          .sort(),
      ).to.not.eql(ids);
      expect(
        after.map(function (e) {
          return e.id();
        }),
      ).to.include('n4');
      expect(
        after.map(function (e) {
          return e.id();
        }),
      ).to.not.include('iso');
    });

    it('survives a slot compaction', function () {
      cy.add(
        Array.from({ length: 40 }, function (_, i) {
          return { data: { id: 'c' + i } };
        }),
      );

      var before = cy.elements();

      cy.nodes().slice(3, 40).remove();
      cy.compact();

      var after = cy.elements();

      expect(after).to.not.equal(before);
      expect(after.length).to.equal(cy.nodes().length + cy.edges().length);

      // and the collection actually works after the remap
      after.forEach(function (e) {
        expect(e.id()).to.be.a('string');
      });
    });

    it('is not dropped by style, position or data writes — and stays live through them', function () {
      var before = cy.elements();

      cy.$id('n1').position({ x: 42, y: 7 });
      cy.$id('n1').data('k', 1);
      cy.style({ nodes: { width: 33 } });

      // same object: none of those is a structural change
      expect(cy.elements()).to.equal(before);

      // ...and it reads the new values, because a collection holds refs
      // into the columns rather than a snapshot of them
      expect(
        before
          .filter(function (e) {
            return e.id() === 'n1';
          })[0]
          .position(),
      ).to.eql({ x: 42, y: 7 });
      expect(cy.$id('n1').data('k')).to.equal(1);
      expect(cy.$id('n1').width()).to.equal(33);
    });

    it('a query argument is never memoized', function () {
      expect(cy.nodes({ selected: false })).to.not.equal(
        cy.nodes({ selected: false }),
      );
      expect(
        cy.elements(function () {
          return true;
        }),
      ).to.not.equal(
        cy.elements(function () {
          return true;
        }),
      );
    });

    it('the whole-graph memo invalidates on structure change', function () {
      // mutableElements() was removed in round 90 — it was elements()
      // by another name; the memo invariant it pinned lives on here
      expect(cy.elements()).to.equal(cy.elements());

      cy.add({ data: { id: 'n9' } });

      expect(cy.elements().length).to.equal(4);
    });
  });
});
