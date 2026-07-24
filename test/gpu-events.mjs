import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

describe('gpu/events', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ]
    });
  });

  describe('core events', function(){
    it('emits and listens on the core', function(){
      var called = 0;

      cy.on('foo', function( e ){
        called++;
        expect( e.type ).to.equal('foo');
        expect( e.target ).to.equal( cy );
        expect( e.cy ).to.equal( cy );
        expect( this ).to.equal( cy );
      });

      cy.emit('foo');

      expect( called ).to.equal(1);
    });

    it('passes extra params', function(){
      var got;

      cy.on('foo', function( e, bar, baz ){ got = [bar, baz]; });
      cy.emit('foo', ['bar', 'baz']);

      expect( got ).to.deep.equal(['bar', 'baz']);
    });

    it('binds to multiple space-separated events in one call', function(){
      var called = 0;

      cy.on('foo bar', function(){ called++; });

      cy.emit('foo');
      cy.emit('bar');

      expect( called ).to.equal(2);
    });

    it('has a timeStamp on the event object', function(){
      var evt = null;

      cy.on('foo', function( e ){ evt = e; });
      cy.emit('foo');

      expect( evt.timeStamp ).to.be.a('number');
    });

    it('off() with just an event type removes every handler of that type', function(){
      var called = 0;

      cy.on('foo', function(){ called++; });
      cy.on('foo', function(){ called++; });

      cy.off('foo');
      cy.emit('foo');

      expect( called ).to.equal(0);
    });

    it('removeAllListeners() clears every listener', function(){
      var called = 0;

      cy.on('foo', function(){ called++; });
      cy.on('bar', function(){ called++; });

      cy.removeAllListeners();
      cy.emit('foo');
      cy.emit('bar');

      expect( called ).to.equal(0);
    });

    it('supports one()', function(){
      var called = 0;

      cy.one('foo', function(){ called++; });
      cy.emit('foo');
      cy.emit('foo');

      expect( called ).to.equal(1);
    });

    it('supports off()', function(){
      var called = 0;
      var handler = function(){ called++; };

      cy.on('foo', handler);
      cy.off('foo', handler);
      cy.emit('foo');

      expect( called ).to.equal(0);
    });

    it('supports promiseOn()', function(){
      var promise = cy.promiseOn('foo');

      cy.emit('foo');

      return promise.then(function( e ){
        expect( e.type ).to.equal('foo');
      });
    });
  });

  describe('predicate-qualified core listeners (delegation)', function(){
    var isNode = ele => ele.isNode();
    var isEdge = ele => ele.isEdge();

    it('restricts to matching targets', function(){
      var nodeAdds = 0;
      var edgeAdds = 0;

      cy.on('add', isNode, function(){ nodeAdds++; });
      cy.on('add', isEdge, function(){ edgeAdds++; });

      cy.add([ { data: { id: 'x' } }, { data: { id: 'y' } } ]);

      expect( nodeAdds ).to.equal(2);
      expect( edgeAdds ).to.equal(0);
    });

    it('matches remove events on just-removed elements', function(){
      var removedIds = [];

      // cached group()/id() stay readable on the removed target handle
      cy.on('remove', ele => ele.group() === 'nodes', function( e ){ removedIds.push( e.target.id() ); });

      cy.$id('a').remove();

      expect( removedIds ).to.deep.equal(['a']);
    });

    it('sets the matching element as callback context', function(){
      var ctx = null;

      cy.on('select', isNode, function(){ ctx = this; });
      cy.$id('a').select();

      expect( ctx.id() ).to.equal('a');
    });

    it('can delegate on element state', function(){
      var selectedTaps = 0;

      cy.on('foo', ele => ele.selected(), function(){ selectedTaps++; });

      cy.$id('a').emit('foo'); // unselected: no match
      cy.$id('a').select();
      cy.$id('a').emit('foo'); // selected: match

      expect( selectedTaps ).to.equal(1);
    });

    it('supports a one-shot predicate-qualified listener', function(){
      var nodeAdds = 0;

      cy.one('add', isNode, function(){ nodeAdds++; });

      cy.add([ { data: { id: 'x' } }, { data: { id: 'y' } } ]);

      expect( nodeAdds ).to.equal(1); // fires once then unbinds
    });

    it('off() with the predicate and handler removes the delegated handler', function(){
      var nodeAdds = 0;
      var cb = function(){ nodeAdds++; };

      cy.on('add', isNode, cb);
      cy.off('add', isNode, cb); // predicates compare by identity

      cy.add({ data: { id: 'x' } });

      expect( nodeAdds ).to.equal(0);
    });

    it('off() with a predicate leaves a non-delegated handler intact (#1980)', function(){
      var plain = 0;
      var delegated = 0;
      var dcb = function(){ delegated++; };

      cy.on('foo', function(){ plain++; });
      cy.on('foo', isNode, dcb);

      cy.off('foo', isNode, dcb); // remove only the delegated handler

      cy.$id('a').emit('foo'); // bubbles to the unqualified core listener

      expect( plain ).to.equal(1);
      expect( delegated ).to.equal(0);
    });

    it('does not fire predicate-qualified listeners for core-target events', function(){
      var called = 0;

      cy.on('foo', isNode, function(){ called++; });
      cy.emit('foo');

      expect( called ).to.equal(0);
    });
  });

  describe('element events', function(){
    it('listens on an element', function(){
      var called = 0;

      cy.$id('a').on('foo', function( e ){
        called++;
        expect( e.target.id() ).to.equal('a');
        expect( this.id() ).to.equal('a');
      });

      cy.$id('a').emit('foo');
      cy.$id('b').emit('foo'); // must not fire a's listener

      expect( called ).to.equal(1);
    });

    it('listens on a collection (per element)', function(){
      var targets = [];

      cy.nodes().on('foo', function( e ){ targets.push( e.target.id() ); });

      cy.nodes().emit('foo');

      expect( targets ).to.deep.equal(['a', 'b']);
    });

    it('supports one() per element', function(){
      var called = 0;

      cy.nodes().one('foo', function(){ called++; });

      cy.$id('a').emit('foo');
      cy.$id('a').emit('foo');
      cy.$id('b').emit('foo');

      expect( called ).to.equal(2); // once for a, once for b
    });

    it('supports off()', function(){
      var called = 0;

      cy.$id('a').on('foo', function(){ called++; });
      cy.$id('a').off('foo');
      cy.$id('a').emit('foo');

      expect( called ).to.equal(0);
    });

    it('passes extra params to an element listener', function(){
      var got;

      cy.$id('a').on('foo', function( e, x, y ){ got = [x, y]; });
      cy.$id('a').trigger('foo', ['bar', 'baz']);

      expect( got ).to.deep.equal(['bar', 'baz']);
    });

    it('supports promiseOn() on an element', function(){
      var promise = cy.$id('a').promiseOn('foo');

      cy.$id('a').emit('foo');

      return promise.then(function( e ){
        expect( e.target.id() ).to.equal('a');
      });
    });

    it('bubbles an element emit to an unqualified core listener', function(){
      var called = 0;

      cy.on('foo', function( e ){
        called++;
        expect( e.target.id() ).to.equal('a');
      });

      cy.$id('a').emit('foo');

      expect( called ).to.equal(1);
    });

    it('bubbles extra params to a core listener', function(){
      var got;

      cy.on('foo', function( e, x, y ){ got = [x, y]; });
      cy.$id('a').trigger('foo', ['bar', 'baz']);

      expect( got ).to.deep.equal(['bar', 'baz']);
    });

    it('auto-emits data when an element data() setter runs', function(){
      var called = 0;

      cy.$id('a').on('data', function(){ called++; });
      cy.$id('a').data('k', 'v');

      expect( called ).to.equal(1);
    });

    it('does not fire for a reused slot after removal', function(){
      var called = 0;
      var a = cy.$id('a');

      a.on('foo', function(){ called++; });

      cy.$id('ab').remove();
      a.remove();

      var fresh = cy.add({ data: { id: 'a2' } }); // may reuse a's slot

      fresh.emit('foo');

      expect( called ).to.equal(0);
    });
  });

  describe('lifecycle events', function(){
    it('emits destroy', function(){
      var called = 0;

      cy.on('destroy', function(){ called++; });
      cy.destroy();

      expect( called ).to.equal(1);
      expect( cy.destroyed() ).to.be.true;
    });
  });

});
