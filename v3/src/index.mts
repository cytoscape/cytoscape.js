/* eslint-disable prefer-spread, prefer-rest-params --
   the public factory dispatches on arguments and forwards via apply */
import * as is from './is.mjs';
import Core from './core/index.mjs';
import extension from './extension.mjs';
import Stylesheet from './stylesheet.mjs';
import version from './version.mjs';
import { warnings } from './util/index.mjs';

import type { Core as CoreInstance, CytoscapeOptions } from './core/core-types.mjs';
import type { Core as PublicCore } from './public-types.mjs';

// public type surface re-exported as named exports (consumers can do
// `import cytoscape, { Core } from 'cytoscape'`).  public-types.mts also
// retains the type names exposed by the v3 `cytoscape` namespace.
export type * from './public-types.mjs';

/** A plugin registrant, as passed to `cytoscape.use(ext)`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- standalone extensions define their own argument tuple
export type CytoscapeExtension<Args extends unknown[] = any[]> = ( cy: CytoscapeFactory, ...args: Args ) => void;

/** Legacy extension registrant name retained for v3 declaration compatibility. */
export type Ext = CytoscapeExtension;

/** The cytoscape factory: create an instance, or register an extension. */
export interface CytoscapeFactory {
  ( options?: CytoscapeOptions ): PublicCore;
  ( type: string, name: string, registrant?: unknown ): unknown;
  use<Args extends unknown[]>( ext: CytoscapeExtension<Args>, ...args: Args ): CytoscapeFactory;
  warnings( bool?: boolean ): boolean;
  version: string;
  stylesheet: typeof Stylesheet;
  Stylesheet: typeof Stylesheet;
}

function cytoscape( options?: CytoscapeOptions ): PublicCore;
function cytoscape( type: string, name: string, registrant?: unknown ): unknown;
function cytoscape( options?: CytoscapeOptions | string ): CoreInstance | unknown {
  // if no options specified, use default
  if( options === undefined ){
    options = {};
  }

  // create instance
  if( is.plainObject( options ) ){
    return new Core( options as CytoscapeOptions ) as unknown as PublicCore;
  }

  // allow for registration of extensions
  else if( is.string( options ) ){
    return ( extension as ( ...args: unknown[] ) => unknown ).apply( extension, arguments as unknown as unknown[] );
  }
}

// e.g. cytoscape.use( require('cytoscape-foo'), bar )
cytoscape.use = function<Args extends unknown[]>( this: CytoscapeFactory, ext: CytoscapeExtension<Args>, ...args: Args ){
  ext.apply( null, [ cytoscape as CytoscapeFactory, ...args ] as [ CytoscapeFactory, ...Args ] );

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
