/* Pure scene builders for the visual feature harness. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory;
  if (root != null) (root.featureSceneParts ||= {}).compounds = factory;
})(typeof globalThis === 'undefined' ? this : globalThis, function (api) {
  const { image, node, edge, mapper, coverage, scene, baseStyle } = api;
  const compounds = (view) => {
    if (view === 'hulls' || view === 'hulls-exclude') {
      const hullSizing = view === 'hulls-exclude' ? 'exclude' : 'include';
      const nodes = [
        node('hull-convex', 0, 0, { label: 'convex hull' }),
        node('hull-convex-a', -36, -26, {
          parent: 'hull-convex',
          label: 'long child label beyond leaf',
        }),
        node('hull-convex-b', 34, -8, { parent: 'hull-convex', label: 'B' }),
        node('hull-convex-c', -10, 42, { parent: 'hull-convex', label: 'C' }),
        node('hull-round', 250, 0, { label: 'round convex' }),
        node('hull-round-a', 210, -32, { parent: 'hull-round', label: 'A' }),
        node('hull-round-b', 284, -12, { parent: 'hull-round', label: 'B' }),
        node('hull-round-c', 248, 42, { parent: 'hull-round', label: 'C' }),
        node('hull-concave', 500, 0, { label: 'concave hull' }),
        node('hull-concave-a', 458, -32, {
          parent: 'hull-concave',
          label: 'A',
        }),
        node('hull-concave-b', 532, -16, {
          parent: 'hull-concave',
          label: 'B',
        }),
        node('hull-concave-c', 495, 42, { parent: 'hull-concave', label: 'C' }),
        node('hull-outside', 710, 30, { label: 'outside' }),
      ];

      return scene(
        {
          nodes,
          edges: [
            edge('hull-crossing', 'hull-convex-b', 'hull-outside', {
              label: 'crossing edge',
            }),
          ],
        },
        {
          nodes: {
            width: 52,
            height: 38,
            'background-color': '#bad8c8',
            'border-width': 2,
            'border-color': '#347354',
            'text-halign': 'center',
            'text-valign': 'center',
            'text-wrap': 'none',
          },
          edges: {
            width: 3,
            'line-color': '#4d6375',
            'target-arrow-shape': 'triangle',
          },
          parents: {
            shape: 'rectangle',
            padding: 8,
            'background-color': '#76b596',
            'background-opacity': 0.38,
            'border-width': 3,
            'border-color': '#28714b',
            'text-valign': 'bottom',
            'text-margin-y': 12,
            'text-wrap': 'wrap',
            'text-max-width': 130,
            'compound-sizing-wrt-labels': hullSizing,
          },
          bypasses: {
            'hull-convex': { shape: 'convex-hull' },
            'hull-round': { shape: 'round-convex-hull' },
            'hull-concave': { shape: 'concave-hull' },
          },
        },
        {
          coverage: coverage(
            [
              {
                group: 'parents',
                property: 'compound-sizing-wrt-labels',
                target: 'hull-convex',
                value: hullSizing,
              },
              {
                group: 'parents',
                property: 'shape',
                target: 'hull-convex',
                value: 'convex-hull',
              },
              {
                group: 'parents',
                property: 'shape',
                target: 'hull-round',
                value: 'round-convex-hull',
              },
              {
                group: 'parents',
                property: 'shape',
                target: 'hull-concave',
                value: 'concave-hull',
              },
            ],
            [
              {
                group: 'parents',
                property: 'shape',
                target: 'hull-convex',
                value: 'convex-hull',
              },
              {
                group: 'parents',
                property: 'shape',
                target: 'hull-round',
                value: 'round-convex-hull',
              },
              {
                group: 'parents',
                property: 'shape',
                target: 'hull-concave',
                value: 'concave-hull',
              },
              {
                group: 'parents',
                property: 'compound-sizing-wrt-labels',
                target: 'hull-convex',
                value: hullSizing,
              },
            ],
          ),
          notes: [
            'Three compound contours remain visible beside a crossing edge. The convex group has one long child label extending beyond its node: include expands the parent to contain that label, while exclude sizes it around the child bodies.',
          ],
        },
      );
    }

    if (view === 'miniature') {
      const nodes = [
        node('parent-expanded', 75, 80, { label: 'expanded reference' }),
        node('expanded-child-a', 20, 60, {
          parent: 'parent-expanded',
          label: 'image child',
          url: image('#c64d4d', '<circle cx="24" cy="24" r="12" fill="#fff"/>'),
        }),
        node('expanded-child-b', 130, 100, {
          parent: 'parent-expanded',
          label: 'chart child',
          series: [2, 5, 3, 1],
        }),
        node(
          'parent-mini',
          325,
          80,
          { label: 'collapsed miniature' },
          { collapsed: true },
        ),
        node('mini-child-a', 308.5, 74, {
          parent: 'parent-mini',
          label: 'image child',
          url: image('#c64d4d', '<circle cx="24" cy="24" r="12" fill="#fff"/>'),
        }),
        node('mini-child-b', 341.5, 86, {
          parent: 'parent-mini',
          label: 'chart child',
          series: [2, 5, 3, 1],
        }),
        node('mini-outside', 540, 90, { label: 'outside' }),
      ];

      return scene(
        { nodes, edges: [edge('mini-edge', 'mini-child-a', 'mini-outside')] },
        {
          nodes: {
            width: 104,
            height: 72,
            shape: 'rectangle',
            'background-color': '#dce7f1',
            'border-color': '#344a5f',
            'border-width': 2,
            label: mapper('label', ''),
            'background-image': mapper('url', ''),
            'background-image-opacity': 0.95,
            chart: 'pie',
            'chart-values': { data: 'series' },
            'chart-colors': ['#c64d4d', '#e4a735', '#4e9c73', '#4772b1'],
            'chart-size': 0.55,
            'text-valign': 'bottom',
          },
          parents: {
            shape: 'rectangle',
            padding: 2,
            'collapse-scale': 0.3,
            'background-color': '#9cb8d0',
            'background-opacity': 0.5,
            'border-width': 2,
            'border-color': '#3f637f',
            'text-valign': 'bottom',
            'text-margin-y': 14,
            'text-wrap': 'wrap',
            'text-max-width': 140,
          },
        },
        {
          coverage: coverage([
            {
              group: 'parents',
              property: 'collapse-scale',
              target: 'parent-mini',
              value: 0.3,
            },
          ]),
          notes: [
            'The expanded group is the visual reference; the second group starts collapsed and uses the authored 0.3 miniature factor.',
          ],
        },
      );
    }

    if (view === 'minimums') {
      const nodes = [
        node('parent-minimums', 100, 100, {
          label: 'min-width 120\nmin-height 90',
        }),
        node('minimum-child-a', 80, 90, {
          parent: 'parent-minimums',
          label: 'small',
        }),
        node('minimum-child-b', 120, 110, {
          parent: 'parent-minimums',
          label: 'children',
        }),
      ];

      return scene(
        { nodes, edges: [] },
        {
          nodes: {
            width: 42,
            height: 32,
            'background-color': '#d8e8f2',
            label: mapper('label', ''),
          },
          parents: {
            padding: 6,
            'min-width': 120,
            'min-height': 90,
            'background-color': '#a6c5d7',
            'background-opacity': 0.55,
            'border-width': 2,
            'border-color': '#38647d',
            'text-valign': 'bottom',
            'text-margin-y': 12,
            'text-wrap': 'wrap',
            'text-max-width': 150,
          },
        },
        {
          coverage: coverage([
            {
              group: 'parents',
              property: 'min-width',
              target: 'parent-minimums',
              value: 120,
            },
            {
              group: 'parents',
              property: 'min-height',
              target: 'parent-minimums',
              value: 90,
            },
          ]),
        },
      );
    }

    const mode = view.slice('padding-'.length);
    const rel =
      mode === 'height' ||
      mode === 'average' ||
      mode === 'min' ||
      mode === 'max'
        ? mode
        : 'width';
    const sideMode = mode === 'sides';
    const nodes = [
      node('parent-padding', 100, 100, {
        label: sideMode
          ? 'padding sides\nL4 · T8 · R26 · B18'
          : `18% padding\nrelative to ${rel}`,
      }),
      node('padding-a', 65, 78, { parent: 'parent-padding', label: 'A' }),
      node('padding-b', 140, 110, { parent: 'parent-padding', label: 'B' }),
      node('padding-outside', 350, 100, { label: 'reference' }),
    ];
    const parentStyle = {
      padding: sideMode ? 0 : '18%',
      'padding-relative-to': rel,
      'background-color': '#abc7dc',
      'background-opacity': 0.5,
      'border-width': 2,
      'border-color': '#41657f',
      'text-valign': 'bottom',
      'text-margin-y': 14,
      'text-wrap': 'wrap',
      'text-max-width': 150,
    };

    if (sideMode) {
      parentStyle['padding-top'] = 8;
      parentStyle['padding-right'] = 26;
      parentStyle['padding-bottom'] = 18;
      parentStyle['padding-left'] = 4;
    }

    return scene(
      { nodes, edges: [] },
      {
        nodes: {
          width: 52,
          height: 38,
          label: mapper('label', ''),
        },
        parents: parentStyle,
      },
      {
        coverage: coverage(
          [
            ...(!sideMode
              ? [
                  {
                    group: 'parents',
                    property: 'padding-relative-to',
                    target: 'parent-padding',
                    value: rel,
                  },
                ]
              : []),
            {
              group: 'parents',
              property: 'padding',
              target: 'parent-padding',
              value: sideMode ? 0 : '18%',
            },
            ...(sideMode
              ? [
                  {
                    group: 'parents',
                    property: 'padding-top',
                    target: 'parent-padding',
                    value: 8,
                  },
                  {
                    group: 'parents',
                    property: 'padding-right',
                    target: 'parent-padding',
                    value: 26,
                  },
                  {
                    group: 'parents',
                    property: 'padding-bottom',
                    target: 'parent-padding',
                    value: 18,
                  },
                  {
                    group: 'parents',
                    property: 'padding-left',
                    target: 'parent-padding',
                    value: 4,
                  },
                ]
              : []),
          ],
          [
            ...(!sideMode
              ? [
                  {
                    group: 'parents',
                    property: 'padding-relative-to',
                    target: 'parent-padding',
                    value: rel,
                  },
                ]
              : []),
          ],
        ),
      },
    );
  };

  const emphasis = () => {
    const nodes = [
      node('focus', 180, 150, { label: 'focus\npriority 5', priority: 5 }),
      node('neighbor-a', 70, 75, { label: 'neighbor A', priority: 2 }),
      node('neighbor-b', 290, 75, { label: 'neighbor B', priority: 3 }),
      node('neighbor-c', 70, 225, { label: 'neighbor C', priority: 1 }),
      node('neighbor-d', 290, 225, { label: 'neighbor D', priority: 4 }),
      node('overlap-1', 465, 145, { label: 'overlap low', priority: 0 }),
      node('overlap-2', 495, 159, { label: 'overlap high', priority: 8 }),
      node('far-a', 480, 70, { label: 'far element', priority: 1 }),
      node('far-b', 480, 240, { label: 'far element', priority: 1 }),
    ];
    const edges = [
      edge('focus-a', 'focus', 'neighbor-a'),
      edge('focus-b', 'focus', 'neighbor-b'),
      edge('focus-c', 'focus', 'neighbor-c'),
      edge('focus-d', 'focus', 'neighbor-d'),
      edge('far-edge', 'far-a', 'far-b'),
    ];

    return scene(
      { nodes, edges },
      {
        nodes: {
          width: 92,
          height: 62,
          'background-color': {
            case: [{ when: { emphasized: true }, then: '#f3c55d' }],
            else: '#9ab5cd',
          },
          'border-width': 2,
          'border-color': '#31485e',
          'label-priority': mapper('priority', 0),
          'text-wrap': 'wrap',
          'text-max-width': 86,
          'font-size': 14,
          'text-valign': 'center',
          'text-halign': 'center',
          label: mapper('label', ''),
        },
        edges: { width: 3, 'line-color': '#657b8e' },
        core: { 'label-declutter': 'cull', 'dim-opacity': 0.52 },
      },
      {
        coverage: coverage(
          [
            {
              group: 'core',
              property: 'label-declutter',
              target: 'core',
              value: 'cull',
            },
            {
              group: 'core',
              property: 'dim-opacity',
              target: 'core',
              value: 0.52,
            },
            {
              group: 'nodes',
              property: 'label-priority',
              target: 'overlap-2',
              value: 8,
            },
          ],
          [
            {
              group: 'core',
              property: 'label-declutter',
              target: 'core',
              value: 'cull',
            },
          ],
        ),
        notes: [
          'Use Emphasize focus / Clear to invoke cy.emphasize() and cy.unemphasize(); in the right-side gap, the cull state keeps overlap high while none shows both priority labels.',
        ],
      },
    );
  };

  const mappers = () => {
    const nodes = [
      node('map-low', 100, 100, {
        label: 'low · 0',
        score: 0,
        family: 'A',
        size: 42,
      }),
      node('map-mid', 260, 100, {
        label: 'mid · 5',
        score: 5,
        family: 'B',
        size: 58,
      }),
      node('map-high', 420, 100, {
        label: 'high · 10',
        score: 10,
        family: 'A',
        size: 74,
      }),
      node('map-auto', 580, 100, {
        label: 'auto domain',
        score: 7,
        family: 'C',
        size: 64,
      }),
    ];

    return scene(
      {
        nodes,
        edges: [
          edge('map-edge-1', 'map-low', 'map-mid', { value: 0 }),
          edge('map-edge-2', 'map-mid', 'map-high', { value: 1 }),
        ],
      },
      {
        nodes: {
          width: mapper('size', 45),
          height: mapper('size', 45),
          'background-color': {
            data: 'score',
            scale: 'linear',
            domain: [0, 10],
            range: ['#3478b8', '#efaa3b'],
            fallback: '#888',
          },
          'border-color': {
            case: [
              { when: { data: 'family', eq: 'A' }, then: '#263d53' },
              { when: { data: 'family', eq: 'B' }, then: '#874c73' },
            ],
            else: '#397159',
          },
          'border-width': 4,
          label: mapper('label', ''),
        },
        edges: {
          width: { data: 'value', domain: [0, 1], range: [2, 9], fallback: 2 },
          'line-color': {
            data: 'value',
            scale: 'linear',
            domain: [0, 1],
            range: ['#4a78ad', '#d9534f'],
          },
          'target-arrow-shape': 'triangle',
        },
      },
      {
        coverage: coverage([
          {
            group: 'nodes',
            property: 'background-color',
            target: 'map-mid',
            value: 'rgb(152,150,141)',
          },
          { group: 'nodes', property: 'width', target: 'map-high', value: 74 },
          { group: 'edges', property: 'width', target: 'map-edge-2', value: 9 },
        ]),
        notes: [
          'Move the mapped value control to compare a fixed domain, a local bypass and the scale legend.',
        ],
      },
    );
  };

  return { compounds, emphasis, mappers };
});
