var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);

describe('Heap', function () {

  var cy;
  var a, b, c, d, e;

  var valueFn = function(node) {
    var dict = {
      'a': 1,
      'b': 1,
      'c': 2,
      'd': 3,
      'e': 5
    };
    return dict[node.id()] || 1;
  };

  var minh1, minh2, minh3, maxh1, maxh2, maxh3, cheap, eheap;
  
  // TODO may have to remove this in future as it references private data (too fragile if impl changes)
  var checkInternalDataLength = function(heap) { 
    var pointersLength = 0;
    var pointers = heap._private.pointers;

    for( var i in pointers ){
      if( pointers[i] !== undefined ){
        pointersLength++;
      }
    }

    var ret = heap._private.length === heap._private.heap.length && heap._private.length === heap._private.elements.length && heap._private.length === pointersLength;
  
    if( !ret ) debugger;

    return ret;
  };

  /* graph is taken from collection-algorithms.js test */
  beforeEach(function(done){
    cytoscape({
      elements: {
        nodes: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'c' } },
          { data: { id: 'd' } },
          { data: { id: 'e' } }
        ], 
        
        edges: [
          { data: { id: 'ae', weight: 1, source: 'a', target: 'e' } },
          { data: { id: 'ab', weight: 3, source: 'a', target: 'b' } },
          { data: { id: 'be', weight: 4, source: 'b', target: 'e' } },
          { data: { id: 'bc', weight: 5, source: 'b', target: 'c' } },
          { data: { id: 'ce', weight: 6, source: 'c', target: 'e' } },
          { data: { id: 'cd', weight: 2, source: 'c', target: 'd' } },
          { data: { id: 'de', weight: 7, source: 'd', target: 'e' } }
        ]
      },
      ready: function(){
        cy = this;

        a = cy.getElementById('a');
        b = cy.getElementById('b');
        c = cy.getElementById('c');
        d = cy.getElementById('d');
        e = cy.getElementById('e');
          
        minh1 = new cytoscape.Minheap(cy, a, valueFn);
        minh2 = new cytoscape.Minheap(cy, ['a', 'b', 'c', 'd'], valueFn);
        minh3 = new cytoscape.Minheap(cy, new cytoscape.Collection(cy, [a, b, c, d, e]), valueFn);
          
        maxh1 = new cytoscape.Maxheap(cy, 'c', valueFn);
        maxh2 = new cytoscape.Maxheap(cy, ['c', 'b', 'e'], valueFn);
        maxh3 = new cytoscape.Maxheap(cy, new cytoscape.Collection(cy, [a, b, c, d, e]), valueFn);
          
        cheap = new cytoscape.Heap(cy, 'c', cytoscape.Heap.minHeapComparator); // id as key
        eheap = new cytoscape.Heap(cy, '1', cytoscape.Heap.minHeapComparator); // empty heap

        done();
      }
    });
  });

  it('constructs', function () {
    expect(minh1.isHeap()).to.be.true;
    expect(minh1.size()).is.equals(1);
    
    expect(minh2.isHeap()).to.be.true;
    expect(minh2.size()).is.equals(4);
    
    expect(minh3.isHeap()).to.be.true;
    expect(minh3.size()).is.equals(5);
    
    expect(maxh1.isHeap()).to.be.true;
    expect(maxh1.size()).is.equals(1);
    
    expect(maxh2.isHeap()).to.be.true;
    expect(maxh2.size()).is.equals(3);
    
    expect(maxh3.isHeap()).to.be.true;
    expect(maxh3.size()).is.equals(5);
    
    expect(cheap.isHeap()).to.be.true;
    expect(cheap.size()).is.equals(1);
    
    expect(eheap.isHeap()).to.be.true;
    expect(eheap.size()).is.equals(0);
  });

  it('inserts', function () {
    minh1.insert(b);
    expect(minh1.isHeap()).to.be.true;
    expect(minh1.size() == 2).to.be.true;
    expect(checkInternalDataLength(minh1)).to.be.true;
    
    minh2.insert('e');
    expect(minh2.isHeap()).to.be.true;
    expect(minh2.size() == 5).to.be.true;
    expect(checkInternalDataLength(minh2)).to.be.true;
    
    maxh1.insert(['b', 'e', 'd']);
    expect(maxh1.isHeap()).to.be.true;
    expect(maxh1.size() == 4).to.be.true;
    expect(checkInternalDataLength(maxh1)).to.be.true;
    
    maxh2.insert(new cytoscape.Collection(cy, [a, d]));
    expect(maxh2.isHeap()).to.be.true;
    expect(maxh2.size() == 5).to.be.true;
    expect(checkInternalDataLength(maxh2)).to.be.true;
    
    cheap.insert('e');
    expect(cheap.isHeap()).to.be.true;
    expect(cheap.size() == 2).to.be.true;
    expect(checkInternalDataLength(cheap)).to.be.true;
    
    eheap.insert(['e', 'a', 'x']);
    expect(eheap.isHeap()).to.be.true;
    expect(eheap.size() == 2).to.be.true;
    expect(checkInternalDataLength(eheap)).to.be.true;
  });

  it('gets top element', function () {
    var prev = minh3.pop();
    expect(minh3.isHeap()).to.be.true;
    expect(prev.value).to.be.equals(1);
    expect(checkInternalDataLength(minh3)).to.be.true;
    
    while(minh3.size() > 0) {
        var curr = minh3.pop();
        expect(curr.value).to.be.at.least(prev.value);
        prev = curr;
    }
    
    prev = maxh3.pop();
    expect(maxh3.isHeap()).to.be.true;
    expect(prev.value).to.be.equals(5);
    expect(checkInternalDataLength(maxh3)).to.be.true;
    
    while(maxh3.size() > 0) {
        var curr = maxh3.pop();
        expect(curr.value).to.be.at.most(prev.value);
        prev = curr;
    }
    
    eheap.pop();
    expect(eheap.isHeap()).to.be.true;
    expect(checkInternalDataLength(eheap)).to.be.true;
  });

  it('contains', function () {
    expect(minh1.contains('a')).to.be.true;
    
    expect(maxh1.contains(['a', 'c'])).to.be.false;
    
    expect(eheap.contains(a)).to.be.false;
    
    expect(maxh3.contains(new cytoscape.Collection(cy, [a, b, c]))).to.be.true;
  });

  it('gets elements', function () {
    expect(minh1.getValueById('a')).is.equals(1);
    
    expect(maxh3.getValueById('e')).is.equals(5);
    
    expect(cheap.getValueById('c')).is.equals('c');
  });

  it('edits elements', function () {
    minh3.edit('e', 50);
    expect(minh3.getValueById('e')).is.equals(50);
    expect(minh3.isHeap()).to.be.true;
    
    minh2.edit(b, -1);
    expect(minh2.getValueById('b')).is.equals(-1);
    expect(minh2.isHeap()).to.be.true;
    expect(minh2.top()).to.have.property('value').that.is.equals(-1);
    expect(checkInternalDataLength(minh2)).to.be.true;
    
    maxh3.edit(new cytoscape.Collection(cy, [b, c]), function(oldValue) { return 100 + oldValue; });
    expect(maxh3.getValueById('c')).is.equals(102);
    expect(maxh3.isHeap()).to.be.true;
    expect(maxh3.top()).to.have.property('value').that.is.equals(102);
    
    maxh1.edit(['e', 'd'], 100);
    expect(maxh1.size()).is.equals(1);
    expect(maxh1.isHeap()).to.be.true;
    expect(maxh1.top()).to.have.property('value').that.is.equals(2);
      
  });

  it('removes elements', function () {
    minh3.delete(new cytoscape.Collection(cy, [a, b, c]));
    expect(minh3.isHeap()).to.be.true;
    expect(minh3.size()).is.equals(2);
    expect(minh3.top()).to.have.property('value').that.is.equals(3);
    expect(checkInternalDataLength(minh3)).to.be.true;
    
    maxh2.delete(['b', 'e']);
    expect(maxh2.isHeap()).to.be.true;
    expect(maxh2.size()).is.equals(1);
    expect(maxh2.top()).to.have.property('value').that.is.equals(2);
    expect(checkInternalDataLength(maxh2)).to.be.true;
    
    cheap.delete(c);
    expect(cheap.isHeap()).to.be.true;
    expect(cheap.size()).is.equals(0);
    expect(cheap.top()).to.be.undefined;
    expect(checkInternalDataLength(cheap)).to.be.true;
  });

});