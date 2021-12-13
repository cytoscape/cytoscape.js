var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

describe('Selectors', function(){

  var cy;
  beforeEach(function(){
    cy = cytoscape({
      styleEnabled: true,

      elements: {
        nodes: [
          { data: { id: 'n1', foo: 'one', weight: 1, 'weird.name': 1, 'weird.name2': 'weird.val', 'weird.0': 'weird.index', emptystr: '', arrayval: ['index0', 'index1'] }, classes: 'cls1 cls2' },
          { data: { id: 'n2', foo: 'two', parent: 'nparent', weight: 2, 'weird.name3': '"blah"^blah<blah>#blah', 'weird.1': '"blah"^blah<blah>#blah', 'arrayval.0': [0, 1] }, classes: 'cls1' },
          { data: { id: 'nparent', parent: 'nparent2', weight: 3 }, classes: 'cls2' },
          { data: { id: 'nparent2' } }
        ],

        edges: [
          { data: { id: 'n1n2', source: 'n1', target: 'n2', weight: 1, foo: false }, classes: 'cls2' },
          { data: { id: 'nparentLoop', source: 'nparent', target: 'nparent' } }
        ]
      }
    });

    cy.getElementById('n1').select();
    cy.getElementById('n2').unselectify();
    cy.getElementById('nparent').lock();
    cy.getElementById('n1n2').style({
      display: 'none',
      opacity: 0
    });
  });

  afterEach(function(){
    cy.destroy();
  });

  var itSelects = function(selector  /* , eles ... */){
    var args = arguments;

    var getIds = function( col ){
      return col.map(function( ele ){
        return '#' + ele.id();
      }).sort().join(', ');
    };

    it(selector, function(){
      var eles = [];

      for( var i = 1; i < args.length; i++ ){
        eles.push( cy.getElementById(args[i]) );
      }

      expect( getIds( cy.$(selector) ) ).to.equal( getIds( eles ) );
    });
  };

  // general
  itSelects('node', 'n1', 'n2', 'nparent', 'nparent2');
  itSelects('edge', 'n1n2', 'nparentLoop');
  itSelects('#n1', 'n1');
  itSelects('#n1, #n2', 'n1', 'n2');
  itSelects('.cls1', 'n1', 'n2');

  // data
  itSelects('[weight]', 'n1', 'n2', 'nparent', 'n1n2');
  itSelects('[?foo]', 'n1', 'n2');
  itSelects('[?foo]', 'n1', 'n2');
  itSelects('[!foo]', 'n1n2', 'nparentLoop', 'nparent', 'nparent2');
  itSelects('[^foo]', 'nparent', 'nparentLoop', 'nparent2');
  itSelects('[foo = "one"]', 'n1');
  itSelects('[foo != "one"]', 'n2', 'nparent', 'n1n2', 'nparent2', 'nparentLoop');
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
  itSelects('[weight != 2]', 'n1', 'nparent', 'nparent2', 'n1n2', 'nparentLoop');
  itSelects('[weight > 2]', 'nparent');
  itSelects('[weight >= 2]', 'nparent', 'n2');
  itSelects('[weight < 2]', 'n1', 'n1n2');
  itSelects('[weight <= 2]', 'n1', 'n2', 'n1n2');
  itSelects('[weight !< 2]', 'n2', 'nparent');
  itSelects('[emptystr = ""]', 'n1');
  itSelects('[emptystr != ""]', 'n2', 'nparent', 'nparent2', 'n1n2', 'nparentLoop');
  itSelects('[arrayval.0 = "index0"]', 'n1');
  itSelects('[arrayval.1 = "index1"]', 'n1');  
  
  // metadata
  itSelects('[[degree = 1]]', 'n1', 'n2');
  itSelects('[[indegree = 1]]', 'n2', 'nparent');
  itSelects('[[outdegree = 1]]', 'n1', 'nparent');

  // selection
  itSelects(':selected', 'n1');
  itSelects(':unselected', 'n2', 'n1n2', 'nparent', 'nparent2', 'nparentLoop');
  itSelects(':selectable', 'n1', 'nparent', 'nparent2', 'n1n2', 'nparentLoop');
  itSelects(':unselectable', 'n2');

  // locking
  itSelects(':locked', 'nparent');
  itSelects(':unlocked', 'n1', 'n2', 'nparent2', 'n1n2', 'nparentLoop');

  // visible
  itSelects(':visible', 'n1', 'n2', 'nparent', 'nparent2', 'nparentLoop');
  itSelects(':hidden', 'n1n2');
  itSelects(':transparent', 'n1n2');

  // compound
  itSelects(':parent', 'nparent', 'nparent2');
  itSelects(':childless', 'n1', 'n2');
  itSelects(':child', 'n2', 'nparent');
  itSelects(':nonorphan', 'n2', 'nparent');
  itSelects(':orphan', 'n1', 'nparent2');
  itSelects('#nparent > node', 'n2');
  itSelects('#nparent node', 'n2');
  itSelects('$node > node', 'nparent', 'nparent2');
  itSelects('$node node', 'nparent', 'nparent2');
  itSelects('node > $node > node', 'nparent');
  itSelects('node $node node', 'nparent');
  itSelects('$node > node > node', 'nparent2');
  itSelects('$node node node', 'nparent2');
  itSelects('node > node > $node', 'n2');
  itSelects('node node $node', 'n2');
  itSelects('node > node > node', 'n2');
  itSelects('node node node', 'n2');

  // edges
  itSelects(':loop', 'nparentLoop');
  itSelects(':simple', 'n1n2');
  itSelects('node -> node', 'n1n2', 'nparentLoop');
  itSelects('#n1 -> node', 'n1n2');
  itSelects('[foo = "one"] -> node', 'n1n2');
  itSelects('[weight = 1] -> node', 'n1n2');
  itSelects('node <-> node', 'n1n2', 'nparentLoop');
  itSelects('node <-> #n1', 'n1n2');
  itSelects('node <-> [foo = "one"]', 'n1n2');
  itSelects('node <-> [weight = 1]', 'n1n2');
  itSelects('#n2 <-> $node', 'n1');
  itSelects('$node <-> #n1', 'n2');
  itSelects('$node -> #n2', 'n1');
  itSelects('#n1 -> $node', 'n2');

  // metachars
  itSelects('[weird\\.name = 1]', 'n1');
  itSelects('[weird\\.name2 = "weird.val"]', 'n1');
  itSelects('[weird\\.name2 *= "d.v"]', 'n1');
  itSelects('[weird\\.name2 ^= "weird."]', 'n1');
  itSelects('[weird\\.name2 $= ".val"]', 'n1');
  itSelects('[weird\\.name3 *= "<blah>"]', 'n2');
  itSelects('[weird\\.name3 ^= \'"blah"^blah\']', 'n2');
  itSelects('[weird\\.name3 $= "^blah<blah>#blah"]', 'n2');
  itSelects('[weird\\.0 = "weird.index"]', 'n1');
  itSelects('[weird\\.0 *= "d.i"]', 'n1');
  itSelects('[weird\\.0 ^= "weird."]', 'n1');
  itSelects('[weird\\.0 $= ".index"]', 'n1');
  itSelects('[weird\\.1 *= "<blah>"]', 'n2');
  itSelects('[weird\\.1 ^= \'"blah"^blah\']', 'n2');
  itSelects('[weird\\.1 $= "^blah<blah>#blah"]', 'n2');
  itSelects('[arrayval\\.0.0 = 0]', 'n2');
  itSelects('[arrayval\\.0.1 = 1]', 'n2');    
});
