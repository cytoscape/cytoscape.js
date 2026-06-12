import * as util from'./util/index.mjs';
import define from './define/index.mjs';
import Collection from './collection/index.mjs';
import Core from './core/index.mjs';
import incExts from './extensions/index.mjs';
import * as is from './is.mjs';
import Emitter from './emitter.mjs';
import type { EmitterOptions } from './emitter.mjs';

/* eslint-disable @typescript-eslint/no-explicit-any, prefer-spread, prefer-rest-params --
   the extension registry is irreducibly dynamic: it stores and wraps
   arbitrary plugin registrants (methods, layout/renderer constructors),
   mutates prototypes by computed name, and dispatches on arguments.length. */

// a registrant is a plugin-provided method or constructor function
type Registrant = any;
// an arbitrary prototype map the registry mutates by computed key
type AnyProto = Record<string, any>;

// registered extensions to cytoscape, indexed by name
let extensions: Record<string, Record<string, unknown>> = {};

// registered modules for extensions, indexed by name
let modules: Record<string, unknown> = {};

function setExtension( type: string, name: string, registrant: Registrant ): unknown {

  let ext = registrant;

  let overrideErr = function( field: string ){
    util.warn( 'Can not register `' + name + '` for `' + type + '` since `' + field + '` already exists in the prototype and can not be overridden' );
  };

  if( type === 'core' ){
    if( ( Core.prototype as AnyProto )[ name ] ){
      return overrideErr( name );
    } else {
      ( Core.prototype as AnyProto )[ name ] = registrant;
    }

  } else if( type === 'collection' ){
    if( ( Collection.prototype as AnyProto )[ name ] ){
      return overrideErr( name );
    } else {
      ( Collection.prototype as AnyProto )[ name ] = registrant;
    }

  } else if( type === 'layout' ){
    // fill in missing layout functions in the prototype

    let Layout = function( this: AnyProto, options: any ){
      this.options = options;

      registrant.call( this, options );

      // make sure layout has _private for use w/ std apis like .on()
      if( !is.plainObject( this._private ) ){
        this._private = {};
      }

      this._private.cy = options.cy;
      this._private.listeners = [];

      this.createEmitter();
    };

    let layoutProto: AnyProto = Layout.prototype = Object.create( registrant.prototype );

    let optLayoutFns: string[] = [];

    for( let i = 0; i < optLayoutFns.length; i++ ){
      let fnName = optLayoutFns[ i ];

      layoutProto[ fnName ] = layoutProto[ fnName ] || function( this: AnyProto ){ return this; };
    }

    // either .start() or .run() is defined, so autogen the other
    if( layoutProto.start && !layoutProto.run ){
      layoutProto.run = function( this: AnyProto ){ this.start(); return this; };
    } else if( !layoutProto.start && layoutProto.run ){
      layoutProto.start = function( this: AnyProto ){ this.run(); return this; };
    }

    let regStop = registrant.prototype.stop;
    layoutProto.stop = function( this: AnyProto ){
      let opts = this.options;

      if( opts && opts.animate ){
        let anis = this.animations;

        if( anis ){
          for( let i = 0; i < anis.length; i++ ){
            anis[ i ].stop();
          }
        }
      }

      if( regStop ){
        regStop.call( this );
      } else {
        this.emit( 'layoutstop' );
      }

      return this;
    };

    if( !layoutProto.destroy ){
      layoutProto.destroy = function( this: AnyProto ){
        return this;
      };
    }

    layoutProto.cy = function( this: AnyProto ){
      return this._private.cy;
    };

    let getCy = ( layout: any ) => layout._private.cy;

    let emitterOpts: EmitterOptions<any> = {
      addEventFields: function( layout: any, evt: any ){
        evt.layout = layout;
        evt.cy = getCy(layout);
        evt.target = layout;
      },
      bubble: function(){ return true; },
      parent: function( layout: any ){ return getCy(layout); }
    };

    util.assign( layoutProto, ({
      createEmitter: function( this: AnyProto ){
        this._private.emitter = new Emitter( emitterOpts, this );

        return this;
      },
      emitter: function( this: AnyProto ){ return this._private.emitter; },
      on: function( this: AnyProto, evt: any, cb: any ){ this.emitter().on( evt, cb ); return this; },
      one: function( this: AnyProto, evt: any, cb: any ){ this.emitter().one( evt, cb ); return this; },
      once: function( this: AnyProto, evt: any, cb: any ){ this.emitter().one( evt, cb ); return this; },
      removeListener: function( this: AnyProto, evt: any, cb: any ){ this.emitter().removeListener( evt, cb ); return this; },
      removeAllListeners: function( this: AnyProto ){ this.emitter().removeAllListeners(); return this; },
      emit: function( this: AnyProto, evt: any, params: any ){ this.emitter().emit( evt, params ); return this; }
    }) );

    define.eventAliasesOn( layoutProto as any );

    ext = Layout; // replace with our wrapped layout

  } else if( type === 'renderer' && name !== 'null' && name !== 'base' ){
    // user registered renderers inherit from base

    let BaseRenderer = getExtension( 'renderer', 'base' ) as any;
    let bProto = BaseRenderer.prototype;
    let RegistrantRenderer = registrant;
    let rProto = registrant.prototype;

    let Renderer = function( this: AnyProto ){
      BaseRenderer.apply( this, arguments ); // eslint-disable-line prefer-rest-params
      RegistrantRenderer.apply( this, arguments ); // eslint-disable-line prefer-rest-params
    };

    let proto = Renderer.prototype;

    for( let pName in bProto ){
      let pVal = bProto[ pName ];
      let existsInR = rProto[ pName ] != null;

      if( existsInR ){
        return overrideErr( pName );
      }

      proto[ pName ] = pVal; // take impl from base
    }

    for( let pName in rProto ){
      proto[ pName ] = rProto[ pName ]; // take impl from registrant
    }

    bProto.clientFunctions.forEach( function( name: string ){
      proto[ name ] = proto[ name ] || function(){
        util.error( 'Renderer does not implement `renderer.' + name + '()` on its prototype' );
      };
    } );

    ext = Renderer;

  } else if (type === '__proto__' || type === 'constructor' || type === 'prototype'){
    // to avoid potential prototype pollution
    return util.error( type + ' is an illegal type to be registered, possibly lead to prototype pollutions' );
  }

  return util.setMap( {
    map: extensions,
    keys: [ type, name ],
    value: ext
  } );
}

