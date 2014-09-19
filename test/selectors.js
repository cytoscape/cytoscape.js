var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);

describe('Selectors', function(){

  var cy;
  var n1, n2, nparent, n1n2, nparentLoop;
  var eles;

  before(function(next){
    cytoscape({
      styleEnabled: true,
      
      elements: {
        nodes: [
          { data: { id: 'n1', foo: 'one', weight: 1 }, classes: 'cls1 cls2' },
          { data: { id: 'n2', foo: 'two', parent: 'nparent', weight: 2 }, classes: 'cls1' },
          { data: { id: 'nparent', weight: 3 }, classes: 'cls2' }
        ],

        edges: [
          { data: { id: 'n1n2', source: 'n1', target: 'n2', weight: 1, foo: false }, classes: 'cls2' },
          { data: { id: 'nparentLoop', source: 'nparent', target: 'nparent' } }
        ]
      }, 
      ready: function(){
        cy = this;
        n1 = cy.getElementById('n1');
        n2 = cy.getElementById('n2');
        nparent = cy.getElementById('nparent');
        n1n2 = cy.getElementById('n1n2');
        nparentLoop = cy.getElementById('nparentLoop');
        
        n1.select();
        n2.unselectify();
        nparent.lock();
        n1n2.hide();
        n1n2.css('opacity', 0);

        eles = {
          n1: n1,
          n2: n2,
          n1n2: n1n2,
          nparent: nparent,
          nparentLoop: nparentLoop
        };

        next();
      }
    });
  });

  //function next(){
    var itSelects = function(selector  /* , eles ... */){
      var args = arguments;

      it(selector, function(){
        var col = cy.collection();

        for( var i = 1; i < args.length; i++ ){
          var ele = eles[ args[i] ];

          col = col.add(ele);
        }

        expect( cy.$(selector).same(col) ).to.be.true;
      });
    };

    // general
    itSelects('node', 'n1', 'n2', 'nparent');
    itSelects('edge', 'n1n2', 'nparentLoop');
    itSelects('#n1', 'n1');
    itSelects('#n1, #n2', 'n1', 'n2');
    itSelects('.cls1', 'n1', 'n2');

    // data
    itSelects('[weight]', 'n1', 'n2', 'nparent', 'n1n2');
    itSelects('[?foo]', 'n1', 'n2');
    itSelects('[?foo]', 'n1', 'n2');
    itSelects('[!foo]', 'n1n2', 'nparentLoop', 'nparent');
    itSelects('[^foo]', 'nparent', 'nparentLoop');
    itSelects('[foo = "one"]', 'n1');
    itSelects('[foo != "one"]', 'n2', 'nparent', 'n1n2', 'nparentLoop');
    itSelects('[foo > "one"]', 'n2');
    itSelects('[foo < "two"]', 'n1');
    itSelects('[foo <= "two"]', 'n1', 'n2');
    itSelects('[foo > "one"]', 'n2');
    itSelects('[foo >= "one"]', 'n1', 'n2');
    itSelects('[foo *= "ne"]', 'n1');
    itSelects('[foo ^= "o"]', 'n1');
    itSelects('[foo $= "e"]', 'n1');
    itSelects('[foo @= "ONE"]', 'n1');
    itSelects('[weight = 2]', 'n2');
    itSelects('[weight != 2]', 'n1', 'nparent', 'n1n2', 'nparentLoop');
    itSelects('[weight > 2]', 'nparent');
    itSelects('[weight >= 2]', 'nparent', 'n2');
    itSelects('[weight < 2]', 'n1', 'n1n2');
    itSelects('[weight <= 2]', 'n1', 'n2', 'n1n2');
    itSelects('[weight !< 2]', 'n2', 'nparent');

    // metadata
    itSelects('[[degree = 1]]', 'n1', 'n2');
    itSelects('[[indegree = 1]]', 'n2');
    itSelects('[[outdegree = 1]]', 'n1');

    // selection
    itSelects(':selected', 'n1');
    itSelects(':unselected', 'n2', 'n1n2', 'nparent', 'nparentLoop');
    itSelects(':selectable', 'n1', 'nparent', 'n1n2', 'nparentLoop');
    itSelects(':unselectable', 'n2');

    // locking
    itSelects(':locked', 'nparent');
    itSelects(':unlocked', 'n1', 'n2', 'n1n2', 'nparentLoop');

    // visible
    itSelects(':visible', 'n1', 'n2', 'nparent', 'nparentLoop');
    itSelects(':hidden', 'n1n2');
    itSelects(':transparent', 'n1n2');

    // compound
    itSelects(':parent', 'nparent');
    itSelects(':child', 'n2');
    itSelects(':nonorphan', 'n2');
    itSelects(':orphan', 'n1', 'nparent');
    itSelects('#nparent node', 'n2');
    itSelects('#nparent > node', 'n2');
    itSelects('$node > node', 'nparent');

    // edges
    itSelects(':loop', 'nparentLoop');
    itSelects(':simple', 'n1n2');
  //}

});