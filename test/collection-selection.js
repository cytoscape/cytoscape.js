var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

describe('Collection selection', function(){

  var cy;

  // test setup
  beforeEach(function(done){
    cytoscape({
      elements: {
        nodes: [
            { data: { id: 'n1' } },
            { data: { id: 'n2' } },
            { data: { id: 'n3' } }
        ],

        edges: [
            { data: { id: 'n1n2', source: 'n1', target: 'n2' } },
            { data: { id: 'n2n3', source: 'n2', target: 'n3' } }
        ]
      },
      ready: function(){
        cy = this;

        done();
      }
    });
  });

  describe('eles.select()', function(){

    it('makes a node selected', function(){
      var n1 = cy.$('#n1').select();

      expect( n1.selected() ).to.be.true;
    });

    it('keeps a node selected if already selected', function(){
      var n1 = cy.$('#n1').select();
      n1.select();

      expect( n1.selected() ).to.be.true;
    });

    it('fires the `select` event', function(){
      var n1 = cy.$('#n1');
      var triggered = false;

      n1.on('select', function(){
        triggered = true;
      });

      n1.select();

      expect( triggered ).to.be.true;
    });

  });

  describe('eles.unselect()', function(){

    it('makes a node not selected', function(){
      var n1 = cy.$('#n1').select();

      expect( n1.selected() ).to.be.true;

      n1.unselect();
      expect( n1.selected() ).to.be.false;
    });

    it('keeps a node not selected if already not selected', function(){
      var n1 = cy.$('#n1').unselect();

      expect( n1.selected() ).to.be.false;

      n1.unselect();
      expect( n1.selected() ).to.be.false;
    });

    it('fires the `unselect` event', function(){
      var n1 = cy.$('#n1').select();
      var triggered = false;

      expect( n1.selected() ).to.be.true;

      n1.on('unselect', function(){
        triggered = true;
      });

      n1.unselect();

      expect( triggered ).to.be.true;

    });

  });

  describe('eles.selectify() etc', function(){

    it('eles.unselectify() makes selection state immutable', function(){
      var n1 = cy.$('#n1');
      var n2 = cy.$('#n2');

      n1.unselectify();
      n1.select();

      expect( n1.selected() ).to.be.false;

      n2.select();
      n2.unselectify();
      n2.unselect();

      expect( n2.selected() ).to.be.true;
    });

    it('eles.selectify() makes selection state mutable', function(){
      var n1 = cy.$('#n1');

      n1.select();
      n1.unselectify();
      n1.selectify();
      n1.unselect();

      expect( n1.selected() ).to.be.false;
    });


  });

});
