import * as is from '../is.mjs';
import * as util from '../util/index.mjs';
import Selector from '../selector/index.mjs';

import apply, { type ApplyStyfn, type ContextStyleMap } from './apply.mjs';
import bypass, { type BypassStyfn } from './bypass.mjs';
import container, { type ContainerStyfn } from './container.mjs';
import getForEle, { type GetForEleStyfn } from './get-for-ele.mjs';
import json, { type JsonStyfn, type StyleJsonBlock } from './json.mjs';
import stringSheet, { type StringSheetStyfn } from './string-sheet.mjs';
import properties, { type PropertiesStyfn, type StyleProperty, type StylePropertyType, type StylePropertiesTable } from './properties.mjs';
import parse, { type ParseStyfn, type ParsedStyleProperty, type ParseResult } from './parse.mjs';

import type { CoreShim } from '../types.mjs';
import type { PromiseLikeObject } from '../promise.mjs';
import type { Css } from './css-types.mjs';

export type { default as Selector } from '../selector/index.mjs';

/** The element `_private` fields read/written by style code. */
export interface StyleElementPrivate {
  /** name -> applied parsed property */
  style: Record<string, ParsedStyleProperty | null | undefined>;
  styleCxtKey?: string;
  /** style hint hashes per property group */
  styleKeys: Record<string, [ number, number ]>;
  styleKey: number | null;
  labelDimsKey?: number | null;
  labelKey: number | null;
  labelStyleKey: number | null;
  sourceLabelKey: number | null;
  sourceLabelStyleKey: number | null;
  targetLabelKey: number | null;
  targetLabelStyleKey: number | null;
  nodeKey: number | null;
  hasPie: boolean | null;
  hasStripe: boolean | null;
  appliedInitStyle: boolean;
  styleDirty: boolean;
  transitioning: boolean;
  group: string;
  data: Record<string, unknown>;
}

/** Minimal structural view of a playable animation, as used by style transitions. */
export interface StyleAnimation {
  play(): StyleAnimation;
  promise(): PromiseLikeObject<unknown>;
}

/**
 * Minimal structural view of a single element, as used by style code.
 * Replaced by the real Element type once src/collection is converted.
 */
export interface StyleElement {
  length: number;
  [ index: number ]: StyleElement;
  _private: StyleElementPrivate;
  pstyle( name: string, includeNonDefault?: boolean ): ParsedStyleProperty;
  id(): string;
  cy(): StyleCore;
  isEdge(): boolean;
  isLoop(): boolean;
  isParent(): boolean;
  source(): StyleElement;
  target(): StyleElement;
  removed(): boolean;
  poolIndex(): number;
  dirtyCompoundBoundsCache(): void;
  dirtyBoundingBoxCache(): void;
  dirtyStyleCache(): void;
  connectedEdges(): StyleEles;
  parallelEdges(): StyleEles;
  emitAndNotify( events: string ): void;
  delayAnimation( duration: number ): StyleAnimation;
  animation( options: Record<string, unknown> ): StyleAnimation;
}

/**
 * Minimal structural view of a collection, as used by style code.
 * Replaced by the real Collection type once src/collection is converted.
 */
export interface StyleEles {
  length: number;
  [ index: number ]: StyleElement;
  forEach( fn: ( ele: StyleElement ) => void ): void;
  updateStyle(): void;
  push( ele: StyleElement ): unknown;
}

/**
 * Minimal structural view of the Core, as used by style code. Replaced by
 * the real Core type once src/core is converted.
 */
export interface StyleCore extends CoreShim {
  collection(): StyleEles;
  elements(): StyleEles;
  mutableElements(): StyleEles;
  notify( event: string, eles?: StyleElement ): void;
  container(): HTMLElement | null | undefined;
  window(): { getComputedStyle?: ( elt: Element ) => CSSStyleDeclaration } | null | undefined;
  style(): Style;
}

/** The per-context parsed property list, which doubles as a name -> property map. */
export type StyleContextProperties = ParsedStyleProperty[] & { [ name: string ]: ParsedStyleProperty | undefined };

/** A style context: a selector and the properties applied where it matches. */
export interface StyleContext {
  selector: Selector | null;
  properties: StyleContextProperties;
  mappedProperties: ParsedStyleProperty[];
  index: number;
}

export interface StylePrivate {
  cy: StyleCore;
  coreStyle: Record<string, ParsedStyleProperty>;
  contextStyles?: Record<string, ContextStyleMap>;
  propDiffs?: Record<string, string[]>;
  hasPie?: boolean;
  hasStripe?: boolean;
  defaultProperties?: Record<string, ParseResult>;
}

// the prototype surface of a Style instance; contexts are stored array-like by index
export interface Style extends ApplyStyfn, BypassStyfn, ContainerStyfn, GetForEleStyfn, JsonStyfn, StringSheetStyfn, PropertiesStyfn, ParseStyfn {
  length: number;
  /** the number of contexts in the default stylesheet (set by addDefaultStylesheet) */
  defaultLength: number;
  [ index: number ]: StyleContext;
  _private: StylePrivate;
  /** cache of parsed properties, keyed by argument hash (set lazily by parse) */
  propCache?: ParseResult[];
  instanceString(): string;
  clear(): Style;
  resetToDefault(): Style;
  core( propName: string ): ParseResult;
  selector( selectorStr: string ): Style;
  css(): Style;
  css( map: Css.Node | Css.Edge | Css.Core ): Style;
  css( name: string, value: unknown ): Style;
  style: Style['css'];
  cssRule( name: string, value: unknown ): Style;
  append( style: unknown ): Style;
}

