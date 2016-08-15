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
