import * as util from '../util/index.mjs';
import * as is from '../is.mjs';
import get from 'lodash/get.js';
import set from 'lodash/set.js';
import toPath from 'lodash/toPath.js';
import type { EventHandler } from '../emitter.mjs';
import type { EventHandler as PublicEventHandler } from '../event-types.mjs';

/**
 * Configuration for a generated data accessor.
 *
 * `Self` is the host the generated method is installed on (Core or
 * Collection); `Single` is the entity the per-element callbacks receive
 * (an element for collections, the core itself for the core).
 */
export interface DataParams<Self, Single = Self> {
  field?: string;
  bindingEvent?: string;
  allowBinding?: boolean;
  allowSetting?: boolean;
  allowGetting?: boolean;
  settingEvent?: string;
  settingTriggersEvent?: boolean;
  triggerFnName?: string;
  immutableKeys?: Record<string, boolean>; // key => true if immutable
  updateStyle?: boolean;
  beforeGet?( single: Single ): void;
  beforeSet?( self: Self, obj: Record<string, unknown> ): void;
  onSet?( self: Self ): void;
  canSet?( single: Single ): boolean;
}

/** The generated data accessor (e.g. `.data()`, `.scratch()`). */
export interface DataFunc<Self> {
  ( this: Self ): Record<string, unknown> | undefined;
  ( this: Self, name: string ): unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- data values are arbitrary user values
  ( this: Self, name: string, value: any ): Self;
  ( this: Self, obj: Record<string, unknown> ): Self;
  ( this: Self, handler: PublicEventHandler ): Self;
}

export interface RemoveDataParams {
  field?: string;
  event?: string;
  triggerFnName?: string;
  triggerEvent?: boolean;
  immutableKeys?: Record<string, boolean>; // key => true if immutable
  updateStyle?: boolean; // accepted (and ignored) by the remover; passed by some callers
}

/** The generated data remover (e.g. `.removeData()`, `.removeScratch()`). */
export interface RemoveDataFunc<Self> {
  ( this: Self, names?: string ): Self;
}

// Internal working view of the host inside the generated functions. The
// host is duck-typed at runtime: array-like (Collection) or not (Core).
interface DataEntity {
  _private: Record<string, Record<string, unknown>>;
}

interface DataHostView extends DataEntity {
  length?: number;
  updateStyle(): unknown;
  on( events: string, handler: EventHandler ): unknown;
}

