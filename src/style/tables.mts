import {
  ARROW_CHEVRON,
  ARROW_CIRCLE,
  ARROW_DIAMOND,
  ARROW_NONE,
  ARROW_SQUARE,
  ARROW_TEE,
  ARROW_TRIANGLE,
  ARROW_VEE,
  ARROW_CIRCLE_TRIANGLE,
  ARROW_TRIANGLE_BACKCURVE,
  ARROW_TRIANGLE_CROSS,
  ARROW_TRIANGLE_TEE,
  SHAPE_BARREL,
  SHAPE_BOTTOM_ROUND_RECTANGLE,
  SHAPE_CIRCLE,
  SHAPE_CONCAVE_HEXAGON,
  SHAPE_CUT_RECTANGLE,
  SHAPE_DIAMOND,
  SHAPE_ELLIPSE,
  SHAPE_HEPTAGON,
  SHAPE_HEXAGON,
  SHAPE_OCTAGON,
  SHAPE_PENTAGON,
  SHAPE_RECTANGLE,
  SHAPE_RHOMBOID,
  SHAPE_RIGHT_RHOMBOID,
  SHAPE_POLYGON_CUSTOM,
  SHAPE_ROUND_RECTANGLE,
  SHAPE_ROUND_DIAMOND,
  SHAPE_ROUND_HEPTAGON,
  SHAPE_ROUND_HEXAGON,
  SHAPE_ROUND_OCTAGON,
  SHAPE_ROUND_PENTAGON,
  SHAPE_ROUND_TAG,
  SHAPE_ROUND_TRIANGLE,
  SHAPE_STAR,
  SHAPE_TAG,
  SHAPE_TRIANGLE,
  SHAPE_VEE,
} from '../contract.mjs';
import { resolveScheme, hexToRgb } from '../style-schemes.mjs';
import { isMapperSpec } from '../style-scales.mjs';
import { CURVE_EXTRA_DEFAULTS } from '../store/curve-index.mjs';
import type { CurveStyleExtras } from '../store/curve-index.mjs';
import type { GraphStore } from '../store/graph-store.mjs';
import type { StyleProps } from '../public-types.mjs';
import { PROP } from '../style-props.mjs';
import type { RGBA, ArrowShape } from './defaults.mjs';
import { parseColor, parseZeroOne } from './parse.mjs';
import { parseNonNegative } from './parse-edge.mjs';
import { normalizeProp } from './normalize.mjs';

/** data() value → label text ('' for absent) */
export const stringify = (value: unknown): string => {
  return value == null ? '' : String(value);
};

export const SHAPES: Record<string, number> = {
  ellipse: SHAPE_ELLIPSE,
  circle: SHAPE_CIRCLE,
  rectangle: SHAPE_RECTANGLE,
  square: SHAPE_RECTANGLE,
  'round-rectangle': SHAPE_ROUND_RECTANGLE,
  triangle: SHAPE_TRIANGLE,
  pentagon: SHAPE_PENTAGON,
  hexagon: SHAPE_HEXAGON,
  heptagon: SHAPE_HEPTAGON,
  octagon: SHAPE_OCTAGON,
  diamond: SHAPE_DIAMOND,
  rhomboid: SHAPE_RHOMBOID,
  vee: SHAPE_VEE,
  star: SHAPE_STAR,
  tag: SHAPE_TAG,
  polygon: SHAPE_POLYGON_CUSTOM,
  // round 27.2
  'right-rhomboid': SHAPE_RIGHT_RHOMBOID,
  'concave-hexagon': SHAPE_CONCAVE_HEXAGON,
  'cut-rectangle': SHAPE_CUT_RECTANGLE,
  // round 27.4
  'round-triangle': SHAPE_ROUND_TRIANGLE,
  'round-diamond': SHAPE_ROUND_DIAMOND,
  'round-pentagon': SHAPE_ROUND_PENTAGON,
  'round-hexagon': SHAPE_ROUND_HEXAGON,
  'round-heptagon': SHAPE_ROUND_HEPTAGON,
  'round-octagon': SHAPE_ROUND_OCTAGON,
  'round-tag': SHAPE_ROUND_TAG,
  'bottom-round-rectangle': SHAPE_BOTTOM_ROUND_RECTANGLE,
  barrel: SHAPE_BARREL,
};

