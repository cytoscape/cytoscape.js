/* Pure scene builders for the visual feature harness. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory;
  if (root != null) (root.featureSceneParts ||= {}).paint = factory;
})(typeof globalThis === 'undefined' ? this : globalThis, function (api) {
  const { image, node, edge, mapper, coverage, scene, baseStyle } = api;
  const paintNodes = () => {
    const directions = [
      'solid',
      'to-bottom',
      'to-top',
      'to-left',
      'to-right',
      'to-bottom-right',
      'to-bottom-left',
      'to-top-right',
      'to-top-left',
    ];
    const colors = ['#e7eef7', '#f3c969', '#d86a55'];
    const positions = [0, 29, 100];
    const nodes = directions.map((direction, i) => {
      const x = 100 + (i % 3) * 200;
      const y = 75 + Math.floor(i / 3) * 128;

      return node(`paint-${i}`, x, y, {
        label: direction === 'solid' ? 'solid baseline' : direction.slice(3),
        bg: direction === 'solid' ? colors[0] : colors[(i % 2) + 1],
        fill: direction === 'solid' ? 'solid' : 'linear-gradient',
        direction: direction === 'solid' ? 'to-bottom' : direction,
      });
    });

    const properties = [
      {
        group: 'nodes',
        property: 'background-color',
        target: 'paint-1',
        value: colors[2],
      },
      {
        group: 'nodes',
        property: 'background-fill',
        target: 'paint-1',
        value: 'linear-gradient',
      },
      {
        group: 'nodes',
        property: 'background-gradient-direction',
        target: 'paint-1',
        value: directions[1],
      },
      {
        group: 'nodes',
        property: 'background-gradient-stop-colors',
        target: 'paint-1',
        value: colors,
      },
      {
        group: 'nodes',
        property: 'background-gradient-stop-positions',
        target: 'paint-1',
        value: positions,
      },
      {
        group: 'nodes',
        property: 'background-opacity',
        target: 'paint-1',
        value: 1,
      },
      {
        group: 'nodes',
        property: 'border-opacity',
        target: 'paint-1',
        value: 1,
      },
      {
        group: 'nodes',
        property: 'border-position',
        target: 'paint-1',
        value: 'center',
      },
      {
        group: 'nodes',
        property: 'border-style',
        target: 'paint-1',
        value: 'solid',
      },
      {
        group: 'nodes',
        property: 'border-dash-offset',
        target: 'paint-1',
        value: 0,
      },
    ];

    return scene(
      { nodes, edges: [] },
      {
        nodes: {
          width: 112,
          height: 58,
          'font-size': 13,
          'text-valign': 'bottom',
          'text-margin-y': 30,
          'text-halign': 'center',
          'background-color': mapper('bg', colors[0]),
          'background-fill': mapper('fill', 'solid'),
          'background-gradient-stop-colors': colors,
          'background-gradient-stop-positions': positions,
          'background-gradient-direction': mapper('direction', 'to-bottom'),
          'background-opacity': 1,
          'border-color': '#28384a',
          'border-width': 3,
          'border-opacity': 1,
          'border-position': 'center',
          'border-style': 'solid',
          'border-dash-offset': mapper('dashOffset', 0),
        },
      },
      {
        coverage: coverage(properties, [
          ...directions.slice(1).map((direction, i) => ({
            group: 'nodes',
            property: 'background-gradient-direction',
            target: `paint-${i + 1}`,
            value: direction,
          })),
        ]),
        notes: [
          'The solid baseline sits beside all eight linear-gradient directions; each colored cell uses the same uneven three-stop ramp and border.',
        ],
      },
    );
  };

  const paintBorders = () => {
    const positions = ['center', 'inside', 'outside'];
    const styles = ['solid', 'dashed', 'dotted', 'double'];
    const nodes = [];

    positions.forEach((position, i) => {
      nodes.push(
        node(`border-position-${position}`, 100 + i * 190, 90, {
          label: `position ${position}`,
          positionValue: position,
          styleValue: 'solid',
        }),
      );
    });
    styles.forEach((style, i) => {
      nodes.push(
        node(`border-style-${style}`, 100 + i * 145, 270, {
          label: `style ${style}`,
          positionValue: 'center',
          styleValue: style,
        }),
      );
    });

    return scene(
      { nodes, edges: [] },
      {
        nodes: {
          width: 92,
          height: 58,
          'font-size': 11,
          'text-valign': 'bottom',
          'text-margin-y': 3,
          'background-color': '#e5edf5',
          'border-color': '#243a50',
          'border-width': 7,
          'border-position': mapper('positionValue', 'center'),
          'border-style': mapper('styleValue', 'solid'),
          'border-dash-pattern': [7, 3],
          'border-dash-offset': 2,
        },
      },
      {
        coverage: coverage(
          [
            {
              group: 'nodes',
              property: 'border-position',
              target: 'border-position-inside',
              value: 'inside',
            },
            {
              group: 'nodes',
              property: 'border-position',
              target: 'border-position-outside',
              value: 'outside',
            },
            {
              group: 'nodes',
              property: 'border-dash-pattern',
              target: 'border-style-dashed',
              value: [7, 3],
            },
            {
              group: 'nodes',
              property: 'border-dash-offset',
              target: 'border-style-dashed',
              value: 2,
            },
          ],
          [
            {
              group: 'nodes',
              property: 'border-position',
              target: 'border-position-inside',
              value: 'inside',
              alternate: 'center',
            },
            {
              group: 'nodes',
              property: 'border-position',
              target: 'border-position-outside',
              value: 'outside',
              alternate: 'center',
            },
            ...styles.map((style) => ({
              group: 'nodes',
              property: 'border-style',
              target: `border-style-${style}`,
              value: style,
              alternate: style === 'solid' ? 'dashed' : 'solid',
              ...(style === 'double'
                ? {
                    note: 'The current double border is supported; this row records authored/resolved style, while pixel behavior is checked in browser.',
                  }
                : {}),
            })),
          ],
        ),
        notes: [
          'Top row changes border placement with a shared solid border; bottom row changes stroke style with a centered shared border.',
        ],
      },
    );
  };

  const paintGhosts = () => {
    const nodes = [
      node('ghost-off', 100, 100, {
        label: '',
        ghost: 'no',
        offsetX: 0,
        offsetY: 0,
        ghostOpacity: 0.7,
        fill: '#e7eef7',
      }),
      node('ghost-x', 280, 100, {
        label: '',
        ghost: 'yes',
        offsetX: 18,
        offsetY: 0,
        ghostOpacity: 0.7,
        fill: '#e7eef7',
      }),
      node('ghost-y', 460, 100, {
        label: '',
        ghost: 'yes',
        offsetX: 0,
        offsetY: 18,
        ghostOpacity: 0.3,
        fill: '#e7eef7',
      }),
      node('ghost-caption-off', 100, 205, { label: 'No ghost · reference' }),
      node('ghost-caption-x', 280, 205, { label: 'X offset · 18 px' }),
      node('ghost-caption-y', 460, 205, {
        label: 'Y offset · 18 px · opacity 0.3',
      }),
    ];

    return scene(
      { nodes, edges: [] },
      {
        nodes: {
          width: 104,
          height: 72,
          'text-valign': 'bottom',
          'text-margin-y': 4,
          ghost: mapper('ghost', 'no'),
          'ghost-offset-x': mapper('offsetX', 0),
          'ghost-offset-y': mapper('offsetY', 0),
          'ghost-opacity': mapper('ghostOpacity', 0.7),
          'background-color': mapper('fill', '#e7eef7'),
          'border-width': 2,
          'border-color': '#354b60',
          'font-size': 13,
          'text-halign': 'center',
          'text-valign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': 145,
        },
        bypasses: {
          'ghost-caption-off': {
            width: 1,
            height: 1,
            'background-opacity': 0,
            'border-width': 0,
          },
          'ghost-caption-x': {
            width: 1,
            height: 1,
            'background-opacity': 0,
            'border-width': 0,
          },
          'ghost-caption-y': {
            width: 1,
            height: 1,
            'background-opacity': 0,
            'border-width': 0,
          },
        },
      },
      {
        coverage: coverage(
          [
            {
              group: 'nodes',
              property: 'ghost-offset-x',
              target: 'ghost-x',
              value: 18,
            },
            {
              group: 'nodes',
              property: 'ghost-offset-y',
              target: 'ghost-y',
              value: 18,
            },
            {
              group: 'nodes',
              property: 'ghost-opacity',
              target: 'ghost-y',
              value: 0.3,
            },
          ],
          [
            {
              group: 'nodes',
              property: 'ghost',
              target: 'ghost-off',
              value: 'no',
              alternate: 'yes',
            },
            {
              group: 'nodes',
              property: 'ghost',
              target: 'ghost-x',
              value: 'yes',
              alternate: 'no',
            },
          ],
        ),
        notes: [
          'The left body is the no-ghost reference; the right copies are offset in separate axes.',
        ],
      },
    );
  };

  const paintLayers = () => {
    const nodes = [
      node('layer-round', 100, 120, {
        label: '',
        bg: '#f4d6c8',
        layerOpacity: 0.9,
      }),
      node('layer-square', 250, 120, {
        label: '',
        bg: '#cce3ed',
        layerOpacity: 0.7,
      }),
      node('layer-soft', 400, 120, {
        label: '',
        bg: '#d9e9ce',
        layerOpacity: 1,
      }),
      node('layer-caption-round', 100, 220, {
        label: 'Underlay r4 · overlay r8\nround-rectangle',
      }),
      node('layer-caption-ellipse', 250, 220, {
        label: 'Underlay r14 · overlay r18\nellipse overlay',
      }),
      node('layer-caption-soft', 400, 220, {
        label: 'Auto body · underlay · overlay radii\nround-rectangle',
      }),
    ];
    const layerBypasses = {
      'layer-round': {
        'underlay-corner-radius': 4,
        'overlay-corner-radius': 8,
        'overlay-shape': 'round-rectangle',
      },
      'layer-square': {
        'underlay-corner-radius': 14,
        'overlay-corner-radius': 18,
        'overlay-shape': 'ellipse',
      },
      'layer-soft': {
        'underlay-corner-radius': 'auto',
        'overlay-corner-radius': 'auto',
        'overlay-shape': 'round-rectangle',
      },
    };

    return scene(
      { nodes, edges: [] },
      {
        nodes: {
          'background-color': mapper('bg', '#ddd'),
          'background-opacity': 0.8,
          'corner-radius': 'auto',
          'underlay-shape': 'round-rectangle',
          'underlay-color': '#f05a4f',
          'underlay-opacity': mapper('layerOpacity', 0.7),
          'underlay-padding': 12,
          'underlay-corner-radius': 12,
          'overlay-shape': 'round-rectangle',
          'overlay-color': '#2785bf',
          'overlay-opacity': 0.5,
          'overlay-padding': 8,
          'overlay-corner-radius': 12,
          'font-size': 11,
          'text-halign': 'center',
          'text-valign': 'center',
          'text-wrap': 'wrap',
          'text-max-width': 138,
        },
        bypasses: {
          ...layerBypasses,
          'layer-caption-round': {
            width: 1,
            height: 1,
            'background-opacity': 0,
            'border-width': 0,
          },
          'layer-caption-ellipse': {
            width: 1,
            height: 1,
            'background-opacity': 0,
            'border-width': 0,
          },
          'layer-caption-soft': {
            width: 1,
            height: 1,
            'background-opacity': 0,
            'border-width': 0,
          },
        },
      },
      {
        coverage: coverage(
          [
            {
              group: 'nodes',
              property: 'overlay-shape',
              target: 'layer-square',
              value: 'ellipse',
            },
            {
              group: 'nodes',
              property: 'overlay-shape',
              target: 'layer-round',
              value: 'round-rectangle',
            },
            {
              group: 'nodes',
              property: 'underlay-corner-radius',
              target: 'layer-round',
              value: 4,
            },
            {
              group: 'nodes',
              property: 'corner-radius',
              target: 'layer-soft',
              value: 'auto',
              alternate: 0,
            },
            {
              group: 'nodes',
              property: 'underlay-corner-radius',
              target: 'layer-soft',
              value: 'auto',
              alternate: 12,
            },
            {
              group: 'nodes',
              property: 'overlay-corner-radius',
              target: 'layer-round',
              value: 8,
            },
            {
              group: 'nodes',
              property: 'overlay-corner-radius',
              target: 'layer-soft',
              value: 'auto',
              alternate: 12,
            },
            {
              group: 'nodes',
              property: 'underlay-padding',
              target: 'layer-round',
              value: 12,
            },
            {
              group: 'nodes',
              property: 'overlay-padding',
              target: 'layer-round',
              value: 8,
            },
          ],
          [
            {
              group: 'nodes',
              property: 'overlay-shape',
              target: 'layer-square',
              value: 'ellipse',
              alternate: 'round-rectangle',
            },
            {
              group: 'nodes',
              property: 'overlay-shape',
              target: 'layer-round',
              value: 'round-rectangle',
              alternate: 'ellipse',
            },
            {
              group: 'nodes',
              property: 'underlay-corner-radius',
              target: 'layer-soft',
              value: 'auto',
              alternate: 12,
            },
            {
              group: 'nodes',
              property: 'overlay-corner-radius',
              target: 'layer-soft',
              value: 'auto',
              alternate: 12,
            },
            {
              group: 'nodes',
              property: 'corner-radius',
              target: 'layer-soft',
              value: 'auto',
              alternate: 0,
            },
          ],
        ),
        notes: [
          'Red is the underlay and blue is the overlay. Captions name each radius and contour below the layer stack.',
        ],
      },
    );
  };

  const paintOutlines = () => {
    const styles = ['solid', 'dashed', 'dotted', 'double'];
    const nodes = styles.flatMap((outline, i) => [
      node(`outline-${outline}`, 100 + i * 150, 110, {
        label: '',
        outline,
        width: [2, 4, 5, 6][i],
        offset: [0, 2, 5, 7][i],
      }),
      node(`outline-caption-${outline}`, 100 + i * 150, 200, {
        label:
          outline === 'double'
            ? 'double (solid today) · 6 px'
            : `${outline} · ${[2, 4, 5, 6][i]} px`,
      }),
    ]);

    return scene(
      { nodes, edges: [] },
      {
        nodes: {
          'background-color': '#e7edf4',
          'outline-style': mapper('outline', 'solid'),
          'outline-color': '#bc4a45',
          'outline-opacity': 0.88,
          'outline-width': mapper('width', 2),
          'outline-offset': mapper('offset', 0),
          'font-size': 12,
          'text-halign': 'center',
          'text-valign': 'center',
        },
        bypasses: Object.fromEntries(
          styles.map((outline) => [
            `outline-caption-${outline}`,
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
        coverage: coverage(
          [
            {
              group: 'nodes',
              property: 'outline-style',
              target: 'outline-double',
              value: 'double',
              reason:
                'The current outline renderer draws the authored double style as a solid outline. This is recorded as an accepted visual limitation; the authored value still resolves as double.',
            },
            {
              group: 'nodes',
              property: 'outline-color',
              target: 'outline-dashed',
              value: '#bc4a45',
            },
            {
              group: 'nodes',
              property: 'outline-opacity',
              target: 'outline-dotted',
              value: 0.88,
            },
            {
              group: 'nodes',
              property: 'outline-width',
              target: 'outline-dotted',
              value: 5,
            },
            {
              group: 'nodes',
              property: 'outline-offset',
              target: 'outline-double',
              value: 7,
            },
          ],
          [
            {
              group: 'nodes',
              property: 'outline-style',
              target: 'outline-solid',
              value: 'solid',
              alternate: 'dashed',
            },
            {
              group: 'nodes',
              property: 'outline-style',
              target: 'outline-dashed',
              value: 'dashed',
              alternate: 'solid',
            },
            {
              group: 'nodes',
              property: 'outline-style',
              target: 'outline-dotted',
              value: 'dotted',
              alternate: 'solid',
            },
            {
              group: 'nodes',
              property: 'outline-style',
              target: 'outline-double',
              value: 'double',
              reason:
                'The current outline renderer draws the authored double style as a solid outline. This is recorded as an accepted visual limitation; the authored value still resolves as double.',
            },
          ],
        ),
      },
    );
  };

  const paintFills = () => {
    const fills = ['solid', 'linear-gradient', 'radial-gradient'];
    const nodes = fills.map((fill, i) =>
      node(`fill-${i}`, 110 + i * 220, 110, {
        label: fill.replace('-gradient', ''),
        fill,
        direction: 'to-right',
      }),
    );

    return scene(
      { nodes, edges: [] },
      {
        nodes: {
          width: 120,
          height: 80,
          'text-valign': 'bottom',
          'text-margin-y': 4,
          'background-color': '#f3c969',
          'background-fill': mapper('fill', 'solid'),
          'background-gradient-direction': mapper('direction', 'to-right'),
          'background-gradient-stop-colors': ['#f3c969', '#fff4c9', '#d86a55'],
          'background-gradient-stop-positions': [0, 29, 100],
          'border-width': 2,
          'border-color': '#28384a',
        },
      },
      {
        coverage: coverage(
          [
            {
              group: 'nodes',
              property: 'background-gradient-stop-positions',
              target: 'fill-1',
              value: [0, 29, 100],
            },
          ],
          fills.map((fill, i) => ({
            group: 'nodes',
            property: 'background-fill',
            target: `fill-${i}`,
            value: fill,
            alternate: fill === 'solid' ? 'linear-gradient' : 'solid',
          })),
        ),
        notes: [
          'All three fill modes use the same color stops and direction, so only the fill mode changes across samples.',
        ],
      },
    );
  };

  const paintEdges = () => {
    const items = [
      ['butt · dashed', 'butt', 'dashed', 0, 1, 'solid'],
      ['round · dashed', 'round', 'dashed', 7, 0.75, 'linear-gradient'],
      ['square · dotted', 'square', 'dotted', -4, 0.5, 'radial-gradient'],
    ];
    const nodes = [];
    const edges = [];

    items.forEach(([label, cap, dash, offset, opacity, lineFill], i) => {
      const y = 90 + i * 105;
      const s = `edge-paint-s${i}`;
      const t = `edge-paint-t${i}`;
      nodes.push(
        node(s, 90, y, {
          label: '',
          role: i,
          fill: ['#c74d55', '#388c78', '#546db5'][i],
        }),
      );
      nodes.push(node(t, 470, y, { label: '' }));
      nodes.push(
        node(`edge-paint-caption-${i}`, 280, y - 46, {
          label: `${cap} cap · ${dash}`,
        }),
      );
      edges.push(
        edge(`edge-paint-${i}`, s, t, {
          role: i,
          cap,
          dash,
          offset,
          opacity,
          overlayOpacity: [0.24, 0.16, 0.3][i],
          lineOpacity: [1, 0.8, 0.65][i],
          outlineWidth: [0, 7, 4][i],
          lineFill,
        }),
      );
    });

    return scene(
      { nodes, edges },
      {
        nodes: {
          width: 42,
          height: 34,
          'font-size': 13,
          'text-halign': 'center',
          'text-valign': 'center',
        },
        edges: {
          'line-color': mapper('fill', '#526273'),
          'line-fill': mapper('lineFill', 'solid'),
          'line-gradient-stop-colors': ['#17293d', '#f5c15d', '#db5c49'],
          'line-gradient-stop-positions': [0, 38, 100],
          'line-cap': mapper('cap', 'butt'),
          'line-style': mapper('dash', 'solid'),
          'line-dash-pattern': [12, 5],
          'line-dash-offset': mapper('offset', 0),
          opacity: mapper('opacity', 1),
          'line-opacity': mapper('lineOpacity', 1),
          'line-outline-width': mapper('outlineWidth', 0),
          'line-outline-color': '#203040',
          'overlay-color': '#7547a8',
          'overlay-opacity': mapper('overlayOpacity', 0.24),
          'overlay-padding': 6,
          'underlay-color': '#f05a4f',
          'underlay-opacity': 0.35,
          'underlay-padding': 9,
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#263a4d',
        },
        bypasses: Object.fromEntries(
          items.map((_, i) => [
            `edge-paint-caption-${i}`,
            {
              width: 1,
              height: 1,
              'background-opacity': 0,
              'border-width': 0,
            },
          ]),
        ),
      },
      {
        coverage: coverage(
          [
            {
              group: 'edges',
              property: 'line-fill',
              target: 'edge-paint-0',
              value: 'solid',
            },
            {
              group: 'edges',
              property: 'line-fill',
              target: 'edge-paint-1',
              value: 'linear-gradient',
            },
            {
              group: 'edges',
              property: 'line-fill',
              target: 'edge-paint-2',
              value: 'radial-gradient',
            },
            {
              group: 'edges',
              property: 'line-gradient-stop-colors',
              target: 'edge-paint-1',
              value: ['#17293d', '#f5c15d', '#db5c49'],
            },
            {
              group: 'edges',
              property: 'line-gradient-stop-positions',
              target: 'edge-paint-1',
              value: [0, 38, 100],
            },
            {
              group: 'edges',
              property: 'line-cap',
              target: 'edge-paint-0',
              value: 'butt',
              alternate: 'round',
            },
            {
              group: 'edges',
              property: 'line-cap',
              target: 'edge-paint-1',
              value: 'round',
              alternate: 'butt',
            },
            {
              group: 'edges',
              property: 'line-cap',
              target: 'edge-paint-2',
              value: 'square',
              alternate: 'butt',
            },
            {
              group: 'edges',
              property: 'overlay-color',
              target: 'edge-paint-0',
              value: '#7547a8',
            },
            {
              group: 'edges',
              property: 'overlay-opacity',
              target: 'edge-paint-1',
              value: 0.16,
            },
            {
              group: 'edges',
              property: 'overlay-padding',
              target: 'edge-paint-2',
              value: 6,
            },
            {
              group: 'edges',
              property: 'line-dash-pattern',
              target: 'edge-paint-1',
              value: [12, 5],
            },
            {
              group: 'edges',
              property: 'line-dash-offset',
              target: 'edge-paint-1',
              value: 7,
            },
            {
              group: 'edges',
              property: 'line-outline-width',
              target: 'edge-paint-1',
              value: 7,
            },
            {
              group: 'edges',
              property: 'line-outline-color',
              target: 'edge-paint-1',
              value: '#203040',
            },
            {
              group: 'edges',
              property: 'opacity',
              target: 'edge-paint-2',
              value: 0.5,
            },
            {
              group: 'edges',
              property: 'underlay-padding',
              target: 'edge-paint-1',
              value: 9,
            },
          ],
          [
            {
              group: 'edges',
              property: 'line-cap',
              target: 'edge-paint-0',
              value: 'butt',
              alternate: 'round',
            },
            {
              group: 'edges',
              property: 'line-cap',
              target: 'edge-paint-1',
              value: 'round',
              alternate: 'butt',
            },
            {
              group: 'edges',
              property: 'line-cap',
              target: 'edge-paint-2',
              value: 'square',
              alternate: 'butt',
            },
          ],
        ),
      },
    );
  };

  return {
    paintNodes,
    paintBorders,
    paintGhosts,
    paintLayers,
    paintOutlines,
    paintFills,
    paintEdges,
  };
});
