'use strict';

let is = require( '../is' );
let util = require( '../util' );
let Promise = require('../promise');
let math = require('../math');

let elesfn = ({
  // Calculates and returns node dimensions { x, y } based on options given
  layoutDimensions: function( options ){
    if( options.nodeDimensionsIncludeLabels ){
      let bbDim = this.boundingBox();
      return {
        w: bbDim.w,
        h: bbDim.h
      };
    }
    else {
      return {
        w: this.outerWidth(),
        h: this.outerHeight()
      };
    }
  },

  // using standard layout options, apply position function (w/ or w/o animation)
  layoutPositions: function( layout, options, fn ){
    let nodes = this.nodes();
    let cy = this.cy();
    let layoutEles = options.eles; // nodes & edges

    // memoized version of position function
    let fnMem = util.memoize( fn, function( node, i ){
      return node.id() + '$' + i;
    } );

    layout.emit( { type: 'layoutstart', layout: layout } );

    layout.animations = [];

    let calculateSpacing = function( spacing, nodesBb, pos ){
      let center = {
        x: nodesBb.x1 + nodesBb.w / 2,
        y: nodesBb.y1 + nodesBb.h / 2
      };

      let spacingVector = { // scale from center of bounding box (not necessarily 0,0)
        x: (pos.x - center.x) * spacing,
        y: (pos.y - center.y) * spacing
      };

      return {
        x: center.x + spacingVector.x,
        y: center.y + spacingVector.y
      };
    };

    let spacingBb = function(){
      let bb = math.makeBoundingBox();

      for( let i = 0; i < nodes.length; i++ ){
        let node = nodes[i];
        let pos = fnMem( node, i );

        math.expandBoundingBoxByPoint( bb, pos.x, pos.y );
      }

      return bb;
    };

    if( options.animate ){
      let bb = spacingBb();

      let finalPos = {};

      for( let i = 0; i < nodes.length; i++ ){
        let node = nodes[i];
        let newPos = fnMem( node, i );
        let pos = node.position();

        if( !is.number( pos.x ) || !is.number( pos.y ) ){
          node.silentPosition( { x: 0, y: 0 } );
        }

        if( options.spacingFactor && options.spacingFactor !== 1 ){
          let spacing = Math.abs( options.spacingFactor );

          newPos = calculateSpacing( spacing, bb, newPos );
        }

        finalPos[ node.id() ] = newPos;
      }

      for( let i = 0; i < nodes.length; i++ ){
        let node = nodes[ i ];
        let newPos = finalPos[ node.id() ];

        let ani = node.animation( {
          position: newPos,
          duration: options.animationDuration,
          easing: options.animationEasing
        } );

        layout.animations.push( ani );

        ani.play();
      }

      if( options.fit ){
        let fitAni = cy.animation({
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
        let zoomPanAni = cy.animation({
          zoom: options.zoom,
          pan: options.pan,
          duration: options.animationDuration,
          easing: options.animationEasing
        });

        layout.animations.push( zoomPanAni );

        zoomPanAni.play();
      }

      layout.one( 'layoutready', options.ready );
      layout.emit( { type: 'layoutready', layout: layout } );

      Promise.all( layout.animations.map(function( ani ){
        return ani.promise();
      }) ).then(function(){
        layout.one( 'layoutstop', options.stop );
        layout.emit( { type: 'layoutstop', layout: layout } );
      });
    } else {
      if( options.spacingFactor && options.spacingFactor !== 1 ){
        let spacing = Math.abs( options.spacingFactor );
        let bb = spacingBb();

        nodes.positions( function( node, i ){
          let pos = fnMem( node, i );

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
      layout.emit( { type: 'layoutready', layout: layout } );

      layout.one( 'layoutstop', options.stop );
      layout.emit( { type: 'layoutstop', layout: layout } );
    }

    return this; // chaining
  },

  layout: function( options ){
    let cy = this.cy();

    return cy.makeLayout( util.extend( {}, options, {
      eles: this
    } ) );
  }

});

// aliases:
elesfn.createLayout = elesfn.makeLayout = elesfn.layout;

module.exports = elesfn;
