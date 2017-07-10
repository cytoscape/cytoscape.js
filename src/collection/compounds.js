let Set = require('../set');

let elesfn = ({
  parent: function( selector ){
    let parents = [];

    // optimisation for single ele call
    if( this.length === 1 ){
      let parent = this[0]._private.parent;

      if( parent ){ return parent; }
    }

    for( let i = 0; i < this.length; i++ ){
      let ele = this[ i ];
      let parent = ele._private.parent;

      if( parent ){
        parents.push( parent );
      }
    }

    return this.spawn( parents, { unique: true } ).filter( selector );
  },

  parents: function( selector ){
    let parents = [];

    let eles = this.parent();
    while( eles.nonempty() ){
      for( let i = 0; i < eles.length; i++ ){
        let ele = eles[ i ];
        parents.push( ele );
      }

      eles = eles.parent();
    }

    return this.spawn( parents, { unique: true } ).filter( selector );
  },

  commonAncestors: function( selector ){
    let ancestors;

    for( let i = 0; i < this.length; i++ ){
      let ele = this[ i ];
      let parents = ele.parents();

      ancestors = ancestors || parents;

      ancestors = ancestors.intersect( parents ); // current list must be common with current ele parents set
    }

    return ancestors.filter( selector );
  },

  orphans: function( selector ){
    return this.stdFilter( function( ele ){
      return ele.isOrphan();
    } ).filter( selector );
  },

  nonorphans: function( selector ){
    return this.stdFilter( function( ele ){
      return ele.isChild();
    } ).filter( selector );
  },

  children: function( selector ){
    let children = [];

    for( let i = 0; i < this.length; i++ ){
      let ele = this[ i ];
      children = children.concat( ele._private.children );
    }

    return this.spawn( children, { unique: true } ).filter( selector );
  },

  siblings: function( selector ){
    return this.parent().children().not( this ).filter( selector );
  },

  isParent: function(){
    let ele = this[0];

    if( ele ){
      return ele.isNode() && ele._private.children.length !== 0;
    }
  },

  isChildless: function(){
    let ele = this[0];

    if( ele ){
      return ele.isNode() && ele._private.children.length === 0;
    }
  },

  isChild: function(){
    let ele = this[0];

    if( ele ){
      return ele.isNode() && ele._private.parent != null;
    }
  },

  isOrphan: function(){
    let ele = this[0];

    if( ele ){
      return ele.isNode() && ele._private.parent == null;
    }
  },

  descendants: function( selector ){
    let elements = [];

    function add( eles ){
      for( let i = 0; i < eles.length; i++ ){
        let ele = eles[ i ];

        elements.push( ele );

        if( ele.children().nonempty() ){
          add( ele.children() );
        }
      }
    }

    add( this.children() );

    return this.spawn( elements, { unique: true } ).filter( selector );
  }
});

function forEachCompound( eles, fn, includeSelf, recursiveStep ){
  let q = [];
  let did = new Set();
  let cy = eles.cy();
  let hasCompounds = cy.hasCompoundNodes();

  for( let i = 0; i < eles.length; i++ ){
    let ele = eles[i];

    if( includeSelf ){
      q.push( ele );
    } else if( hasCompounds ){
      recursiveStep( q, did, ele );
    }
  }

  while( q.length > 0 ){
    let ele = q.shift();

    fn( ele );

    did.add( ele.id() );

    if( hasCompounds ){
      recursiveStep( q, did, ele );
    }
  }

  return eles;
}

function addChildren( q, did, ele ){
  if( ele.isParent() ){
    let children = ele._private.children;

    for( let i = 0; i < children.length; i++ ){
      let child = children[i];

      if( !did.has( child.id() ) ){
        q.push( child );
      }
    }
  }
}

// very efficient version of eles.add( eles.descendants() ).forEach()
// for internal use
elesfn.forEachDown = function( fn, includeSelf = true ){
  return forEachCompound( this, fn, includeSelf, addChildren );
};

function addParent( q, did, ele ){
  if( ele.isChild() ){
    let parent = ele._private.parent;

    if( !did.has( parent.id() ) ){
      q.push( parent );
    }
  }
}

elesfn.forEachUp = function( fn, includeSelf = true ){
  return forEachCompound( this, fn, includeSelf, addParent );
};

function addParentAndChildren( q, did, ele ){
  addParent( q, did, ele );
  addChildren( q, did, ele );
}

elesfn.forEachUpAndDown = function( fn, includeSelf = true ){
  return forEachCompound( this, fn, includeSelf, addParentAndChildren );
};

// aliases
elesfn.ancestors = elesfn.parents;

module.exports = elesfn;
