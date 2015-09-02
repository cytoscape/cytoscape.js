'use strict';

var util = require('./util');
var define = require('./define');
var Core = require('./core');
var Collection = require('./collection');
var incExts = require('./extensions');

// registered extensions to cytoscape, indexed by name
var extensions = {};

// registered modules for extensions, indexed by name
var modules = {};

function setExtension( type, name, registrant ){

  switch( type ){
  case 'core':
  case 'collection':
    Collection.prototype[ name ] = registrant;
  }

  // fill in missing layout functions in the prototype
  if( type === 'layout' ){
    var layoutProto = registrant.prototype;
    var optLayoutFns = [];

    for( var i = 0; i < optLayoutFns.length; i++ ){
      var fnName = optLayoutFns[i];

      layoutProto[fnName] = layoutProto[fnName] || function(){ return this; };
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
          opts.eles.stop();
        }

        return this;
      };
    }

    if( !layoutProto.destroy ){
      layoutProto.destroy = function(){
        return this;
      };
    }

    layoutProto.on = define.on({ layout: true });
    layoutProto.one = define.on({ layout: true, unbindSelfOnTrigger: true });
    layoutProto.once = define.on({ layout: true, unbindAllBindersOnTrigger: true });
    layoutProto.off = define.off({ layout: true });
    layoutProto.trigger = define.trigger({ layout: true });

    define.eventAliasesOn( layoutProto );

  // user registered renderers inherit from base
  } else if( type === 'renderer' && name !== 'null' && name !== 'base' ){
    // var bProto = getExtension( 'renderer', 'base' ).prototype;
    var bProto = { clientFunctions: [], clientProperties: [] }; // TODO refactor
    var rProto = registrant.prototype;

    for( var pName in bProto ){
      var pVal = bProto[ pName ];
      var existsInR = rProto[ pName ] != null;

      if( existsInR ){
        util.error('Can not register renderer `' + name + '` since it overrides `' + pName + '` in its prototype');
        return;
      }

      rProto[ pName ] = pVal; // take impl from base
    }

    bProto.clientFunctions.forEach(function( name ){
      rProto[ name ] = rProto[ name ] || function(){
        util.error('Renderer does not implement `renderer.' + name + '()` on its prototype');
      };
    });

    bProto.clientProperties.forEach(function( name ){
      Object.defineProperty( bProto, name, {
        get: function(){
          util.error('Renderer does not specifiy property `renderer.' + name + '` on its prototype');
        }
      } );
    });

  }

  return util.setMap({
    map: extensions,
    keys: [ type, name ],
    value: registrant
  });
}

function getExtension(type, name){
  return util.getMap({
    map: extensions,
    keys: [ type, name ]
  });
}

function setModule(type, name, moduleType, moduleName, registrant){
  return util.setMap({
    map: modules,
    keys: [ type, name, moduleType, moduleName ],
    value: registrant
  });
}

function getModule(type, name, moduleType, moduleName){
  return util.getMap({
    map: modules,
    keys: [ type, name, moduleType, moduleName ]
  });
}

var extension = function(){
  // e.g. extension('renderer', 'svg')
  if( arguments.length == 2 ){
    return getExtension.apply(this, arguments);
  }

  // e.g. extension('renderer', 'svg', { ... })
  else if( arguments.length == 3 ){
    return setExtension.apply(this, arguments);
  }

  // e.g. extension('renderer', 'svg', 'nodeShape', 'ellipse')
  else if( arguments.length == 4 ){
    return getModule.apply(this, arguments);
  }

  // e.g. extension('renderer', 'svg', 'nodeShape', 'ellipse', { ... })
  else if( arguments.length == 5 ){
    return setModule.apply(this, arguments);
  }

  else {
    util.error('Invalid extension access syntax');
  }

};

// included extensions
incExts.forEach(function( group ){
  group.extensions.forEach(function( ext ){
    setExtension( group.type, ext.name, ext.impl );
  });
});

module.exports = extension;
