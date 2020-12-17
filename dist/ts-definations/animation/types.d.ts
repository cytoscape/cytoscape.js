declare class ani {
}

declare namespace ani {
    /**
     * Requests that the animation be played, starting on the next frame. If the animation is complete, it restarts from the beginning.
     */
    namespace play { }
    /**
     * Get whether the animation is currently playing.
     */
    namespace playing { }
    /**
     * Apply the animation at its current progress.
     */
    namespace apply { }
    /**
     * Get whether the animation is currently applying.
     */
    namespace applying { }
    /**
     * Pause the animation, maintaining the current progress.
     */
    namespace pause { }
    /**
     * Stop the animation, maintaining the current progress and removing the animation from any associated queues.
     */
    namespace stop { }
    /**
     * Get or set how far along the animation has progressed.
     */
    namespace progress { }
    /**
     * Get whether the animation has progressed to the end.
     */
    namespace completed { }
    /**
     * Reverse the animation such that its starting conditions and ending conditions are reversed.
     */
    namespace reverse { }
    /**
     * Get a promise that is fulfilled with the specified animation event.
     */
    namespace promise { }
}

/**
 * @property progress - The progress in percent (i.e. between 0 and 1 inclusive) to set to the animation.
 * @property time - The progress in milliseconds (i.e. between 0 and the duration inclusive) to set to the animation.
 */
declare type ani_progress = {
    NULL: any;
    progress: any;
    NULL: any;
    time: any;
    NULL: any;
    NULL: any;
};

/**
 * @property animationEvent - A string for the event name; `completed` or `complete` for completing the animation or `frame` for the next frame of the animation.
 */
declare type ani_promise = {
    NULL: any;
    animationEvent: any;
};

