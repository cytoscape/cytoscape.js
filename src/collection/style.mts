import * as is from '../is.mjs';
import * as util from '../util/index.mjs';
import type { Collection, Element } from './eles-types.mjs';
import type { ParsedStyleProperty } from '../style/parse.mjs';

type StyleCacheFn = ( ele: Element ) => unknown;

function styleCache( key: number, fn: StyleCacheFn, ele: Element ): unknown {
  let _p = ele._private;
  let cache = ( _p.styleCache = _p.styleCache || [] ) as unknown[];
  let val;

  if( (val = cache[key]) != null ){
    return val;
  } else {
    val = cache[key] = fn( ele );

    return val;
  }
}

function cacheStyleFunction( key: string, fn: StyleCacheFn ): StyleCacheFn {
  let hashKey = util.hashString( key );

  return function cachedStyleFunction( ele: Element ){
    return styleCache( hashKey, fn, ele );
  };
}

function cachePrototypeStyleFunction( key: string, fn: ( this: Element ) => unknown ): ( this: Collection ) => boolean | undefined {
  let hashKey = util.hashString( key );

  let selfFn = ( ele: Element ) => fn.call( ele );

  return function cachedPrototypeStyleFunction( this: Collection ){
    let ele = this[0];

    if( ele ){
      return styleCache( hashKey, selfFn, ele ) as boolean | undefined;
    }
  };
}

