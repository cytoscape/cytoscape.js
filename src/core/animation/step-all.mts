import step from './step.mjs';
import type { StepTarget, StepAnimationPrivate } from './step.mjs';
import startAnimation from './start.mjs';
import type Animation from '../../animation.mjs';
import type { Core } from '../core-types.mjs';

/**
 * The per-frame step view of an animation: a runtime Animation plus the
 * bookkeeping flags/callbacks the loop reads and clears.
 */
interface StepAni extends Animation {
  _private: Animation['_private'] & StepAnimationPrivate & {
    stopped?: boolean;
    hooked: boolean;
    playing: boolean;
    started: boolean;
    applying?: boolean;
    frames: ( () => void )[];
    completes: ( () => void )[];
    step?: ( now: number ) => void;
  };
}

/**
 * An animation target processed by the loop: an element or the core, holding
 * its current/queued animations.
 */
interface StepEle {
  _private: { animation: { current: StepAni[]; queue: StepAni[] } };
}

function stepAll( now: number, cy: Core ){
  let eles = cy._private.aniEles;
  let doneEles: StepEle[] = [];

  function stepOne( ele: StepEle, isCore?: boolean ): boolean {
    let _p = ele._private;
    let current = _p.animation.current;
    let queue = _p.animation.queue;
    let ranAnis = false;

    // if nothing currently animating, get something from the queue
    if( current.length === 0 ){
      let next = queue.shift();

      if( next ){
        current.push( next );
      }
    }

    let callbacks = function( callbacks: ( () => void )[] ){
      for( let j = callbacks.length - 1; j >= 0; j-- ){
        let cb = callbacks[ j ];

        cb();
      }

      callbacks.splice( 0, callbacks.length );
    };

    // step and remove if done
    for( let i = current.length - 1; i >= 0; i-- ){
      let ani = current[ i ];
      let ani_p = ani._private;

      if( ani_p.stopped ){
        current.splice( i, 1 );

        ani_p.hooked = false;
        ani_p.playing = false;
        ani_p.started = false;

        callbacks( ani_p.frames );

        continue;
      }

      if( !ani_p.playing && !ani_p.applying ){ continue; }

      // an apply() while playing shouldn't do anything
      if( ani_p.playing && ani_p.applying ){
        ani_p.applying = false;
      }

      if( !ani_p.started ){
        startAnimation( ele as unknown as StepTarget, ani, now, !!isCore );
      }

      step( ele as unknown as StepTarget, ani, now, !!isCore );

      if( ani_p.applying ){
        ani_p.applying = false;
      }

      callbacks( ani_p.frames );

      if( ani_p.step != null ){
        ani_p.step(now);
      }

      if( ani.completed() ){
        current.splice( i, 1 );

        ani_p.hooked = false;
        ani_p.playing = false;
        ani_p.started = false;

        callbacks( ani_p.completes );
      }

      ranAnis = true;
    }

    if( !isCore && current.length === 0 && queue.length === 0 ){
      doneEles.push( ele );
    }

    return ranAnis;
  } // stepElement

  // handle all eles
  let ranEleAni = false;
  for( let e = 0; e < eles.length; e++ ){
    let ele = eles[ e ] as unknown as StepEle;
    let handledThisEle = stepOne( ele );

    ranEleAni = ranEleAni || handledThisEle;
  } // each element

  let ranCoreAni = stepOne( cy as unknown as StepEle, true );

  // notify renderer
  if( ranEleAni || ranCoreAni ){
    if( eles.length > 0 ){
      cy.notify('draw', eles);
    } else {
      cy.notify('draw');
    }
  }

  // remove elements from list of currently animating if its queues are empty
  eles.unmerge( doneEles as unknown as Parameters<typeof eles.unmerge>[0] );

  cy.emit('step');

} // stepAll

export default stepAll;