/** RGBA bytes packed little-endian, matching WGSL unpack4x8unorm. */
export const packRgba = ([r, g, b, a]: RGBA): number => {
  return (r | (g << 8) | (b << 16) | (a << 24)) >>> 0;
};

/** The slot's 12b curve extras, defaulted for non-blob styles. */
export const curveExtrasFor = (
  store: GraphStore,
  slot: number,
): CurveStyleExtras => {
  return store.curveStyleAt(slot).extras ?? CURVE_EXTRA_DEFAULTS;
};

/** Formatted colour strings by packed rgba word (round 62.4): building
 * the string was about half of a colour read's cost, and a graph uses a
 * bounded palette.  Cleared wholesale at the bound rather than LRU'd —
 * the map re-warms in one read per colour. */
const RGBA_STRINGS = new Map<number, string>();
const RGBA_STRINGS_MAX = 4096;

/** RGBA bytes → the v3-style resolved color string. */
export const formatRgba = (
  r: number,
  g: number,
  b: number,
  a: number,
): string => {
  const key = ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
  let s = RGBA_STRINGS.get(key);

  if (s === undefined) {
    s =
      a === 255
        ? `rgb(${r},${g},${b})`
        : `rgba(${r},${g},${b},${Math.round((a / 255) * 1000) / 1000})`;

    if (RGBA_STRINGS.size >= RGBA_STRINGS_MAX) {
      RGBA_STRINGS.clear();
    }

    RGBA_STRINGS.set(key, s);
  }

  return s;
};

/** The B1 opacity fold: a channel opacity multiplies into the stored
 * alpha (v3's effective = channel opacity × element opacity; element
 * opacity stays its own column).  One definition for every fold site in
 * the write path — `writeChannels` and the round-61 narrow writers. */
export const foldRgba = ([r, g, b, a]: RGBA, opacity: number): RGBA => [
  r,
  g,
  b,
  Math.round(a * opacity),
];

/** The A2 layer fold: layer opacity into the packed record alpha (v3's
 * overlay never multiplies element opacity). */
export const foldLayerRgba = (color: RGBA, opacity: number): number =>
  packRgba(foldRgba(color, opacity));

/** Stored shape id → resolved keyword (the exact-circle compile collapses back to 'ellipse'). */
export const SHAPE_NAMES: Record<number, string> = {
  [SHAPE_CIRCLE]: 'ellipse',
  [SHAPE_ELLIPSE]: 'ellipse',
  [SHAPE_RECTANGLE]: 'rectangle',
  [SHAPE_ROUND_RECTANGLE]: 'round-rectangle',
  [SHAPE_TRIANGLE]: 'triangle',
  [SHAPE_PENTAGON]: 'pentagon',
  [SHAPE_HEXAGON]: 'hexagon',
  [SHAPE_HEPTAGON]: 'heptagon',
  [SHAPE_OCTAGON]: 'octagon',
  [SHAPE_DIAMOND]: 'diamond',
  [SHAPE_RHOMBOID]: 'rhomboid',
  [SHAPE_VEE]: 'vee',
  [SHAPE_STAR]: 'star',
  [SHAPE_TAG]: 'tag',
  [SHAPE_POLYGON_CUSTOM]: 'polygon',
  [SHAPE_RIGHT_RHOMBOID]: 'right-rhomboid',
  [SHAPE_CONCAVE_HEXAGON]: 'concave-hexagon',
  [SHAPE_CUT_RECTANGLE]: 'cut-rectangle',
  [SHAPE_ROUND_TRIANGLE]: 'round-triangle',
  [SHAPE_ROUND_DIAMOND]: 'round-diamond',
  [SHAPE_ROUND_PENTAGON]: 'round-pentagon',
  [SHAPE_ROUND_HEXAGON]: 'round-hexagon',
  [SHAPE_ROUND_HEPTAGON]: 'round-heptagon',
  [SHAPE_ROUND_OCTAGON]: 'round-octagon',
  [SHAPE_ROUND_TAG]: 'round-tag',
  [SHAPE_BOTTOM_ROUND_RECTANGLE]: 'bottom-round-rectangle',
  [SHAPE_BARREL]: 'barrel',
};