let elesfn = ({

  recalculateRenderedStyle: function( this: Collection, useCache?: boolean ){
    let cy = this.cy();
    let renderer = cy.renderer();
    let styleEnabled = cy.styleEnabled();

    if( renderer && styleEnabled ){
      ( renderer as { recalculateRenderedStyle( eles: Collection, useCache?: boolean ): void } ).recalculateRenderedStyle( this, useCache );
    }

    return this;
  },

  dirtyStyleCache: function( this: Collection ){
    let cy = this.cy();
    let dirty = ( ele: Element ) => ele._private.styleCache = null;

    if( cy.hasCompoundNodes() ){
      let eles;

      eles = this.spawnSelf()
        .merge( this.descendants() )
        .merge( this.parents() )
      ;

      eles.merge( eles.connectedEdges() );

      eles.forEach( dirty );
    } else {
      this.forEach( ( ele: Element ) => {
        dirty( ele );

        ele.connectedEdges().forEach( dirty );
      } );
    }

    return this;
  },

  // fully updates (recalculates) the style for the elements
  updateStyle: function( this: Collection, notifyRenderer?: boolean ){
    let cy = this._private.cy;

    if( !cy.styleEnabled() ){ return this; }

    if( cy.batching() ){
      let bEles = ( cy._private.batchStyleEles as Collection );

      bEles.merge( this );

      return this; // chaining and exit early when batching
    }

    let hasCompounds = cy.hasCompoundNodes();
    let updatedEles: Collection = this; // eslint-disable-line @typescript-eslint/no-this-alias

    notifyRenderer = notifyRenderer || notifyRenderer === undefined ? true : false;

    if( hasCompounds ){ // then add everything up and down for compound selector checks
      updatedEles = this.spawnSelf().merge( this.descendants() ).merge( this.parents() );
    }

    // let changedEles = style.apply( updatedEles );
    let changedEles = updatedEles;

    if( notifyRenderer ){
      changedEles.emitAndNotify( 'style' ); // let renderer know we changed style
    } else {
      changedEles.emit( 'style' ); // just fire the event
    }

    updatedEles.forEach(( ele: Element ) => ele._private.styleDirty = true);

    return this; // chaining
  },

  // private: clears dirty flag and recalculates style
  cleanStyle: function( this: Collection ){
    let cy = this.cy();

    if( !cy.styleEnabled() ){ return; }

    for( let i = 0; i < this.length; i++ ){
      let ele = this[i];

      if( ele._private.styleDirty ){
        // n.b. this flag should be set before apply() to avoid potential infinite recursion
        ele._private.styleDirty = false;

        cy.style().apply(ele);
      }
    }
  },

  // get the internal parsed style object for the specified property
  parsedStyle: function( this: Collection, property: string, includeNonDefault = true ): ParsedStyleProperty | null | undefined {
    let ele = this[0];
    let cy = ele.cy();

    if( !cy.styleEnabled() ){ return; }

    if( ele ){
      // this.cleanStyle();

      // Inline the important part of cleanStyle(), for raw performance
      if( ele._private.styleDirty ){
        // n.b. this flag should be set before apply() to avoid potential infinite recursion
        ele._private.styleDirty = false;
        cy.style().apply(ele);
      }

      let overriddenStyle = ele._private.style[ property ];

      if( overriddenStyle != null ){
        return overriddenStyle;
      } else if( includeNonDefault ){
        return ( cy.style() ).getDefaultProperty( property );
      } else {
        return null;
      }
    }
  },

  numericStyle: function( this: Collection, property: string ){
    let ele = this[0];

    if( !ele.cy().styleEnabled() ){ return; }

    if( ele ){
      let pstyle = ele.pstyle( property ) as ParsedStyleProperty;

      return pstyle.pfValue !== undefined ? pstyle.pfValue : pstyle.value;
    }
  },

  numericStyleUnits: function( this: Collection, property: string ){
    let ele = this[0];

    if( !ele.cy().styleEnabled() ){ return; }

    if( ele ){
      return ( ele.pstyle( property ) as ParsedStyleProperty ).units;
    }
  },

  // get the specified css property as a rendered value (i.e. on-screen value)
  // or get the whole rendered style if no property specified (NB doesn't allow setting)
  renderedStyle: function( this: Collection, property?: string ){
    let cy = this.cy();
    if( !cy.styleEnabled() ){ return this; }

    let ele = this[0];

    if( ele ){
      return cy.style().getRenderedStyle( ele, property );
    }
  },

  // read the calculated css style of the element or override the style (via a bypass)
  style: function( this: Collection, name?: string | Record<string, unknown>, value?: unknown ){
    let cy = this.cy();

    if( !cy.styleEnabled() ){ return this; }

    let updateTransitions = false;
    let style = cy.style();

    if( is.plainObject( name ) ){ // then extend the bypass
      let props = name;
      style.applyBypass( this, props, updateTransitions );

      this.emitAndNotify( 'style' ); // let the renderer know we've updated style

    } else if( is.string( name ) ){

      if( value === undefined ){ // then get the property from the style
        let ele = this[0];

        if( ele ){
          return style.getStylePropertyValue( ele, name );
        } else { // empty collection => can't get any value
          return;
        }

      } else { // then set the bypass with the property value
        style.applyBypass( this, name, value, updateTransitions );

        this.emitAndNotify( 'style' ); // let the renderer know we've updated style
      }

    } else if( name === undefined ){
      let ele = this[0];

      if( ele ){
        return style.getRawStyle( ele );
      } else { // empty collection => can't get any value
        return;
      }
    }

    return this; // chaining
  },

  removeStyle: function( this: Collection, names?: string ){
    let cy = this.cy();

    if( !cy.styleEnabled() ){ return this; }

    let updateTransitions = false;
    let style = cy.style();
    let eles = this; // eslint-disable-line @typescript-eslint/no-this-alias

    if( names === undefined ){
      for( let i = 0; i < eles.length; i++ ){
        let ele = eles[ i ];

        style.removeAllBypasses( ele, updateTransitions );
      }
    } else {
      let nameList = names.split( /\s+/ );

      for( let i = 0; i < eles.length; i++ ){
        let ele = eles[ i ];

        style.removeBypasses( ele, nameList, updateTransitions );
      }
    }

    this.emitAndNotify( 'style' ); // let the renderer know we've updated style

    return this; // chaining
  },

  show: function( this: Collection ){
    this.css( 'display', 'element' );
    return this; // chaining
  },

  hide: function( this: Collection ){
    this.css( 'display', 'none' );
    return this; // chaining
  },

  effectiveOpacity: function( this: Collection ): number | undefined {
    let cy = this.cy();
    if( !cy.styleEnabled() ){ return 1; }

    let hasCompoundNodes = cy.hasCompoundNodes();
    let ele = this[0];

    if( ele ){
      let _p = ele._private;
      let parentOpacity = ( ele.pstyle( 'opacity' ) as ParsedStyleProperty ).value as number;

      if( !hasCompoundNodes ){ return parentOpacity; }

      let parents = !_p.data.parent ? null : ele.parents();

      if( parents ){
        for( let i = 0; i < parents.length; i++ ){
          let parent = parents[ i ];
          let opacity = ( parent.pstyle( 'opacity' ) as ParsedStyleProperty ).value as number;

          parentOpacity = opacity * parentOpacity;
        }
      }

      return parentOpacity;
    }
  },

  transparent: function( this: Collection ): boolean | undefined {
    let cy = this.cy();
    if( !cy.styleEnabled() ){ return false; }

    let ele = this[0];
    let hasCompoundNodes = ele.cy().hasCompoundNodes();

    if( ele ){
      if( !hasCompoundNodes ){
        return ( ele.pstyle( 'opacity' ) as ParsedStyleProperty ).value === 0;
      } else {
        return ele.effectiveOpacity() === 0;
      }
    }
  },

  backgrounding: function( this: Collection ): boolean {
    let cy = this.cy();
    if( !cy.styleEnabled() ){ return false; }

    let ele = this[0];

    return ele._private.backgrounding ? true : false;
  }

  // n.b. the remaining members (takesUpSpace, interactive, visible, ...) and
  // aliases are attached below; cast through the full interface so they can be
  // assigned and so the default export is fully typed.
}) as unknown as CollectionStyle;