// callable with or without `new` (it guards internally), so it must stay a
// constructor function rather than become an ES class
export interface StyleStatic {
  ( this: Style | void, cy: StyleCore ): Style;
  new ( cy: StyleCore ): Style;
  prototype: Style;
  fromJson( cy: StyleCore, json: StyleJsonBlock[] ): Style;
  fromString( cy: StyleCore, string: string ): Style;
  types: Record<string, StylePropertyType>;
  properties: StylePropertiesTable;
  propertyGroups: Record<string, StyleProperty[]>;
  propertyGroupNames: Record<string, string[]>;
  propertyGroupKeys: string[];
}

// eslint-disable-next-line @typescript-eslint/no-redeclare -- intentional type/value pairing under one exported name
let Style = function( this: Style, cy: StyleCore ){

  if( !(this instanceof Style) ){
    return new Style( cy );
  }

  if( !is.core( cy ) ){
    util.error( 'A style must have a core reference' );
    return;
  }

  this._private = {
    cy: cy,
    coreStyle: {}
  };

  this.length = 0;

  this.resetToDefault();
} as StyleStatic;

let styfn = Style.prototype;

styfn.instanceString = function(){
  return 'style';
};

// remove all contexts
styfn.clear = function(){
  let _p = this._private;
  let cy = _p.cy;
  let eles = cy.elements();

  for( let i = 0; i < this.length; i++ ){
    ( this as { [ index: number ]: StyleContext | undefined } )[ i ] = undefined;
  }
  this.length = 0;

  _p.contextStyles = {};
  _p.propDiffs = {};

  this.cleanElements( eles, true );

  eles.forEach(ele => {
    let ele_p = ele[0]._private;

    ele_p.styleDirty = true;
    ele_p.appliedInitStyle = false;
  });

  return this; // chaining
};

styfn.resetToDefault = function(){
  this.clear();
  this.addDefaultStylesheet();

  return this;
};

// builds a style object for the 'core' selector
styfn.core = function( propName ){
  return this._private.coreStyle[ propName ] || this.getDefaultProperty( propName );
};

// create a new context from the specified selector string and switch to that context
styfn.selector = function( selectorStr ){
  // 'core' is a special case and does not need a selector
  let selector = selectorStr === 'core' ? null : new Selector( selectorStr );

  let i = this.length++; // new context means new index
  this[ i ] = {
    selector: selector,
    properties: [] as unknown as StyleContextProperties, // the array doubles as a name -> prop map
    mappedProperties: [],
    index: i
  };

  return this; // chaining
};

// add one or many css rules to the current context
styfn.css = function(){
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias
  // eslint-disable-next-line prefer-rest-params -- kept as `arguments` to preserve the original runtime exactly
  let args = arguments;

  if( args.length === 1 ){
    let map = args[0];

    for( let i = 0; i < self.properties.length; i++ ){
      let prop = self.properties[ i ];
      let mapVal = map[ prop.name ];

      if( mapVal === undefined ){
        mapVal = map[ util.dash2camel( prop.name ) ];
      }

      if( mapVal !== undefined ){
        this.cssRule( prop.name, mapVal );
      }
    }

  } else if( args.length === 2 ){
    this.cssRule( args[0], args[1] );
  }

  // do nothing if args are invalid

  return this; // chaining
};
styfn.style = styfn.css;

// add a single css rule to the current context
styfn.cssRule = function( name, value ){
  // name-value pair
  let property = this.parse( name, value );

  // add property to current context if valid
  if( property ){
    let i = this.length - 1;
    this[ i ].properties.push( property );
    this[ i ].properties[ property.name ] = property; // allow access by name as well

    if( property.name.match( /pie-(\d+)-background-size/ ) && property.value ){
      this._private.hasPie = true;
    }

    if( property.name.match( /stripe-(\d+)-background-size/ ) && property.value ){
      this._private.hasStripe = true;
    }

    if( property.mapped ){
      this[ i ].mappedProperties.push( property );
    }

    // add to core style if necessary
    let currentSelectorIsCore = !this[ i ].selector;
    if( currentSelectorIsCore ){
      this._private.coreStyle[ property.name ] = property;
    }
  }

  return this; // chaining
};

styfn.append = function( style ){
  if( is.stylesheet( style ) ){
    ( style as { appendToStyle( style: Style ): void } ).appendToStyle( this ); // structural view of a Stylesheet (is.stylesheet is not a type guard)
  } else if( is.array( style ) ){
    this.appendFromJson( style as StyleJsonBlock[] );
  } else if( is.string( style ) ){
    this.appendFromString( style );
  } // you probably wouldn't want to append a Style, since you'd duplicate the default parts

  return this;
};

// static function
Style.fromJson = function( cy, json ){
  let style = new Style( cy );

  style.fromJson( json );

  return style;
};

Style.fromString = function( cy, string ){
  return new Style( cy ).fromString( string );
};

[
  apply,
  bypass,
  container,
  getForEle,
  json,
  stringSheet,
  properties,
  parse
].forEach( function( props ){
  util.extend( styfn, props );
} );


Style.types = styfn.types;
Style.properties = styfn.properties;
Style.propertyGroups = styfn.propertyGroups;
Style.propertyGroupNames = styfn.propertyGroupNames;
Style.propertyGroupKeys = styfn.propertyGroupKeys;

export default Style;