/** Readable props per group ('width' and 'opacity' exist for both). */
export const NODE_READ: ReadonlySet<string> = new Set([
  PROP.BACKGROUND_COLOR,
  PROP.BORDER_COLOR,
  PROP.BORDER_WIDTH,
  PROP.WIDTH,
  PROP.HEIGHT,
  PROP.SHAPE,
  PROP.SHAPE_POLYGON_POINTS,
  PROP.OPACITY,
  PROP.BACKGROUND_OPACITY,
  PROP.BORDER_OPACITY,
  PROP.TEXT_OPACITY,
  PROP.EVENTS,
  PROP.TEXT_EVENTS,
  PROP.VISIBILITY,
  PROP.CHART,
  PROP.CHART_VALUES,
  PROP.CHART_COLORS,
  PROP.CHART_SIZE,
  PROP.CHART_HOLE,
  PROP.CHART_START_ANGLE,
  PROP.CHART_DIRECTION,
  PROP.CHART_OPACITY,
  PROP.CORNER_RADIUS,
  PROP.BORDER_POSITION,
  PROP.BORDER_STYLE,
  PROP.BORDER_DASH_PATTERN,
  PROP.BORDER_DASH_OFFSET,
  PROP.OUTLINE_STYLE,
  PROP.BACKGROUND_FILL,
  PROP.BACKGROUND_GRADIENT_STOP_COLORS,
  PROP.BACKGROUND_GRADIENT_STOP_POSITIONS,
  PROP.BACKGROUND_GRADIENT_DIRECTION,
  PROP.OUTLINE_COLOR,
  PROP.OUTLINE_OPACITY,
  PROP.OUTLINE_WIDTH,
  PROP.OUTLINE_OFFSET,
  PROP.LABEL,
  PROP.FONT_SIZE,
  PROP.FONT_FAMILY,
  PROP.FONT_STYLE,
  PROP.FONT_WEIGHT,
  PROP.COLOR,
  PROP.GHOST,
  PROP.GHOST_OFFSET_X,
  PROP.GHOST_OFFSET_Y,
  PROP.GHOST_OPACITY,
  PROP.BACKGROUND_IMAGE,
  PROP.BACKGROUND_FIT,
  PROP.BACKGROUND_IMAGE_OPACITY,
  PROP.BACKGROUND_POSITION_X,
  PROP.BACKGROUND_POSITION_Y,
  PROP.BACKGROUND_OFFSET_X,
  PROP.BACKGROUND_OFFSET_Y,
  PROP.BACKGROUND_WIDTH,
  PROP.BACKGROUND_HEIGHT,
  PROP.BACKGROUND_REPEAT,
  PROP.BACKGROUND_CLIP,
  PROP.BACKGROUND_IMAGE_CONTAINMENT,
  PROP.BACKGROUND_IMAGE_SMOOTHING,
  PROP.BACKGROUND_IMAGE_CROSSORIGIN,
  PROP.BACKGROUND_IMAGE_TYPE,
  PROP.BACKGROUND_IMAGE_COLOR,
  PROP.OVERLAY_COLOR,
  PROP.OVERLAY_OPACITY,
  PROP.OVERLAY_PADDING,
  PROP.OVERLAY_SHAPE,
  PROP.OVERLAY_CORNER_RADIUS,
  PROP.UNDERLAY_COLOR,
  PROP.UNDERLAY_OPACITY,
  PROP.UNDERLAY_PADDING,
  PROP.UNDERLAY_SHAPE,
  PROP.UNDERLAY_CORNER_RADIUS,
  PROP.TEXT_OUTLINE_WIDTH,
  PROP.TEXT_OUTLINE_COLOR,
  PROP.TEXT_OUTLINE_OPACITY,
  PROP.TEXT_BACKGROUND_COLOR,
  PROP.TEXT_BACKGROUND_OPACITY,
  PROP.TEXT_BACKGROUND_PADDING,
  PROP.TEXT_MARGIN_X,
  PROP.TEXT_MARGIN_Y,
  PROP.MIN_ZOOMED_FONT_SIZE,
  PROP.TEXT_ROTATION,
  PROP.TEXT_HALIGN,
  PROP.TEXT_VALIGN,
  PROP.TEXT_TRANSFORM,
  PROP.TEXT_BACKGROUND_SHAPE,
  PROP.TEXT_WRAP,
  PROP.TEXT_MAX_WIDTH,
  PROP.LINE_HEIGHT,
  PROP.TEXT_OVERFLOW_WRAP,
  PROP.TEXT_JUSTIFICATION,
  PROP.TEXT_BORDER_WIDTH,
  PROP.TEXT_BORDER_COLOR,
  PROP.TEXT_BORDER_OPACITY,
  PROP.PADDING,
  PROP.PADDING_LEFT,
  PROP.PADDING_RIGHT,
  PROP.PADDING_TOP,
  PROP.PADDING_BOTTOM,
  PROP.PADDING_RELATIVE_TO,
  PROP.MIN_WIDTH,
  PROP.MIN_HEIGHT,
  PROP.COMPOUND_SIZING_WRT_LABELS,
  PROP.TRANSITION_PROPERTY,
  PROP.TRANSITION_DURATION,
  PROP.TRANSITION_DELAY,
  PROP.TRANSITION_TIMING_FUNCTION,
]);

