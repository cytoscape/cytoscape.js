/*
The style property vocabulary (round 127): every property name v4's
style engine accepts — node, edge, core, compound and transition —
spelled once.  `src/style.mts` keys its switches, read sets, mapper
channels, readers and defaults by these; `animation.mts` its tween
channels; the collection its bulk-write list.  The strings are the
public spelling (`style('background-color')` is unchanged), so the
table is the engine's own census rather than a second vocabulary, and
`test/modules/string-keys.mjs` rejects a property literal anywhere else
under `src/`.

The list is alphabetical within a family and the families are in
alphabetical order.  Adding a property is one line here and the
engine's own tables — the engine still decides what each name means.
*/

/** Every style property name, keyed by its SCREAMING_SNAKE spelling. */
export const PROP = {
  ACTIVE_BG_COLOR: 'active-bg-color',
  ACTIVE_BG_OPACITY: 'active-bg-opacity',
  ACTIVE_BG_SIZE: 'active-bg-size',

  ARROW_SCALE: 'arrow-scale',

  BACKGROUND_CLIP: 'background-clip',
  BACKGROUND_COLOR: 'background-color',
  BACKGROUND_FILL: 'background-fill',
  BACKGROUND_FIT: 'background-fit',
  BACKGROUND_GRADIENT_DIRECTION: 'background-gradient-direction',
  BACKGROUND_GRADIENT_STOP_COLORS: 'background-gradient-stop-colors',
  BACKGROUND_GRADIENT_STOP_POSITIONS: 'background-gradient-stop-positions',
  BACKGROUND_HEIGHT: 'background-height',
  BACKGROUND_HEIGHT_RELATIVE_TO: 'background-height-relative-to',
  BACKGROUND_IMAGE: 'background-image',
  BACKGROUND_IMAGE_COLOR: 'background-image-color',
  BACKGROUND_IMAGE_CONTAINMENT: 'background-image-containment',
  BACKGROUND_IMAGE_CROSSORIGIN: 'background-image-crossorigin',
  BACKGROUND_IMAGE_OPACITY: 'background-image-opacity',
  BACKGROUND_IMAGE_SMOOTHING: 'background-image-smoothing',
  BACKGROUND_IMAGE_TYPE: 'background-image-type',
  BACKGROUND_OFFSET_X: 'background-offset-x',
  BACKGROUND_OFFSET_Y: 'background-offset-y',
  BACKGROUND_OPACITY: 'background-opacity',
  BACKGROUND_POSITION_X: 'background-position-x',
  BACKGROUND_POSITION_Y: 'background-position-y',
  BACKGROUND_REPEAT: 'background-repeat',
  BACKGROUND_WIDTH: 'background-width',
  BACKGROUND_WIDTH_RELATIVE_TO: 'background-width-relative-to',

  BORDER_COLOR: 'border-color',
  BORDER_DASH_OFFSET: 'border-dash-offset',
  BORDER_DASH_PATTERN: 'border-dash-pattern',
  BORDER_OPACITY: 'border-opacity',
  BORDER_POSITION: 'border-position',
  BORDER_STYLE: 'border-style',
  BORDER_WIDTH: 'border-width',

  CHART: 'chart',
  CHART_COLORS: 'chart-colors',
  CHART_DIRECTION: 'chart-direction',
  CHART_HOLE: 'chart-hole',
  CHART_OPACITY: 'chart-opacity',
  CHART_SIZE: 'chart-size',
  CHART_START_ANGLE: 'chart-start-angle',
  CHART_VALUES: 'chart-values',

  COLOR: 'color',

  COMPOUND_SIZING_WRT_LABELS: 'compound-sizing-wrt-labels',

  CONTROL_POINT_DISTANCES: 'control-point-distances',
  CONTROL_POINT_STEP_SIZE: 'control-point-step-size',
  CONTROL_POINT_WEIGHT: 'control-point-weight',
  CONTROL_POINT_WEIGHTS: 'control-point-weights',

  CORNER_RADIUS: 'corner-radius',

  CURVE_STYLE: 'curve-style',

  EDGE_DISTANCES: 'edge-distances',

  EVENTS: 'events',

  FONT_FAMILY: 'font-family',
  FONT_SIZE: 'font-size',
  FONT_STYLE: 'font-style',
  FONT_WEIGHT: 'font-weight',

  GHOST: 'ghost',
  GHOST_OFFSET_X: 'ghost-offset-x',
  GHOST_OFFSET_Y: 'ghost-offset-y',
  GHOST_OPACITY: 'ghost-opacity',

  HAYSTACK_RADIUS: 'haystack-radius',

  HEIGHT: 'height',

  LABEL: 'label',

  LINE_CAP: 'line-cap',
  LINE_COLOR: 'line-color',
  LINE_DASH_OFFSET: 'line-dash-offset',
  LINE_DASH_PATTERN: 'line-dash-pattern',
  LINE_FILL: 'line-fill',
  LINE_GRADIENT_STOP_COLORS: 'line-gradient-stop-colors',
  LINE_GRADIENT_STOP_POSITIONS: 'line-gradient-stop-positions',
  LINE_HEIGHT: 'line-height',
  LINE_OPACITY: 'line-opacity',
  LINE_OUTLINE_COLOR: 'line-outline-color',
  LINE_OUTLINE_WIDTH: 'line-outline-width',
  LINE_STYLE: 'line-style',

  LOOP_DIRECTION: 'loop-direction',
  LOOP_SWEEP: 'loop-sweep',

  MID_SOURCE_ARROW_COLOR: 'mid-source-arrow-color',
  MID_SOURCE_ARROW_SHAPE: 'mid-source-arrow-shape',
  MID_TARGET_ARROW_COLOR: 'mid-target-arrow-color',
  MID_TARGET_ARROW_SHAPE: 'mid-target-arrow-shape',

  MIN_HEIGHT: 'min-height',
  MIN_WIDTH: 'min-width',
  MIN_ZOOMED_FONT_SIZE: 'min-zoomed-font-size',

  OPACITY: 'opacity',

  OUTLINE_COLOR: 'outline-color',
  OUTLINE_OFFSET: 'outline-offset',
  OUTLINE_OPACITY: 'outline-opacity',
  OUTLINE_STYLE: 'outline-style',
  OUTLINE_WIDTH: 'outline-width',

  OVERLAY_COLOR: 'overlay-color',
  OVERLAY_CORNER_RADIUS: 'overlay-corner-radius',
  OVERLAY_OPACITY: 'overlay-opacity',
  OVERLAY_PADDING: 'overlay-padding',
  OVERLAY_SHAPE: 'overlay-shape',

  PADDING: 'padding',
  PADDING_BOTTOM: 'padding-bottom',
  PADDING_LEFT: 'padding-left',
  PADDING_RELATIVE_TO: 'padding-relative-to',
  PADDING_RIGHT: 'padding-right',
  PADDING_TOP: 'padding-top',

  RADIUS_TYPE: 'radius-type',

  SEGMENT_DISTANCES: 'segment-distances',
  SEGMENT_RADII: 'segment-radii',
  SEGMENT_WEIGHTS: 'segment-weights',

  SELECTION_BOX_BORDER_COLOR: 'selection-box-border-color',
  SELECTION_BOX_BORDER_WIDTH: 'selection-box-border-width',
  SELECTION_BOX_COLOR: 'selection-box-color',
  SELECTION_BOX_OPACITY: 'selection-box-opacity',

  SHAPE: 'shape',
  SHAPE_POLYGON_POINTS: 'shape-polygon-points',

  SOURCE_ARROW_COLOR: 'source-arrow-color',
  SOURCE_ARROW_FILL: 'source-arrow-fill',
  SOURCE_ARROW_SHAPE: 'source-arrow-shape',
  SOURCE_ARROW_WIDTH: 'source-arrow-width',
  SOURCE_DISTANCE_FROM_NODE: 'source-distance-from-node',
  SOURCE_ENDPOINT: 'source-endpoint',
  SOURCE_LABEL: 'source-label',
  SOURCE_TEXT_MARGIN_X: 'source-text-margin-x',
  SOURCE_TEXT_MARGIN_Y: 'source-text-margin-y',
  SOURCE_TEXT_OFFSET: 'source-text-offset',
  SOURCE_TEXT_ROTATION: 'source-text-rotation',

  TARGET_ARROW_COLOR: 'target-arrow-color',
  TARGET_ARROW_FILL: 'target-arrow-fill',
  TARGET_ARROW_SHAPE: 'target-arrow-shape',
  TARGET_ARROW_WIDTH: 'target-arrow-width',
  TARGET_DISTANCE_FROM_NODE: 'target-distance-from-node',
  TARGET_ENDPOINT: 'target-endpoint',
  TARGET_LABEL: 'target-label',
  TARGET_TEXT_MARGIN_X: 'target-text-margin-x',
  TARGET_TEXT_MARGIN_Y: 'target-text-margin-y',
  TARGET_TEXT_OFFSET: 'target-text-offset',
  TARGET_TEXT_ROTATION: 'target-text-rotation',

  TAXI_DIRECTION: 'taxi-direction',
  TAXI_RADIUS: 'taxi-radius',
  TAXI_TRACK: 'taxi-track',
  TAXI_TRACK_SPACING: 'taxi-track-spacing',
  TAXI_TURN: 'taxi-turn',
  TAXI_TURN_MIN_DISTANCE: 'taxi-turn-min-distance',

  TEXT_BACKGROUND_COLOR: 'text-background-color',
  TEXT_BACKGROUND_OPACITY: 'text-background-opacity',
  TEXT_BACKGROUND_PADDING: 'text-background-padding',
  TEXT_BACKGROUND_SHAPE: 'text-background-shape',
  TEXT_BORDER_COLOR: 'text-border-color',
  TEXT_BORDER_OPACITY: 'text-border-opacity',
  TEXT_BORDER_WIDTH: 'text-border-width',
  TEXT_EVENTS: 'text-events',
  TEXT_HALIGN: 'text-halign',
  TEXT_JUSTIFICATION: 'text-justification',
  TEXT_MARGIN_X: 'text-margin-x',
  TEXT_MARGIN_Y: 'text-margin-y',
  TEXT_MAX_WIDTH: 'text-max-width',
  TEXT_OPACITY: 'text-opacity',
  TEXT_OUTLINE_COLOR: 'text-outline-color',
  TEXT_OUTLINE_OPACITY: 'text-outline-opacity',
  TEXT_OUTLINE_WIDTH: 'text-outline-width',
  TEXT_OVERFLOW_WRAP: 'text-overflow-wrap',
  TEXT_ROTATION: 'text-rotation',
  TEXT_TRANSFORM: 'text-transform',
  TEXT_VALIGN: 'text-valign',
  TEXT_WRAP: 'text-wrap',

  TRANSITION_DELAY: 'transition-delay',
  TRANSITION_DURATION: 'transition-duration',
  TRANSITION_PROPERTY: 'transition-property',
  TRANSITION_TIMING_FUNCTION: 'transition-timing-function',

  UNDERLAY_COLOR: 'underlay-color',
  UNDERLAY_CORNER_RADIUS: 'underlay-corner-radius',
  UNDERLAY_OPACITY: 'underlay-opacity',
  UNDERLAY_PADDING: 'underlay-padding',
  UNDERLAY_SHAPE: 'underlay-shape',

  VISIBILITY: 'visibility',

  WIDTH: 'width',
} as const;

/** A style property name: one of the `PROP` values. */
export type StyleProp = (typeof PROP)[keyof typeof PROP];
