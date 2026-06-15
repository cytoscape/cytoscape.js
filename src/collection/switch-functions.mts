import * as is from '../is.mjs';
import type { EventHandler } from '../event-types.mjs';
import type { Collection, Element, ElementPrivate } from './eles-types.mjs';

// TODO(eles-types): autolock()/autoungrabify()/autounselectify() are part of
// the Core API but not declared on the structural CoreAccess interface yet.
interface CoreSwitchAccess {
  autolock(): boolean;
  autoungrabify(): boolean;
  autounselectify(): boolean;
}

// TODO(eles-types): updateStyle() comes from the style mixin and pannable()
// from this very mixin; not yet exposed on Element/Collection via eles-types.
type EleWithStyle = { updateStyle(): unknown };

/** Config for a single state field (e.g. `selected`). */
interface SwitchSetParams {
  field: string;
  ableField?: string;
  on: string;
  off: string;
  overrideField?( ele: Element ): unknown;
  overrideAble?( ele: Element ): boolean | undefined;
}

/** Config passed to the generated select/unselect-style toggle function. */
interface SwitchFunctionParams {
  event: string;
  field: string;
  ableField?: string;
  overrideAble?( ele: Element ): boolean | undefined;
  value: boolean;
}

const elesfn: Record<string, unknown> = {};

function defineSwitchFunction( params: SwitchFunctionParams ){
  return function( this: Collection, ...args: unknown[] ){
    let changedEles: Element[] = [];

    // e.g. cy.nodes().select( data, handler )
    if( args.length === 2 ){
      let data = args[0];
      let handler = args[1];
      this.on( params.event, data as string, handler as EventHandler );
    }

    // e.g. cy.nodes().select( handler )
    else if( args.length === 1 && is.fn(args[0]) ){
      let handler = args[0];
      this.on( params.event, handler as EventHandler );
    }

    // e.g. cy.nodes().select()
    // e.g. (private) cy.nodes().select(['tapselect'])
    else if( args.length === 0 || (args.length === 1 && is.array(args[0])) ){
      let addlEvents = ( args.length === 1 ? args[0] : null ) as string[] | null;

      for( let i = 0; i < this.length; i++ ){
        let ele = this[ i ];
        let _p = ele._private as ElementPrivate;
        let able = !params.ableField || _p[ params.ableField ];
        let changed = _p[ params.field ] != params.value;

        if( params.overrideAble ){
          let overrideAble = params.overrideAble( ele );

          if( overrideAble !== undefined ){
            able = overrideAble;

            if( !overrideAble ){ return this; } // to save cycles assume not able for all on override
          }
        }

        if( able ){
          _p[ params.field ] = params.value;

          if( changed ){
            changedEles.push( ele );
          }
        }
      }

      let changedColl = this.spawn( changedEles );
      ( changedColl as unknown as EleWithStyle ).updateStyle(); // change of state => possible change of style
      changedColl.emit( params.event );

      if( addlEvents ){
        changedColl.emit( addlEvents );
      }
    }

    return this;
  };
}

function defineSwitchSet( params: SwitchSetParams ){
  elesfn[ params.field ] = function( this: Collection ){
    let ele = this[0];

    if( ele ){
      if( params.overrideField ){
        let val = params.overrideField( ele );

        if( val !== undefined ){
          return val;
        }
      }

      return ( ele._private as ElementPrivate )[ params.field ];
    }
  };

  elesfn[ params.on ] = defineSwitchFunction( {
    event: params.on,
    field: params.field,
    ableField: params.ableField,
    overrideAble: params.overrideAble,
    value: true
  } );

  elesfn[ params.off ] = defineSwitchFunction( {
    event: params.off,
    field: params.field,
    ableField: params.ableField,
    overrideAble: params.overrideAble,
    value: false
  } );
}

defineSwitchSet( {
  field: 'locked',
  overrideField: function( ele ){
    return ( ele.cy() as unknown as CoreSwitchAccess ).autolock() ? true : undefined;
  },
  on: 'lock',
  off: 'unlock'
} );

defineSwitchSet( {
  field: 'grabbable',
  overrideField: function( ele ){
    return ( ele.cy() as unknown as CoreSwitchAccess ).autoungrabify() || ( ele as unknown as Pannable ).pannable() ? false : undefined;
  },
  on: 'grabify',
  off: 'ungrabify'
} );

defineSwitchSet( {
  field: 'selected',
  ableField: 'selectable',
  overrideAble: function( ele ){
    return ( ele.cy() as unknown as CoreSwitchAccess ).autounselectify() ? false : undefined;
  },
  on: 'select',
  off: 'unselect'
} );

defineSwitchSet( {
  field: 'selectable',
  overrideField: function( ele ){
    return ( ele.cy() as unknown as CoreSwitchAccess ).autounselectify() ? false : undefined;
  },
  on: 'selectify',
  off: 'unselectify'
} );

elesfn.deselect = elesfn.unselect;

elesfn.grabbed = function( this: Collection ){
  let ele = this[0];
  if( ele ){
    return ele._private.grabbed;
  }
};

defineSwitchSet( {
  field: 'active',
  on: 'activate',
  off: 'unactivate'
} );

defineSwitchSet( {
  field: 'pannable',
  on: 'panify',
  off: 'unpanify'
} );

elesfn.inactive = function( this: Collection ){
  let ele = this[0];
  if( ele ){
    return !ele._private.active;
  }
};

// `pannable()` is generated above by defineSwitchSet; referenced before that in
// the grabbable override, so a local shape is used for the cast there.
interface Pannable { pannable(): boolean; }

export interface CollectionSwitchFunctions {
  // toggles: switch a state field on/off (also bind handlers when given a fn/data)
  // variadic: (data, handler) | (handler) | () | (events[])
  lock( ...args: unknown[] ): Collection;
  unlock( ...args: unknown[] ): Collection;
  grabify( ...args: unknown[] ): Collection;
  ungrabify( ...args: unknown[] ): Collection;
  select( ...args: unknown[] ): Collection;
  unselect( ...args: unknown[] ): Collection;
  deselect( ...args: unknown[] ): Collection;
  selectify( ...args: unknown[] ): Collection;
  unselectify( ...args: unknown[] ): Collection;
  /** @internal */
  activate( ...args: unknown[] ): Collection;
  /** @internal */
  unactivate( ...args: unknown[] ): Collection;
  panify( ...args: unknown[] ): Collection;
  unpanify( ...args: unknown[] ): Collection;

  // predicates / state getters (read the first element's field)
  locked(): boolean | undefined;
  grabbable(): boolean | undefined;
  grabbed(): boolean | undefined;
  selected(): boolean | undefined;
  selectable(): boolean | undefined;
  active(): boolean | undefined;
  pannable(): boolean | undefined;
  /** @internal */
  inactive(): boolean | undefined;
}

export default elesfn as unknown as CollectionSwitchFunctions;
