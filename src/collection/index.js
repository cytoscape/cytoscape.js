'use strict';

var util = require( '../util' );
var is = require( '../is' );

var Element = require( './element' );

// factory for generating edge ids when no id is specified for a new element
var idFactory = {
  generate: function( cy, element, tryThisId ){
    var id = tryThisId != null ? tryThisId : util.uuid();

    while( cy.hasElementWithId( id ) ){
      id = util.uuid();
    }

    return id;
  }
};

// represents a set of nodes, edges, or both together
var Collection = function( cy, elements, options ){
  if( cy === undefined || !is.core( cy ) ){
    util.error( 'A collection must have a reference to the core' );
    return;
  }

  var ids = {};
  var indexes = {};
  var createdElements = false;

  if( !elements ){
    elements = [];
  } else if( elements.length > 0 && is.plainObject( elements[0] ) && !is.element( elements[0] ) ){
    createdElements = true;

    // make elements from json and restore all at once later
    var eles = [];
    var elesIds = {};

    for( var i = 0, l = elements.length; i < l; i++ ){
      var json = elements[ i ];

      if( json.data == null ){
        json.data = {};
      }

      var data = json.data;

      // make sure newly created elements have valid ids
      if( data.id == null ){
        data.id = idFactory.generate( cy, json );
      } else if( cy.hasElementWithId( data.id ) || elesIds[ data.id ] ){
        continue; // can't create element if prior id already exists
      }

      var ele = new Element( cy, json, false );
      eles.push( ele );
      elesIds[ data.id ] = true;
    }

    elements = eles;
  }

  this.length = 0;

  for( var i = 0, l = elements.length; i < l; i++ ){
    var element = elements[ i ];
    if( !element ){  continue; }

    var id = element._private.data.id;

    if( !options || (options.unique && !ids[ id ] ) ){
      ids[ id ] = element;
      indexes[ id ] = this.length;

      this[ this.length ] = element;
      this.length++;
    }
  }

  this._private = {
    cy: cy,
    ids: ids,
    indexes: indexes
  };

  // restore the elements if we created them from json
  if( createdElements ){
    this.restore();
  }
};

// Functions
////////////////////////////////////////////////////////////////////////////////////////////////////

// keep the prototypes in sync (an element has the same functions as a collection)
// and use elefn and elesfn as shorthands to the prototypes
var elesfn = Element.prototype = Collection.prototype;

elesfn.instanceString = function(){
  return 'collection';
};

elesfn.spawn = function( cy, eles, opts ){
  if( !is.core( cy ) ){ // cy is optional
    opts = eles;
    eles = cy;
    cy = this.cy();
  }

  return new Collection( cy, eles, opts );
};

elesfn.spawnSelf = function(){
  return this.spawn( this );
};

elesfn.cy = function(){
  return this._private.cy;
};

elesfn.element = function(){
  return this[0];
};

elesfn.collection = function(){
  if( is.collection( this ) ){
    return this;
  } else { // an element
    return new Collection( this._private.cy, [ this ] );
  }
};

elesfn.unique = function(){
  return new Collection( this._private.cy, this, { unique: true } );
};

elesfn.hasElementWithId = function( id ){
  return !!this._private.ids[ id ];
};

elesfn.getElementById = function( id ){
  var cy = this._private.cy;
  var ele = this._private.ids[ id ];

  return ele ? ele : new Collection( cy ); // get ele or empty collection
};

elesfn.poolIndex = function(){
  var cy = this._private.cy;
  var eles = cy._private.elements;
  var id = this._private.data.id;

  return eles._private.indexes[ id ];
};

