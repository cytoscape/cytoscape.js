'use strict';

var util = require( './util' );
var define = require( './define' );
var Collection = require( './collection' );
var Core = require( './core' );
var incExts = require( './extensions' );
var is = require( './is' );

// registered extensions to cytoscape, indexed by name
var extensions = {};

// registered modules for extensions, indexed by name
var modules = {};

function setExtension( type, name, registrant ){

  var ext = registrant;

  var overrideErr = function( field ){
    util.error( 'Can not register `' + name + '` for `' + type + '` since `' + field + '` already exists in the prototype and can not be overridden' );
  };

  if( type === 'core' ){
    if( Core.prototype[ name ] ){
      return overrideErr( name );
    } else {
      Core.prototype[ name ] = registrant;
    }

  } else if( type === 'collection' ){
    if( Collection.prototype[ name ] ){
      return overrideErr( name );
    } else {
      Collection.prototype[ name ] = registrant;
    }

  } else if( type === 'layout' ){
    // fill in missing layout functions in the prototype

    var Layout = function( options ){
      this.options = options;

      registrant.call( this, options );

      // make sure layout has _private for use w/ std apis like .on()
      if( !is.plainObject( this._private ) ){
        this._private = {};
      }

      this._private.cy = options.cy;
      this._private.listeners = [];
    };

    var layoutProto = Layout.prototype = Object.create( registrant.prototype );

    var optLayoutFns = [];

    for( var i = 0; i < optLayoutFns.length; i++ ){
      var fnName = optLayoutFns[ i ];

      layoutProto[ fnName ] = layoutProto[ fnName ] || function(){ return this; };
    }

    // either .start() or .run() is defined, so autogen the other
    if( layoutProto.start && !layoutProto.run ){
      layoutProto.run = function(){ this.start(); return this; };
    } else if( !layoutProto.start && layoutProto.run ){
      layoutProto.start = function(){ this.run(); return this; };
    }

    if( !layoutProto.stop ){
      layoutProto.stop = function(){
        var opts = this.options;

        if( opts && opts.animate ){
          var anis = this.animations;
          for( var i = 0; i < anis.length; i++ ){
            anis[ i ].stop();
          }
        }

        this.trigger( 'layoutstop' );

        return this;
      };
    }

    if( !layoutProto.destroy ){
      layoutProto.destroy = function(){
        return this;
      };
    }

    layoutProto.on = define.on( { layout: true } );
    layoutProto.one = define.on( { layout: true, unbindSelfOnTrigger: true } );
    layoutProto.once = define.on( { layout: true, unbindAllBindersOnTrigger: true } );
    layoutProto.off = define.off( { layout: true } );
    layoutProto.trigger = define.trigger( { layout: true } );

    define.eventAliasesOn( layoutProto );

    ext = Layout; // replace with our wrapped layout

  } else if( type === 'renderer' && name !== 'null' && name !== 'base' ){
    // user registered renderers inherit from base

    var BaseRenderer = getExtension( 'renderer', 'base' );
    var bProto = BaseRenderer.prototype;
    var RegistrantRenderer = registrant;
    var rProto = registrant.prototype;

    var Renderer = function(){
      BaseRenderer.apply( this, arguments );
      RegistrantRenderer.apply( this, arguments );
    };

    var proto = Renderer.prototype;

    for( var pName in bProto ){
      var pVal = bProto[ pName ];
      var existsInR = rProto[ pName ] != null;

      if( existsInR ){
        return overrideErr( pName );
      }

      proto[ pName ] = pVal; // take impl from base
    }

    for( var pName in rProto ){
      proto[ pName ] = rProto[ pName ]; // take impl from registrant
    }

    bProto.clientFunctions.forEach( function( name ){
      proto[ name ] = proto[ name ] || function(){
        util.error( 'Renderer does not implement `renderer.' + name + '()` on its prototype' );
      };
    } );

    ext = Renderer;

  }

  return util.setMap( {
    map: extensions,
    keys: [ type, name ],
    value: ext
  } );
}

function getExtension( type, name ){
  return util.getMap( {
    map: extensions,
    keys: [ type, name ]
  } );
}

function setModule( type, name, moduleType, moduleName, registrant ){
  return util.setMap( {
    map: modules,
    keys: [ type, name, moduleType, moduleName ],
    value: registrant
  } );
}

function getModule( type, name, moduleType, moduleName ){
  return util.getMap( {
    map: modules,
    keys: [ type, name, moduleType, moduleName ]
  } );
}

var extension = function(){
  // e.g. extension('renderer', 'svg')
  if( arguments.length === 2 ){
    return getExtension.apply( null, arguments );
  }

  // e.g. extension('renderer', 'svg', { ... })
  else if( arguments.length === 3 ){
    return setExtension.apply( null, arguments );
  }

  // e.g. extension('renderer', 'svg', 'nodeShape', 'ellipse')
  else if( arguments.length === 4 ){
    return getModule.apply( null, arguments );
  }

  // e.g. extension('renderer', 'svg', 'nodeShape', 'ellipse', { ... })
  else if( arguments.length === 5 ){
    return setModule.apply( null, arguments );
  }

  else {
    util.error( 'Invalid extension access syntax' );
  }

};

// allows a core instance to access extensions internally
Core.prototype.extension = extension;

// included extensions
incExts.forEach( function( group ){
  group.extensions.forEach( function( ext ){
    setExtension( group.type, ext.name, ext.impl );
  } );
} );

module.exports = extension;
