/* eslint-disable prefer-spread, prefer-rest-params --
   the public factory dispatches on arguments and forwards via apply */
import * as is from './is.mjs';
import Core from './core/index.mjs';
import extension from './extension.mjs';
import Stylesheet from './stylesheet.mjs';
import version from './version.mjs';
import { warnings } from './util/index.mjs';

import type { Core as CoreInstance, CytoscapeOptions } from './core/core-types.mjs';

// public type surface re-exported as named exports (consumers can do
// `import cytoscape, { Core } from 'cytoscape'`)
export type {
  Core,
  CytoscapeOptions,
  LayoutInstance,
  RendererInstance
} from './core/core-types.mjs';
export type {
  Collection,
  EdgeCollection,
  EdgeSingular,
  Element,
  ElementDefinition,
  ElementJson,
  NodeCollection,
  NodeSingular,
  Singular
} from './collection/eles-types.mjs';
export type { Position, BoundingBox } from './types.mjs';
export type { Css } from './style/css-types.mjs';
export type { StyleJsonBlock, StyleJson } from './style/json.mjs';
export type {
  EventObject,
  EventObjectNode,
  EventObjectEdge,
  EventObjectCore,
  EventHandler,
  AbstractEventObject,
  InputEventObject,
  LayoutEventObject
} from './event-types.mjs';

/** A plugin registrant, as passed to `cytoscape.use(ext)`. */
export type CytoscapeExtension = ( cy: CytoscapeFactory, ...args: unknown[] ) => void;

/** The cytoscape factory: create an instance, or register an extension. */
export interface CytoscapeFactory {
  ( options?: CytoscapeOptions ): CoreInstance;
  ( type: string, name: string, registrant?: unknown ): unknown;
  use( ext: CytoscapeExtension, ...args: unknown[] ): CytoscapeFactory;
  warnings( bool?: boolean ): boolean;
  version: string;
  stylesheet: typeof Stylesheet;
  Stylesheet: typeof Stylesheet;
}

let cytoscape = function( options?: CytoscapeOptions | string ){
  // if no options specified, use default
  if( options === undefined ){
    options = {};
  }

  // create instance
  if( is.plainObject( options ) ){
    return new Core( options as CytoscapeOptions );
  }

  // allow for registration of extensions
  else if( is.string( options ) ){
    return ( extension as ( ...args: unknown[] ) => unknown ).apply( extension, arguments as unknown as unknown[] );
  }
} as CytoscapeFactory;

// e.g. cytoscape.use( require('cytoscape-foo'), bar )
cytoscape.use = function( this: CytoscapeFactory, ext: CytoscapeExtension ){
  let args = Array.prototype.slice.call( arguments, 1 ); // args to pass to ext

  args.unshift( cytoscape ); // cytoscape is first arg to ext

  ext.apply( null, args as [ CytoscapeFactory, ...unknown[] ] );

  return this;
};

cytoscape.warnings = function( bool?: boolean ){
  return warnings( bool ) as boolean;
};

// replaced by build system
cytoscape.version = version;

// expose public apis (mostly for extensions)
cytoscape.stylesheet = cytoscape.Stylesheet = Stylesheet;

export default cytoscape;
