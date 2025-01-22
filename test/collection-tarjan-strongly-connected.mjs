var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

describe('Algorithms', function(){
  describe('eles.tarjanStronglyConnected()', function(){

    var cy;

    beforeEach(function(done) {
      cytoscape({
        elements: {
          nodes: [
            { data: { id: '1'} },
            { data: { id: '2'} },
            { data: { id: '3'} },
            { data: { id: '4'} },
            { data: { id: '5'} },
            { data: { id: '6'} },
            { data: { id: '7'} },
            { data: { id: '8'} }
          ],

          edges: [
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

    it('eles.tsc(): weakly connected collection', function(){
      var res = cy.elements().tsc();
      expect(res.cut.map(ele2id)).to.deep.equal([ "4-2", "4-3", "6-3", "5-6", "8-5", "8-7" ]);
      expect(res.components.length).to.equal(4);
      expect(res.components[0].map(ele2id)).to.deep.equal([ "3", "2", "1", "2-3", "3-1", "1-2" ]);
      expect(res.components[1].map(ele2id)).to.deep.equal([ "7", "6", "6-7", "7-6" ]);
      expect(res.components[2].map(ele2id)).to.deep.equal([ "5", "4", "5-4", "4-5" ]);
      expect(res.components[3].map(ele2id)).to.deep.equal([ "8", "8-8" ]);
    });

    it('eles.tsc(): disconnected subcollection', function(){
      var eles = cy.elements().difference(cy.$('#6-3, #4-5, #5-4'));
      var res = eles.tsc();
      expect(res.cut.map(ele2id)).to.deep.equal([ "4-2", "4-3", "5-6", "8-5", "8-7" ]);
      expect(res.components.length).to.equal(5);
      expect(res.components[0].map(ele2id)).to.deep.equal([ "3", "2", "1", "2-3", "3-1", "1-2" ]);
      expect(res.components[1].map(ele2id)).to.deep.equal([ "4" ]);
      expect(res.components[2].map(ele2id)).to.deep.equal([ "7", "6", "6-7", "7-6" ]);
      expect(res.components[3].map(ele2id)).to.deep.equal([ "5" ]);
      expect(res.components[4].map(ele2id)).to.deep.equal([ "8", "8-8" ]);
    });

  });
});
