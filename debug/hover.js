/* eslint-disable no-console */
/* global $, layoutConfig */

// The hover section (round 114.7; round 102's API since): emphasize the
// hovered node's closed neighbourhood and dim or hide everything else —
// the gesture every flagship app implements.
//
// Three spellings, side by side, each timed in the console per hover
// change ('hover apply' / 'hover restore'):
//
// - **Emphasize** — `cy.emphasize( node.closedNeighborhood() )` and
//   `cy.unemphasize()`, round 102's core API.  The set is a flag bit and
//   the dim is the renderer's two-tier composite, so a change costs
//   O(neighbourhood) at any graph size; this is the one to hover on
//   ndex-x-large.
// - **Dim** / **Hide** — "the app spelling" before it: a per-element
//   opacity bypass or `hide()` over everything *outside* the
//   neighbourhood, restored on leave.  O(graph) per hover change (round
//   102 measured 2.9 s and 160 ms on ndex-x-large), so both are off above
//   layoutConfig.HOVER_MAX_ELEMENTS.  Kept as the comparison.
//
// It is on the page for judging a layout's edges too: with the rest
// dimmed, what a node connects to and how the edges route is all that
// is left to see.

(function () {
  const select = $('#hover-select');
  let rest = null; // the collection last dimmed or hidden
  let mode = null; // how the current emphasis was applied

  const restore = (cy) => {
    if (mode == null) {
      return;
    }

    console.time('hover restore');

    if (mode === 'emphasize') {
      cy.unemphasize();
    } else if (mode === 'hide') {
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

    if (
      wanted === 'none' ||
      !layoutConfig.hoverAllowed(cy.elements().length, wanted)
    ) {
      return;
    }

    console.time('hover apply');

    const keep = node.closedNeighborhood();

    mode = wanted;

    if (mode === 'emphasize') {
      cy.emphasize(keep);
    } else {
      rest = cy.elements().not(keep);

      if (mode === 'hide') {
        rest.hide();
      } else {
        cy.batch(() => rest.style({ opacity: 0.15 }));
      }
    }

    console.timeEnd('hover apply');
  };

  const noteFor = (cy) => {
    const big = !layoutConfig.hoverAllowed(cy.elements().length, 'dim');

    $('#hover-note').textContent = big
      ? 'dim and hide are off above ' +
        layoutConfig.HOVER_MAX_ELEMENTS +
        ' elements'
      : '';

    for (const option of select.options) {
      option.disabled =
        !layoutConfig.hoverAllowed(cy.elements().length, option.value) &&
        option.value !== 'none';
    }
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

    noteFor(cy);

    // switching to none while something is emphasized clears it
    select.addEventListener('change', () => {
      if (select.value === 'none') {
        restore(cy);
      }
    });
  });
})();
