/* Pure scene builders for the visual feature harness. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory;
  if (root != null) (root.featureSceneParts ||= {}).charts = factory;
})(typeof globalThis === 'undefined' ? this : globalThis, function (api) {
  const { image, node, edge, mapper, coverage, scene, baseStyle } = api;
  const chartValues = (count, specials = false) =>
    Array.from({ length: count }, (_, i) => {
      if (!specials) return 1 / count;
      return i === 0 ? -3 : i === 1 ? 0 : i === 2 ? null : ((i % 7) + 1) / 8;
    });

  const charts = (view) => {
    if (view === 'bars') {
      const nodes = [
        node('chart-bar-negative', 100, 90, {
          label: '',
          kind: 'bar',
          values: [-4, 0, 2, 5],
          direction: 'vertical',
          size: 0.92,
        }),
        node('chart-bar-horizontal', 300, 90, {
          label: '',
          kind: 'bar',
          values: chartValues(18, true),
          direction: 'horizontal',
          size: 0.8,
        }),
        node('chart-bar-negative-caption', 100, 180, {
          label: 'Signed −4…5 · shared auto extent',
          kind: 'none',
          values: [],
        }),
        node('chart-bar-horizontal-caption', 300, 180, {
          label: 'Horizontal · 18 values · shared auto extent',
          kind: 'none',
          values: [],
        }),
      ];

      return scene(
        { nodes, edges: [] },
        {
          nodes: {
            width: 170,
            height: 110,
            chart: mapper('kind', 'bar'),
            'chart-values': { data: 'values' },
            'chart-domain': ['auto', 'auto'],
            'chart-colors': ['#c84645', '#e0a82e', '#4c9a68', '#3e6da7'],
            'chart-direction': mapper('direction', 'vertical'),
            'chart-size': mapper('size', 0.92),
            'chart-opacity': 0.82,
            label: mapper('label', ''),
            'text-valign': 'bottom',
            'font-size': 13,
            'text-wrap': 'wrap',
            'text-max-width': 170,
          },
          bypasses: {
            'chart-bar-negative-caption': {
              width: 1,
              height: 1,
              'background-opacity': 0,
              'border-width': 0,
              'text-valign': 'center',
            },
            'chart-bar-horizontal-caption': {
              width: 1,
              height: 1,
              'background-opacity': 0,
              'border-width': 0,
              'text-valign': 'center',
            },
          },
        },
        {
          coverage: coverage(
            [
              {
                group: 'nodes',
                property: 'chart-domain',
                target: 'chart-bar-negative',
                value: 'auto auto',
                resolvedValue: 'auto auto',
                resolvedExtent: [-4, 5],
              },
              {
                group: 'nodes',
                property: 'chart-colors',
                target: 'chart-bar-negative',
                value: ['#c84645', '#e0a82e', '#4c9a68', '#3e6da7'],
              },
              {
                group: 'nodes',
                property: 'chart-opacity',
                target: 'chart-bar-negative',
                value: 0.82,
              },
              {
                group: 'nodes',
                property: 'chart-size',
                target: 'chart-bar-horizontal',
                value: 0.8,
              },
            ],
            [
              {
                group: 'nodes',
                property: 'chart-direction',
                target: 'chart-bar-horizontal',
                value: 'horizontal',
                alternate: 'vertical',
              },
              {
                group: 'nodes',
                property: 'chart-domain',
                target: 'chart-bar-negative',
                value: 'auto',
                resolvedValue: 'auto auto',
                resolvedExtent: [-4, 5],
                alternate: '-5 6',
              },
            ],
            [
              {
                group: 'nodes',
                property: 'chart',
                target: 'chart-bar-negative',
                value: 'bar',
                reason:
                  'chart-domain is valid only for chart kind bar; changing this target to another chart kind while its authored domain remains set is rejected by the style engine.',
              },
            ],
          ),
          notes: [
            'The two bar samples share the data-derived auto extent [-4, 5]. The style getter preserves the authored auto endpoints; the chart legend exposes the resolved numeric geometry domain. Titles remain below each plot.',
          ],
        },
      );
    }

    if (view === 'heat') {
      const nodes = [
        node('chart-heat', 100, 90, {
          label: '',
          values: [-3, -1, 0, 2, null, 4],
        }),
        node('chart-radial-heat', 320, 90, {
          label: '',
          values: [-2, 0, 3],
          kind: 'radial-heat',
        }),
        node('chart-heat-caption', 100, 185, {
          label: 'Heat strip · signed + missing',
          kind: 'none',
          values: [],
        }),
        node('chart-radial-caption', 320, 185, {
          label: 'Radial heat · fixed scale',
          kind: 'none',
          values: [],
        }),
      ];

      return scene(
        { nodes, edges: [] },
        {
          nodes: {
            width: 150,
            height: 120,
            chart: mapper('kind', 'heat-strip'),
            'chart-values': { data: 'values' },
            'chart-scale': {
              domain: [-4, 0, 4],
              range: ['#4267a9', '#f6f3e9', '#c74541'],
            },
            'chart-missing-color': '#292a2c',
            'chart-size': 0.9,
            'chart-hole': 0.45,
            'chart-start-angle': 0.4,
            'chart-opacity': 0.76,
            'font-size': 13,
            'text-wrap': 'wrap',
            'text-max-width': 160,
          },
          bypasses: {
            'chart-heat-caption': {
              width: 1,
              height: 1,
              'background-opacity': 0,
              'border-width': 0,
              'text-valign': 'center',
            },
            'chart-radial-caption': {
              width: 1,
              height: 1,
              'background-opacity': 0,
              'border-width': 0,
              'text-valign': 'center',
            },
          },
        },
        {
          coverage: coverage(
            [
              {
                group: 'nodes',
                property: 'chart-scale',
                target: 'chart-heat',
                value: {
                  domain: [-4, 0, 4],
                  range: ['#4267a9', '#f6f3e9', '#c74541'],
                },
              },
              {
                group: 'nodes',
                property: 'chart-missing-color',
                target: 'chart-heat',
                value: '#292a2c',
              },
              {
                group: 'nodes',
                property: 'chart-hole',
                target: 'chart-radial-heat',
                value: 0.45,
              },
              {
                group: 'nodes',
                property: 'chart-size',
                target: 'chart-radial-heat',
                value: 0.9,
              },
              {
                group: 'nodes',
                property: 'chart-opacity',
                target: 'chart-radial-heat',
                value: 0.76,
              },
              {
                group: 'nodes',
                property: 'chart-start-angle',
                target: 'chart-radial-heat',
                value: 0.4,
              },
            ],
            [
              {
                group: 'nodes',
                property: 'chart',
                target: 'chart-heat',
                value: 'heat-strip',
                alternate: 'radial-heat',
              },
              {
                group: 'nodes',
                property: 'chart',
                target: 'chart-radial-heat',
                value: 'radial-heat',
                alternate: 'heat-strip',
              },
            ],
          ),
          notes: [
            'Both heat charts share an explicit fixed domain and color range; captions stay below the chart marks.',
          ],
        },
      );
    }

    const nodes = [
      node('chart-pie-one', 95, 110, {
        label: 'pie · 1 value',
        kind: 'pie',
        values: [1],
        hole: 0,
        angle: 0,
      }),
      node('chart-pie-16', 245, 110, {
        label: 'pie · 16 values',
        kind: 'pie',
        values: chartValues(16),
        hole: 0,
        angle: 0.5,
      }),
      node('chart-stripes-18', 395, 110, {
        label: 'stripes · 18 values',
        kind: 'stripes',
        values: chartValues(18),
        hole: 0.25,
        angle: 0,
      }),
      node('chart-stripes-255', 705, 110, {
        label: '255 equal positive slots · 1/255 each',
        kind: 'stripes',
        values: chartValues(255),
        chartWidth: 280,
        hole: 0,
        angle: 0,
      }),
    ];

    return scene(
      { nodes, edges: [] },
      {
        nodes: {
          width: mapper('chartWidth', 112),
          height: 112,
          chart: mapper('kind', 'pie'),
          'chart-values': { data: 'values' },
          'chart-colors': [
            '#d84c4c',
            '#eaa63c',
            '#45a07a',
            '#4777ba',
            '#8a65b7',
          ],
          'chart-hole': mapper('hole', 0),
          'chart-start-angle': mapper('angle', 0),
          'chart-direction': 'horizontal',
          'chart-size': 0.94,
          'chart-opacity': 0.7,
          label: mapper('label', ''),
          'text-valign': 'bottom',
        },
      },
      {
        coverage: coverage(
          [
            {
              group: 'nodes',
              property: 'chart-colors',
              target: 'chart-pie-16',
              value: ['#d84c4c', '#eaa63c', '#45a07a', '#4777ba', '#8a65b7'],
            },
            {
              group: 'nodes',
              property: 'chart-opacity',
              target: 'chart-pie-16',
              value: 0.7,
            },
            {
              group: 'nodes',
              property: 'chart-direction',
              target: 'chart-stripes-18',
              value: 'horizontal',
            },
            {
              group: 'nodes',
              property: 'chart-start-angle',
              target: 'chart-pie-16',
              value: 0.5,
            },
            {
              group: 'nodes',
              property: 'chart-size',
              target: 'chart-pie-16',
              value: 0.94,
            },
            {
              group: 'nodes',
              property: 'width',
              target: 'chart-stripes-255',
              value: 280,
            },
            {
              group: 'nodes',
              property: 'chart-hole',
              target: 'chart-stripes-18',
              value: 0.25,
            },
          ],
          [
            {
              group: 'nodes',
              property: 'chart',
              target: 'chart-pie-16',
              value: 'pie',
            },
            {
              group: 'nodes',
              property: 'chart',
              target: 'chart-stripes-18',
              value: 'stripes',
            },
          ],
        ),
        notes: [
          'The chart legend is application-owned; the controls panel reports cy.legend() metadata. The wide 255-slot sample has 255 positive values of 1/255; at 280px each stripe is near a pixel wide.',
        ],
      },
    );
  };

  return { chartValues, charts };
});
