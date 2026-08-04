/* eslint-disable no-console, no-unused-vars */
/* global $ */

// Add / remove (round 43.5), carried over from v3/debug/add-remove.js with its
// `ms` timing readout — which on a 465k-edge fixture is the point: adding to a
// loaded graph goes through the incremental path, not the bulk one.

(function(){

  let seq = 0;

  const time = ( label, fn ) => {
    const t0 = performance.now();
    const out = fn();
    const ms = performance.now() - t0;

    $('#add-remove-time').textContent = `${label}: ${ms.toFixed(1)} ms`;
    console.log(`${label}: ${ms.toFixed(1)} ms`);

    return out;
  };

  $('#add-elements-button').addEventListener('click', () => {
    const cy = window.cy;

    if(cy == null) { return; }

    const n = parseInt($('#nodes-number').value || '10', 10);
    const m = parseInt($('#edges-number').value || '10', 10);
    const extent = cy.extent();
    const rand = ( lo, hi ) => lo + Math.random() * ( hi - lo );
    const ids = [];
    const defs = [];

    for(let i = 0; i < n; i++) {
      const id = 'added' + ( seq++ );

      ids.push(id);
      defs.push({ data: { id, band: i % 5 }, position: { x: rand(extent.x1, extent.x2), y: rand(extent.y1, extent.y2) } });
    }

    // edges source from the new nodes; with none added, fall back to the graph
    const pool = ids.length > 0 ? ids : cy.nodes().map(n2 => n2.id());

    if(pool.length === 0) {
      console.warn('no nodes to connect');
    } else {
      for(let j = 0; j < m; j++) {
        defs.push({ data: {
          id: 'addede' + ( seq++ ),
          source: pool[ Math.floor(Math.random() * pool.length) ],
          target: pool[ Math.floor(Math.random() * pool.length) ]
        } });
      }
    }

    time(`add ${n} nodes + ${m} edges`, () => cy.add(defs));
  });

  $('#remove-selected-button').addEventListener('click', () => {
    const cy = window.cy;

    if(cy == null) { return; }

    const eles = cy.elements({ selected: true });

    time(`remove ${eles.length} elements`, () => eles.remove());
  });

  // round 19: the explicit form of the automatic slot-compaction trigger.
  // Worth a button next to remove, because that is when it matters.
  $('#compact-button').addEventListener('click', () => {
    const cy = window.cy;

    if(cy == null) { return; }

    time('compact()', () => cy.compact());
  });

})();
