import { expect } from 'chai';
import { GraphStore } from '../src/store/graph-store.mjs';

// A mock renderer consuming the ModelView contract: asserts that dirty spans
// cover every mutation, that takeDelta() clears, and that growth flags a
// resize (full re-upload).

const spanFor = ( delta, column ) => delta.spans.find( s => s.column === column );

const drain = () => new Promise( resolve => setTimeout( resolve, 0 ) );

describe('gpu/store: dirty contract', function(){

  var store;

  beforeEach(function(){
    store = new GraphStore();
    store.takeDelta(); // start clean
  });

  it('starts clean after takeDelta()', function(){
    expect( store.hasDirty() ).to.be.false;
    expect( store.takeDelta().spans ).to.have.length(0);
  });

  it('covers an added node', function(){
    var n = store.addNode('a', 1, 2);
    var delta = store.takeDelta();

    var pos = spanFor(delta, 'node.position');
    var flags = spanFor(delta, 'node.flags');

    expect( pos ).to.exist;
    expect( flags ).to.exist;
    expect( pos.start ).to.be.at.most(n);
    expect( pos.end ).to.be.above(n);
  });

  it('covers an added edge', function(){
    store.addNode('a', 0, 0);
    store.addNode('b', 0, 0);
    store.takeDelta();

    var e = store.addEdge('ab', 'a', 'b');
    var delta = store.takeDelta();

    expect( spanFor(delta, 'edge.endpoints') ).to.exist;
    expect( spanFor(delta, 'edge.flags') ).to.exist;
    expect( spanFor(delta, 'edge.endpoints').start ).to.be.at.most(e);
  });

  it('coalesces to one span per column', function(){
    for( var i = 0; i < 10; i++ ){
      store.addNode('n' + i, i, i);
    }

    store.takeDelta();

    store.setPosition(2, 0, 0);
    store.setPosition(7, 0, 0);

    var delta = store.takeDelta();
    var spans = delta.spans.filter( s => s.column === 'node.position' );

    expect( spans ).to.have.length(1);
    expect( spans[0].start ).to.equal(2);
    expect( spans[0].end ).to.equal(8);
  });

  it('covers bulk position writes with a single span', function(){
    for( var i = 0; i < 5; i++ ){
      store.addNode('n' + i, 0, 0);
    }

    store.takeDelta();
    store.setPositions([1, 3], [10, 10, 30, 30]);

    var delta = store.takeDelta();
    var span = spanFor(delta, 'node.position');

    expect( span.start ).to.equal(1);
    expect( span.end ).to.equal(4);
  });

  it('takeDelta() clears accumulated spans', function(){
    store.addNode('a', 0, 0);

    expect( store.takeDelta().spans.length ).to.be.above(0);
    expect( store.takeDelta().spans ).to.have.length(0);
    expect( store.hasDirty() ).to.be.false;
  });

  it('flags a resize on growth', function(){
    var cap = store.capacity('nodes');

    for( var i = 0; i <= cap; i++ ){
      store.addNode('n' + i, 0, 0);
    }

    var delta = store.takeDelta();

    expect( delta.resized.nodes ).to.be.true;
    expect( delta.resized.edges ).to.be.false;
    expect( delta.nodeHighWater ).to.equal(cap + 1);
  });

  it('flags edge resizes independently', function(){
    store.addNode('a', 0, 0);
    store.takeDelta();

    var cap = store.capacity('edges');

    for( var i = 0; i <= cap; i++ ){
      store.addEdge('e' + i, 'a', 'a');
    }

    var delta = store.takeDelta();

    expect( delta.resized.edges ).to.be.true;
    expect( delta.resized.nodes ).to.be.false;
  });

  it('reports high waters', function(){
    store.addNode('a', 0, 0);
    store.addNode('b', 0, 0);
    store.addEdge('ab', 'a', 'b');

    var delta = store.takeDelta();

    expect( delta.nodeHighWater ).to.equal(2);
    expect( delta.edgeHighWater ).to.equal(1);
  });

  it('covers removals (tombstoned flags)', function(){
    var n = store.addNode('a', 0, 0);

    store.takeDelta();
    store.removeNode(n);

    var delta = store.takeDelta();
    var span = spanFor(delta, 'node.flags');

    expect( span ).to.exist;
    expect( span.start ).to.be.at.most(n);
    expect( span.end ).to.be.above(n);
  });

  describe('onInvalidate()', function(){
    it('fires at most once per microtask burst', async function(){
      var calls = 0;

      store.onInvalidate(function(){ calls++; });

      store.addNode('a', 0, 0);
      store.addNode('b', 0, 0);
      store.setPosition(0, 5, 5);

      await drain();

      expect( calls ).to.equal(1);
    });

    it('fires again for a later burst', async function(){
      var calls = 0;

      store.onInvalidate(function(){ calls++; });

      store.addNode('a', 0, 0);
      await drain();

      store.setPosition(0, 1, 1);
      await drain();

      expect( calls ).to.equal(2);
    });

    it('does not fire when the delta was taken synchronously', async function(){
      var calls = 0;

      store.onInvalidate(function(){ calls++; });

      store.addNode('a', 0, 0);
      store.takeDelta(); // renderer-style synchronous consumption

      await drain();

      expect( calls ).to.equal(0);
    });

    it('supports unsubscription', async function(){
      var calls = 0;
      var off = store.onInvalidate(function(){ calls++; });

      off();
      store.addNode('a', 0, 0);

      await drain();

      expect( calls ).to.equal(0);
    });
  });

});
