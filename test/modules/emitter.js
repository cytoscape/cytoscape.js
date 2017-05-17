var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

describe('Emitter', function(){

  if( typeof window !== 'undefined' ){
    return; // can't do these tests in browser due to require()
  }

  var Emitter = require('../src/emitter');

  var em;
  var pem;

  // test setup
  beforeEach(function(){
    pem = new Emitter();

    em = new Emitter({
      parent: function(){ return pem; },
      bubble: function(){ return true; }
    });
  });

  afterEach(function(){
    em = null;
    pem = null;
  });

  it('calls handler on emit', function( done ){
    em.on('foo', function(){ done() });

    em.emit('foo');
  });

  it('calls listener on namespaced emit', function( done ){
    em.on('foo.bar', function(){ done() });

    em.emit('foo.bar');
  });

  it('does not call listener on no namespace match', function( done ){
    var emit = false;

    em.on('foo.bar', function(){ emit = true; });

    em.emit('foo');

    expect( emit, 'emitted' ).to.be.false;

    done();
  });

  it('calls non-namespaced listeners on namespaced emit', function( done ){
    var ns = false;
    var nonNs = false;

    em.on('foo.bar', function(){
      ns = true;
    });

    em.on('foo', function(){
      nonNs = true;
    });

    em.emit('foo.bar');

    expect( ns, 'emitted ns' ).to.be.true;
    expect( nonNs, 'emitted non ns' ).to.be.true;

    done();
  });

  it('removes listener', function(){
    var emit = false;

    var lis = function(){
      emit = true;
    };

    em.on('foo', lis);

    em.removeListener('foo', lis);

    em.emit('foo');

    expect( emit, 'emitted' ).to.be.false;
  });

  it('removes all listeners of same type', function(){
    var emit = false;

    var lis1 = function(){
      emit = true;
    };

    var lis2 = function(){
      emit = true;
    };

    em.on('foo', lis1);
    em.on('foo', lis2);

    em.removeListener('foo');

    em.emit('foo');

    expect( emit ).to.be.false;
  });

  it('removes only specified callback', function(){
    var emit1 = false, emit2 = false;

    var lis1 = function(){
      emit1 = true;
    };

    var lis2 = function(){
      emit2 = true;
    };

    em.on('foo', lis1);
    em.on('foo', lis2);

    em.removeListener('foo', lis1);

    em.emit('foo');

    expect( emit1 ).to.be.false;
    expect( emit2 ).to.be.true;
  });

  it('emits only one time for one', function(){
    var emits = 0;

    em.one('foo', function(){
      emits++;
    });

    em.emit('foo');
    em.emit('foo');

    expect( emits, 'number of emits' ).to.equal(1);
  });

  it('emits with extra params', function(){
    em.on('foo', function( event, a, b ){
      expect(a, 'a').to.equal(1);
      expect(b, 'b').to.equal(2);
    });

    em.emit('foo', [1, 2]);
  });

  it('bubbles', function(){
    var emitsPem = 0, emitsEm = 0;

    em.on('foo', function(){
      emitsEm++;
    });

    pem.on('foo', function(){
      emitsPem++;
    });

    em.emit('foo');

    expect( emitsPem, 'parent emits' ).to.equal(1);
    expect( emitsEm, 'child emits' ).to.equal(1);
  });

});
