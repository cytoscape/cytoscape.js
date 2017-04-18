var expect = require('chai').expect;
var cytoscape = require('../src', cytoscape);

describe('Collection style', function(){

  var cy;

  var useFn = function( fn ){
    return function( arg ){
      return fn( arg );
    };
  };

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
            label: useFn(function(){ return 'n1'; })
          }
        },

        {
          selector: '#n2',
          style: {
            label: useFn(function(){ return 'n2'; })
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
      expect( style['background-color'] ).to.be.defined;
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
      expect( style['label'] ).to.be.defined;
      expect( style['label'] ).to.equal( 'n1' );
    });

    it('eles.style() gets correct value when using function prop value (n2)', function(){
      var style = cy.$('#n2').style();

      expect( style ).to.be.an('object');
      expect( style ).to.have.property('label');
      expect( style['label'] ).to.be.defined;
      expect( style['label'] ).to.equal( 'n2' );
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

    it('eles.classes() replaces classes (subset)', function(){
      ['foo', 'bar', 'baz'].forEach(function( c ){ n1.addClass(c); });

      n1.classes('foo');

      expect( n1.hasClass('foo') ).to.be.true;
      expect( n1.hasClass('bar') ).to.be.false;
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

    it('eles.addClass() adds class to json', function(){
      n1.addClass('foo');

      expect( n1.json().classes ).to.equal('foo');
    });

    it('eles.removeClass() removes class from json', function(){
      n1.addClass('foo');
      n1.removeClass('foo');

      expect( n1.json().classes ).to.be.empty;
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

      n.addClass('transition', 100);

      return n.animation({
        position: { x: 50, y: 50 },
        duration: 300
      }).play().promise().then(function(){
        expect( n.width() ).to.equal( 300 );
      });
    });

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
  });

});
