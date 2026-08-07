/* eslint-disable no-console, no-unused-vars */
/* global $, $$ */

// The viewport section (round 43.5), carried over from v3/debug/view.js and
// extended: v3's page has no zoom, no panBy and no animated viewport moves at
// all, and its six-way bounding-box split does not exist in v4 (whose
// `renderedBoundingBox` takes only `{ includeLabels }`).

(function () {
  const on = (sel, fn) => {
    const el = $(sel);

    if (el != null) {
      el.addEventListener('click', () => {
        if (window.cy != null) {
          fn(window.cy);
        }
      });
    }
  };

  /** The current selection, or everything when nothing is selected. */
  const scope = (cy) => {
    const sel = cy.elements({ selected: true });

    return sel.length > 0 ? sel : cy.elements();
  };

  // -- viewport --

  on('#fit-button', (cy) => cy.fit(undefined, 30));
  on('#fit-selected-button', (cy) => cy.fit(scope(cy), 30));
  on('#center-selected-button', (cy) => cy.center(scope(cy)));
  on('#reset-view-button', (cy) => cy.reset());

  on('#zoom-in-button', (cy) =>
    cy.zoom({ level: cy.zoom() * 1.25, renderedPosition: centre(cy) }),
  );
  on('#zoom-out-button', (cy) =>
    cy.zoom({ level: cy.zoom() / 1.25, renderedPosition: centre(cy) }),
  );

  on('#pan-left-button', (cy) => cy.panBy({ x: 100, y: 0 }));
  on('#pan-right-button', (cy) => cy.panBy({ x: -100, y: 0 }));

  // animated viewport targets (round 10 / 28.2) — v3's page never demos these
  on('#animate-fit-button', (cy) =>
    cy.animate({ fit: { eles: scope(cy), padding: 30 } }, { duration: 600 }),
  );
  on('#animate-center-button', (cy) =>
    cy.animate({ center: { eles: scope(cy) } }, { duration: 600 }),
  );
  on('#animate-panby-button', (cy) =>
    cy.animate({ panBy: { x: 150, y: 0 } }, { duration: 600 }),
  );

  const centre = (cy) => ({ x: cy.width() / 2, y: cy.height() / 2 });

  // -- mount / unmount --

  on('#unmount-button', (cy) => cy.unmount());
  on('#mount-button', (cy) => cy.mount($('#cytoscape')));

  // -- the rendered bounding-box overlay (v3/debug/view.js:93-175) --

  const showBB = (cy, opts) => {
    const bb = scope(cy).renderedBoundingBox(opts);
    const el = $('#bb');

    el.style.left = bb.x1 + 'px';
    el.style.top = bb.y1 + 'px';
    el.style.width = bb.x2 - bb.x1 + 'px';
    el.style.height = bb.y2 - bb.y1 + 'px';
    el.style.display = 'block';
  };

  on('#show-bb-button', (cy) => showBB(cy, { includeLabels: true }));
  on('#show-bb-body-button', (cy) => showBB(cy, { includeLabels: false }));
  on('#hide-bb-button', () => {
    $('#bb').style.display = 'none';
  });
})();
