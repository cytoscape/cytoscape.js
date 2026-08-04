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

  function append( type, target ) {
    if(paused) { return; }

    const el = log();
    const row = document.createElement('div');
    const id = target != null && typeof target.id === 'function' ? target.id() : 'core';

    row.className = 'event-row';
    row.textContent = `${String(++count).padStart(4, ' ')}  ${type}  ${id}`;
    el.appendChild(row);

    while(el.childElementCount > MAX_ROWS) { el.removeChild(el.firstChild); }

    el.scrollTop = el.scrollHeight;
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
    log().textContent = '';
    count = 0;
  });

  $('#event-pause-button').addEventListener('click', () => {
    paused = !paused;
    $('#event-pause-button').textContent = paused ? 'Resume' : 'Pause';
  });

})();