function checkCompound( ele: Element, parentOk: ( parent: Element ) => unknown ): boolean {
  let _p = ele._private;
  let parents = _p.data.parent ? ele.parents() : null;

  if( parents ){ for( let i = 0; i < parents.length; i++ ){
    let parent = parents[ i ];

    if( !parentOk( parent ) ){ return false; }
  } }

  return true;
}

interface DerivedStateSpecs {
  ok: ( ele: Element ) => unknown;
  edgeOkViaNode?: ( ele: Element ) => unknown;
  parentOk?: ( ele: Element ) => unknown;
}

function defineDerivedStateFunction( specs: DerivedStateSpecs ): ( this: Element ) => boolean | undefined {
  let ok = specs.ok;
  let edgeOkViaNode = specs.edgeOkViaNode || specs.ok;
  let parentOk = specs.parentOk || specs.ok;

  return function( this: Element ){
    let cy = this.cy();
    if( !cy.styleEnabled() ){ return true; }

    let ele = this[0];
    let hasCompoundNodes = cy.hasCompoundNodes();

    if( ele ){
      let _p = ele._private;

      if( !ok( ele ) ){ return false; }

      if( ele.isNode() ){
        return !hasCompoundNodes || checkCompound( ele, parentOk );
      } else {
        let src = _p.source as Element;
        let tgt = _p.target as Element;

        return ( !!edgeOkViaNode(src) && (!hasCompoundNodes || checkCompound(src, edgeOkViaNode)) ) &&
          ( src === tgt || ( !!edgeOkViaNode(tgt) && (!hasCompoundNodes || checkCompound(tgt, edgeOkViaNode)) ) );
      }
    }
  };
}

let eleTakesUpSpace = cacheStyleFunction( 'eleTakesUpSpace', function( ele: Element ){
  return (
    ( ele.pstyle( 'display' ) as ParsedStyleProperty ).value === 'element'
    && ele.width() !== 0
    && ( ele.isNode() ? ele.height() !== 0 : true )
  );
} );

elesfn.takesUpSpace = cachePrototypeStyleFunction( 'takesUpSpace', defineDerivedStateFunction({
  ok: eleTakesUpSpace
}) );

let eleInteractive = cacheStyleFunction( 'eleInteractive', function( ele: Element ){
  return (
    ( ele.pstyle('events') as ParsedStyleProperty ).value === 'yes'
    && ( ele.pstyle('visibility') as ParsedStyleProperty ).value === 'visible'
    && eleTakesUpSpace( ele )
  );
} );

let parentInteractive = cacheStyleFunction( 'parentInteractive', function( parent: Element ){
  return (
    ( parent.pstyle('visibility') as ParsedStyleProperty ).value === 'visible'
    && eleTakesUpSpace( parent )
  );
} );

