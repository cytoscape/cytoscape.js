import easings from './easings.mjs';
import type { EasingFn } from './easings.mjs';
import ease from './ease.mjs';
import * as is from '../../is.mjs';
import {bound} from '../../math.mjs';
import type Animation from '../../animation.mjs';
import type { Position } from '../../types.mjs';
import type { AnimationStyleProp } from '../../animation.mjs';

/** A parsed style property (carries a name plus value bookkeeping). */
type StyleProp = AnimationStyleProp & { name: string };

/**
 * Internal private state of an animation as consumed during the step loop.
 * Structural superset of the animation's `_private` with the resolved
 * runtime fields populated by the loop.
 */
export interface StepAnimationPrivate {
  easing?: string | unknown[] | null;
  easingImpl?: EasingFn;
  started?: boolean;
  startTime: number;
  duration: number | 'slow' | 'fast';
  applying?: boolean;
  progress: number;
  delay?: number | null;
  startPosition?: Position;
  position?: Position;
  startPan?: Position;
  pan?: Position;
  startZoom?: number;
  zoom?: number | Record<string, unknown> | null;
  style?: StyleProp[];
  startStyle?: Record<string, StyleProp>;
}

/** Internal state on the step target (an element or the core). */
interface StepTargetPrivate {
  pan: Position;
  zoom: number;
  minZoom: number;
  maxZoom: number;
}

/** Structural view of a style parser/registry as used by the step loop. */
interface StepStyle {
  parse( name: string, value: unknown ): { value: unknown };
  properties: Record<string, unknown>;
  overrideBypass( ele: unknown, name: string, value: unknown ): void;
}

/** The target of a step: a single element or the core itself. */
export interface StepTarget {
  _private: StepTargetPrivate;
  cy(): { style(): StepStyle; emit( evt: string ): void };
  style(): StepStyle;
  locked?(): boolean;
  position( pos: Position ): void;
  emit( evt: string ): void;
}

function step( self: StepTarget, ani: Animation, now: number, isCore: boolean ): number {
  let isEles = !isCore;
  let _p = self._private;
  let ani_p = ani._private as unknown as StepAnimationPrivate; // resolved step-time view of the animation's private state
  let pEasing = ani_p.easing;
  let startTime = ani_p.startTime;
  let cy = isCore ? self : self.cy();
  let style = cy.style();

  if( !ani_p.easingImpl ){

    if( pEasing == null ){ // use default
      ani_p.easingImpl = easings[ 'linear' ];

    } else { // then define w/ name
      let easingVals: string | unknown[];

      if( is.string( pEasing ) ){
        let easingProp = style.parse( 'transition-timing-function', pEasing );

        easingVals = easingProp.value as string | unknown[];

      } else { // then assume preparsed array
        easingVals = pEasing;
      }

      let name: string, args: number[];

      if( is.string( easingVals ) ){
        name = easingVals;
        args = [];
      } else {
        name = easingVals[1] as string;
        args = easingVals.slice( 2 ).map( function( n ){ return +( n as number ); } );
      }

      if( args.length > 0 ){ // create with args
        if( name === 'spring' ){
          args.push( ani_p.duration as number ); // need duration to generate spring
        }

        ani_p.easingImpl = easings[ name ].apply( null, args );
      } else { // static impl by name
        ani_p.easingImpl = easings[ name ];
      }
    }

  }

  let easing = ani_p.easingImpl as EasingFn;
  let percent: number;

  if( ani_p.duration === 0 ){
    percent = 1;
  } else {
    percent = (now - startTime) / ( ani_p.duration as number );
  }

  if( ani_p.applying ){
    percent = ani_p.progress;
  }

  if( percent < 0 ){
    percent = 0;
  } else if( percent > 1 ){
    percent = 1;
  }

  if( ani_p.delay == null ){ // then update

    let startPos = ani_p.startPosition as Position;
    let endPos = ani_p.position;

    if( endPos && isEles && !self.locked!() ){
      let newPos: Position = {} as Position;

      if( valid( startPos.x, endPos.x ) ){
        newPos.x = ease( startPos.x, endPos.x, percent, easing ) as number;
      }

      if( valid( startPos.y, endPos.y ) ){
        newPos.y = ease( startPos.y, endPos.y, percent, easing ) as number;
      }

      self.position( newPos );
    }

    let startPan = ani_p.startPan as Position;
    let endPan = ani_p.pan;
    let pan = _p.pan;
    let animatingPan = endPan != null && isCore;
    if( animatingPan ){
      if( valid( startPan.x, endPan!.x ) ){
        pan.x = ease( startPan.x, endPan!.x, percent, easing ) as number;
      }

      if( valid( startPan.y, endPan!.y ) ){
        pan.y = ease( startPan.y, endPan!.y, percent, easing ) as number;
      }

      self.emit( 'pan' );
    }

    let startZoom = ani_p.startZoom as number;
    let endZoom = ani_p.zoom as number;
    let animatingZoom = endZoom != null && isCore;
    if( animatingZoom ){
      if( valid( startZoom, endZoom ) ){
        _p.zoom = bound( _p.minZoom, ease( startZoom, endZoom, percent, easing ) as number, _p.maxZoom );
      }

      self.emit( 'zoom' );
    }

    if( animatingPan || animatingZoom ){
      self.emit( 'viewport' );
    }

    let props = ani_p.style;
    if( props && props.length > 0 && isEles ){
      for( let i = 0; i < props.length; i++ ){
        let prop = props[ i ];
        let name = prop.name;
        let end = prop;
        let start = ani_p.startStyle![ name ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- style property spec is untyped until src/style is converted
        let propSpec = style.properties[ start.name ] as any;
        let easedVal = ease( start as unknown as number, end as unknown as number, percent, easing, propSpec );

        style.overrideBypass( self, name, easedVal );
      } // for props

      self.emit('style');

    } // if

  }

  ani_p.progress = percent;

  return percent;
}

function valid( start: unknown, end: unknown ){
  if( start == null || end == null ){
    return false;
  }

  if( is.number( start ) && is.number( end ) ){
    return true;
  } else if( (start) && (end) ){
    return true;
  }

  return false;
}

export default step;
