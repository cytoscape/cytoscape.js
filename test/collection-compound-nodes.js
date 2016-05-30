var expect = require('chai').expect;
var cytoscape = require('../src', cytoscape);

describe('Collection compound nodes', function(){

  var cy, n1, n2, n3, n4;

  // test setup
  beforeEach(function(done){
    cytoscape({
      elements: {
        nodes: [
            { data: { id: 'n1' } },
            { data: { id: 'n2', parent: 'n1' } },
            { data: { id: 'n3', parent: 'n2' } },
            { data: { id: 'n4', parent: 'n2' } }
        ]
      },
      ready: function(){
        cy = this;
        n1 = cy.$('#n1');
        n2 = cy.$('#n2');
        n3 = cy.$('#n3');
        n4 = cy.$('#n4');

        done();
      }
    });
  });

  it('node.isParent()', function(){
    expect( n1.isParent() ).to.be.true;
    expect( n3.isParent() ).to.be.false;
  });

  it('nodes.parent()', function(){
    expect( n2.parent().same(n1) ).to.be.true;
  });

  it('nodes.parents()', function(){
    expect( n3.parents().same( n1.add(n2) ) ).to.be.true;
  });

  it('nodes.children()', function(){
    expect( n1.children().same( n2 ) ).to.be.true;
  });

  it('nodes.descendants()', function(){
    expect( n1.descendants().same( n2.add(n3).add(n4) ) ).to.be.true;
  });

  it('nodes.siblings()', function(){
    expect( n3.siblings().same( n4 ) ).to.be.true;
  });

  it('nodes.commonAncestors()', function(){
    var ancestors = n3.add(n4).commonAncestors();

    expect( ancestors.length ).to.equal( 2 );
    expect( ancestors[0].same( n2 ) ).to.be.true;
    expect( ancestors[1].same( n1 ) ).to.be.true;
  });

  it('nodes.orphans()', function(){
    expect( cy.elements().orphans().same( n1 ) ).to.be.true;
  });

  it('nodes.nonorphans()', function(){
    expect( cy.elements().nonorphans().same( n2.add(n3).add(n4) ) ).to.be.true;
  });
});
