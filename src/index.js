import is from './is';
import Core from './core';
import extension from './extension';
import Stylesheet from './stylesheet';
import version from './version';

let cytoscape = function( options ){
  // if no options specified, use default
  if( options === undefined ){
    options = {};
  }

  // create instance
  if( is.plainObject( options ) ){
    return new Core( options );
  }

  // allow for registration of extensions
  else if( is.string( options ) ){
    return extension.apply( extension, arguments );
  }
};

// e.g. cytoscape.use( require('cytoscape-foo'), bar )
cytoscape.use = function( ext ){
  let args = Array.prototype.slice.call( arguments, 1 ); // args to pass to ext

  args.unshift( cytoscape ); // cytoscape is first arg to ext

  ext.apply( null, args );

  return this;
};

// replaced by build system
cytoscape.version = version;

// expose public apis (mostly for extensions)
cytoscape.stylesheet = cytoscape.Stylesheet = Stylesheet;

export default cytoscape;
