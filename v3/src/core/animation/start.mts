import type Animation from '../../animation.mjs';
import type { StepTarget, StepAnimationPrivate } from './step.mjs';

function startAnimation( self: StepTarget, ani: Animation, now: number, _isCore: boolean ){
  let ani_p = ani._private as unknown as StepAnimationPrivate;

  ani_p.started = true;
  ani_p.startTime = now - ani_p.progress * ( ani_p.duration as number );
}

export default startAnimation;