elesfn.json = function( obj ){
  var ele = this.element();
  var cy = this.cy();

  if( ele == null && obj ){ return this; } // can't set to no eles

  if( ele == null ){ return undefined; } // can't get from no eles

  var p = ele._private;

  if( is.plainObject( obj ) ){ // set

    cy.startBatch();

    if( obj.data ){
      ele.data( obj.data );
    }

    if( obj.position ){
      ele.position( obj.position );
    }

    // ignore group -- immutable

    var checkSwitch = function( k, trueFnName, falseFnName ){
      var obj_k = obj[ k ];

      if( obj_k != null && obj_k !== p[ k ] ){
        if( obj_k ){
          ele[ trueFnName ]();
        } else {
          ele[ falseFnName ]();
        }
      }
    };

    checkSwitch( 'removed', 'remove', 'restore' );

    checkSwitch( 'selected', 'select', 'unselect' );

    checkSwitch( 'selectable', 'selectify', 'unselectify' );

    checkSwitch( 'locked', 'lock', 'unlock' );

    checkSwitch( 'grabbable', 'grabify', 'ungrabify' );

    if( obj.classes != null ){
      ele.classes( obj.classes );
    }

    cy.endBatch();

    return this;

  } else if( obj === undefined ){ // get

    var json = {
      data: util.copy( p.data ),
      position: util.copy( p.position ),
      group: p.group,
      removed: p.removed,
      selected: p.selected,
      selectable: p.selectable,
      locked: p.locked,
      grabbable: p.grabbable,
      classes: null
    };

    json.classes = Object.keys( p.classes ).filter(function( cls ){
      return p.classes[cls];
    }).join(' ');

    return json;
  }
};

elesfn.jsons = function(){
  var jsons = [];

  for( var i = 0; i < this.length; i++ ){
    var ele = this[ i ];
    var json = ele.json();

    jsons.push( json );
  }

  return jsons;
};

elesfn.clone = function(){
  var cy = this.cy();
  var elesArr = [];

  for( var i = 0; i < this.length; i++ ){
    var ele = this[ i ];
    var json = ele.json();
    var clone = new Element( cy, json, false ); // NB no restore

    elesArr.push( clone );
  }

  return new Collection( cy, elesArr );
};
elesfn.copy = elesfn.clone;

elesfn.restore = function( notifyRenderer ){
  var self = this;
  var cy = self.cy();
  var cy_p = cy._private;

  if( notifyRenderer === undefined ){
    notifyRenderer = true;
  }

  // create arrays of nodes and edges, since we need to
  // restore the nodes first
  var nodes = [];
  var edges = [];
  var elements;
  for( var i = 0, l = self.length; i < l; i++ ){
    var ele = self[ i ];

    if( !ele.removed() ){
      // don't need to handle this ele
      continue;
    }

    // keep nodes first in the array and edges after
    if( ele.isNode() ){ // put to front of array if node
      nodes.push( ele );
    } else { // put to end of array if edge
      edges.push( ele );
    }
  }

  elements = nodes.concat( edges );

  var i;
  var removeFromElements = function(){
    elements.splice( i, 1 );
    i--;
  };

  // now, restore each element
  for( i = 0; i < elements.length; i++ ){
    var ele = elements[ i ];

    var _private = ele._private;
    var data = _private.data;

    // the traversal cache should start fresh when ele is added
    _private.traversalCache = null;

    // set id and validate
    if( data.id === undefined ){
      data.id = idFactory.generate( cy, ele );

    } else if( is.number( data.id ) ){
      data.id = '' + data.id; // now it's a string

    } else if( is.emptyString( data.id ) || !is.string( data.id ) ){
      util.error( 'Can not create element with invalid string ID `' + data.id + '`' );

      // can't create element if it has empty string as id or non-string id
      removeFromElements();
      continue;
    } else if( cy.hasElementWithId( data.id ) ){
      util.error( 'Can not create second element with ID `' + data.id + '`' );

      // can't create element if one already has that id
      removeFromElements();
      continue;
    }

    var id = data.id; // id is finalised, now let's keep a ref

    if( ele.isNode() ){ // extra checks for nodes
      var node = ele;
      var pos = _private.position;

      // make sure the nodes have a defined position

      if( pos.x == null ){
        pos.x = 0;
      }

      if( pos.y == null ){
        pos.y = 0;
      }
    }

    if( ele.isEdge() ){ // extra checks for edges

      var edge = ele;
      var fields = [ 'source', 'target' ];
      var fieldsLength = fields.length;
      var badSourceOrTarget = false;
      for( var j = 0; j < fieldsLength; j++ ){

        var field = fields[ j ];
        var val = data[ field ];

        if( is.number( val ) ){
          val = data[ field ] = '' + data[ field ]; // now string
        }

        if( val == null || val === '' ){
          // can't create if source or target is not defined properly
          util.error( 'Can not create edge `' + id + '` with unspecified ' + field );
          badSourceOrTarget = true;
        } else if( !cy.hasElementWithId( val ) ){
          // can't create edge if one of its nodes doesn't exist
          util.error( 'Can not create edge `' + id + '` with nonexistant ' + field + ' `' + val + '`' );
          badSourceOrTarget = true;
        }
      }

      if( badSourceOrTarget ){ removeFromElements(); continue; } // can't create this

      var src = cy.getElementById( data.source );
      var tgt = cy.getElementById( data.target );

      src._private.edges.push( edge );
      tgt._private.edges.push( edge );

      edge._private.source = src;
      edge._private.target = tgt;
    } // if is edge

    // create mock ids / indexes maps for element so it can be used like collections
    _private.ids = {};
    _private.ids[ id ] = ele;
    _private.indexes = {};
    _private.indexes[ id ] = ele;

    _private.removed = false;
    cy.addToPool( ele );
  } // for each element

  // do compound node sanity checks
  for( var i = 0; i < nodes.length; i++ ){ // each node
    var node = nodes[ i ];
    var data = node._private.data;

    if( is.number( data.parent ) ){ // then automake string
      data.parent = '' + data.parent;
    }

    var parentId = data.parent;

    var specifiedParent = parentId != null;

    if( specifiedParent ){
      var parent = cy.getElementById( parentId );

      if( parent.empty() ){
        // non-existant parent; just remove it
        data.parent = undefined;
      } else {
        var selfAsParent = false;
        var ancestor = parent;
        while( !ancestor.empty() ){
          if( node.same( ancestor ) ){
            // mark self as parent and remove from data
            selfAsParent = true;
            data.parent = undefined; // remove parent reference

            // exit or we loop forever
            break;
          }

          ancestor = ancestor.parent();
        }

        if( !selfAsParent ){
          // connect with children
          parent[0]._private.children.push( node );
          node._private.parent = parent[0];

          // let the core know we have a compound graph
          cy_p.hasCompoundNodes = true;
        }
      } // else
    } // if specified parent
  } // for each node

  if( elements.length > 0 ){
    var restored = new Collection( cy, elements );

    for( var i = 0; i < restored.length; i++ ){
      var ele = restored[i];

      if( ele.isNode() ){ continue; }

      // adding an edge invalidates the traversal caches for the parallel edges
      var pedges = ele.parallelEdges();
      for( var j = 0; j < pedges.length; j++ ){
        pedges[j]._private.traversalCache = null;
      }

      // adding an edge invalidates the traversal cache for the connected nodes
      ele.source()[0]._private.traversalCache = null;
      ele.target()[0]._private.traversalCache = null;
    }

    var toUpdateStyle;

    if( cy_p.hasCompoundNodes ){
      toUpdateStyle = restored.add( restored.connectedNodes() ).add( restored.parent() );
    } else {
      toUpdateStyle = restored;
    }

    toUpdateStyle.updateStyle( notifyRenderer );

    if( notifyRenderer ){
      restored.rtrigger( 'add' );
    } else {
      restored.trigger( 'add' );
    }
  }

  return self; // chainability
};

