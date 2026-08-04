import * as util from './util/index.mjs';
import * as is from './is.mjs';
import Promise, { type PromiseLikeObject } from './promise.mjs';
import type { Position, CoreShim } from './types.mjs';

// Minimal structural view of an animation style property (refined when
// src/style is converted).
export interface AnimationStyleProp {
  name: string;
}

/**
 * Animation options as accepted by `.animate()` / `.animation()`. The
 * same bag, plus bookkeeping fields, becomes the animation's `_private`
 * state.
 */
export interface AnimationOptions {
  duration?: number | 'slow' | 'fast';
  style?: AnimationStyleProp[] | Record<string, unknown>;
  css?: AnimationStyleProp[] | Record<string, unknown>;
  queue?: boolean;
  complete?: () => void;
  step?: () => void;
  delay?: number;
  easing?: string;
  position?: Position;
  renderedPosition?: Position;
  startPosition?: Position;
  startStyle?: Record<string, AnimationStyleProp>;
  pan?: Position;
  panBy?: Position;
  startPan?: Position;
  zoom?: number | Record<string, unknown> | null;
  startZoom?: number;
  center?: { eles: unknown };
  centre?: { eles: unknown };
  fit?: { eles?: unknown; boundingBox?: unknown; padding?: number };
}

/**
 * Structural view of what an Animation animates: a Core or a single
 * element. Refined to the real types when src/core and src/collection
 * are converted.
 */
export interface AnimationTarget {
  _private: {
    animation: {
      current: Animation[];
      queue: Animation[];
    };
  };
}

// the element-flavored target surface used when the target is not a core
interface ElementAnimationTarget extends AnimationTarget {
  position(): Position;
  cy(): CoreShim & {
    style(): { getAnimationStartStyle( target: unknown, style: unknown ): Record<string, AnimationStyleProp> };
    addToAnimationPool( target: unknown ): void;
  };
}

interface AnimationPrivate extends AnimationOptions {
  target: AnimationTarget;
  started: boolean;
  playing: boolean;
  hooked: boolean;
  applying: boolean;
  progress: number;
  completes: ( () => void )[];
  frames: ( () => void )[];
  stopped?: boolean;
  duration: number | 'slow' | 'fast';
}

class Animation {
  /** @internal */
  _private: AnimationPrivate;
  length: number;
  [index: number]: Animation;

  constructor( target: AnimationTarget, opts?: AnimationOptions, opts2?: AnimationOptions ){
    let isCore = is.core(target);
    let isEle = !isCore;

    let _p = this._private = util.extend( {
      duration: 1000
    }, opts, opts2 ) as AnimationPrivate;

    _p.target = target;
    _p.style = _p.style || _p.css;
    _p.started = false;
    _p.playing = false;
    _p.hooked = false;
    _p.applying = false;
    _p.progress = 0;
    _p.completes = [];
    _p.frames = [];

    if( _p.complete && is.fn( _p.complete ) ){
      _p.completes.push( _p.complete );
    }

    if( isEle ){
      let eleTarget = target as ElementAnimationTarget;
      let pos = eleTarget.position();

      _p.startPosition = _p.startPosition || {
        x: pos.x,
        y: pos.y
      };

      _p.startStyle = _p.startStyle || eleTarget.cy().style().getAnimationStartStyle( eleTarget, _p.style );
    }

    if( isCore ){
      let corePan = ( target as unknown as CoreShim ).pan();

      _p.startPan = {
        x: corePan.x,
        y: corePan.y
      };

      _p.startZoom = ( target as unknown as CoreShim ).zoom();
    }

    // for future timeline/animations impl
    this.length = 1;
    this[0] = this;
  }

  instanceString(): string { return 'animation'; }

