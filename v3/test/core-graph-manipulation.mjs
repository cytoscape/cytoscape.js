import { expect } from 'chai';
import cytoscape from '../src/test.mjs';

describe('Core graph manipulation', function(){

  function OneLayout( options ){
    this.options = options;
  }

  OneLayout.prototype.run = function(){
    this.options.eles.layoutPositions(this, this.options, function(){
      return { x: 1, y: 1 };
    });
  };

  cytoscape('layout', 'one', OneLayout);

  var cy;

  // test setup
  beforeEach(function(){
    cy = cytoscape({
      styleEnabled: true,

      elements: {
        nodes: [
            { data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
            { data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
            { data: { id: "n3", foo: "three", weight: 0.75 }, classes: "odd three" }
        ],

        edges: [
            { data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
            { data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
        ]
      },

      style: [
        {
          selector: 'node',
          style: {
            'background-width': '50% 50%' // expected to be in first block for tests
          }
        }
      ]
    });
  });

  afterEach(function(){
    cy.destroy();
  });

  describe('cy.add()', function(){

    it('adds via single object', function(){

      cy.add({
        group: 'nodes',
        data: { id: 'new-node' }
      });

      expect( cy.$('#new-node') ).to.have.length(1);
      expect( cy.nodes() ).to.have.length(4);

    });

    it('adds via single object (inferred node)', function(){

      cy.add({
        data: { id: 'new-node' }
      });

      expect( cy.$('#new-node') ).to.have.length(1);
      expect( cy.nodes() ).to.have.length(4);
      expect( cy.$('#new-node').isNode() ).to.be.true;

    });

    it('adds via single object (inferred node) with int id', function(){

      cy.add({
        data: { id: 0 }
      });

      expect( cy.$('#0') ).to.have.length(1);
      expect( cy.nodes() ).to.have.length(4);
      expect( cy.$('#0').isNode() ).to.be.true;

    });

    it('adds via single object (inferred edge) with int id', function(){

      cy.add({
        data: { id: 0 }
      });

      cy.add({
        data: { id: 1 }
      });

      cy.add({
        data: { id: 2, source: 0, target: 1 }
      });

      expect( cy.$('#0') ).to.have.length(1);
      expect( cy.nodes() ).to.have.length(5);
      expect( cy.$('#0').isNode() ).to.be.true;

      expect( cy.$('#1') ).to.have.length(1);
      expect( cy.nodes() ).to.have.length(5);
      expect( cy.$('#1').isNode() ).to.be.true;

      expect( cy.$('#2') ).to.have.length(1);
      expect( cy.edges() ).to.have.length(3);
      expect( cy.$('#2').isEdge() ).to.be.true;
    });

    it('adds via single object (inferred edge)', function(){

      cy.add({
        data: { id: 'new-edge', source: 'n1', target: 'n2' }
      });

      expect( cy.$('#new-edge') ).to.have.length(1);
      expect( cy.edges() ).to.have.length(3);
      expect( cy.$('#new-edge').isEdge() ).to.be.true;

    });

    it('adds via array of objects', function(){

      cy.add([
        {
          group: 'edges',
          data: { id: 'new-edge', source: 'n1', target: 'new-node' }
        },

        {
          group: 'nodes',
          data: { id: 'new-node' }
        }
      ]);

      expect( cy.$('#new-node') ).to.have.length(1);
      expect( cy.$('#new-node').inside() ).to.be.true;
      expect( cy.$('#new-edge') ).to.have.length(1);
      expect( cy.$('#new-edge').inside() ).to.be.true;

    });

    it('adds via collection', function(){

      var edges = cy.$('edge').remove();

      cy.add( edges );

      expect( cy.$('#n1n2') ).to.have.length(1);
      expect( cy.$('#n1n2').inside() ).to.be.true;
      expect( cy.$('#n2n3') ).to.have.length(1);
      expect( cy.$('#n2n3').inside() ).to.be.true;

    });

    it('adds with a bypass that alters bounds', function(){
      cy.add({
        data: { id: 'foo' },
        style: {
          'border-width': 10
        }
      });

      expect( cy.$('#foo').numericStyle('border-width') ).to.equal(10);
    });


  });

  describe('eles.restore()', function(){

    it('restores a node', function(){
      var n1 = cy.$('#n1');

      n1.remove();
      expect( n1.removed() ).to.be.true;
      expect( cy.$('#n1') ).to.have.length(0);

      n1.restore();
      expect( n1.removed() ).to.be.false;
      expect( cy.$('#n1') ).to.have.length(1);
      expect( n1.degree() ).to.equal(0);
    });

  });

  describe('cy.remove()', function(){

    it('removes a single node', function(){
      var n1 = cy.$('#n1');

      cy.remove(n1);

      expect( cy.nodes() ).to.have.length(2);
      expect( cy.$('#n2') ).to.have.length(1);
      expect( cy.$('#n3') ).to.have.length(1);
      expect( n1.removed() ).to.be.true;
      expect( cy.$('#n1') ).to.have.length(0);

    });

    it('correctly removes an edge repeatedly', function(){
      var n1n2 = cy.$('#n1n2');

      for( var i = 0; i < 10; i++ ){
        cy.remove( n1n2 );

        expect( cy.edges() ).to.have.length(1);
        expect( cy.$('#n1') ).to.have.length(1);
        expect( cy.$('#n2') ).to.have.length(1);
        expect( cy.$('#n3') ).to.have.length(1);
        expect( cy.$('#n2n3') ).to.have.length(1);
        expect( n1n2.removed() ).to.be.true;
        expect( cy.$("#n1").degree() ).to.equal(0);
        expect( cy.$("#n2").degree() ).to.equal(1);

        cy.add( n1n2 );

        expect( cy.$("#n1").degree() ).to.equal(1);
        expect( cy.$("#n2").degree() ).to.equal(2);
        expect( cy.$('#n1n2') ).to.have.length(1);
        expect( n1n2.removed() ).to.be.false;
      }

    });

    it('removes a parallel edge headlessly', function(){
      // re. headlessly calling edge.isBundledBezier() #2377

      var cy = cytoscape({
        headless: true,
        styleEnabled: false, // important
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          {
            data: {
              id: 'ab2',
              source: 'a',
              target: 'b'
            }
          },
          {
            data: {
              id: 'ab1',
              source: 'a',
              target: 'b'
            }
          }]
      });

      cy.edges()[0].remove();

      expect(cy.edges().length, 'number of edges (A)').to.equal(1);
      expect(cy.nodes().length, 'number of nodes (A)').to.equal(2);

      cy.edges()[0].remove();

      expect(cy.edges().length, 'number of edges (B)').to.equal(0);
      expect(cy.nodes().length, 'number of nodes (B)').to.equal(2);
    });

    it('removes via selector', function(){
      cy.remove('edge');

      expect( cy.edges() ).to.have.length(0);
    });

  });

  describe('cy.collection()', function(){

    it('gets an empty collection', function(){
      var col = cy.collection();

      expect( col ).to.have.length(0);
      expect( col[0] ).to.be.undefined;
    });

    it('creates a removed element', function(){
      var col = cy.collection([{ data: { id: 'a' } }], { removed: true });

      expect( col ).to.have.length(1);
      expect( col[0].removed() ).to.be.true;
      expect( cy.$('node#a') ).to.have.length(0);
    });

    it('restores created element successfully to graph', function(){
      var col = cy.collection([{ data: { id: 'a' } }], { removed: true });

      expect( col ).to.have.length(1);
      expect( col[0].removed() ).to.be.true;
      expect( cy.$('node#a') ).to.have.length(0);

      col.restore();
      expect( cy.$('node#a') ).to.have.length(1);
    });

    it('removes non-existing parent of restored element', function(){
      var parent = cy.collection([{ data: { id: 'parent' } }], { removed: true })[0];
      var col = cy.collection([{ data: { id: 'a' }, parent: parent }], { removed: true });

      expect( col ).to.have.length(1);
      expect( col[0].removed() ).to.be.true;
      expect( cy.$('node#a') ).to.have.length(0);
      expect( cy.$('node#parent') ).to.have.length(0);

      col.restore();
      expect( cy.$('node#a') ).to.have.length(1);
      expect( cy.$('node#a').parent() ).to.have.length(0);
    });
  });

  describe('cy.$() et al', function(){

    it('cy.$()', function(){
      expect( cy.$('node#n1') ).to.have.length(1);
    });

    it('cy.elements()', function(){
      expect( cy.elements('node#n1') ).to.have.length(1);
    });

    it('cy.nodes()', function(){
      expect( cy.nodes('#n1') ).to.have.length(1);
    });

    it('cy.edges()', function(){
      expect( cy.edges('#n1n2') ).to.have.length(1);
    });

    it('cy.filter() with selector', function(){
      expect( cy.filter('node#n1') ).to.have.length(1);
    });

    it('cy.filter() with function', function(){
      expect( cy.filter(function(ele, i){
        return ele.id() === 'n1';
      }) ).to.have.length(1);
    });

    it('cy.$() returns immutible collection', function(){
      var eles = cy.$();
      var length = eles.length;

      cy.add({ data: { id: 'foo' } });

      expect( eles.length ).to.equal( length );
      expect( eles.filter('#foo').empty() ).to.be.true;
    });

    it('cy.getElementById() gets element for string id', function(){
      var ele = cy.getElementById('n1');

      expect(ele.nonempty()).to.be.true;
      expect(ele.data('foo')).to.equal('one');
    });

    it('cy.getElementById() gets element for int id', function(){
      cy.add({ data: { id: 4, foo: "four", weight: 1 }, classes: "even four" });

      var ele = cy.getElementById(4);

      expect(ele.nonempty()).to.be.true;
      expect(ele.data('foo')).to.equal('four');
    });

    it('cy.getElementById() gets empty collection for non-matching string id', function(){
      var ele = cy.getElementById('n123');

      expect(ele.empty()).to.be.true;
    });

    it('cy.getElementById() gets empty collection for non-matching int id', function(){
      cy.add({ data: { id: 4, foo: "four", weight: 1 }, classes: "even four" });

      var ele = cy.getElementById(123);

      expect(ele.empty()).to.be.true;
    });

    it('cy.hasElementWithId() returns true for string id', function(){
      expect(cy.hasElementWithId('n1')).to.be.true;
    });

    it('cy.hasElementWithId() returns true for int id', function(){
      cy.add({ data: { id: 4, foo: "four", weight: 1 }, classes: "even four" });

      expect(cy.hasElementWithId(4)).to.be.true;
    });

    it('cy.hasElementWithId() returns false for non-matching string id', function(){
      expect(cy.hasElementWithId('n123')).to.be.false;
    });

    it('cy.hasElementWithId() returns true for non-matching int id', function(){
      expect(cy.hasElementWithId(123)).to.be.false;
    });

  });

  describe('cy.json()', function(){

    it('cy.json() adds element', function(){
      var cb = 0;
      cy.on('add', function(){ cb++; });

      cy.json({
        elements: [
          { group: 'nodes', data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
          { group: 'nodes', data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
          { group: 'nodes', data: { id: "n3", foo: "three", weight: 0.75 }, classes: "odd three" },
          { group: 'nodes', data: { id: "n4", foo: "four", weight: 1 }, classes: "even four" },
          { group: 'edges', data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
          { group: 'edges', data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
        ]
      });

      expect( cy.$('#n1').length ).to.equal(1);
      expect( cy.$('#n2').length ).to.equal(1);
      expect( cy.$('#n3').length ).to.equal(1);
      expect( cy.$('#n4').length ).to.equal(1);
      expect( cy.$('#n1n2').length ).to.equal(1);
      expect( cy.$('#n2n3').length ).to.equal(1);

      expect( cy.$('#n1').data('foo') ).to.equal('one');

      expect( cb ).to.equal(1);
    });

    it('cy.json() adds element via alt syntax', function(){
      var cb = 0;
      cy.on('add', function(){ cb++; });

      cy.json({
        elements: {
          nodes: [
              { data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
              { data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
              { data: { id: "n3", foo: "three", weight: 0.75 }, classes: "odd three" },
              { data: { id: "n4", foo: "four", weight: 1 }, classes: "even four" }
          ],

          edges: [
              { data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
              { data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
          ]
        }
      });

      expect( cy.$('#n1').length ).to.equal(1);
      expect( cy.$('#n2').length ).to.equal(1);
      expect( cy.$('#n3').length ).to.equal(1);
      expect( cy.$('#n4').length ).to.equal(1);
      expect( cy.$('#n1n2').length ).to.equal(1);
      expect( cy.$('#n2n3').length ).to.equal(1);

      expect( cy.$('#n1').data('foo') ).to.equal('one');

      expect( cb ).to.equal(1);
    });

    it('cy.json() moves edge', function(){
      cy.json({
        elements: [
          { group: 'nodes', data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
          { group: 'nodes', data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
          { group: 'nodes', data: { id: "n3", foo: "three", weight: 0.75 }, classes: "odd three" },
          { group: 'edges', data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
          { group: 'edges', data: { id: "n2n3", source: "n1", target: "n3", weight: 0.66 }, classes: "huh" }
        ]
      });

      expect( cy.$('#n1').length ).to.equal(1);
      expect( cy.$('#n2').length ).to.equal(1);
      expect( cy.$('#n3').length ).to.equal(1);
      expect( cy.$('#n1n2').length ).to.equal(1);
      expect( cy.$('#n2n3').length ).to.equal(1);

      expect( cy.$('#n2n3').source().id() ).to.equal('n1');
      expect( cy.$('#n2n3').target().id() ).to.equal('n3');
    });

    it('cy.json() moves node to new parent', function(){
      cy.json({
        elements: [
          { group: 'nodes', data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
          { group: 'nodes', data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
          { group: 'nodes', data: { id: "n3", foo: "three", weight: 0.75, parent: 'n1' }, classes: "odd three" },
          { group: 'edges', data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
          { group: 'edges', data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
        ]
      });

      expect( cy.$('#n1').length ).to.equal(1);
      expect( cy.$('#n2').length ).to.equal(1);
      expect( cy.$('#n3').length ).to.equal(1);
      expect( cy.$('#n1n2').length ).to.equal(1);
      expect( cy.$('#n2n3').length ).to.equal(1);

      expect( cy.$('#n3').parent().id() ).to.equal('n1');
    });

    it('cy.json() adds elements with preceding edge', function(){
      var cb = 0;
      cy.on('add', function(){ cb++; });

      cy.json({
        elements: [
          { data: { id: "ab", source: "a", target: "b" } },
          { data: { id: "a" } },
          { data: { id: "b" } }
        ]
      });

      expect( cy.$('#a').length ).to.equal(1);
      expect( cy.$('#b').length ).to.equal(1);
      expect( cy.$('#ab').length ).to.equal(1);

      expect( cb ).to.equal(3);
    });

    it('cy.json() removes element', function(){
      var cb = 0;
      cy.on('remove', function(){ cb++; });

      cy.json({
        elements: [
          { group: 'nodes', data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
          { group: 'nodes', data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" },
          { group: 'edges', data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
          { group: 'edges', data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
        ]
      });

      expect( cy.$('#n1').length ).to.equal(1);
      expect( cy.$('#n2').length ).to.equal(1);
      expect( cy.$('#n3').length ).to.equal(0);
      expect( cy.$('#n1n2').length ).to.equal(1);
      expect( cy.$('#n2n3').length ).to.equal(0); // because connected

      expect( cb ).to.equal(2);
    });

    it('cy.json() removes element via alt syntax', function(){
      var cb = 0;
      cy.on('remove', function(){ cb++; });

      cy.json({
        elements: {
          nodes: [
              { data: { id: "n1", foo: "one", weight: 0.25 }, classes: "odd one" },
              { data: { id: "n2", foo: "two", weight: 0.5 }, classes: "even two" }
          ],

          edges: [
              { data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
              { data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
          ]
        }
      });

      expect( cy.$('#n1').length ).to.equal(1);
      expect( cy.$('#n2').length ).to.equal(1);
      expect( cy.$('#n3').length ).to.equal(0);
      expect( cy.$('#n1n2').length ).to.equal(1);
      expect( cy.$('#n2n3').length ).to.equal(0); // because connected

      expect( cy.$('#n1').data('foo') ).to.equal('one');

      expect( cb ).to.equal(2);
    });

    it('cy.json() can remove all elements', function() {
        // Issue #2231
        var cb = 0;
        cy.on('remove', function() { cb++; });

        cy.json({
            elements: {
              nodes: [],
              edges: []
            }
        });

        expect( cy.$('#n1').length ).to.equal(0);
        expect( cy.$('#n2').length ).to.equal(0);
        expect( cy.$('#n3').length ).to.equal(0);
        expect( cy.$('#n1n2').length ).to.equal(0);
        expect( cy.$('#n2n3').length ).to.equal(0);

        expect( cb ).to.equal(5); // 3 nodes and 2 edges
    });

    it('cy.json() removes all but last element', function(){
      // clean up before test:
      cy.elements().remove();
      cy.add([
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { id: 'd' } }
      ]);

      cy.json({
        elements: [
          { data: { id: 'd' } }
        ]
      });

      expect( cy.$('#a').empty(), 'node a not in graph' ).to.be.true;
      expect( cy.$('#b').empty(), 'node b not in graph' ).to.be.true;
      expect( cy.$('#c').empty(), 'node c not in graph' ).to.be.true;
      expect( cy.$('#d').nonempty(), 'node d in graph' ).to.be.true;
    });

    it('cy.json() removes parent', function(){
      // clean up before test:
      cy.elements().remove();
      cy.add([
        { data: { id: 'a' } },
        { data: { id: 'b', parent: 'a' } },
        { data: { id: 'c', parent: 'a' } },
        { data: { id: 'e', source: 'b', target: 'c' } }
      ]);

      cy.json({
        elements: [
          // a is gone, rest same
          { data: { id: 'b' } },
          { data: { id: 'c' } },
          { data: { id: 'e', source: 'b', target: 'c' } }
        ]
      });

      expect( cy.$('#a').empty(), 'node a not in graph' ).to.be.true;
      expect( cy.$('#b').nonempty(), 'node b in graph' ).to.be.true;
      expect( cy.$('#c').nonempty(), 'node c in graph' ).to.be.true;
      expect( cy.$('#e').nonempty(), 'edge e in graph' ).to.be.true;
      expect( cy.$('#b').isOrphan(), 'b is orphan' ).to.be.true;
      expect( cy.$('#c').isOrphan(), 'c is orphan' ).to.be.true;
    });

    it('cy.json() removes parent and children', function(){
        // clean up before test:
        cy.elements().remove();
        cy.add([
            { data: { id: 'a' } },
            { data: { id: 'b', parent: 'a' } },
            { data: { id: 'c', parent: 'a' } },
            { data: { id: 'd' } }
        ]);

        cy.json({
            elements: [
                // a, b and c are gone
                { data: { id: 'd' } }
            ]
        });

        expect( cy.$('#a').empty(), 'node a not in graph' ).to.be.true;
        expect( cy.$('#b').empty(), 'node b not in graph' ).to.be.true;
        expect( cy.$('#c').empty(), 'node c not in graph' ).to.be.true;
        expect( cy.$('#d').nonempty(), 'node d in graph' ).to.be.true;
    });

    it('cy.json() removes parent and children with depth 2', function(){
        // clean up before test:
        cy.elements().remove();
        cy.add([
            { data: { id: 'a' } },
            { data: { id: 'b', parent: 'a' } },
            { data: { id: 'c', parent: 'b' } },
            { data: { id: 'd' } }
        ]);

        cy.json({
            elements: [
                // a, b and c are gone
                { data: { id: 'd' } }
            ]
        });

        expect( cy.$('#a').empty(), 'node a not in graph' ).to.be.true;
        expect( cy.$('#b').empty(), 'node b not in graph' ).to.be.true;
        expect( cy.$('#c').empty(), 'node c not in graph' ).to.be.true;
        expect( cy.$('#d').nonempty(), 'node d in graph' ).to.be.true;
    });

    it('cy.json() removes middle parent of depth 2', function(){
        // clean up before test:
        cy.elements().remove();
        cy.add([
            { data: { id: 'a' } },
            { data: { id: 'b', parent: 'a' } },
            { data: { id: 'c', parent: 'b' } },
            { data: { id: 'd' } }
        ]);

        cy.json({
            elements: [
                // Remove 'b' and parent of 'c' is 'a' now
                { data: { id: 'a' } },
                { data: { id: 'c', parent: 'a' } },
                { data: { id: 'd' } }
            ]
        });

        expect( cy.$('#a').nonempty(), 'node a in graph' ).to.be.true;
        expect( cy.$('#b').empty(), 'node b not in graph' ).to.be.true;
        expect( cy.$('#c').nonempty(), 'node c in graph' ).to.be.true;
        expect( cy.$('#d').nonempty(), 'node d in graph' ).to.be.true;
        expect( cy.$('#a').isParent(), 'a is parent' ).to.be.true;
        expect( cy.$('#c').parent().id(), 'parent of c is a' ).to.equal('a');
    });

    it('cy.json() orphans children via null', function(){
      // clean up before test:
      cy.elements().remove();
      cy.add([
        { data: { id: 'a' } },
        { data: { id: 'b', parent: 'a' } },
        { data: { id: 'c', parent: 'a' } },
        { data: { id: 'e', source: 'b', target: 'c' } }
      ]);

      cy.json({
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b', parent: null } },
          { data: { id: 'c', parent: null } },
          { data: { id: 'e', source: 'b', target: 'c' } }
        ]
      });

      expect( cy.$('#a').nonempty(), 'node a in graph' ).to.be.true;
      expect( cy.$('#b').nonempty(), 'node b in graph' ).to.be.true;
      expect( cy.$('#c').nonempty(), 'node c in graph' ).to.be.true;
      expect( cy.$('#e').nonempty(), 'edge e in graph' ).to.be.true;
      expect( cy.$('#a').isParent(), 'a is parent' ).to.be.false;
      expect( cy.$('#b').isOrphan(), 'b is orphan' ).to.be.true;
      expect( cy.$('#c').isOrphan(), 'c is orphan' ).to.be.true;
    });

    it('cy.json() orphans children via undefined', function(){
      // clean up before test:
      cy.elements().remove();
      cy.add([
        { data: { id: 'a' } },
        { data: { id: 'b', parent: 'a' } },
        { data: { id: 'c', parent: 'a' } },
        { data: { id: 'e', source: 'b', target: 'c' } }
      ]);

      cy.json({
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b', parent: undefined } },
          { data: { id: 'c', parent: undefined } },
          { data: { id: 'e', source: 'b', target: 'c' } }
        ]
      });

      expect( cy.$('#a').nonempty(), 'node a in graph' ).to.be.true;
      expect( cy.$('#b').nonempty(), 'node b in graph' ).to.be.true;
      expect( cy.$('#c').nonempty(), 'node c in graph' ).to.be.true;
      expect( cy.$('#e').nonempty(), 'edge e in graph' ).to.be.true;
      expect( cy.$('#a').isParent(), 'a is parent' ).to.be.false;
      expect( cy.$('#b').isOrphan(), 'b is orphan' ).to.be.true;
      expect( cy.$('#c').isOrphan(), 'c is orphan' ).to.be.true;
    });

    it('cy.json() sets existing node as parent', function(){
      // clean up before test:
      cy.elements().remove();
      cy.add([
        { data: { id: 'a' } },
        { data: { id: 'b' } }
      ]);

      cy.json({
        elements: [
          { data: { id: 'a', parent: 'b' } },
          { data: { id: 'b' } }
        ]
      });

      expect( cy.$('#a').nonempty(), 'node a in graph' ).to.be.true;
      expect( cy.$('#b').nonempty(), 'node b in graph' ).to.be.true;
      expect( cy.$('#a').parent().id(), 'parent of a' ).to.equal('b');
    });

    it('cy.json() sets a newly added node as parent', function(){
      // clean up before test:
      cy.elements().remove();
      cy.add([
        { data: { id: 'a' } },
        { data: { id: 'b' } },
      ]);

      cy.json({
        elements: [
          { data: { id: 'a', parent: 'c' } },
          { data: { id: 'b' } },
          { data: { id: 'c' } }
        ]
      });

      expect( cy.$('#a').nonempty(), 'node a in graph' ).to.be.true;
      expect( cy.$('#b').nonempty(), 'node b in graph' ).to.be.true;
      expect( cy.$('#c').nonempty(), 'node c in graph' ).to.be.true;
      expect( cy.$('#a').parent().id(), 'parent of a' ).to.equal('c');
      expect( cy.$('#b').isChild(), 'b is child' ).to.be.false;
      expect( cy.$('#c').isParent(), 'c is parent' ).to.be.true;
    });

    it('cy.json() removes parent and uses new parent', function(){
      // clean up before test:
      cy.elements().remove();
      cy.add([
        { data: { id: 'a' } },
        { data: { id: 'b', parent: 'a' } },
        { data: { id: 'c', parent: 'b' } },
        { data: { id: 'd', parent: 'b' } },
        { data: { id: 'e', source: 'c', target: 'd' } },
        { data: { id: 'f', source: 'a', target: 'd' } }
      ]);

      cy.json({
        elements: [
          { data: { id: 'a' } },
          // b is gone
          { data: { id: 'c', parent: 'a' } }, // new parent a
          { data: { id: 'd', parent: 'a' } }, // new parent a
          { data: { id: 'e', source: 'c', target: 'd' } },
          { data: { id: 'f', source: 'a', target: 'd' } }
        ]
      });

      expect( cy.$('#a').nonempty(), 'node a in graph' ).to.be.true;
      expect( cy.$('#b').empty(), 'node b not in graph' ).to.be.true;
      expect( cy.$('#c').nonempty(), 'node c in graph' ).to.be.true;
      expect( cy.$('#d').nonempty(), 'node c in graph' ).to.be.true;
      expect( cy.$('#e').nonempty(), 'edge e in graph' ).to.be.true;
      expect( cy.$('#f').nonempty(), 'edge f in graph' ).to.be.true;
      expect( cy.$('#c').parent().id(), 'c parent' ).to.equal('a');
      expect( cy.$('#d').parent().id(), 'd parent' ).to.equal('a');
    });

    it('cy.json() updates style', function(){
      cy.json({
        style: [
          {
            selector: 'node',
            style: {
              'background-color': 'red'
            }
          }
        ]
      });

      var styleColor = cy.$('#n1').style('background-color');

      cy.$('#n1').style('background-color', 'red');

      var bypassColor = cy.$('#n1').style('background-color');

      expect( styleColor ).to.equal( bypassColor );
    });

    it('cy.json() sets zoom', function(){
      var cb = 0;
      cy.on('zoom', function(){ cb++; });

      cy.json({
        zoom: 3
      });

      expect( cy.zoom() ).to.equal(3);
      expect( cb ).to.equal(1);
    });

    it('cy.json() sets pan', function(){
      cy.json({
        pan: { x: 100, y: 200 }
      });

      expect( cy.pan() ).to.deep.equal({ x: 100, y: 200 });
    });

    it('cy.json() sets one dim of pan', function(){
      var cb = 0;
      cy.on('pan', function(){ cb++; });

      cy.json({
        pan: { x: 100 }
      });

      expect( cy.pan().x ).to.equal(100);

      cy.json({
        pan: { y: 200 }
      });

      expect( cy.pan().x ).to.equal(100);
      expect( cy.pan().y ).to.equal(200);

      expect( cb ).to.equal(2);
    });

    it('cy.json() sets userPanningEnabled', function(){
      cy.json({
        userPanningEnabled: false
      });

      expect( cy.userPanningEnabled() ).to.equal( false );

      cy.json({
        userPanningEnabled: true
      });

      expect( cy.userPanningEnabled() ).to.equal( true );
    });

    it('cy.json() gets data', function(){
      cy.data({ foo: 'bar' });

      var json = cy.json();

      expect(json.data.foo).to.equal('bar');
    });

    it('cy.json() sets data', function(){
      cy.json({ data: { foo: 'bar' } });

      expect(cy.data('foo')).to.equal('bar');
    });
  });

  describe('cy.data()', function(){ // only basic test for now b/c shared impl w/ eles...
    it('sets and gets data', function(){
      cy.data({ foo: 'bar' });

      expect(cy.data('foo')).to.equal('bar');
    });

    // TODO more tests in future
  });

  describe('cy.style()', function(){
    describe('cy.style.json()', function(){
      it('property with multiple values is serialised including units', function(){
        var json = cy.style().json();

        expect( json[0].style['background-width'] === '50% 50%' );
      });
    });
  });

  describe('cy.zoom()', function(){
    describe('cy.zoom(number)', function() {
      it('should not return a negative value', function() {
        cy.zoom(-10);
        expect(cy.zoom() >= 0).to.equal(true);
      });
    });

    describe('cy.zoom({level: number})', function() {
      it('should not return a negative value', function() {
        cy.zoom({level: -10});
        expect(cy.zoom() >= 0).to.equal(true);
      });
    });
  });
});
