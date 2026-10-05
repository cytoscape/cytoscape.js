## Details

This function proxies to the renderer's box-selection logic, so the result matches what the user would select by dragging a selection box over the same area: it obeys each element's `box-selection` style (`'contain'` or `'overlap'`) and, for labels, `box-select-labels`.

Only interactive elements are considered (i.e. `events: yes`, `visibility: visible`, and taking up space) — an element with `box-selection: none` or that is otherwise non-interactive is never returned.
