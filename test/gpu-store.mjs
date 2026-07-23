import { expect } from 'chai';
import { GraphStore } from '../src/gpu/store/graph-store.mjs';
import {
  FLAG_ALIVE, FLAG_SELECTABLE, FLAG_SELECTED, FLAG_VISIBLE
} from '../src/gpu/contract.mjs';

describe('gpu/store: GraphStore', function(){

  var store;

  beforeEach(function(){
    store = new GraphStore();
  });

  describe('adding elements', function(){
    it('adds nodes with sequential slots', function(){
      var a = store.addNode('a', 1, 2);
      var b = store.addNode('b', 3, 4);

      expect( a ).to.equal(0);
      expect( b ).to.equal(1);
      expect( store.count('nodes') ).to.equal(2);
      expect( store.getX(a) ).to.equal(1);
      expect( store.getY(a) ).to.equal(2);
    });

    it('registers ids both ways', function(){
      var slot = store.addNode('a', 0, 0);

      expect( store.lookup('a').slot ).to.equal(slot);
      expect( store.lookup('a').group ).to.equal('nodes');
      expect( store.idAt('nodes', slot) ).to.equal('a');
    });

    it('throws on a duplicate id', function(){
      store.addNode('a', 0, 0);

      expect(function(){ store.addNode('a', 0, 0); }).to.throw();
    });

    it('throws on a duplicate id across groups', function(){
      store.addNode('a', 0, 0);
      store.addNode('b', 0, 0);

      expect(function(){ store.addEdge('a', 'a', 'b'); }).to.throw();
    });

    it('adds edges with endpoint slots', function(){
      var a = store.addNode('a', 0, 0);
      var b = store.addNode('b', 0, 0);
      var e = store.addEdge('ab', 'a', 'b');

      var endpoints = store.column('edge.endpoints');

      expect( endpoints[e * 2] ).to.equal(a);
      expect( endpoints[e * 2 + 1] ).to.equal(b);
    });

    it('throws on an edge with a missing endpoint', function(){
      store.addNode('a', 0, 0);

      expect(function(){ store.addEdge('ab', 'a', 'b'); }).to.throw();
    });

    it('sets initial flags', function(){
      var n = store.addNode('a', 0, 0);
      var flags = store.flags('nodes', n);

      expect( flags & FLAG_ALIVE ).to.not.equal(0);
      expect( flags & FLAG_VISIBLE ).to.not.equal(0);
      expect( flags & FLAG_SELECTABLE ).to.not.equal(0);
      expect( flags & FLAG_SELECTED ).to.equal(0);
    });

    it('respects selected/selectable options', function(){
      var n = store.addNode('a', 0, 0, { selected: true, selectable: false });
      var flags = store.flags('nodes', n);

      expect( flags & FLAG_SELECTED ).to.not.equal(0);
      expect( flags & FLAG_SELECTABLE ).to.equal(0);
    });
  });

  describe('adjacency', function(){
    beforeEach(function(){
      store.addNode('a', 0, 0);
      store.addNode('b', 0, 0);
      store.addNode('c', 0, 0);
      store.addEdge('ab', 'a', 'b');
      store.addEdge('bc', 'b', 'c');
    });

    it('tracks out and in edges', function(){
      var a = store.lookup('a').slot;
      var b = store.lookup('b').slot;

      expect( store.adj.outDegree(a) ).to.equal(1);
      expect( store.adj.inDegree(a) ).to.equal(0);
      expect( store.adj.outDegree(b) ).to.equal(1);
      expect( store.adj.inDegree(b) ).to.equal(1);
    });

    it('lists connected edges', function(){
      var b = store.lookup('b').slot;
      var edges = store.adj.connectedEdges(b);

      expect( edges ).to.have.length(2);
    });

    it('lists a loop edge once', function(){
      store.addEdge('aa', 'a', 'a');

      var a = store.lookup('a').slot;

      expect( store.adj.connectedEdges(a) ).to.have.length(2); // ab + aa
    });

    it('updates on edge removal', function(){
      var e = store.lookup('ab').slot;
      var a = store.lookup('a').slot;

      store.removeEdge(e);

      expect( store.adj.outDegree(a) ).to.equal(0);
      expect( store.lookup('ab') ).to.be.undefined;
    });
  });

  describe('removal and slot reuse', function(){
    it('refuses to remove a node with incident edges', function(){
      store.addNode('a', 0, 0);
      store.addNode('b', 0, 0);
      store.addEdge('ab', 'a', 'b');

      expect(function(){ store.removeNode( store.lookup('a').slot ); }).to.throw();
    });

    it('clears flags on removal (tombstone)', function(){
      var n = store.addNode('a', 0, 0);

      store.removeNode(n);

      expect( store.flags('nodes', n) ).to.equal(0);
      expect( store.count('nodes') ).to.equal(0);
    });

    it('reuses freed slots with a bumped generation', function(){
      var n = store.addNode('a', 0, 0);
      var ref = store.ref('nodes', n);

      store.removeNode(n);

      expect( store.isCurrent(ref) ).to.be.false;

      var n2 = store.addNode('b', 0, 0);

      expect( n2 ).to.equal(n); // slot reused
      expect( store.isCurrent(ref) ).to.be.false; // old ref still stale
      expect( store.isCurrent( store.ref('nodes', n2) ) ).to.be.true;
    });

    it('zeroes reused slots', function(){
      var n = store.addNode('a', 5, 6);

      store.setScalar('node.opacity', n, 1);
      store.removeNode(n);

      var n2 = store.addNode('b', 0, 0);

      expect( store.column('node.opacity')[n2] ).to.equal(0);
      expect( store.getX(n2) ).to.equal(0);
    });
  });

  describe('insertion order iteration', function(){
    it('iterates in insertion order', function(){
      store.addNode('a', 0, 0);
      store.addNode('b', 0, 0);
      store.addNode('c', 0, 0);

      var ids = store.slotsOrdered('nodes').map(function( slot ){
        return store.idAt('nodes', slot);
      });

      expect( ids ).to.deep.equal(['a', 'b', 'c']);
    });

    it('skips removed elements', function(){
      store.addNode('a', 0, 0);
      var b = store.addNode('b', 0, 0);
      store.addNode('c', 0, 0);

      store.removeNode(b);

      var ids = store.slotsOrdered('nodes').map(function( slot ){
        return store.idAt('nodes', slot);
      });

      expect( ids ).to.deep.equal(['a', 'c']);
    });

    it('re-inserts reused slots at their new position', function(){
      var a = store.addNode('a', 0, 0);
      store.addNode('b', 0, 0);

      store.removeNode(a);
      store.addNode('c', 0, 0); // reuses slot of a

      var ids = store.slotsOrdered('nodes').map(function( slot ){
        return store.idAt('nodes', slot);
      });

      expect( ids ).to.deep.equal(['b', 'c']);
    });

    it('stays correct across many removals (compaction)', function(){
      for( var i = 0; i < 100; i++ ){
        store.addNode('n' + i, i, 0);
      }

      for( var j = 0; j < 100; j += 2 ){
        store.removeNode( store.lookup('n' + j).slot );
      }

      var ids = store.slotsOrdered('nodes');

      expect( ids ).to.have.length(50);
      expect( store.idAt('nodes', ids[0]) ).to.equal('n1');
      expect( store.idAt('nodes', ids[49]) ).to.equal('n99');
    });
  });

  describe('boundingBox', function(){
    it('returns null for an empty store', function(){
      expect( store.boundingBox() ).to.equal(null);
    });

    it('bounds nodes by position, size and border', function(){
      var a = store.addNode('a', 0, 0);
      var b = store.addNode('b', 100, 50);

      store.setPair('node.size', a, 30, 30);
      store.setPair('node.size', b, 10, 20);
      store.setScalar('node.borderWidth', b, 4);

      var bb = store.boundingBox();

      expect( bb.x1 ).to.equal(-15);
      expect( bb.y1 ).to.equal(-15);
      expect( bb.x2 ).to.equal(107); // 100 + 10/2 + 4/2
      expect( bb.y2 ).to.equal(62);  // 50 + 20/2 + 4/2
      expect( bb.w ).to.equal(122);
      expect( bb.h ).to.equal(77);
    });

    it('includes edge extent (endpoint centers for straight edges)', function(){
      store.addNode('a', 0, 0);
      store.addNode('b', 100, 50);
      store.addEdge('ab', 'a', 'b');

      // straight edges span node centers, already inside the node bounds
      var bb = store.boundingBox();

      expect( bb.x1 ).to.be.at.most(0);
      expect( bb.x2 ).to.be.at.least(100);
      expect( bb.y2 ).to.be.at.least(50);
    });

    it('skips removed elements', function(){
      var a = store.addNode('a', 0, 0);
      store.addNode('b', 10, 10);
      var far = store.addNode('far', 1000, 1000);

      store.setPair('node.size', a, 0, 0);
      store.setPair('node.size', 1, 0, 0);
      store.setPair('node.size', far, 0, 0);
      store.removeNode(far);

      var bb = store.boundingBox();

      expect( bb.x2 ).to.equal(10);
      expect( bb.y2 ).to.equal(10);
    });

    it('matches the collection bounding box through the core', async function(){
      var cytoscapeGpu = (await import('../src/gpu/index.mjs')).default;
      var cy = cytoscapeGpu({
        elements: [
          { data: { id: 'a' }, position: { x: -5, y: 8 } },
          { data: { id: 'b' }, position: { x: 40, y: -20 } },
          { data: { id: 'ab', source: 'a', target: 'b' } }
        ]
      });

      expect( cy._store.boundingBox() ).to.deep.equal( cy.elements().boundingBox() );
    });
  });

  describe('growth', function(){
    it('grows capacity and preserves data', function(){
      var initialCap = store.capacity('nodes');

      for( var i = 0; i < initialCap + 1; i++ ){
        store.addNode('n' + i, i * 10, i * 20);
      }

      expect( store.capacity('nodes') ).to.equal(initialCap * 2);
      expect( store.highWater('nodes') ).to.equal(initialCap + 1);
      expect( store.getX(0) ).to.equal(0);
      expect( store.getX(initialCap) ).to.equal(initialCap * 10);
      expect( store.getY(3) ).to.equal(60);
    });
  });

  describe('channel writers', function(){
    it('writes positions in bulk', function(){
      store.addNode('a', 0, 0);
      store.addNode('b', 0, 0);

      store.setPositions([0, 1], [10, 20, 30, 40]);

      expect( store.getX(0) ).to.equal(10);
      expect( store.getY(0) ).to.equal(20);
      expect( store.getX(1) ).to.equal(30);
      expect( store.getY(1) ).to.equal(40);
    });

    it('writes colors as RGBA bytes', function(){
      var n = store.addNode('a', 0, 0);

      store.setColor('node.fillColor', n, 255, 128, 0, 255);

      var arr = store.column('node.fillColor');

      expect( Array.from( arr.slice(n * 4, n * 4 + 4) ) ).to.deep.equal([255, 128, 0, 255]);
    });

    it('sets and clears flag bits', function(){
      var n = store.addNode('a', 0, 0);

      store.setFlag('nodes', n, FLAG_SELECTED, true);
      expect( store.hasFlag('nodes', n, FLAG_SELECTED) ).to.be.true;

      store.setFlag('nodes', n, FLAG_SELECTED, false);
      expect( store.hasFlag('nodes', n, FLAG_SELECTED) ).to.be.false;
    });
  });

});
