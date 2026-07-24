import { expect } from 'chai';
import { GraphStore } from '../src/gpu/store/graph-store.mjs';
import { FLAG_SELECTED } from '../src/gpu/contract.mjs';
import cytoscapeGpu from '../src/gpu/index.mjs';

describe('gpu/flag-scan', function(){

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

  describe('core query routing', function(){
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

    it('resolves structured queries on the core', function(){
      expect( ids( cy.filter({ selected: true }) ) ).to.deep.equal([ 'b' ]);
      expect( ids( cy.elements({ group: 'nodes', selected: false }) ) ).to.deep.equal([ 'a' ]);
      expect( ids( cy.elements({ group: 'edges' }) ) ).to.deep.equal([ 'ab' ]);
    });

    it('group-restricts queries on nodes()/edges()', function(){
      expect( ids( cy.nodes({ selected: true }) ) ).to.deep.equal([ 'b' ]);
      expect( ids( cy.edges({ selected: true }) ) ).to.deep.equal([]);
      expect( ids( cy.nodes({ group: 'edges' }) ) ).to.deep.equal([]); // contradiction matches nothing
      expect( ids( cy.edges({ group: 'edges' }) ) ).to.deep.equal([ 'ab' ]);
    });

    it('resolves predicate functions per element', function(){
      expect( ids( cy.elements( ele => ele.id() === 'ab' || ele.selected() ) ) ).to.deep.equal([ 'b', 'ab' ]);
      expect( ids( cy.nodes( ele => ele.selected() ) ) ).to.deep.equal([ 'b' ]);
    });

    it('throws on typo\'d query keys instead of matching all', function(){
      expect(function(){ cy.elements({ selectd: true }); }).to.throw(/Unknown query key/);
    });

    it('follows selection changes and removals', function(){
      cy.$id('a').select();

      expect( ids( cy.filter({ group: 'nodes', selected: true }) ) ).to.deep.equal([ 'a', 'b' ]);

      cy.$id('b').remove();

      expect( ids( cy.filter({ group: 'nodes', selected: true }) ) ).to.deep.equal([ 'a' ]);
      expect( ids( cy.elements() ) ).to.deep.equal([ 'a' ]);
    });
  });

});
