import { expect } from 'chai';
import { GraphStore } from '../src/gpu/store/graph-store.mjs';
import { parseSelector, matchesRef } from '../src/gpu/selector.mjs';
import { FLAG_SELECTED } from '../src/gpu/contract.mjs';

describe('gpu/selector', function(){

  var store;

  var refOf = id => store.lookup(id);
  var matches = (id, sel) => matchesRef( store, refOf(id), parseSelector(sel) );

  beforeEach(function(){
    store = new GraphStore();

    store.addNode('a', 0, 0);
    store.addNode('b', 0, 0, { selected: true });
    store.addEdge('ab', 'a', 'b');
  });

  describe('parsing', function(){
    it('parses supported selectors', function(){
      expect( parseSelector('node').terms ).to.have.length(1);
      expect( parseSelector('node, edge').terms ).to.have.length(2);
      expect( parseSelector('#a:selected').terms[0] ).to.deep.equal({ id: 'a', selected: true });
      expect( parseSelector('*').terms[0] ).to.deep.equal({});
      expect( parseSelector(':unselected').terms[0] ).to.deep.equal({ selected: false });
    });

    it('throws on unsupported selectors', function(){
      expect(function(){ parseSelector('.foo'); }).to.throw();
      expect(function(){ parseSelector('node[weight > 2]'); }).to.throw();
      expect(function(){ parseSelector(':grabbed'); }).to.throw();
      expect(function(){ parseSelector('node > node'); }).to.throw();
      expect(function(){ parseSelector(''); }).to.throw();
    });
  });

  describe('matching', function(){
    it('matches by group', function(){
      expect( matches('a', 'node') ).to.be.true;
      expect( matches('a', 'edge') ).to.be.false;
      expect( matches('ab', 'edge') ).to.be.true;
      expect( matches('ab', 'node') ).to.be.false;
    });

    it('matches everything with *', function(){
      expect( matches('a', '*') ).to.be.true;
      expect( matches('ab', '*') ).to.be.true;
    });

    it('matches by id', function(){
      expect( matches('a', '#a') ).to.be.true;
      expect( matches('a', '#b') ).to.be.false;
    });

    it('matches by selection state', function(){
      expect( matches('a', ':selected') ).to.be.false;
      expect( matches('a', ':unselected') ).to.be.true;
      expect( matches('b', ':selected') ).to.be.true;
      expect( matches('b', 'node:selected') ).to.be.true;
      expect( matches('ab', 'node:selected') ).to.be.false;
    });

    it('follows live selection state', function(){
      expect( matches('a', ':selected') ).to.be.false;

      store.setFlag('nodes', refOf('a').slot, FLAG_SELECTED, true);

      expect( matches('a', ':selected') ).to.be.true;
    });

    it('matches comma lists as a disjunction', function(){
      expect( matches('a', '#b, #a') ).to.be.true;
      expect( matches('ab', 'node:selected, edge') ).to.be.true;
    });

    it('does not match stale refs', function(){
      var ref = refOf('a');
      var sel = parseSelector('node');

      store.removeEdge( refOf('ab').slot );
      store.removeNode( ref.slot );

      expect( matchesRef(store, ref, sel) ).to.be.false;
    });
  });

});
