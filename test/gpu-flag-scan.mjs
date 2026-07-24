import { expect } from 'chai';
import { GraphStore } from '../src/gpu/store/graph-store.mjs';
import { parseSelector, compileFlagPlan } from '../src/gpu/selector.mjs';
import { FLAG_SELECTED } from '../src/gpu/contract.mjs';
import cytoscapeGpu from '../src/gpu/index.mjs';

describe('gpu/flag-scan', function(){

  describe('compileFlagPlan', function(){
    var plan = sel => compileFlagPlan( parseSelector(sel) );

    it('compiles group heads to per-group match-alls', function(){
      expect( plan('node') ).to.deep.equal({ nodes: { mask: 0, want: 0 }, edges: null });
      expect( plan('edge') ).to.deep.equal({ nodes: null, edges: { mask: 0, want: 0 } });
      expect( plan('*') ).to.deep.equal({ nodes: { mask: 0, want: 0 }, edges: { mask: 0, want: 0 } });
    });

    it('compiles selection pseudos to FLAG_SELECTED tests', function(){
      expect( plan('node:selected') ).to.deep.equal({
        nodes: { mask: FLAG_SELECTED, want: FLAG_SELECTED }, edges: null
      });
      expect( plan(':unselected') ).to.deep.equal({
        nodes: { mask: FLAG_SELECTED, want: 0 },
        edges: { mask: FLAG_SELECTED, want: 0 }
      });
    });

    it('unions comma-list terms per group', function(){
      expect( plan('node:selected, edge') ).to.deep.equal({
        nodes: { mask: FLAG_SELECTED, want: FLAG_SELECTED },
        edges: { mask: 0, want: 0 }
      });

      // selected ∪ unselected collapses to match-all
      expect( plan('node:selected, node:unselected') ).to.deep.equal({
        nodes: { mask: 0, want: 0 }, edges: null
      });
    });

    it('returns null when any term pins an id', function(){
      expect( plan('#a') ).to.be.null;
      expect( plan('#a, node') ).to.be.null;
    });
  });

  describe('GraphStore.scanRefsInto', function(){
    var store;

    beforeEach(function(){
      store = new GraphStore();

      store.addNode('a', 0, 0);
      store.addNode('b', 0, 0, { selected: true });
      store.addNode('c', 0, 0);
      store.addEdge('ab', 'a', 'b');
    });

    var scan = (group, mask, want) => {
      var out = new Array( store.count(group) );
      var n = store.scanRefsInto( out, 0, group, mask, want );

      out.length = n;

      return out;
    };

    it('scans live slots in insertion order', function(){
      var ids = scan('nodes', 0, 0).map( r => store.idAt(r.group, r.slot) );

      expect( ids ).to.deep.equal([ 'a', 'b', 'c' ]);
    });

    it('applies the flags mask', function(){
      var sel = scan('nodes', FLAG_SELECTED, FLAG_SELECTED).map( r => store.idAt(r.group, r.slot) );
      var unsel = scan('nodes', FLAG_SELECTED, 0).map( r => store.idAt(r.group, r.slot) );

      expect( sel ).to.deep.equal([ 'b' ]);
      expect( unsel ).to.deep.equal([ 'a', 'c' ]);
    });

    it('skips removed slots and re-adds at the new order position', function(){
      store.removeEdge( store.lookup('ab').slot );
      store.removeNode( store.lookup('b').slot );
      store.addNode('d', 0, 0);

      var ids = scan('nodes', 0, 0).map( r => store.idAt(r.group, r.slot) );

      expect( ids ).to.deep.equal([ 'a', 'c', 'd' ]);
    });

    it('writes from the given offset and returns the end index', function(){
      var out = [ 'sentinel' ];
      var n = store.scanRefsInto( out, 1, 'edges', 0, 0 );

      expect( n ).to.equal(2);
      expect( out[0] ).to.equal('sentinel');
      expect( out[1].group ).to.equal('edges');
    });
  });

  describe('core selection routing', function(){
    var cy;

    beforeEach(function(){
      cy = cytoscapeGpu({
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b' }, selected: true },
          { data: { id: 'ab', source: 'a', target: 'b' } }
        ]
      });
    });

    var ids = eles => eles.map( e => e.id() );

    it('resolves flag selectors on the core', function(){
      expect( ids( cy.$(':selected') ) ).to.deep.equal([ 'b' ]);
      expect( ids( cy.$('node:unselected') ) ).to.deep.equal([ 'a' ]);
      expect( ids( cy.$('node:selected, edge') ) ).to.deep.equal([ 'b', 'ab' ]);
    });

    it('group-restricts selectors on nodes()/edges()', function(){
      expect( ids( cy.nodes(':selected') ) ).to.deep.equal([ 'b' ]);
      expect( ids( cy.edges(':selected') ) ).to.deep.equal([]);
      expect( ids( cy.nodes('#ab') ) ).to.deep.equal([]); // edge id restricted away
      expect( ids( cy.edges('#ab') ) ).to.deep.equal([ 'ab' ]);
    });

    it('falls back on mixed id + flag comma lists', function(){
      expect( ids( cy.$('#ab, node:selected') ) ).to.deep.equal([ 'b', 'ab' ]);
    });

    it('follows selection changes and removals', function(){
      cy.$('#a').select();

      expect( ids( cy.$('node:selected') ) ).to.deep.equal([ 'a', 'b' ]);

      cy.$('#b').remove();

      expect( ids( cy.$('node:selected') ) ).to.deep.equal([ 'a' ]);
      expect( ids( cy.elements() ) ).to.deep.equal([ 'a' ]);
    });
  });

});
