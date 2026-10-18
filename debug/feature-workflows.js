/* eslint-disable no-console */
/* global cytoscape */

// Stateful and numeric manual workflows (round 149).  Each panel uses the
// public core/collection API and writes its actual result into the page so a
// manual run can be repeated and inspected without relying on the console.
(function (root) {
  'use strict';

  // Browser builds load these scripts from index.html; a direct Node
  // CommonJS require loads the same flat modules in order on demand.
  if (
    typeof module !== 'undefined' &&
    module.exports &&
    typeof require === 'function'
  ) {
    if (root.featureWorkflowUI == null) require('./workflow-ui.js');
    if (root.featureWorkflowAlgorithms == null)
      require('./workflow-algorithms.js');
    if (root.featureWorkflowPanels == null) require('./workflow-panels.js');
    if (root.featureWorkflowVisualPanels == null)
      require('./workflow-visual-panels.js');
    if (root.featureWorkflowRuntimePanels == null)
      require('./workflow-runtime-panels.js');
  }

  const SCENE_CATALOG = [
    {
      id: 'algorithms',
      label: 'Algorithms',
      purpose: 'Run graph algorithms over the directed, weighted fixture.',
      expected:
        'Actual paths, components, clusters, or numeric node scores appear and highlight their results.',
    },
    {
      id: 'layouts',
      label: 'Layout callback recipes',
      purpose:
        'Run a deterministic built-in layout with real transform, ready, and stop callbacks.',
      expected:
        'The callback trace shows layoutstart, node transforms, ready, stop, and changed positions.',
    },
    {
      id: 'inspector',
      label: 'Query and inspect',
      purpose:
        'Compile structured queries and inspect node/edge state and topology.',
      expected:
        'Recipes select matching live elements and inspection shows data, flags, geometry, ancestry, and neighbours.',
    },
    {
      id: 'mutation',
      label: 'Update and persist',
      purpose:
        'Exercise deterministic patch, reparent, batch, serialize/load, progressive cancellation, and clone following.',
      expected:
        'Readouts compare actual ids, diffs, counts, data, and clone state.',
    },
    {
      id: 'animation',
      label: 'Animation',
      purpose: 'Tween position and paint with a controllable animation handle.',
      expected:
        'Progress, pause/resume, reverse, stop, and promise sequence change the selected node.',
    },
    {
      id: 'gestures',
      label: 'Gestures and events',
      purpose:
        'Inspect pointer routing, hit tests, selection modes, and gesture events.',
      expected:
        'Live gesture events are logged; nodeAt and async pick report the picked element.',
    },
    {
      id: 'export',
      label: 'Image export',
      purpose:
        'Export a PNG or JPEG at selected bounds, scale, and background.',
      expected:
        'The returned image is previewed with measured dimensions and a download link.',
    },
    {
      id: 'runtime',
      label: 'Renderer and lifecycle',
      purpose:
        'Select the renderer host at construction and inspect readiness, stats, and mount lifecycle.',
      expected:
        'Host selection reloads the same scene; public stats report the active renderer state.',
    },
  ];
  const SCENE_IDS = SCENE_CATALOG.map((scene) => scene.id);

  const COVERAGE = [
    {
      family: 'algorithms-search-paths',
      scene: 'algorithms',
      widget: 'algorithm explorer',
      evidence:
        'feature-workflows-renderer.spec.js; test/modules/feature-workflows.mjs',
    },
    {
      family: 'algorithms-topology',
      scene: 'algorithms',
      widget: 'algorithm explorer',
      evidence:
        'feature-workflows-renderer.spec.js; test/modules/feature-workflows.mjs',
    },
    {
      family: 'algorithms-centrality',
      scene: 'algorithms',
      widget: 'algorithm explorer',
      evidence:
        'feature-workflows-renderer.spec.js; test/modules/feature-workflows.mjs',
    },
    {
      family: 'algorithms-clustering',
      scene: 'algorithms',
      widget: 'algorithm explorer',
      evidence:
        'feature-workflows-renderer.spec.js; test/modules/feature-workflows.mjs',
    },
    {
      family: 'algorithms-similarity-diffusion-motifs',
      scene: 'algorithms',
      widget: 'algorithm explorer',
      evidence:
        'feature-workflows-renderer.spec.js; test/modules/feature-workflows.mjs',
    },
    {
      family: 'async-executor-comparison-cancellation',
      scene: 'algorithms',
      widget: 'CPU comparison and repeatable async cancellation',
      evidence:
        'feature-workflows-renderer.spec.js; test/modules/feature-workflows.mjs',
    },
    {
      family: 'query-selection-topology-inspection',
      scene: 'inspector',
      widget: 'structured query and element inspector',
      evidence:
        'feature-workflows-renderer.spec.js; test/modules/feature-workflows.mjs',
    },
    {
      family: 'animation-transitions',
      scene: 'animation',
      widget: 'play/pause/resume/reverse/stop/progress and sequence',
      evidence:
        'feature-workflows-renderer.spec.js; test/modules/feature-workflows.mjs',
    },
    {
      family: 'patch-data-reparent-batch',
      scene: 'mutation',
      widget: 'deterministic patch, reparent, batch, reset',
      evidence:
        'feature-workflows-renderer.spec.js; test/modules/feature-workflows.mjs',
    },
    {
      family: 'serialize-load-cancel',
      scene: 'mutation',
      widget: 'serialize/load comparison and cancellable progressive load',
      evidence:
        'feature-workflows-renderer.spec.js; test/modules/feature-workflows.mjs',
    },
    {
      family: 'clone-follow-dirty-stream',
      scene: 'mutation',
      widget: 'headless following clone and applied state readout',
      evidence:
        'feature-workflows-renderer.spec.js; test/modules/feature-workflows.mjs',
    },
    {
      family: 'gesture-picking-events',
      scene: 'gestures',
      widget: 'live gesture log, CPU nodeAt and async GPU pick',
      evidence:
        'feature-workflows-renderer.spec.js; test/modules/feature-workflows.mjs',
    },
    {
      family: 'image-export',
      scene: 'export',
      widget: 'PNG/JPEG preview and download',
      evidence:
        'feature-workflows-renderer.spec.js; test/modules/feature-workflows.mjs',
    },
    {
      family: 'renderer-host-lifecycle',
      scene: 'runtime',
      widget: 'renderer host selector, readiness, stats, mount lifecycle',
      evidence:
        'feature-workflows-renderer.spec.js; test/modules/feature-workflows.mjs',
    },
    {
      family: 'headless-runtimes',
      scene: null,
      widget: 'headless entry and runtime contracts',
      evidence:
        'test/headless-entry.mjs; test/runtimes/smoke.mjs; test/runtimes/smoke-checks.mjs (automated entry and runtime contracts; no renderer UI)',
    },
    {
      family: 'type-declarations',
      scene: null,
      widget: 'public declaration surface',
      evidence:
        'test/types-surface.mjs; typescript/tests/api.test-d.ts (automated runtime and compiler checks for shipped declarations)',
    },
    {
      family: 'style-schemas',
      scene: null,
      widget: 'schema validation',
      evidence:
        'test/modules/schemas.mjs (automated schema/source parity; this API-contract family has no interactive widget)',
    },
    {
      family: 'distribution-packaging',
      scene: null,
      widget: 'package and bundle validation',
      evidence:
        'test/modules/packaging.mjs; test/modules/bundle-size.mjs (automated npm package contents and bundle-size contracts)',
    },
    {
      family: 'benchmark-recipes',
      scene: null,
      widget: 'algorithm benchmark recipes',
      evidence:
        'benchmark/algorithms.mjs (executable deterministic algorithm benchmark recipes; performance contracts are not interactive)',
    },
    {
      family: 'device-loss-diagnostic',
      scene: null,
      widget: null,
      evidence:
        'playwright-tests/renderer.spec.js: “device loss auto-recovers” (a renderer test hook exercises loss; the public API offers no user-facing loss trigger)',
    },
    {
      family: 'undo-history',
      scene: null,
      widget: null,
      evidence:
        'src/README.md (the core ships no undo stack; an app can record transactions and replay cy.patch); plan/rounds/2026-10-18-01-rnd0149-plan-manual-feature-demos-and-golden-coverage-audit.md (do not implement an undo manager; snapshot cost is evidence only)',
    },
    {
      family: 'layout-callback-recipes',
      scene: 'layouts',
      widget: 'built-in layout transform / ready / stop callback recipe',
      evidence:
        'debug/index.html?network=workflows&scene=layouts&layout=preset; test/modules/feature-workflows.mjs; playwright-tests/feature-workflows-renderer.spec.js; debug/layout-options.js; test/modules/layout-options-panel.mjs (layout transform, ready, and stop callbacks run through cy.layout; the JSON options panel explicitly excludes function values)',
    },
    {
      family: 'model-dirty-consumers',
      scene: 'mutation',
      widget: 'following clone consumes the changed model patch',
      evidence:
        'debug/index.html?network=workflows&scene=mutation&layout=preset; playwright-tests/feature-workflows-renderer.spec.js; test/modules/feature-workflows.mjs; test/clone.mjs (source data mutation causes a clone patch event and applied state comparison)',
    },
  ];
  const algorithms = root.featureWorkflowAlgorithms;
  const modelPanels = root.featureWorkflowPanels;
  const visualPanels = root.featureWorkflowVisualPanels;
  const runtimePanels = root.featureWorkflowRuntimePanels;
  const PROPERTY_EVIDENCE = [
    ...[
      ['selection-box-color', '#ef7d35'],
      ['selection-box-opacity', 0.4],
      ['selection-box-border-color', '#8b3f16'],
      ['selection-box-border-width', 2],
      ['active-bg-color', '#2f7de1'],
      ['active-bg-opacity', 0.32],
      ['active-bg-size', 48],
    ].map(([property, value]) => ({
      group: 'core',
      property,
      target: 'core',
      value,
      values: [value],
      route: '?network=workflows&scene=gestures&layout=preset',
      widget: 'Apply held-gesture core styles',
      behaviorSpec:
        'animation transition and gesture controls change live state and event propagation',
    })),
    {
      group: 'core',
      property: 'label-declutter',
      target: 'core',
      value: 'none and cull are applied through the selector',
      values: ['none', 'cull'],
      route: '?network=workflows&scene=gestures&layout=preset',
      widget: 'Apply label declutter mode',
      behaviorSpec:
        'animation transition and gesture controls change live state and event propagation',
    },
    {
      group: 'nodes',
      property: 'events',
      target: 'node a',
      value: 'yes ↔ no (toggle; actual value is reported)',
      values: ['yes', 'no'],
      route: '?network=workflows&scene=gestures&layout=preset',
      widget: 'Toggle a.events no/yes',
      behaviorSpec:
        'animation transition and gesture controls change live state and event propagation',
    },
    {
      group: 'nodes',
      property: 'text-events',
      target: 'node b',
      value: 'yes ↔ no (toggle; actual value is reported)',
      values: ['yes', 'no'],
      route: '?network=workflows&scene=gestures&layout=preset',
      widget: 'Toggle b.text-events no/yes',
      behaviorSpec:
        'animation transition and gesture controls change live state and event propagation',
    },
    {
      group: 'edges',
      property: 'events',
      target: 'edge ab',
      value: 'yes ↔ no (toggle; actual value is reported)',
      values: ['yes', 'no'],
      route: '?network=workflows&scene=gestures&layout=preset',
      widget: 'Toggle edge ab.events no/yes',
      behaviorSpec:
        'animation transition and gesture controls change live state and event propagation',
    },
    ...[
      [
        'background-color',
        '#ef7d35 when hot; #49a7a0 when calm',
        ['#ef7d35', '#49a7a0'],
      ],
      ['opacity', 'score 0 maps to 0.55; score 10 maps to 1', [0.55, 1]],
      [
        'border-width',
        'workflowState hot maps to 6 px; calm maps to 2 px',
        [2, 6],
      ],
      ['width', 'workflowAnimationWidth px input (default 52)', [52, 90]],
      [
        'transition-property',
        'background-color opacity border-width during animation; none after Restore',
        ['background-color opacity border-width', 'none'],
      ],
      [
        'transition-duration',
        'workflowAnimationDuration ms input (default 1400)',
        [1400, 6000, 2400, 700],
      ],
      ['transition-delay', 0, [0]],
      [
        'transition-timing-function',
        'workflowAnimationTimingFunction selector (default linear)',
        visualPanels.timingFunctions,
      ],
    ].map(([property, value, values]) => ({
      group: 'nodes',
      property,
      target: 'selected node',
      value,
      values,
      route: '?network=workflows&scene=animation&layout=preset',
      widget: 'Play transition + position/width tween',
      behaviorSpec:
        'animation transition and gesture controls change live state and event propagation',
    })),
    ...[
      [
        'line-color',
        "workflowEdgeState='hot' → #ef7d35; otherwise #5b6472",
        ['#ef7d35', '#5b6472'],
      ],
      [
        'width',
        'workflowEdgeState hot maps to 4 px; calm maps to 2 px',
        [2, 4],
      ],
      [
        'transition-property',
        'line-color width during animation; none after Restore',
        ['line-color width', 'none'],
      ],
      [
        'transition-duration',
        'workflowAnimationDuration ms input (default 1400)',
        [1400, 6000, 2400, 700],
      ],
      ['transition-delay', 0, [0]],
      [
        'transition-timing-function',
        'workflowAnimationTimingFunction selector (default linear)',
        visualPanels.timingFunctions,
      ],
    ].map(([property, value, values]) => ({
      group: 'edges',
      property,
      target: 'edge ab',
      value,
      values,
      route: '?network=workflows&scene=animation&layout=preset',
      widget: 'Play transition + position/width tween',
      behaviorSpec:
        'animation transition and gesture controls change live state and event propagation',
    })),
  ];

  const KEYWORD_EVIDENCE = visualPanels.timingFunctions.flatMap((value) => [
    {
      group: 'nodes',
      property: 'transition-timing-function',
      value,
      route: '?network=workflows&scene=animation&layout=preset',
      widget: 'Transition timing function selector',
      behaviorSpec:
        'animation transition and gesture controls change live state and event propagation',
    },
    {
      group: 'edges',
      property: 'transition-timing-function',
      value,
      route: '?network=workflows&scene=animation&layout=preset',
      widget: 'Transition timing function selector',
      behaviorSpec:
        'animation transition and gesture controls change live state and event propagation',
    },
  ]);
  KEYWORD_EVIDENCE.push(
    {
      group: 'edges',
      property: 'events',
      value: 'no',
      target: 'edge ab',
      route: '?network=workflows&scene=gestures&layout=preset',
      widget: 'Toggle edge ab.events no/yes',
      behaviorSpec:
        'animation transition and gesture controls change live state and event propagation',
    },
    {
      group: 'edges',
      property: 'events',
      value: 'yes',
      target: 'edge ab',
      route: '?network=workflows&scene=gestures&layout=preset',
      widget: 'Toggle edge ab.events no/yes',
      behaviorSpec:
        'animation transition and gesture controls change live state and event propagation',
    },
    ...['nodes', 'edges'].map((group) => ({
      group,
      property: 'transition-property',
      value: 'none',
      target: group === 'nodes' ? 'selected node' : 'edge ab',
      route: '?network=workflows&scene=animation&layout=preset',
      widget: 'Restore captured geometry/style',
      behaviorSpec:
        'animation transition and gesture controls change live state and event propagation',
    })),
    ...['none', 'cull'].map((value) => ({
      group: 'core',
      property: 'label-declutter',
      value,
      target: 'core',
      route: '?network=workflows&scene=gestures&layout=preset',
      widget: 'Apply label declutter mode',
      behaviorSpec:
        'animation transition and gesture controls change live state and event propagation',
    })),
  );

  function mountControls(options) {
    if (options == null || options.cy == null || options.container == null) {
      return false;
    }

    const scene = SCENE_IDS.includes(options.scene)
      ? options.scene
      : 'algorithms';
    options.container.dataset.scene = scene;
    const mounts = {
      algorithms: algorithms.mountControls,
      layouts: modelPanels.mountLayoutCallbacks,
      inspector: modelPanels.mountInspector,
      mutation: modelPanels.mountMutation,
      animation: visualPanels.mountAnimation,
      gestures: visualPanels.mountGestures,
      export: runtimePanels.mountExport,
      runtime: runtimePanels.mountRuntime,
    };
    const document = options.container.ownerDocument;
    const workflowUI = root.featureWorkflowUI;
    const workflowSelector = workflowUI.select(
      document,
      SCENE_CATALOG.map((entry) => [entry.id, entry.label]),
      scene,
    );
    const panelContainer = document.createElement('div');
    const onSceneChange = () => {
      const nextScene = workflowSelector.value;

      if (!SCENE_IDS.includes(nextScene) || nextScene === scene) return;
      if (typeof options.setParams === 'function') {
        options.setParams({ scene: nextScene, view: '' });
      } else if (typeof options.onViewChange === 'function') {
        options.onViewChange(nextScene, '');
      }
    };
    workflowSelector.addEventListener('change', onSceneChange);
    options.container.replaceChildren(
      workflowUI.field(document, 'Workflow', workflowSelector),
      panelContainer,
    );
    const disposePanel = mounts[scene]({
      ...options,
      scene,
      container: panelContainer,
    });

    return () => {
      workflowSelector.removeEventListener('change', onSceneChange);
      disposePanel?.();
    };
  }

  const api = {
    scenes: SCENE_CATALOG,
    coverage: COVERAGE,
    propertyEvidence: PROPERTY_EVIDENCE,
    keywordEvidence: KEYWORD_EVIDENCE,
    algorithms: algorithms.algorithms,
    numericComparisons: algorithms.numericComparisons,
    timingFunctions: visualPanels.timingFunctions,
    runAlgorithm: algorithms.runAlgorithm,
    describeAlgorithm: algorithms.describeAlgorithm,
    numericAlgorithmValues: algorithms.numericAlgorithmValues,
    compareNumericValues: algorithms.compareNumericValues,
    comparisonTolerance: algorithms.comparisonTolerance,
    mountControls,
  };

  root.featureWorkflows = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