  /** @internal */
  hook(): this {
    let _p = this._private;

    if( !_p.hooked ){
      // add to target's animation queue
      let q;
      let tAni = _p.target._private.animation;
      if( _p.queue ){
        q = tAni.queue;
      } else {
        q = tAni.current;
      }
      q.push( this );

      // add to the animation loop pool
      if( is.elementOrCollection( _p.target ) ){
        ( _p.target as unknown as ElementAnimationTarget ).cy().addToAnimationPool( _p.target );
      }

      _p.hooked = true;
    }

    return this;
  }

  play(): this {
    let _p = this._private;

    // autorewind
    if( _p.progress === 1 ){
      _p.progress = 0;
    }

    _p.playing = true;
    _p.started = false; // needs to be started by animation loop
    _p.stopped = false;

    this.hook();

    // the animation loop will start the animation...

    return this;
  }

  playing(): boolean {
    return this._private.playing;
  }

  apply(): this {
    let _p = this._private;

    _p.applying = true;
    _p.started = false; // needs to be started by animation loop
    _p.stopped = false;

    this.hook();

    // the animation loop will apply the animation at this progress

    return this;
  }

  applying(): boolean {
    return this._private.applying;
  }

  pause(): this {
    let _p = this._private;

    _p.playing = false;
    _p.started = false;

    return this;
  }

  stop(): this {
    let _p = this._private;

    _p.playing = false;
    _p.started = false;
    _p.stopped = true; // to be removed from animation queues

    return this;
  }

  rewind(): this {
    return this.progress( 0 );
  }

  fastforward(): this {
    return this.progress( 1 );
  }

  time(): number;
  time( t: number ): this;
  time( t?: number ): number | this {
    let _p = this._private;

    if( t === undefined ){
      return _p.progress * ( _p.duration as number );
    } else {
      return this.progress( t / ( _p.duration as number ) );
    }
  }

  progress(): number;
  progress( p: number ): this;
  progress( p?: number ): number | this {
    let _p = this._private;
    let wasPlaying = _p.playing;

    if( p === undefined ){
      return _p.progress;
    } else {
      if( wasPlaying ){
        this.pause();
      }

      _p.progress = p;
      _p.started = false;

      if( wasPlaying ){
        this.play();
      }
    }

    return this;
  }

  completed(): boolean {
    return this._private.progress === 1;
  }

  reverse(): this {
    let _p = this._private;
    let wasPlaying = _p.playing;

    if( wasPlaying ){
      this.pause();
    }

    _p.progress = 1 - _p.progress;
    _p.started = false;

    let swap = function( a: string, b: string ){
      let _pd = _p as unknown as Record<string, unknown>;
      let _pa = _pd[ a ];

      if( _pa == null ){ return; }

      _pd[ a ] = _pd[ b ];
      _pd[ b ] = _pa;
    };

    swap( 'zoom', 'startZoom' );
    swap( 'pan', 'startPan' );
    swap( 'position', 'startPosition' );

    // swap styles
    if( _p.style ){
      let style = _p.style as AnimationStyleProp[];

      for( let i = 0; i < style.length; i++ ){
        let prop = style[ i ];
        let name = prop.name;
        let startStyleProp = _p.startStyle![ name ];

        _p.startStyle![ name ] = prop;
        style[ i ] = startStyleProp;
      }
    }

    if( wasPlaying ){
      this.play();
    }

    return this;
  }

  promise( type?: string ): PromiseLikeObject<void> {
    let _p = this._private;

    let arr;

    switch( type ){
      case 'frame':
        arr = _p.frames;
        break;
      default:
      case 'complete':
      case 'completed':
        arr = _p.completes;
    }

    return new Promise<void>( function( resolve, reject ){ // eslint-disable-line @typescript-eslint/no-unused-vars
      arr.push( function(){
        resolve();
      } );
    } );
  }

  declare complete: this['completed'];
  declare run: this['play'];
  declare running: this['playing'];
}

Animation.prototype.complete = Animation.prototype.completed;
Animation.prototype.run = Animation.prototype.play;
Animation.prototype.running = Animation.prototype.playing;

export default Animation;
