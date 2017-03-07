var expect = require('chai').expect;
var cytoscape = require('../src', cytoscape);

describe('Events', function(){

  var cy;
  var n1;
  var triggers;

  // test setup
  beforeEach(function(done){
    cytoscape({
      styleEnabled: true,

      elements: {
        nodes: [
            { data: { id: "n1", foo: "one", } },
            { data: { id: "n2", foo: "two", } },
            { data: { id: "n3", foo: "three", } },
            { data: { id: "n4" } },
            { data: { id: "n5", parent: 'n4' } },
        ],

        edges: [
            { data: { id: "n1n2", source: "n1", target: "n2", weight: 0.33 }, classes: "uh" },
            { data: { id: "n2n3", source: "n2", target: "n3", weight: 0.66 }, classes: "huh" }
        ]
      },
      ready: function(){
        cy = this;
        n1 = cy.$('#n1');
        triggers = 0;

        done();
      }
    });
  });

  afterEach(function(){
    cy.destroy();
  });



  describe('Collection events triggered by functions', function(){

    var handler = function(){
      triggers++;
    }

    it('`add` for new element', function(){
      cy.on('add', handler);

      cy.add({
        group: 'nodes',
        data: { id: 'foo' }
      });

      expect( triggers ).to.equal(1);
    });

    it('`add` for restored element', function(){
      n1.on('add', handler);

      n1.remove();
      n1.restore();

      expect( triggers ).to.equal(1);
    });

    it('`remove`', function(){
      n1.on('remove', handler);

      n1.remove();

      expect( triggers ).to.equal(1);
    });

    it('`select`', function(){
      n1.on('select', handler);

      n1.select();

      expect( triggers ).to.equal(1);
    });

    it('`unselect`', function(){
      n1.on('unselect', handler);

      n1.select(); // make sure it's already selected
      n1.unselect();

      expect( triggers ).to.equal(1);
    });

    it('`lock`', function(){
      n1.on('lock', handler);

      n1.lock();

      expect( triggers ).to.equal(1);
    });

    it('`unlock`', function(){
      n1.on('unlock', handler);

      n1.lock(); // make sure it's already locked
      n1.unlock();

      expect( triggers ).to.equal(1);
    });

    it('`position`', function(){
      n1.on('position', handler);

      n1.position({
        x: 100,
        y: 100
      });

      expect( triggers ).to.equal(1);
    });

    it('`data`', function(){
      n1.on('data', handler);

      n1.data({
        foo: 'bar'
      });

      expect( triggers ).to.equal(1);
    });

    it('`style`', function(){
      n1.on('style', handler);

      n1.css({
        'background-color': 'red'
      });

      expect( triggers ).to.equal(1);
    });

  });



  describe('Graph events triggered by functions', function(){

    var triggers = 0;
    var handler = function(){
      triggers++;
    }

    beforeEach(function(){
      triggers = 0;
    });

    it('`layoutstart`, `layoutready`, & `layoutstop`', function(done){
      var start, ready;

      cy.on('layoutstart', function(){
        start = true;
      });

      cy.on('layoutready', function(){
        ready = true;
      });

      cy.on('layoutstop', function(){
        expect( start ).to.be.true;
        expect( ready ).to.be.true;


        done();
      });

      cy.layout({
        name: 'null'
      }).run();

    });

    if( typeof Promise !== typeof undefined ){ // can't test this w/o a promise
      it('`load` & `done`', function(done){
        var cy = cytoscape({
          elements: new Promise(function( resolve ){
            setTimeout(function(){
              resolve([ {} ]);
            }, 100);
          })
        });

        cy.on('load', handler);
        cy.on('done', function(){
          expect( triggers ).to.equal(1);
          done();
        });

      });
    }

    it('`pan`', function(){
      cy.on('pan', handler);

      cy.pan({
        x: 100,
        y: 100
      });

      expect( triggers ).to.equal(1);
    });

    it('`zoom`', function(){
      cy.on('zoom', handler);

      cy.zoom(2);

      expect( triggers ).to.equal(1);
    });

    it('`destroy`', function(){
      cy.on('destroy', handler);

      cy.destroy();

      expect( triggers ).to.equal(1);
    });

  });


  describe('Event bubbling', function(){

    it('should bubble from child to parent node', function(){
      var childTrigger, parentTrigger;

      var child = cy.$('#n5');
      var parent = cy.$('#n4');

      child.on('foo', function(){
        childTrigger = true;
      });

      parent.on('foo', function(){
        parentTrigger = true;
      });

      child.trigger('foo');

      expect( childTrigger ).to.be.true;
      expect( parentTrigger ).to.be.true;
    });

    it('should bubble from parent node to the core', function(){
      var childTrigger, parentTrigger, coreTrigger;

      var child = cy.$('#n5');
      var parent = cy.$('#n4');

      child.on('foo', function(){
        childTrigger = true;
      });

      parent.on('foo', function(){
        parentTrigger = true;
      });

      cy.on('foo', function(){
        coreTrigger = true;
      });

      child.trigger('foo');

      expect( childTrigger ).to.be.true;
      expect( parentTrigger ).to.be.true;
      expect( coreTrigger ).to.be.true;
    });

    it('should bubble from lone node to core', function(){
      var nodeTrigger, coreTrigger;

      var node = cy.$('#n1');

      node.on('foo', function(){
        nodeTrigger = true;
      });

      cy.on('foo', function(){
        coreTrigger = true;
      });

      node.trigger('foo');

      expect( nodeTrigger ).to.be.true;
      expect( coreTrigger ).to.be.true;
    });

  });


  describe('cy.on()', function(){

    it('binds to one event', function(done){
      cy
        .on('foo', function(){
          done();
        })

        .trigger('foo')
      ;

    });

    it('binds to multiple events', function(done){
      var triggeredFoo = false;
      var triggeredBar = false;
      var triggers = 0;

      cy
        .on('foo bar', function(e){

          if( e.type === 'foo' ){
            triggeredFoo = true;
          } else if( e.type === 'bar' ){
            triggeredBar = true;
          }

          triggers++;

          if( triggers === 2 ){
            expect( triggeredFoo ).to.be.true;
            expect( triggeredBar ).to.be.true;

            done();
          }

        })

        .trigger('foo')

        .trigger('bar')
      ;

    });

    it('binds with a selector', function(done){

      cy.on('foo', 'node', function(e){
        done();
      });

      cy.$('#n1').trigger('foo');

    });

    it('binds with data', function(done){

      cy.on('foo', { bar: 'baz' }, function(e){
        expect( e ).to.have.property('data');
        expect( e.data ).to.have.property('bar', 'baz');

        done();
      });

      cy.trigger('foo');

    });

    it('binds with an event map', function(){
      var triggers = 0;

      cy.on({
        'foo': function(){ triggers++; },
        'bar': function(){ triggers++; }
      });

      cy.trigger('foo bar');

      expect( triggers ).to.equal(2);
    });

    it('has event object structure', function(done){

      cy
        .on('foo.bar', function(e){

          expect( e ).to.be.ok;
          expect( e ).to.have.property('type', 'foo');
          expect( e ).to.have.property('cy', cy);
          expect( e ).to.have.property('target', cy);
          expect( e ).to.have.property('namespace', '.bar');
          expect( e.timeStamp ).to.be.a('number');

          done();
        })

        .trigger('foo.bar')
      ;

    });

  });

  describe('cy.one()', function(){

    it('only triggers once', function(){
      var triggers = 0;

      cy.one('foo', function(e){
        triggers++;
      });

      cy.trigger('foo');
      expect( triggers ).to.equal(1);

      cy.trigger('foo');
      expect( triggers ).to.equal(1);
    });

    it('triggers once with selector', function(){
      var triggers = 0;

      cy.one('foo', 'node', function(e){
        triggers++;
      });

      cy.$('#n1').trigger('foo');
      expect( triggers ).to.equal(1);

      cy.$('#n1').trigger('foo');
      expect( triggers ).to.equal(1);
    });

    it('triggers once with map', function(){
      var triggers = 0;

      cy.one({
        'foo': function(e){
          triggers++;
        }
      });

      cy.trigger('foo');
      expect( triggers ).to.equal(1);

      cy.trigger('foo');
      expect( triggers ).to.equal(1);
    });

  });

  describe('cy.off()', function(){

    it('removes a handler from .on()', function(){
      var triggers = 0;
      var handler;

      cy.on('foo', handler = function(){
        triggers++;
      });

      cy.off('foo', handler);

      cy.trigger('foo');
      expect( triggers ).to.equal(0);
    });

    it('removes a handler from .one()', function(){
      var triggers = 0;
      var handler;

      cy.one('foo', handler = function(){
        triggers++;
      });

      cy.off('foo', handler);

      cy.trigger('foo');
      expect( triggers ).to.equal(0);
    });

    it('removes a handler via just event type', function(){
      var triggers = 0;
      var handler;

      cy.on('foo', handler = function(){
        triggers++;
      });

      cy.off('foo');

      cy.trigger('foo');
      expect( triggers ).to.equal(0);
    });

    it('removes a handler via events map', function(){
      var triggers = 0;
      var handler;

      cy.on('foo', handler = function(){
        triggers++;
      });

      cy.off({
        'foo': handler
      });

      cy.trigger('foo');
      expect( triggers ).to.equal(0);
    });

    it('removes a handler with a selector', function(){
      var triggers = 0;
      var handler;

      cy.on('foo', 'node', handler = function(){
        triggers++;
      });

      cy.off('foo', 'node', handler);

      cy.$('#n1').trigger('foo');
      expect( triggers ).to.equal(0);
    });

    it('removes a handler with a selector and handler unspecified', function(){
      var triggers = 0;
      var handler;

      cy.on('foo', 'node', handler = function(){
        triggers++;
      });

      cy.off('foo', 'node');

      cy.$('#n1').trigger('foo');
      expect( triggers ).to.equal(0);
    });

    it('removes multiple handlers of same event type', function(){
      var triggers = 0;
      var handler1, handler2;

      cy.on('foo', handler1 = function(){
        triggers++;
      });

      cy.on('foo', handler2 = function(){
        triggers++;
      });

      cy.off('foo');

      cy.trigger('foo');
      expect( triggers ).to.equal(0);
    });

    it('removes multiple handlers of same event type and selector', function(){
      var triggers = 0;
      var handler1, handler2;

      cy.on('foo', 'node', handler1 = function(){
        triggers++;
      });

      cy.on('foo', 'node', handler2 = function(){
        triggers++;
      });

      cy.off('foo', 'node');

      cy.$('#n1').trigger('foo');
      expect( triggers ).to.equal(0);
    });

  });

  describe('cy.trigger()', function(){

    it('triggers the handler', function(){
      var triggers = 0;

      cy.on('foo', function(){
        triggers++;
      });

      cy.trigger('foo');

      expect( triggers ).to.equal(1);
    });

    it('passes extra params correctly', function(done){
      cy.on('foo', function(e, bar, baz){
        expect( bar ).to.equal('bar');
        expect( baz ).to.equal('baz');

        done();
      });

      cy.trigger('foo', ['bar', 'baz']);
    });

  });

  describe('eles.on()', function(){

    var triggers = 0;
    var n1;
    var handler = function(){ triggers++; }

    beforeEach(function(){
      triggers = 0;
      n1 = cy.$('#n1');
    });

    it('should get triggered with matching event', function(){
      n1.on('foo', handler);
      n1.trigger('foo');
      expect( triggers ).to.equal(1);
    });

    it('should get triggered with matching event and namespace', function(){
      n1.on('foo.bar', handler);
      n1.trigger('foo.bar');
      expect( triggers ).to.equal(1);
    });

    it('should get triggered with matching event and delegate selector', function(){
      cy.$('#n4').on('foo', 'node', handler);
      cy.$('#n5').trigger('foo');
      expect( triggers ).to.equal(1);
    });

    it('should pass extra data correctly', function(done){
      n1.on('foo', { bar: 'baz' }, function(e){
        expect( e.data.bar ).to.equal('baz');
        done();
      });

      n1.trigger('foo');
    });

  });

  describe('eles.one()', function(){

    var triggers = 0;
    var n1;
    var handler = function(){ triggers++; }

    beforeEach(function(){
      triggers = 0;
      n1 = cy.$('#n1');
    });

    it('triggers only one time', function(){
      n1.one('foo', handler);
      n1.trigger('foo');
      expect( triggers ).to.equal(1);
      n1.trigger('foo');
      expect( triggers ).to.equal(1);
    });

    it('triggers once per element', function(){
      cy.nodes().one('foo', handler);
      cy.nodes().trigger('foo');
      expect( triggers ).to.equal(5);
      cy.nodes().trigger('foo');
      expect( triggers ).to.equal(5);
    });

    it('triggers only one time with delegate', function(){
      cy.$('#n4').one('foo', 'node', handler);
      cy.$('#n5').trigger('foo');
      expect( triggers ).to.equal(1);
      cy.$('#n5').trigger('foo');
      expect( triggers ).to.equal(1);
    });

    it('passes data correctly', function(){
      var evt;

      n1.one('foo', { bar: 'baz' }, function(e){
        evt = e;
      });
      n1.trigger('foo');

      expect( evt.data ).to.exist;
      expect( evt.data.bar ).to.exist;
      expect( evt.data.bar ).to.equal('baz');
    });

  });

  describe('eles.once()', function(){

    var triggers = 0;
    var n1;
    var handler = function(){ triggers++; }

    beforeEach(function(){
      triggers = 0;
      n1 = cy.$('#n1');
    });

    it('triggers only one time', function(){
      n1.once('foo', handler);
      n1.trigger('foo');
      expect( triggers ).to.equal(1);
      n1.trigger('foo');
      expect( triggers ).to.equal(1);
    });

    it('triggers only one time for all elements', function(){
      cy.nodes().once('foo', handler);
      cy.nodes().trigger('foo');
      expect( triggers ).to.equal(1);
      cy.nodes().trigger('foo');
      expect( triggers ).to.equal(1);
    });

    it('triggers only one time with delegate', function(){
      cy.$('#n4').once('foo', 'node', handler);
      cy.$('#n5').trigger('foo');
      expect( triggers ).to.equal(1);
      cy.$('#n5').trigger('foo');
      expect( triggers ).to.equal(1);
    });

    it('passes data correctly', function(){
      var evt;

      n1.once('foo', { bar: 'baz' }, function(e){
        evt = e;
      });
      n1.trigger('foo');

      expect( evt.data ).to.exist;
      expect( evt.data.bar ).to.exist;
      expect( evt.data.bar ).to.equal('baz');
    });

  });

  describe('eles.off()', function(){

    var triggers = 0;
    var n1;
    var handler = function(){ triggers++; }

    beforeEach(function(){
      triggers = 0;
      n1 = cy.$('#n1');
    });

    it('should remove all handlers for same event type', function(){
      cy.nodes().on('foo', handler);
      cy.nodes()
        .off('foo')
        .trigger('foo')
      ;
      expect( triggers ).to.equal(0);
    });

    it('should remove all handlers for matching event and delegate selector', function(){
      cy.nodes().on('foo', 'node', handler);
      cy.nodes()
        .off('foo', 'node')
        .trigger('foo')
      ;
      expect( triggers ).to.equal(0);
    });

    it('should remove all matching handlers', function(){
      cy.nodes().on('foo', handler);
      cy.nodes()
        .off('foo', handler)
        .trigger('foo')
      ;
      expect( triggers ).to.equal(0);
    });

  });

  describe('eles.trigger()', function(){

    var triggers = 0;
    var n1;
    var handler = function(){ triggers++; }

    beforeEach(function(){
      triggers = 0;
      n1 = cy.$('#n1');
    });

    it('should trigger for one element', function(){
      n1.on('foo', handler);
      n1.trigger('foo');
      expect( triggers ).to.equal(1);
    });

    it('should trigger for multiple elements', function(){
      cy.nodes().on('foo', handler);
      cy.nodes().trigger('foo');
      expect( triggers ).to.equal(6); // NB 2x for parent
    });

    it('should trigger with extra parameters', function(done){
      n1.on('foo', function(e, bar, baz){
        expect( bar ).to.equal('bar');
        expect( baz ).to.equal('baz');
        done();
      });
      n1.trigger('foo', ['bar', 'baz']);
    });

  });

  describe('eles.promiseOn()', function(){

    var n1;

    beforeEach(function(){
      n1 = cy.$('#n1');
    });

    it('should run a then() callback', function( next ){
      n1.pon('foo').then(function(){
        next();
      });

      n1.trigger('foo');
    });

    it('should receive event obj', function( next ){
      n1.pon('foo').then(function( e ){
        expect( e ).to.not.be.undefined;
        expect( e.type ).to.equal('foo');

        next();
      });

      n1.trigger('foo');
    });

    it('should run callback only once', function( next ){
      var trigs = 0;

      n1.pon('foo').then(function(){
        trigs++;
      });

      n1.trigger('foo');
      n1.trigger('foo');

      setTimeout(function(){
        expect( trigs ).to.equal(1);
        next();
      }, 50);
    });

  });

});