export const EDGE_READ: ReadonlySet<string> = new Set([
  PROP.LINE_COLOR,
  PROP.LINE_STYLE,
  PROP.WIDTH,
  PROP.OPACITY,
  PROP.LINE_OPACITY,
  PROP.TEXT_OPACITY,
  PROP.EVENTS,
  PROP.VISIBILITY,
  PROP.LINE_CAP,
  PROP.LINE_DASH_PATTERN,
  PROP.LINE_DASH_OFFSET,
  PROP.LINE_OUTLINE_WIDTH,
  PROP.LINE_OUTLINE_COLOR,
  PROP.LINE_FILL,
  PROP.LINE_GRADIENT_STOP_COLORS,
  PROP.LINE_GRADIENT_STOP_POSITIONS,
  PROP.ARROW_SCALE,
  PROP.SOURCE_ARROW_FILL,
  PROP.TARGET_ARROW_FILL,
  PROP.SOURCE_ARROW_WIDTH,
  PROP.TARGET_ARROW_WIDTH,
  PROP.MID_SOURCE_ARROW_SHAPE,
  PROP.MID_SOURCE_ARROW_COLOR,
  PROP.MID_TARGET_ARROW_SHAPE,
  PROP.MID_TARGET_ARROW_COLOR,
  PROP.SOURCE_ARROW_SHAPE,
  PROP.SOURCE_ARROW_COLOR,
  PROP.TARGET_ARROW_SHAPE,
  PROP.TARGET_ARROW_COLOR,
  PROP.LABEL,
  PROP.FONT_SIZE,
  PROP.COLOR,
  PROP.TEXT_OUTLINE_WIDTH,
  PROP.TEXT_OUTLINE_COLOR,
  PROP.TEXT_OUTLINE_OPACITY,
  PROP.TEXT_BACKGROUND_COLOR,
  PROP.TEXT_BACKGROUND_OPACITY,
  PROP.TEXT_BACKGROUND_PADDING,
  PROP.TEXT_MARGIN_X,
  PROP.TEXT_MARGIN_Y,
  PROP.MIN_ZOOMED_FONT_SIZE,
  PROP.TEXT_ROTATION,
  PROP.SOURCE_LABEL,
  PROP.SOURCE_TEXT_OFFSET,
  PROP.SOURCE_TEXT_MARGIN_X,
  PROP.SOURCE_TEXT_MARGIN_Y,
  PROP.SOURCE_TEXT_ROTATION,
  PROP.TARGET_LABEL,
  PROP.TARGET_TEXT_OFFSET,
  PROP.TARGET_TEXT_MARGIN_X,
  PROP.TARGET_TEXT_MARGIN_Y,
  PROP.TARGET_TEXT_ROTATION,
  PROP.TEXT_TRANSFORM,
  PROP.TEXT_BACKGROUND_SHAPE,
  PROP.TEXT_WRAP,
  PROP.TEXT_MAX_WIDTH,
  PROP.LINE_HEIGHT,
  PROP.TEXT_OVERFLOW_WRAP,
  PROP.TEXT_JUSTIFICATION,
  PROP.TEXT_BORDER_WIDTH,
  PROP.TEXT_BORDER_COLOR,
  PROP.TEXT_BORDER_OPACITY,
  PROP.CURVE_STYLE,
  PROP.CONTROL_POINT_STEP_SIZE,
  PROP.CONTROL_POINT_WEIGHT,
  PROP.LOOP_DIRECTION,
  PROP.LOOP_SWEEP,
  PROP.CONTROL_POINT_DISTANCES,
  PROP.CONTROL_POINT_WEIGHTS,
  PROP.SEGMENT_DISTANCES,
  PROP.SEGMENT_WEIGHTS,
  PROP.SEGMENT_RADII,
  PROP.RADIUS_TYPE,
  PROP.EDGE_DISTANCES,
  PROP.TAXI_DIRECTION,
  PROP.TAXI_TURN,
  PROP.TAXI_TURN_MIN_DISTANCE,
  PROP.TAXI_RADIUS,
  PROP.TAXI_TRACK,
  PROP.TAXI_TRACK_SPACING,
  PROP.HAYSTACK_RADIUS,
  PROP.SOURCE_ENDPOINT,
  PROP.TARGET_ENDPOINT,
  PROP.SOURCE_DISTANCE_FROM_NODE,
  PROP.TARGET_DISTANCE_FROM_NODE,
  PROP.OVERLAY_COLOR,
  PROP.OVERLAY_OPACITY,
  PROP.OVERLAY_PADDING,
  PROP.UNDERLAY_COLOR,
  PROP.UNDERLAY_OPACITY,
  PROP.UNDERLAY_PADDING,
  PROP.TRANSITION_PROPERTY,
  PROP.TRANSITION_DURATION,
  PROP.TRANSITION_DELAY,
  PROP.TRANSITION_TIMING_FUNCTION,
]);