function getExtension( type: string, name: string ): unknown {
  return util.getMap( {
    map: extensions,
    keys: [ type, name ]
  } );
}

function setModule( type: string, name: string, moduleType: string, moduleName: string, registrant: Registrant ): unknown {
  return util.setMap( {
    map: modules,
    keys: [ type, name, moduleType, moduleName ],
    value: registrant
  } );
}

function getModule( type: string, name: string, moduleType: string, moduleName: string ): unknown {
  return util.getMap( {
    map: modules,
    keys: [ type, name, moduleType, moduleName ]
  } );
}

/** The extension registry accessor; behaviour is keyed on arg count. */
export interface ExtensionFn {
  ( type: string, name: string ): unknown; // get extension
  ( type: string, name: string, registrant: Registrant ): unknown; // set extension
  ( type: string, name: string, moduleType: string, moduleName: string ): unknown; // get module
  ( type: string, name: string, moduleType: string, moduleName: string, registrant: Registrant ): unknown; // set module
}

let extension = function(){
  // e.g. extension('renderer', 'svg')
  if( arguments.length === 2 ){
    return getExtension.apply( null, arguments as unknown as [ string, string ] );
  }

  // e.g. extension('renderer', 'svg', { ... })
  else if( arguments.length === 3 ){
    return setExtension.apply( null, arguments as unknown as [ string, string, Registrant ] );
  }

  // e.g. extension('renderer', 'svg', 'nodeShape', 'ellipse')
  else if( arguments.length === 4 ){
    return getModule.apply( null, arguments as unknown as [ string, string, string, string ] );
  }

  // e.g. extension('renderer', 'svg', 'nodeShape', 'ellipse', { ... })
  else if( arguments.length === 5 ){
    return setModule.apply( null, arguments as unknown as [ string, string, string, string, Registrant ] );
  }

  else {
    util.error( 'Invalid extension access syntax' );
  }

} as ExtensionFn; // eslint-disable-line prefer-rest-params

// allows a core instance to access extensions internally
Core.prototype.extension = extension;

// included extensions
incExts.forEach( function( group: any ){
  group.extensions.forEach( function( ext: any ){
    setExtension( group.type, ext.name, ext.impl );
  } );
} );

export default extension;
