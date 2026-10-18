/* Pure scene builders for the visual feature harness. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory;
  if (root != null) (root.featureSceneParts ||= {}).graph = factory;
})(typeof globalThis === 'undefined' ? this : globalThis, function (api) {
  const { image, node, edge, mapper, coverage, scene, baseStyle } = api;
  const shapesUnderlays = () => {
    const shapes = ['ellipse', 'round-rectangle', 'diamond', 'star'];
    const nodes = shapes.flatMap((shape, i) => {
      const x = 100 + i * 150;

      return [
        node(`shape-underlay-${i}`, x, 110, { label: '', shape }),
        node(`shape-caption-${i}`, x, 190, {
          label: `${shape} body\nellipse underlay`,
        }),
      ];
    });
    const captionBypasses = Object.fromEntries(
      shapes.map((_, i) => [
        `shape-caption-${i}`,
        {
          width: 1,
          height: 1,
          'background-opacity': 0,
          'border-width': 0,
          'underlay-opacity': 0,
          'overlay-opacity': 0,
          'text-valign': 'top',
          'text-wrap': 'wrap',
          'text-max-width': 125,
        },
      ]),
    );

    return scene(
      { nodes, edges: [] },
      {
        nodes: {
          shape: mapper('shape', 'ellipse'),
          'background-color': '#dbe6f0',
          'underlay-shape': 'ellipse',
          'underlay-color': '#e05d43',
          'underlay-opacity': 0.8,
          'underlay-padding': 12,
          'text-halign': 'center',
          'text-valign': 'top',
          'font-size': 11,
          'text-wrap': 'wrap',
          'text-max-width': 125,
        },
        bypasses: captionBypasses,
      },
      {
        coverage: coverage(
          [
            {
              group: 'nodes',
              property: 'underlay-shape',
              target: 'shape-underlay-0',
              value: 'ellipse',
            },
            {
              group: 'nodes',
              property: 'shape',
              target: 'shape-underlay-2',
              value: 'diamond',
            },
          ],
          [
            {
              group: 'nodes',
              property: 'underlay-shape',
              target: 'shape-underlay-0',
              value: 'ellipse',
            },
          ],
        ),
        notes: [
          'The existing node-types fixture supplies the full leaf-shape gallery; compound hull keywords are in compounds/hulls.',
        ],
      },
    );
  };

  const edgeRoutes = (view) => {
    const radiusView = view === 'radius-arc' || view === 'radius-influence';
    const endpointView = view === 'endpoints';
    const specs = radiusView
      ? [
          [
            'radius type',
            view === 'radius-influence' ? 'influence-radius' : 'arc-radius',
            'segments',
            0.5,
          ],
        ]
      : endpointView
        ? [
            [
              'source inside-to-node',
              'intersection',
              'unbundled-bezier',
              0.25,
              'inside-to-node',
              '225deg',
            ],
            [
              'source outside-to-line',
              'intersection',
              'unbundled-bezier',
              0.25,
              'outside-to-line',
              '225deg',
            ],
            [
              'target inside-to-node',
              'intersection',
              'unbundled-bezier',
              0.25,
              '18 30',
              'inside-to-node',
            ],
            [
              'target outside-to-line',
              'intersection',
              'unbundled-bezier',
              0.25,
              '18 30',
              'outside-to-line',
            ],
            [
              'manual point + angle',
              'endpoints',
              'unbundled-bezier',
              0.25,
              '18 30',
              '225deg',
            ],
          ]
        : [
            ['intersection', 'intersection', 'unbundled-bezier', 0.25],
            ['node position', 'node-position', 'unbundled-bezier', 0.75],
          ];
    const nodes = [];
    const edges = [];

    specs.forEach(
      ([label, route, curve, weight, sourceEndpoint, targetEndpoint], i) => {
        const y = endpointView ? 90 + i * 95 : 100 + i * 130;
        const s = `route-s${i}`;
        const t = `route-t${i}`;
        nodes.push(node(s, 100, y, { label, kind: route }));
        nodes.push(node(t, 470, y + (i % 2 ? 35 : 0), { label: '' }));
        edges.push(
          edge(`route-${i}`, s, t, {
            kind: route,
            weight,
            curve,
            ...(sourceEndpoint != null ? { sourceEndpoint } : {}),
            ...(targetEndpoint != null ? { targetEndpoint } : {}),
          }),
        );
      },
    );

    if (!radiusView && !endpointView) {
      nodes.push(node('route-hidden-s', 100, 360, { label: 'hidden route' }));
      nodes.push(node('route-hidden-t', 470, 360, { label: 'hidden' }));
      edges.push(
        edge('route-hidden', 'route-hidden-s', 'route-hidden-t', {
          kind: 'hidden',
          weight: 0.5,
          curve: 'bezier',
          visibility: 'hidden',
        }),
      );
    }

    return scene(
      { nodes, edges },
      {
        nodes: {
          width: 48,
          height: 36,
          'text-halign': 'left',
          'text-margin-x': 10,
        },
        edges: {
          'curve-style': mapper('curve', 'unbundled-bezier'),
          'edge-distances': endpointView
            ? mapper('kind', 'intersection')
            : radiusView
              ? 'intersection'
              : mapper('kind', 'intersection'),
          'control-point-weight': mapper('weight', 0.5),
          ...(radiusView
            ? {
                'radius-type':
                  view === 'radius-influence'
                    ? 'influence-radius'
                    : 'arc-radius',
              }
            : {}),
          ...(endpointView
            ? { 'source-endpoint': '18 30', 'target-endpoint': '225deg' }
            : !radiusView
              ? {
                  'source-endpoint': 'outside-to-node',
                  'target-endpoint': 'outside-to-node',
                }
              : {}),
          ...(radiusView
            ? {
                'segment-distances': [70],
                'segment-weights': [0.5],
                'segment-radii': [50],
              }
            : {
                'control-point-distances': [90],
                'control-point-weights': [0.35],
              }),
          'target-arrow-shape': 'triangle',
          'line-style': 'solid',
          'target-distance-from-node': 18,
          'source-distance-from-node': 8,
          ...(!radiusView
            ? { visibility: mapper('visibility', 'visible') }
            : {}),
        },
        bypasses: endpointView
          ? Object.fromEntries(
              specs.map(([, , , , sourceEndpoint, targetEndpoint], i) => [
                `route-${i}`,
                {
                  'source-endpoint': sourceEndpoint,
                  'target-endpoint': targetEndpoint,
                  ...(i === 4
                    ? {
                        'source-distance-from-node': 0,
                        'target-distance-from-node': 0,
                      }
                    : {}),
                },
              ]),
            )
          : {},
      },
      {
        coverage: coverage(
          [
            ...(!radiusView
              ? [
                  {
                    group: 'edges',
                    property: 'control-point-weight',
                    target: 'route-0',
                    value: 0.25,
                  },
                ]
              : []),
            ...(endpointView
              ? [
                  ...specs.flatMap(
                    ([, , , , sourceEndpoint, targetEndpoint], i) => [
                      {
                        group: 'edges',
                        property: 'source-endpoint',
                        target: `route-${i}`,
                        value: sourceEndpoint,
                      },
                      {
                        group: 'edges',
                        property: 'target-endpoint',
                        target: `route-${i}`,
                        value: targetEndpoint,
                      },
                    ],
                  ),
                  {
                    group: 'edges',
                    property: 'edge-distances',
                    target: 'route-4',
                    value: 'endpoints',
                  },
                ]
              : !radiusView
                ? [
                    {
                      group: 'edges',
                      property: 'edge-distances',
                      target: 'route-1',
                      value: 'node-position',
                    },
                  ]
                : []),
            ...(radiusView
              ? [
                  {
                    group: 'edges',
                    property: 'radius-type',
                    target: 'route-0',
                    value:
                      view === 'radius-influence'
                        ? 'influence-radius'
                        : 'arc-radius',
                  },
                ]
              : []),
            ...(!radiusView && !endpointView
              ? [
                  {
                    group: 'edges',
                    property: 'source-endpoint',
                    target: 'route-0',
                    value: 'outside-to-node',
                  },
                  {
                    group: 'edges',
                    property: 'target-endpoint',
                    target: 'route-0',
                    value: 'outside-to-node',
                  },
                  {
                    group: 'edges',
                    property: 'line-style',
                    target: 'route-0',
                    value: 'solid',
                  },
                ]
              : []),
            ...(!radiusView && !endpointView
              ? [
                  {
                    group: 'edges',
                    property: 'visibility',
                    target: 'route-hidden',
                    value: 'hidden',
                  },
                ]
              : []),
            {
              group: 'edges',
              property: 'source-distance-from-node',
              target: 'route-0',
              value: 8,
            },
            {
              group: 'edges',
              property: 'target-distance-from-node',
              target: 'route-0',
              value: 18,
            },
          ],
          [
            ...(endpointView
              ? [
                  {
                    group: 'edges',
                    property: 'edge-distances',
                    target: 'route-4',
                    value: 'endpoints',
                    alternate: 'intersection',
                  },
                ]
              : !radiusView
                ? [
                    {
                      group: 'edges',
                      property: 'edge-distances',
                      target: 'route-1',
                      value: 'node-position',
                      alternate: 'intersection',
                    },
                  ]
                : []),
            ...(radiusView
              ? [
                  {
                    group: 'edges',
                    property: 'radius-type',
                    target: 'route-0',
                    value:
                      view === 'radius-influence'
                        ? 'influence-radius'
                        : 'arc-radius',
                    alternate:
                      view === 'radius-influence'
                        ? 'arc-radius'
                        : 'influence-radius',
                  },
                ]
              : []),
            ...(!radiusView && !endpointView
              ? [
                  {
                    group: 'edges',
                    property: 'source-endpoint',
                    target: 'route-0',
                    value: 'outside-to-node',
                    alternate: 'inside-to-node',
                  },
                  {
                    group: 'edges',
                    property: 'target-endpoint',
                    target: 'route-0',
                    value: 'outside-to-node',
                    alternate: 'inside-to-node',
                  },
                  {
                    group: 'edges',
                    property: 'line-style',
                    target: 'route-0',
                    value: 'solid',
                    alternate: 'dashed',
                  },
                ]
              : []),
            ...(endpointView
              ? [
                  {
                    group: 'edges',
                    property: 'source-endpoint',
                    target: 'route-0',
                    value: 'inside-to-node',
                    alternate: 'outside-to-line',
                  },
                  {
                    group: 'edges',
                    property: 'source-endpoint',
                    target: 'route-1',
                    value: 'outside-to-line',
                    alternate: 'inside-to-node',
                  },
                  {
                    group: 'edges',
                    property: 'target-endpoint',
                    target: 'route-2',
                    value: 'inside-to-node',
                    alternate: 'outside-to-line',
                  },
                  {
                    group: 'edges',
                    property: 'target-endpoint',
                    target: 'route-3',
                    value: 'outside-to-line',
                    alternate: 'inside-to-node',
                  },
                ]
              : []),
            ...(!radiusView && !endpointView
              ? [
                  {
                    group: 'edges',
                    property: 'visibility',
                    target: 'route-hidden',
                    value: 'hidden',
                    alternate: 'visible',
                  },
                ]
              : []),
          ],
        ),
      },
    );
  };

  const edgeTaxi = () => {
    const rows = [
      ['horizontal', 'source', 12, 6, 35],
      ['upward', 'target', 17, 14, 35],
      ['downward', 'family', 22, 22, 35],
      ['leftward', 'family', 27, 30, 35],
      ['vertical', 'source', 32, 38, 35],
      ['rightward', 'family', 37, 46, 'auto'],
    ];
    const nodes = [];
    const edges = [];

    rows.forEach(([direction, track, spacing, turnDistance, turn], i) => {
      const y = 70 + i * 92;
      const s = `taxi-s${i}`;
      const t = `taxi-t${i}`;
      nodes.push(
        node(s, 90, y, { label: `${direction} / ${track}`, direction, track }),
      );
      nodes.push(node(t, 420, y + (i % 2 ? -24 : 16), { label: '' }));
      edges.push(
        edge(`taxi-${i}`, s, t, {
          direction,
          track,
          spacing,
          turnDistance,
          turn,
        }),
      );
    });

    return scene(
      { nodes, edges },
      {
        nodes: {
          width: 60,
          height: 36,
          'text-halign': 'left',
          'text-margin-x': 10,
        },
        edges: {
          'curve-style': 'taxi',
          'taxi-direction': mapper('direction', 'auto'),
          'taxi-track': mapper('track', 'source'),
          'taxi-track-spacing': mapper('spacing', 10),
          'taxi-turn-min-distance': mapper('turnDistance', 10),
          'taxi-turn': 35,
          'taxi-radius': 18,
          'target-arrow-shape': 'triangle',
        },
        bypasses: { 'taxi-5': { 'taxi-turn': 'auto' } },
      },
      {
        coverage: coverage(
          [
            {
              group: 'edges',
              property: 'taxi-track',
              target: 'taxi-1',
              value: 'target',
            },
            {
              group: 'edges',
              property: 'taxi-track',
              target: 'taxi-2',
              value: 'family',
            },
            {
              group: 'edges',
              property: 'taxi-track-spacing',
              target: 'taxi-2',
              value: 22,
            },
            {
              group: 'edges',
              property: 'taxi-turn-min-distance',
              target: 'taxi-3',
              value: 30,
            },
            {
              group: 'edges',
              property: 'taxi-turn',
              target: 'taxi-0',
              value: 35,
            },
          ],
          [
            {
              group: 'edges',
              property: 'taxi-direction',
              target: 'taxi-0',
              value: 'horizontal',
            },
            {
              group: 'edges',
              property: 'taxi-direction',
              target: 'taxi-1',
              value: 'upward',
            },
            {
              group: 'edges',
              property: 'taxi-direction',
              target: 'taxi-2',
              value: 'downward',
            },
            {
              group: 'edges',
              property: 'taxi-direction',
              target: 'taxi-3',
              value: 'leftward',
            },
            {
              group: 'edges',
              property: 'taxi-track',
              target: 'taxi-1',
              value: 'target',
            },
            {
              group: 'edges',
              property: 'taxi-track',
              target: 'taxi-2',
              value: 'family',
            },
            {
              group: 'edges',
              property: 'taxi-direction',
              target: 'taxi-4',
              value: 'vertical',
              alternate: 'horizontal',
            },
            {
              group: 'edges',
              property: 'taxi-direction',
              target: 'taxi-5',
              value: 'rightward',
              alternate: 'horizontal',
            },
            {
              group: 'edges',
              property: 'taxi-turn',
              target: 'taxi-5',
              value: 'auto',
              alternate: '35',
            },
          ],
        ),
      },
    );
  };

  const edgeLoops = () => {
    const specs = [
      { id: 'loop-tight', step: 24, direction: '-35deg', sweep: '75deg' },
      { id: 'loop-wide', step: 46, direction: '35deg', sweep: '-110deg' },
      { id: 'loop-opposed', step: 68, direction: '150deg', sweep: '120deg' },
    ];
    const nodes = [];
    const edges = [];

    specs.forEach(({ id, step, direction, sweep }, i) => {
      const x = 110 + i * 190;
      nodes.push(node(`${id}-node`, x, 120, { label: `${step}px step` }));
      nodes.push(
        node(`${id}-caption`, x, 230, {
          label: `${direction} direction\n${sweep} sweep`,
        }),
      );
      edges.push(
        edge(id, `${id}-node`, `${id}-node`, { step, direction, sweep }),
      );
    });

    return scene(
      { nodes, edges },
      {
        nodes: {
          width: 82,
          height: 56,
          'text-halign': 'center',
          'text-valign': 'center',
          'font-size': 11,
        },
        edges: {
          'curve-style': 'bezier',
          'control-point-step-size': mapper('step', 40),
          'loop-direction': mapper('direction', '-45deg'),
          'loop-sweep': mapper('sweep', '-90deg'),
          'source-arrow-shape': 'none',
          'target-arrow-shape': 'triangle',
        },
        bypasses: Object.fromEntries(
          specs.map(({ id }, i) => [
            `${id}-caption`,
            {
              width: 1,
              height: 1,
              'background-opacity': 0,
              'border-width': 0,
              'outline-width': 0,
            },
          ]),
        ),
      },
      {
        coverage: coverage([
          {
            group: 'edges',
            property: 'control-point-step-size',
            target: 'loop-wide',
            value: 46,
          },
          {
            group: 'edges',
            property: 'loop-direction',
            target: 'loop-wide',
            value: '35deg',
            resolvedValue: 35,
          },
          {
            group: 'edges',
            property: 'loop-sweep',
            target: 'loop-opposed',
            value: '120deg',
            resolvedValue: 120,
          },
        ]),
        notes: [
          'Each loop is its own self-edge; the three values change loop reach and orientation around a single node.',
        ],
      },
    );
  };

  const arrows = (view) => {
    if (view === 'scalars') {
      const widths = [1, 4, 8];
      const nodes = [];
      const edges = [];
      const bypasses = {};

      widths.forEach((width, i) => {
        const y = 110 + i * 120;
        const s = `arrow-s${i}`;
        const t = `arrow-t${i}`;
        nodes.push(node(s, 90, y, { label: `line ${width}px`, width }));
        nodes.push(node(t, 480, y, { label: '' }));
        edges.push(
          edge(`arrow-width-${i}`, s, t, { width, scale: i + 1, gap: i * 9 }),
        );
        bypasses[`arrow-width-${i}`] = {
          'source-arrow-width': [1, 4, 'match-line'][i],
          'target-arrow-width': [1, 'match-line', '50%'][i],
          ...(i === 2
            ? {
                'mid-source-arrow-width': 'match-line',
                'mid-target-arrow-width': 'match-line',
              }
            : {}),
          ...(i === 0 ? { 'source-arrow-fill': 'filled' } : {}),
        };
      });

      return scene(
        { nodes, edges },
        {
          nodes: {
            width: mapper('width', 50),
            height: 34,
            'text-halign': 'left',
          },
          edges: {
            width: mapper('width', 3),
            'arrow-scale': mapper('scale', 1),
            'source-arrow-shape': 'tee',
            'target-arrow-shape': 'triangle',
            'source-arrow-fill': 'hollow',
            'target-arrow-fill': 'hollow',
            'source-distance-from-node': mapper('gap', 0),
            'target-distance-from-node': mapper('gap', 0),
          },
          bypasses,
        },
        {
          coverage: coverage(
            [
              {
                group: 'edges',
                property: 'source-arrow-width',
                target: 'arrow-width-0',
                value: 1,
              },
              {
                group: 'edges',
                property: 'source-arrow-width',
                target: 'arrow-width-1',
                value: 4,
              },
              {
                group: 'edges',
                property: 'source-arrow-width',
                target: 'arrow-width-2',
                value: 'match-line',
                resolvedValue: 8,
              },
              {
                group: 'edges',
                property: 'target-arrow-width',
                target: 'arrow-width-2',
                value: '50%',
              },
              {
                group: 'edges',
                property: 'arrow-scale',
                target: 'arrow-width-2',
                value: 3,
              },
              {
                group: 'edges',
                property: 'source-arrow-fill',
                target: 'arrow-width-0',
                value: 'filled',
              },
            ],
            [
              {
                group: 'edges',
                property: 'source-arrow-width',
                target: 'arrow-width-2',
                value: 'match-line',
                alternate: '4',
              },
              {
                group: 'edges',
                property: 'target-arrow-width',
                target: 'arrow-width-1',
                value: 'match-line',
                alternate: '1',
              },
              {
                group: 'edges',
                property: 'source-arrow-fill',
                target: 'arrow-width-0',
                value: 'filled',
                alternate: 'hollow',
              },
            ],
            [
              {
                group: 'edges',
                property: 'mid-source-arrow-width',
                target: 'arrow-width-2',
                value: 'match-line',
                reason:
                  'Mid-arrow widths are accepted and read back against edge width, but the render contract always fills mid heads so no width stroke is drawn.',
              },
              {
                group: 'edges',
                property: 'mid-target-arrow-width',
                target: 'arrow-width-2',
                value: 'match-line',
                reason:
                  'Mid-arrow widths are accepted and read back against edge width, but the render contract always fills mid heads so no width stroke is drawn.',
              },
            ],
          ),
          notes: [
            'Source and target heads are hollow so arrow-width strokes remain visible. Mid-arrow widths are explicitly nonvisual because mid heads are always filled.',
          ],
        },
      );
    }

    const sourceValues = [
      'none',
      'triangle',
      'arrow',
      'chevron',
      'circle',
      'vee',
      'square',
      'diamond',
      'tee',
      'triangle-tee',
      'circle-triangle',
      'triangle-backcurve',
    ];
    const midSourceValues = [
      'none',
      'triangle',
      'circle',
      'tee',
      'vee',
      'chevron',
      'square',
      'diamond',
      'triangle-tee',
      'circle-triangle',
      'triangle-backcurve',
    ];
    const midTargetValues = [
      'none',
      'vee',
      'chevron',
      'circle',
      'square',
      'diamond',
      'tee',
      'triangle-tee',
      'circle-triangle',
      'triangle-backcurve',
    ];
    const rows = [
      ...sourceValues.map((value) => ({
        prop: 'source-arrow-shape',
        value,
        group: 'source',
      })),
      ...midSourceValues.map((value) => ({
        prop: 'mid-source-arrow-shape',
        value,
        group: 'mid-source',
      })),
      ...midTargetValues.map((value) => ({
        prop: 'mid-target-arrow-shape',
        value,
        group: 'mid-target',
      })),
    ];
    const nodes = [];
    const edges = [];
    const properties = [];
    const keywords = [];

    rows.forEach(({ prop, value, group }, i) => {
      const col = i % 9;
      const row = Math.floor(i / 9);
      const x = 100 + col * 130;
      const y = 100 + row * 145;
      const s = `arrow-shape-s${i}`;
      const t = `arrow-shape-t${i}`;
      const id = `arrow-shape-${i}`;
      nodes.push(node(s, x, y, { label: value }));
      nodes.push(node(t, x + 85, y, { label: '' }));
      edges.push(edge(id, s, t, { group, [prop]: value }));
      const metadataRow = {
        group: 'edges',
        property: prop,
        target: id,
        value,
        ...(value === 'arrow' ? { resolvedValue: 'triangle' } : {}),
      };
      properties.push(metadataRow);
      keywords.push({
        ...metadataRow,
        alternate: value === 'none' ? 'triangle' : 'none',
      });
    });

    const edgeProps = {
      'source-arrow-shape': mapper('source-arrow-shape', 'none'),
      'mid-source-arrow-shape': mapper('mid-source-arrow-shape', 'none'),
      'mid-target-arrow-shape': mapper('mid-target-arrow-shape', 'none'),
      'target-arrow-shape': 'triangle',
      'arrow-scale': 1.5,
      'source-arrow-color': '#cf4c55',
      'mid-source-arrow-color': '#4c8e67',
      'mid-target-arrow-color': '#4268a4',
      'target-arrow-color': '#e8a33d',
    };
    const edgeData = {};
    [
      'source-arrow-shape',
      'mid-source-arrow-shape',
      'mid-target-arrow-shape',
    ].forEach((prop) => {
      edgeData[prop] = prop;
    });
    rows.forEach(({ prop, value }, i) => {
      const edgeDataKey = prop;
      rows[i][edgeDataKey] = value;
      // Keep the values under exact data keys so each head property gets one
      // real mapped value and the other two heads stay absent.
      edges[i].data[edgeDataKey] = value;
    });

    return scene(
      { nodes, edges },
      {
        nodes: {
          width: 14,
          height: 14,
          'font-size': 10,
          'text-halign': 'left',
          'text-margin-x': -16,
          'text-valign': 'top',
        },
        edges: edgeProps,
      },
      {
        coverage: coverage(properties, keywords),
        notes: [
          'Each edge carries exactly one source or mid head; arrows are colored by location so the filled mid-head behavior is easy to distinguish.',
        ],
      },
    );
  };

  return { shapesUnderlays, edgeRoutes, edgeTaxi, edgeLoops, arrows };
});