/** curve props are edge-only (constants and mappers alike). */
export const CURVE_PROPS: ReadonlySet<string> = new Set([
  PROP.CURVE_STYLE,
  PROP.CONTROL_POINT_STEP_SIZE,
  PROP.CONTROL_POINT_WEIGHT,
  PROP.LOOP_DIRECTION,
  PROP.LOOP_SWEEP,
  PROP.CONTROL_POINT_DISTANCES,
  PROP.CONTROL_POINT_WEIGHTS,
  PROP.SEGMENT_DISTANCES,
  PROP.SEGMENT_WEIGHTS,
  PROP.SEGMENT_RADII,
  PROP.RADIUS_TYPE,
  PROP.EDGE_DISTANCES,
  PROP.TAXI_DIRECTION,
  PROP.TAXI_TURN,
  PROP.TAXI_TURN_MIN_DISTANCE,
  PROP.TAXI_RADIUS,
  PROP.TAXI_TRACK,
  PROP.TAXI_TRACK_SPACING,
  PROP.HAYSTACK_RADIUS,
  PROP.SOURCE_ENDPOINT,
  PROP.TARGET_ENDPOINT,
  PROP.SOURCE_DISTANCE_FROM_NODE,
  PROP.TARGET_DISTANCE_FROM_NODE,
]);

/** Core (viewport-level) theming (round 13 A2): v3's core-selector
 * props, resolved once per sheet — constants only (there is no element
 * to map over). */
export interface CoreStyle {
  selectionBoxColor: RGBA;
  selectionBoxOpacity: number;
  selectionBoxBorderColor: RGBA;
  selectionBoxBorderWidth: number;
  activeBgColor: RGBA;
  activeBgOpacity: number;
  activeBgSize: number;
}

