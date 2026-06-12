import type { Core } from './core-types.mjs';
import type { Collection } from '../collection/eles-types.mjs';

// batchNotifications is keyed by event name and not modelled on CorePrivate;
// narrow it locally from the private bag's index signature
type BatchNotifications = Record<string, Collection>;

let corefn = ({
  notify: function( this: Core, eventName: string, eventEles?: Collection ){
    let _p = this._private;

    if( this.batching() ){
      let batchNotifications = ( _p.batchNotifications = ( _p.batchNotifications || {} ) as BatchNotifications );

      let eles = batchNotifications[ eventName ] = batchNotifications[ eventName ] || this.collection();

      if( eventEles != null ){
        eles.merge( eventEles );
      }

      return; // notifications are disabled during batching
    }

    if( !_p.notificationsEnabled ){ return; } // exit on disabled

    let renderer = this.renderer();

    // exit if destroy() called on core or renderer in between frames #1499 #1528
    if( this.destroyed() || !renderer ){ return; }

    // call notify as a method so its `this` binding (the renderer) is
    // preserved; the RendererInstance contract isn't precisely typed here
    ( renderer as unknown as { notify( eventName: string, eventEles?: Collection ): void } ).notify( eventName, eventEles );
  },

  notifications: function( this: Core, bool?: boolean ){
    let p = this._private;

    if( bool === undefined ){
      return p.notificationsEnabled;
    } else {
      p.notificationsEnabled = bool ? true : false;
    }

    return this;
  },

  noNotifications: function( this: Core, callback: () => void ){
    this.notifications( false );
    callback();
    this.notifications( true );
  },

  batching: function( this: Core ){
    return ( this._private.batchCount as number ) > 0;
  },

  startBatch: function( this: Core ){
    let _p = this._private;

    if( _p.batchCount == null ){
      _p.batchCount = 0;
    }

    if( _p.batchCount === 0 ){
      _p.batchStyleEles = this.collection();
      _p.batchNotifications = {};
    }

    _p.batchCount++;

    return this;
  },

  endBatch: function( this: Core ){
    let _p = this._private;

    if( _p.batchCount === 0 ){ return this; }

    _p.batchCount!--;

    if( _p.batchCount === 0 ){
      // update style for dirty eles
      _p.batchStyleEles!.updateStyle();

      let renderer = this.renderer();

      let batchNotifications = _p.batchNotifications as BatchNotifications;

      // notify the renderer of queued eles and event types. Call notify as a
      // method so its `this` binding (the renderer) is preserved; the
      // RendererInstance contract isn't precisely typed for this call shape.
      let r = renderer! as unknown as { notify( eventName: string, eventEles?: Collection ): void };

      Object.keys( batchNotifications ).forEach( eventName => {
        let eles = batchNotifications[eventName];

        if( eles.empty() ){
          r.notify( eventName );
        } else {
          r.notify( eventName, eles );
        }
      } );
    }

    return this;
  },

  batch: function( this: Core, callback: () => void ){
    this.startBatch();
    callback();
    this.endBatch();

    return this;
  },

  // for backwards compatibility
  batchData: function( this: Core, map: Record<string, unknown> ){
    let cy = this; // eslint-disable-line @typescript-eslint/no-this-alias

    return this.batch( function(){
      let ids = Object.keys( map );

      for( let i = 0; i < ids.length; i++ ){
        let id = ids[i];
        let data = map[ id ];
        let ele = cy.getElementById( id );

        // each map entry is a data object to apply to the matched element
        ele.data( data as Record<string, unknown> );
      }
    } );
  }
});

export default corefn as unknown as CoreNotification;

export interface CoreNotification {
  /** @internal */
  notify( eventName: string, eventEles?: Collection ): void;
  /** @internal */
  notifications( bool?: boolean ): boolean | Core | undefined;
  /** @internal */
  noNotifications( callback: () => void ): void;
  /** @internal */
  batching(): boolean;
  startBatch(): Core;
  endBatch(): Core;
  batch( callback: () => void ): Core;
  /** @internal */
  batchData( map: Record<string, unknown> ): Core;
}
