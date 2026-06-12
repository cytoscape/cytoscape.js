import Promise from '../promise.mjs';
import type Event from '../event.mjs';

// minimal surface required of a prototype that receives the event aliases:
// `on`, `removeListener` and `emit` must already be defined; `off` and the
// other aliases are created from them here
interface EventProtoMin {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- aliases pass through arbitrary on/off signatures
  on( ...args: any[] ): unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeListener( ...args: any[] ): unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  emit( ...args: any[] ): unknown;
  // created by eventAliasesOn itself; declared for use inside promiseOn
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off( ...args: any[] ): unknown;
}

let define = {

  eventAliasesOn: function( proto: Omit<EventProtoMin, 'off'> ): void {
    let p = proto as EventProtoMin & Record<string, unknown>;

    p.addListener = p.listen = p.bind = p.on;
    p.unlisten = p.unbind = p.off = p.removeListener;
    p.trigger = p.emit;

    // this is just a wrapper alias of .on()
    p.pon = p.promiseOn = function( this: EventProtoMin, events: string, selector?: unknown ){ // eslint-disable-line @typescript-eslint/no-unused-vars
      let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
      let args = Array.prototype.slice.call( arguments, 0 ); // eslint-disable-line prefer-rest-params

      return new Promise<Event>( function( resolve, reject ){ // eslint-disable-line @typescript-eslint/no-unused-vars
        let callback = function( e: Event ){
          self.off.apply( self, offArgs ); // eslint-disable-line prefer-spread

          resolve( e );
        };

        let onArgs = args.concat( [ callback ] );
        let offArgs = onArgs.concat( [] );

        self.on.apply( self, onArgs ); // eslint-disable-line prefer-spread
      } );
    };
  },

}; // define

export default define;