export const CORE_DEFAULTS: CoreStyle = {
  selectionBoxColor: [221, 221, 221, 255], // #ddd
  selectionBoxOpacity: 0.65,
  selectionBoxBorderColor: [170, 170, 170, 255], // #aaa
  selectionBoxBorderWidth: 1,
  activeBgColor: [0, 0, 0, 255], // black
  activeBgOpacity: 0.15,
  activeBgSize: 30,
};

/** The `core` block of a sheet resolved over `CORE_DEFAULTS`; throws on an unknown key or an unparsable colour. */
export const resolveCoreProps = (props: StyleProps | undefined): CoreStyle => {
  const out: CoreStyle = { ...CORE_DEFAULTS };

  if (props == null) {
    return out;
  }

  for (const raw of Object.keys(props)) {
    const prop = normalizeProp(raw);
    const value = props[raw];

    if (isMapperSpec(value)) {
      throw new Error(
        `Core style props take constants only ('${prop}' got a mapper)`,
      );
    }

    switch (prop) {
      case PROP.SELECTION_BOX_COLOR:
        out.selectionBoxColor = parseColor(prop, value);
        break;
      case PROP.SELECTION_BOX_OPACITY:
        out.selectionBoxOpacity = parseZeroOne(prop, value);
        break;
      case PROP.SELECTION_BOX_BORDER_COLOR:
        out.selectionBoxBorderColor = parseColor(prop, value);
        break;
      case PROP.SELECTION_BOX_BORDER_WIDTH:
        out.selectionBoxBorderWidth = parseNonNegative(prop, value);
        break;
      case PROP.ACTIVE_BG_COLOR:
        out.activeBgColor = parseColor(prop, value);
        break;
      case PROP.ACTIVE_BG_OPACITY:
        out.activeBgOpacity = parseZeroOne(prop, value);
        break;
      case PROP.ACTIVE_BG_SIZE:
        out.activeBgSize = parseNonNegative(prop, value);
        break;
      default:
        throw new Error(
          `The core style property '${prop}' is unsupported in the GPU prototype`,
        );
    }
  }

  return out;
};

/** global-constant font props (round 13 D1): one face per glyph atlas */
export const GLOBAL_FONT_PROPS: ReadonlySet<string> = new Set([
  PROP.FONT_FAMILY,
  PROP.FONT_STYLE,
  PROP.FONT_WEIGHT,
]);

/** the end-label family (round 13 D4): edge-only */
export const END_LABEL_PROPS: ReadonlySet<string> = new Set([
  PROP.SOURCE_LABEL,
  PROP.SOURCE_TEXT_OFFSET,
  PROP.SOURCE_TEXT_MARGIN_X,
  PROP.SOURCE_TEXT_MARGIN_Y,
  PROP.SOURCE_TEXT_ROTATION,
  PROP.TARGET_LABEL,
  PROP.TARGET_TEXT_OFFSET,
  PROP.TARGET_TEXT_MARGIN_X,
  PROP.TARGET_TEXT_MARGIN_Y,
  PROP.TARGET_TEXT_ROTATION,
]);

/** further node-only props (C3/D3; text-events since 20.3 — edge
 * labels are never pickable in v4): rejected on the edges group */
export const NODE_ONLY_EXTRA: ReadonlySet<string> = new Set([
  PROP.SHAPE_POLYGON_POINTS,
  PROP.TEXT_HALIGN,
  PROP.TEXT_VALIGN,
  PROP.TEXT_EVENTS,
]);

/** ghost props are node-only (round 13 A1). */
export const GHOST_PROPS: ReadonlySet<string> = new Set([
  PROP.GHOST,
  PROP.GHOST_OFFSET_X,
  PROP.GHOST_OFFSET_Y,
  PROP.GHOST_OPACITY,
]);

/** the default chart palette: the mapper DSL's category10 scheme */
export const DEFAULT_CHART_COLORS: RGBA[] = resolveScheme(
  'category10',
).stops.map((hex) => [...hexToRgb(hex), 255] as RGBA);

