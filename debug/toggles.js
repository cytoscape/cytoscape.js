/* eslint-disable no-console, no-unused-vars */
/* global $, $$ */

// Two sections (round 43.5):
//
//   * "Toggles on selected" — v3/debug/toggles.js's whole mechanism is one
//     generic dispatch on the button's own text, which is a good trick and
//     carries over unchanged.  Extended with select/unselect/show/hide/remove.
//   * "Core toggles" — v3 keeps these in its View section.  Carried over, plus
//     the ones v3's page never had: box selection, selection type, the zoom
//     range, wheel sensitivity, and the two v4-only box-selection knobs.

(function () {
  // -- toggles on the current selection ------------------------------------

  $$('button.toggler').forEach((el) => {
    el.addEventListener('click', () => {
      const cy = window.cy;

      if (cy == null) {
        return;
      }

      const name = el.textContent.trim();
      const eles = cy.elements({ selected: true });

      if (eles.length === 0) {
        console.warn(`nothing selected — ${name}() would do nothing`);

        return;
      }

      eles[name]();
      console.log(`${name}() on ${eles.length} elements`);
    });
  });

  // -- core toggles ---------------------------------------------------------

  // A checkbox whose state is a core getter/setter of the same shape.
  const boolControl = (sel, get, set) => {
    const el = $(sel);

    if (el == null) {
      return;
    }

    window.onCy((cy) => {
      el.checked = get(cy);
    });

    el.addEventListener('change', () => {
      const cy = window.cy;

      if (cy != null) {
        set(cy, el.checked);
      }
    });
  };

  boolControl(
    '#panning-check',
    (cy) => cy.panningEnabled(),
    (cy, v) => cy.panningEnabled(v),
  );
  boolControl(
    '#user-panning-check',
    (cy) => cy.userPanningEnabled(),
    (cy, v) => cy.userPanningEnabled(v),
  );
  boolControl(
    '#zooming-check',
    (cy) => cy.zoomingEnabled(),
    (cy, v) => cy.zoomingEnabled(v),
  );
  boolControl(
    '#user-zooming-check',
    (cy) => cy.userZoomingEnabled(),
    (cy, v) => cy.userZoomingEnabled(v),
  );
  boolControl(
    '#box-selection-check',
    (cy) => cy.boxSelectionEnabled(),
    (cy, v) => cy.boxSelectionEnabled(v),
  );
  boolControl(
    '#autolock-check',
    (cy) => cy.autolock(),
    (cy, v) => cy.autolock(v),
  );
  boolControl(
    '#autoungrabify-check',
    (cy) => cy.autoungrabify(),
    (cy, v) => cy.autoungrabify(v),
  );
  boolControl(
    '#autounselectify-check',
    (cy) => cy.autounselectify(),
    (cy, v) => cy.autounselectify(v),
  );
  // round 16.5 / 39.1: both v4 inventions, so v3's page has no equivalent
  boolControl(
    '#box-labels-check',
    (cy) => cy.boxSelectionIncludesLabels(),
    (cy, v) => cy.boxSelectionIncludesLabels(v),
  );

  const selectControl = (sel, get, set) => {
    const el = $(sel);

    if (el == null) {
      return;
    }

    window.onCy((cy) => {
      el.value = String(get(cy));
    });

    el.addEventListener('change', () => {
      const cy = window.cy;

      if (cy != null) {
        set(cy, el.value);
      }
    });
  };

  selectControl(
    '#selection-type-select',
    (cy) => cy.selectionType(),
    (cy, v) => cy.selectionType(v),
  );
  selectControl(
    '#box-mode-select',
    (cy) => cy.boxSelectionMode(),
    (cy, v) => cy.boxSelectionMode(v),
  );

  const numberControl = (sel, get, set) => {
    const el = $(sel);

    if (el == null) {
      return;
    }

    window.onCy((cy) => {
      el.value = String(get(cy));
    });

    el.addEventListener('change', () => {
      const cy = window.cy;

      if (cy != null) {
        set(cy, parseFloat(el.value));
      }
    });
  };

  numberControl(
    '#wheel-sensitivity-input',
    (cy) => cy.wheelSensitivity(),
    (cy, v) => cy.wheelSensitivity(v),
  );

  // `zoomRange` is setter-only (it returns the core, for chaining); the two
  // halves read back through minZoom()/maxZoom()
  window.onCy((cy) => {
    $('#min-zoom-input').value = String(cy.minZoom());
    $('#max-zoom-input').value = String(cy.maxZoom());
  });

  $('#zoom-range-button').addEventListener('click', () => {
    const cy = window.cy;

    if (cy == null) {
      return;
    }

    cy.zoomRange({
      min: parseFloat($('#min-zoom-input').value),
      max: parseFloat($('#max-zoom-input').value),
    });
    console.log('zoomRange now', cy.minZoom(), '..', cy.maxZoom());
  });
})();