elesfn.interactive = cachePrototypeStyleFunction( 'interactive', defineDerivedStateFunction({
  ok: eleInteractive,
  parentOk: parentInteractive,
  edgeOkViaNode: eleTakesUpSpace
}) );

elesfn.noninteractive = function( this: Collection ){
  let ele = this[0];

  if( ele ){
    return !ele.interactive();
  }
};

let eleVisible = cacheStyleFunction( 'eleVisible', function( ele: Element ){
  return (
    ( ele.pstyle( 'visibility' ) as ParsedStyleProperty ).value === 'visible'
    && ( ele.pstyle( 'opacity' ) as ParsedStyleProperty ).pfValue !== 0
    && eleTakesUpSpace( ele )
  );
} );

let edgeVisibleViaNode = eleTakesUpSpace;

elesfn.visible = cachePrototypeStyleFunction( 'visible', defineDerivedStateFunction({
  ok: eleVisible,
  edgeOkViaNode: edgeVisibleViaNode
}) );

elesfn.hidden = function( this: Collection ){
  let ele = this[0];

  if( ele ){
    return !ele.visible();
  }
};

elesfn.isBundledBezier = cachePrototypeStyleFunction('isBundledBezier', function( this: Element ){
  if( !this.cy().styleEnabled() ){ return false; }

  return !this.removed() && ( this.pstyle('curve-style') as ParsedStyleProperty ).value === 'bezier' && this.takesUpSpace();
});

elesfn.bypass = elesfn.css = elesfn.style;
elesfn.renderedCss = elesfn.renderedStyle;
elesfn.removeBypass = elesfn.removeCss = elesfn.removeStyle;
elesfn.pstyle = elesfn.parsedStyle;

export default elesfn as CollectionStyle;

/** Style accessor methods contributed to the collection prototype. */
export interface CollectionStyle {
  /** @internal */
  recalculateRenderedStyle( this: Collection, useCache?: boolean ): Collection;
  /** @internal */
  dirtyStyleCache( this: Collection ): Collection;
  /** @internal */
  updateStyle( this: Collection, notifyRenderer?: boolean ): Collection;
  /** @internal */
  cleanStyle( this: Collection ): void;
  /** @internal */
  parsedStyle( this: Collection, property: string, includeNonDefault?: boolean ): ParsedStyleProperty | null | undefined;
  /** @internal */
  pstyle( this: Collection, property: string, includeNonDefault?: boolean ): ParsedStyleProperty | null | undefined;
  numericStyle( this: Collection, property: string ): number | unknown;
  numericStyleUnits( this: Collection, property: string ): string | ( string | undefined )[] | undefined;
  /** @internal */
  renderedStyle( this: Collection, property?: string ): unknown;
  style( this: Collection, name?: string | Record<string, unknown>, value?: unknown ): unknown;
  css( this: Collection, name?: string | Record<string, unknown>, value?: unknown ): unknown;
  /** @internal */
  bypass( this: Collection, name?: string | Record<string, unknown>, value?: unknown ): unknown;
  /** @internal */
  renderedCss( this: Collection, property?: string ): unknown;
  removeStyle( this: Collection, names?: string ): Collection;
  /** @internal */
  removeBypass( this: Collection, names?: string ): Collection;
  /** @internal */
  removeCss( this: Collection, names?: string ): Collection;
  /** @internal */
  show( this: Collection ): Collection;
  /** @internal */
  hide( this: Collection ): Collection;
  effectiveOpacity( this: Collection ): number | undefined;
  transparent( this: Collection ): boolean | undefined;
  /** @internal */
  backgrounding( this: Collection ): boolean;
  /** @internal */
  takesUpSpace( this: Collection ): boolean | undefined;
  /** @internal */
  interactive( this: Collection ): boolean | undefined;
  /** @internal */
  noninteractive( this: Collection ): boolean | undefined;
  visible( this: Collection ): boolean | undefined;
  hidden( this: Collection ): boolean | undefined;
  /** @internal */
  isBundledBezier( this: Collection ): boolean | undefined;
}
