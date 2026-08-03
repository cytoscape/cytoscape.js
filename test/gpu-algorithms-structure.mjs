import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// ported from test/collection-tarjan-strongly-connected.mjs,
// test/collection-hopcroft-tarjan-biconnected.mjs, test/collection-hierholzer.mjs
// and the kargerStein spec of test/collection-algorithms.mjs.  Where v3
// asserted traversal-order-dependent sequences, these specs assert the
// order-independent graph-theoretic results instead.
describe('gpu/algorithms: structure', function(){

  var ids = eles => eles.map( ele => ele.id() );
  var sortedIds = eles => ids( eles ).sort();

  describe('eles.tarjanStronglyConnected()', function(){
    var cy;

    beforeEach(function(){
      cy = cytoscapeGpu({
        elements: [
          { data: { id: '1' } }, { data: { id: '2' } }, { data: { id: '3' } },
          { data: { id: '4' } }, { data: { id: '5' } }, { data: { id: '6' } },
          { data: { id: '7' } }, { data: { id: '8' } },
          { data: { id: '1-2', source: '1', target: '2' } },
          { data: { id: '2-3', source: '2', target: '3' } },
          { data: { id: '3-1', source: '3', target: '1' } },
          { data: { id: '4-2', source: '4', target: '2' } },
          { data: { id: '4-3', source: '4', target: '3' } },
          { data: { id: '6-3', source: '6', target: '3' } },
          { data: { id: '5-4', source: '5', target: '4' } },
          { data: { id: '4-5', source: '4', target: '5' } },
          { data: { id: '5-6', source: '5', target: '6' } },
          { data: { id: '8-5', source: '8', target: '5' } },
          { data: { id: '8-8', source: '8', target: '8' } },
          { data: { id: '6-7', source: '6', target: '7' } },
          { data: { id: '7-6', source: '7', target: '6' } },
          { data: { id: '8-7', source: '8', target: '7' } }
        ]
      });
    });

    it('weakly connected collection', function(){
      var res = cy.elements().tsc();

      expect( ids( res.cut ) ).to.deep.equal([ '4-2', '4-3', '6-3', '5-6', '8-5', '8-7' ]);
      expect( res.components.length ).to.equal( 4 );
      expect( sortedIds( res.components[0] ) ).to.deep.equal([ '1', '1-2', '2', '2-3', '3', '3-1' ]);
      expect( sortedIds( res.components[1] ) ).to.deep.equal([ '6', '6-7', '7', '7-6' ]);
      expect( sortedIds( res.components[2] ) ).to.deep.equal([ '4', '4-5', '5', '5-4' ]);
      expect( sortedIds( res.components[3] ) ).to.deep.equal([ '8', '8-8' ]);
    });

    it('disconnected subcollection', function(){
      var eles = cy.elements().difference(
        cy.$id('6-3').union( cy.$id('4-5') ).union( cy.$id('5-4') ) );
      var res = eles.tsc();

      expect( ids( res.cut ) ).to.deep.equal([ '4-2', '4-3', '5-6', '8-5', '8-7' ]);
      expect( res.components.length ).to.equal( 5 );
      expect( sortedIds( res.components[0] ) ).to.deep.equal([ '1', '1-2', '2', '2-3', '3', '3-1' ]);
      expect( sortedIds( res.components[1] ) ).to.deep.equal([ '4' ]);
      expect( sortedIds( res.components[2] ) ).to.deep.equal([ '6', '6-7', '7', '7-6' ]);
      expect( sortedIds( res.components[3] ) ).to.deep.equal([ '5' ]);
      expect( sortedIds( res.components[4] ) ).to.deep.equal([ '8', '8-8' ]);
    });

    it('aliases resolve', function(){
      expect( cy.elements().tarjanStronglyConnected().components.length ).to.equal( 4 );
      expect( cy.elements().tscc().components.length ).to.equal( 4 );
      expect( cy.elements().tarjanStronglyConnectedComponents().components.length ).to.equal( 4 );
    });
  });

  describe('eles.hopcroftTarjanBiconnected()', function(){
    var cy;
    var sub = prefix => cy.elements().filter( ele => ele.id().startsWith( prefix ) );

    beforeEach(function(){
      cy = cytoscapeGpu({
        elements: [
          { data: { id: '0-0' } }, { data: { id: '0-1' } }, { data: { id: '0-2' } },
          { data: { id: '0-3' } }, { data: { id: '0-4' } },

          { data: { id: '1-0' } }, { data: { id: '1-1' } }, { data: { id: '1-2' } },
          { data: { id: '1-3' } }, { data: { id: '1-4' } }, { data: { id: '1-5' } },
          { data: { id: '1-6' } }, { data: { id: '1-7' } }, { data: { id: '1-8' } },
          { data: { id: '1-9' } }, { data: { id: '1-10' } }, { data: { id: '1-11' } },
          { data: { id: '1-12' } }, { data: { id: '1-13' } }, { data: { id: '1-14' } },
          { data: { id: '1-15' } }, { data: { id: '1-16' } }, { data: { id: '1-17' } },
          { data: { id: '1-18' } },

          { data: { id: '2-0' } }, { data: { id: '2-1' } }, { data: { id: '2-2' } },

          { data: { source: '0-0', target: '0-1', id: '0-5' } },
          { data: { source: '0-1', target: '0-2', id: '0-6' } },
          { data: { source: '0-2', target: '0-3', id: '0-7' } },
          { data: { source: '0-3', target: '0-4', id: '0-8' } },
          { data: { source: '0-4', target: '0-3', id: '0-9' } },
          { data: { source: '0-0', target: '0-4', id: '0-10' } },
          { data: { source: '0-4', target: '0-4', id: '0-11' } },

          { data: { source: '1-1', target: '1-2', id: '1-19' } },
          { data: { source: '1-2', target: '1-3', id: '1-20' } },
          { data: { source: '1-2', target: '1-4', id: '1-21' } },
          { data: { source: '1-2', target: '1-5', id: '1-22' } },
          { data: { source: '1-2', target: '1-6', id: '1-23' } },
          { data: { source: '1-3', target: '1-4', id: '1-24' } },
          { data: { source: '1-5', target: '1-6', id: '1-25' } },
          { data: { source: '1-5', target: '1-7', id: '1-26' } },
          { data: { source: '1-6', target: '1-7', id: '1-27' } },
          { data: { source: '1-7', target: '1-8', id: '1-28' } },
          { data: { source: '1-7', target: '1-11', id: '1-29' } },
          { data: { source: '1-8', target: '1-9', id: '1-30' } },
          { data: { source: '1-8', target: '1-11', id: '1-31' } },
          { data: { source: '1-8', target: '1-12', id: '1-32' } },
          { data: { source: '1-8', target: '1-14', id: '1-33' } },
          { data: { source: '1-8', target: '1-15', id: '1-34' } },
          { data: { source: '1-9', target: '1-10', id: '1-35' } },
          { data: { source: '1-9', target: '1-11', id: '1-36' } },
          { data: { source: '1-10', target: '1-11', id: '1-37' } },
          { data: { source: '1-10', target: '1-16', id: '1-38' } },
          { data: { source: '1-10', target: '1-17', id: '1-39' } },
          { data: { source: '1-10', target: '1-18', id: '1-40' } },
          { data: { source: '1-12', target: '1-13', id: '1-41' } },
          { data: { source: '1-13', target: '1-14', id: '1-42' } },
          { data: { source: '1-13', target: '1-15', id: '1-43' } },
          { data: { source: '1-17', target: '1-18', id: '1-44' } },

          { data: { id: '2-3', source: '2-2', target: '2-1' } },
          { data: { id: '2-4', source: '2-1', target: '2-0' } },
          { data: { id: '2-5', source: '2-1', target: '2-1' } },
          { data: { id: '2-6', source: '2-0', target: '2-1' } },
          { data: { id: '2-7', source: '2-0', target: '2-2' } },
          { data: { id: '2-8', source: '2-0', target: '2-0' } }
        ]
      });
    });

    it('no cut vertices, one biconnected component', function(){
      var cy0 = sub('0-');
      var cy2 = sub('2-');
      var res0 = cy0.htbc();
      var res2 = cy2.htbc();

      expect( ids( res0.cut ) ).to.deep.equal( [] );
      expect( res0.components.length ).to.equal( 1 );
      expect( res0.components[0].length ).to.equal( cy0.length );
      expect( sortedIds( res0.components[0] ) ).to.deep.equal( sortedIds( cy0 ) );

      expect( ids( res2.cut ) ).to.deep.equal( [] );
      expect( res2.components.length ).to.equal( 1 );
      expect( res2.components[0].length ).to.equal( cy2.length );
      expect( sortedIds( res2.components[0] ) ).to.deep.equal( sortedIds( cy2 ) );
    });

    it('multiple biconnected components', function(){
      var res = sub('1-').htbc();

      expect( sortedIds( res.cut ) ).to.deep.equal([ '1-10', '1-2', '1-7', '1-8' ]);
      expect( res.components.length ).to.equal( 8 );

      // the components' node sets are the graph's blocks (order-independent)
      var blocks = res.components
        .map( comp => sortedIds( comp.nodes() ).join(' ') )
        .sort();

      expect( blocks ).to.deep.equal([
        '1-0',
        '1-1 1-2',
        '1-10 1-11 1-7 1-8 1-9',
        '1-10 1-16',
        '1-10 1-17 1-18',
        '1-12 1-13 1-14 1-15 1-8',
        '1-2 1-3 1-4',
        '1-2 1-5 1-6 1-7'
      ]);
    });
  });

  describe('eles.hierholzer()', function(){
    var cy;

    beforeEach(function(){
      cy = cytoscapeGpu({
        elements: [
          { data: { id: '0' } }, { data: { id: '1' } }, { data: { id: '2' } },
          { data: { id: '3' } }, { data: { id: '4' } }, { data: { id: '5' } },
          { data: { id: '6' } }, { data: { id: '7' } },
          { data: { id: 'e0', source: '0', target: '1' } },
          { data: { id: 'e1', source: '0', target: '1' } },
          { data: { id: 'e2', source: '1', target: '2' } },
          { data: { id: 'e3', source: '1', target: '2' } },
          { data: { id: 'e4', source: '2', target: '3' } },
          { data: { id: 'e5', source: '2', target: '3' } },
          { data: { id: 'e6', source: '0', target: '6' } },
          { data: { id: 'e7', source: '2', target: '0' } },
          { data: { id: 'e8', source: '3', target: '4' } },
          { data: { id: 'e9', source: '3', target: '4' } },
          { data: { id: 'e10', source: '4', target: '2' } },
          { data: { id: 'e11', source: '4', target: '5' } },
          { data: { id: 'e12', source: '4', target: '5' } },
          { data: { id: 'e13', source: '5', target: '0' } },
          { data: { id: 'e14', source: '5', target: '0' } },
          { data: { id: 'e15', source: '6', target: '4' } }
        ]
      });
    });

    it('directed: finds an Eulerian circuit from the root', function(){
      var res = cy.elements().hierholzer({ root: cy.$id('0'), directed: true });

      expect( res.found ).to.equal( true );
      expect( res.trail.edges().same( cy.edges() ) ).to.be.true; // every edge used
      expect( res.trail.nodes().length ).to.equal( 7 ); // node 7 is isolated
      expect( res.trail[0].id() ).to.equal('0');
    });

    it('undirected: finds an Eulerian circuit from the root', function(){
      var res = cy.elements().hierholzer({ root: cy.$id('0'), directed: false });

      expect( res.found ).to.equal( true );
      expect( res.trail.edges().same( cy.edges() ) ).to.be.true;
      expect( res.trail[0].id() ).to.equal('0');
    });

    it('positional form (root, directed)', function(){
      var res = cy.elements().hierholzer( cy.$id('0'), true );

      expect( res.found ).to.equal( true );
    });

    it('reports not found when degrees forbid a trail', function(){
      var cy2 = cytoscapeGpu({
        elements: [
          { data: { id: 'a' } }, { data: { id: 'b' } },
          { data: { id: 'c' } }, { data: { id: 'd' } },
          // a star: three odd-degree leaves — no Eulerian trail
          { data: { id: 'ab', source: 'a', target: 'b' } },
          { data: { id: 'ac', source: 'a', target: 'c' } },
          { data: { id: 'ad', source: 'a', target: 'd' } }
        ]
      });

      var res = cy2.elements().hierholzer({});

      expect( res.found ).to.equal( false );
      expect( res.trail ).to.equal( undefined );
    });

    it('throws on a selector-string root', function(){
      expect( () => cy.elements().hierholzer({ root: '#0' }) ).to.throw();
    });
  });

  describe('eles.kargerStein()', function(){
    var cy;

    beforeEach(function(){
      cy = cytoscapeGpu({
        elements: [
          { data: { id: 'a' } }, { data: { id: 'b' } }, { data: { id: 'c' } },
          { data: { id: 'd' } }, { data: { id: 'e' } }, { data: { id: 'f' } },
          { data: { id: 'ae', source: 'a', target: 'e' } },
          { data: { id: 'ab', source: 'a', target: 'b' } },
          { data: { id: 'be', source: 'b', target: 'e' } },
          { data: { id: 'bc', source: 'b', target: 'c' } },
          { data: { id: 'ce', source: 'c', target: 'e' } },
          { data: { id: 'cd', source: 'c', target: 'd' } },
          { data: { id: 'cf', source: 'c', target: 'f' } },
          { data: { id: 'de', source: 'd', target: 'e' } },
          { data: { id: 'df', source: 'd', target: 'f' } }
        ]
      });
    });

    it('finds a minimum cut', function(){
      var res = cy.elements().kargerStein();

      // cut size between 2 and 4 (randomized, high probability), as v3 asserts
      expect( res.cut.length ).to.be.within( 2, 4 );

      // nodes and edges of both components plus the cut cover the collection
      expect( res.components[0].length + res.components[1].length + res.cut.length )
        .to.equal( 15 );

      // partitions split the nodes
      expect( res.partition1.length + res.partition2.length ).to.equal( 6 );
      expect( res.partition1.intersection( res.partition2 ).length ).to.equal( 0 );
    });

    it('throws on fewer than 2 nodes', function(){
      var cy2 = cytoscapeGpu({ elements: [ { data: { id: 'a' } } ] });

      expect( () => cy2.elements().kargerStein() ).to.throw();
    });

    // round 30.1: the *other* precondition.  The node-count guard above
    // was pinned; the connectivity guard — raised from inside the
    // contraction loop when it runs out of edges to collapse — had
    // never fired in the suite.
    //
    // Measured while writing this: it is not a general
    // disconnected-graph detector.  Two internally-connected components
    // reach two meta-nodes without exhausting the edge list and return
    // a result, so what the guard actually catches is a contraction
    // that runs dry — reachable whenever a *subgraph* scope holds
    // nodes it has no edges to collapse.
    it('throws when the contraction runs out of edges', function(){
      var cy2 = cytoscapeGpu({ elements: [
        { data: { id: 'a' } }, { data: { id: 'b' } }
      ] });

      expect( () => cy2.elements().kargerStein() )
        .to.throw( /connected \(sub\)graph/ );

      // the subgraph form: nodes selected without their edge
      var cy3 = cytoscapeGpu({ elements: [
        { data: { id: 'a' } }, { data: { id: 'b' } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ] });

      expect( () => cy3.nodes().kargerStein() )
        .to.throw( /connected \(sub\)graph/ );

      // control: the same nodes *with* the edge answer instead
      var res = cy3.elements().kargerStein();

      expect( res.partition1.length + res.partition2.length ).to.equal( 2 );
    });
  });
});
