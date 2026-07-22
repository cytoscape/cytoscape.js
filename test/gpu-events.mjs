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

    it('supports namespaces (v3 semantics)', function(){
      var ns = 0;
      var plain = 0;

      cy.on('foo.ns', function(){ ns++; });
      cy.on('foo', function(){ plain++; });

      cy.emit('foo.ns'); // fires both
      expect( ns ).to.equal(1);
      expect( plain ).to.equal(1);

      cy.emit('foo'); // unnamespaced emit does not fire namespaced listeners
      expect( ns ).to.equal(1);
      expect( plain ).to.equal(2);

      cy.off('foo.ns');
      cy.emit('foo.ns');
      expect( ns ).to.equal(1);
      expect( plain ).to.equal(3);
    });

    it('supports promiseOn()', function(){
      var promise = cy.promiseOn('foo');

      cy.emit('foo');

      return promise.then(function( e ){
        expect( e.type ).to.equal('foo');
      });
    });
  });

  describe('selector-qualified core listeners', function(){
    it('restricts to matching targets', function(){
      var nodeAdds = 0;
      var edgeAdds = 0;

      cy.on('add', 'node', function(){ nodeAdds++; });
      cy.on('add', 'edge', function(){ edgeAdds++; });

      cy.add([ { data: { id: 'x' } }, { data: { id: 'y' } } ]);

      expect( nodeAdds ).to.equal(2);
      expect( edgeAdds ).to.equal(0);
    });

    it('matches remove events on just-removed elements', function(){
      var removedIds = [];

      cy.on('remove', 'node', function( e ){ removedIds.push( e.target.id() ); });

      cy.$('#a').remove();

      expect( removedIds ).to.deep.equal(['a']);
    });

    it('sets the matching element as callback context', function(){
      var ctx = null;

      cy.on('select', 'node', function(){ ctx = this; });
      cy.$('#a').select();

      expect( ctx.id() ).to.equal('a');
    });

    it('does not fire selector-qualified listeners for core-target events', function(){
      var called = 0;

      cy.on('foo', 'node', function(){ called++; });
      cy.emit('foo');

      expect( called ).to.equal(0);
    });
  });

  describe('element events', function(){
    it('listens on an element', function(){
      var called = 0;

      cy.$('#a').on('foo', function( e ){
        called++;
        expect( e.target.id() ).to.equal('a');
        expect( this.id() ).to.equal('a');
      });

      cy.$('#a').emit('foo');
      cy.$('#b').emit('foo'); // must not fire a's listener

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

      cy.$('#a').emit('foo');
      cy.$('#a').emit('foo');
      cy.$('#b').emit('foo');

      expect( called ).to.equal(2); // once for a, once for b
    });

    it('supports off()', function(){
      var called = 0;

      cy.$('#a').on('foo', function(){ called++; });
      cy.$('#a').off('foo');
      cy.$('#a').emit('foo');

      expect( called ).to.equal(0);
    });

    it('does not fire for a reused slot after removal', function(){
      var called = 0;
      var a = cy.$('#a');

      a.on('foo', function(){ called++; });

      cy.$('#ab').remove();
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
