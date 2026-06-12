import * as util from '../util/index.mjs';
import Animation, { type AnimationOptions, type AnimationTarget } from '../animation.mjs';
import * as math from '../math.mjs';
import * as is from '../is.mjs';
import type { Position } from '../types.mjs';

// Internal structural view of the host (Core or Collection) inside the
// generated animation methods. The host is duck-typed at runtime:
// array-like (Collection of elements) or not (Core).
interface AniCoreView {
  styleEnabled(): boolean;
  style(): { getPropsList( props: unknown ): unknown };
  pan(): Position;
  zoom(): number;
  getCenterPan( eles: unknown, zoom?: unknown ): Position | undefined;
  getFitViewport( eles: unknown, padding?: number ): { pan: Position; zoom: number } | undefined;
  getZoomedViewport( zoomOpts: unknown ): { zoomed?: boolean; panned?: boolean; zoom?: number; pan?: Position } | null | undefined;
  notify( event: string ): void;
}

interface AniEntityView extends AnimationTarget {
  animated(): boolean;
  animation( properties?: AnimationOptions, params?: AnimationOptions ): Animation;
}

interface AniHostView extends AniEntityView {
  length?: number;
  _private: AniEntityView['_private'] & { cy?: AniCoreView };
  animate( properties: AnimationOptions, params?: AnimationOptions ): unknown;
}

const getCy = ( self: AniHostView ): AniCoreView =>
  ( self._private.cy || self ) as unknown as AniCoreView;