elesfn.removed = function(){
  var ele = this[0];
  return ele && ele._private.removed;
};

elesfn.inside = function(){
  var ele = this[0];
  return ele && !ele._private.removed;
};

elesfn.remove = function( notifyRenderer ){
  var self = this;
  var removed = [];
  var elesToRemove = [];
  var elesToRemoveIds = {};
  var cy = self._private.cy;

  if( notifyRenderer === undefined ){
    notifyRenderer = true;
  }

  // add connected edges
  function addConnectedEdges( node ){
    var edges = node._private.edges;
    for( var i = 0; i < edges.length; i++ ){
      add( edges[ i ] );
    }
  }


  // add descendant nodes
  function addChildren( node ){
    var children = node._private.children;

    for( var i = 0; i < children.length; i++ ){
      add( children[ i ] );
    }
  }

  function add( ele ){
    var alreadyAdded =  elesToRemoveIds[ ele.id() ];
    if( alreadyAdded ){
      return;
    } else {
      elesToRemoveIds[ ele.id() ] = true;
    }

    if( ele.isNode() ){
      elesToRemove.push( ele ); // nodes are removed last

      addConnectedEdges( ele );
      addChildren( ele );
    } else {
      elesToRemove.unshift( ele ); // edges are removed first
    }
  }

  // make the list of elements to remove
  // (may be removing more than specified due to connected edges etc)

  for( var i = 0, l = self.length; i < l; i++ ){
    var ele = self[ i ];

    add( ele );
  }

  function removeEdgeRef( node, edge ){
    var connectedEdges = node._private.edges;

    util.removeFromArray( connectedEdges, edge );

    // removing an edges invalidates the traversal cache for its nodes
    node._private.traversalCache = null;
  }

  function removeParallelRefs( edge ){
    // removing an edge invalidates the traversal caches for the parallel edges
    var pedges = edge.parallelEdges();
    for( var j = 0; j < pedges.length; j++ ){
      pedges[j]._private.traversalCache = null;
    }
  }

  var alteredParents = [];
  alteredParents.ids = {};

  function removeChildRef( parent, ele ){
    ele = ele[0];
    parent = parent[0];

    var children = parent._private.children;
    var pid = parent.id();

    util.removeFromArray( children, ele );

    if( !alteredParents.ids[ pid ] ){
      alteredParents.ids[ pid ] = true;
      alteredParents.push( parent );
    }
  }

  // remove from core pool
  cy.removeFromPool( elesToRemove );

  for( var i = 0; i < elesToRemove.length; i++ ){
    var ele = elesToRemove[ i ];

    // mark as removed
    ele._private.removed = true;

    // add to list of removed elements
    removed.push( ele );

    if( ele.isEdge() ){ // remove references to this edge in its connected nodes
      var src = ele.source()[0];
      var tgt = ele.target()[0];

      removeEdgeRef( src, ele );
      removeEdgeRef( tgt, ele );
      removeParallelRefs( ele );

    } else { // remove reference to parent
      var parent = ele.parent();

      if( parent.length !== 0 ){
        removeChildRef( parent, ele );
      }
    }
  }

  // check to see if we have a compound graph or not
  var elesStillInside = cy._private.elements;
  cy._private.hasCompoundNodes = false;
  for( var i = 0; i < elesStillInside.length; i++ ){
    var ele = elesStillInside[ i ];

    if( ele.isParent() ){
      cy._private.hasCompoundNodes = true;
      break;
    }
  }

  var removedElements = new Collection( this.cy(), removed );
  if( removedElements.size() > 0 ){
    // must manually notify since trigger won't do this automatically once removed

    if( notifyRenderer ){
      this.cy().notify( {
        type: 'remove',
        eles: removedElements
      } );
    }

    removedElements.trigger( 'remove' );
  }

  // the parents who were modified by the removal need their style updated
  for( var i = 0; i < alteredParents.length; i++ ){
    var ele = alteredParents[ i ];

    if( !ele.removed() ){
      ele.updateStyle();
    }
  }

  return new Collection( cy, removed );
};

