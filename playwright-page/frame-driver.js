/*
 * Keep the compositor producing frames, for as long as the page is open.
 *
 * Chrome only issues a BeginFrame when something invalidated, and
 * `requestAnimationFrame` callbacks only run on a BeginFrame.  Let the page
 * fall idle and the next callback is late — on a real adapter by tens of
 * milliseconds, on the SwiftShader adapter CI pins by about a second.
 *
 * That is not merely slow, it changes what a spec observes.  The renderer's
 * own frame loop schedules through rAF, so an animation started while the
 * page is idle does not begin for that whole second: measured on the
 * software adapter, a 1500 ms linear position tween had run *zero* frames
 * 800 ms after `animate()` returned, and had not moved a pixel until
 * ~1.2 s.  Two specs that sample a tween mid-flight failed deterministically
 * because of it, and several more were intermittent (round 52).
 *
 * So give the page a frame source of its own: a 1 px element whose opacity
 * alternates every callback, which is enough invalidation to keep the
 * BeginFrames coming.  It sits at `z-index: -1`, painting *behind* the
 * opaque, full-viewport container the specs read pixels out of, so it can
 * change no pixel any spec samples — verified against a screenshot taken
 * before the driver existed.
 *
 * It does not make Cytoscape redraw: it invalidates a DOM element, not the
 * canvas, so `stats().frameCount` and the renderer's own scheduling still
 * reflect only real work.
 */
(function () {
  var probe = document.createElement('div');

  probe.id = '__frameProbe';
  probe.style.cssText =
    'position:fixed;right:0;bottom:0;width:1px;height:1px;' +
    'background:white;pointer-events:none;z-index:-1';

  document.body.appendChild(probe);

  var i = 0;

  (function tick() {
    probe.style.opacity = i++ % 2 ? '1' : '0.996';

    requestAnimationFrame(tick);
  })();
})();
