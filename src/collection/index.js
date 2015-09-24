'use strict';

var util = require('../util');
var is = require('../is');

var Element = require('./element');

// factory for generating edge ids when no id is specified for a new element
var idFactory = {
  prefix: {
    nodes: 'n',
    edges: 'e'
  },
  id: {
    nodes: 0,
    edges: 0
  },
  generate: function(cy, element, tryThisId){
    var json = is.element( element ) ? element._private : element;
    var group = json.group;
    var id = tryThisId != null ? tryThisId : this.prefix[group] + this.id[group];

    if( cy.getElementById(id).empty() ){
      this.id[group]++; // we've used the current id, so move it up
    } else { // otherwise keep trying successive unused ids
      while( !cy.getElementById(id).empty() ){
        id = this.prefix[group] + ( ++this.id[group] );
      }
    }

    return id;
  }
};

// represents a set of nodes, edges, or both together
var Collection = function(cy, elements, options){
  if( !(this instanceof Collection) ){
    return new Collection(cy, elements, options);
  }

  if( cy === undefined || !is.core(cy) ){
    util.error('A collection must have a reference to the core');
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
      var json = elements[i];

      if( json.data == null ){
        json.data = {};
      }

      var data = json.data;

      // make sure newly created elements have valid ids
      if( data.id == null ){
        data.id = idFactory.generate( cy, json );
      } else if( cy.getElementById( data.id ).length !== 0 || elesIds[ data.id ] ){
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
    var element = elements[i];
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
  if( !is.core(cy) ){ // cy is optional
    opts = eles;
    eles = cy;
    cy = this.cy();
  }

  return new Collection( cy, eles, opts );
};

elesfn.cy = function(){
  return this._private.cy;
};

elesfn.element = function(){
  return this[0];
};

elesfn.collection = function(){
  if( is.collection(this) ){
    return this;
  } else { // an element
    return new Collection( this._private.cy, [this] );
  }
};

elesfn.unique = function(){
  return new Collection( this._private.cy, this, { unique: true } );
};

elesfn.getElementById = function( id ){
  var cy = this._private.cy;
  var ele = this._private.ids[ id ];

  return ele ? ele : new Collection(cy); // get ele or empty collection
};

elesfn.json = function( obj ){
  var ele = this.element();
  var cy = this.cy();

  if( ele == null && obj ){ return this; } // can't set to no eles

  if( ele == null ){ return undefined; } // can't get from no eles

  var p = ele._private;

  if( is.plainObject(obj) ){ // set

    cy.startBatch();

    if( obj.data ){
      ele.data( obj.data );
    }

    if( obj.position ){
      ele.position( obj.position );
    }

    // ignore group -- immutable

    var checkSwitch = function( k, trueFnName, falseFnName ){
      var obj_k = obj[k];

      if( obj_k != null && obj_k !== p[k] ){
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

    var classes = [];
    for( var cls in p.classes ){
      if( p.classes[cls] ){
        classes.push(cls);
      }
    }
    json.classes = classes.join(' ');

    return json;
  }
};

elesfn.jsons = function(){
  var jsons = [];

  for( var i = 0; i < this.length; i++ ){
    var ele = this[i];
    var json = ele.json();

    jsons.push( json );
  }

  return jsons;
};

elesfn.clone = function(){
  var cy = this.cy();
  var elesArr = [];

  for( var i = 0; i < this.length; i++ ){
    var ele = this[i];
    var json = ele.json();
    var clone = new Element(cy, json, false); // NB no restore

    elesArr.push( clone );
  }

  return new Collection( cy, elesArr );
};
elesfn.copy = elesfn.clone;

elesfn.restore = function( notifyRenderer ){
  var self = this;
  var restored = [];
  var cy = self.cy();

  if( notifyRenderer === undefined ){
    notifyRenderer = true;
  }

  // create arrays of nodes and edges, since we need to
  // restore the nodes first
  var elements = [];
  var nodes = [], edges = [];
  var numNodes = 0;
  var numEdges = 0;
  for( var i = 0, l = self.length; i < l; i++ ){
    var ele = self[i];

    // keep nodes first in the array and edges after
    if( ele.isNode() ){ // put to front of array if node
      nodes.push( ele );
      numNodes++;
    } else { // put to end of array if edge
      edges.push( ele );
      numEdges++;
    }
  }

  elements = nodes.concat( edges );

  // now, restore each element
  for( var i = 0, l = elements.length; i < l; i++ ){
    var ele = elements[i];

    if( !ele.removed() ){
      // don't need to do anything
      continue;
    }

    var _private = ele._private;
    var data = _private.data;

    // set id and validate
    if( data.id === undefined ){
      data.id = idFactory.generate( cy, ele );

    } else if( is.number(data.id) ){
      data.id = '' + data.id; // now it's a string

    } else if( is.emptyString(data.id) || !is.string(data.id) ){
      util.error('Can not create element with invalid string ID `' + data.id + '`');

      // can't create element if it has empty string as id or non-string id
      continue;
    } else if( cy.getElementById( data.id ).length !== 0 ){
      util.error('Can not create second element with ID `' + data.id + '`');

      // can't create element if one already has that id
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
      var fields = ['source', 'target'];
      var fieldsLength = fields.length;
      var badSourceOrTarget = false;
      for(var j = 0; j < fieldsLength; j++){

        var field = fields[j];
        var val = data[field];

        if( is.number(val) ){
          val = data[field] = '' + data[field]; // now string
        }

        if( val == null || val === '' ){
          // can't create if source or target is not defined properly
          util.error('Can not create edge `' + id + '` with unspecified ' + field);
          badSourceOrTarget = true;
        } else if( cy.getElementById(val).empty() ){
          // can't create edge if one of its nodes doesn't exist
          util.error('Can not create edge `' + id + '` with nonexistant ' + field + ' `' + val + '`');
          badSourceOrTarget = true;
        }
      }

      if( badSourceOrTarget ){ continue; } // can't create this

      var src = cy.getElementById( data.source );
      var tgt = cy.getElementById( data.target );

      src._private.edges.push( edge );
      tgt._private.edges.push( edge );

      edge._private.source = src;
      edge._private.target = tgt;

    } // if is edge

    // create mock ids map for element so it can be used like collections
    _private.ids = {};
    _private.ids[ id ] = ele;

    _private.removed = false;
    cy.addToPool( ele );

    restored.push( ele );
  } // for each element

  // do compound node sanity checks
  for( var i = 0; i < numNodes; i++ ){ // each node
    var node = elements[i];
    var data = node._private.data;

    if( is.number(data.parent) ){ // then automake string
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
          if( node.same(ancestor) ){
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
          cy._private.hasCompoundNodes = true;
        }
      } // else
    } // if specified parent
  } // for each node

  restored = new Collection( cy, restored );
  if( restored.length > 0 ){

    var toUpdateStyle = restored.add( restored.connectedNodes() ).add( restored.parent() );
    toUpdateStyle.updateStyle( notifyRenderer );

    if( notifyRenderer ){
      restored.rtrigger('add');
    } else {
      restored.trigger('add');
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
  function addConnectedEdges(node){
    var edges = node._private.edges;
    for( var i = 0; i < edges.length; i++ ){
      add( edges[i] );
    }
  }


  // add descendant nodes
  function addChildren(node){
    var children = node._private.children;

    for( var i = 0; i < children.length; i++ ){
      add( children[i] );
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
    var ele = self[i];

    add( ele );
  }

  function removeEdgeRef(node, edge){
    var connectedEdges = node._private.edges;
    for( var j = 0; j < connectedEdges.length; j++ ){
      var connectedEdge = connectedEdges[j];

      if( edge === connectedEdge ){
        connectedEdges.splice( j, 1 );
        break;
      }
    }
  }

  function removeChildRef(parent, ele){
    ele = ele[0];
    parent = parent[0];
    var children = parent._private.children;

    for( var j = 0; j < children.length; j++ ){
      if( children[j][0] === ele[0] ){
        children.splice(j, 1);
        break;
      }
    }
  }

  for( var i = 0; i < elesToRemove.length; i++ ){
    var ele = elesToRemove[i];

    // mark as removed
    ele._private.removed = true;

    // remove from core pool
    cy.removeFromPool( ele );

    // add to list of removed elements
    removed.push( ele );

    if( ele.isEdge() ){ // remove references to this edge in its connected nodes
      var src = ele.source()[0];
      var tgt = ele.target()[0];

      removeEdgeRef( src, ele );
      removeEdgeRef( tgt, ele );

    } else { // remove reference to parent
      var parent = ele.parent();

      if( parent.length !== 0 ){
        removeChildRef(parent, ele);
      }
    }
  }

  // check to see if we have a compound graph or not
  var elesStillInside = cy._private.elements;
  cy._private.hasCompoundNodes = false;
  for( var i = 0; i < elesStillInside.length; i++ ){
    var ele = elesStillInside[i];

    if( ele.isParent() ){
      cy._private.hasCompoundNodes = true;
      break;
    }
  }

  var removedElements = new Collection( this.cy(), removed );
  if( removedElements.size() > 0 ){
    // must manually notify since trigger won't do this automatically once removed

    if( notifyRenderer ){
      this.cy().notify({
        type: 'remove',
        collection: removedElements
      });
    }

    removedElements.trigger('remove');
  }

  // check for empty remaining parent nodes
  var checkedParentId = {};
  for( var i = 0; i < elesToRemove.length; i++ ){
    var ele = elesToRemove[i];
    var isNode = ele._private.group === 'nodes';
    var parentId = ele._private.data.parent;

    if( isNode && parentId !== undefined && !checkedParentId[ parentId ] ){
      checkedParentId[ parentId ] = true;
      var parent = cy.getElementById( parentId );

      if( parent && parent.length !== 0 && !parent._private.removed && parent.children().length === 0 ){
        parent.updateStyle();
      }
    }
  }

  return new Collection( cy, removed );
};

elesfn.move = function( struct ){
  var cy = this._private.cy;

  if( struct.source !== undefined || struct.target !== undefined ){
    var srcId = struct.source;
    var tgtId = struct.target;
    var srcExists = cy.getElementById( srcId ).length > 0;
    var tgtExists = cy.getElementById( tgtId ).length > 0;

    if( srcExists || tgtExists ){
      var jsons = this.jsons();

      this.remove();

      for( var i = 0; i < jsons.length; i++ ){
        var json = jsons[i];

        if( json.group === 'edges' ){
          if( srcExists ){ json.data.source = srcId; }
          if( tgtExists ){ json.data.target = tgtId; }
        }
      }

      return cy.add( jsons );
    }

  } else if( struct.parent !== undefined ){ // move node to new parent
    var parentId = struct.parent;
    var parentExists = parentId === null || cy.getElementById( parentId ).length > 0;

    if( parentExists ){
      var jsons = this.jsons();
      var descs = this.descendants();
      var descsEtc = descs.merge( descs.add(this).connectedEdges() );

      this.remove(); // NB: also removes descendants and their connected edges

      for( var i = 0; i < this.length; i++ ){
        var json = jsons[i];

        if( json.group === 'nodes' ){
          json.data.parent = parentId === null ? undefined : parentId;
        }
      }
    }

    return cy.add( jsons ).merge( descsEtc.restore() );
  }

  return this; // if nothing done
};

[
  require('./algorithms'),
  require('./algorithms2'),
  require('./animation'),
  require('./class'),
  require('./comparators'),
  require('./compounds'),
  require('./data'),
  require('./degree'),
  require('./dimensions'),
  require('./events'),
  require('./filter'),
  require('./group'),
  require('./index'),
  require('./iteration'),
  require('./layout'),
  require('./style'),
  require('./switch-functions'),
  require('./traversing')
].forEach(function( props ){
  util.extend( elesfn, props );
});

module.exports = Collection;
