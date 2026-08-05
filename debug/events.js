/* eslint-disable no-console, no-unused-vars */
/* global $, $$ */

// The events section (round 43.5).
//
// v3's page has no log: firing an event pops a 3-second toast (notify.js) that
// the next event overwrites, so you can never see a *sequence* — which is the
// only interesting thing about the drag or tap families.  This is an
// append-only, filterable log instead.
//
// It also does not offer a selector box.  v4's delegation takes a **predicate
// function**, not a selector string, and passing a string throws naming the
// replacement (round 29.3) — so the panel demonstrates the predicate form
// rather than an input that could only ever fail.

(function(){

  // The curated vocabulary (round 17), grouped the way you actually want to
  // filter it.  Names v4 never emits are deliberately absent: registering one
  // is legal and silently never fires (round 37.4), which is a good thing to
  // know and a bad thing to put in a log filter.
  const FAMILIES = {
    pointer: [ 'pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerover', 'pointerout' ],
    tap: [ 'tapstart', 'tapdrag', 'tapend', 'tap', 'taphold', 'onetap', 'dbltap',
      'tapselect', 'tapunselect', 'tapdragover', 'tapdragout',
      'cxttapstart', 'cxttapend', 'cxttap', 'cxtdrag', 'cxtdragover', 'cxtdragout' ],
    drag: [ 'grab', 'grabon', 'drag', 'free', 'freeon', 'dragfree', 'dragfreeon', 'position' ],
    viewport: [ 'zoom', 'pan', 'viewport', 'fit', 'dragpan', 'scrollzoom', 'pinchzoom', 'resize' ],
    selection: [ 'select', 'unselect', 'box', 'boxstart', 'boxend', 'boxselect', 'lock', 'unlock' ],
    graph: [ 'add', 'remove', 'data', 'move' ],
    style: [ 'style' ],
    layout: [ 'layoutstart', 'layoutready', 'layoutstop' ],
    mouse: [ 'mouseover', 'mouseout' ]
  };

  // `position` and `pointermove` fire per frame during a drag; on by default
  // they drown everything else out.
  const NOISY = new Set([ 'position', 'pointermove', 'tapdrag', 'drag', 'viewport', 'zoom', 'pan', 'dragpan' ]);

  const MAX_ROWS = 400;

  const enabled = new Set([ 'tap', 'drag', 'selection', 'graph', 'style', 'layout' ]);
  const log = () => $('#event-log');
  let paused = false;
  let count = 0;

  // Rows are buffered and written once per frame, which is not a
  // micro-optimisation: `append` used to add a row and then read
  // `el.scrollHeight` to stick the view to the bottom, and a write followed by
  // a layout read is a *forced* reflow — once per event.
  //
  // One box selection over em-web emits `box` + `boxselect` + `select` per
  // element, so 7468 selected elements meant 22406 forced layouts inside the
  // single pointerup task: measured 5659 ms of forced layout in a 6055 ms
  // handler, against 40 ms for the same gesture with this section's filter
  // off.  None of that was the library — it was the log.  Batched, the frame
  // does one read; and since only the last MAX_ROWS can ever be visible, the
  // buffer drops the rest before any DOM node is built for them.
  const pending = [];
  let flushQueued = false;

  function append( type, target ) {
    if(paused) { return; }

    const id = target != null && typeof target.id === 'function' ? target.id() : 'core';

    pending.push(`${String(++count).padStart(4, ' ')}  ${type}  ${id}`);

    if(pending.length > MAX_ROWS) { pending.splice(0, pending.length - MAX_ROWS); }

    if(!flushQueued) {
      flushQueued = true;
      requestAnimationFrame(flush);
    }
  }

  function flush() {
    flushQueued = false;

    if(pending.length === 0) { return; }

    const el = log();
    const frag = document.createDocumentFragment();

    for(const text of pending.splice(0)) {
      const row = document.createElement('div');

      row.className = 'event-row';
      row.textContent = text;
      frag.appendChild(row);
    }

    el.appendChild(frag);

    while(el.childElementCount > MAX_ROWS) { el.removeChild(el.firstChild); }

    el.scrollTop = el.scrollHeight; // the one forced layout per frame
  }

  window.onCy(cy => {
    for(const [ family, types ] of Object.entries(FAMILIES)) {
      for(const type of types) {
        // one listener per name, gated at fire time, so toggling a family costs
        // nothing and the emit path is exercised exactly as an app would
        cy.on(type, e => {
          if(!enabled.has(family)) { return; }
          if(NOISY.has(type) && !$('#event-noisy-check').checked) { return; }

          append(type, e.target);
        });
      }
    }

    // the delegated form, to show what replaced selector strings: a predicate
    cy.on('tap', ele => ele.isNode(), e => {
      if(enabled.has('tap')) { append('tap (predicate: isNode)', e.target); }
    });
  });

  // -- filter checkboxes ----------------------------------------------------

  for(const family of Object.keys(FAMILIES)) {
    const el = $('#event-' + family + '-check');

    if(el == null) { continue; }

    el.checked = enabled.has(family);
    el.addEventListener('change', () => {
      if(el.checked) { enabled.add(family); } else { enabled.delete(family); }
    });
  }

  $('#event-clear-button').addEventListener('click', () => {
    pending.length = 0; // else the next frame writes what you just cleared
    log().textContent = '';
    count = 0;
  });

  $('#event-pause-button').addEventListener('click', () => {
    paused = !paused;
    $('#event-pause-button').textContent = paused ? 'Resume' : 'Pause';
  });

})();
