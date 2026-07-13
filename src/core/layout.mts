import * as util from '../util/index.mjs';
import * as is from '../is.mjs';
import type { Core, LayoutInstance } from './core-types.mjs';
import type { Collection, EdgeSingular, NodeSingular } from '../collection/eles-types.mjs';

/** Options accepted by `layout()`/`makeLayout()`/`createLayout()`. */
export interface LayoutOptions {
  name: string;
  eles?: Collection | string;
  position?: ( node: NodeSingular ) => { row?: number; col?: number } | undefined;
  sort?: ( a: NodeSingular, b: NodeSingular ) => number;
  nodeRepulsion?: number | ( ( node: NodeSingular ) => number );
  idealEdgeLength?: number | ( ( edge: EdgeSingular ) => number );
  edgeElasticity?: number | ( ( edge: EdgeSingular ) => number );
  [key: string]: unknown;
}

/** A registered layout extension constructor. */
type LayoutConstructor = new ( options: Record<string, unknown> ) => LayoutInstance;

let corefn = ({

  layout: function( this: Core, options?: LayoutOptions ){
    let cy = this; // eslint-disable-line @typescript-eslint/no-this-alias

    if( options == null ){
      util.error( 'Layout options must be specified to make a layout' );
      return;
    }

    if( options.name == null ){
      util.error( 'A `name` must be specified to make a layout' );
      return;
    }

    let name = options.name;
    let Layout = cy.extension( 'layout', name ) as LayoutConstructor | null | undefined;

    if( Layout == null ){
      util.error( 'No such layout `' + name + '` found.  Did you forget to import it and `cytoscape.use()` it?' );
      return;
    }

    let eles;
    if( is.string( options.eles ) ){
      eles = cy.$( options.eles );
    } else {
      eles = options.eles != null ? options.eles : cy.$();
    }

    let layout = new Layout( util.extend( {}, options, {
      cy: cy,
      eles: eles
    } ) );

    return layout;
  }

}) as CoreLayout;

corefn.createLayout = corefn.makeLayout = corefn.layout;

/** Layout construction methods contributed to the core prototype. */
export interface CoreLayout {
  layout( this: Core, options: LayoutOptions ): LayoutInstance;
  makeLayout( this: Core, options: LayoutOptions ): LayoutInstance;
  createLayout( this: Core, options: LayoutOptions ): LayoutInstance;
}

export default corefn as CoreLayout;
