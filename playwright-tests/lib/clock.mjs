/*
Pin the page's animation clock.  Animations read performance.now()
(src/animation/manager.mts), so with it held a tween stands still at the
instant the spec chooses, and advancing it lands exactly mid-flight or
at the end — no wall-clock waits, and no window for a loaded machine to
step over.  It holds only performance.now(): rAF still runs, frames
still draw, and timers (setTimeout debounces) still run on real time.

On the shared page (shared-page.mjs) the next spec's reset puts
performance.now back; `window.__clock.release()` does it sooner.
*/

/** Hold performance.now() at its current value until advanced. */
export const pinClock = (page) =>
  page.evaluate(() => {
    let at = performance.now();

    performance.now = () => at;
    window.__clock = {
      advance: (ms) => {
        at += ms;
      },
      release: () => {
        delete performance.now;
      },
    };
  });

/**
 * Move the pinned clock on, between frames: two before, so an animation
 * just played has taken its start time (its first step reads the clock),
 * and two after, so the animations have stepped to the new instant.
 */
export const advanceClock = (page, ms) =>
  page.evaluate(async (ms) => {
    const frame = () => new Promise((r) => requestAnimationFrame(r));

    await frame();
    await frame();
    window.__clock.advance(ms);
    await frame();
    await frame();
  }, ms);
