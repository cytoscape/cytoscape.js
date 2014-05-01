;(function($$){ 'use strict';

  // Compound functions
  /////////////////////

  $$.fn.eles({
    parent: function( selector ){
      var parents = [];
      var cy = this._private.cy;

      for( var i = 0; i < this.length; i++ ){
        var ele = this[i];
        var parent = cy.getElementById( ele._private.data.parent );

        if( parent.size() > 0 ){
          parents.push( parent );
        }
      }
      
      return new $$.Collection( cy, parents ).filter( selector );
    },

    parents: function( selector ){
      var parents = [];

      var eles = this.parent();
      while( eles.nonempty() ){
        for( var i = 0; i < eles.length; i++ ){
          var ele = eles[i];
          parents.push( ele );
        }

        eles = eles.parent();
      }

      return new $$.Collection( this.cy(), parents ).filter( selector );
    },

    commonAncestors: function( selector ){
      var ancestors;

      for( var i = 0; i < this.length; i++ ){
        var ele = this[i];
        var parents = ele.parents();
        
        ancestors = ancestors || parents;

        ancestors = ancestors.intersect( parents ); // current list must be common with current ele parents set
      }

      return ancestors.filter( selector );
    },

    children: function( selector ){
      var children = [];

      for( var i = 0; i < this.length; i++ ){
        var ele = this[i];
        children = children.concat( ele._private.children );
      }

      return new $$.Collection( this.cy(), children ).filter( selector );
    },

    siblings: function( selector ){
      return this.parent().children().not( this ).filter( selector );
    },

    isParent: function(){
      var ele = this[0];

      if( ele ){
        return ele._private.children.length !== 0;
      }
    },

    isChild: function(){
      var ele = this[0];

      if( ele ){
        return ele._private.data.parent !== undefined && ele.parent().length !== 0;
      }
    },

    descendants: function( selector ){
      var elements = [];

      function add( eles ){
        for( var i = 0; i < eles.length; i++ ){
          var ele = eles[i];

          elements.push( ele );

          if( ele.children().nonempty() ){
            add( ele.children() );
          }
        }
      }

      add( this.children() );

      return new $$.Collection( this.cy(), elements ).filter( selector );
    }
  });

  // aliases
  $$.elesfn.ancestors = $$.elesfn.parents;
  
})( cytoscape );