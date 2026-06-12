import * as util from '../../util/index.mjs';
import type { LayoutBase, LayoutOptionsBase } from './layout-base.mjs';

/** Options accepted by the null layout. */
export interface NullLayoutOptions extends LayoutOptionsBase {
  ready?: () => void;
  stop?: () => void;
}

/** The null layout instance (`this`). */
export interface NullLayout extends LayoutBase {
  options: NullLayoutOptions;
}

// default layout options
let defaults = {
  ready: function(){}, // on layoutready
  stop: function(){} // on layoutstop
};

// constructor
// options : object containing layout options
// eslint-disable-next-line @typescript-eslint/no-redeclare -- intentional declaration merging with the interface above
function NullLayout( this: NullLayout, options: NullLayoutOptions ){
  this.options = util.extend( {}, defaults, options ) as NullLayoutOptions;
}

// runs the layout
NullLayout.prototype.run = function( this: NullLayout ){
  let options = this.options;
  let eles = options.eles; // elements to consider in the layout
  let layout = this; // eslint-disable-line @typescript-eslint/no-this-alias

  // cy is automatically populated for us in the constructor
  // (disable eslint for next line as this serves as example layout code to external developers)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let cy = options.cy;

  layout.emit( 'layoutstart' );

  // puts all nodes at (0, 0)
  // n.b. most layouts would use layoutPositions(), instead of positions() and manual events
  eles.nodes().positions( function(){
    return {
      x: 0,
      y: 0
    };
  } );

  // trigger layoutready when each node has had its position set at least once
  layout.one( 'layoutready', options.ready! ); // defaults guarantee a handler
  layout.emit( 'layoutready' );

  // trigger layoutstop when the layout stops (e.g. finishes)
  layout.one( 'layoutstop', options.stop! ); // defaults guarantee a handler
  layout.emit( 'layoutstop' );

  return this; // chaining
};

// called on continuous layouts to stop them before they finish
NullLayout.prototype.stop = function( this: NullLayout ){
  return this; // chaining
};

export default NullLayout;
