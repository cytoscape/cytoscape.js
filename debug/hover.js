/* eslint-disable no-console */
/* global $, layoutConfig */

// The hover section (round 114.7): emphasize the hovered node's closed
// neighbourhood by dimming or hiding everything else — the gesture every
// flagship app implements, and the one round 102 measured the cost of.
//
// This is "the app spelling today" from that round: v4 has no classes,
// so the outside set takes a per-element opacity bypass (dim) or hide()
// on every hover change and is restored on leave.  The console timings
// around apply and restore are the measurement; the select turns itself
// off above layoutConfig.HOVER_MAX_ELEMENTS.  It is on the page for
// judging a layout's edges: with the rest dimmed, what a node connects
// to and how the edges route is all that is left to see.

(function () {
  const select = $('#hover-select');
  let rest = null; // the collection last dimmed or hidden
  let mode = null; // how it was dimmed or hidden

  const restore = (cy) => {
    if (rest == null) {
      return;
    }

    console.time('hover restore');

    if (mode === 'hide') {
      rest.show();
    } else {
      cy.batch(() => rest.removeStyle('opacity'));
    }

    console.timeEnd('hover restore');
    rest = null;
    mode = null;
  };

  const apply = (cy, node) => {
    const wanted = select.value;

    // over can precede out: clear the previous emphasis first
    restore(cy);

    if (wanted === 'none' || !layoutConfig.hoverAllowed(cy.elements().length)) {
      return;
    }

    console.time('hover apply');

    const keep = node.closedNeighborhood();

    rest = cy.elements().not(keep);
    mode = wanted;

    if (mode === 'hide') {
      rest.hide();
    } else {
      cy.batch(() => rest.style({ opacity: 0.15 }));
    }

    console.timeEnd('hover apply');
  };

  window.onCy((cy) => {
    // the predicate form: v4 delegation takes a function, not a selector
    cy.on(
      'mouseover',
      (ele) => ele.isNode(),
      (e) => apply(cy, e.target),
    );
    cy.on(
      'mouseout',
      (ele) => ele.isNode(),
      () => restore(cy),
    );

    if (!layoutConfig.hoverAllowed(cy.elements().length)) {
      select.disabled = true;
      $('#hover-note').textContent =
        'off above ' + layoutConfig.HOVER_MAX_ELEMENTS + ' elements';
    }

    // switching to none while something is emphasized clears it
    select.addEventListener('change', () => {
      if (select.value === 'none') {
        restore(cy);
      }
    });
  });
})();