/** chart props are node-only (round 23). */
export const CHART_PROPS: ReadonlySet<string> = new Set([
  PROP.CHART,
  PROP.CHART_VALUES,
  PROP.CHART_COLORS,
  PROP.CHART_SIZE,
  PROP.CHART_HOLE,
  PROP.CHART_START_ANGLE,
  PROP.CHART_DIRECTION,
  PROP.CHART_OPACITY,
]);

/** overlay/underlay *shape* props are node-only (edge layers stroke
 * the edge geometry, so shape/radius don't apply — v3 ignores them on
 * edges; v4 rejects them). */
export const LAYER_SHAPE_PROPS: ReadonlySet<string> = new Set([
  PROP.OVERLAY_SHAPE,
  PROP.OVERLAY_CORNER_RADIUS,
  PROP.UNDERLAY_SHAPE,
  PROP.UNDERLAY_CORNER_RADIUS,
]);

/** background-image props are node-only (round 15.2). */
export const IMAGE_PROPS: ReadonlySet<string> = new Set([
  PROP.BACKGROUND_IMAGE,
  PROP.BACKGROUND_FIT,
  PROP.BACKGROUND_IMAGE_OPACITY,
  PROP.BACKGROUND_POSITION_X,
  PROP.BACKGROUND_POSITION_Y,
  PROP.BACKGROUND_OFFSET_X,
  PROP.BACKGROUND_OFFSET_Y,
  PROP.BACKGROUND_WIDTH,
  PROP.BACKGROUND_HEIGHT,
  PROP.BACKGROUND_REPEAT,
  PROP.BACKGROUND_CLIP,
  PROP.BACKGROUND_IMAGE_CONTAINMENT,
  PROP.BACKGROUND_IMAGE_SMOOTHING,
  PROP.BACKGROUND_IMAGE_CROSSORIGIN,
  PROP.BACKGROUND_IMAGE_TYPE,
  PROP.BACKGROUND_IMAGE_COLOR,
]);

/** the recorded multi-image cap (a fixed FS compositing loop) */
export const IMAGE_CAP = 4;

export const ARROW_ENUM: Record<string, number> = {
  none: ARROW_NONE,
  triangle: ARROW_TRIANGLE,
  arrow: ARROW_TRIANGLE, // v3 alias
  vee: ARROW_VEE,
  chevron: ARROW_CHEVRON,
  circle: ARROW_CIRCLE,
  square: ARROW_SQUARE,
  diamond: ARROW_DIAMOND,
  tee: ARROW_TEE,
  // round 27.6: v3's compound heads
  'triangle-tee': ARROW_TRIANGLE_TEE,
  'circle-triangle': ARROW_CIRCLE_TRIANGLE,
  'triangle-cross': ARROW_TRIANGLE_CROSS,
  'triangle-backcurve': ARROW_TRIANGLE_BACKCURVE,
};

/** enum id → shape keyword (for enum-mapper writes and readback) */
export const ARROW_NAMES: Record<number, ArrowShape> = {
  [ARROW_NONE]: 'none',
  [ARROW_TRIANGLE]: 'triangle',
  [ARROW_VEE]: 'vee',
  [ARROW_CHEVRON]: 'chevron',
  [ARROW_CIRCLE]: 'circle',
  [ARROW_SQUARE]: 'square',
  [ARROW_DIAMOND]: 'diamond',
  [ARROW_TEE]: 'tee',
  [ARROW_TRIANGLE_TEE]: 'triangle-tee',
  [ARROW_CIRCLE_TRIANGLE]: 'circle-triangle',
  [ARROW_TRIANGLE_CROSS]: 'triangle-cross',
  [ARROW_TRIANGLE_BACKCURVE]: 'triangle-backcurve',
};

/**
 * The compound heads (27.6).  `arrow-fill: hollow` strokes `abs( sd )`,
 * which is wrong at the seam where a union's two parts meet — and v3
 * does not stroke compounds either — so a hollow compound falls back to
 * filled.  Recorded deviation.
 */
export const COMPOUND_ARROWS: ReadonlySet<number> = new Set([
  ARROW_TRIANGLE_TEE,
  ARROW_CIRCLE_TRIANGLE,
  ARROW_TRIANGLE_CROSS,
]);