let define = {

  // access data field
  data: function<Self, Single = Self>( params: DataParams<Self, Single> ): DataFunc<Self> {
    let defaults: Required<DataParams<Self, Single>> = {
      field: 'data',
      bindingEvent: 'data',
      allowBinding: false,
      allowSetting: false,
      allowGetting: false,
      settingEvent: 'data',
      settingTriggersEvent: false,
      triggerFnName: 'trigger',
      immutableKeys: {}, // key => true if immutable
      updateStyle: false,
      beforeGet: function( self ){}, // eslint-disable-line @typescript-eslint/no-unused-vars
      beforeSet: function( self, obj ){}, // eslint-disable-line @typescript-eslint/no-unused-vars
      onSet: function( self ){}, // eslint-disable-line @typescript-eslint/no-unused-vars
      canSet: function( self ){ return true; } // eslint-disable-line @typescript-eslint/no-unused-vars
    };
    let p = util.extend( {}, defaults, params );

    return function dataImpl( this: Self, name?: string | Record<string, unknown> | EventHandler, value?: unknown ){
      let self = this as unknown as DataHostView;
      let selfIsArrayLike = self.length !== undefined;
      let all = ( selfIsArrayLike ? self : [ self ] ) as unknown as ArrayLike<DataEntity>; // put in array if not array-like
      let single = ( selfIsArrayLike ? ( self as unknown as ArrayLike<DataEntity> )[0] : self ) as DataEntity | undefined;

      // .data('foo', ...)
      if (is.string(name)) { // set or get property
        let isPathLike = name.indexOf('.') !== -1; // there might be a normal field with a dot
        let path = isPathLike && toPath(name);

        // .data('foo')
        if( p.allowGetting && value === undefined ){ // get

          let ret;
          if( single ){
            p.beforeGet( single as unknown as Single );

            // check if it's path and a field with the same name doesn't exist
            if (path && single._private[ p.field ][ name ] === undefined) {
              ret = get(single._private[ p.field ], path);
            } else {
              ret = single._private[ p.field ][ name ];
            }
          }
          return ret;

        // .data('foo', 'bar')
        } else if( p.allowSetting && value !== undefined ){ // set
          let valid = !p.immutableKeys[ name ];
          if( valid ){
            let change = { [name]: value };

            p.beforeSet( this, change );

            for( let i = 0, l = all.length; i < l; i++ ){
              let ele = all[i];

              if( p.canSet( ele as unknown as Single ) ){
                if (path && single!._private[ p.field ][ name ] === undefined) {
                  set(ele._private[ p.field ], path, value);
                } else {
                  ele._private[ p.field ][ name ] = value;
                }
              }
            }

            // update mappers if asked
            if( p.updateStyle ){ self.updateStyle(); }

            // call onSet callback
            p.onSet( this );

            if( p.settingTriggersEvent ){
              ( self as unknown as Record<string, ( event: string ) => unknown> )[ p.triggerFnName ]( p.settingEvent );
            }
          }
        }

      // .data({ 'foo': 'bar' })
      } else if( p.allowSetting && is.plainObject( name ) ){ // extend
        let obj = name;
        let k, v;
        let keys = Object.keys( obj );

        p.beforeSet( this, obj );

        for( let i = 0; i < keys.length; i++ ){
          k = keys[ i ];
          v = obj[ k ];

          let valid = !p.immutableKeys[ k ];
          if( valid ){
            for( let j = 0; j < all.length; j++ ){
              let ele = all[j];

              if( p.canSet( ele as unknown as Single ) ){
                ele._private[ p.field ][ k ] = v;
              }
            }
          }
        }

        // update mappers if asked
        if( p.updateStyle ){ self.updateStyle(); }

        // call onSet callback
        p.onSet( this );

        if( p.settingTriggersEvent ){
          ( self as unknown as Record<string, ( event: string ) => unknown> )[ p.triggerFnName ]( p.settingEvent );
        }

      // .data(function(){ ... })
      } else if( p.allowBinding && is.fn( name ) ){ // bind to event
        let fn = name as EventHandler;
        self.on( p.bindingEvent, fn );

      // .data()
      } else if( p.allowGetting && name === undefined ){ // get whole object
        let ret;
        if( single ){
          p.beforeGet( single as unknown as Single );

          ret = single._private[ p.field ];
        }
        return ret;
      }

      return this; // maintain chainability
    } as DataFunc<Self>; // function
  }, // data

  // remove data field
  removeData: function<Self>( params: RemoveDataParams ): RemoveDataFunc<Self> {
    // updateStyle is accepted from callers but ignored by the remover, so it
    // is intentionally absent from these defaults
    let defaults: Required<Omit<RemoveDataParams, 'updateStyle'>> = {
      field: 'data',
      event: 'data',
      triggerFnName: 'trigger',
      triggerEvent: false,
      immutableKeys: {} // key => true if immutable
    };
    let p = util.extend( {}, defaults, params );

    return function removeDataImpl( this: Self, names?: string ){
      let self = this as unknown as DataHostView;
      let selfIsArrayLike = self.length !== undefined;
      let all = ( selfIsArrayLike ? self : [ self ] ) as unknown as ArrayLike<DataEntity>; // put in array if not array-like

      // .removeData('foo bar')
      if( is.string( names ) ){ // then get the list of keys, and delete them
        let keys = names.split( /\s+/ );
        let l = keys.length;

        for( let i = 0; i < l; i++ ){ // delete each non-empty key
          let key = keys[ i ];
          if( is.emptyString( key ) ){ continue; }

          let valid = !p.immutableKeys[ key ]; // not valid if immutable
          if( valid ){
            for( let i_a = 0, l_a = all.length; i_a < l_a; i_a++ ){
              all[ i_a ]._private[ p.field ][ key ] = undefined;
            }
          }
        }

        if( p.triggerEvent ){
          ( self as unknown as Record<string, ( event: string ) => unknown> )[ p.triggerFnName ]( p.event );
        }

      // .removeData()
      } else if( names === undefined ){ // then delete all keys

        for( let i_a = 0, l_a = all.length; i_a < l_a; i_a++ ){
          let _privateFields = all[ i_a ]._private[ p.field ];
          let keys = Object.keys( _privateFields );

          for( let i = 0; i < keys.length; i++ ){
            let key = keys[i];
            let validKeyToDelete = !p.immutableKeys[ key ];

            if( validKeyToDelete ){
              _privateFields[ key ] = undefined;
            }
          }
        }

        if( p.triggerEvent ){
          ( self as unknown as Record<string, ( event: string ) => unknown> )[ p.triggerFnName ]( p.event );
        }
      }

      return this; // maintain chaining
    }; // function
  }, // removeData
}; // define

export default define;
