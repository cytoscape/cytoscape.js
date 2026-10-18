/* featureWorkflowVisualPanels workflow panels for the debug network. */
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
  const TIMING_FUNCTIONS = [
    'linear',
    'ease',
    'ease-in',
    'ease-out',
    'ease-in-out',
    'ease-in-sine',
    'ease-out-sine',
    'ease-in-out-sine',
    'ease-in-quad',
    'ease-out-quad',
    'ease-in-out-quad',
    'ease-in-cubic',
    'ease-out-cubic',
    'ease-in-out-cubic',
    'ease-in-quart',
    'ease-out-quart',
    'ease-in-out-quart',
    'ease-in-quint',
    'ease-out-quint',
    'ease-in-out-quint',
    'ease-in-expo',
    'ease-out-expo',
    'ease-in-out-expo',
    'ease-in-circ',
    'ease-out-circ',
    'ease-in-out-circ',
  ];

  function mountAnimation({ cy, container, params }) {
    const document = panel(
      container,
      'Animation and transitions',
      'Mapper restyles node paint/border-width and edge line-color/width while an independent animation handle moves position and node width. Use the readout and mid-flight pick to inspect concurrent channels; sequence and handle controls use the live animation API.',
    );
    const authoredStyle = copy(cy.style().json());
    const authoredNodes = Object.fromEntries(
      cy.nodes({ parent: false }).map((ele) => [
        ele.id(),
        {
          position: ele.position(),
          score: ele.data('score'),
          workflowState: ele.data('workflowState'),
          hasScore: Object.prototype.hasOwnProperty.call(ele.data(), 'score'),
          hasWorkflowState: Object.prototype.hasOwnProperty.call(
            ele.data(),
            'workflowState',
          ),
        },
      ]),
    );
    const edgeTarget = cy.edges().first();
    const authoredEdgeState = edgeTarget.length
      ? {
          value: edgeTarget.data('workflowEdgeState'),
          hasValue: Object.prototype.hasOwnProperty.call(
            edgeTarget.data(),
            'workflowEdgeState',
          ),
        }
      : null;
    const nodeIds = Object.keys(authoredNodes);
    const target = select(
      document,
      nodeIds.map((id) => [id, id]),
      param(params, 'workflowAnimationNode', 'a', nodeIds),
    );
    const duration = node(document, 'input', {
      type: 'number',
      min: 200,
      max: 8000,
      step: 100,
      value: numericParam(params, 'workflowAnimationDuration', 1400, 200, 8000),
    });
    const distance = node(document, 'input', {
      type: 'number',
      min: 10,
      max: 200,
      step: 10,
      value: numericParam(params, 'workflowAnimationDistance', 80, 10, 200),
    });
    const width = node(document, 'input', {
      type: 'number',
      min: 20,
      max: 100,
      step: 2,
      value: numericParam(params, 'workflowAnimationWidth', 52, 20, 100),
    });
    const timingFunction = select(
      document,
      TIMING_FUNCTIONS,
      param(
        params,
        'workflowAnimationTimingFunction',
        'linear',
        TIMING_FUNCTIONS,
      ),
    );
    const progress = node(document, 'progress', {
      max: 1,
      value: 0,
      'aria-label': 'Animation progress',
    });
    const status = output(document, 'Ready.');
    const readout = output(
      document,
      'Current geometry and style will appear here.',
    );
    let handle = null;
    let activeCollection = null;
    let timer = null;
    let runToken = 0;
    let busy = false;
    let disposed = false;
    const saveAnimationInputs = () =>
      saveParams({
        workflowAnimationNode: target.value,
        workflowAnimationDuration: duration.value,
        workflowAnimationDistance: distance.value,
        workflowAnimationWidth: width.value,
        workflowAnimationTimingFunction: timingFunction.value,
      });

    const clearTimer = () => {
      if (timer != null) clearInterval(timer);
      timer = null;
    };
    const cancelActive = () => {
      runToken++;
      activeCollection?.stop(false);
      handle = null;
      activeCollection = null;
      busy = false;
      clearTimer();
    };
    const refreshReadout = () => {
      const selected = cy.getElementById(target.value);
      if (!selected.length) return;
      const nodeRef = cy._store.lookup(selected.id());
      const nodeFill = cy._store.column('node.fillColor');
      const bounds = selected.boundingBox({ includeLabels: false });
      readout.textContent = JSON.stringify(
        {
          id: selected.id(),
          position: selected.position(),
          renderedPosition: selected.renderedPosition(),
          width: selected.numericStyle('width'),
          borderWidth: selected.numericStyle('border-width'),
          height: selected.numericStyle('height'),
          backgroundColor: selected.style('background-color'),
          renderedFillRGBA: Array.from(
            nodeFill.subarray(nodeRef.slot * 4, nodeRef.slot * 4 + 4),
          ),
          opacity: selected.numericStyle('opacity'),
          renderedOpacity: cy._store.column('node.opacity')[nodeRef.slot],
          bounds,
          transition: {
            'transition-property': selected.style('transition-property'),
            'transition-duration': selected.style('transition-duration'),
            'transition-timing-function': selected.style(
              'transition-timing-function',
            ),
            progress: handle?.progress() ?? 0,
          },
          edgeTransition: edgeTarget.length
            ? {
                id: edgeTarget.id(),
                workflowEdgeState: edgeTarget.data('workflowEdgeState'),
                lineColor: edgeTarget.style('line-color'),
                width: edgeTarget.numericStyle('width'),
                renderedLineRGBA: (() => {
                  const ref = cy._store.lookup(edgeTarget.id());
                  const color = cy._store.column('edge.lineColor');
                  return Array.from(
                    color.subarray(ref.slot * 4, ref.slot * 4 + 4),
                  );
                })(),
                'transition-property': edgeTarget.style('transition-property'),
                'transition-duration': edgeTarget.style('transition-duration'),
                'transition-timing-function': edgeTarget.style(
                  'transition-timing-function',
                ),
              }
            : null,
        },
        null,
        2,
      );
      progress.value = handle?.progress() ?? 0;
    };
    const transitionSheet = (transitionDuration, selectedTimingFunction) => {
      const sheet = copy(authoredStyle);
      sheet.nodes = {
        ...(sheet.nodes || {}),
        'background-color': {
          case: [
            { when: { data: 'workflowState', eq: 'hot' }, then: '#ef7d35' },
          ],
          else: '#49a7a0',
        },
        opacity: {
          data: 'score',
          domain: [0, 10],
          range: [0.55, 1],
          fallback: 0.55,
        },
        'border-width': {
          case: [{ when: { data: 'workflowState', eq: 'hot' }, then: 6 }],
          else: 2,
        },
        'transition-property': 'background-color opacity border-width',
        'transition-duration': transitionDuration,
        'transition-delay': 0,
        'transition-timing-function': selectedTimingFunction,
      };
      sheet.edges = {
        ...(sheet.edges || {}),
        'line-color': {
          case: [
            {
              when: { data: 'workflowEdgeState', eq: 'hot' },
              then: '#ef7d35',
            },
          ],
          else: '#5b6472',
        },
        width: {
          case: [
            {
              when: { data: 'workflowEdgeState', eq: 'hot' },
              then: 4,
            },
          ],
          else: 2,
        },
        'transition-property': 'line-color width',
        'transition-duration': transitionDuration,
        'transition-delay': 0,
        'transition-timing-function': selectedTimingFunction,
      };
      return sheet;
    };
    const configureTransitions = (durationMs, selectedTimingFunction) => {
      cy.style(transitionSheet(durationMs, selectedTimingFunction));
    };
    const restore = () => {
      cancelActive();
      const immediate = copy(cy.style().json());
      immediate.nodes = {
        ...(immediate.nodes || {}),
        'transition-property': 'none',
        'transition-duration': 0,
        'transition-delay': 0,
      };
      immediate.edges = {
        ...(immediate.edges || {}),
        'transition-property': 'none',
        'transition-duration': 0,
        'transition-delay': 0,
      };
      cy.style(immediate);
      Object.entries(authoredNodes).forEach(([id, saved]) => {
        const element = cy.getElementById(id);
        if (!element.length) return;
        element.position(saved.position);
        if (saved.hasScore) element.data('score', saved.score);
        else element.removeData('score');
        if (saved.hasWorkflowState)
          element.data('workflowState', saved.workflowState);
        else element.removeData('workflowState');
        element.removeStyle('width');
      });
      if (edgeTarget.length && authoredEdgeState != null) {
        if (authoredEdgeState.hasValue)
          edgeTarget.data('workflowEdgeState', authoredEdgeState.value);
        else edgeTarget.removeData('workflowEdgeState');
      }
      cy.style(copy(authoredStyle));
      refreshReadout();
      status.textContent =
        'Restored the captured stylesheet, data values, and node positions.';
    };
    const start = async () => {
      if (disposed) return;
      if (busy) {
        status.textContent =
          'An animation is already running. Stop or restore it before starting another.';
        return;
      }
      const selected = cy.getElementById(target.value);
      const origin = selected.position();
      const durationMs = Math.max(100, Number(duration.value) || 1400);
      const delta = Math.max(10, Number(distance.value) || 80);
      const widthPx = Math.max(20, Number(width.value) || 52);
      const token = ++runToken;
      busy = true;
      try {
        configureTransitions(durationMs, timingFunction.value);
        selected.removeStyle('width');
        selected.data({
          workflowState:
            selected.data('workflowState') === 'hot' ? 'calm' : 'hot',
          score: selected.data('score') >= 10 ? 0 : 10,
        });
        if (edgeTarget.length) {
          edgeTarget.data(
            'workflowEdgeState',
            edgeTarget.data('workflowEdgeState') === 'hot' ? 'calm' : 'hot',
          );
        }
        handle = selected.animation({
          position: { x: origin.x + delta, y: origin.y },
          style: { width: `${widthPx}px` },
          duration: durationMs,
          easing: timingFunction.value,
        });
        activeCollection = selected;
        const completion = handle.play();
        status.textContent = `Transition restyle + position/width tween started on ${selected.id()}: position ${origin.x},${origin.y} → ${origin.x + delta},${origin.y}; timing=${timingFunction.value}; background/opacity/geometry transition=${durationMs} ms.`;
        clearTimer();
        timer = setInterval(refreshReadout, 20);
        refreshReadout();
        await completion;
        if (!disposed && token === runToken) {
          status.textContent = `Animation settled. progress=${handle?.progress().toFixed(3) ?? '—'}; current position=(${selected.position('x')}, ${selected.position('y')}); width=${selected.numericStyle('width')}; color=${selected.style('background-color')}; opacity=${selected.numericStyle('opacity')}.`;
        }
      } catch (error) {
        if (!disposed && token === runToken)
          status.textContent = `Animation error: ${error?.message || error}`;
      } finally {
        if (token === runToken) {
          clearTimer();
          busy = false;
          handle = null;
          activeCollection = null;
          refreshReadout();
        }
      }
    };
    const sequence = async () => {
      if (busy || disposed) return;
      const selected = cy.getElementById(target.value);
      const origin = selected.position();
      const originWidth = selected.numericStyle('width');
      const goal = {
        x: origin.x + Math.max(10, Number(distance.value) || 80),
        y: origin.y,
      };
      const durationMs = Math.max(100, Number(duration.value) || 1400);
      const token = ++runToken;
      busy = true;
      configureTransitions(durationMs, timingFunction.value);
      status.textContent =
        'Sequence: move and transition to hot, then return and transition to calm.';
      selected.data({ workflowState: 'hot', score: 10 });
      if (edgeTarget.length) edgeTarget.data('workflowEdgeState', 'hot');
      activeCollection = selected;
      clearTimer();
      timer = setInterval(refreshReadout, 20);
      try {
        handle = selected.animation({
          position: goal,
          style: { width: `${Math.max(20, Number(width.value) || 52)}px` },
          duration: durationMs,
          easing: timingFunction.value,
        });
        await handle.play();
        if (disposed || token !== runToken) return;
        selected.data({ workflowState: 'calm', score: 0 });
        if (edgeTarget.length) edgeTarget.data('workflowEdgeState', 'calm');
        handle = selected.animation({
          position: origin,
          style: { width: `${originWidth}px` },
          duration: durationMs,
          easing: timingFunction.value,
        });
        await handle.play();
        if (!disposed && token === runToken)
          status.textContent = `Sequence completed: position restored to (${selected.position('x')}, ${selected.position('y')}); transitions returned to calm.`;
      } catch (error) {
        if (!disposed && token === runToken)
          status.textContent = `Sequence error: ${error?.message || error}`;
      } finally {
        if (token === runToken) {
          clearTimer();
          busy = false;
          handle = null;
          activeCollection = null;
          refreshReadout();
        }
      }
    };
    const midFlightPick = async () => {
      const selected = cy.getElementById(target.value);
      const point = selected.renderedPosition();
      try {
        const cpu = cy.nodeAt(point.x, point.y);
        const gpu = await cy.pick(point.x, point.y);
        status.textContent = `Mid-flight pick at (${point.x.toFixed(1)}, ${point.y.toFixed(1)}): nodeAt=${cpu?.id() ?? 'null'}; pick=${gpu?.id() ?? 'null'}; progress=${handle?.progress().toFixed(3) ?? 'settled'}.`;
      } catch (error) {
        status.textContent = `Mid-flight pick unavailable: ${error?.message || error}`;
      }
    };
    target.addEventListener('change', refreshReadout);
    target.addEventListener('change', saveAnimationInputs);
    duration.addEventListener('input', saveAnimationInputs);
    distance.addEventListener('input', saveAnimationInputs);
    width.addEventListener('input', saveAnimationInputs);
    timingFunction.addEventListener('change', saveAnimationInputs);
    saveAnimationInputs();

    container.append(
      node(document, 'div', { className: 'feature-workflow-controls' }, [
        field(document, 'Node', target),
        field(document, 'Duration (ms)', duration),
        field(document, 'Move by (model px)', distance),
        field(document, 'Target width (px)', width),
        field(document, 'Transition timing function', timingFunction),
        button(document, 'Play transition + position/width tween', start),
        button(document, 'Pause', () => {
          handle?.pause();
          status.textContent = `Paused at ${handle?.progress().toFixed(3) ?? '—'}.`;
        }),
        button(document, 'Resume', () => {
          handle?.resume();
          status.textContent = `Resumed at ${handle?.progress().toFixed(3) ?? '—'}.`;
        }),
        button(document, 'Reverse', () => {
          handle?.reverse();
          status.textContent = `Direction reversed at ${handle?.progress().toFixed(3) ?? '—'}.`;
        }),
        button(document, 'Stop in place', () => {
          const amount = handle?.progress();
          cancelActive();
          status.textContent = `Stopped in place at ${amount?.toFixed(3) ?? '—'}.`;
          refreshReadout();
        }),
        button(document, 'Pick current animated location', midFlightPick),
        button(document, 'Run promise sequence', sequence),
        button(document, 'Restore captured geometry/style', restore),
      ]),
      field(document, 'Read-only progress', progress),
      status,
      node(document, 'h3', { text: 'Live geometry and computed style' }),
      readout,
    );
    refreshReadout();

    return () => {
      disposed = true;
      cancelActive();
      target.removeEventListener('change', refreshReadout);
      target.removeEventListener('change', saveAnimationInputs);
      duration.removeEventListener('input', saveAnimationInputs);
      distance.removeEventListener('input', saveAnimationInputs);
      width.removeEventListener('input', saveAnimationInputs);
      timingFunction.removeEventListener('change', saveAnimationInputs);
      const immediate = copy(cy.style().json());
      immediate.nodes = {
        ...(immediate.nodes || {}),
        'transition-property': 'none',
        'transition-duration': 0,
        'transition-delay': 0,
      };
      immediate.edges = {
        ...(immediate.edges || {}),
        'transition-property': 'none',
        'transition-duration': 0,
        'transition-delay': 0,
      };
      cy.style(immediate);
      Object.entries(authoredNodes).forEach(([id, saved]) => {
        const element = cy.getElementById(id);
        if (!element.length) return;
        element.position(saved.position);
        if (saved.hasScore) element.data('score', saved.score);
        else element.removeData('score');
        if (saved.hasWorkflowState)
          element.data('workflowState', saved.workflowState);
        else element.removeData('workflowState');
        element.removeStyle('width');
      });
      if (edgeTarget.length && authoredEdgeState != null) {
        if (authoredEdgeState.hasValue)
          edgeTarget.data('workflowEdgeState', authoredEdgeState.value);
        else edgeTarget.removeData('workflowEdgeState');
      }
      cy.style(copy(authoredStyle));
    };
  }

  function mountGestures({ cy, container, params }) {
    const document = panel(
      container,
      'Gestures, picking, and events',
      'Tune the core tap/hold thresholds, inspect real pointer/event routing, and compare CPU nodeAt() with async GPU pick. During a held press or box drag, the core selection chrome uses the configured palette.',
    );
    const authoredStyle = copy(cy.style().json());
    const savedCore = {
      desktopTapThreshold: cy.desktopTapThreshold(),
      touchTapThreshold: cy.touchTapThreshold(),
      tapholdDuration: cy.tapholdDuration(),
      selectionType: cy.selectionType(),
      boxSelectionMode: cy.boxSelectionMode(),
      panningEnabled: cy.panningEnabled(),
    };
    const savedNodes = Object.fromEntries(
      ['a', 'b'].map((id) => {
        const element = cy.getElementById(id);
        return [
          id,
          {
            selected: element.selected(),
            selectable: element.selectable(),
            locked: element.locked(),
            grabbable: element.grabbable(),
            pannable: element.pannable(),
          },
        ];
      }),
    );
    const target = select(
      document,
      ids(cy.nodes({ parent: false })).map((id) => [id, id]),
      param(params, 'workflowPickNode', 'a', ids(cy.nodes({ parent: false }))),
    );
    const desktop = node(document, 'input', {
      type: 'number',
      min: 0,
      max: 100,
      value: numericParam(
        params,
        'workflowDesktopTapThreshold',
        savedCore.desktopTapThreshold,
        0,
        100,
      ),
      step: 1,
    });
    const touch = node(document, 'input', {
      type: 'number',
      min: 0,
      max: 100,
      value: numericParam(
        params,
        'workflowTouchTapThreshold',
        savedCore.touchTapThreshold,
        0,
        100,
      ),
      step: 1,
    });
    const hold = node(document, 'input', {
      type: 'number',
      min: 0,
      max: 5000,
      value: numericParam(
        params,
        'workflowTapholdDuration',
        savedCore.tapholdDuration,
        0,
        5000,
      ),
      step: 50,
    });
    const labelDeclutter = select(
      document,
      ['none', 'cull'],
      param(params, 'workflowLabelDeclutter', 'none', ['none', 'cull']),
    );
    const stopAtChild = node(document, 'input', {
      type: 'checkbox',
      checked: param(params, 'workflowStopAtChild', 'false') === 'true',
    });
    const events = node(document, 'pre', {
      className: 'feature-workflow-output',
      text: 'No gesture events yet.',
    });
    const status = output(document, 'Ready.');
    const watched = [
      'pointerdown',
      'pointerup',
      'tap',
      'taphold',
      'grab',
      'drag',
      'free',
      'dragfree',
      'boxstart',
      'boxend',
      'boxselect',
      'pan',
      'zoom',
      'select',
      'unselect',
    ];
    const history = [];
    let recipeActive = false;
    let disposed = false;
    const saveGestureInputs = () =>
      saveParams({
        workflowPickNode: target.value,
        workflowDesktopTapThreshold: desktop.value,
        workflowTouchTapThreshold: touch.value,
        workflowTapholdDuration: hold.value,
        workflowLabelDeclutter: labelDeclutter.value,
        workflowStopAtChild: stopAtChild.checked,
      });
    const appendEvent = (line) => {
      history.push(line);
      while (history.length > 30) history.shift();
      events.textContent = history.join('\n');
    };
    const handler = (event) => {
      const targetId = event.target?.id?.() || 'core';
      appendEvent(`${event.type} · ${targetId}`);
    };
    const child = cy.getElementById('a');
    const parent = cy.getElementById('p');
    const childPhase = (event) => {
      appendEvent(
        `child phase · ${event.target.id()}${stopAtChild.checked ? ' · stopPropagation()' : ''}`,
      );
      if (stopAtChild.checked) event.stopPropagation();
    };
    const parentPhase = (event) =>
      appendEvent(`parent phase · ${event.target.id()}`);
    const delegatedPredicate = (element) =>
      element.isNode() && element.id() === 'a';
    const delegatedHandler = (event) =>
      appendEvent(`delegated core phase · ${event.target.id()}`);

    watched.forEach((type) => cy.on(type, handler));
    target.addEventListener('change', saveGestureInputs);
    desktop.addEventListener('input', saveGestureInputs);
    touch.addEventListener('input', saveGestureInputs);
    hold.addEventListener('input', saveGestureInputs);
    stopAtChild.addEventListener('change', saveGestureInputs);
    labelDeclutter.addEventListener('change', saveGestureInputs);
    saveGestureInputs();

    const applyThresholds = () => {
      const desktopPx = Math.max(0, Number(desktop.value) || 0);
      const touchPx = Math.max(0, Number(touch.value) || 0);
      const holdMs = Math.max(0, Number(hold.value) || 0);
      cy.desktopTapThreshold(desktopPx);
      cy.touchTapThreshold(touchPx);
      cy.tapholdDuration(holdMs);
      saveGestureInputs();
      status.textContent = `Applied core thresholds: desktop=${cy.desktopTapThreshold()} px; touch=${cy.touchTapThreshold()} px; taphold=${cy.tapholdDuration()} ms.`;
    };
    const setGestureChrome = () => {
      const sheet = copy(cy.style().json());
      sheet.core = {
        ...(sheet.core || {}),
        'selection-box-color': '#ef7d35',
        'selection-box-opacity': 0.4,
        'selection-box-border-color': '#8b3f16',
        'selection-box-border-width': 2,
        'active-bg-color': '#2f7de1',
        'active-bg-opacity': 0.32,
        'active-bg-size': 48,
      };
      cy.style(sheet);
      status.textContent =
        'Applied core gesture chrome. Hold a blank background point to see active-bg; a successful node press uses its active flag. Drag the background with Shift to see the selection box.';
    };
    const applyLabelDeclutter = () => {
      const sheet = copy(cy.style().json());
      sheet.core = {
        ...(sheet.core || {}),
        'label-declutter': labelDeclutter.value,
      };
      cy.style(sheet);
      saveGestureInputs();
      status.textContent = `Applied core label-declutter=${cy.style().json().core['label-declutter']}.`;
    };
    const toggleRecipe = () => {
      recipeActive = !recipeActive;
      if (recipeActive) {
        child.on('tap', childPhase);
        parent.on('tap', parentPhase);
        cy.on('tap', delegatedPredicate, delegatedHandler);
        status.textContent =
          'Propagation recipe active: tap child a. Event order is target a → ancestor p → delegated core. Check Stop at child phase to terminate the walk before p/core.';
      } else {
        child.off('tap', childPhase);
        parent.off('tap', parentPhase);
        cy.off('tap', delegatedPredicate, delegatedHandler);
        status.textContent = 'Propagation recipe removed.';
      }
    };
    const toggleStyle = (id, property) => {
      const element = cy.getElementById(id);
      const next = element.style(property) === 'no' ? 'yes' : 'no';
      element.style(property, next);
      status.textContent = `${id}.${property}=${element.style(property)}. This changes event routing/pick eligibility; restore removes the temporary style bypass.`;
    };
    const pick = async () => {
      const element = cy.getElementById(target.value);
      const point = element.renderedPosition();
      if (!point) {
        status.textContent = `No rendered position for ${target.value}.`;
        return;
      }
      try {
        const cpuNode = cy.nodeAt(point.x, point.y);
        const gpuPick = await cy.pick(point.x, point.y);
        if (!disposed)
          status.textContent = `At (${point.x.toFixed(1)}, ${point.y.toFixed(1)}): nodeAt=${cpuNode?.id() ?? 'null'}; pick=${gpuPick?.id() ?? 'null'}.`;
      } catch (error) {
        if (!disposed)
          status.textContent = `Pick unavailable: ${error?.message || error}`;
      }
    };
    const toggleLocked = () => {
      const element = cy.getElementById('a');
      element.locked() ? element.unlock() : element.lock();
      status.textContent = `a.locked=${element.locked()}.`;
    };
    const toggleGrabbable = () => {
      const element = cy.getElementById('a');
      element.grabbable() ? element.ungrabify() : element.grabify();
      status.textContent = `a.grabbable=${element.grabbable()}.`;
    };
    const toggleSelectionType = () => {
      const mode = cy.selectionType() === 'single' ? 'additive' : 'single';
      cy.selectionType(mode);
      status.textContent = `selectionType=${cy.selectionType()}.`;
    };
    const toggleBoxMode = () => {
      const mode = cy.boxSelectionMode() === 'contain' ? 'overlap' : 'contain';
      cy.boxSelectionMode(mode);
      status.textContent = `boxSelectionMode=${cy.boxSelectionMode()}.`;
    };
    const togglePanning = () => {
      cy.panningEnabled(!cy.panningEnabled());
      status.textContent = `panningEnabled=${cy.panningEnabled()}.`;
    };

    container.append(
      node(document, 'div', { className: 'feature-workflow-controls' }, [
        field(document, 'Pick target', target),
        button(document, 'Compare nodeAt() and async pick()', pick),
        field(document, 'Desktop tap threshold (px)', desktop),
        field(document, 'Touch tap threshold (px)', touch),
        field(document, 'Taphold duration (ms)', hold),
        field(document, 'Label declutter', labelDeclutter),
        button(document, 'Apply label declutter mode', applyLabelDeclutter),
        button(document, 'Apply tap and hold thresholds', applyThresholds),
        button(document, 'Apply held-gesture core styles', setGestureChrome),
        button(document, 'Toggle a.events no/yes', () =>
          toggleStyle('a', 'events'),
        ),
        button(document, 'Toggle b.text-events no/yes', () =>
          toggleStyle('b', 'text-events'),
        ),
        button(document, 'Toggle edge ab.events no/yes', () =>
          toggleStyle('ab', 'events'),
        ),
        button(document, 'Toggle a locked state', toggleLocked),
        button(document, 'Toggle a grabbable state', toggleGrabbable),
        button(document, 'Selection mode single/additive', toggleSelectionType),
        button(document, 'Box mode contain/overlap', toggleBoxMode),
        button(document, 'Toggle panning', togglePanning),
        button(
          document,
          'Attach / remove a→p delegated tap recipe',
          toggleRecipe,
        ),
        field(document, 'Stop at child phase', stopAtChild),
        button(document, 'Clear event log', () => {
          history.length = 0;
          events.textContent = 'No gesture events yet.';
        }),
      ]),
      status,
      events,
      node(document, 'p', {
        className: 'note',
        text: 'Manual recipe: tap child a and read target → ancestor p → delegated core; then enable Stop at child phase and tap again to check propagation stops before p/core. Press and hold a blank background point beyond the applied taphold duration to observe active-bg; shift-drag the background to inspect selection-box styles. On a touch device repeat a brief tap, hold, and drag to compare the separate touch threshold.',
      }),
    );

    return () => {
      disposed = true;
      watched.forEach((type) => cy.off(type, handler));
      child.off('tap', childPhase);
      parent.off('tap', parentPhase);
      cy.off('tap', delegatedPredicate, delegatedHandler);
      target.removeEventListener('change', saveGestureInputs);
      desktop.removeEventListener('input', saveGestureInputs);
      touch.removeEventListener('input', saveGestureInputs);
      hold.removeEventListener('input', saveGestureInputs);
      stopAtChild.removeEventListener('change', saveGestureInputs);
      labelDeclutter.removeEventListener('change', saveGestureInputs);
      cy.desktopTapThreshold(savedCore.desktopTapThreshold);
      cy.touchTapThreshold(savedCore.touchTapThreshold);
      cy.tapholdDuration(savedCore.tapholdDuration);
      cy.selectionType(savedCore.selectionType);
      cy.boxSelectionMode(savedCore.boxSelectionMode);
      cy.panningEnabled(savedCore.panningEnabled);
      for (const [id, saved] of Object.entries(savedNodes)) {
        const element = cy.getElementById(id);
        if (!element.length) continue;
        if (saved.locked) element.lock();
        else element.unlock();
        if (saved.grabbable) element.grabify();
        else element.ungrabify();
        if (saved.pannable) element.panify();
        else element.unpanify();
        if (saved.selectable) element.selectify();
        else element.unselectify();
        if (saved.selected) element.select();
        else element.unselect();
      }
      cy.getElementById('a').removeStyle('events');
      cy.getElementById('b').removeStyle('text-events');
      cy.getElementById('ab').removeStyle('events');
      cy.style(copy(authoredStyle));
      cy.unemphasize();
    };
  }

  const api = {
    timingFunctions: TIMING_FUNCTIONS,
    mountAnimation,
    mountGestures,
  };
  root.featureWorkflowVisualPanels = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
