;(function($$){ 'use strict';
  
  // registered extensions to cytoscape, indexed by name
  var extensions = {};
  $$.extensions = extensions;
  
  // registered modules for extensions, indexed by name
  var modules = {};
  $$.modules = modules;
  
  function setExtension(type, name, registrant){
    var impl = {};
    impl[name] = registrant;
    
    switch( type ){
    case 'core':
    case 'collection':
      $$.fn[type]( impl );
    }
    
    // fill in missing (optional) layout functions in the prototype
    if( type === 'layout' ){
      var layoutProto = registrant.prototype;
      var optLayoutFns = ['stop', 'resume', 'pause', 'resize'];

      for( var i = 0; i < optLayoutFns.length; i++ ){
        var fnName = optLayoutFns[i];

        layoutProto[fnName] = layoutProto[fnName] || function(){};
      }
    }

    return $$.util.setMap({
      map: extensions,
      keys: [ type, name ],
      value: registrant
    });
  }
  
  function getExtension(type, name){
    return $$.util.getMap({
      map: extensions,
      keys: [ type, name ]
    });
  }
  
  function setModule(type, name, moduleType, moduleName, registrant){
    return $$.util.setMap({
      map: modules,
      keys: [ type, name, moduleType, moduleName ],
      value: registrant
    });
  }
  
  function getModule(type, name, moduleType, moduleName){
    return $$.util.getMap({
      map: modules,
      keys: [ type, name, moduleType, moduleName ]
    });
  }
  
  $$.extension = function(){
    // e.g. $$.extension('renderer', 'svg')
    if( arguments.length == 2 ){
      return getExtension.apply(this, arguments);
    }
    
    // e.g. $$.extension('renderer', 'svg', { ... })
    else if( arguments.length == 3 ){
      return setExtension.apply(this, arguments);
    }
    
    // e.g. $$.extension('renderer', 'svg', 'nodeShape', 'ellipse')
    else if( arguments.length == 4 ){
      return getModule.apply(this, arguments);
    }
    
    // e.g. $$.extension('renderer', 'svg', 'nodeShape', 'ellipse', { ... })
    else if( arguments.length == 5 ){
      return setModule.apply(this, arguments);
    }
    
    else {
      $$.util.error('Invalid extension access syntax');
    }
  
  };
  
})( cytoscape );
