/*
 * Deterministic, bounded visual feature scenes for the main v4 debug harness.
 *
 * This file is usable as a browser script and as a CommonJS module. Keep scene
 * builders free of DOM access so the same definitions can be compiled in the
 * Node module suite and composed by the visual-golden runner.
 */
(function (root, factory) {
  const featureScenes = factory(root);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = featureScenes;
  }

  if (root != null) {
    root.featureScenes = featureScenes;
  }
})(typeof globalThis === 'undefined' ? this : globalThis, function (root) {
  const image = (fill, extra = '') =>
    'data:image/svg+xml,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><rect width="48" height="48" fill="${fill}"/><path d="M0 24h48M24 0v48" stroke="#ffffff" stroke-opacity=".8" stroke-width="3"/>${extra}</svg>`,
    );

  const node = (id, x, y, data = {}, extra = {}) => ({
    data: { id, label: id, ...data },
    position: { x, y },
    ...extra,
  });

  const edge = (id, source, target, data = {}) => ({
    data: { id, source, target, ...data },
  });

  const mapper = (data, fallback) => ({ data, fallback });
  const baseStyle = (style = {}) => {
    const base = {
      nodes: {
        width: 66,
        height: 46,
        shape: 'round-rectangle',
        'background-color': '#dce8f4',
        'border-width': 1,
        'border-color': '#53677a',
        'font-size': 12,
        color: '#172432',
        'text-valign': 'center',
        'text-halign': 'center',
        label: mapper('label', ''),
      },
      edges: {
        width: 3,
        'line-color': '#53677a',
        'target-arrow-shape': 'triangle',
      },
    };

    for (const [group, props] of Object.entries(style)) {
      if (
        group === 'nodes' ||
        group === 'edges' ||
        group === 'parents' ||
        group === 'core'
      ) {
        base[group] = { ...(base[group] ?? {}), ...props };
      } else if (group === 'bypasses') {
        base.bypasses = { ...(base.bypasses ?? {}), ...props };
      } else {
        base[group] = props;
      }
    }

    return base;
  };

  const alternateForKeyword = (property, value) => {
    const pairs = {
      'background-fill': {
        solid: 'linear-gradient',
        'linear-gradient': 'solid',
        'radial-gradient': 'solid',
      },
      'background-gradient-direction': {
        'to-bottom': 'to-top',
        'to-top': 'to-bottom',
        'to-left': 'to-right',
        'to-right': 'to-left',
        'to-bottom-left': 'to-top-right',
        'to-bottom-right': 'to-top-left',
        'to-top-left': 'to-bottom-right',
        'to-top-right': 'to-bottom-left',
      },
      'border-position': {
        center: 'inside',
        inside: 'center',
        outside: 'center',
      },
      'border-style': {
        solid: 'dashed',
        dashed: 'solid',
        dotted: 'solid',
        double: 'solid',
      },
      'underlay-shape': {
        ellipse: 'round-rectangle',
        'round-rectangle': 'ellipse',
      },
      'edge-distances': {
        intersection: 'node-position',
        'node-position': 'intersection',
        endpoints: 'intersection',
      },
      'taxi-direction': {
        auto: 'horizontal',
        vertical: 'auto',
        horizontal: 'auto',
        upward: 'auto',
        downward: 'auto',
        leftward: 'auto',
        rightward: 'auto',
      },
      'taxi-track': { source: 'target', target: 'source', family: 'source' },
      'source-arrow-shape': { none: 'triangle', triangle: 'none' },
      'mid-source-arrow-shape': { none: 'triangle', triangle: 'none' },
      'mid-target-arrow-shape': { none: 'triangle', triangle: 'none' },
      'font-style': { normal: 'italic', italic: 'normal', oblique: 'normal' },
      'text-border-style': {
        solid: 'dashed',
        dashed: 'solid',
        dotted: 'solid',
        double: 'solid',
      },
      'text-justification': {
        auto: 'center',
        left: 'center',
        center: 'left',
        right: 'center',
      },
      'text-overflow-wrap': { whitespace: 'anywhere', anywhere: 'whitespace' },
      'text-transform': {
        none: 'uppercase',
        uppercase: 'lowercase',
        lowercase: 'none',
      },
      'text-wrap': { none: 'wrap', wrap: 'ellipsis', ellipsis: 'wrap' },
      visibility: { visible: 'hidden', hidden: 'visible' },
      'background-fit': { none: 'contain', contain: 'cover', cover: 'contain' },
      'background-clip': { node: 'none', none: 'node' },
      'background-image-containment': { inside: 'over', over: 'inside' },
      'background-repeat': {
        'no-repeat': 'repeat',
        'repeat-x': 'no-repeat',
        'repeat-y': 'no-repeat',
        repeat: 'no-repeat',
      },
      'background-image-smoothing': { yes: 'no', no: 'yes' },
      'background-image-type': { auto: 'sdf-icon', 'sdf-icon': 'auto' },
      chart: {
        none: 'pie',
        pie: 'stripes',
        stripes: 'pie',
        'heat-strip': 'radial-heat',
        'radial-heat': 'heat-strip',
        bar: 'pie',
      },
      'chart-direction': { vertical: 'horizontal', horizontal: 'vertical' },
      shape: {
        ellipse: 'diamond',
        triangle: 'ellipse',
        diamond: 'ellipse',
        star: 'ellipse',
        'round-rectangle': 'ellipse',
        'convex-hull': 'concave-hull',
        'round-convex-hull': 'convex-hull',
        'concave-hull': 'round-convex-hull',
      },
      'compound-sizing-wrt-labels': { include: 'exclude', exclude: 'include' },
      'padding-relative-to': {
        width: 'height',
        height: 'width',
        average: 'width',
        min: 'max',
        max: 'min',
      },
      'outline-style': {
        solid: 'dashed',
        dashed: 'solid',
        dotted: 'solid',
        double: 'solid',
      },
      'label-declutter': { none: 'cull', cull: 'none' },
    };
    if (
      [
        'source-arrow-shape',
        'mid-source-arrow-shape',
        'mid-target-arrow-shape',
      ].includes(property)
    ) {
      return value === 'none' ? 'triangle' : 'none';
    }
    const val = pairs[property]?.[String(value)];
    return val;
  };

  const imageListProperties = new Set([
    'background-fit',
    'background-clip',
    'background-image-containment',
    'background-repeat',
    'background-image-smoothing',
    'background-image-type',
  ]);

  const coverage = (
    properties = [],
    keywords = [],
    exceptions = [],
    semanticExceptions = [],
  ) => ({
    properties: properties.map((row) => ({ ...row })),
    keywords: keywords.map((row) => ({
      ...row,
      alternate: row.alternate ?? alternateForKeyword(row.property, row.value),
      ...(imageListProperties.has(row.property) && row.targetIndex == null
        ? { targetIndex: 0 }
        : {}),
    })),
    exceptions: exceptions.map((row) => ({ ...row })),
    ...(semanticExceptions.length > 0
      ? {
          semanticExceptions: semanticExceptions.map((row) => ({ ...row })),
        }
      : {}),
  });

  const controlParamNames = [
    'chartKind',
    'chartHole',
    'chartAngle',
    'chartDirection',
    'chartSize',
    'chartOpacity',
    'chartDomain',
    'chartExtreme',
    'mapperScore',
    'mapperBypass',
    'collapseFactor',
    'collapseExpanded',
    'fontWeight',
    'fontStyle',
    'fontFamily',
    'paddingRelativeTo',
    'labelDeclutter',
    'dimOpacity',
  ];

  const fontWeightValues = [
    'normal',
    'bold',
    'bolder',
    'lighter',
    100,
    200,
    300,
    400,
    500,
    600,
    700,
    800,
    900,
  ];
  const fontStyleValues = ['normal', 'italic', 'oblique'];
  const fontFamilyValues = ['Open Sans', 'sans-serif', 'serif', 'monospace'];

  const fontSelectors = {
    fontWeight: {
      group: 'nodes',
      property: 'font-weight',
      target: 'label-weight-sample',
      param: 'fontWeight',
      defaultValue: 400,
      values: fontWeightValues.map((value) => ({
        value,
        alternate: String(value) === '400' ? 700 : 400,
        query: `?network=features&scene=labels&view=font-keywords&fontWeight=${encodeURIComponent(String(value))}`,
      })),
    },
    fontStyle: {
      group: 'nodes',
      property: 'font-style',
      target: 'label-weight-sample',
      param: 'fontStyle',
      defaultValue: 'normal',
      values: fontStyleValues.map((value) => ({
        value,
        alternate: value === 'normal' ? 'italic' : 'normal',
        query: `?network=features&scene=labels&view=font-keywords&fontStyle=${encodeURIComponent(value)}`,
      })),
    },
    fontFamily: {
      group: 'nodes',
      property: 'font-family',
      target: 'label-weight-sample',
      param: 'fontFamily',
      defaultValue: 'Open Sans',
      values: fontFamilyValues.map((value) => ({
        value,
        alternate: value === 'serif' ? 'monospace' : 'serif',
        query: `?network=features&scene=labels&view=font-keywords&fontFamily=${encodeURIComponent(value)}`,
        ...(value === 'Open Sans'
          ? {}
          : {
              goldenOmissionReason:
                'Generic system font aliases resolve to platform font files, so this selector state is manual-review only and is not pixel-pinned.',
            }),
      })),
    },
  };

  const paddingRelativeValues = ['width', 'height', 'average', 'min', 'max'];
  const paddingRelativeSelector = {
    group: 'parents',
    property: 'padding-relative-to',
    target: 'parent-padding',
    param: 'paddingRelativeTo',
    defaultValue: 'width',
    values: paddingRelativeValues.map((value) => ({
      value,
      alternate: value === 'width' ? 'height' : 'width',
      query: `?network=features&scene=compounds&view=padding-width&paddingRelativeTo=${encodeURIComponent(value)}`,
    })),
  };

  const labelDeclutterValues = ['cull', 'none'];
  const labelDeclutterSelector = {
    group: 'core',
    property: 'label-declutter',
    target: 'core',
    param: 'labelDeclutter',
    defaultValue: 'cull',
    values: labelDeclutterValues.map((value) => ({
      value,
      alternate: value === 'cull' ? 'none' : 'cull',
      query: `?network=features&scene=emphasis&view=declutter&labelDeclutter=${encodeURIComponent(value)}`,
    })),
  };
  const dimOpacitySelector = {
    group: 'core',
    property: 'dim-opacity',
    target: 'core',
    param: 'dimOpacity',
    defaultValue: 0.52,
    min: 0,
    max: 1,
    step: 0.05,
    values: [0, 0.52, 1].map((value) => ({
      value,
      alternate: value === 0 ? 1 : 0,
      query: `?network=features&scene=emphasis&view=declutter&dimOpacity=${value}`,
    })),
  };

  const selectedFontValue = (params, key, values, fallback) => {
    const raw = getParam(params, key);
    if (raw == null) return fallback;
    const value = values.find((candidate) => String(candidate) === String(raw));
    return value ?? fallback;
  };

  const getParam = (params, key) => {
    if (typeof params?.get === 'function') return params.get(key);
    if (params != null && Object.hasOwn(params, key)) return params[key];

    if (typeof URLSearchParams === 'function') {
      return new URLSearchParams(root.location?.search ?? '').get(key);
    }

    return null;
  };

  const numericParam = (params, key, fallback, min, max) => {
    const raw = getParam(params, key);
    if (raw == null || raw === '') return fallback;
    const value = Number(raw);
    return Number.isFinite(value)
      ? Math.min(max, Math.max(min, value))
      : fallback;
  };

  const saveControlParams = (updates) => {
    const location = root.location;
    const history = root.history;

    if (location == null || typeof history?.replaceState !== 'function') return;

    const params = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === '') params.delete(key);
      else params.set(key, String(value));
    }

    const query = params.toString();
    history.replaceState(
      null,
      '',
      `${location.pathname}${query ? `?${query}` : ''}${location.hash || ''}`,
    );
  };

  const scene = (elements, style, details = {}) => ({
    elements,
    style: baseStyle(style),
    options: { layout: { name: 'preset' } },
    coverage: details.coverage ?? coverage(),
    notes: details.notes ?? [],
    initialState: details.initialState,
    controlOptions: details.controlOptions ?? {},
  });

  const builderModules = (() => {
    const names = ['paint', 'graph', 'labels', 'charts', 'compounds'];
    const preloaded = root?.featureSceneParts;
    const factories =
      preloaded && names.every((name) => typeof preloaded[name] === 'function')
        ? names.map((name) => preloaded[name])
        : [
            require('./feature-scenes-paint.js'),
            require('./feature-scenes-graph.js'),
            require('./feature-scenes-labels.js'),
            require('./feature-scenes-charts.js'),
            require('./feature-scenes-compounds.js'),
          ];
    const api = { image, node, edge, mapper, coverage, scene, baseStyle };
    return Object.assign({}, ...factories.map((build) => build(api)));
  })();
  const {
    paintNodes,
    paintBorders,
    paintGhosts,
    paintLayers,
    paintOutlines,
    paintFills,
    paintEdges,
    shapesUnderlays,
    edgeRoutes,
    edgeTaxi,
    edgeLoops,
    arrows,
    labels,
    images,
    chartValues,
    charts,
    compounds,
    emphasis,
    mappers,
  } = builderModules;

  const catalog = [
    {
      id: 'paint',
      label: 'Paint and layers',
      purpose: 'Compare node fill, border and edge paint channels.',
      expected:
        'The paired values change fill bands, border placement, line caps, casing and layer padding.',
      views: [
        { id: 'nodes', label: 'Node fills and borders' },
        { id: 'fills', label: 'Solid and gradient fills' },
        { id: 'borders', label: 'Border position and style' },
        { id: 'ghosts', label: 'Ghost copies' },
        { id: 'layers', label: 'Node overlays and underlays' },
        { id: 'edges', label: 'Edge paint' },
        { id: 'outlines', label: 'Node outlines' },
      ],
    },
    {
      id: 'shapes',
      label: 'Shapes',
      purpose: 'Inspect underlay and body contours.',
      expected:
        'Ellipse underlays stay distinct from the node body; the node-types gallery shows all leaf shapes.',
      views: [{ id: 'underlays', label: 'Ellipse underlays' }],
    },
    {
      id: 'edges',
      label: 'Routes and endpoints',
      purpose:
        'Compare endpoint distance, route geometry and automatic taxi tracks.',
      expected:
        'Node-position edge distances, radius modes, taxi direction and track each change a labeled route.',
      views: [
        { id: 'routes', label: 'Intersection and node-position' },
        { id: 'endpoints', label: 'Manual endpoints' },
        { id: 'radius-arc', label: 'Segment arc radius' },
        { id: 'radius-influence', label: 'Segment influence radius' },
        { id: 'loops', label: 'Loop direction, sweep and spacing' },
        { id: 'taxi', label: 'Taxi direction and tracks' },
      ],
    },
    {
      id: 'arrows',
      label: 'Arrowheads',
      purpose:
        'Show source and mid-edge head shapes, then inspect hollow head widths and gaps.',
      expected:
        'Source, mid-source and mid-target head values are shown in color-coded rows; hollow end widths visibly change the outline.',
      views: [
        { id: 'shapes', label: 'Source and mid-head shapes' },
        { id: 'scalars', label: 'Hollow widths, scale and gaps' },
      ],
    },
    {
      id: 'labels',
      label: 'Labels',
      purpose: 'Compare node text and edge endpoint labels.',
      expected:
        'Text transform, alignment, wrapping, opacity, outline, border and source/target labels are visible.',
      views: [
        { id: 'nodes', label: 'Node text' },
        { id: 'edges', label: 'Edge and endpoint text' },
        {
          id: 'font-keywords',
          label: 'Font weight and text borders',
          controlOptions: fontSelectors,
        },
      ],
    },
    {
      id: 'images',
      label: 'Images',
      purpose:
        'Compare image fit, clip, repeat, containment, smoothing and position.',
      expected:
        'Local SVG patterns make each image setting easy to distinguish.',
      views: [{ id: 'layers', label: 'Image layers' }],
    },
    {
      id: 'charts',
      label: 'Charts',
      purpose:
        'Compare pie, stripe, heat and signed bar charts with fixed readable scales.',
      expected:
        'The values cover one, sixteen, eighteen and 255 slots; the wide 255-slot sample uses equal positive fractions so all authored values contribute.',
      views: [
        { id: 'palette', label: 'Pie and stripes' },
        { id: 'heat', label: 'Heat and radial heat' },
        { id: 'bars', label: 'Signed bars' },
      ],
    },
    {
      id: 'compounds',
      label: 'Compound hulls and miniatures',
      purpose:
        'Compare hull contours, parent sizing, padding and collapsed miniature scale.',
      expected:
        'Three hull contours sit beside a crossing edge; parent-sizing views show authored padding and the collapsed 0.3 miniature beside its expanded reference.',
      views: [
        { id: 'hulls', label: 'Three hull contours · include labels' },
        { id: 'hulls-exclude', label: 'Three hull contours · exclude labels' },
        { id: 'minimums', label: 'Minimum parent size' },
        {
          id: 'padding-width',
          label: 'Percent padding and reference scale',
          controlOptions: { paddingRelativeTo: paddingRelativeSelector },
        },
        { id: 'padding-sides', label: 'Direct padding sides' },
        { id: 'miniature', label: 'Collapsed miniature' },
      ],
    },
    {
      id: 'emphasis',
      label: 'Declutter and emphasis',
      purpose: 'Show label priority, culling and the core dim opacity.',
      expected:
        'The overlap cell keeps the higher-priority label; emphasize/clear changes the focus neighborhood and dims the rest.',
      views: [
        {
          id: 'declutter',
          label: 'Declutter and emphasis',
          controlOptions: {
            labelDeclutter: labelDeclutterSelector,
            dimOpacity: dimOpacitySelector,
          },
        },
      ],
    },
    {
      id: 'mappers',
      label: 'Mappers',
      purpose:
        'Compare fixed numeric mapping, data-driven case mapping and a legend-backed scale.',
      expected:
        'Node fill and size, edge width and color resolve from data; the slider changes the mapped value.',
      views: [{ id: 'scales', label: 'Continuous and case mappers' }],
    },
  ];

  const goldenCases = catalog.flatMap((family) =>
    family.views.flatMap((view) => {
      const baseCase = {
        name: `feature-${family.id}-${view.id}`,
        familyId: family.id,
        viewId: view.id,
        label: `${family.label}: ${view.label}`,
        params: {},
        ...(view.goldenOmissionReason
          ? { goldenOmissionReason: view.goldenOmissionReason }
          : {}),
      };
      const stateCases = Object.entries(view.controlOptions ?? {}).flatMap(
        ([selectorId, selector]) =>
          (selector.values ?? [])
            .filter(
              ({ value }) => String(value) !== String(selector.defaultValue),
            )
            .map((state) => ({
              name: `feature-${family.id}-${view.id}-${selectorId}-${String(
                state.value,
              )
                .toLowerCase()
                .replace(/[^a-z\d]+/g, '-')}`,
              familyId: family.id,
              viewId: view.id,
              stateId: `${selectorId}-${state.value}`,
              label: `${family.label}: ${view.label} · ${selector.property} ${state.value}`,
              params: { [selector.param]: state.value },
              ...(state.goldenOmissionReason
                ? { goldenOmissionReason: state.goldenOmissionReason }
                : {}),
            })),
      );

      return [baseCase, ...stateCases];
    }),
  );

  const nodeTypeKeywords = [
    'ellipse',
    'triangle',
    'round-triangle',
    'rectangle',
    'round-rectangle',
    'bottom-round-rectangle',
    'cut-rectangle',
    'barrel',
    'rhomboid',
    'right-rhomboid',
    'diamond',
    'round-diamond',
    'pentagon',
    'round-pentagon',
    'hexagon',
    'round-hexagon',
    'concave-hexagon',
    'heptagon',
    'round-heptagon',
    'octagon',
    'round-octagon',
    'star',
    'tag',
    'round-tag',
    'vee',
    'polygon',
  ];
  const edgeTypeKeywords = [
    ['bezier', 'bezier'],
    ['unbundled-bezier', 'unbundled-bezier'],
    ['multi-unbundled-bezier', 'unbundled-bezier'],
    ['straight', 'straight'],
    ['haystack', 'haystack'],
    ['segments', 'segments'],
    ['round-segments', 'round-segments'],
    ['taxi', 'taxi'],
    ['round-taxi', 'round-taxi'],
    ['straight-triangle', 'straight-triangle'],
  ];
  const arrowKeywords = [
    'triangle',
    'triangle-tee',
    'circle-triangle',
    'triangle-backcurve',
    'vee',
    'tee',
    'square',
    'circle',
    'diamond',
    'chevron',
    'none',
  ];
  const labelCells = [
    ['top', 'left'],
    ['top', 'center'],
    ['top', 'right'],
    ['center', 'left'],
    ['center', 'center'],
    ['center', 'right'],
    ['bottom', 'left'],
    ['bottom', 'center'],
    ['bottom', 'right'],
  ];
  const legacyRoutes = [
    {
      network: 'node-types',
      query: '?network=node-types',
      label: 'Node shapes · all leaf keywords',
      coverage: coverage(
        [
          {
            group: 'nodes',
            property: 'shape-polygon-points',
            target: 'polygon',
            value: [
              -0.33, -1, 0.33, -1, 0.33, -0.33, 1, -0.33, 1, 0.33, 0.33, 0.33,
              0.33, 1, -0.33, 1, -0.33, 0.33, -1, 0.33, -1, -0.33, -0.33, -0.33,
            ],
          },
          { group: 'nodes', property: 'width', target: 'ellipse', value: 40 },
          { group: 'nodes', property: 'height', target: 'ellipse', value: 40 },
        ],
        nodeTypeKeywords.map((value) => ({
          group: 'nodes',
          property: 'shape',
          target: value,
          value,
          alternate: value === 'ellipse' ? 'triangle' : 'ellipse',
        })),
      ),
    },
    {
      network: 'edge-types',
      query: '?network=edge-types',
      label: 'Edge routes · all curve families',
      coverage: coverage(
        [
          { group: 'edges', property: 'width', target: 's9-0', value: 10 },
          {
            group: 'edges',
            property: 'control-point-distances',
            target: 's1-0',
            value: [120],
          },
          {
            group: 'edges',
            property: 'control-point-weights',
            target: 's1-0',
            value: [0.1],
          },
          {
            group: 'edges',
            property: 'control-point-distances',
            target: 's2-0',
            value: [40, -40],
          },
          {
            group: 'edges',
            property: 'control-point-weights',
            target: 's2-0',
            value: [0.25, 0.75],
          },
          {
            group: 'edges',
            property: 'segment-distances',
            target: 's5-0',
            value: [40, -40],
          },
          {
            group: 'edges',
            property: 'segment-weights',
            target: 's5-0',
            value: [0.25, 0.75],
          },
          {
            group: 'edges',
            property: 'segment-radii',
            target: 's6-0',
            value: [15, 15],
          },
          {
            group: 'edges',
            property: 'haystack-radius',
            target: 's4-0',
            value: 0.5,
          },
          {
            group: 'edges',
            property: 'taxi-direction',
            target: 's7-0',
            value: 'downward',
          },
          { group: 'edges', property: 'taxi-turn', target: 's7-0', value: 20 },
          {
            group: 'edges',
            property: 'taxi-turn-min-distance',
            target: 's7-0',
            value: 5,
          },
          {
            group: 'edges',
            property: 'taxi-radius',
            target: 's8-0',
            value: 10,
          },
        ],
        edgeTypeKeywords.map(([fixtureType, value], index) => ({
          group: 'edges',
          property: 'curve-style',
          target: `s${index}-0`,
          value,
          alternate: value === 'straight' ? 'bezier' : 'straight',
          ...(fixtureType === 'multi-unbundled-bezier'
            ? {
                note: 'The fixture’s multi row resolves to the unbundled-bezier renderer family.',
              }
            : {}),
        })),
      ),
    },
    {
      network: 'edge-arrows',
      query: '?network=edge-arrows',
      label: 'Edge arrows · all head shapes and fill modes',
      coverage: coverage(
        [],
        [
          ...arrowKeywords.map((value, index) => ({
            group: 'edges',
            property: 'target-arrow-shape',
            target: `e${index}`,
            value,
            alternate: value === 'none' ? 'triangle' : 'none',
          })),
          ...arrowKeywords.map((_, index) => ({
            group: 'edges',
            property: 'target-arrow-fill',
            target: `e${index}`,
            value:
              arrowKeywords[index] === 'triangle-tee' ||
              Math.floor(index / 3) % 2 === 1
                ? 'hollow'
                : 'filled',
            alternate:
              arrowKeywords[index] === 'triangle-tee' ||
              Math.floor(index / 3) % 2 === 1
                ? 'filled'
                : 'hollow',
          })),
        ],
      ),
    },
    {
      network: 'labels',
      query: '?network=labels',
      label: 'Labels · anchors, wrapping and decoration',
      coverage: coverage(
        [
          {
            group: 'nodes',
            property: 'text-wrap',
            target: 'multiline-manual',
            value: 'wrap',
          },
          {
            group: 'nodes',
            property: 'text-max-width',
            target: 'multiline-auto',
            value: 80,
          },
          {
            group: 'nodes',
            property: 'text-rotation',
            target: 'rotated',
            value: Math.PI / 6,
          },
          {
            group: 'nodes',
            property: 'text-outline-width',
            target: 'outline',
            value: 3,
          },
          {
            group: 'nodes',
            property: 'text-outline-color',
            target: 'outline',
            value: '#5b6472',
          },
          {
            group: 'nodes',
            property: 'text-background-opacity',
            target: 'background',
            value: 1,
          },
          {
            group: 'nodes',
            property: 'text-background-color',
            target: 'background',
            value: '#888',
          },
          {
            group: 'nodes',
            property: 'text-background-shape',
            target: 'background',
            value: 'round-rectangle',
          },
          {
            group: 'nodes',
            property: 'text-background-padding',
            target: 'background',
            value: 3,
          },
          {
            group: 'nodes',
            property: 'text-border-width',
            target: 'background',
            value: 1,
          },
          {
            group: 'nodes',
            property: 'text-border-color',
            target: 'background',
            value: '#1d2433',
          },
          {
            group: 'nodes',
            property: 'color',
            target: 'outline',
            value: '#fff',
          },
          {
            group: 'edges',
            property: 'text-rotation',
            target: 'ar',
            value: 'autorotate',
          },
        ],
        [
          ...labelCells.map(([valign, halign], index) => ({
            group: 'nodes',
            property: 'text-valign',
            target: `align${index}`,
            value: valign,
            alternate: valign === 'top' ? 'bottom' : 'top',
          })),
          ...labelCells.map(([valign, halign], index) => ({
            group: 'nodes',
            property: 'text-halign',
            target: `align${index}`,
            value: halign,
            alternate: halign === 'left' ? 'right' : 'left',
          })),
          ...[
            ['none', 'align0'],
            ['wrap', 'multiline-manual'],
            ['ellipsis', 'ellipsis'],
          ].map(([value, target]) => ({
            group: 'nodes',
            property: 'text-wrap',
            target,
            value,
            alternate: value === 'none' ? 'wrap' : 'none',
          })),
        ],
      ),
    },
  ];

  const builder = (id, view) => {
    switch (id) {
      case 'paint':
        if (view === 'nodes') return paintNodes();
        if (view === 'fills') return paintFills();
        if (view === 'borders') return paintBorders();
        if (view === 'ghosts') return paintGhosts();
        if (view === 'layers') return paintLayers();
        if (view === 'edges') return paintEdges();
        if (view === 'outlines') return paintOutlines();
        break;
      case 'shapes':
        if (view === 'underlays') return shapesUnderlays();
        break;
      case 'edges':
        if (view === 'routes') return edgeRoutes('routes');
        if (view === 'endpoints') return edgeRoutes('endpoints');
        if (view === 'radius-arc' || view === 'radius-influence')
          return edgeRoutes(view);
        if (view === 'loops') return edgeLoops();
        if (view === 'taxi') return edgeTaxi();
        break;
      case 'arrows':
        if (view === 'shapes' || view === 'scalars') return arrows(view);
        break;
      case 'labels':
        if (
          view === 'nodes' ||
          view === 'edges' ||
          view === 'font-keywords' ||
          view.startsWith('font-family-') ||
          view.startsWith('font-style-') ||
          view.startsWith('node-') ||
          view.startsWith('edge-')
        )
          return labels(view);
        break;
      case 'images':
        if (view === 'layers') return images();
        break;
      case 'charts':
        if (view === 'palette' || view === 'heat' || view === 'bars')
          return charts(view);
        break;
      case 'compounds':
        if (
          view === 'hulls' ||
          view === 'hulls-exclude' ||
          view === 'minimums' ||
          view === 'miniature' ||
          view.startsWith('padding-')
        )
          return compounds(view);
        break;
      case 'emphasis':
        if (view === 'declutter') return emphasis();
        break;
      case 'mappers':
        if (view === 'scales') return mappers();
        break;
    }

    return null;
  };

  const firstView = (id) =>
    catalog.find((family) => family.id === id)?.views[0]?.id;

  const applyRouteState = (result, id, viewId, params) => {
    const definitions = [
      ...(result.elements?.nodes ?? []),
      ...(result.elements?.edges ?? []),
    ];
    const byId = new Map(
      definitions.map((element) => [element.data.id, element]),
    );

    if (id === 'labels' && viewId === 'font-keywords') {
      const fontWeight = selectedFontValue(
        params,
        'fontWeight',
        fontWeightValues,
        400,
      );
      const fontStyle = selectedFontValue(
        params,
        'fontStyle',
        fontStyleValues,
        'normal',
      );
      const fontFamily = selectedFontValue(
        params,
        'fontFamily',
        fontFamilyValues,
        'Open Sans',
      );
      result.style.nodes['font-weight'] = fontWeight;
      result.style.nodes['font-style'] = fontStyle;
      result.style.nodes['font-family'] = fontFamily;

      const setRows = (rows, property, value, alternate) => {
        const row = rows.find((entry) => entry.property === property);
        if (row != null) {
          row.value = value;
          row.alternate = alternate;
          return;
        }

        rows.push({
          group: 'nodes',
          property,
          target: 'label-weight-sample',
          value,
          alternate,
        });
      };
      const weightAlternate = String(fontWeight) === '400' ? 700 : 400;
      const styleAlternate = fontStyle === 'normal' ? 'italic' : 'normal';
      const familyAlternate = fontFamily === 'serif' ? 'monospace' : 'serif';
      setRows(
        result.coverage.properties,
        'font-weight',
        fontWeight,
        weightAlternate,
      );
      setRows(
        result.coverage.properties,
        'font-style',
        fontStyle,
        styleAlternate,
      );
      setRows(
        result.coverage.properties,
        'font-family',
        fontFamily,
        familyAlternate,
      );
      setRows(
        result.coverage.keywords,
        'font-weight',
        fontWeight,
        weightAlternate,
      );
      setRows(
        result.coverage.keywords,
        'font-style',
        fontStyle,
        styleAlternate,
      );
      const selectedOptions = (options, selectedValue) => ({
        ...options,
        selectedValue,
        values: options.values.map((state) => ({
          ...state,
          selected: String(state.value) === String(selectedValue),
        })),
      });
      result.controlOptions = {
        fontWeight: selectedOptions(fontSelectors.fontWeight, fontWeight),
        fontStyle: selectedOptions(fontSelectors.fontStyle, fontStyle),
        fontFamily: selectedOptions(fontSelectors.fontFamily, fontFamily),
      };
    }

    if (id === 'compounds' && viewId === 'padding-width') {
      const relativeTo = selectedFontValue(
        params,
        'paddingRelativeTo',
        paddingRelativeValues,
        'width',
      );
      result.style.parents['padding-relative-to'] = relativeTo;
      const parent = byId.get('parent-padding');
      if (parent != null)
        parent.data.label = `padding 18% relative to ${relativeTo}`;
      for (const rows of [
        result.coverage.properties,
        result.coverage.keywords,
      ]) {
        const relativeRow = rows.find(
          (row) => row.property === 'padding-relative-to',
        );
        if (relativeRow != null) {
          relativeRow.value = relativeTo;
          relativeRow.alternate = relativeTo === 'width' ? 'height' : 'width';
        }
      }
      const selector = paddingRelativeSelector;
      result.controlOptions = {
        paddingRelativeTo: {
          ...selector,
          selectedValue: relativeTo,
          values: selector.values.map((state) => ({
            ...state,
            selected: state.value === relativeTo,
          })),
        },
      };
    }

    if (id === 'emphasis' && viewId === 'declutter') {
      const labelDeclutter = selectedFontValue(
        params,
        'labelDeclutter',
        labelDeclutterValues,
        'cull',
      );
      const dimOpacity = numericParam(params, 'dimOpacity', 0.52, 0, 1);
      result.style.core['label-declutter'] = labelDeclutter;
      result.style.core['dim-opacity'] = dimOpacity;
      result.initialState = {
        emphasize: [
          'focus',
          'neighbor-a',
          'neighbor-b',
          'neighbor-c',
          'neighbor-d',
        ],
      };

      const setCoreCoverage = (property, value, alternate) => {
        const rowGroups =
          property === 'label-declutter'
            ? [result.coverage.properties, result.coverage.keywords]
            : [result.coverage.properties];
        for (const rows of rowGroups) {
          const existing = rows.find((row) => row.property === property);
          if (existing != null) {
            existing.value = value;
            existing.alternate = alternate;
          } else {
            rows.push({
              group: 'core',
              property,
              target: 'core',
              value,
              alternate,
            });
          }
        }
      };
      setCoreCoverage(
        'label-declutter',
        labelDeclutter,
        labelDeclutter === 'cull' ? 'none' : 'cull',
      );
      setCoreCoverage('dim-opacity', dimOpacity, dimOpacity === 0 ? 1 : 0);
      result.controlOptions = {
        labelDeclutter: {
          ...labelDeclutterSelector,
          selectedValue: labelDeclutter,
          values: labelDeclutterSelector.values.map((state) => ({
            ...state,
            selected: state.value === labelDeclutter,
          })),
        },
        dimOpacity: {
          ...dimOpacitySelector,
          selectedValue: dimOpacity,
        },
      };
    }

    if (id === 'charts') {
      const targets = {
        palette: {
          id: 'chart-pie-16',
          extremeId: 'chart-stripes-255',
          directionId: 'chart-stripes-18',
          kinds: ['pie', 'stripes'],
          hasHole: true,
          hasAngle: true,
        },
        heat: {
          id: 'chart-radial-heat',
          extremeId: 'chart-heat',
          kinds: ['heat-strip', 'radial-heat'],
          hasHole: true,
          hasAngle: true,
        },
        bars: {
          id: 'chart-bar-horizontal',
          extremeId: 'chart-bar-negative',
          kinds: ['bar'],
          hasHole: false,
          hasAngle: false,
        },
      };
      const target = targets[viewId];
      const definition = target && byId.get(target.id);

      if (definition != null) {
        const kind = getParam(params, 'chartKind');
        if (target.kinds.includes(kind)) definition.data.kind = kind;

        const bypass = ((result.style.bypasses ??= {})[target.id] ??= {});
        const chartInputs = [
          ...(target.hasHole
            ? [['chartHole', 'chart-hole', null, 0, 0.8]]
            : []),
          ...(target.hasAngle
            ? [['chartAngle', 'chart-start-angle', null, 0, 6.28]]
            : []),
          ['chartSize', 'chart-size', null, 0.1, 1],
          ['chartOpacity', 'chart-opacity', null, 0, 1],
        ];
        for (const [paramName, property, fallback, min, max] of chartInputs) {
          const value = numericParam(params, paramName, fallback, min, max);
          if (value != null) bypass[property] = value;
        }

        const direction = getParam(params, 'chartDirection');
        if (
          ['bars', 'palette'].includes(viewId) &&
          ['vertical', 'horizontal'].includes(direction)
        ) {
          const directionTarget = byId.get(target.directionId ?? target.id);
          if (directionTarget != null) {
            ((result.style.bypasses ??= {})[directionTarget.data.id] ??= {})[
              'chart-direction'
            ] = direction;
          }
        }

        if (viewId === 'bars') {
          const domain = String(getParam(params, 'chartDomain') ?? '')
            .trim()
            .split(/[ ,]+/)
            .map(Number);
          if (
            domain.length === 2 &&
            domain.every(Number.isFinite) &&
            domain[0] < domain[1]
          ) {
            result.style.nodes['chart-domain'] = domain;
          }
        }

        if (getParam(params, 'chartExtreme') === '1') {
          const extreme = byId.get(target.extremeId);
          if (
            Array.isArray(extreme?.data?.values) &&
            extreme.data.values.length > 0
          ) {
            extreme.data.values[extreme.data.values.length - 1] =
              extreme.data.values.length === 255 ? 90 : 12;
          }
        }
      }
    }

    if (id === 'mappers') {
      const mid = byId.get('map-mid');
      if (mid != null) {
        mid.data.score = numericParam(params, 'mapperScore', 5, 0, 10);
        if (getParam(params, 'mapperBypass') === '1') {
          (result.style.bypasses ??= {})['map-mid'] = {
            'background-color': '#ff00ff',
          };
        }
      }
    }

    if (id === 'compounds' && viewId === 'miniature') {
      const factor = numericParam(params, 'collapseFactor', 0.3, 0.05, 1);
      result.style.parents['collapse-scale'] = factor;
      const parent = byId.get('parent-mini');

      if (parent != null) {
        for (const [childId, dx, dy] of [
          ['mini-child-a', -55, -20],
          ['mini-child-b', 55, 20],
        ]) {
          const child = byId.get(childId);
          if (child != null)
            child.position = {
              x: parent.position.x + dx * factor,
              y: parent.position.y + dy * factor,
            };
        }
      }
    }

    return result;
  };

  const create = (id, viewId = firstView(id), params) => {
    const family = catalog.find((entry) => entry.id === id);

    if (family == null) {
      throw new Error(`Unknown feature scene '${id}'`);
    }

    const view = family.views.find((entry) => entry.id === viewId);

    if (view == null) {
      throw new Error(`Unknown view '${viewId}' for feature scene '${id}'`);
    }

    const result = applyRouteState(builder(id, viewId), id, viewId, params);

    if (result == null) {
      throw new Error(`No builder for feature scene '${id}/${viewId}'`);
    }

    return {
      ...result,
      id: `${id}/${viewId}`,
      familyId: id,
      viewId,
      label: view.label,
      purpose: family.purpose,
      expected: family.expected,
      initialState: result.initialState,
      controlOptions:
        Object.keys(result.controlOptions ?? {}).length > 0
          ? result.controlOptions
          : (view.controlOptions ?? {}),
      goldenOmissionReason: view.goldenOmissionReason,
    };
  };

  const mountControls = ({
    container,
    sceneId,
    viewId,
    cy,
    params,
    onViewChange,
  } = {}) => {
    if (container == null || typeof container.appendChild !== 'function') {
      return { destroy() {} };
    }

    const document = container.ownerDocument;
    const root = document.createElement('div');
    root.className = 'feature-scene-controls';
    root.dataset.featureScenes = 'true';

    const selectControl = (labelText, values, controlName) => {
      const label = document.createElement('label');
      label.className = 'feature-scene-control';
      label.appendChild(document.createTextNode(`${labelText} `));
      const select = document.createElement('select');
      if (controlName != null) select.dataset.control = controlName;
      values.forEach(({ id, label: text }) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = text;
        select.appendChild(option);
      });
      label.appendChild(select);
      root.appendChild(label);
      return select;
    };

    const currentFamily = () =>
      catalog.find((entry) => entry.id === sceneId) ?? catalog[0];
    const familySelect = selectControl(
      'Feature',
      catalog.map(({ id, label }) => ({ id, label })),
    );
    familySelect.value = currentFamily().id;
    const viewSelect = selectControl('View', currentFamily().views);
    viewSelect.value = viewId ?? currentFamily().views[0].id;

    const report = document.createElement('output');
    report.className = 'feature-scene-readout';
    report.setAttribute('aria-live', 'polite');
    root.appendChild(report);

    const fullReadout = document.createElement('details');
    fullReadout.className = 'feature-scene-full-readout';
    const fullSummary = document.createElement('summary');
    fullSummary.textContent = 'Full chart and legend metadata';
    fullReadout.appendChild(fullSummary);
    const fullPre = document.createElement('pre');
    fullReadout.appendChild(fullPre);

    const callChange = () => {
      if (typeof onViewChange === 'function') {
        onViewChange(familySelect.value, viewSelect.value);
      }
    };
    familySelect.addEventListener('change', () => {
      const family =
        catalog.find((entry) => entry.id === familySelect.value) ?? catalog[0];
      while (viewSelect.firstChild)
        viewSelect.removeChild(viewSelect.firstChild);
      family.views.forEach(({ id, label }) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = label;
        viewSelect.appendChild(option);
      });
      viewSelect.value = family.views[0].id;
      callChange();
    });
    viewSelect.addEventListener('change', callChange);

    const button = (label, action) => {
      const control = document.createElement('button');
      control.className = 'feature-scene-control';
      control.type = 'button';
      control.textContent = label;
      control.addEventListener('click', action);
      root.appendChild(control);
    };

    if (sceneId === 'emphasis' && cy != null) {
      button('Emphasize focus', () => {
        const focus = cy.$id('focus');
        if (focus.length) cy.emphasize(focus.closedNeighborhood());
      });
      button('Clear emphasis', () => cy.unemphasize());
    }

    if (sceneId === 'labels' && viewId === 'font-keywords' && cy != null) {
      const sample = cy.$id('label-weight-sample');
      const fontControls = [
        ['fontWeight', 'Font weight', fontWeightValues],
        ['fontStyle', 'Font style', fontStyleValues],
        ['fontFamily', 'Font family', fontFamilyValues],
      ];
      const selectors = new Map();
      const updateFont = (property, paramName, rawValue) => {
        const values = {
          fontWeight: fontWeightValues,
          fontStyle: fontStyleValues,
          fontFamily: fontFamilyValues,
        }[paramName];
        const value = selectedFontValue(
          { [paramName]: rawValue },
          paramName,
          values,
          values[0],
        );
        const sheet = JSON.parse(JSON.stringify(cy.style().json()));
        sheet.nodes[property] = value;
        cy.style(sheet);
        saveControlParams({ [paramName]: value });
        report.textContent = `Font weight ${sample.style('font-weight')} · style ${sample.style('font-style')} · family ${sample.style('font-family')}`;
      };

      for (const [paramName, label, values] of fontControls) {
        const property = {
          fontWeight: 'font-weight',
          fontStyle: 'font-style',
          fontFamily: 'font-family',
        }[paramName];
        const select = selectControl(
          label,
          values.map((value) => ({ id: String(value), label: String(value) })),
          paramName,
        );
        select.value = String(sample.style(property));
        select.addEventListener('change', () =>
          updateFont(property, paramName, select.value),
        );
        selectors.set(paramName, select);
      }

      button('Reset font controls', () => {
        const defaults = {
          fontWeight: 400,
          fontStyle: 'normal',
          fontFamily: 'Open Sans',
        };
        const sheet = JSON.parse(JSON.stringify(cy.style().json()));
        for (const [paramName, value] of Object.entries(defaults)) {
          const property = {
            fontWeight: 'font-weight',
            fontStyle: 'font-style',
            fontFamily: 'font-family',
          }[paramName];
          sheet.nodes[property] = value;
          selectors.get(paramName).value = String(value);
        }
        cy.style(sheet);
        saveControlParams({
          fontWeight: null,
          fontStyle: null,
          fontFamily: null,
        });
        report.textContent = `Font weight ${sample.style('font-weight')} · style ${sample.style('font-style')} · family ${sample.style('font-family')}`;
      });
      report.textContent = `Font weight ${sample.style('font-weight')} · style ${sample.style('font-style')} · family ${sample.style('font-family')}`;
    }

    if (sceneId === 'compounds' && viewId === 'padding-width' && cy != null) {
      const parent = cy.$id('parent-padding');
      const select = selectControl(
        'Padding reference',
        paddingRelativeSelector.values.map(({ value }) => ({
          id: value,
          label: value,
        })),
        'paddingRelativeTo',
      );
      const initialValue =
        getParam(params, 'paddingRelativeTo') ??
        parent.style('padding-relative-to') ??
        paddingRelativeSelector.defaultValue;
      select.value = String(initialValue);
      const setRelativeTo = (value, persist = true) => {
        const sheet = JSON.parse(JSON.stringify(cy.style().json()));
        sheet.parents['padding-relative-to'] = value;
        cy.style(sheet);
        parent.data('label', `padding 18% relative to ${value}`);
        report.textContent = `18% padding relative to ${value}`;
        if (persist) saveControlParams({ paddingRelativeTo: value });
      };
      select.addEventListener('change', () => setRelativeTo(select.value));
      button('Reset padding reference', () => {
        select.value = paddingRelativeSelector.defaultValue;
        setRelativeTo(paddingRelativeSelector.defaultValue, false);
        saveControlParams({ paddingRelativeTo: null });
      });
      report.textContent = `18% padding relative to ${select.value}`;
    }

    if (sceneId === 'emphasis' && viewId === 'declutter' && cy != null) {
      const select = selectControl(
        'Label declutter',
        labelDeclutterSelector.values.map(({ value }) => ({
          id: value,
          label: value,
        })),
        'labelDeclutter',
      );
      const opacity = document.createElement('input');
      opacity.type = 'range';
      opacity.min = String(dimOpacitySelector.min);
      opacity.max = String(dimOpacitySelector.max);
      opacity.step = String(dimOpacitySelector.step);
      const opacityLabel = document.createElement('label');
      opacityLabel.className = 'feature-scene-control';
      opacityLabel.appendChild(document.createTextNode('Dim opacity '));
      const opacityValue = document.createElement('output');
      opacityLabel.appendChild(opacity);
      opacityLabel.appendChild(opacityValue);
      root.appendChild(opacityLabel);

      const sheetNow = () => JSON.parse(JSON.stringify(cy.style().json()));
      const currentSheet = sheetNow();
      select.value = String(
        getParam(params, 'labelDeclutter') ??
          currentSheet.core?.['label-declutter'] ??
          labelDeclutterSelector.defaultValue,
      );
      opacity.value = String(
        numericParam(
          params,
          'dimOpacity',
          Number(
            currentSheet.core?.['dim-opacity'] ??
              dimOpacitySelector.defaultValue,
          ),
          dimOpacitySelector.min,
          dimOpacitySelector.max,
        ),
      );
      opacityValue.textContent = opacity.value;

      const updateCore = (updates, persist = true) => {
        const sheet = sheetNow();
        Object.assign((sheet.core ??= {}), updates);
        cy.style(sheet);
        report.textContent = `label declutter ${sheet.core['label-declutter']} · dim opacity ${sheet.core['dim-opacity']}`;
        if (persist) {
          saveControlParams({
            labelDeclutter: sheet.core['label-declutter'],
            dimOpacity: sheet.core['dim-opacity'],
          });
        }
      };
      select.addEventListener('change', () =>
        updateCore({ 'label-declutter': select.value }),
      );
      opacity.addEventListener('input', () => {
        opacityValue.textContent = opacity.value;
        updateCore({ 'dim-opacity': Number(opacity.value) });
      });
      button('Reset declutter controls', () => {
        select.value = labelDeclutterSelector.defaultValue;
        opacity.value = String(dimOpacitySelector.defaultValue);
        opacityValue.textContent = opacity.value;
        updateCore(
          {
            'label-declutter': labelDeclutterSelector.defaultValue,
            'dim-opacity': dimOpacitySelector.defaultValue,
          },
          false,
        );
        saveControlParams({ labelDeclutter: null, dimOpacity: null });
      });
      report.textContent = `label declutter ${select.value} · dim opacity ${opacity.value}`;
    }

    if (sceneId === 'compounds' && viewId === 'miniature' && cy != null) {
      const parent = cy.$id('parent-mini');
      const miniature = cy.$id('mini-child-a');
      const readMiniature = () => {
        const bounds = miniature.boundingBox({ includeLabels: false });
        report.textContent = `collapse-scale ${parent.style('collapse-scale')} · ${parent.collapsed() ? 'collapsed' : 'expanded'} · child bounds ${Math.round(bounds.w)} × ${Math.round(bounds.h)}`;
      };
      const factorLabel = document.createElement('label');
      factorLabel.className = 'feature-scene-control';
      factorLabel.appendChild(document.createTextNode('Collapse factor '));
      const factorInput = document.createElement('input');
      factorInput.type = 'range';
      factorInput.min = '0.1';
      factorInput.max = '1';
      factorInput.step = '0.05';
      factorInput.value = String(parent.style('collapse-scale'));
      const factorOutput = document.createElement('output');
      factorOutput.textContent = factorInput.value;
      factorLabel.append(factorInput, factorOutput);
      factorInput.addEventListener('input', () => {
        const factor = Number(factorInput.value);
        const collapsed = parent.collapsed();
        if (collapsed) parent.expand();
        parent.style('collapse-scale', factor);
        if (collapsed)
          parent.collapse({ duration: 360, easing: 'ease-in-out' });
        factorOutput.textContent = factorInput.value;
        saveControlParams({ collapseFactor: factorInput.value });
        readMiniature();
      });
      root.appendChild(factorLabel);

      const collapse = () => {
        parent.collapse({ duration: 360, easing: 'ease-in-out' });
        saveControlParams({ collapseExpanded: '0' });
        readMiniature();
      };
      const expand = () => {
        parent.expand({ duration: 360, easing: 'ease-in-out' });
        saveControlParams({ collapseExpanded: '1' });
        readMiniature();
      };
      button('Collapse miniature', collapse);
      button('Expand miniature', expand);

      if (getParam(params, 'collapseExpanded') === '1') parent.expand();
      readMiniature();
    }

    if (sceneId === 'charts' && cy != null) {
      const chartTargets = {
        palette: {
          id: 'chart-pie-16',
          extremeId: 'chart-stripes-255',
          directionId: 'chart-stripes-18',
          kinds: ['pie', 'stripes'],
          hasDirection: true,
          hasDomain: false,
          hasHole: true,
          hasAngle: true,
        },
        heat: {
          id: 'chart-radial-heat',
          extremeId: 'chart-heat',
          kinds: ['heat-strip', 'radial-heat'],
          hasDirection: false,
          hasDomain: false,
          hasHole: true,
          hasAngle: true,
        },
        bars: {
          id: 'chart-bar-horizontal',
          extremeId: 'chart-bar-negative',
          kinds: ['bar'],
          hasDirection: true,
          hasDomain: true,
          hasHole: false,
          hasAngle: false,
        },
      };
      const chartTarget = chartTargets[viewId];
      const target = chartTarget && cy.$id(chartTarget.id);
      const extremeTarget = chartTarget && cy.$id(chartTarget.extremeId);

      if (target?.length && extremeTarget?.length) {
        const baseline = builder(sceneId, viewId);
        const baselineElements = [
          ...(baseline.elements.nodes ?? []),
          ...(baseline.elements.edges ?? []),
        ];
        const baselineTarget = baselineElements.find(
          (element) => element.data.id === chartTarget.id,
        );
        const baselineExtreme = baselineElements.find(
          (element) => element.data.id === chartTarget.extremeId,
        );
        const initialValues = baselineExtreme.data.values.slice();
        const initialKind = baselineTarget.data.kind;
        const initialSheet = JSON.parse(JSON.stringify(baseline.style));
        const readout = () => {
          const legend = cy.legend();
          const chartScale = target.style('chart-scale');
          const chartDomain = target.style('chart-domain');
          const valueSummary = extremeTarget.data('values');
          const legendProperties = (legend.entries ?? [])
            .map((entry) => entry.property)
            .join(', ');
          report.textContent = [
            `Target ${chartTarget.id} · ${target.style('chart')}`,
            `hole ${target.style('chart-hole')} · angle ${target.style('chart-start-angle')} · direction ${target.style('chart-direction')}`,
            `size ${target.style('chart-size')} · opacity ${target.style('chart-opacity')} · domain ${chartDomain ?? chartScale ?? 'auto'}`,
            `${valueSummary.length} values on ${chartTarget.extremeId} · legend mappings: ${legendProperties || 'none'}`,
          ].join('\n');
          fullPre.textContent = JSON.stringify(
            {
              target: chartTarget.id,
              kind: target.style('chart'),
              hole: target.style('chart-hole'),
              angle: target.style('chart-start-angle'),
              direction: target.style('chart-direction'),
              size: target.style('chart-size'),
              opacity: target.style('chart-opacity'),
              domain: chartDomain,
              scale: chartScale,
              values: valueSummary,
              legend,
            },
            null,
            2,
          );
        };
        const selectChartProperty = (
          labelText,
          property,
          values,
          selectedTarget = target,
        ) => {
          const select = selectControl(
            labelText,
            values.map((value) => ({ id: value, label: value })),
          );
          select.value = String(selectedTarget.style(property));
          select.addEventListener('change', () => {
            if (property === 'chart') {
              selectedTarget.data('kind', select.value);
              saveControlParams({ chartKind: select.value });
            } else {
              selectedTarget.style(property, select.value);
              const paramName = {
                'chart-direction': 'chartDirection',
                'chart-hole': 'chartHole',
              }[property];
              if (paramName != null)
                saveControlParams({ [paramName]: select.value });
            }
            readout();
          });
          return select;
        };
        const rangeChartProperty = (
          labelText,
          property,
          paramName,
          min,
          max,
          step,
        ) => {
          const label = document.createElement('label');
          label.className = 'feature-scene-control';
          label.appendChild(document.createTextNode(`${labelText} `));
          const input = document.createElement('input');
          input.type = 'range';
          input.min = String(min);
          input.max = String(max);
          input.step = String(step);
          input.value = String(Number.parseFloat(target.style(property)) || 0);
          input.addEventListener('input', () => {
            target.style(property, Number(input.value));
            saveControlParams({ [paramName]: input.value });
            readout();
          });
          const value = document.createElement('output');
          value.textContent = input.value;
          input.addEventListener('input', () => {
            value.textContent = input.value;
          });
          label.appendChild(input);
          label.appendChild(value);
          root.appendChild(label);
        };

        if (chartTarget.kinds.length > 1)
          selectChartProperty('Chart kind', 'chart', chartTarget.kinds);
        if (chartTarget.hasHole)
          rangeChartProperty('Hole', 'chart-hole', 'chartHole', 0, 0.8, 0.05);
        if (chartTarget.hasAngle)
          rangeChartProperty(
            'Start angle',
            'chart-start-angle',
            'chartAngle',
            0,
            6.28,
            0.1,
          );
        rangeChartProperty(
          'Chart size',
          'chart-size',
          'chartSize',
          0.1,
          1,
          0.05,
        );
        rangeChartProperty(
          'Chart opacity',
          'chart-opacity',
          'chartOpacity',
          0,
          1,
          0.05,
        );
        if (chartTarget.hasDirection) {
          selectChartProperty(
            'Direction',
            'chart-direction',
            ['vertical', 'horizontal'],
            cy.$id(chartTarget.directionId ?? chartTarget.id),
          );
        }
        if (chartTarget.hasDomain) {
          const domainInput = document.createElement('input');
          domainInput.type = 'text';
          domainInput.value = String(target.style('chart-domain')).replace(
            /\s+/g,
            ' ',
          );
          const domainLabel = document.createElement('label');
          domainLabel.className = 'feature-scene-control';
          domainLabel.appendChild(document.createTextNode('Domain min max '));
          domainInput.addEventListener('change', () => {
            const [min, max] = domainInput.value
              .trim()
              .split(/[ ,]+/)
              .map(Number);
            if (Number.isFinite(min) && Number.isFinite(max) && min < max) {
              const updatedSheet = JSON.parse(
                JSON.stringify(cy.style().json()),
              );
              updatedSheet.nodes['chart-domain'] = [min, max];
              cy.style(updatedSheet);
              saveControlParams({ chartDomain: `${min} ${max}` });
              readout();
            }
          });
          domainLabel.appendChild(domainInput);
          root.appendChild(domainLabel);
        }
        button('Add chart extreme', () => {
          const values = extremeTarget.data('values').slice();
          values[values.length - 1] = values.length === 255 ? 90 : 12;
          extremeTarget.data('values', values);
          saveControlParams({ chartExtreme: '1' });
          readout();
        });
        button('Reset scene values', () => {
          extremeTarget.data('values', initialValues.slice());
          target.removeStyle();
          if (initialKind != null) target.data('kind', initialKind);
          cy.style(initialSheet);
          saveControlParams(
            Object.fromEntries(controlParamNames.map((key) => [key, null])),
          );
          if (typeof onViewChange === 'function') onViewChange(sceneId, viewId);
          else readout();
        });
        root.appendChild(fullReadout);
        readout();
      }
    }

    if (sceneId === 'mappers' && cy != null) {
      const inputLabel = document.createElement('label');
      inputLabel.appendChild(document.createTextNode('Mapped score '));
      const input = document.createElement('input');
      input.type = 'range';
      input.min = '0';
      input.max = '10';
      input.step = '1';
      input.value = String(cy.$id('map-mid').data('score') ?? 5);
      const mapped = cy.$id('map-mid');
      const updateMapperReadout = () => {
        report.textContent = `score ${mapped.data('score')} · color ${mapped.style('background-color')} · width ${mapped.style('width')} · local bypass ${mapped.style('background-color') === 'rgb(255,0,255)' ? 'on' : 'off'}`;
      };
      input.addEventListener('input', () => {
        mapped.data('score', Number(input.value));
        saveControlParams({ mapperScore: input.value });
        updateMapperReadout();
      });
      inputLabel.appendChild(input);
      root.appendChild(inputLabel);
      button('Toggle local color bypass', () => {
        if (mapped.style('background-color') === 'rgb(255,0,255)') {
          mapped.removeStyle('background-color');
          saveControlParams({ mapperBypass: '0' });
        } else {
          mapped.style('background-color', '#ff00ff');
          saveControlParams({ mapperBypass: '1' });
        }
        updateMapperReadout();
      });
      button('Reset mapper values', () => {
        mapped.data('score', 5);
        mapped.removeStyle('background-color');
        input.value = '5';
        saveControlParams({ mapperScore: null, mapperBypass: null });
        updateMapperReadout();
        if (typeof onViewChange === 'function') onViewChange(sceneId, viewId);
      });
      updateMapperReadout();
    }

    container.appendChild(root);
    return {
      root,
      destroy() {
        if (root.parentNode === container) container.removeChild(root);
      },
    };
  };

  return { catalog, create, goldenCases, legacyRoutes, mountControls };
});
