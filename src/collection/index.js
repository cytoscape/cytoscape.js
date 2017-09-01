let util = require('../util');
let is = require('../is');
let Map = require('../map');
let Set = require('../set');

let Element = require('./element');

// factory for generating edge ids when no id is specified for a new element
let idFactory = {
  generate: function( cy, element, tryThisId ){
    let id = tryThisId != null ? tryThisId : util.uuid();

    while( cy.hasElementWithId( id ) ){
      id = util.uuid();
    }

    return id;
  }
};

// represents a set of nodes, edges, or both together
let Collection = function( cy, elements, options ){
  if( cy === undefined || !is.core( cy ) ){
    util.error( 'A collection must have a reference to the core' );
    return;
  }

  let map = new Map();
  let createdElements = false;

  if( !elements ){
    elements = [];
  } else if( elements.length > 0 && is.plainObject( elements[0] ) && !is.element( elements[0] ) ){
    createdElements = true;

    // make elements from json and restore all at once later
    let eles = [];
    let elesIds = new Set();

    for( let i = 0, l = elements.length; i < l; i++ ){
      let json = elements[ i ];

      if( json.data == null ){
        json.data = {};
      }

      let data = json.data;

      // make sure newly created elements have valid ids
      if( data.id == null ){
        data.id = idFactory.generate( cy, json );
      } else if( cy.hasElementWithId( data.id ) || elesIds.has( data.id ) ){
        continue; // can't create element if prior id already exists
      }

      let ele = new Element( cy, json, false );
      eles.push( ele );
      elesIds.add( data.id );
    }

    elements = eles;
  }

  this.length = 0;

  for( let i = 0, l = elements.length; i < l; i++ ){
    let element = elements[ i ];
    if( element == null ){  continue; }

    let id = element._private.data.id;

    if( options == null || ( options.unique && !map.has(id) ) ){
      map.set( id, {
        index: this.length,
        ele: element
      } );

      this[ this.length ] = element;
      this.length++;
    }
  }

  this._private = {
    cy: cy,
    map: map
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
let elesfn = Element.prototype = Collection.prototype;

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

elesfn.renderer = function(){
  return this._private.cy.renderer();
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
  return this._private.map.has( id );
};

elesfn.getElementById = function( id ){
  let cy = this._private.cy;
  let entry = this._private.map.get( id );

  return entry ? entry.ele : new Collection( cy ); // get ele or empty collection
};

elesfn.$id = elesfn.getElementById;

elesfn.poolIndex = function(){
  let cy = this._private.cy;
  let eles = cy._private.elements;
  let id = this._private.data.id;

  return eles._private.map.get( id ).index;
};

elesfn.json = function( obj ){
  let ele = this.element();
  let cy = this.cy();

  if( ele == null && obj ){ return this; } // can't set to no eles

  if( ele == null ){ return undefined; } // can't get from no eles

  let p = ele._private;

  if( is.plainObject( obj ) ){ // set

    cy.startBatch();

    if( obj.data ){
      ele.data( obj.data );
    }

    if( obj.position ){
      ele.position( obj.position );
    }

    // ignore group -- immutable

    let checkSwitch = function( k, trueFnName, falseFnName ){
      let obj_k = obj[ k ];

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

    let json = {
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

    json.classes = '';

    let i = 0;
    p.classes.forEach( cls => json.classes += ( i++ === 0 ? cls : ' ' + cls ) );

    return json;
  }
};

elesfn.jsons = function(){
  let jsons = [];

  for( let i = 0; i < this.length; i++ ){
    let ele = this[ i ];
    let json = ele.json();

    jsons.push( json );
  }

  return jsons;
};

elesfn.clone = function(){
  let cy = this.cy();
  let elesArr = [];

  for( let i = 0; i < this.length; i++ ){
    let ele = this[ i ];
    let json = ele.json();
    let clone = new Element( cy, json, false ); // NB no restore

    elesArr.push( clone );
  }

  return new Collection( cy, elesArr );
};
elesfn.copy = elesfn.clone;

elesfn.restore = function( notifyRenderer ){
  let self = this;
  let cy = self.cy();
  let cy_p = cy._private;

  if( notifyRenderer === undefined ){
    notifyRenderer = true;
  }

  // create arrays of nodes and edges, since we need to
  // restore the nodes first
  let nodes = [];
  let edges = [];
  let elements;
  for( let i = 0, l = self.length; i < l; i++ ){
    let ele = self[ i ];

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

  let i;
  let removeFromElements = function(){
    elements.splice( i, 1 );
    i--;
  };

  // now, restore each element
  for( i = 0; i < elements.length; i++ ){
    let ele = elements[ i ];

    let _private = ele._private;
    let data = _private.data;

    // the traversal cache should start fresh when ele is added
    ele.clearTraversalCache();

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

    let id = data.id; // id is finalised, now let's keep a ref

    if( ele.isNode() ){ // extra checks for nodes
      let pos = _private.position;

      // make sure the nodes have a defined position

      if( pos.x == null ){
        pos.x = 0;
      }

      if( pos.y == null ){
        pos.y = 0;
      }
    }

    if( ele.isEdge() ){ // extra checks for edges

      let edge = ele;
      let fields = [ 'source', 'target' ];
      let fieldsLength = fields.length;
      let badSourceOrTarget = false;
      for( let j = 0; j < fieldsLength; j++ ){

        let field = fields[ j ];
        let val = data[ field ];

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

      let src = cy.getElementById( data.source );
      let tgt = cy.getElementById( data.target );

      src._private.edges.push( edge );
      tgt._private.edges.push( edge );

      edge._private.source = src;
      edge._private.target = tgt;
    } // if is edge

    // create mock ids / indexes maps for element so it can be used like collections
    _private.map = new Map();
    _private.map.set( id, { ele: ele, index: 0 } );

    _private.removed = false;
    cy.addToPool( ele );
  } // for each element

  // do compound node sanity checks
  for( let i = 0; i < nodes.length; i++ ){ // each node
    let node = nodes[ i ];
    let data = node._private.data;

    if( is.number( data.parent ) ){ // then automake string
      data.parent = '' + data.parent;
    }

    let parentId = data.parent;

    let specifiedParent = parentId != null;

    if( specifiedParent ){
      let parent = cy.getElementById( parentId );

      if( parent.empty() ){
        // non-existant parent; just remove it
        data.parent = undefined;
      } else {
        let selfAsParent = false;
        let ancestor = parent;
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
    let restored = new Collection( cy, elements );

    for( let i = 0; i < restored.length; i++ ){
      let ele = restored[i];

      if( ele.isNode() ){ continue; }

      // adding an edge invalidates the traversal caches for the parallel edges
      ele.parallelEdges().clearTraversalCache();

      // adding an edge invalidates the traversal cache for the connected nodes
      ele.source().clearTraversalCache();
      ele.target().clearTraversalCache();
    }

    let toUpdateStyle;

    if( cy_p.hasCompoundNodes ){
      toUpdateStyle = cy.collection().merge( restored ).merge( restored.connectedNodes() ).merge( restored.parent() );
    } else {
      toUpdateStyle = restored;
    }

    toUpdateStyle.dirtyCompoundBoundsCache().updateStyle( notifyRenderer );

    if( notifyRenderer ){
      restored.emitAndNotify( 'add' );
    } else {
      restored.emit( 'add' );
    }
  }

  return self; // chainability
};

elesfn.removed = function(){
  let ele = this[0];
  return ele && ele._private.removed;
};

elesfn.inside = function(){
  let ele = this[0];
  return ele && !ele._private.removed;
};

elesfn.remove = function( notifyRenderer ){
  let self = this;
  let removed = [];
  let elesToRemove = [];
  let elesToRemoveIds = {};
  let cy = self._private.cy;

  if( notifyRenderer === undefined ){
    notifyRenderer = true;
  }

  // add connected edges
  function addConnectedEdges( node ){
    let edges = node._private.edges;
    for( let i = 0; i < edges.length; i++ ){
      add( edges[ i ] );
    }
  }


  // add descendant nodes
  function addChildren( node ){
    let children = node._private.children;

    for( let i = 0; i < children.length; i++ ){
      add( children[ i ] );
    }
  }

  function add( ele ){
    let alreadyAdded =  elesToRemoveIds[ ele.id() ];
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

  for( let i = 0, l = self.length; i < l; i++ ){
    let ele = self[ i ];

    add( ele );
  }

  function removeEdgeRef( node, edge ){
    let connectedEdges = node._private.edges;

    util.removeFromArray( connectedEdges, edge );

    // removing an edges invalidates the traversal cache for its nodes
    node.clearTraversalCache();
  }

  function removeParallelRefs( edge ){
    // removing an edge invalidates the traversal caches for the parallel edges
    edge.parallelEdges().clearTraversalCache();
  }

  let alteredParents = [];
  alteredParents.ids = {};

  function removeChildRef( parent, ele ){
    ele = ele[0];
    parent = parent[0];

    let children = parent._private.children;
    let pid = parent.id();

    util.removeFromArray( children, ele );

    if( !alteredParents.ids[ pid ] ){
      alteredParents.ids[ pid ] = true;
      alteredParents.push( parent );
    }
  }

  self.dirtyCompoundBoundsCache();

  cy.removeFromPool( elesToRemove ); // remove from core pool

  for( let i = 0; i < elesToRemove.length; i++ ){
    let ele = elesToRemove[ i ];

    // mark as removed
    ele._private.removed = true;

    // add to list of removed elements
    removed.push( ele );

    if( ele.isEdge() ){ // remove references to this edge in its connected nodes
      let src = ele.source()[0];
      let tgt = ele.target()[0];

      removeEdgeRef( src, ele );
      removeEdgeRef( tgt, ele );
      removeParallelRefs( ele );

    } else { // remove reference to parent
      let parent = ele.parent();

      if( parent.length !== 0 ){
        removeChildRef( parent, ele );
      }
    }
  }

  // check to see if we have a compound graph or not
  let elesStillInside = cy._private.elements;
  cy._private.hasCompoundNodes = false;
  for( let i = 0; i < elesStillInside.length; i++ ){
    let ele = elesStillInside[ i ];

    if( ele.isParent() ){
      cy._private.hasCompoundNodes = true;
      break;
    }
  }

  let removedElements = new Collection( this.cy(), removed );
  if( removedElements.size() > 0 ){
    // must manually notify since trigger won't do this automatically once removed

    if( notifyRenderer ){
      this.cy().notify( {
        type: 'remove',
        eles: removedElements
      } );
    }

    removedElements.emit( 'remove' );
  }

  // the parents who were modified by the removal need their style updated
  for( let i = 0; i < alteredParents.length; i++ ){
    let ele = alteredParents[ i ];

    if( !ele.removed() ){
      ele.updateStyle();
    }
  }

  return new Collection( cy, removed );
};

elesfn.move = function( struct ){
  let cy = this._private.cy;

  if( struct.source !== undefined || struct.target !== undefined ){
    let srcId = struct.source;
    let tgtId = struct.target;
    let srcExists = cy.hasElementWithId( srcId );
    let tgtExists = cy.hasElementWithId( tgtId );

    if( srcExists || tgtExists ){
      let jsons = this.jsons();

      this.remove();

      for( let i = 0; i < jsons.length; i++ ){
        let json = jsons[i];
        let ele = this[i];

        if( json.group === 'edges' ){
          if( srcExists ){ json.data.source = srcId; }

          if( tgtExists ){ json.data.target = tgtId; }

          json.scratch = ele._private.scratch;
        }
      }

      return cy.add( jsons );
    }

  } else if( struct.parent !== undefined ){ // move node to new parent
    let parentId = struct.parent;
    let parentExists = parentId === null || cy.hasElementWithId( parentId );

    if( parentExists ){
      let jsons = this.jsons();
      let descs = this.descendants();
      let descsEtcJsons = descs.union( descs.union( this ).connectedEdges() ).jsons();

      this.remove(); // NB: also removes descendants and their connected edges

      for( let i = 0; i < jsons.length; i++ ){
        let json = jsons[i];
        let ele = this[i];

        if( json.group === 'nodes' ){
          json.data.parent = parentId === null ? undefined : parentId;

          json.scratch = ele._private.scratch;
        }
      }

      return cy.add( jsons.concat( descsEtcJsons ) );
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