elesfn.move = function( struct ){
  var cy = this._private.cy;

  if( struct.source !== undefined || struct.target !== undefined ){
    var srcId = struct.source;
    var tgtId = struct.target;
    var srcExists = cy.hasElementWithId( srcId );
    var tgtExists = cy.hasElementWithId( tgtId );

    if( srcExists || tgtExists ){
      var jsons = this.jsons();

      this.remove();

      for( var i = 0; i < jsons.length; i++ ){
        var json = jsons[i];
        var ele = this[i];

        if( json.group === 'edges' ){
          if( srcExists ){ json.data.source = srcId; }

          if( tgtExists ){ json.data.target = tgtId; }

          json.scratch = ele._private.scratch;
        }
      }

      return cy.add( jsons );
    }

  } else if( struct.parent !== undefined ){ // move node to new parent
    var parentId = struct.parent;
    var parentExists = parentId === null || cy.hasElementWithId( parentId );

    if( parentExists ){
      var jsons = this.jsons();
      var descs = this.descendants();
      var descsEtc = descs.union( descs.union( this ).connectedEdges() );

      this.remove(); // NB: also removes descendants and their connected edges

      for( var i = 0; i < this.length; i++ ){
        var json = jsons[i];
        var ele = this[i];

        if( json.group === 'nodes' ){
          json.data.parent = parentId === null ? undefined : parentId;

          json.scratch = ele._private.scratch;
        }
      }

      return cy.add( jsons ).union( descsEtc.restore() );
    }
  }

  return this; // if nothing done
};

[
  require( './algorithms' ),
  require( './animation' ),
  require( './class' ),
  require( './comparators' ),
  require( './compounds' ),
  require( './data' ),
  require( './degree' ),
  require( './dimensions' ),
  require( './events' ),
  require( './filter' ),
  require( './group' ),
  require( './index' ),
  require( './iteration' ),
  require( './layout' ),
  require( './style' ),
  require( './switch-functions' ),
  require( './traversing' )
].forEach( function( props ){
  util.extend( elesfn, props );
} );

module.exports = Collection;
