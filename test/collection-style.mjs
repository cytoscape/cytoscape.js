var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

describe('Collection style', function(){

  var cy;

  // test setup
  beforeEach(function(){
    cy = cytoscape({
      styleEnabled: true,

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

      style: [
        {
          selector: '#n1',
          style: {
            label: function(){ return 'n1'; },
            width: 20,
            'background-image': ['/test/image.png', '/test/image2.png'],
            opacity: 0.5
          }
        },

        {
          selector: '#n2',
          style: {
            label: function(){ return 'n2'; }
          }
        },

        {
          selector: '.transition',
          style: {
            'width': 300,
            'transition-property': 'width',
            'transition-timing-function': 'linear',
            'transition-duration': 50
          }
        },

        {
          selector: '.transition-prop',
          style: {
            'transition-property': 'width, background-color',
            'transition-timing-function': 'linear',
            'transition-duration': 50
          }
        },

        {
          selector: '.transition-multiple',
          style: {
            'transition-property': 'width, background-color',
            'transition-timing-function': 'linear',
            'transition-duration': 50,
            'width': 300,
            'background-color': 'black'
          }
        },

        {
          selector: '#n2n3',
          style: {
            'curve-style': 'bezier'
          }
        },

        {
          selector: '#n2n3',
          style: {
            'curve-style': 'haystack'
          }
        }
      ]
    });
  });

  afterEach(function(){
    cy.destroy();
  });


  describe('eles.style() etc', function(){

    it('eles.style() gets a name-value pair object', function(){
      var style = cy.$('#n1').style();

      expect( style ).to.be.an('object');
      expect( style ).to.have.property('background-color');
      expect( style['background-color'] ).to.exist;
    });

    it('eles.style(name, val) gets and sets the specified property', function(){
      var n1 = cy.$('#n1');

      n1.style('width', '10px');

      expect( n1.style('width') ).to.equal('10px');
    });

    it('eles.style({}) sets the specified properties', function(){
      var n1 = cy.$('#n1');

      n1.style({
        height: '10px',
        width: '20px'
      });

      expect( n1.style('height') ).to.equal('10px');
      expect( n1.style('width') ).to.equal('20px');
    });

    it('eles.removeStyle() clears bypassed style', function(){
      var n1 = cy.$('#n1');

      n1.style({
        height: '999px'
      });

      n1.removeStyle();

      expect( n1.style('height') ).to.not.equal('999px');
    });

    it('eles.show() sets `display: element`', function(){
      var n1 = cy.$('#n1');

      n1.show();

      expect( n1.style('display') ).to.equal('element');
      expect( n1.visible() ).to.be.true;
    });

    it('eles.hide() sets `display: none`', function(){
      var n1 = cy.$('#n1');

      n1.hide();

      expect( n1.style('display') ).to.equal('none');
      expect( n1.hidden() ).to.be.true;
    });

    it('ele.effectiveOpacity() is correct for child', function(){
      cy.add([
        { group: 'nodes', data: { id: 'p' } },
        { group: 'nodes', data: { id: 'c', parent: 'p' } }
      ]);

      cy.$('#p').style('opacity', 0.5);
      cy.$('#c').style('opacity', 0.5);

      expect( cy.$('#c').effectiveOpacity() ).to.equal(0.25);
      expect( cy.$('#p').transparent() ).to.be.false;

      cy.$('#p').style('opacity', 0);

      expect( cy.$('#p').effectiveOpacity() ).to.equal(0);
      expect( cy.$('#p').transparent() ).to.be.true;
    });

    it('eles.style() gets correct value when using function prop value (n1)', function(){
      var style = cy.$('#n1').style();

      expect( style ).to.be.an('object');
      expect( style ).to.have.property('label');
      expect( style['label'] ).to.exist;
      expect( style['label'] ).to.equal( 'n1' );
    });

    it('eles.style() gets correct value when using function prop value (n2)', function(){
      var style = cy.$('#n2').style();

      expect( style ).to.be.an('object');
      expect( style ).to.have.property('label');
      expect( style['label'] ).to.exist;
      expect( style['label'] ).to.equal( 'n2' );
    });

    it('ele.style(propName) works for string array property value', function(){
      expect( cy.$('#n1').style('background-image') ).to.deep.equal( '/test/image.png /test/image2.png' );
    });

    it('ele.style(propName) works for pixel property value', function(){
      expect( cy.$('#n1').style('width') ).to.equal('20px');
    });

    it('ele.style(propName) works for unitless property value', function(){
      expect( cy.$('#n1').style('opacity') ).to.equal('0.5');
    });

    it('ele.numericStyle() returns size as a number', function(){
      var ret = cy.$('#n1').style('width', '30px').numericStyle('width');

      expect( ret ).to.be.finite;
      expect( ret ).to.equal( 30 );
      expect( cy.$('#n1').numericStyleUnits('width') ).to.equal('px');
    });

    it('ele.numericStyle() returns colour as [r, g, b]', function(){
      var ret = cy.$('#n1').style('background-color', 'rgb(0, 1, 2)').numericStyle('background-color');

      expect( ret ).to.be.an.instanceof(Array);
      expect( ret ).to.have.property('length', 3);
      expect( ret[0] ).to.equal( 0 );
      expect( ret[1] ).to.equal( 1 );
      expect( ret[2] ).to.equal( 2 );
      expect( cy.$('#n1').numericStyleUnits('background-color') ).to.not.exist;
    });

    it('ele.numericStyle() returns red as [255, 0, 0]', function(){
      var ret = cy.$('#n1').style('background-color', 'red').numericStyle('background-color');

      expect( ret ).to.be.an.instanceOf(Array);
      expect( ret ).to.have.property('length', 3);
      expect( ret[0] ).to.equal( 255 );
      expect( ret[1] ).to.equal( 0 );
      expect( ret[2] ).to.equal( 0 );
      expect( cy.$('#n1').numericStyleUnits('background-color') ).to.not.exist;
    });

    it('ele.numericStyle() returns opacity as number', function(){
      var ret = cy.$('#n1').style('opacity', 0.5).numericStyle('opacity');

      expect( ret ).to.be.finite;
      expect( ret ).to.equal( 0.5 );
      expect( cy.$('#n1').numericStyleUnits('opacity') ).to.not.exist;
    });

    it('ele.numericStyle() returns pixel value for padding', function(){
      var ret = cy.$('#n1').style('padding', '10px').numericStyle('padding');

      expect( ret ).to.be.finite;
      expect( ret ).to.equal( 10 );
      expect( cy.$('#n1').numericStyleUnits('padding') ).to.equal('px');
    });

    it('ele.numericStyle() returns percent value for padding', function(){
      var ret = cy.$('#n1').style('padding', '50%').numericStyle('padding');

      expect( ret ).to.be.finite;
      expect( ret ).to.equal( 0.5 );
      expect( cy.$('#n1').numericStyleUnits('padding') ).to.equal('%');
    });

    it('ele.renderedStyle() returns single val with zoom', function(){
      cy.zoom(2);

      var ret = cy.$('#n1').style('width', '10px').renderedStyle('width');

      expect( ret ).to.equal('20px');
    });

    it('ele.renderedStyle() returns multiple vals with zoom', function(){
      cy.zoom(2);

      var ret1 = cy.$('#n1').style('width', '10px').renderedStyle('width');
      var ret2 = cy.$('#n1').style('height', '20px').renderedStyle('height');

      expect( ret1 ).to.equal('20px');
      expect( ret2 ).to.equal('40px');
    });

    it('ele.visible() true by default', function(){
      expect( cy.$('#n1').visible() ).to.be.true;
    });

    it('ele.visible() false for `display: none`', function(){
      expect( cy.$('#n1').style('display', 'none').visible() ).to.be.false;
    });

    it('ele.visible() false for `width: 0`', function(){
      expect( cy.$('#n1').style('width', 0).visible() ).to.be.false;
    });

    it('ele.visible() false for `height: 0`', function(){
      expect( cy.$('#n1').style('height', 0).visible() ).to.be.false;
    });

    it('ele.visible() false for edge with `display: none` source', function(){
      cy.$('#n1').style('display', 'none');

      expect( cy.$('#n1n2').visible() ).to.be.false;
    });

    it('ele.visible() false for edge with `width: 0` source', function(){
      cy.$('#n1').style('width', 0);

      expect( cy.$('#n1n2').visible() ).to.be.false;
    });

    it('ele.visible() false for edge with `height: 0` source', function(){
      cy.$('#n1').style('height', 0);

      expect( cy.$('#n1n2').visible() ).to.be.false;
    });

    it('ele.visible() false for edge with `display: none` target', function(){
      cy.$('#n2').style('display', 'none');

      expect( cy.$('#n1n2').visible() ).to.be.false;
    });

    it('ele.visible() false for edge with `width: 0` target', function(){
      cy.$('#n2').style('width', 0);

      expect( cy.$('#n1n2').visible() ).to.be.false;
    });

    it('ele.visible() false for edge with `height: 0` target', function(){
      cy.$('#n2').style('height', 0);

      expect( cy.$('#n1n2').visible() ).to.be.false;
    });

    it('ele.visible() false for `visibility: hidden`', function(){
      expect( cy.$('#n1').style('visibility', 'hidden').visible() ).to.be.false;
    });

    it('ele.visible() false for `opacity: 0`', function(){
      expect( cy.$('#n1').style('opacity', 0).visible() ).to.be.false;
    });

    it('ele.visible() false for parent `opacity: 0`', function(){
      cy.add([
        { data: { id: 'p' } },
        { data: { id: 'c', parent: 'p' } }
      ]);

      cy.$('#p').style('opacity', 0);

      expect( cy.$('#c').visible() ).to.be.false;
    });

    it('ele.visible() false for parent `display: none`', function(){
      cy.add([
        { data: { id: 'p' } },
        { data: { id: 'c', parent: 'p' } }
      ]);

      cy.$('#p').style('display', 'none');

      expect( cy.$('#c').visible() ).to.be.false;
    });

    it('ele.visible() false for parent `visibility: hidden`', function(){
      cy.add([
        { data: { id: 'p' } },
        { data: { id: 'c', parent: 'p' } }
      ]);

      cy.$('#p').style('visibility', 'hidden');

      expect( cy.$('#c').visible() ).to.be.false;
    });

    it('ele.takesUpSpace() true by default', function(){
      expect( cy.$('#n1').takesUpSpace() ).to.be.true;
    });

    it('ele.takesUpSpace() true for `visibility: hidden`', function(){
      expect( cy.$('#n1').style('visibility', 'hidden').takesUpSpace() ).to.be.true;
    });

    it('ele.takesUpSpace() false for `display: none`', function(){
      expect( cy.$('#n1').style('display', 'none').takesUpSpace() ).to.be.false;
    });

    it('ele.takesUpSpace() false for `width: 0`', function(){
      expect( cy.$('#n1').style('width', 0).takesUpSpace() ).to.be.false;
    });

    it('ele.takesUpSpace() false for `height: 0`', function(){
      expect( cy.$('#n1').style('height', 0).takesUpSpace() ).to.be.false;
    });

    it('ele.takesUpSpace() false for edge with source `display: none`', function(){
      cy.$('#n1').style('display', 'none');
      expect( cy.$('#n1n2').takesUpSpace() ).to.be.false;
    });

    it('ele.takesUpSpace() false for edge with source `width: 0`', function(){
      cy.$('#n1').style('width', 0);
      expect( cy.$('#n1n2').takesUpSpace() ).to.be.false;
    });

    it('ele.takesUpSpace() false for edge with source `height: 0`', function(){
      cy.$('#n1').style('height', 0);
      expect( cy.$('#n1n2').takesUpSpace() ).to.be.false;
    });

    it('ele.takesUpSpace() true for edge with source `visibility: hidden`', function(){
      cy.$('#n1').style('visibility', 'hidden');
      expect( cy.$('#n1n2').takesUpSpace() ).to.be.true;
    });

    it('ele.takesUpSpace() true for edge with source `opacity: 0`', function(){
      cy.$('#n1').style('opacity', 0);
      expect( cy.$('#n1n2').takesUpSpace() ).to.be.true;
    });

    it('ele.takesUpSpace() false for edge with target `display: none`', function(){
      cy.$('#n2').style('display', 'none');
      expect( cy.$('#n1n2').takesUpSpace() ).to.be.false;
    });

    it('ele.takesUpSpace() false for edge with target `width: 0`', function(){
      cy.$('#n2').style('width', 0);
      expect( cy.$('#n1n2').takesUpSpace() ).to.be.false;
    });

    it('ele.takesUpSpace() false for edge with target `height: 0`', function(){
      cy.$('#n2').style('height', 0);
      expect( cy.$('#n1n2').takesUpSpace() ).to.be.false;
    });

    it('ele.takesUpSpace() true for edge with target `visibility: hidden`', function(){
      cy.$('#n2').style('visibility', 'hidden');
      expect( cy.$('#n1n2').takesUpSpace() ).to.be.true;
    });

    it('ele.takesUpSpace() true for edge with target `opacity: 0`', function(){
      cy.$('#n2').style('opacity', 0);
      expect( cy.$('#n1n2').takesUpSpace() ).to.be.true;
    });

    it('ele.interactive() true by default', function(){
      expect( cy.$('#n1').interactive() ).to.be.true;
    });

    it('ele.interactive() false for `events: no`', function(){
    expect( cy.$('#n1').style('events', 'no').interactive() ).to.be.false;
    });

    it('ele.interactive() false for `visibility: hidden`', function(){
      expect( cy.$('#n1').style('visibility', 'hidden').interactive() ).to.be.false;
    });

    it('ele.interactive() false for `display: none`', function(){
      expect( cy.$('#n1').style('display', 'none').interactive() ).to.be.false;
    });

    it('ele.interactive() false for `width: 0`', function(){
      expect( cy.$('#n1').style('width', 0).interactive() ).to.be.false;
    });

    it('ele.interactive() false for `height: 0`', function(){
      expect( cy.$('#n1').style('height', 0).interactive() ).to.be.false;
    });

    it('ele.interactive() false for edge with source `display: none`', function(){
      cy.$('#n1').style('display', 'none');
      expect( cy.$('#n1n2').interactive() ).to.be.false;
    });

    it('ele.interactive() false for edge with source `width: 0`', function(){
      cy.$('#n1').style('width', 0);
      expect( cy.$('#n1n2').interactive() ).to.be.false;
    });

    it('ele.interactive() false for edge with source `height: 0`', function(){
      cy.$('#n1').style('height', 0);
      expect( cy.$('#n1n2').interactive() ).to.be.false;
    });

    it('ele.interactive() true for edge with source `visibility: hidden`', function(){
      cy.$('#n1').style('visibility', 'hidden');
      expect( cy.$('#n1n2').interactive() ).to.be.true;
    });

    it('ele.interactive() true for edge with source `opacity: 0`', function(){
      cy.$('#n1').style('opacity', 0);
      expect( cy.$('#n1n2').interactive() ).to.be.true;
    });

    it('ele.interactive() true for edge with source `events: no`', function(){
      cy.$('#n1').style('events', 'no');
      expect( cy.$('#n1n2').interactive() ).to.be.true;
    });

    it('ele.interactive() false for edge with target `display: none`', function(){
      cy.$('#n2').style('display', 'none');
      expect( cy.$('#n1n2').interactive() ).to.be.false;
    });

    it('ele.interactive() false for edge with target `width: 0`', function(){
      cy.$('#n2').style('width', 0);
      expect( cy.$('#n1n2').interactive() ).to.be.false;
    });

    it('ele.interactive() false for edge with target `height: 0`', function(){
      cy.$('#n2').style('height', 0);
      expect( cy.$('#n1n2').interactive() ).to.be.false;
    });

    it('ele.interactive() true for edge with target `visibility: hidden`', function(){
      cy.$('#n2').style('visibility', 'hidden');
      expect( cy.$('#n1n2').interactive() ).to.be.true;
    });

    it('ele.interactive() true for edge with target `opacity: 0`', function(){
      cy.$('#n2').style('opacity', 0);
      expect( cy.$('#n1n2').interactive() ).to.be.true;
    });

    it('ele.interactive() true for edge with target `events: no`', function(){
      cy.$('#n2').style('events', 'no');
      expect( cy.$('#n1n2').interactive() ).to.be.true;
    });

    it('ele.interactive() true for parent `events: no`', function(){
      cy.add([
        { data: { id: 'p' } },
        { data: { id: 'c', parent: 'p' } }
      ]);

      cy.$('#p').style('events', 'no');

      expect( cy.$('#c').visible() ).to.be.true;
    });

    it('ele.interactive() true for parent `events: no`', function(){
      cy.add([
        { data: { id: 'p' } },
        { data: { id: 'c', parent: 'p' } }
      ]);

      cy.$('#p').style('events', 'no');

      expect( cy.$('#c').visible() ).to.be.true;
    });

    it('ele.isBundledBezier() true for `curve-style: bezier`', function(){
      var edges = cy.add([
        { data: { id: 'bez1', source: 'n1', target: 'n2' } },
        { data: { id: 'bez2', source: 'n1', target: 'n2' } },
        { data: { id: 'bez3', source: 'n1', target: 'n2' } }
      ]);

      edges.style('curve-style', 'bezier');

      edges.forEach(function(edge){
        expect(edge.isBundledBezier(), edge.id()).to.be.true;
      });
    });

    it('ele.isBundledBezier() false for style disabled', function(){
      var cy = cytoscape({
        headless: true,
        styleEnabled: false,
        elements: [
          { data: { id: 'n1' } },
          { data: { id: 'n2' } }
        ]
      });

      var edges = cy.add([
        { data: { id: 'bez1', source: 'n1', target: 'n2' } },
        { data: { id: 'bez2', source: 'n1', target: 'n2' } },
        { data: { id: 'bez3', source: 'n1', target: 'n2' } }
      ]);

      // this should be a nop
      edges.style('curve-style', 'bezier');

      edges.forEach(function(edge){
        expect(edge.isBundledBezier(), edge.id()).to.be.false;
      });
    });

    it('ele.style() reads OK for mapped override prop', function(){
      cy.style().fromJson([
        {
          selector: '#n1n2',
          style: {
            'curve-style': 'unbundled-bezier',
            'control-point-distances': function(ele){ return [32, 128]; },
            'control-point-weights': [0.5, 0.75]
          }
        }
      ]).update();

      var d = cy.$('#n1n2').numericStyle('control-point-distances');

      expect(d, 'control-point-distances').to.deep.equal([32, 128]);
    });
  });

  describe('eles.addClass() etc', function(){

    var n1;
    var n2;

    beforeEach(function(){
      n1 = cy.$('#n1');
      n2 = cy.$('#n2');
    });

    it('eles.addClass() adds class', function(){
      n1.addClass('foo');

      expect( n1.hasClass('foo') ).to.be.true;
    });

    it('eles.addClass() adds classes', function(){
      n1.addClass('foo bar');

      expect( n1.hasClass('foo') ).to.be.true;
      expect( n1.hasClass('bar') ).to.be.true;
    });

    it('eles.addClass() adds classes with an array', function(){
      n1.addClass(['foo', 'bar']);

      expect( n1.hasClass('foo') ).to.be.true;
      expect( n1.hasClass('bar') ).to.be.true;
    });

    it('eles.removeClass() removes class', function(){
      n1.addClass('foo');
      n1.removeClass('foo');

      expect( n1.hasClass('foo') ).to.be.false;
    });

    it('eles.removeClass() removes classes', function(){
      n1.addClass('foo bar');
      n1.removeClass('foo bar');

      expect( n1.hasClass('foo') ).to.be.false;
      expect( n1.hasClass('bar') ).to.be.false;
    });

    it('eles.removeClass() removes classes with an array', function(){
      n1.addClass(['foo', 'bar']);
      n1.removeClass(['foo', 'bar']);

      expect( n1.hasClass('foo') ).to.be.false;
      expect( n1.hasClass('bar') ).to.be.false;
    });

    it('eles.toggleClass() toggles class', function(){
      n1.addClass('foo');
      n1.toggleClass('foo');

      expect( n1.hasClass('foo') ).to.be.false;
    });

    it('eles.toggleClass() toggles classes', function(){
      n1.addClass('foo bar');
      n1.toggleClass('foo bar');

      expect( n1.hasClass('foo') ).to.be.false;
      expect( n1.hasClass('bar') ).to.be.false;
    });

    it('eles.toggleClass() toggles with an array of classes', function(){
      n1.addClass(['foo', 'bar']);
      n1.toggleClass(['foo', 'bar']);

      expect( n1.hasClass('foo') ).to.be.false;
      expect( n1.hasClass('bar') ).to.be.false;
    });

    it('eles.toggleClass() forces class', function(){
      n1.addClass('foo');
      n1.toggleClass('foo', false);

      expect( n1.hasClass('foo') ).to.be.false;
    });

    it('eles.toggleClass() forces classes', function(){
      n1.addClass('foo bar');
      n1.toggleClass('foo bar', false);

      expect( n1.hasClass('foo') ).to.be.false;
      expect( n1.hasClass('bar') ).to.be.false;
    });

    it('eles.classes() replaces classes (subset)', function(){
      ['foo', 'bar', 'baz'].forEach(function( c ){ n1.addClass(c); });

      n1.classes('foo');

      expect( n1.hasClass('foo') ).to.be.true;
      expect( n1.hasClass('bar') ).to.be.false;
      expect( n1.hasClass('baz') ).to.be.false;
    });

    it('eles.classes() replaces with an array of classes (subset)', function(){
      ['foo', 'bar', 'baz'].forEach(function( c ){ n1.addClass(c); });

      n1.classes(['foo', 'bar']);

      expect( n1.hasClass('foo') ).to.be.true;
      expect( n1.hasClass('bar') ).to.be.true;
      expect( n1.hasClass('baz') ).to.be.false;
    });

    it('eles.classes() replaces classes (all different)', function(){
      ['foo', 'bar', 'baz'].forEach(function( c ){ n1.addClass(c); });

      n1.classes('bat');

      expect( n1.hasClass('bat') ).to.be.true;
      expect( n1.hasClass('foo') ).to.be.false;
      expect( n1.hasClass('bar') ).to.be.false;
      expect( n1.hasClass('baz') ).to.be.false;
    });

    it('eles.classes() replaces with an array of classes (all different)', function(){
      ['foo', 'bar', 'baz'].forEach(function( c ){ n1.addClass(c); });

      n1.classes(['bat', 'bot']);

      expect( n1.hasClass('bat') ).to.be.true;
      expect( n1.hasClass('bot') ).to.be.true;
      expect( n1.hasClass('foo') ).to.be.false;
      expect( n1.hasClass('bar') ).to.be.false;
      expect( n1.hasClass('baz') ).to.be.false;
    });

    it('eles.classes() gets list of classes', function(){
      var classes = ['foo', 'bar', 'baz'];

      classes.forEach(function( c ){ n1.addClass(c); });

      expect( n1.classes().sort() ).to.deep.equal( classes.sort() );
    });

    it('eles.addClass() adds class to json', function(){
      n1.addClass('foo');

      expect( n1.json().classes ).to.equal('foo');
    });

    it('eles.removeClass() removes class from json', function(){
      n1.addClass('foo');
      n1.removeClass('foo');

      expect( n1.json().classes ).to.be.empty;
    });

    it('initializes classes with a string', function(){
      cytoscape({
        headless: true,

        elements: {
          nodes: [{
            data: { id: 'n1' },
            classes: 'foo bar'
          }]
        },
        ready: function(){
          var cy = this;
          var n1 = cy.$('#n1');
          expect( n1.hasClass('foo') ).to.be.true;
          expect( n1.hasClass('bar') ).to.be.true;
        }
      });
    });

    it('initializes classes with an array', function(){
      cytoscape({
        headless: true,

        elements: {
          nodes: [{
            data: { id: 'n1' },
            classes: [ 'foo', 'bar' ]
          }]
        },
        ready: function(){
          var cy = this;
          var n1 = cy.$('#n1');
          expect( n1.hasClass('foo') ).to.be.true;
          expect( n1.hasClass('bar') ).to.be.true;
        }
      });
    });

  });

  describe('eles.animate() etc', function(){

    var n1;
    var n2;

    beforeEach(function(){
      n1 = cy.$('#n1');
      n2 = cy.$('#n2');
    });

    it('ele.animate() results in end style', function( next ){
      n1.animate({
        style: { width: 200 },
        complete: function(){
          expect( parseFloat(n1.style().width) ).to.equal(200);
          next();
        },
        duration: 100
      });
    });

    it('ele.animate() calls step function', function( next ){
      var stepCalls = 0;

      n1.animate({
        style: { width: 200 },
        step: function(){
          var w = parseFloat(n1.style().width);

          expect(w).to.be.at.most(200);
          expect(w).to.be.at.least(20);

          stepCalls++;
        },
        complete: function(){
          expect(stepCalls).to.be.above(0);
          next();
        },
        duration: 100
      });
    });

    it('eles.animate() results in end style', function( next ){
      var c = 0;
      function complete(){
        c++;

        if( c === 2 ){
          expect( parseFloat(n1.style().width) ).to.equal(200);
          expect( parseFloat(n2.style().width) ).to.equal(200);
          next();
        }
      }

      n1.add(n2).animate({
        style: { width: 200 },
        complete: complete,
        duration: 100
      });
    });

    it('ele.animation() results in end style', function( next ){
      n1.animation({
        style: { width: 200 },
        duration: 100
      }).play().promise().then(function(){
        expect( parseFloat(n1.style().width) ).to.equal(200);
        next();
      });
    });

    it('ani.playing()', function(){
      var ani = n1.animation({
        style: { width: 200 },
        duration: 100
      });

      expect( ani.playing() ).to.be.false;

      ani.play();

      expect( ani.playing() ).to.be.true;

      return ani.promise().then(function(){
        expect( ani.playing() ).to.be.false;
      });
    });

    it('ani.pause()', function( next ){
      var ani = n1.animation({
        style: { width: 200 },
        duration: 200
      });

      ani.play();

      var w;

      setTimeout(function(){
        ani.pause();

        w = n1.style('width');
      }, 100);

      setTimeout(function(){
        expect( ani.playing() ).to.be.false;

        expect( n1.style('width') ).to.equal(w);

        next();
      }, 200);
    });

    it('ani.pause() then ani.play()', function(next){
      var ani = n1.animation({
        style: { width: 200 },
        duration: 200
      });

      setTimeout(function(){
        ani.pause();
      }, 100);

      setTimeout(function(){
        ani.play().promise().then( next );
      }, 100);
    });

    it('ele.animation() x2 results in end style', function( next ){
      var d = 0;
      var done = function(){
        d++;

        if( d === 2 ){ next(); }
      };

      n1.animation({
        style: { width: 200 },
        duration: 100
      }).play().promise().then(function(){
        expect( parseFloat(n1.style().width) ).to.equal(200);

        done();
      });

      n2.animation({
        style: { width: 200 },
        duration: 100
      }).play().promise().then(function(){
        expect( parseFloat(n2.style().width) ).to.equal(200);

        done();
      });
    });

    it('ani progresses from 0 to 1', function(){
      var ani = n1.animation({
        style: { width: 200 },
        duration: 100
      });

      expect( ani.progress() ).to.equal(0);

      return ani.play().promise().then(function(){
        expect( ani.progress() ).to.equal(1);
      });
    });

    it('ani.rewind() works', function(){
      var ani = n1.style({
        width: 100
      }).animation({
        style: { width: 200 },
        duration: 100
      });

      return ani.play().promise().then(function(){
        expect( ani.progress() ).to.equal(1);
        expect( parseFloat(n1.style().width) ).to.equal(200);

        ani.rewind();

        expect( ani.progress() ).to.equal(0);
      });
    });

    it('ani.rewind() plays again from start', function(){
      var ani = n1.style({
        width: 100
      }).animation({
        style: { width: 200 },
        duration: 100
      });

      return ani.play().promise().then(function(){
        expect( ani.progress() ).to.equal(1);
        expect( parseFloat(n1.style().width) ).to.equal(200);

        ani.rewind();

        expect( ani.progress() ).to.equal(0);

        return ani.play().promise();
      }).then(function(){
        expect( ani.progress() ).to.equal(1);
        expect( parseFloat(n1.style().width) ).to.equal(200);
      });
    });

    it('ani.reverse()', function(){
      var ani = n1.style({
        width: 100
      }).animation({
        style: { width: 200 },
        duration: 100
      });

      return ani.play().promise().then(function(){
        expect( ani.progress() ).to.equal(1);
        expect( parseFloat(n1.style().width) ).to.equal(200);

        ani.reverse();

        return ani.play().promise();
      }).then(function(){
        expect( ani.progress() ).to.equal(1);
        expect( parseFloat(n1.style().width) ).to.equal(100);
      });
    });

    it('ani.reverse() does not affect second animation', function(){
      var a1 = n1.animation({
        style: {
          'width': 100,
          'height': 100
        },
        duration: 100
      });

      var p1 = {
        x: n1.position().x,
        y: n1.position().y
      };

      var p2 = {
        x: 1000,
        y: 1000
      };

      var a2 = n1.animation({
        position: {
          x: p2.x,
          y: p2.x
        },
        duration: 50
      });

      a2.play();

      return a1.play().promise().then(function(){
        return a1.reverse().play().promise();
      }).then(function(){
        var p = n1.position();

        expect( p ).to.deep.equal( p2 );
      });
    });

    it('ani.apply()', function(){
      var ani = n1.style({
        width: 100
      }).animation({
        style: { width: 200 },
        duration: 100
      });

      return ani.progress(0.5).apply().promise('frame').then(function(){
        expect( parseFloat(n1.style('width')) ).to.equal(150);
      });

    });

    it('ani.stop()', function( next ){
      var ani = n1.animation({
        style: { width: 200 },
        duration: 200
      });

      ani.play();

      setTimeout(function(){
        ani.stop().promise('frame').then(function(){
          expect( n1.animated() ).to.be.false;
          next();
        });
      }, 100);

    });

    it('ani.play() not stopped by stylesheet transition', function(){
      var n = n1;

      n.addClass('transition');

      return n.animation({
        position: { x: 50, y: 50 },
        duration: 300
      }).play().promise().then(function(){
        expect( n.width() ).to.equal( 300 );
      });
    });

    it('animation does not move locked node', function(){
      var n = n1;
      var p = { x: 1, y: 2 };

      n.position( p );
      n.lock();

      return n.animation({
        position: { x: 123, y: 456 },
        duration: 300
      }).play().promise().then(function(){
        expect( n.position() ).to.deep.equal( p );
      });
    });

    it('spring animation does not ease beyond 100%', function(){
      var n = n1;

      n.position({ x: 1, y: 2 });

      return n.animation({
        position: { x: 123, y: 456 },
        duration: 300,
        easing: 'spring(500, 20)'
      }).play().promise().then(function(){
        expect( n.position() ).to.deep.equal({ x: 123, y: 456 });
      });
    });

    // nb fit to bounding box is internal api
    // this is just a regression test; it may have to be removed if the internal api changes
    it('fit to bounding box has no error', function(){
      var getPan = function(){
        var p = cy.pan();

        return { x: p.x, y: p.y };
      };

      var pan1 = getPan();

      return cy.animation({
        fit: { eles: cy.nodes()[0].boundingBox() },
        duration: 300
      }).play().promise().then(function(){
        var pan2 = getPan();

        expect( pan1 ).to.not.deep.equal( pan2 );
      });
    });

    it('transition applied by class', function(done){
      var n = n1;

      n.addClass('transition');

      setTimeout(function(){
        expect( n.width() ).to.equal( 300 );

        done();
      }, 100);
    });

    it('2-prop transition applied by class', function(done){
      var n = n1;

      n.addClass('transition-multiple');

      setTimeout(function(){
        expect( n.width() ).to.equal( 300 );
        expect( n.numericStyle('background-color') ).to.deep.equal([0, 0, 0]);

        done();
      }, 100);
    });

    // the way this test is organised may assume some impl details that aren't necessarily true
    // it('transition applied by class in both directions', function(done){
    //   var n = n1;
    //   var w = n.width();

    //   n.addClass('transition-prop');
    //   n.addClass('transition');

    //   setTimeout(function(){
    //     expect( n.width() ).to.equal( 300 );

    //     n.removeClass('transition');
    //   }, 100);

    //   // in middle of animation, value should be between endpoints
    //   // (may need larger timeframes for slow testing machines)
    //   setTimeout(function(){
    //     expect( n.width() ).to.be.greaterThan( w );
    //     expect( n.width() ).to.be.lessThan( 300 );

    //     n.removeClass('transition');
    //   }, 125);

    //   setTimeout(function(){
    //     expect( n.width() ).to.equal( w );

    //     done();
    //   }, 200);
    // });

  });

  describe('eles.boundingBox()', function(){
    it('is a nonzero box for node', function(){
      var bb = cy.nodes()[0].boundingBox();

      expect( bb.w ).is.above( 0 );
      expect( bb.h ).is.above( 0 );
    });

    it('is a nonzero box for node without labels', function(){
      var bb = cy.nodes()[0].boundingBox({ includeLabels: false });

      expect( bb.w ).is.above( 0 );
      expect( bb.h ).is.above( 0 );
    });

    it('is a nonzero box for node without labels using cache', function(){
      var n = cy.nodes()[0];

      // make sure both default case and no label case are cached
      n.boundingBox();
      n.boundingBox({ includeLabels: false });

      var bb = cy.nodes()[0].boundingBox({ includeLabels: false });

      expect( bb.w ).is.above( 0 );
      expect( bb.h ).is.above( 0 );
    });

    it('bezier edge gets a bounding box', function(){
      var e = cy.$('#n1n2');

      var bb = e.boundingBox();

      expect( bb.w ).is.above(0);
      expect( bb.h ).is.above(0);
    });

    it('haystack edge gets a bounding box', function(){
      var e = cy.$('#n2n3');

      var bb = e.boundingBox();

      expect( bb.w ).is.above(0);
      expect( bb.h ).is.above(0);
    });

    it('updates bounding box properly with animated position', function(){
      var n = cy.nodes().first();
      var ani = n.animation({ position: { x: 1000, y: 1000 }, duration: 10 });
      var p = ani.promise('complete');

      ani.play();

      return p.then(function(){
        var bb = n.boundingBox();
        var x = (bb.x1 + bb.x2)/2;
        var y = (bb.y1 + bb.y2)/2;
        var pos = n.position();

        expect(x).to.equal(pos.x);
        expect(y).to.equal(pos.y);
      });
    });

    it('updates bounding box properly with animated layout', function(done){
      var layout = cy.layout({
        name: 'circle',
        animate: true,
        animationDuration: 10,
        boundingBox: { x1: 0, x2: 1000, y1: 0, y2: 1000, w: 1000, h: 1000 }
      });

      layout.on('layoutstop', function(){
        cy.nodes().forEach(function(n){
          var bb = n.boundingBox();
          var x = (bb.x1 + bb.x2)/2;
          var y = (bb.y1 + bb.y2)/2;
          var pos = n.position();

          expect(x, 'x of ' + n.id()).to.equal(pos.x);
          expect(y, 'y of ' + n.id()).to.equal(pos.y);
        });

        done();
      });

      layout.run();
    });

    it('gets bounding box of parent with hidden child', function(){
      cy.elements().remove();

      cy.style().fromJson([
        {
          selector: '#n3',
          style: {
            'display': 'none'
          }
        }
      ]);

      cy.add([
        { data: { id: 'n1' } },
        { data: { id: 'n2', parent: 'n1' } },
        { data: { id: 'n3', parent: 'n1' } }
      ]);

      var bb = cy.$('#n1').boundingBox();

      expect(bb).to.exist;
      expect(bb.w).to.exist;
      expect(bb.h).to.exist;
      expect(bb.x1).to.exist;
      expect(bb.x2).to.exist;
      expect(bb.y1).to.exist;
      expect(bb.y2).to.exist;
    });
  });

});
