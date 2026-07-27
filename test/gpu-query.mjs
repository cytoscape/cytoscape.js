import { expect } from 'chai';
import { GraphStore } from '../src/gpu/store/graph-store.mjs';
import { compileQuery, planMatchesRef, MATCH_ALL } from '../src/gpu/matcher.mjs';
import { FLAG_SELECTED } from '../src/gpu/contract.mjs';

describe('gpu/matcher', function(){

  var store;

  var refOf = id => store.lookup(id);
  var matches = (id, query) => planMatchesRef( store, refOf(id), compileQuery(query) );

  beforeEach(function(){
    store = new GraphStore();

    store.addNode('a', 0, 0);
    store.addNode('b', 0, 0, { selected: true });
    store.addEdge('ab', 'a', 'b');
  });

  describe('compileQuery', function(){
    it('compiles the empty query to per-group match-alls', function(){
      expect( compileQuery({}) ).to.deep.equal({ nodes: MATCH_ALL, edges: MATCH_ALL, data: null });
    });

    it('compiles group restrictions', function(){
      expect( compileQuery({ group: 'nodes' }) ).to.deep.equal({ nodes: MATCH_ALL, edges: null, data: null });
      expect( compileQuery({ group: 'edges' }) ).to.deep.equal({ nodes: null, edges: MATCH_ALL, data: null });
    });

    it('compiles selected to FLAG_SELECTED tests', function(){
      expect( compileQuery({ group: 'nodes', selected: true }) ).to.deep.equal({
        nodes: { mask: FLAG_SELECTED, want: FLAG_SELECTED }, edges: null, data: null
      });
      expect( compileQuery({ selected: false }) ).to.deep.equal({
        nodes: { mask: FLAG_SELECTED, want: 0 },
        edges: { mask: FLAG_SELECTED, want: 0 },
        data: null
      });
    });

    it('narrows to the restrict group', function(){
      expect( compileQuery({}, 'nodes') ).to.deep.equal({ nodes: MATCH_ALL, edges: null, data: null });
      expect( compileQuery({ selected: true }, 'edges') ).to.deep.equal({
        nodes: null, edges: { mask: FLAG_SELECTED, want: FLAG_SELECTED }, data: null
      });
    });

    it('compiles a contradicting group + restrict to a match-nothing plan', function(){
      expect( compileQuery({ group: 'edges' }, 'nodes') ).to.deep.equal({ nodes: null, edges: null, data: null });
    });

    it('throws on unknown query keys', function(){
      expect(function(){ compileQuery({ selectd: true }); }).to.throw(/Unknown query key/);
      expect(function(){ compileQuery({ classes: 'foo' }); }).to.throw(/Unknown query key/);
    });

    it('throws on unknown groups', function(){
      expect(function(){ compileQuery({ group: 'node' }); }).to.throw(/Unknown query group/);
    });
  });

  describe('planMatchesRef', function(){
    it('matches by group', function(){
      expect( matches('a', { group: 'nodes' }) ).to.be.true;
      expect( matches('a', { group: 'edges' }) ).to.be.false;
      expect( matches('ab', { group: 'edges' }) ).to.be.true;
      expect( matches('ab', { group: 'nodes' }) ).to.be.false;
    });

    it('matches everything with the empty query', function(){
      expect( matches('a', {}) ).to.be.true;
      expect( matches('ab', {}) ).to.be.true;
    });

    it('matches by selection state', function(){
      expect( matches('a', { selected: true }) ).to.be.false;
      expect( matches('a', { selected: false }) ).to.be.true;
      expect( matches('b', { selected: true }) ).to.be.true;
      expect( matches('b', { group: 'nodes', selected: true }) ).to.be.true;
      expect( matches('ab', { group: 'nodes', selected: true }) ).to.be.false;
    });

    it('follows live selection state', function(){
      expect( matches('a', { selected: true }) ).to.be.false;

      store.setFlag('nodes', refOf('a').slot, FLAG_SELECTED, true);

      expect( matches('a', { selected: true }) ).to.be.true;
    });

    it('does not match stale refs', function(){
      var ref = refOf('a');
      var plan = compileQuery({ group: 'nodes' });

      store.removeEdge( refOf('ab').slot );
      store.removeNode( ref.slot );

      expect( planMatchesRef(store, ref, plan) ).to.be.false;
    });
  });

});
