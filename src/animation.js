'use strict';

var util = require('./util');
var is = require('./is');
var Promise = require('./promise');

var Animation = function( target, opts1, opts2, opts3 ){
  if( !(this instanceof Animation) ){
    return new Animation( target, opts1, opts2, opts3 );
  }

  var _p = this._private = util.extend( {
    duration: 1000,
    playing: false,
    hooked: false
  }, opts1, opts2, opts3 );

  _p.target = target;
  _p.style = _p.style || _p.css;
  _p.started = false;
  _p.progress = 0;
  _p.completes = [];

  if( _p.complete && is.fn(_p.complete) ){
    _p.completes.push( _p.complete );
  }

  // for future timeline/animations impl
  this.length = 1;
  this[0] = this;
};

var anifn = Animation.prototype;

util.extend( anifn, {

  instanceString: function(){ return 'animation'; },

  play: function(){
    var _p = this._private;

    // autorewind
    if( _p.progress === 1 ){
      _p.progress = 0;
    }

    _p.playing = true;
    _p.started = false; // needs to be started by animation loop
    _p.stopped = false;

    if( !_p.hooked ){
      // add to target's list of current animations
      _p.target._private.animation.current.push( this );

      // add to the animation loop pool
      if( is.elementOrCollection( _p.target ) ){
        _p.target.cy().addToAnimationPool( _p.target );
      }

      _p.hooked = true;
    }

    // the animation loop will start the animation...

    return this;
  },

  playing: function(){
    return this._private.playing;
  },

  pause: function(){
    var _p = this._private;

    _p.playing = false;
    _p.started = false;

    return this;
  },

  stop: function(){
    var _p = this._private;

    _p.playing = false;
    _p.started = false;
    _p.stopped = true; // to be removed from animation queues

    return this;
  },

  rewind: function(){
    return this.progress(0);
  },

  fastforward: function(){
    return this.progress(1);
  },

  time: function( t ){
    var _p = this._private;

    if( t == undefined ){
      return _p.progress * _p.duration;
    } else {
      return this.progress( t / _p.duration );
    }
  },

  progress: function( p ){
    var _p = this._private;
    var wasPlaying = _p.playing;

    if( p === undefined ){
      return _p.progress;
    } else {
      if( wasPlaying ){
        this.pause();
      }

      _p.progress = p;
      _p.started = false;

      if( wasPlaying ){
        this.play();
      }
    }

    return this;
  },

  complete: function(){
    return this._private.progress === 1;
  },

  reverse: function(){
    var _p = this._private;
    var wasPlaying = _p.playing;

    if( wasPlaying ){
      this.pause();
    }

    _p.progress = 1 - _p.progress;
    _p.started = false;

    var swap = function( a, b ){
      var _pa = _p[a];

      _p[a] = _p[b];
      _p[b] = _pa;
    };

    swap( 'zoom', 'startZoom' );
    swap( 'pan', 'startPan' );
    swap( 'position', 'startPosition' );

    // swap styles
    for( var i = 0; i < _p.style.length; i++ ){
      var prop = _p.style[i];
      var name = prop.name;
      var startStyleProp = _p.startStyle[ name ];

      _p.startStyle[ name ] = _p.startStyle[ util.dash2camel( name ) ] = prop;
      _p.style[i] = startStyleProp;
    }

    if( wasPlaying ){
      this.play();
    }

    return this;
  },

  promise: function(){
    var _p = this._private;

    return new Promise(function( resolve, reject ){
      _p.completes.push(function(){
        resolve();
      });
    });
  }

} );

module.exports = Animation;
