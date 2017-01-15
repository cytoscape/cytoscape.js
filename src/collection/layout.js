'use strict';

var is = require( '../is' );
var util = require( '../util' );
var Promise = require('../promise');

var elesfn = ({

  // using standard layout options, apply position function (w/ or w/o animation)
  layoutPositions: function( layout, options, fn ){
    var nodes = this.nodes();
    var cy = this.cy();

    layout.trigger( { type: 'layoutstart', layout: layout } );

    layout.animations = [];

    if( options.animate ){
      for( var i = 0; i < nodes.length; i++ ){
        var node = nodes[ i ];

        var newPos = fn.call( node, i, node );
        var pos = node.position();

        if( !is.number( pos.x ) || !is.number( pos.y ) ){
          node.silentPosition( { x: 0, y: 0 } );
        }

        if ( options.spacingFactor && options.spacingFactor !== 1){
          var spacing = Math.abs(options.spacingFactor);
          var nbb = nodes.boundingBox();
          var center = {
            x: nbb.x1 + nbb.w / 2,
            y: nbb.y1 + nbb.h / 2
          };
          var spacingVector = { // scale the spacing from center of bounding box (not necessarily 0,0)
            x: (newPos.x - center.x) * spacing,
            y: (newPos.y - center.y) * spacing
          };
          newPos = util.extend( {}, newPos, { x: center.x + spacingVector.x, y: center.y + spacingVector.y } );
        }

        var ani = node.animation( {
          position: newPos,
          duration: options.animationDuration,
          easing: options.animationEasing
        } );

        layout.animations.push( ani );

        ani.play();
      }

      var onStep;
      cy.on( 'step.*', ( onStep = function(){
        if( options.fit ){
          cy.fit( options.eles, options.padding );
        }
      }) );

      layout.one('layoutstop', function(){
        cy.off('step.*', onStep);
      });

      layout.one( 'layoutready', options.ready );
      layout.trigger( { type: 'layoutready', layout: layout } );

      Promise.all( layout.animations.map(function( ani ){
        return ani.promise();
      }) ).then(function(){
        cy.off('step.*', onStep);

        if( options.zoom != null ){
          cy.zoom( options.zoom );
        }

        if( options.pan ){
          cy.pan( options.pan );
        }

        if( options.fit ){
          cy.fit( options.eles, options.padding );
        }

        layout.one( 'layoutstop', options.stop );
        layout.trigger( { type: 'layoutstop', layout: layout } );
      });
    } else {
      nodes.positions( fn );

      if ( options.spacingFactor && options.spacingFactor !== 1){
        var spacing = Math.abs(options.spacingFactor);
        nodes.positions( function (i, node){
          var pos = node.position();
          var nbb = nodes.boundingBox();
          var center = {
            x: nbb.x1 + nbb.w / 2,
            y: nbb.y1 + nbb.h / 2
          };
          var scaleVector = { // scale from center of bounding box (not necessarily 0,0)
            x: (pos.x - center.x) * spacing,
            y: (pos.y - center.y) * spacing
          };
          return {
            x: center.x + scaleVector.x,
            y: center.y + scaleVector.y
          };
        });
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
