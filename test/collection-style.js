var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);

describe('Collection style', function(){

  var cy;

  // test setup
  beforeEach(function(done){
    cytoscape({
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
      ready: function(){
        cy = this;

        done();
      }
    });
  });


  describe('eles.css() etc', function(){

    it('eles.css() gets a name-value pair object', function(){
      var css = cy.$('#n1').css();

      expect( css ).to.be.an('object');
      expect( css ).to.have.property('background-color');
      expect( css['background-color'] ).to.be.defined;
    });

    it('eles.css(name, val) gets and sets the specified property', function(){
      var n1 = cy.$('#n1');

      n1.css('width', '10px');

      expect( n1.css('width') ).to.equal('10px');
    });

    it('eles.css({}) sets the specified properties', function(){
      var n1 = cy.$('#n1');

      n1.css({
        height: '10px',
        width: '20px'
      });

      expect( n1.css('height') ).to.equal('10px');
      expect( n1.css('width') ).to.equal('20px');
    });

    it('eles.removeCss() clears bypassed style', function(){
      var n1 = cy.$('#n1');

      n1.css({
        height: '999px'
      });

      n1.removeCss();

      expect( n1.css('height') ).to.not.equal('999px');
    });

    it('eles.show() sets `display: element`', function(){
      var n1 = cy.$('#n1');

      n1.show();

      expect( n1.css('display') ).to.equal('element');
      expect( n1.visible() ).to.be.true;
    });

    it('eles.hide() sets `display: none`', function(){
      var n1 = cy.$('#n1');

      n1.hide();

      expect( n1.css('display') ).to.equal('none');
      expect( n1.hidden() ).to.be.true;
    });

    it('ele.effectiveOpacity() is correct for child', function(){
      cy.add([
        { group: 'nodes', data: { id: 'p' } },
        { group: 'nodes', data: { id: 'c', parent: 'p' } }
      ]);

      cy.$('#p').css('opacity', 0.5);
      cy.$('#c').css('opacity', 0.5);

      expect( cy.$('#c').effectiveOpacity() ).to.equal(0.25);
      expect( cy.$('#p').transparent() ).to.be.false;

      cy.$('#p').css('opacity', 0);

      expect( cy.$('#p').effectiveOpacity() ).to.equal(0);
      expect( cy.$('#p').transparent() ).to.be.true;
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

    it('eles.classes()', function(){
      n1.add(n2).classes({
        add: ['foo', 'bar']
      });

      expect( n1.hasClass('foo') ).to.be.true;
      expect( n1.hasClass('bar') ).to.be.true;
      expect( n2.hasClass('foo') ).to.be.true;
      expect( n2.hasClass('bar') ).to.be.true;

      n1.add(n2).classes({
        remove: ['foo']
      });

      expect( n1.hasClass('foo') ).to.be.false;
      expect( n2.hasClass('foo') ).to.be.false;

      n1.add(n2).classes({
        toggle: ['bar']
      });

      expect( n1.hasClass('bar') ).to.be.false;
      expect( n2.hasClass('bar') ).to.be.false;
    });

  });

});