let define = {

  animated: function<Self>(){
    return function animatedImpl( this: Self ){
      let self = this as unknown as AniHostView;
      let selfIsArrayLike = self.length !== undefined;
      let all = ( selfIsArrayLike ? self : [ self ] ) as unknown as ArrayLike<AniEntityView>; // put in array if not array-like
      let cy = getCy( self );

      if( !cy.styleEnabled() ){ return false; }

      let ele = all[0];

      if( ele ){
        return ele._private.animation.current.length > 0;
      }
    } as ( this: Self ) => boolean | undefined;
  }, // animated

  clearQueue: function<Self>(){
    return function clearQueueImpl( this: Self ){
      let self = this as unknown as AniHostView;
      let selfIsArrayLike = self.length !== undefined;
      let all = ( selfIsArrayLike ? self : [ self ] ) as unknown as ArrayLike<AniEntityView>; // put in array if not array-like
      let cy = getCy( self );

      if( !cy.styleEnabled() ){ return this; }

      for( let i = 0; i < all.length; i++ ){
        let ele = all[ i ];
        ele._private.animation.queue = [];
      }

      return this;
    };
  }, // clearQueue

  delay: function<Self>(){
    return function delayImpl( this: Self, time: number, complete?: () => void ){
      let self = this as unknown as AniHostView;
      let cy = getCy( self );

      if( !cy.styleEnabled() ){ return this; }

      return self.animate( {
        delay: time,
        duration: time,
        complete: complete
      } ) as unknown as Self; // .animate() chains, returning the host
    };
  }, // delay

  delayAnimation: function<Self>(){
    return function delayAnimationImpl( this: Self, time: number, complete?: () => void ){
      let self = this as unknown as AniHostView;
      let cy = getCy( self );

      if( !cy.styleEnabled() ){ return this; }

      return self.animation( {
        delay: time,
        duration: time,
        complete: complete
      } ) as Animation | Self;
    };
  }, // delay

  animation: function<Self>(){
    return function animationImpl( this: Self, properties?: AnimationOptions, params?: AnimationOptions ){
      let self = this as unknown as AniHostView;
      let selfIsArrayLike = self.length !== undefined;
      let all = ( selfIsArrayLike ? self : [ self ] ) as unknown as ArrayLike<AniEntityView>; // put in array if not array-like
      let cy = getCy( self );
      let isCore = !selfIsArrayLike;
      let isEles = !isCore;

      if( !cy.styleEnabled() ){ return this; }

      let style = cy.style();

      properties = util.assign( {}, properties, params ) as AnimationOptions;

      let propertiesEmpty = Object.keys( properties ).length === 0;

      if( propertiesEmpty ){
        return new Animation( all[0] as AnimationTarget, properties ); // nothing to animate
      }

      if( properties.duration === undefined ){
        properties.duration = 400;
      }

      switch( properties.duration ){
      case 'slow':
        properties.duration = 600;
        break;
      case 'fast':
        properties.duration = 200;
        break;
      }

      if( isEles ){
        properties.style = style.getPropsList( properties.style || properties.css ) as AnimationOptions['style'];

        properties.css = undefined;
      }

      if( isEles && properties.renderedPosition != null ){
        let rpos = properties.renderedPosition;
        let pan = cy.pan();
        let zoom = cy.zoom();

        properties.position = math.renderedToModelPosition( rpos, zoom, pan );
      }

      // override pan w/ panBy if set
      if( isCore && properties.panBy != null ){
        let panBy = properties.panBy;
        let cyPan = cy.pan();

        properties.pan = {
          x: cyPan.x + panBy.x,
          y: cyPan.y + panBy.y
        };
      }

      // override pan w/ center if set
      let center = properties.center || properties.centre;
      if( isCore && center != null ){
        let centerPan = cy.getCenterPan( center.eles, properties.zoom );

        if( centerPan != null ){
          properties.pan = centerPan;
        }
      }

      // override pan & zoom w/ fit if set
      if( isCore && properties.fit != null ){
        let fit = properties.fit;
        let fitVp = cy.getFitViewport( fit.eles || fit.boundingBox, fit.padding );

        if( fitVp != null ){
          properties.pan = fitVp.pan;
          properties.zoom = fitVp.zoom;
        }
      }

      // override zoom (& potentially pan) w/ zoom obj if set
      if( isCore && is.plainObject( properties.zoom ) ){
        let vp = cy.getZoomedViewport( properties.zoom );

        if( vp != null ){
          if( vp.zoomed ){ properties.zoom = vp.zoom; }

          if( vp.panned ){ properties.pan = vp.pan; }
        } else {
          properties.zoom = null; // an inavalid zoom (e.g. no delta) gets automatically destroyed
        }
      }

      return new Animation( all[0] as AnimationTarget, properties );
    } as ( this: Self, properties?: AnimationOptions, params?: AnimationOptions ) => Animation | Self;
  }, // animate

  animate: function<Self>(){
    return function animateImpl( this: Self, properties: AnimationOptions, params?: AnimationOptions ){
      let self = this as unknown as AniHostView;
      let selfIsArrayLike = self.length !== undefined;
      let all = ( selfIsArrayLike ? self : [ self ] ) as unknown as ArrayLike<AniEntityView>; // put in array if not array-like
      let cy = getCy( self );

      if( !cy.styleEnabled() ){ return this; }

      if( params ){
        properties = util.extend( {}, properties, params ) as AnimationOptions;
      }

      // manually hook and run the animation
      for( let i = 0; i < all.length; i++ ){
        let ele = all[ i ];
        let queue = ele.animated() && (properties.queue === undefined || properties.queue);

        let ani = ele.animation( properties, (queue ? { queue: true } : undefined) );

        ani.play();
      }

      return this; // chaining
    };
  }, // animate

  stop: function<Self>(){
    return function stopImpl( this: Self, clearQueue?: boolean, jumpToEnd?: boolean ){
      let self = this as unknown as AniHostView;
      let selfIsArrayLike = self.length !== undefined;
      let all = ( selfIsArrayLike ? self : [ self ] ) as unknown as ArrayLike<AniEntityView>; // put in array if not array-like
      let cy = getCy( self );

      if( !cy.styleEnabled() ){ return this; }

      for( let i = 0; i < all.length; i++ ){
        let ele = all[ i ];
        let _p = ele._private;
        let anis = _p.animation.current;

        for( let j = 0; j < anis.length; j++ ){
          let ani = anis[ j ];
          let ani_p = ani._private;

          if( jumpToEnd ){
            // next iteration of the animation loop, the animation
            // will go straight to the end and be removed
            ani_p.duration = 0;
          }
        }

        // clear the queue of future animations
        if( clearQueue ){
          _p.animation.queue = [];
        }

        if( !jumpToEnd ){
          _p.animation.current = [];
        }
      }

      // we have to notify (the animation loop doesn't do it for us on `stop`)
      cy.notify('draw');

      return this;
    };
  } // stop

}; // define

export default define;
