var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);

describe('Collection building and filtering', function(){

  var cy, n1, n2, n3, n1n2, n2n3;

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
        n1 = cy.$('#n1');
        n2 = cy.$('#n2');
        n3 = cy.$('#n3');
        n1n2 = cy.$('#n1n2');
        n2n3 = cy.$('#n2n3');

        done();
      }
    });
  });

  it('eles.add()', function(){
    expect( n1.add(n2).length ).to.equal(2);
    expect( n1.add(n2).same( cy.$('#n1, #n2') ) ).to.be.true;
  });

  it('eles.not()', function(){
    expect( cy.$('#n1, #n2').not('#n2').same( n1 ) ).to.be.true;
    expect( cy.$('#n1, #n2').not(n2).same( n1 ) ).to.be.true;
  });

  it('eles.intersect()', function(){
    expect( cy.$('#n1, #n2').intersect(n1).same(n1) ).to.be.true;
  });

  it('eles.filter() etc', function(){
    expect( cy.$('#n1, #n2').filter('#n1').same(n1) ).to.be.true;

    expect( cy.$('#n1, #n2').filter(function(){
      return this.id() === 'n1';
    }).same(n1) ).to.be.true;

  });

});