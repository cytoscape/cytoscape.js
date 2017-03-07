'use strict';

var is = require( '../is' );
var util = require( '../util' );
var Promise = require('../promise');
var math = require('../math');

var elesfn = ({

  // using standard layout options, apply position function (w/ or w/o animation)
  layoutPositions: function( layout, options, fn ){
    var nodes = this.nodes();
    var cy = this.cy();
    var layoutEles = options.eles; // nodes & edges

    // memoized version of position function
    var fnMem = util.memoize( fn, function( node, i ){
      return node.id() + '$' + i;
    } );

    layout.trigger( { type: 'layoutstart', layout: layout } );

    layout.animations = [];

    var calculateSpacing = function( spacing, nodesBb, pos ){
      var center = {
        x: nodesBb.x1 + nodesBb.w / 2,
        y: nodesBb.y1 + nodesBb.h / 2
      };

      var spacingVector = { // scale from center of bounding box (not necessarily 0,0)
        x: (pos.x - center.x) * spacing,
        y: (pos.y - center.y) * spacing
      };

      return {
        x: center.x + spacingVector.x,
        y: center.y + spacingVector.y
      };
    };

    var spacingBb = function(){
      var bb = math.makeBoundingBox();

      for( var i = 0; i < nodes.length; i++ ){
        var node = nodes[i];
        var pos = fnMem( node, i );

        math.expandBoundingBoxByPoint( bb, pos.x, pos.y );
      }

      return bb;
    };

    if( options.animate ){
      var bb = spacingBb();

      var finalPos = {};

      for( var i = 0; i < nodes.length; i++ ){
        var node = nodes[i];
        var newPos = fnMem( node, i );
        var pos = node.position();

        if( !is.number( pos.x ) || !is.number( pos.y ) ){
          node.silentPosition( { x: 0, y: 0 } );
        }

        if( options.spacingFactor && options.spacingFactor !== 1 ){
          var spacing = Math.abs( options.spacingFactor );

          newPos = calculateSpacing( spacing, bb, newPos );
        }

        finalPos[ node.id() ] = newPos;
      }

      for( var i = 0; i < nodes.length; i++ ){
        var node = nodes[ i ];
        var newPos = finalPos[ node.id() ];

        var ani = node.animation( {
          position: newPos,
          duration: options.animationDuration,
          easing: options.animationEasing
        } );

        layout.animations.push( ani );

        ani.play();
      }

      if( options.fit ){
        var fitAni = cy.animation({
          fit: {
            boundingBox: layoutEles.boundingBoxAt(function( i, node ){
              return finalPos[ node.id() ];
            }),
            padding: options.padding
          },
          duration: options.animationDuration,
          easing: options.animationEasing
        });

        layout.animations.push( fitAni );

        fitAni.play();
      } else if( options.zoom !== undefined && options.pan !== undefined ){
        var zoomPanAni = cy.animation({
          zoom: options.zoom,
          pan: options.pan,
          duration: options.animationDuration,
          easing: options.animationEasing
        });

        layout.animations.push( zoomPanAni );

        zoomPanAni.play();
      }

      layout.one( 'layoutready', options.ready );
      layout.trigger( { type: 'layoutready', layout: layout } );

      Promise.all( layout.animations.map(function( ani ){
        return ani.promise();
      }) ).then(function(){
        layout.one( 'layoutstop', options.stop );
        layout.trigger( { type: 'layoutstop', layout: layout } );
      });
    } else {
      if( options.spacingFactor && options.spacingFactor !== 1 ){
        var spacing = Math.abs( options.spacingFactor );
        var bb = spacingBb();

        nodes.positions( function( node, i ){
          var pos = fnMem( node, i );

          return calculateSpacing( spacing, bb, pos );
        });
      } else {
        nodes.positions( fn );
      }

      if( options.fit ){
        cy.fit( options.eles, options.padding );
      }

      if( options.zoom != null ){
        cy.zoom( options.zoom );
      }

      if( options.pan ){
        cy.pan( options.pan );
      }

      layout.one( 'layoutready', options.ready );
      layout.trigger( { type: 'layoutready', layout: layout } );

      layout.one( 'layoutstop', options.stop );
      layout.trigger( { type: 'layoutstop', layout: layout } );
    }

    return this; // chaining
  },

  layout: function( options ){
    var cy = this.cy();

    cy.layout( util.extend( {}, options, {
      eles: this
    } ) );

    return this;
  },

  makeLayout: function( options ){
    var cy = this.cy();

    return cy.makeLayout( util.extend( {}, options, {
      eles: this
    } ) );
  }

});

// aliases:
elesfn.createLayout = elesfn.makeLayout;

module.exports = elesfn;
