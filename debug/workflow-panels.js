/* featureWorkflowPanels workflow panels for the debug network. */
/* global cytoscape */
(function (root) {
  'use strict';

  const {
    clear,
    node,
    button,
    select,
    field,
    output,
    panel,
    param,
    numericParam,
    saveParams,
    table,
    ids,
    copy,
  } = root.featureWorkflowUI;

  function mountLayoutCallbacks({ cy, container, params }) {
    const document = panel(
      container,
      'Layout callback recipes',
      'Run a real built-in layout with a transform callback and ready/stop callbacks. The trace records library events and callback invocations, while the readout shows callback counts and the resulting graph bounds.',
    );
    const name = select(
      document,
      [
        ['grid', 'Grid'],
        ['circle', 'Circle'],
        ['breadthfirst', 'Breadthfirst'],
      ],
      param(params, 'workflowLayout', 'grid', [
        'grid',
        'circle',
        'breadthfirst',
      ]),
    );
    const shift = node(document, 'input', {
      type: 'number',
      min: -100,
      max: 100,
      step: 5,
      value: numericParam(params, 'workflowLayoutShift', 20, -100, 100),
    });
    const status = output(document, 'Ready.');
    const traceOutput = output(document, 'No callback recipe has run.');
    const trace = [];
    let activeLayout = null;
    let layoutHandler = null;
    let disposed = false;
    const saveLayoutInputs = () =>
      saveParams({
        workflowLayout: name.value,
        workflowLayoutShift: shift.value,
      });
    const run = async () => {
      if (activeLayout != null || disposed) return;
      saveLayoutInputs();
      trace.length = 0;
      const calls = { transform: 0, ready: 0, stop: 0 };
      const delta = Math.max(-100, Math.min(100, Number(shift.value) || 0));
      const note = (entry) => trace.push(entry);
      layoutHandler = (event) => note(event.type);
      cy.on('layoutstart layoutready layoutstop', layoutHandler);
      const options = {
        name: name.value,
        animate: false,
        fit: false,
        transform(nodeRef, position) {
          calls.transform++;
          return { x: position.x + delta, y: position.y };
        },
        ready() {
          calls.ready++;
          note('ready callback');
        },
        stop() {
          calls.stop++;
          note('stop callback');
        },
      };
      traceOutput.textContent = `cy.layout(${JSON.stringify({ ...options, transform: '[function]', ready: '[function]', stop: '[function]' })}).run()`;

      try {
        activeLayout = cy.layout(options);
        const layoutStopped = new Promise((resolve) =>
          cy.one('layoutstop', resolve),
        );
        activeLayout.run();
        status.textContent = `Running ${name.value} callback recipe…`;
        await layoutStopped;
        if (disposed) return;
        const bounds = cy.nodes().boundingBox({ includeLabels: false });
        note(`transform calls: ${calls.transform}`);
        traceOutput.textContent = `${traceOutput.textContent}\n${trace.join(' → ')}\ncallbacks: ${JSON.stringify(calls)}\nbounds: ${JSON.stringify(bounds)}`;
        status.textContent =
          calls.ready === 1 && calls.stop === 1 && calls.transform > 0
            ? `${name.value} completed; ready and stop each fired once.`
            : `Callback contract mismatch: ${JSON.stringify(calls)}.`;
      } catch (error) {
        if (!disposed)
          status.textContent = `Layout callback error: ${error?.message || error}`;
      } finally {
        if (layoutHandler != null)
          cy.off('layoutstart layoutready layoutstop', layoutHandler);
        layoutHandler = null;
        activeLayout = null;
      }
    };
    name.addEventListener('change', saveLayoutInputs);
    shift.addEventListener('change', saveLayoutInputs);
    container.append(
      node(document, 'div', { className: 'feature-workflow-controls' }, [
        field(document, 'Built-in layout', name),
        field(document, 'Transform x shift (model px)', shift),
        button(document, 'Run transform / ready / stop recipe', run),
      ]),
      status,
      traceOutput,
    );

    return () => {
      disposed = true;
      if (activeLayout != null) activeLayout.stop();
      if (layoutHandler != null)
        cy.off('layoutstart layoutready layoutstop', layoutHandler);
      name.removeEventListener('change', saveLayoutInputs);
      shift.removeEventListener('change', saveLayoutInputs);
    };
  }

  function mountInspector({ cy, container, params }) {
    const document = panel(
      container,
      'Query, selection, topology, and inspector',
      'Enter a structured query object. Recipes compile through cy.elements(query); selecting a result changes actual selection state. Inspect an element to read its data, flags, geometry, parent chain, and one-hop topology.',
    );
    const query = node(document, 'textarea', {
      rows: 3,
      value: param(
        params,
        'workflowQuery',
        '{"group":"nodes","data":{"score":{"gt":1}}}',
      ),
      'aria-label': 'Structured query JSON',
    });
    const status = output(document, 'Ready.');
    const inspectSelect = select(
      document,
      ids(cy.elements()).map((id) => [id, id]),
      param(params, 'workflowInspect', 'a', ids(cy.elements())),
    );
    const inspection = node(document, 'pre', {
      className: 'feature-workflow-output',
    });
    const recipes = [
      ['parent nodes', { group: 'nodes', parent: true }],
      ['child nodes', { group: 'nodes', child: true }],
      ['selected elements', { selected: true }],
      ['score > 1', { group: 'nodes', data: { score: { gt: 1 } } }],
      ['weight ≥ 2', { group: 'edges', data: { weight: { gte: 2 } } }],
    ];
    const runQuery = () => {
      try {
        saveParams({ workflowQuery: query.value });
        const value = JSON.parse(query.value);
        const matches = cy.elements(value);

        cy.elements().unselect();
        matches.select();
        cy.emphasize(matches);
        status.textContent = `${matches.length} match(es): ${ids(matches).join(', ') || 'none'}`;
      } catch (error) {
        status.textContent = `Query error: ${error?.message || error}`;
      }
    };
    const saveInspect = () =>
      saveParams({ workflowInspect: inspectSelect.value });
    const inspectChanged = () => {
      saveInspect();
      refresh();
    };
    const refresh = () => {
      const target = cy.getElementById(inspectSelect.value);

      if (!target.length) {
        inspection.textContent = 'Element is no longer present.';
        return;
      }

      const parents = target.isNode()
        ? target.ancestors().nodes()
        : cy.collection();
      const neighbourhood = target.isNode()
        ? target.neighborhood()
        : target.source().union(target.target());
      const details = {
        id: target.id(),
        group: target.group(),
        data: target.data(),
        position: target.isNode() ? target.position() : undefined,
        selected: target.selected(),
        locked: target.isNode() ? target.locked() : undefined,
        grabbable: target.isNode() ? target.grabbable() : undefined,
        parent: target.isNode() ? ids(target.parent()) : undefined,
        ancestors: ids(parents),
        neighboursAndEdges: ids(neighbourhood),
        connectedEdges: target.isNode()
          ? ids(target.connectedEdges())
          : undefined,
        boundingBox: target.boundingBox({ includeLabels: true }),
      };

      inspection.textContent = JSON.stringify(details, null, 2);
      cy.emphasize(target.union(neighbourhood));
    };

    const recipeButtons = recipes.map(([label, value]) =>
      button(document, label, () => {
        query.value = JSON.stringify(value);
        runQuery();
      }),
    );

    inspectSelect.addEventListener('change', inspectChanged);
    container.append(
      node(document, 'div', { className: 'feature-workflow-controls' }, [
        field(document, 'Query object', query),
        button(document, 'Run query and select matches', runQuery),
        button(document, 'Clear selection and emphasis', () => {
          cy.elements().unselect();
          cy.unemphasize();
          status.textContent = 'Selection cleared.';
        }),
        ...recipeButtons,
        field(document, 'Inspect element', inspectSelect),
        button(document, 'Refresh inspection', refresh),
      ]),
      status,
      inspection,
    );
    refresh();

    return () => {
      inspectSelect.removeEventListener('change', inspectChanged);
      cy.elements().unselect();
      cy.unemphasize();
    };
  }

  function mountMutation({ cy, container }) {
    const document = panel(
      container,
      'Deterministic updates, persistence, and clone following',
      'The patch, reparent, batch, serialize/load, clone-follow, and progressive-load controls mutate the live instance. Restore returns positions, style, viewport, selection and interaction flags to their captured authored state.',
    );
    const baseline = copy(cy.json());
    const baselineElements = copy(baseline.elements);
    const status = output(document, 'Ready.');
    const streamStatus = output(document, 'Progressive load idle.');
    const tempInstances = new Set();
    let follower = null;
    let loadRun = null;
    let chunkHandler = null;
    let chunkTimer = null;
    let resolveChunkWait = null;
    let cloneHandler = null;
    let cloneTimer = null;
    let resolveCloneWait = null;
    let mutationToken = 0;
    let loadToken = 0;
    let serializeBusy = false;
    let cloneBusy = false;
    let restoreBusy = false;
    let serializeButton = null;
    let cloneButton = null;
    let restoreButton = null;
    let disposed = false;
    let reparented = false;

    const restoreFlags = (element, saved) => {
      if (element.isNode()) {
        if (saved.locked) element.lock();
        else element.unlock();
        if (saved.grabbable === false) element.ungrabify();
        else element.grabify();
        if (saved.pannable) element.panify();
        else element.unpanify();
      }
      if (saved.selectable === false) element.unselectify();
      else element.selectify();
      if (saved.selected) element.select();
      else element.unselect();
    };
    const stopProgressiveLoad = async () => {
      const activeLoad = loadRun;

      if (activeLoad == null) return false;
      loadToken++;
      const activeHandler = chunkHandler;
      if (activeHandler != null) cy.off('loadchunk', activeHandler);
      if (chunkHandler === activeHandler) chunkHandler = null;
      if (chunkTimer != null) clearTimeout(chunkTimer);
      chunkTimer = null;
      resolveChunkWait?.();
      resolveChunkWait = null;
      activeLoad.cancel();
      streamStatus.textContent = 'Stopping progressive load before restore…';
      await Promise.resolve(activeLoad).catch(() => {});
      if (loadRun === activeLoad) loadRun = null;

      return true;
    };
    const restore = async () => {
      if (restoreBusy || disposed) return;
      restoreBusy = true;
      if (restoreButton != null) restoreButton.disabled = true;
      const token = ++mutationToken;

      try {
        const stoppedLoad = await stopProgressiveLoad();
        if (disposed || token !== mutationToken) return;
        const diff = cy.patch(copy(baselineElements));

        if (baseline.style != null) cy.style(copy(baseline.style));
        for (const saved of [
          ...baselineElements.nodes,
          ...baselineElements.edges,
        ]) {
          const element = cy.getElementById(saved.data.id);
          if (!element.length) continue;
          if (element.isNode() && saved.position != null)
            element.position(saved.position);
          restoreFlags(element, saved);
        }
        cy.data(copy(baseline.data));
        cy.zoom(baseline.zoom);
        cy.pan(copy(baseline.pan));
        cy.unemphasize();
        reparented = false;
        status.textContent = `Restored authored snapshot: patch added ${diff.added.length}, removed ${diff.removed.length}, updated ${diff.updated.length}; ${cy.nodes().length} nodes / ${cy.edges().length} edges; c parent=${ids(cy.getElementById('c').parent()).join(',') || 'none'}.`;
        if (stoppedLoad)
          streamStatus.textContent = `Progressive load cancelled before restore; landed stream ids were removed (${ids(cy.nodes().filter((ele) => ele.id().startsWith('stream-'))).join(', ') || 'none remain'}).`;
      } finally {
        if (!disposed) {
          restoreBusy = false;
          if (restoreButton != null) restoreButton.disabled = false;
        }
      }
    };
    const applyPatch = () => {
      mutationToken++;
      const payload = copy(baselineElements);
      const a = payload.nodes.find((element) => element.data.id === 'a');

      if (a) a.data.score = Number(a.data.score || 0) + 10;
      payload.nodes = payload.nodes.filter(
        (element) => element.data.id !== 'e',
      );
      payload.nodes.push({
        data: {
          id: 'f',
          label: 'F · patched',
          kind: 'patch',
          score: 9,
          x: 205,
          y: 20,
        },
        position: { x: 205, y: 20 },
      });
      payload.edges = payload.edges.filter(
        (element) => element.data.source !== 'e' && element.data.target !== 'e',
      );
      payload.edges.push({
        data: { id: 'df', source: 'd', target: 'f', weight: 3, kind: 'patch' },
      });

      const diff = cy.patch(payload);
      status.textContent = `Patch diff: added [${ids(diff.added).join(', ')}], removed [${ids(diff.removed).join(', ')}], updated [${ids(diff.updated).join(', ')}]. a.score=${cy.getElementById('a').data('score')}; totals ${cy.nodes().length} nodes / ${cy.edges().length} edges.`;
    };
    const reparent = () => {
      mutationToken++;
      const child = cy.getElementById('c');
      reparented = !reparented;
      child.move({ parent: reparented ? 'p' : null });
      status.textContent = `Reparented c: parent=${ids(child.parent()).join(', ') || 'none'}; x=${child.position('x')}, y=${child.position('y')}.`;
    };
    const batch = () => {
      mutationToken++;
      let starts = 0;
      let ends = 0;
      const onStart = () => starts++;
      const onEnd = () => ends++;

      cy.on('batchstart', onStart);
      cy.on('batchend', onEnd);
      try {
        cy.batch(() => {
          cy.getElementById('a').data(
            'score',
            Number(cy.getElementById('a').data('score') || 0) + 1,
          );
          cy.getElementById('b').position({
            x: cy.getElementById('b').position('x') + 6,
            y: cy.getElementById('b').position('y'),
          });
        });
      } finally {
        cy.off('batchstart', onStart);
        cy.off('batchend', onEnd);
      }
      status.textContent = `One cy.batch() applied both writes: a.score=${cy.getElementById('a').data('score')}; b.x=${cy.getElementById('b').position('x')}; batch events ${starts}/${ends}.`;
    };
    const normalize = (value) => {
      if (ArrayBuffer.isView(value)) return Array.from(value, normalize);
      if (Array.isArray(value)) return value.map(normalize);
      if (value != null && typeof value === 'object') {
        return Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, normalize(value[key])]),
        );
      }
      return value;
    };
    const serializeLoad = async () => {
      if (serializeBusy || disposed) return;
      serializeBusy = true;
      if (serializeButton != null) serializeButton.disabled = true;
      const token = ++mutationToken;
      const wire = cy.serialize();
      const restored = cytoscape({ headless: true });
      tempInstances.add(restored);

      try {
        const progress = await restored.load([wire], { fit: false });
        const original = normalize(
          cytoscape.deserializeElements(cy.serialize()),
        );
        const roundTrip = normalize(
          cytoscape.deserializeElements(restored.serialize()),
        );
        const same = JSON.stringify(original) === JSON.stringify(roundTrip);

        if (!disposed && token === mutationToken)
          status.textContent = `serialize() → load([wire]) persisted-field comparison: ${same ? 'all equal' : 'DIFFER'}. Compared every decoded node/edge column, endpoints/parents, positions, selected/selectable/collapsed/applied-scale flags, data sidecars and graph data; ${progress.nodes} nodes / ${progress.edges} edges; ${wire.byteLength} bytes.`;
      } catch (error) {
        if (!disposed && token === mutationToken)
          status.textContent = `serialize/load error: ${error?.message || error}`;
      } finally {
        restored.destroy();
        tempInstances.delete(restored);
        serializeBusy = false;
        if (!disposed && serializeButton != null)
          serializeButton.disabled = false;
      }
    };
    const followClone = async () => {
      if (cloneBusy || disposed) return;
      cloneBusy = true;
      if (cloneButton != null) cloneButton.disabled = true;
      const token = ++mutationToken;

      try {
        if (follower != null) follower.destroy();
        follower = null;
        follower = cy.clone({ headless: true, follow: { throttle: 0 } });
        const source = cy.getElementById('a');
        const before = follower.getElementById('a').data('score');
        const after = Number(before || 0) + 7;
        const clone = follower;
        const synced = new Promise((resolve, reject) => {
          cloneHandler = (event) => {
            clearTimeout(cloneTimer);
            cloneTimer = null;
            cloneHandler = null;
            resolve(event);
          };
          clone.one('patch', cloneHandler);
          cloneTimer = setTimeout(() => {
            clone.off('patch', cloneHandler);
            cloneHandler = null;
            cloneTimer = null;
            reject(
              new Error(
                'following clone did not emit its patch event within 2 seconds',
              ),
            );
          }, 2000);
          resolveCloneWait = resolve;
        });

        source.data('score', after);
        const event = await synced;
        resolveCloneWait = null;
        const applied = clone.getElementById('a').data('score');
        if (!disposed && token === mutationToken)
          status.textContent = `Following clone emitted patch: source a.score=${after}; clone applied a.score=${applied}; ${applied === after ? 'in sync' : 'DIFFER'}; patch diff updated ${ids(event.diff.updated).join(', ') || 'none'}.`;
      } catch (error) {
        if (!disposed && token === mutationToken)
          status.textContent = `Clone error: ${error?.message || error}`;
      } finally {
        clearTimeout(cloneTimer);
        cloneTimer = null;
        resolveCloneWait = null;
        cloneHandler = null;
        follower?.destroy();
        follower = null;
        cloneBusy = false;
        if (!disposed && cloneButton != null) cloneButton.disabled = false;
      }
    };
    const cancelLoad = () => {
      if (loadRun == null) {
        streamStatus.textContent = 'No progressive load is running.';
        return;
      }
      const cancelled = loadRun.cancel();
      if (chunkTimer != null) clearTimeout(chunkTimer);
      chunkTimer = null;
      resolveChunkWait?.();
      resolveChunkWait = null;
      streamStatus.textContent = `cancel() returned ${cancelled}; already-landed elements remain in the graph.`;
    };
    const progressiveLoad = () => {
      if (loadRun != null || restoreBusy || disposed) {
        streamStatus.textContent =
          'A load is already running or this panel is closing.';
        return;
      }
      mutationToken++;
      const token = ++loadToken;
      let sequence = 0;
      const waitBeforeChunk = () =>
        new Promise((resolve) => {
          resolveChunkWait = resolve;
          chunkTimer = setTimeout(() => {
            chunkTimer = null;
            resolveChunkWait = null;
            resolve();
          }, 500);
        });
      const chunks = async function* () {
        for (const id of ['stream-a', 'stream-b', 'stream-c']) {
          sequence++;
          yield {
            nodes: [
              {
                data: { id, label: id, score: sequence },
                position: { x: 150 + sequence * 25, y: -120 },
              },
            ],
          };
          await waitBeforeChunk();
        }
      };

      const currentChunkHandler = (event) => {
        if (token !== loadToken || disposed) return;
        streamStatus.textContent = `Chunk ${event.progress.chunks}: ${event.progress.nodes} nodes / ${event.progress.edges} edges. Click Cancel while the stream waits for its next chunk.`;
      };
      chunkHandler = currentChunkHandler;
      cy.on('loadchunk', currentChunkHandler);
      const currentLoad = cy.load(chunks(), { fit: false });
      loadRun = currentLoad;
      streamStatus.textContent = 'Progressive load started…';
      currentLoad
        .then(
          (progress) => {
            if (!disposed && token === loadToken)
              streamStatus.textContent = `Progressive load completed: ${JSON.stringify(progress)}.`;
          },
          (error) => {
            if (!disposed && token === loadToken)
              streamStatus.textContent = `${error?.name || 'Load error'}: ${error?.message || error}; landed ids: ${ids(cy.nodes().filter((ele) => ele.id().startsWith('stream-'))).join(', ') || 'none'}.`;
          },
        )
        .finally(() => {
          if (chunkHandler === currentChunkHandler)
            cy.off('loadchunk', currentChunkHandler);
          if (loadRun === currentLoad) loadRun = null;
          if (chunkHandler === currentChunkHandler) chunkHandler = null;
        });
    };

    serializeButton = button(
      document,
      'Compare serialize → load',
      serializeLoad,
    );
    cloneButton = button(
      document,
      'Clone, follow a.data change, compare',
      followClone,
    );
    restoreButton = button(document, 'Restore authored graph', restore);

    container.append(
      node(document, 'div', { className: 'feature-workflow-controls' }, [
        button(document, 'Apply deterministic patch', applyPatch),
        button(document, 'Toggle c under p / top level', reparent),
        button(document, 'Batch score + position writes', batch),
        serializeButton,
        cloneButton,
        restoreButton,
        button(document, 'Start progressive load', progressiveLoad),
        button(document, 'Cancel progressive load', cancelLoad),
      ]),
      status,
      node(document, 'h3', { text: 'Progressive load status' }),
      streamStatus,
    );

    return () => {
      disposed = true;
      mutationToken++;
      loadToken++;
      if (loadRun != null) loadRun.cancel();
      if (chunkHandler != null) cy.off('loadchunk', chunkHandler);
      chunkHandler = null;
      clearTimeout(chunkTimer);
      chunkTimer = null;
      resolveChunkWait?.();
      resolveChunkWait = null;
      if (follower != null && cloneHandler != null)
        follower.off('patch', cloneHandler);
      clearTimeout(cloneTimer);
      cloneTimer = null;
      resolveCloneWait?.(null);
      resolveCloneWait = null;
      cloneHandler = null;
      follower?.destroy();
      follower = null;
      tempInstances.forEach((instance) => instance.destroy());
      tempInstances.clear();
    };
  }

  const api = {
    mountLayoutCallbacks,
    mountInspector,
    mountMutation,
  };
  root.featureWorkflowPanels = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
