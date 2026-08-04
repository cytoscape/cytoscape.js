/* eslint-disable no-console, no-unused-vars */
/* global $ */

// The selection section (round 43.5).
//
// v3's page selects with a selector string (`cy.elements(':selected')`,
// `filter.js`).  v4 has no selector language at all — the replacement is a
// structured **query object** compiled to the matcher IR, so that is what this
// panel takes.  Showing it here is half the point: it is the single most
// visible difference for anyone porting an app, and a query that reaches the
// core as a string throws with the replacement named (round 29.3).

(function(){

  const runQuery = () => {
    const cy = window.cy;

    if(cy == null) { return; }

    const text = $('#query-input').value.trim();
    const out = $('#query-result');

    if(text === '') {
      cy.elements().unselect();
      out.textContent = 'cleared';

      return;
    }

    let query;

    try {
      // a bare object literal, so the box takes `{ selected: true }` rather
      // than requiring the JSON quoting of `{"selected":true}`
      query = ( new Function( 'return (' + text + ');' ) )();
    } catch(err) {
      out.textContent = 'not valid JS: ' + err.message;

      return;
    }

    try {
      const matched = cy.elements(query);

      cy.elements().unselect();
      matched.select();
      out.textContent = `${matched.length} selected`;
    } catch(err) {
      // v4 fails loudly on an unknown query key, which is the behaviour worth
      // seeing here rather than hiding
      out.textContent = String(err.message || err);
    }
  };

  $('#query-button').addEventListener('click', runQuery);
  $('#query-input').addEventListener('keydown', e => {
    if(e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      runQuery();
    }
  });

  const on = ( sel, fn ) => {
    const el = $(sel);

    if(el != null) { el.addEventListener('click', () => { if(window.cy != null) { fn(window.cy); } }); }
  };

  on('#select-all-button', cy => cy.elements().select());
  on('#select-none-button', cy => cy.elements().unselect());
  on('#select-invert-button', cy => {
    const selected = cy.elements({ selected: true });
    const rest = cy.elements().not(selected);

    selected.unselect();
    rest.select();
  });

  // the example queries, as buttons — each is a working recipe
  const examples = {
    '#query-nodes': '{ group: \'nodes\' }',
    '#query-parents': '{ parent: true }',
    '#query-selected': '{ selected: true }'
  };

  for(const [ sel, text ] of Object.entries(examples)) {
    const el = $(sel);

    if(el != null) {
      el.addEventListener('click', () => {
        $('#query-input').value = text;
        runQuery();
      });
    }
  }

})();
