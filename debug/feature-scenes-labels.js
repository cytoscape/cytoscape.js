/* Pure scene builders for the visual feature harness. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory;
  if (root != null) (root.featureSceneParts ||= {}).labels = factory;
})(typeof globalThis === 'undefined' ? this : globalThis, function (api) {
  const { image, node, edge, mapper, coverage, scene } = api;
  const mappedLabelReadback = (property, mappedValue, getterValue) => ({
    resolvedValue: getterValue,
    readbackLimitation: {
      property,
      mappedValue,
      getterValue,
      sourceRefs: [
        'src/style/readers-labels.mts:44,85',
        'src/collection.mts:1695',
      ],
      reason:
        'The current public getter returns the stylesheet fallback for a data mapper (src/style/readers-labels.mts:44,85); the golden image verifies the per-element rendered value. This conflicts with the resolved stored-channel contract in src/collection.mts:1695.',
    },
  });
  const labels = (view) => {
    if (view === 'font-keywords') {
      const weightNode = node('label-weight-sample', 95, 100, {
        label: 'font weight 400',
      });
      const lineHeights = [0.8, 1.4, 2.2];
      const lineNodes = lineHeights.map((lineHeight, i) =>
        node(`label-line-height-${i}`, 95 + i * 160, 565, {
          label: 'line one line two line three',
          lineHeight,
          height: 112,
        }),
      );
      const borderStyles = ['dashed', 'dotted', 'double'];
      const borderNodes = borderStyles.map((border, i) =>
        node(`label-text-border-${border}`, 255 + i * 160, 410, {
          label: border,
          textBorder: border,
        }),
      );
      return scene(
        { nodes: [weightNode, ...borderNodes, ...lineNodes], edges: [] },
        {
          nodes: {
            width: 132,
            height: mapper('height', 62),
            label: mapper('label', ''),
            'font-size': 20,
            'font-weight': 400,
            'line-height': mapper('lineHeight', 1),
            'text-border-width': 2,
            'text-border-color': '#253f55',
            'text-border-opacity': 1,
            'text-border-style': mapper('textBorder', 'solid'),
            'text-background-color': '#fff',
            'text-background-opacity': 1,
            'text-background-padding': 3,
            'text-justification': 'center',
            'text-valign': 'center',
            'text-wrap': 'wrap',
            'text-max-width': 82,
          },
        },
        {
          notes: [
            'Font weight is renderer-wide because the glyph atlas holds one font at a time; use the selector to rebuild this sample with each keyword/weight.',
            'The three multiline samples isolate line-height; the text-border samples isolate dashed, dotted and double outlines.',
          ],
          coverage: coverage(
            [
              {
                group: 'nodes',
                property: 'font-weight',
                target: 'label-weight-sample',
                value: 400,
                alternate: 700,
              },
              {
                group: 'nodes',
                property: 'line-height',
                target: 'label-line-height-0',
                value: 0.8,
                alternate: 1.4,
              },
              {
                group: 'nodes',
                property: 'line-height',
                target: 'label-line-height-1',
                value: 1.4,
                alternate: 0.8,
              },
              {
                group: 'nodes',
                property: 'line-height',
                target: 'label-line-height-2',
                value: 2.2,
                alternate: 1.4,
              },
            ],
            [
              ...borderStyles.map((border) => ({
                group: 'nodes',
                property: 'text-border-style',
                target: `label-text-border-${border}`,
                value: border,
                alternate: border === 'dashed' ? 'dotted' : 'dashed',
              })),
            ],
          ),
        },
      );
    }

    const variant = /^(node|edge)-(justify|transform)-(.+)$/.exec(view);
    const variantGroup = variant?.[1];
    const variantProperty = variant?.[2];
    const variantValue = variant?.[3];
    const justification =
      variantProperty === 'justify' ? variantValue : 'center';
    const textTransform =
      variantProperty === 'transform' ? variantValue : 'none';

    if (view === 'edges' || variantGroup === 'edge') {
      const nodes = [];
      const edges = [];
      const styles = ['solid', 'dashed', 'dotted', 'double'];

      styles.forEach((border, i) => {
        const y = 90 + i * 120;
        const s = `label-edge-s${i}`;
        const t = `label-edge-t${i}`;
        nodes.push(node(s, 90, y, { label: `text border ${border}` }));
        nodes.push(node(t, 480, y, { label: '' }));
        edges.push(
          edge(`label-edge-${i}`, s, t, {
            label:
              i === 0
                ? 'words stay on one line'
                : `long-edge-label-without-spaces-${i}`,
            sourceLabel: i === 0 ? 'SOURCE LABEL 0' : `source label ${i}`,
            targetLabel: i === 0 ? 'TARGET LABEL 0' : `target label ${i}`,
            marginX: [0, 18, 0, -18][i],
            marginY: [0, 0, 14, -14][i],
            border,
            align: ['left', 'center', 'right', 'left'][i],
            transform: ['uppercase', 'lowercase', 'none', 'uppercase'][i],
            wrap: ['none', 'wrap', 'wrap', 'ellipsis'][i],
            overflowWrap: i === 0 ? 'whitespace' : 'anywhere',
            backgroundShape: i === 0 ? 'rectangle' : 'round-rectangle',
            rotation: i === 0 ? 'none' : 'autorotate',
            sourceRotation: i === 0 ? 'none' : 'autorotate',
            targetRotation: i === 0 ? 'none' : 'autorotate',
          }),
        );
      });

      const result = scene(
        { nodes, edges },
        {
          nodes: { width: 42, height: 30, 'text-halign': 'left' },
          edges: {
            'line-style': 'solid',
            label: mapper('label', ''),
            'source-label': mapper('sourceLabel', ''),
            'target-label': mapper('targetLabel', ''),
            'source-text-margin-x': 10,
            'source-text-margin-y': -8,
            'target-text-margin-x': 10,
            'target-text-margin-y': 8,
            'text-margin-x': mapper('marginX', 0),
            'text-margin-y': mapper('marginY', 0),
            'source-text-offset': 4,
            'target-text-offset': 4,
            'source-text-rotation': mapper('sourceRotation', 'none'),
            'target-text-rotation': mapper('targetRotation', 'none'),
            'text-rotation': mapper('rotation', 'none'),
            'font-size': 13,
            'line-height': 1.3,
            'min-zoomed-font-size': 11,
            'text-wrap': mapper('wrap', 'wrap'),
            'text-max-width': 115,
            'text-overflow-wrap': mapper('overflowWrap', 'whitespace'),
            'text-justification':
              variantGroup === 'edge'
                ? justification
                : mapper('align', 'center'),
            'text-transform':
              variantGroup === 'edge'
                ? textTransform
                : mapper('transform', 'none'),
            'text-opacity': 0.86,
            'text-outline-width': 1.5,
            'text-outline-color': '#fff',
            'text-outline-opacity': 0.7,
            'text-background-color': '#eef3f8',
            'text-background-opacity': 0.78,
            'text-background-shape': mapper('backgroundShape', 'rectangle'),
            'text-background-padding': 3,
            'text-border-width': 1,
            'text-border-color': '#263646',
            'text-border-opacity': 0.8,
            'text-border-style': mapper('border', 'solid'),
          },
        },
        {
          coverage: coverage(
            [
              {
                group: 'edges',
                property: 'source-label',
                target: 'label-edge-0',
                value: 'SOURCE LABEL 0',
              },
              {
                group: 'edges',
                property: 'target-label',
                target: 'label-edge-0',
                value: 'TARGET LABEL 0',
              },
              {
                group: 'edges',
                property: 'source-text-margin-x',
                target: 'label-edge-0',
                value: 10,
              },
              {
                group: 'edges',
                property: 'target-text-margin-y',
                target: 'label-edge-0',
                value: 8,
              },
              {
                group: 'edges',
                property: 'text-margin-x',
                target: 'label-edge-1',
                value: 18,
                alternate: 0,
              },
              {
                group: 'edges',
                property: 'text-margin-y',
                target: 'label-edge-2',
                value: 14,
                alternate: 0,
              },
              {
                group: 'edges',
                property: 'text-max-width',
                target: 'label-edge-0',
                value: 115,
              },
              {
                group: 'edges',
                property: 'text-opacity',
                target: 'label-edge-0',
                value: 0.86,
              },
              {
                group: 'edges',
                property: 'text-outline-color',
                target: 'label-edge-0',
                value: '#fff',
              },
              {
                group: 'edges',
                property: 'text-outline-width',
                target: 'label-edge-0',
                value: 1.5,
              },
              {
                group: 'edges',
                property: 'text-outline-opacity',
                target: 'label-edge-0',
                value: 0.7,
              },
              {
                group: 'edges',
                property: 'text-justification',
                target: 'label-edge-0',
                value: 'left',
                ...mappedLabelReadback('text-justification', 'left', 'auto'),
              },
              {
                group: 'edges',
                property: 'text-transform',
                target: 'label-edge-0',
                value: 'uppercase',
                ...mappedLabelReadback('text-transform', 'uppercase', 'none'),
              },
              {
                group: 'edges',
                property: 'line-style',
                target: 'label-edge-0',
                value: 'solid',
              },
              {
                group: 'edges',
                property: 'text-background-shape',
                target: 'label-edge-0',
                value: 'rectangle',
              },
              {
                group: 'edges',
                property: 'text-overflow-wrap',
                target: 'label-edge-0',
                value: 'whitespace',
              },
              {
                group: 'edges',
                property: 'text-wrap',
                target: 'label-edge-0',
                value: 'none',
              },
              {
                group: 'edges',
                property: 'text-rotation',
                target: 'label-edge-0',
                value: 'none',
              },
              {
                group: 'edges',
                property: 'source-text-rotation',
                target: 'label-edge-0',
                value: 'none',
              },
              {
                group: 'edges',
                property: 'target-text-rotation',
                target: 'label-edge-0',
                value: 'none',
              },
            ],
            [
              {
                group: 'edges',
                property: 'text-border-style',
                target: 'label-edge-2',
                value: 'dotted',
                alternate: 'solid',
              },
              {
                group: 'edges',
                property: 'text-justification',
                target: 'label-edge-0',
                value: 'left',
                alternate: 'center',
                ...mappedLabelReadback('text-justification', 'left', 'auto'),
              },
              {
                group: 'edges',
                property: 'text-justification',
                target: 'label-edge-1',
                value: 'center',
                alternate: 'right',
                ...mappedLabelReadback('text-justification', 'center', 'auto'),
              },
              {
                group: 'edges',
                property: 'text-justification',
                target: 'label-edge-2',
                value: 'right',
                alternate: 'center',
                ...mappedLabelReadback('text-justification', 'right', 'auto'),
              },
              {
                group: 'edges',
                property: 'text-justification',
                target: 'label-edge-3',
                value: 'left',
                alternate: 'right',
                ...mappedLabelReadback('text-justification', 'left', 'auto'),
              },
              {
                group: 'edges',
                property: 'text-transform',
                target: 'label-edge-0',
                value: 'uppercase',
                alternate: 'lowercase',
                ...mappedLabelReadback('text-transform', 'uppercase', 'none'),
              },
              {
                group: 'edges',
                property: 'text-transform',
                target: 'label-edge-1',
                value: 'lowercase',
                alternate: 'uppercase',
                ...mappedLabelReadback('text-transform', 'lowercase', 'none'),
              },
              {
                group: 'edges',
                property: 'text-transform',
                target: 'label-edge-2',
                value: 'none',
                alternate: 'lowercase',
                ...mappedLabelReadback('text-transform', 'none', 'none'),
              },
              {
                group: 'edges',
                property: 'text-overflow-wrap',
                target: 'label-edge-0',
                value: 'whitespace',
                alternate: 'anywhere',
              },
              {
                group: 'edges',
                property: 'text-overflow-wrap',
                target: 'label-edge-1',
                value: 'anywhere',
                alternate: 'whitespace',
              },
              {
                group: 'edges',
                property: 'text-wrap',
                target: 'label-edge-3',
                value: 'ellipsis',
                alternate: 'none',
              },
              {
                group: 'edges',
                property: 'text-wrap',
                target: 'label-edge-0',
                value: 'none',
                alternate: 'wrap',
              },
              {
                group: 'edges',
                property: 'line-style',
                target: 'label-edge-0',
                value: 'solid',
                alternate: 'dashed',
              },
              {
                group: 'edges',
                property: 'text-background-shape',
                target: 'label-edge-0',
                value: 'rectangle',
                alternate: 'round-rectangle',
              },
              {
                group: 'edges',
                property: 'text-rotation',
                target: 'label-edge-0',
                value: 'none',
                alternate: 'autorotate',
              },
              {
                group: 'edges',
                property: 'source-text-rotation',
                target: 'label-edge-0',
                value: 'none',
                alternate: 'autorotate',
              },
              {
                group: 'edges',
                property: 'target-text-rotation',
                target: 'label-edge-0',
                value: 'none',
                alternate: 'autorotate',
              },
            ],
          ),
        },
      );
      return result;
    }

    const items = [
      {
        id: 'label-left',
        text: 'left justified words',
        align: 'left',
        transform: 'uppercase',
        wrap: 'wrap',
        priority: 1,
        fontStyle: 'normal',
        events: 'yes',
        textEvents: 'yes',
      },
      {
        id: 'label-center',
        text: 'center justified words',
        align: 'center',
        transform: 'lowercase',
        wrap: 'wrap',
        priority: 2,
        fontStyle: 'italic',
        events: 'yes',
        textEvents: 'yes',
      },
      {
        id: 'label-right',
        text: 'right justified words',
        align: 'right',
        transform: 'none',
        wrap: 'wrap',
        priority: 3,
        fontStyle: 'oblique',
        events: 'yes',
        textEvents: 'yes',
      },
      {
        id: 'label-anywhere',
        text: 'UNBROKEN-LABEL-WITH-A-LONG-TAIL',
        align: 'auto',
        transform: 'uppercase',
        wrap: 'wrap',
        priority: 4,
        fontStyle: 'normal',
        events: 'yes',
        textEvents: 'yes',
      },
      {
        id: 'label-ellipsis',
        text: 'ellipsis truncates this very long label',
        align: 'center',
        transform: 'lowercase',
        wrap: 'ellipsis',
        priority: 5,
        fontStyle: 'italic',
        events: 'yes',
        textEvents: 'yes',
      },
      {
        id: 'label-hidden',
        text: 'hidden visibility sample',
        align: 'center',
        transform: 'none',
        wrap: 'wrap',
        priority: 0,
        visibility: 'hidden',
        fontStyle: 'oblique',
        events: 'no',
        textEvents: 'no',
      },
    ];
    const nodes = items.map((item, i) =>
      node(item.id, 100 + (i % 3) * 180, 100 + Math.floor(i / 3) * 150, item),
    );
    nodes.push(
      node('hidden-note', 280, 250, { text: 'blank cell = visibility:hidden' }),
    );

    const commonTextStyle = {
      label: mapper('text', ''),
      width: 150,
      height: 70,
      'font-size': 16,
      'font-weight': 'bold',
      'font-style': 'normal',
      'text-wrap': mapper('wrap', 'wrap'),
      'text-max-width': 132,
      'text-overflow-wrap': mapper('wrapRule', 'anywhere'),
      'text-justification':
        variantGroup === 'node' ? justification : mapper('align', 'center'),
      'text-transform':
        variantGroup === 'node' ? textTransform : mapper('transform', 'none'),
      'label-priority': mapper('priority', 0),
      'text-opacity': mapper('opacity', 0.84),
      'text-outline-width': 2,
      'text-outline-color': '#fff',
      'text-outline-opacity': mapper('outlineOpacity', 0.65),
      'text-background-color': '#eaf1f7',
      'text-background-opacity': 0.35,
      'text-background-padding': 2,
      'min-zoomed-font-size': 12,
      visibility: mapper('visibility', 'visible'),
      events: mapper('events', 'yes'),
      'text-events': mapper('textEvents', 'yes'),
    };

    const result = scene(
      { nodes, edges: [] },
      { nodes: commonTextStyle, core: { 'label-declutter': 'cull' } },
      {
        coverage: coverage(
          [
            {
              group: 'nodes',
              property: 'label-priority',
              target: 'label-right',
              value: 3,
            },
            {
              group: 'nodes',
              property: 'min-zoomed-font-size',
              target: 'label-left',
              value: 12,
            },
            {
              group: 'nodes',
              property: 'text-opacity',
              target: 'label-left',
              value: 0.84,
            },
            {
              group: 'nodes',
              property: 'text-outline-opacity',
              target: 'label-left',
              value: 0.65,
            },
            {
              group: 'nodes',
              property: 'text-overflow-wrap',
              target: 'label-anywhere',
              value: 'anywhere',
            },
            {
              group: 'nodes',
              property: 'text-justification',
              target: 'label-left',
              value: 'left',
              ...mappedLabelReadback('text-justification', 'left', 'auto'),
            },
            {
              group: 'nodes',
              property: 'text-transform',
              target: 'label-left',
              value: 'uppercase',
              ...mappedLabelReadback('text-transform', 'uppercase', 'none'),
            },
            {
              group: 'nodes',
              property: 'text-justification',
              target: 'label-anywhere',
              value: 'auto',
              ...mappedLabelReadback('text-justification', 'auto', 'auto'),
            },
          ],
          [
            {
              group: 'nodes',
              property: 'font-style',
              target: 'label-left',
              value: 'normal',
              alternate: 'italic',
            },
            {
              group: 'nodes',
              property: 'text-justification',
              target: 'label-left',
              value: 'left',
              alternate: 'center',
              ...mappedLabelReadback('text-justification', 'left', 'auto'),
            },
            {
              group: 'nodes',
              property: 'text-justification',
              target: 'label-center',
              value: 'center',
              alternate: 'right',
              ...mappedLabelReadback('text-justification', 'center', 'auto'),
            },
            {
              group: 'nodes',
              property: 'text-justification',
              target: 'label-right',
              value: 'right',
              alternate: 'center',
              ...mappedLabelReadback('text-justification', 'right', 'auto'),
            },
            {
              group: 'nodes',
              property: 'text-justification',
              target: 'label-anywhere',
              value: 'auto',
              alternate: 'left',
              ...mappedLabelReadback('text-justification', 'auto', 'auto'),
            },
            {
              group: 'nodes',
              property: 'text-overflow-wrap',
              target: 'label-anywhere',
              value: 'anywhere',
              alternate: 'whitespace',
            },
            {
              group: 'nodes',
              property: 'text-transform',
              target: 'label-left',
              value: 'uppercase',
              alternate: 'lowercase',
              ...mappedLabelReadback('text-transform', 'uppercase', 'none'),
            },
            {
              group: 'nodes',
              property: 'text-transform',
              target: 'label-center',
              value: 'lowercase',
              alternate: 'uppercase',
              ...mappedLabelReadback('text-transform', 'lowercase', 'none'),
            },
            {
              group: 'nodes',
              property: 'text-transform',
              target: 'label-right',
              value: 'none',
              alternate: 'uppercase',
              ...mappedLabelReadback('text-transform', 'none', 'none'),
            },
            {
              group: 'nodes',
              property: 'visibility',
              target: 'label-hidden',
              value: 'hidden',
              alternate: 'visible',
              note: 'The adjacent caption identifies the deliberate blank cell.',
            },
          ],
          [
            {
              group: 'nodes',
              property: 'events',
              target: 'label-left',
              value: 'yes',
              alternate: 'no',
              reason:
                'Pointer transparency changes hit testing and event delivery, not pixels; click label-left to test picking.',
            },
            {
              group: 'nodes',
              property: 'events',
              target: 'label-hidden',
              value: 'no',
              alternate: 'yes',
              reason:
                'Pointer transparency changes hit testing and event delivery, not pixels; label-hidden has no visible body label.',
            },
            {
              group: 'nodes',
              property: 'text-events',
              target: 'label-left',
              value: 'yes',
              alternate: 'no',
              reason:
                'Label-box hit testing changes pointer routing, not pixels; click label-left to test picking.',
            },
            {
              group: 'nodes',
              property: 'text-events',
              target: 'label-hidden',
              value: 'no',
              alternate: 'yes',
              reason:
                'Label-box hit testing changes pointer routing, not pixels; label-hidden has no visible text.',
            },
          ],
        ),
      },
    );

    const fontStyles = {
      'font-style-normal': 'normal',
      'font-style-italic': 'italic',
      'font-style-oblique': 'oblique',
    };
    if (fontStyles[view] != null) {
      const fontStyle = fontStyles[view];
      result.style.nodes['font-style'] = fontStyle;
      result.coverage.keywords = result.coverage.keywords.filter(
        (row) => row.property !== 'font-style',
      );
      result.coverage.keywords.push({
        group: 'nodes',
        property: 'font-style',
        target: 'label-left',
        value: fontStyle,
        alternate: fontStyle === 'normal' ? 'italic' : 'normal',
      });
      result.notes.push(
        'font-style is renderer-wide in this scene and each view rebuilds with one font style.',
      );
    }

    if (view.startsWith('font-family-')) {
      const families = {
        'font-family-sans': 'sans-serif',
        'font-family-serif': 'serif',
        'font-family-monospace': 'monospace',
      };
      const fontFamily = families[view];
      result.style.nodes['font-family'] = fontFamily;
      result.coverage.properties.push({
        group: 'nodes',
        property: 'font-family',
        target: 'label-left',
        value: fontFamily,
      });
      result.notes.push(
        'font-family is renderer-wide because one glyph atlas holds one face; changing this view rebuilds the renderer with the selected generic family.',
      );
    }

    return result;
  };

  const images = () => {
    const patterns = [
      image('#e35b4f', '<circle cx="24" cy="24" r="8" fill="#fff"/>'),
      image(
        '#2584aa',
        '<path d="M0 0l48 48M48 0L0 48" stroke="#fff" stroke-width="5"/>',
      ),
      image(
        '#9e6fc5',
        '<circle cx="12" cy="12" r="7" fill="#fff"/><circle cx="36" cy="36" r="7" fill="#fff"/>',
      ),
      image(
        '#d8962d',
        '<path d="M0 8h48M0 24h48M0 40h48" stroke="#fff" stroke-width="4"/>',
      ),
      image(
        '#1c2733',
        '<path d="M8 8h32v32H8z" fill="none" stroke="#fff" stroke-width="4"/>',
      ),
    ];
    const rows = [
      [
        'cover · node',
        'cover',
        'node',
        'inside',
        'no-repeat',
        'yes',
        0,
        'auto',
        0,
      ],
      [
        'contain · over',
        'contain',
        'none',
        'over',
        'no-repeat',
        'yes',
        14,
        'auto',
        12,
      ],
      [
        'repeat-x · crisp',
        'cover',
        'node',
        'inside',
        'repeat-x',
        'no',
        -12,
        'auto',
        -12,
      ],
      [
        'repeat-y · smooth',
        'contain',
        'node',
        'inside',
        'repeat-y',
        'yes',
        9,
        'auto',
        18,
      ],
      [
        'repeat · SDF icon',
        'none',
        'node',
        'inside',
        'repeat',
        'no',
        0,
        'sdf-icon',
        0,
      ],
    ];
    const nodes = rows.map(
      ([label, fit, clip, containment, repeat, smoothing, offset], i) =>
        node(`image-${i}`, 100 + (i % 3) * 225, 85 + Math.floor(i / 3) * 175, {
          label,
          url: patterns[i],
          bgOpacity: [1, 0.8, 1, 0.9][i],
        }),
    );
    const bypasses = {};

    rows.forEach((row, i) => {
      const [
        ,
        fit,
        clip,
        containment,
        repeat,
        smoothing,
        offset,
        imageType,
        offsetY,
      ] = row;
      bypasses[`image-${i}`] = {
        'background-fit': fit,
        'background-clip': clip,
        'background-image-containment': containment,
        'background-repeat': repeat,
        'background-image-smoothing': smoothing,
        'background-image-crossorigin':
          i === 1 ? 'null' : i === 2 ? 'use-credentials' : 'anonymous',
        'background-offset-x': offset,
        'background-offset-y': offsetY,
        'background-width': i === 0 ? 'auto' : 56,
        'background-height': i === 0 ? 'auto' : 48,
        'background-position-x': ['50%', '35%', '50%', '70%', '50%'][i],
        'background-position-y': ['50%', '50%', '50%', '35%', '50%'][i],
      };
      if (imageType === 'sdf-icon') {
        bypasses[`image-${i}`]['background-image-type'] = 'sdf-icon';
        bypasses[`image-${i}`]['background-image-color'] = '#cb3550';
      }
    });

    return scene(
      { nodes, edges: [] },
      {
        nodes: {
          width: 150,
          height: 110,
          'text-valign': 'bottom',
          'text-margin-y': 4,
          'font-size': 12,
          'background-color': '#eef2f5',
          'background-opacity': mapper('bgOpacity', 1),
          'background-image': mapper('url', ''),
          'background-image-type': 'auto',
          'background-image-crossorigin': 'anonymous',
          'background-image-opacity': 0.94,
          'background-image-color': '#fff3c2',
          'border-color': '#33475b',
          'border-width': 2,
        },
        bypasses,
      },
      {
        coverage: coverage(
          [
            {
              group: 'nodes',
              property: 'background-fit',
              target: 'image-0',
              targetIndex: 0,
              value: 'cover',
              alternate: 'contain',
            },
            {
              group: 'nodes',
              property: 'background-fit',
              target: 'image-1',
              targetIndex: 0,
              value: 'contain',
              alternate: 'cover',
            },
            {
              group: 'nodes',
              property: 'background-fit',
              target: 'image-4',
              targetIndex: 0,
              value: 'none',
              alternate: 'contain',
            },
            {
              group: 'nodes',
              property: 'background-clip',
              target: 'image-0',
              targetIndex: 0,
              value: 'node',
              alternate: 'none',
            },
            {
              group: 'nodes',
              property: 'background-image-containment',
              target: 'image-1',
              value: 'over',
            },
            {
              group: 'nodes',
              property: 'background-image-smoothing',
              target: 'image-2',
              value: 'no',
            },
            {
              group: 'nodes',
              property: 'background-image-smoothing',
              target: 'image-0',
              value: 'yes',
            },
            {
              group: 'nodes',
              property: 'background-offset-x',
              target: 'image-1',
              value: 14,
            },
            {
              group: 'nodes',
              property: 'background-offset-y',
              target: 'image-1',
              value: 12,
              alternate: 0,
            },
            {
              group: 'nodes',
              property: 'background-opacity',
              target: 'image-1',
              value: 0.8,
            },
            {
              group: 'nodes',
              property: 'background-repeat',
              target: 'image-2',
              value: 'repeat-x',
            },
            {
              group: 'nodes',
              property: 'background-image-type',
              target: 'image-4',
              value: 'sdf-icon',
            },
            {
              group: 'nodes',
              property: 'background-image-crossorigin',
              target: 'image-0',
              value: 'anonymous',
            },
            {
              group: 'nodes',
              property: 'background-width',
              target: 'image-0',
              value: 'auto',
              alternate: 56,
            },
            {
              group: 'nodes',
              property: 'background-height',
              target: 'image-0',
              value: 'auto',
              alternate: 48,
            },
            {
              group: 'nodes',
              property: 'background-image-color',
              target: 'image-4',
              value: '#cb3550',
            },
            {
              group: 'nodes',
              property: 'background-image-opacity',
              target: 'image-0',
              value: 0.94,
            },
          ],
          [
            {
              group: 'nodes',
              property: 'background-clip',
              target: 'image-0',
              value: 'node',
            },
            {
              group: 'nodes',
              property: 'background-clip',
              target: 'image-1',
              targetIndex: 0,
              value: 'none',
              alternate: 'node',
            },
            {
              group: 'nodes',
              property: 'background-image-containment',
              target: 'image-0',
              targetIndex: 0,
              value: 'inside',
              alternate: 'over',
            },
            {
              group: 'nodes',
              property: 'background-image-containment',
              target: 'image-1',
              targetIndex: 0,
              value: 'over',
              alternate: 'inside',
            },
            {
              group: 'nodes',
              property: 'background-repeat',
              target: 'image-0',
              targetIndex: 0,
              value: 'no-repeat',
              alternate: 'repeat',
            },
            {
              group: 'nodes',
              property: 'background-repeat',
              target: 'image-2',
              targetIndex: 0,
              value: 'repeat-x',
              alternate: 'no-repeat',
            },
            {
              group: 'nodes',
              property: 'background-repeat',
              target: 'image-3',
              targetIndex: 0,
              value: 'repeat-y',
              alternate: 'no-repeat',
            },
            {
              group: 'nodes',
              property: 'background-repeat',
              target: 'image-4',
              targetIndex: 0,
              value: 'repeat',
              alternate: 'no-repeat',
            },
            {
              group: 'nodes',
              property: 'background-image-smoothing',
              target: 'image-2',
              targetIndex: 0,
              value: 'no',
              alternate: 'yes',
            },
            {
              group: 'nodes',
              property: 'background-image-smoothing',
              target: 'image-0',
              targetIndex: 0,
              value: 'yes',
              alternate: 'no',
            },
            {
              group: 'nodes',
              property: 'background-image-type',
              target: 'image-0',
              targetIndex: 0,
              value: 'auto',
              alternate: 'sdf-icon',
            },
            {
              group: 'nodes',
              property: 'background-image-type',
              target: 'image-4',
              targetIndex: 0,
              value: 'sdf-icon',
              alternate: 'auto',
            },
          ],
          [
            {
              group: 'nodes',
              property: 'background-image-crossorigin',
              target: 'image-1',
              value: 'null',
              alternate: 'anonymous',
              reason:
                'All image sources are data URLs and make no network request, so request credentials cannot change pixels here. Fetch-policy behavior is exercised in test/image-registry.mjs.',
            },
            {
              group: 'nodes',
              property: 'background-image-crossorigin',
              target: 'image-2',
              value: 'use-credentials',
              alternate: 'anonymous',
              reason:
                'All image sources are data URLs and make no network request, so request credentials cannot change pixels here. Fetch-policy behavior is exercised in test/image-registry.mjs.',
            },
          ],
        ),
      },
    );
  };

  return { labels, images };
});
