import { expect } from 'chai';
import cytoscape from '../src/test.mjs';

describe('Algorithms', function(){
  describe('eles.hierholzer()', function(){

    var cy;

    beforeEach(function(done) {
      cytoscape({
        elements: {
          nodes: [
            { data: { id: '0', name: '0' } },
            { data: { id: '1', name: '1' } },
            { data: { id: '2', name: '2' } },
            { data: { id: '3', name: '3' } },
            { data: { id: '4', name: '4' } },
            { data: { id: '5', name: '5' } },
            { data: { id: '6', name: '6' } },
            { data: { id: '7', name: '7' } },
          ],

          edges: [
            { data: { source: '0', target: '1' } },
            { data: { source: '0', target: '1' } },
            { data: { source: '1', target: '2' } },
            { data: { source: '1', target: '2' } },
            { data: { source: '2', target: '3' } },
            { data: { source: '2', target: '3' } },
            { data: { source: '0', target: '6' } },
            { data: { source: '2', target: '0' } },
            { data: { source: '3', target: '4' } },
            { data: { source: '3', target: '4' } },
            { data: { source: '4', target: '2' } },
            { data: { source: '4', target: '5' } },
            { data: { source: '4', target: '5' } },
            { data: { source: '5', target: '0' } },
            { data: { source: '5', target: '0' } },
            { data: { source: '6', target: '4' } }
          ]
        },

        ready: function(){
          cy = this;
          done();
        }
      });
    });

    function ele2id( ele ){
      return ele.id();
    }

    function isNode( ele ){
      return ele.isNode();
    }

    function makeGraph( nodeIds, edgeData ){
      return cytoscape({
        headless: true,
        elements: nodeIds.map(id => ({ data: { id } })).concat(
          edgeData.map(([id, source, target]) => ({ data: { id, source, target } }))
        )
      });
    }

    function expectTrail( collection, options ){
      let res = collection.hierholzer(options);
      expect(res.found).to.equal(true);
      expect(res.trail.edges().map(ele2id).sort()).to.deep.equal(collection.edges().map(ele2id).sort());
      expect(res.trail.every(ele => collection.has(ele))).to.equal(true);
      expect(res.trail[0].id()).to.equal(options.root.slice(1));
      return res;
    }

    [false, true].forEach(directed => {
      let direction = directed ? 'directed' : 'undirected';

      [
        ['outgoing', ['bc', 'b', 'c']],
        ['incoming', ['ca', 'c', 'a']],
        ['internal', ['ba', 'b', 'a']],
        ['loop', ['aa', 'a', 'a']]
      ].forEach(([name, excludedEdge]) => {
        it('ignores excluded ' + name + ' edges (' + direction + ')', function(){
          let graph = makeGraph(['a', 'b', 'c'], [['ab', 'a', 'b'], excludedEdge]);
          let subset = graph.elements().filter('#a, #b, #ab');
          let res = expectTrail(subset, { root: '#a', directed });
          expect(res.trail.map(ele2id)).to.deep.equal(['a', 'ab', 'b']);
          graph.destroy();
        });
      });

      it('ignores edges whose endpoints are outside the subset (' + direction + ')', function(){
        let graph = makeGraph(['a', 'b', 'c'], [['ab', 'a', 'b'], ['bc', 'b', 'c']]);
        expectTrail(graph.elements().not('#c, #bc'), { root: '#a', directed });
        let res = graph.elements().not('#c').hierholzer({ root: '#a', directed });
        expect(res.found).to.equal(true);
        expect(res.trail.map(ele2id)).to.deep.equal(['a', 'ab', 'b']);
        graph.destroy();
      });

      it('uses subset degrees even when the full graph has no trail (' + direction + ')', function(){
        let graph = makeGraph(['a', 'b', 'c', 'd'], [
          ['ab', 'a', 'b'], ['ac', 'a', 'c'], ['ad', 'a', 'd']
        ]);
        expect(graph.elements().hierholzer({ root: '#a', directed }).found).to.equal(false);
        expectTrail(graph.elements().filter('#a, #b, #ab'), { root: '#a', directed });
        graph.destroy();
      });

      it('rejects subset degree imbalance hidden by excluded edges (' + direction + ')', function(){
        let graph = makeGraph(['a', 'b', 'c', 'd'], [
          ['ab', 'a', 'b'], ['ac', 'a', 'c'], ['ad', 'a', 'd'],
          ['ba', 'b', 'a'], ['ca', 'c', 'a'], ['da', 'd', 'a']
        ]);
        expectTrail(graph.elements(), { root: '#a', directed });
        let res = graph.elements().not('#ba, #ca, #da').hierholzer({ root: '#a', directed });
        expect(res.found).to.equal(false);
        expect(res.trail).to.equal(undefined);
        graph.destroy();
      });

      it('preserves loops and parallel edges in a subset (' + direction + ')', function(){
        let graph = makeGraph(['a', 'b', 'c'], [
          ['aa', 'a', 'a'], ['ab1', 'a', 'b'], ['ab2', 'a', 'b'],
          ['ba1', 'b', 'a'], ['ba2', 'b', 'a'], ['bc', 'b', 'c']
        ]);
        expectTrail(graph.elements().not('#bc, #c'), { root: '#a', directed });
        graph.destroy();
      });

      it('rejects disconnected edge components (' + direction + ')', function(){
        let graph = makeGraph(['a', 'b'], [['aa', 'a', 'a'], ['bb', 'b', 'b']]);
        let res = graph.elements().hierholzer({ root: '#a', directed });
        expect(res.found).to.equal(false);
        expect(res.trail).to.equal(undefined);
        graph.destroy();
      });

      it('preserves automatic roots and rejects an invalid trail root (' + direction + ')', function(){
        let graph = makeGraph(['a', 'b', 'c'], [['ab', 'a', 'b'], ['bc', 'b', 'c']]);
        let subset = graph.elements().not('#bc');
        let res = subset.hierholzer({ directed });
        expect(res.found).to.equal(true);
        expect(res.trail.edges().map(ele2id)).to.deep.equal(['ab']);
        expect(subset.hierholzer({ root: '#c', directed }).found).to.equal(false);
        graph.destroy();
      });
    });

    it('eles.hierholzer(): directed', function(){
      var options = {
        root: "#0",
        directed: true
      };
      var res = cy.elements().hierholzer(options);
      expect(res.found).to.equal(true);
      expect(res.trail.stdFilter(isNode).map(ele2id)).to.deep.equal(["0", "1", "2", "3", "4", "5", "6"]);
    });

    it('eles.hierholzer(): undirected', function(){
      var options = {
        root: "#0",
        directed: false
      };
      var res = cy.elements().hierholzer(options);
      expect(res.found).to.equal(true);
      expect(res.trail.stdFilter(isNode).map(ele2id)).to.deep.equal(["0", "1", "6", "4", "3", "2", "5"]);
    });

  });
});
