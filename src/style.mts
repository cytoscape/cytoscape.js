import { color2tuple } from './util/colors.mjs';
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
  ARROW_SHIFT_HOLLOW_SOURCE,
  ARROW_SHIFT_HOLLOW_TARGET,
  ARROW_SHIFT_MID_SOURCE,
  ARROW_SHIFT_MID_TARGET,
  ARROW_SHIFT_SCALE,
  ARROW_SHIFT_SOURCE,
  ARROW_SHIFT_TARGET,
  packArrowShapes,
  unpackArrowShape,
  CHART_MAX_SLICES,
  CHART_NONE,
  CHART_PIE,
  CHART_STRIPES,
  columnSpec,
  CONDITION_FLAGS,
  FLAG_NO_EVENTS,
  FLAG_PARENT,
  FLAG_SELF_INVISIBLE,
  FLAG_TEXT_EVENTS,
  LABEL_MARGIN,
  LINE_DASHED,
  LINE_DOTTED,
  LINE_SOLID,
  SHAPE_BARREL,
  SHAPE_BOTTOM_ROUND_RECTANGLE,
  BORDER_STYLE_SHIFT,
  OUTLINE_STYLE_SHIFT,
  STROKE_STYLE_MASK,
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
} from './contract.mjs';
import { SCHEMES, resolveScheme, hexToRgb } from './style-schemes.mjs';
import {
  compileMapper,
  bindEvaluator,
  isMapperSpec,
  autoExtentFor,
  applyAutoExtent,
} from './style-scales.mjs';
import {
  CURVE_DEFAULTS,
  CURVE_EXTRA_DEFAULTS,
  CURVE_STYLE_BEZIER,
  CURVE_STYLE_HAYSTACK,
  CURVE_STYLE_ROUND_SEGMENTS,
  CURVE_STYLE_ROUND_TAXI,
  CURVE_STYLE_SEGMENTS,
  CURVE_STYLE_STRAIGHT,
  CURVE_STYLE_TAXI,
  CURVE_STYLE_TRIANGLE,
  CURVE_STYLE_UNBUNDLED,
  isBlobStyle,
} from './store/curve-index.mjs';
import type { CurveStyleExtras, EndpointSpec } from './store/curve-index.mjs';
import type { CompoundStyle } from './store/hierarchy.mjs';
import type {
  BgLen,
  BgSize,
  NodeImageRecord,
  NodeImageSpec,
} from './store/graph-store.mjs';
import {
  EDGE_DIST_INTERSECTION,
  EDGE_DIST_NODE_POSITION,
  TAXI_AUTO,
  TAXI_DOWNWARD,
  TAXI_HORIZONTAL,
  TAXI_LEFTWARD,
  TAXI_RIGHTWARD,
  TAXI_UPWARD,
  TAXI_VERTICAL,
} from './curve-geometry.mjs';
import {
  EDGE_DIST_ENDPOINTS,
  ENDPT_ANGLE,
  ENDPT_DEFAULT,
  ENDPT_INSIDE,
  ENDPT_LINE,
  ENDPT_PCT_X,
  ENDPT_PCT_Y,
  ENDPT_POINT,
} from './curve-geometry.mjs';

/** One styled end of source/target-endpoint (12c): the parsed form of
 * v3's edgeEndpoint type.  Angles store the *effective* radians (the
 * 12-o'clock start already applied); point pct components store the
 * fraction (v3's pfValue). */
interface EndpointEnd {
  mode: number;
  a: number;
  b: number;
  pct: number;
}

const ENDPT_END_DEFAULT: EndpointEnd = {
  mode: ENDPT_DEFAULT,
  a: 0,
  b: 0,
  pct: 0,
};

import { compileEasing } from './easing.mjs';
import { buildChannelWrite } from './animation.mjs';
import type { ChannelWrite, TweenColumn } from './animation.mjs';
import type {
  CompiledMapper,
  ChannelKind,
  Evaluated,
  ValueReader,
} from './style-scales.mjs';
import type { ColumnId, GroupName, Ref } from './contract.mjs';
import type { GraphStore } from './store/graph-store.mjs';
import type {
  StyleProps,
  Stylesheet,
  Mapper,
  MapperSpec,
} from './public-types.mjs';

/*
StyleEngine: the v4 stylesheet is `{ nodes, edges }` — no selectors, no
style functions.  Each key is a props object whose values are constants
or mapper objects; all per-element variation is declarative (style-
scales.mts: `data(key)` scales and `case` conditionals), so every value
is analyzable, serializable, and GPU-evaluable.  Prop names are kebab-
case or camelCase; `label` (and the D4 `source-label`/`target-label`)
additionally take the legacy `data(key)` string, which normalizes to
the `{ data: key }` passthrough.

Every mapper is cheaply CPU-evaluable — that invariant keeps `ele.style()`
synchronous, keeps headless mode and Node tests working (the same IR runs
on CPU, GPU, and in tests), and keeps determinism.  GPU evaluation is an
optimization layered over the CPU-evaluable IR, never a source of values
the CPU can't reproduce.

Refresh: constant props and declarative mappers stay fresh automatically —
a data() write re-derives the mapped channels of exactly the written
slots, gated per group on the mapped keys, and a change in a live
auto-domain extent re-derives the whole channel.  A select never restyles
(the `:selected` accent ring is drawn by the shader).

Defaults ≈ v3: gray 30×30 ellipse nodes, 2px gray lines.
*/

type RGBA = [number, number, number, number];

/** Resolved channel values for one element, before writing to columns. */
interface NodeComputed {
  /** text-rotation in radians (27.7); NaN is not valid on nodes. */
  textRotation: number;

  fillColor: RGBA;
  borderColor: RGBA;
  width: number;
  height: number;
  shape: number;
  opacity: number;
  borderWidth: number;
  /** events (round 20.2): false = pointer-transparent (FLAG_NO_EVENTS) */
  eventsEnabled: boolean;
  /** text-events (round 20.3): true = the label box picks the node (FLAG_TEXT_EVENTS) */
  textEvents: boolean;
  /** visibility (round 22): true = paint-only invisible (FLAG_SELF_INVISIBLE) */
  invisible: boolean;
  /** chart (round 23): CHART_NONE | CHART_PIE | CHART_STRIPES */
  chartKind: number;
  /** constant value list (null when unset or the data passthrough is used) */
  chartValues: number[] | null;
  /** the `{ data: key }` passthrough key (per-element arrays) */
  chartValuesKey: string | null;
  /** resolved palette (null = the default category10 scheme) */
  chartColors: RGBA[] | null;
  chartSize: number;
  chartHole: number;
  chartStartAngle: number;
  /** stripes: 0 = vertical (bands advance top->bottom), 1 = horizontal */
  chartDirection: number;
  chartOpacity: number;
  /** literal label text ('' for none) when labelKey is null */
  label: string;
  /** `data(key)` mapper key ('id' reads the first-class id) */
  labelKey: string | null;
  fontSize: number;
  textColor: RGBA;
  /** effectively global: one font per glyph atlas (keyed by character) */
  fontFamily: string;
  /** font-style + font-weight (round 13 D1): global constants like
   * font-family — the atlas rasters one face */
  fontStyle: string;
  fontWeight: string;
  textOutlineWidth: number;
  textOutlineColor: RGBA;
  textOutlineOpacity: number;
  textBgColor: RGBA;
  textBgOpacity: number;
  textBgPadding: number;
  textMarginX: number;
  textMarginY: number;
  /** min-zoomed-font-size (round 13 D2): hide the label when
   * font-size x zoom x dpr drops below this (device px; 0 = off) */
  minZoomedFontSize: number;
  /** text-halign (round 13 D3): 0 left, 1 center, 2 right */
  textHalign: number;
  /** text-valign (D3): 0 top, 1 center, 2 bottom.  v4's default is
   * 'bottom' (the round-10 below-node placement) — v3 defaults to
   * 'top'; a recorded deviation */
  textValign: number;
  /** corner-radius (round 13 B2): model px, -1 = 'auto' (v3's
   * min(w/4, h/4, 8)) — round-rectangle only */
  cornerRadius: number;
  /** border-position (B2): 0 center (v3's default), 1 inside, 2 outside */
  borderPosition: number;
  /** border-style (round 38): 0 solid, 1 dashed, 2 dotted, 3 double */
  borderStyle: number;
  /** border-dash-pattern (round 38), normalized to two on/off pairs
   * like the edge twin (v3's default [4, 2] stores as [4, 2, 4, 2]) */
  borderDashPattern: number[];
  /** border-dash-offset (round 38), model px */
  borderDashOffset: number;
  /** outline-style (round 38): same ids; `double` draws solid (v3's
   * drawOutline has no double branch — a quirk kept for parity) */
  outlineStyle: number;
  /** node outline (round 13 B5): a solid ring outside the border */
  outlineColor: RGBA;
  outlineOpacity: number;
  outlineWidth: number;
  outlineOffset: number;
  /** shape-polygon-points (C3): flat unit [x, y, ...] pairs for the
   * 'polygon' shape (v3's normalized [-1, 1] space) */
  shapePolygonPoints: number[];
  /** background-fill (C2): 0 solid, 1 linear-gradient, 2 radial-gradient */
  backgroundFill: number;
  /** background gradient stops (C2; constants-only, capped at 5) */
  backgroundGradientStopColors: RGBA[];
  backgroundGradientStopPositions: number[] | null;
  backgroundGradientDirection: number;
  /** background-opacity (round 13 B1): folds into the stored fill alpha */
  backgroundOpacity: number;
  /** border-opacity (B1): folds into the stored border alpha */
  borderOpacity: number;
  /** text-opacity (B1): v3's parentOpacity for the label block — folds
   * into the stored text/outline/background alphas */
  textOpacity: number;
  /** text-transform (B6): 0 none, 1 uppercase, 2 lowercase */
  textTransform: number;
  /** text-wrap (16.2): 0 none, 1 wrap, 2 ellipsis */
  textWrap: number;
  /** text-max-width, model px */
  textMaxWidth: number;
  /** line-height multiplier */
  lineHeight: number;
  /** text-overflow-wrap: 0 whitespace, 1 anywhere */
  textOverflowWrap: number;
  /** text-justification: -1 auto (resolves against halign at write) */
  textJustification: number;
  /** text-background-shape (B6): 0 rectangle, 1 round-rectangle */
  textBgShape: number;
  /** text-border (B6): a band inward from the padded background box */
  textBorderWidth: number;
  textBorderColor: RGBA;
  textBorderOpacity: number;
  // ghost props (round 13 A1): the body duplicated at the offset
  ghost: boolean;
  ghostOffsetX: number;
  ghostOffsetY: number;
  ghostOpacity: number;
  // overlay/underlay (round 13 A2): [color, opacity, padding, shape, radius]
  overlayColor: RGBA;
  overlayOpacity: number;
  overlayPadding: number;
  /** 0 round-rectangle, 1 ellipse */
  overlayShape: number;
  /** model px; -1 = 'auto' (v3's min(w/4, h/4, 8)) */
  overlayRadius: number;
  underlayColor: RGBA;
  underlayOpacity: number;
  underlayPadding: number;
  underlayShape: number;
  underlayRadius: number;
  // background images (round 15.2): per-image lists distribute v3-style
  // (index i reads list[min(i, len-1)]); [] = no images
  backgroundImage: string[];
  backgroundFit: number[];
  backgroundImageOpacity: number[];
  backgroundPositionX: BgLen[];
  backgroundPositionY: BgLen[];
  backgroundOffsetX: BgLen[];
  backgroundOffsetY: BgLen[];
  backgroundWidth: BgSize[];
  backgroundHeight: BgSize[];
  backgroundRepeat: number[];
  backgroundClip: number[];
  backgroundImageContainment: number[];
  backgroundImageSmoothing: boolean[];
  /** one per node (the registry dedup key includes it) */
  backgroundImageCrossorigin: string;
  /** background-image-type per image: 0 auto (rgba), 1 sdf-icon */
  backgroundImageType: number[];
  /** the sdf-icon tint (render-time color, mapper-capable) */
  backgroundImageColor: RGBA;
}

interface EdgeComputed {
  lineColor: RGBA;
  /** events (round 20.2): false = pointer-transparent (FLAG_NO_EVENTS) */
  eventsEnabled: boolean;
  /** visibility (round 22): true = paint-only invisible (FLAG_SELF_INVISIBLE) */
  invisible: boolean;
  /** line-fill (C2): 0 solid, 1 linear-gradient, 2 radial-gradient */
  lineFill: number;
  lineGradientStopColors: RGBA[];
  lineGradientStopPositions: number[] | null;
  /** line-opacity (round 13 B1): folds into the stored line alpha and
   * the arrow fold (v3's effective opacities) */
  lineOpacity: number;
  /** line-outline casing (round 13 B4): width sticks out width/2 per
   * side (v3's lineWidth = edgeWidth + line-outline-width) */
  lineOutlineWidth: number;
  lineOutlineColor: RGBA;
  /** line-cap (round 13 B3): 0 butt, 1 round, 2 square */
  lineCap: number;
  /** line-dash-pattern (B3), normalized to two on/off pairs */
  lineDashPattern: number[];
  /** line-dash-offset (B3), model px */
  lineDashOffset: number;
  width: number;
  opacity: number;
  /** 0 solid, 1 dashed, 2 dotted (contract LINE_* ids) */
  lineStyle: number;
  sourceArrowShape: ArrowShape;
  sourceArrowColor: RGBA;
  targetArrowShape: ArrowShape;
  targetArrowColor: RGBA;
  /** arrow-scale (B7): scales every arrowhead on the edge */
  arrowScale: number;
  /** mid arrows (C1): anchored at the curve/route midpoint */
  midSourceArrowShape: ArrowShape;
  midSourceArrowColor: RGBA;
  midTargetArrowShape: ArrowShape;
  midTargetArrowColor: RGBA;
  /** arrow-fill per end (B7): 0 filled, 1 hollow */
  sourceArrowFill: number;
  targetArrowFill: number;
  /** hollow stroke widths per end, model px ('match-line' and % resolve
   * at write against the edge width) */
  sourceArrowWidth: number | 'match-line' | { percent: number };
  targetArrowWidth: number | 'match-line' | { percent: number };
  // edge labels (round 10): anchored at the edge midpoint on-GPU
  label: string;
  labelKey: string | null;
  fontSize: number;
  textColor: RGBA;
  textOutlineWidth: number;
  textOutlineColor: RGBA;
  textOutlineOpacity: number;
  textBgColor: RGBA;
  textBgOpacity: number;
  textBgPadding: number;
  textMarginX: number;
  textMarginY: number;
  /**
   * text-rotation in radians, with NaN meaning `autorotate` (27.7).
   * Numeric rotations apply to any label; autorotate is edge-only,
   * since it resolves from the edge's own slope.
   */
  textRotation: number;
  // end labels (round 13 D4): two more glyph streams anchored at arc
  // distance source/target-text-offset from each end; the remaining
  // text channels (font, color, backgrounds, opacity, transform) are
  // shared with the main label, exactly v3's unprefixed reads
  sourceLabel: string;
  sourceLabelKey: string | null;
  sourceTextOffset: number;
  sourceTextMarginX: number;
  sourceTextMarginY: number;
  sourceTextRotation: number;
  targetLabel: string;
  targetLabelKey: string | null;
  targetTextOffset: number;
  targetTextMarginX: number;
  targetTextMarginY: number;
  targetTextRotation: number;
  // curved edges (round 12a): the styled record the CurveIndex derives
  // edge.curveParams from (CURVE_STYLE_* ids; angles in radians)
  curveStyle: number;
  controlPointStepSize: number;
  controlPointWeight: number;
  loopDirection: number;
  loopSweep: number;
  // the 12b families (lists are parse-owned copies, treated read-only)
  controlPointDistances: number[] | null;
  controlPointWeights: number[];
  segmentDistances: number[];
  segmentWeights: number[];
  segmentRadii: number[];
  /** radius-type per point: 1 = arc-radius, 0 = influence-radius */
  radiusTypes: number[];
  /** EDGE_DIST_* id */
  edgeDistances: number;
  taxiDirection: number;
  // 12c curve props
  haystackRadius: number;
  sourceEndpoint: EndpointEnd;
  targetEndpoint: EndpointEnd;
  sourceDistanceFromNode: number;
  targetDistanceFromNode: number;
  /** percent turns store the fraction (v3 pfValue); px turns the px */
  taxiTurn: number;
  taxiTurnPercent: boolean;
  taxiTurnMinDistance: number;
  taxiRadius: number;
}

type Computed = NodeComputed & EdgeComputed;

type ArrowShape =
  | 'none'
  | 'triangle'
  | 'vee'
  | 'chevron'
  | 'circle'
  | 'square'
  | 'diamond'
  | 'tee'
  // round 27.6: v3's compound heads
  | 'triangle-tee'
  | 'circle-triangle'
  | 'triangle-cross'
  | 'triangle-backcurve';

const NODE_DEFAULTS: NodeComputed = {
  textRotation: 0,
  fillColor: [153, 153, 153, 255], // #999
  borderColor: [0, 0, 0, 255],
  width: 30,
  height: 30,
  shape: SHAPE_ELLIPSE,
  opacity: 1,
  eventsEnabled: true, // v3's default: elements receive events
  textEvents: false, // v3's default: labels are pointer-transparent
  invisible: false, // visibility: visible (round 22)
  chartKind: CHART_NONE,
  chartValues: null,
  chartValuesKey: null,
  chartColors: null, // the category10 default resolves at write
  chartSize: 1, // v3's pie-size 100%
  chartHole: 0,
  chartStartAngle: 0,
  chartDirection: 0, // vertical (v3's stripe default)
  chartOpacity: 1,
  borderWidth: 0,
  label: '', // no label
  labelKey: null,
  fontSize: 16,
  textColor: [0, 0, 0, 255],
  fontFamily: 'sans-serif',
  fontStyle: 'normal', // as v3
  fontWeight: 'normal', // as v3
  textOutlineWidth: 0,
  textOutlineColor: [0, 0, 0, 255],
  textOutlineOpacity: 1,
  textBgColor: [0, 0, 0, 255],
  textBgOpacity: 0, // background off by default, as v3
  textBgPadding: 0,
  textMarginX: 0,
  textMarginY: 0,
  minZoomedFontSize: 0, // as v3: no floor
  textHalign: 1, // center, as v3
  textValign: 2, // bottom — v4's round-10 default (v3: top; recorded)
  cornerRadius: -1, // 'auto'
  borderPosition: 0, // center, as v3
  borderStyle: 0, // solid, as v3
  borderDashPattern: [4, 2, 4, 2], // v3's [4, 2], pair-normalized
  borderDashOffset: 0,
  outlineStyle: 0, // solid, as v3
  outlineColor: [153, 153, 153, 255], // '#999', as v3
  outlineOpacity: 1,
  outlineWidth: 0,
  outlineOffset: 0,
  shapePolygonPoints: [-1, -1, 1, -1, 1, 1, -1, 1], // unit square, as v3
  backgroundFill: 0, // solid, as v3
  backgroundGradientStopColors: [],
  backgroundGradientStopPositions: null,
  backgroundGradientDirection: 0, // to-bottom, as v3
  backgroundOpacity: 1,
  borderOpacity: 1,
  textOpacity: 1,
  textTransform: 0, // none, as v3
  textWrap: 0, // none, as v3
  textMaxWidth: 9999, // as v3
  lineHeight: 1, // as v3
  textOverflowWrap: 0, // whitespace, as v3
  textJustification: -1, // auto, as v3
  textBgShape: 0, // rectangle, as v3
  textBorderWidth: 0,
  textBorderColor: [0, 0, 0, 255], // '#000', as v3
  textBorderOpacity: 0, // as v3: borders need opacity styled on
  ghost: false,
  ghostOffsetX: 0,
  ghostOffsetY: 0,
  ghostOpacity: 0, // v3's default: a ghost is invisible until given opacity
  overlayColor: [0, 0, 0, 255], // '#000', as v3
  overlayOpacity: 0,
  overlayPadding: 10,
  overlayShape: 0, // round-rectangle
  overlayRadius: -1, // 'auto'
  underlayColor: [0, 0, 0, 255],
  underlayOpacity: 0,
  underlayPadding: 10,
  underlayShape: 0,
  underlayRadius: -1,
  backgroundImage: [], // none, as v3
  backgroundFit: [0], // none, as v3
  backgroundImageOpacity: [1],
  backgroundPositionX: [{ v: 50, pct: true }], // '50%', as v3
  backgroundPositionY: [{ v: 50, pct: true }],
  backgroundOffsetX: [{ v: 0, pct: false }],
  backgroundOffsetY: [{ v: 0, pct: false }],
  backgroundWidth: [{ mode: 0, v: 0 }], // auto, as v3
  backgroundHeight: [{ mode: 0, v: 0 }],
  backgroundRepeat: [0], // no-repeat, as v3
  backgroundClip: [1], // node, as v3
  backgroundImageContainment: [0], // inside, as v3
  backgroundImageSmoothing: [true], // yes, as v3
  backgroundImageCrossorigin: 'anonymous', // as v3
  backgroundImageType: [0], // auto (rgba)
  backgroundImageColor: [153, 153, 153, 255], // #999 (icon tint; v4-only prop)
};

/** gap between the node edge and the label block on the top/bottom
 * valign rows (D3 — v4's stand-in for v3's `padding`-based gap), model px */

const DATA_MAPPER = /^\s*data\s*\(\s*([\w-]+)\s*\)\s*$/;

const EDGE_DEFAULTS: EdgeComputed = {
  lineColor: [153, 153, 153, 255], // #999
  eventsEnabled: true, // v3's default: elements receive events
  invisible: false, // visibility: visible (round 22)
  lineFill: 0,
  lineGradientStopColors: [],
  lineGradientStopPositions: null,
  lineOpacity: 1,
  lineOutlineWidth: 0,
  lineOutlineColor: [0, 0, 0, 255], // '#000', as v3
  lineCap: 0, // butt, as v3
  lineDashPattern: [6, 3, 6, 3], // v3's [6, 3], pair-normalized
  lineDashOffset: 0,
  // v3's default *stylesheet* carries `edge { width: 3 }` — the only
  // element rule in it besides :parent/:selected/:active — and v4 had 2
  // (round 57.1).  Changed to match, since "the default stylesheet should
  // look like v3's" names exactly that file.
  width: 3,
  opacity: 1,
  lineStyle: LINE_SOLID,
  sourceArrowShape: 'none',
  sourceArrowColor: [153, 153, 153, 255], // #999, as v3
  arrowScale: 1,
  midSourceArrowShape: 'none',
  midSourceArrowColor: [153, 153, 153, 255],
  midTargetArrowShape: 'none',
  midTargetArrowColor: [153, 153, 153, 255],
  sourceArrowFill: 0, // filled, as v3
  targetArrowFill: 0,
  sourceArrowWidth: 1, // v3's default arrow-width
  targetArrowWidth: 1,
  targetArrowShape: 'none',
  targetArrowColor: [153, 153, 153, 255],
  label: '',
  labelKey: null,
  sourceLabel: '', // as v3
  sourceLabelKey: null,
  sourceTextOffset: 0, // as v3
  sourceTextMarginX: 0,
  sourceTextMarginY: 0,
  sourceTextRotation: 0, // none, as v3
  targetLabel: '',
  targetLabelKey: null,
  targetTextOffset: 0,
  targetTextMarginX: 0,
  targetTextMarginY: 0,
  targetTextRotation: 0,
  fontSize: 16,
  textColor: [0, 0, 0, 255],
  textOutlineWidth: 0,
  textOutlineColor: [0, 0, 0, 255],
  textOutlineOpacity: 1,
  textBgColor: [0, 0, 0, 255],
  textBgOpacity: 0,
  textBgPadding: 0,
  textMarginX: 0,
  textMarginY: 0,
  textRotation: 0, // none: horizontal, as v3's default
  curveStyle: CURVE_DEFAULTS.style, // straight — the signed-off v4 default (v3 defaults to bezier)
  controlPointStepSize: CURVE_DEFAULTS.stepSize,
  controlPointWeight: CURVE_DEFAULTS.weight,
  loopDirection: CURVE_DEFAULTS.loopDirection, // -45deg, as v3
  loopSweep: CURVE_DEFAULTS.loopSweep, // -90deg, as v3
  // 12b family defaults (v3's); parse always replaces the arrays, so
  // sharing the default references across computed records is safe
  controlPointDistances: CURVE_EXTRA_DEFAULTS.ctrlDists,
  controlPointWeights: CURVE_EXTRA_DEFAULTS.ctrlWeights,
  segmentDistances: CURVE_EXTRA_DEFAULTS.segDists,
  segmentWeights: CURVE_EXTRA_DEFAULTS.segWeights,
  segmentRadii: CURVE_EXTRA_DEFAULTS.segRadii,
  radiusTypes: CURVE_EXTRA_DEFAULTS.radiusTypes,
  edgeDistances: CURVE_EXTRA_DEFAULTS.edgeDistances,
  taxiDirection: CURVE_EXTRA_DEFAULTS.taxiDir,
  haystackRadius: 0, // v3's default: haystack endpoints at the centers
  sourceEndpoint: ENDPT_END_DEFAULT,
  targetEndpoint: ENDPT_END_DEFAULT,
  sourceDistanceFromNode: 0,
  targetDistanceFromNode: 0,
  taxiTurn: CURVE_EXTRA_DEFAULTS.taxiTurn,
  taxiTurnPercent: CURVE_EXTRA_DEFAULTS.taxiTurnPercent,
  taxiTurnMinDistance: CURVE_EXTRA_DEFAULTS.taxiTurnMinDist,
  taxiRadius: CURVE_EXTRA_DEFAULTS.taxiRadius,
};

const NO_ARROW: RGBA = [0, 0, 0, 0]; // a=0 collapses the arrow in the shader

/** data() value → label text ('' for absent) */
const stringify = (value: unknown): string => {
  return value == null ? '' : String(value);
};

const SHAPES: Record<string, number> = {
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
const packRgba = ([r, g, b, a]: RGBA): number => {
  return (r | (g << 8) | (b << 16) | (a << 24)) >>> 0;
};

/** The slot's 12b curve extras, defaulted for non-blob styles. */
const curveExtrasFor = (store: GraphStore, slot: number): CurveStyleExtras => {
  return store.curveStyleAt(slot).extras ?? CURVE_EXTRA_DEFAULTS;
};

/** Formatted colour strings by packed rgba word (round 62.4): building
 * the string was about half of a colour read's cost, and a graph uses a
 * bounded palette.  Cleared wholesale at the bound rather than LRU'd —
 * the map re-warms in one read per colour. */
const RGBA_STRINGS = new Map<number, string>();
const RGBA_STRINGS_MAX = 4096;

/** RGBA bytes → the v3-style resolved color string. */
const formatRgba = (r: number, g: number, b: number, a: number): string => {
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
const foldRgba = ([r, g, b, a]: RGBA, opacity: number): RGBA => [
  r,
  g,
  b,
  Math.round(a * opacity),
];

/** The A2 layer fold: layer opacity into the packed record alpha (v3's
 * overlay never multiplies element opacity). */
const foldLayerRgba = (color: RGBA, opacity: number): number =>
  packRgba(foldRgba(color, opacity));

/** Stored shape id → resolved keyword (the exact-circle compile collapses back to 'ellipse'). */
const SHAPE_NAMES: Record<number, string> = {
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
const NODE_READ: ReadonlySet<string> = new Set([
  'background-color',
  'border-color',
  'border-width',
  'width',
  'height',
  'shape',
  'shape-polygon-points',
  'opacity',
  'background-opacity',
  'border-opacity',
  'text-opacity',
  'events',
  'text-events',
  'visibility',
  'chart',
  'chart-values',
  'chart-colors',
  'chart-size',
  'chart-hole',
  'chart-start-angle',
  'chart-direction',
  'chart-opacity',
  'corner-radius',
  'border-position',
  'border-style',
  'border-dash-pattern',
  'border-dash-offset',
  'outline-style',
  'background-fill',
  'background-gradient-stop-colors',
  'background-gradient-stop-positions',
  'background-gradient-direction',
  'outline-color',
  'outline-opacity',
  'outline-width',
  'outline-offset',
  'label',
  'font-size',
  'font-family',
  'font-style',
  'font-weight',
  'color',
  'ghost',
  'ghost-offset-x',
  'ghost-offset-y',
  'ghost-opacity',
  'background-image',
  'background-fit',
  'background-image-opacity',
  'background-position-x',
  'background-position-y',
  'background-offset-x',
  'background-offset-y',
  'background-width',
  'background-height',
  'background-repeat',
  'background-clip',
  'background-image-containment',
  'background-image-smoothing',
  'background-image-crossorigin',
  'background-image-type',
  'background-image-color',
  'overlay-color',
  'overlay-opacity',
  'overlay-padding',
  'overlay-shape',
  'overlay-corner-radius',
  'underlay-color',
  'underlay-opacity',
  'underlay-padding',
  'underlay-shape',
  'underlay-corner-radius',
  'text-outline-width',
  'text-outline-color',
  'text-outline-opacity',
  'text-background-color',
  'text-background-opacity',
  'text-background-padding',
  'text-margin-x',
  'text-margin-y',
  'min-zoomed-font-size',
  'text-rotation',
  'text-halign',
  'text-valign',
  'text-transform',
  'text-background-shape',
  'text-wrap',
  'text-max-width',
  'line-height',
  'text-overflow-wrap',
  'text-justification',
  'text-border-width',
  'text-border-color',
  'text-border-opacity',
  'padding',
  'padding-relative-to',
  'min-width',
  'min-height',
  'compound-sizing-wrt-labels',
  'transition-property',
  'transition-duration',
  'transition-delay',
  'transition-timing-function',
]);

const EDGE_READ: ReadonlySet<string> = new Set([
  'line-color',
  'line-style',
  'width',
  'opacity',
  'line-opacity',
  'text-opacity',
  'events',
  'visibility',
  'line-cap',
  'line-dash-pattern',
  'line-dash-offset',
  'line-outline-width',
  'line-outline-color',
  'line-fill',
  'line-gradient-stop-colors',
  'line-gradient-stop-positions',
  'arrow-scale',
  'source-arrow-fill',
  'target-arrow-fill',
  'source-arrow-width',
  'target-arrow-width',
  'mid-source-arrow-shape',
  'mid-source-arrow-color',
  'mid-target-arrow-shape',
  'mid-target-arrow-color',
  'source-arrow-shape',
  'source-arrow-color',
  'target-arrow-shape',
  'target-arrow-color',
  'label',
  'font-size',
  'color',
  'text-outline-width',
  'text-outline-color',
  'text-outline-opacity',
  'text-background-color',
  'text-background-opacity',
  'text-background-padding',
  'text-margin-x',
  'text-margin-y',
  'min-zoomed-font-size',
  'text-rotation',
  'source-label',
  'source-text-offset',
  'source-text-margin-x',
  'source-text-margin-y',
  'source-text-rotation',
  'target-label',
  'target-text-offset',
  'target-text-margin-x',
  'target-text-margin-y',
  'target-text-rotation',
  'text-transform',
  'text-background-shape',
  'text-wrap',
  'text-max-width',
  'line-height',
  'text-overflow-wrap',
  'text-justification',
  'text-border-width',
  'text-border-color',
  'text-border-opacity',
  'curve-style',
  'control-point-step-size',
  'control-point-weight',
  'loop-direction',
  'loop-sweep',
  'control-point-distances',
  'control-point-weights',
  'segment-distances',
  'segment-weights',
  'segment-radii',
  'radius-type',
  'edge-distances',
  'taxi-direction',
  'taxi-turn',
  'taxi-turn-min-distance',
  'taxi-radius',
  'haystack-radius',
  'source-endpoint',
  'target-endpoint',
  'source-distance-from-node',
  'target-distance-from-node',
  'overlay-color',
  'overlay-opacity',
  'overlay-padding',
  'underlay-color',
  'underlay-opacity',
  'underlay-padding',
  'transition-property',
  'transition-duration',
  'transition-delay',
  'transition-timing-function',
]);

/** curve props are edge-only (constants and mappers alike). */
const CURVE_PROPS: ReadonlySet<string> = new Set([
  'curve-style',
  'control-point-step-size',
  'control-point-weight',
  'loop-direction',
  'loop-sweep',
  'control-point-distances',
  'control-point-weights',
  'segment-distances',
  'segment-weights',
  'segment-radii',
  'radius-type',
  'edge-distances',
  'taxi-direction',
  'taxi-turn',
  'taxi-turn-min-distance',
  'taxi-radius',
  'haystack-radius',
  'source-endpoint',
  'target-endpoint',
  'source-distance-from-node',
  'target-distance-from-node',
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

const CORE_DEFAULTS: CoreStyle = {
  selectionBoxColor: [221, 221, 221, 255], // #ddd
  selectionBoxOpacity: 0.65,
  selectionBoxBorderColor: [170, 170, 170, 255], // #aaa
  selectionBoxBorderWidth: 1,
  activeBgColor: [0, 0, 0, 255], // black
  activeBgOpacity: 0.15,
  activeBgSize: 30,
};

const resolveCoreProps = (props: StyleProps | undefined): CoreStyle => {
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
      case 'selection-box-color':
        out.selectionBoxColor = parseColor(prop, value);
        break;
      case 'selection-box-opacity':
        out.selectionBoxOpacity = parseZeroOne(prop, value);
        break;
      case 'selection-box-border-color':
        out.selectionBoxBorderColor = parseColor(prop, value);
        break;
      case 'selection-box-border-width':
        out.selectionBoxBorderWidth = parseNonNegative(prop, value);
        break;
      case 'active-bg-color':
        out.activeBgColor = parseColor(prop, value);
        break;
      case 'active-bg-opacity':
        out.activeBgOpacity = parseZeroOne(prop, value);
        break;
      case 'active-bg-size':
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
const GLOBAL_FONT_PROPS: ReadonlySet<string> = new Set([
  'font-family',
  'font-style',
  'font-weight',
]);

/** the end-label family (round 13 D4): edge-only */
const END_LABEL_PROPS: ReadonlySet<string> = new Set([
  'source-label',
  'source-text-offset',
  'source-text-margin-x',
  'source-text-margin-y',
  'source-text-rotation',
  'target-label',
  'target-text-offset',
  'target-text-margin-x',
  'target-text-margin-y',
  'target-text-rotation',
]);

/** further node-only props (C3/D3; text-events since 20.3 — edge
 * labels are never pickable in v4): rejected on the edges group */
const NODE_ONLY_EXTRA: ReadonlySet<string> = new Set([
  'shape-polygon-points',
  'text-halign',
  'text-valign',
  'text-events',
]);

/** ghost props are node-only (round 13 A1). */
const GHOST_PROPS: ReadonlySet<string> = new Set([
  'ghost',
  'ghost-offset-x',
  'ghost-offset-y',
  'ghost-opacity',
]);

/** the default chart palette: the mapper DSL's category10 scheme */
const DEFAULT_CHART_COLORS: RGBA[] = resolveScheme('category10').stops.map(
  (hex) => [...hexToRgb(hex), 255] as RGBA,
);

/** chart props are node-only (round 23). */
const CHART_PROPS: ReadonlySet<string> = new Set([
  'chart',
  'chart-values',
  'chart-colors',
  'chart-size',
  'chart-hole',
  'chart-start-angle',
  'chart-direction',
  'chart-opacity',
]);

/** overlay/underlay *shape* props are node-only (edge layers stroke
 * the edge geometry, so shape/radius don't apply — v3 ignores them on
 * edges; v4 rejects them). */
const LAYER_SHAPE_PROPS: ReadonlySet<string> = new Set([
  'overlay-shape',
  'overlay-corner-radius',
  'underlay-shape',
  'underlay-corner-radius',
]);

const parseColor = (prop: string, value: unknown): RGBA => {
  const tuple = color2tuple(value as string);

  if (tuple == null) {
    throw new Error(
      `The value '${String(value)}' is not a valid colour for '${prop}'`,
    );
  }

  const [r, g, b, a] = tuple;

  return [r, g, b, Math.round((a ?? 1) * 255)];
};

const parseNumber = (prop: string, value: unknown): number => {
  const num = typeof value === 'number' ? value : parseFloat(String(value));

  if (!isFinite(num)) {
    throw new Error(
      `The value '${String(value)}' is not a valid number for '${prop}'`,
    );
  }

  return num;
};

/** v3's zeroOneNumber type. */
const parseZeroOne = (prop: string, value: unknown): number => {
  const num = parseNumber(prop, value);

  if (num < 0 || num > 1) {
    throw new Error(`The ${prop} '${String(value)}' must be within [0, 1]`);
  }

  return num;
};

/** overlay/underlay shape: v3's overlayShape enum. */
const parseLayerShape = (prop: string, value: unknown): number => {
  const token = String(value).trim();

  if (token === 'round-rectangle') {
    return 0;
  }
  if (token === 'ellipse') {
    return 1;
  }

  throw new Error(
    `The ${prop} '${String(value)}' is invalid; use round-rectangle or ellipse`,
  );
};

/** overlay/underlay corner radius: a non-negative number or 'auto'. */
const parseLayerRadius = (prop: string, value: unknown): number => {
  if (String(value).trim() === 'auto') {
    return -1;
  }

  return parseNonNegative(prop, value);
};

const TEXT_TRANSFORMS: Record<string, number> = {
  none: 0,
  uppercase: 1,
  lowercase: 2,
};
// the wrap family (round 16.2) — v3's keyword sets
const TEXT_WRAPS: Record<string, number> = { none: 0, wrap: 1, ellipsis: 2 };
const TEXT_WRAP_NAMES = ['none', 'wrap', 'ellipsis'];
const OFLOW_WRAPS: Record<string, number> = { whitespace: 0, anywhere: 1 };
const OFLOW_WRAP_NAMES = ['whitespace', 'anywhere'];
const JUSTIFICATIONS: Record<string, number> = {
  auto: -1,
  left: 0,
  center: 1,
  right: 2,
};
const JUSTIFICATION_NAMES: Record<number, string> = {
  [-1]: 'auto',
  0: 'left',
  1: 'center',
  2: 'right',
};

const parseKeyword =
  (prop: string, table: Record<string, number>) =>
  (value: unknown): number => {
    const id = table[String(value)];

    if (id == null) {
      throw new Error(
        `The ${prop} '${String(value)}' is unsupported; use one of: ${Object.keys(table).join(', ')}`,
      );
    }

    return id;
  };
const TEXT_TRANSFORM_NAMES: Record<number, string> = {
  0: 'none',
  1: 'uppercase',
  2: 'lowercase',
};

const parseTextTransform = (value: unknown): number => {
  const id = TEXT_TRANSFORMS[String(value)];

  if (id == null) {
    throw new Error(
      `The text-transform '${String(value)}' is invalid; use one of: none, uppercase, lowercase`,
    );
  }

  return id;
};

const TEXT_BG_SHAPES: Record<string, number> = {
  rectangle: 0,
  'round-rectangle': 1,
};
const TEXT_BG_SHAPE_NAMES: Record<number, string> = {
  0: 'rectangle',
  1: 'round-rectangle',
};

const parseTextBgShape = (value: unknown): number => {
  const id = TEXT_BG_SHAPES[String(value)];

  if (id == null) {
    throw new Error(
      `The text-background-shape '${String(value)}' is invalid; use rectangle or round-rectangle`,
    );
  }

  return id;
};

const ARROW_FILLS: Record<string, number> = { filled: 0, hollow: 1 };
const ARROW_FILL_NAMES: Record<number, string> = { 0: 'filled', 1: 'hollow' };

const parseArrowFill = (value: unknown): number => {
  const id = ARROW_FILLS[String(value)];

  if (id == null) {
    throw new Error(
      `The arrow-fill '${String(value)}' is unsupported in the GPU prototype; use filled or hollow`,
    );
  }

  return id;
};

const ARROW_WIDTH_PERCENT = /^(-?(?:\d+\.?\d*|\.\d+))%$/;

/** v3's arrowWidth: a px number, 'match-line', or a percent of the
 * edge width — resolved against the width at style-write. */
const parseArrowWidth = (
  prop: string,
  value: unknown,
): number | 'match-line' | { percent: number } => {
  if (String(value).trim() === 'match-line') {
    return 'match-line';
  }

  const pct = ARROW_WIDTH_PERCENT.exec(String(value).trim());

  if (pct != null) {
    return { percent: parseFloat(pct[1]) / 100 };
  }

  return parseNonNegative(prop, value);
};

const LINE_CAPS: Record<string, number> = { butt: 0, round: 1, square: 2 };
const LINE_CAP_NAMES: Record<number, string> = {
  0: 'butt',
  1: 'round',
  2: 'square',
};

const parseLineCap = (value: unknown): number => {
  const id = LINE_CAPS[String(value)];

  if (id == null) {
    throw new Error(
      `The line-cap '${String(value)}' is invalid; use one of: butt, round, square`,
    );
  }

  return id;
};

/**
 * Normalize a dash pattern to two on/off pairs (B3): odd patterns
 * double (canvas semantics), a single pair repeats, and longer
 * patterns truncate to the first two pairs — a recorded cap.
 */
const normalizeDashPattern = (
  list: number[],
  empty: number[] = [6, 3, 6, 3],
): number[] => {
  if (list.length === 0) {
    return empty;
  }

  for (const v of list) {
    if (v < 0) {
      throw new Error('dash-pattern entries may not be negative');
    }
  }

  const doubled = list.length % 2 === 1 ? [...list, ...list] : list;
  const pairs =
    doubled.length >= 4
      ? doubled.slice(0, 4)
      : [...doubled, ...doubled].slice(0, 4);

  return pairs;
};

const FILL_KINDS: Record<string, number> = {
  solid: 0,
  'linear-gradient': 1,
  'radial-gradient': 2,
};
const FILL_KIND_NAMES: Record<number, string> = {
  0: 'solid',
  1: 'linear-gradient',
  2: 'radial-gradient',
};

const parseFill = (prop: string, value: unknown): number => {
  const id = FILL_KINDS[String(value)];

  if (id == null) {
    throw new Error(
      `The ${prop} '${String(value)}' is invalid; use solid, linear-gradient or radial-gradient`,
    );
  }

  return id;
};

const GRADIENT_DIRECTIONS: Record<string, number> = {
  'to-bottom': 0,
  'to-top': 1,
  'to-left': 2,
  'to-right': 3,
  'to-bottom-right': 4,
  'to-bottom-left': 5,
  'to-top-right': 6,
  'to-top-left': 7,
};
const GRADIENT_DIRECTION_NAMES: Record<number, string> = {
  0: 'to-bottom',
  1: 'to-top',
  2: 'to-left',
  3: 'to-right',
  4: 'to-bottom-right',
  5: 'to-bottom-left',
  6: 'to-top-right',
  7: 'to-top-left',
};

const parseGradientDirection = (value: unknown): number => {
  const id = GRADIENT_DIRECTIONS[String(value)];

  if (id == null) {
    throw new Error(
      `The background-gradient-direction '${String(value)}' is invalid; ` +
        `use one of: ${Object.keys(GRADIENT_DIRECTIONS).join(', ')}`,
    );
  }

  return id;
};

/** gradient stop colors: an array or whitespace-separated string (C2). */
const parseColorList = (prop: string, value: unknown): RGBA[] => {
  const parts = Array.isArray(value)
    ? value
    : String(value).trim().split(/\s+/);

  return parts.map((part) => parseColor(prop, part));
};

/** gradient stop positions: percents (numbers or 'N%' strings) → fractions. */
const parsePercentList = (prop: string, value: unknown): number[] => {
  const parts = Array.isArray(value)
    ? value
    : String(value).trim().split(/\s+/);

  return parts.map((part) => {
    const num = typeof part === 'number' ? part : parseFloat(String(part));

    if (!isFinite(num)) {
      throw new Error(
        `The value '${String(part)}' is not a valid percent for '${prop}'`,
      );
    }

    return Math.max(0, Math.min(1, num / 100));
  });
};

/** text-halign/-valign (round 13 D3): v3's 3x3 node-label grid. */
// background images (round 15.2) — v3's keyword sets verbatim
const BG_FITS: Record<string, number> = { none: 0, contain: 1, cover: 2 };
const BG_FIT_NAMES = ['none', 'contain', 'cover'];
const BG_REPEATS: Record<string, number> = {
  'no-repeat': 0,
  'repeat-x': 1,
  'repeat-y': 2,
  repeat: 3,
};
const BG_REPEAT_NAMES = ['no-repeat', 'repeat-x', 'repeat-y', 'repeat'];
const BG_CLIPS: Record<string, number> = { none: 0, node: 1 };
const BG_CLIP_NAMES = ['none', 'node'];
const BG_CONTAINMENTS: Record<string, number> = { inside: 0, over: 1 };
const BG_CONTAINMENT_NAMES = ['inside', 'over'];
const IMAGE_TYPES: Record<string, number> = { auto: 0, 'sdf-icon': 1 };
const IMAGE_TYPE_NAMES = ['auto', 'sdf-icon'];
const BG_CROSSORIGINS = new Set(['anonymous', 'use-credentials', 'null']);

const BG_PCT = /^\s*(-?(?:\d+\.?\d*|\.\d+))\s*%\s*$/;
const BG_PX = /^\s*(-?(?:\d+\.?\d*|\.\d+))\s*px\s*$/;

/** Parse one prop value as a per-image list: arrays distribute per
 * image (index i reads entry min(i, len-1)); scalars apply to all. */
const parseImageList = <T,>(
  prop: string,
  value: unknown,
  one: (v: unknown) => T,
): T[] => {
  const list = Array.isArray(value) ? value : [value];

  if (list.length === 0) {
    throw new Error(`The ${prop} list must not be empty`);
  }

  return list.map(one);
};

const parseImageEnum =
  (prop: string, table: Record<string, number>) =>
  (v: unknown): number => {
    const id = table[String(v)];

    if (id == null) {
      throw new Error(
        `The ${prop} '${String(v)}' is unsupported; use one of: ${Object.keys(table).join(', ')}`,
      );
    }

    return id;
  };

/** %/px length ('N%' | 'Npx' | number) → { v, pct } */
const parseBgLen =
  (prop: string) =>
  (v: unknown): BgLen => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      return { v, pct: false };
    }

    const s = String(v);
    const pct = BG_PCT.exec(s);

    if (pct != null) {
      return { v: Number(pct[1]), pct: true };
    }

    const px = BG_PX.exec(s);

    if (px != null) {
      return { v: Number(px[1]), pct: false };
    }

    throw new Error(
      `The ${prop} '${s}' must be a number of px or an 'N%' string`,
    );
  };

/** 'auto' | %/px length → { mode: 0 auto | 1 px | 2 pct, v } */
const parseBgSize =
  (prop: string) =>
  (v: unknown): BgSize => {
    if (v === 'auto') {
      return { mode: 0, v: 0 };
    }

    const len = parseBgLen(prop)(v);

    if (len.v < 0) {
      throw new Error(`The ${prop} '${String(v)}' must be non-negative`);
    }

    return { mode: len.pct ? 2 : 1, v: len.v };
  };

/** url list: 'none' → [], strings strip an optional url(...) wrapper */
const parseUrls = (prop: string, value: unknown): string[] => {
  if (value === 'none' || value == null) {
    return [];
  }

  const list = Array.isArray(value) ? value : [value];
  const urls: string[] = [];

  for (const v of list) {
    const s = String(v).trim();

    if (s === 'none' || s === '') {
      continue;
    }

    const wrapped = /^url\s*\(\s*['"]?(.*?)['"]?\s*\)$/.exec(s);

    urls.push(wrapped != null ? wrapped[1] : s);
  }

  return urls;
};

const HALIGNS: Record<string, number> = { left: 0, center: 1, right: 2 };
const VALIGNS: Record<string, number> = { top: 0, center: 1, bottom: 2 };
const HALIGN_NAMES = ['left', 'center', 'right'];
const VALIGN_NAMES = ['top', 'center', 'bottom'];

const parseAlign = (
  prop: string,
  value: unknown,
  table: Record<string, number>,
): number => {
  const id = table[String(value)];

  if (id == null) {
    throw new Error(
      `The ${prop} '${String(value)}' is invalid; use one of: ${Object.keys(table).join(', ')}`,
    );
  }

  return id;
};

const BORDER_POSITIONS: Record<string, number> = {
  center: 0,
  inside: 1,
  outside: 2,
};
const BORDER_POSITION_NAMES: Record<number, string> = {
  0: 'center',
  1: 'inside',
  2: 'outside',
};

const parseBorderPosition = (value: unknown): number => {
  const id = BORDER_POSITIONS[String(value)];

  if (id == null) {
    throw new Error(
      `The border-position '${String(value)}' is invalid; use one of: center, inside, outside`,
    );
  }

  return id;
};

// -- border-style / outline-style (round 38) --

const STROKE_STYLES: Record<string, number> = {
  solid: 0,
  dashed: 1,
  dotted: 2,
  double: 3,
};
const STROKE_STYLE_NAMES: Record<number, string> = {
  0: 'solid',
  1: 'dashed',
  2: 'dotted',
  3: 'double',
};

const parseStrokeStyle = (prop: string, value: unknown): number => {
  const id = STROKE_STYLES[String(value)];

  if (id == null) {
    throw new Error(
      `The ${prop} '${String(value)}' is invalid; ` +
        `use one of: ${Object.keys(STROKE_STYLES).join(', ')}`,
    );
  }

  return id;
};

/** Resolve gradient stops (C2): even spread when positions are unset,
 * clamped monotone otherwise; the channel opacity folds into each
 * stop's alpha; capped at 5 stops (a recorded cap). */
const gradientStops = (
  colors: RGBA[],
  positions: number[] | null,
  opacity: number,
): { rgba: number; pos: number }[] => {
  const n = Math.min(colors.length, 5);
  const out: { rgba: number; pos: number }[] = [];
  let last = 0;

  for (let i = 0; i < n; i++) {
    const [r, g, b, a] = colors[i];
    let pos =
      positions != null && positions[i] != null
        ? positions[i]
        : n === 1
          ? 0
          : i / (n - 1);

    if (pos < last) {
      pos = last;
    } // canvas: stops never decrease

    last = pos;
    out.push({
      rgba: ((Math.round(a * opacity) << 24) | (b << 16) | (g << 8) | r) >>> 0,
      pos,
    });
  }

  return out;
};

/** v3's bool type: 'yes'/'no' keywords (booleans accepted too). */
const parseChartKind = (prop: string, value: unknown): number => {
  if (value === 'none') {
    return CHART_NONE;
  }
  if (value === 'pie') {
    return CHART_PIE;
  }
  if (value === 'stripes') {
    return CHART_STRIPES;
  }

  throw new Error(
    `The chart kind '${String(value)}' must be 'none', 'pie' or 'stripes'`,
  );
};

/** A number list (array or space-separated string) of finite fractions >= 0. */
const parseChartValues = (prop: string, value: unknown): number[] => {
  const raw = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.trim().split(/\s+/)
      : null;

  if (raw == null || raw.length === 0) {
    throw new Error(`The ${prop} '${String(value)}' must be a number list`);
  }

  return raw.map((v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v));

    if (!isFinite(n) || n < 0) {
      throw new Error(
        `The ${prop} entry '${String(v)}' must be a non-negative number`,
      );
    }

    return n;
  });
};

/** A palette: a named scheme, or a color list (array or space-separated). */
const parseChartColors = (prop: string, value: unknown): RGBA[] => {
  if (
    typeof value === 'string' &&
    SCHEMES[value.trim().toLowerCase()] != null
  ) {
    // a named scheme (scheme names never collide with CSS color names)
    return resolveScheme(value).stops.map(
      (hex) => [...hexToRgb(hex), 255] as RGBA,
    );
  }

  if (
    typeof value === 'string' &&
    !/\s/.test(value.trim()) &&
    !value.startsWith('#') &&
    !value.startsWith('rgb')
  ) {
    // a bare single word that is neither a scheme nor obviously a color:
    // let resolveScheme throw its scheme-list error unless the color
    // parser accepts it (e.g. 'red')
    try {
      return [parseColor(prop, value)];
    } catch {
      return resolveScheme(value).stops.map(
        (hex) => [...hexToRgb(hex), 255] as RGBA,
      );
    }
  }

  const list = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.trim().split(/\s+/)
      : null;

  if (list == null || list.length === 0) {
    throw new Error(
      `The ${prop} '${String(value)}' must be a color list or scheme name`,
    );
  }

  return list.map((v) => parseColor(prop, v));
};

/** A fraction in [0, 1], as a number or an 'N%' string. */
const parseChartFraction = (prop: string, value: unknown): number => {
  const n =
    typeof value === 'string' && value.trim().endsWith('%')
      ? parseFloat(value) / 100
      : typeof value === 'number'
        ? value
        : NaN;

  if (!isFinite(n) || n < 0 || n > 1) {
    throw new Error(
      `The ${prop} '${String(value)}' must be a fraction in [0, 1] (or 'N%')`,
    );
  }

  return n;
};

const parseYesNo = (prop: string, value: unknown): boolean => {
  if (typeof value === 'boolean') {
    return value;
  }

  const token = String(value).trim();

  if (token === 'yes') {
    return true;
  }
  if (token === 'no') {
    return false;
  }

  throw new Error(
    `The value '${String(value)}' is not a valid ${prop} (use 'yes' or 'no')`,
  );
};

/** v3's size type: a non-negative number. */
const parseNonNegative = (prop: string, value: unknown): number => {
  const num = parseNumber(prop, value);

  if (num < 0) {
    throw new Error(
      `The value '${String(value)}' for '${prop}' may not be negative`,
    );
  }

  return num;
};

const parseShape = (value: unknown): number => {
  const shape = SHAPES[String(value)];

  if (shape == null) {
    throw new Error(
      `The shape '${String(value)}' is unsupported in the GPU prototype; ` +
        `use one of: ${Object.keys(SHAPES).join(', ')}`,
    );
  }

  return shape;
};

const LINE_STYLES: Record<string, number> = {
  solid: LINE_SOLID,
  dashed: LINE_DASHED,
  dotted: LINE_DOTTED,
};

/** Stored line-style id → resolved keyword. */
const LINE_STYLE_NAMES: Record<number, string> = {
  [LINE_SOLID]: 'solid',
  [LINE_DASHED]: 'dashed',
  [LINE_DOTTED]: 'dotted',
};

const parseLineStyle = (value: unknown): number => {
  const style = LINE_STYLES[String(value)];

  if (style == null) {
    throw new Error(
      `The line-style '${String(value)}' is unsupported in the GPU prototype; ` +
        `use one of: ${Object.keys(LINE_STYLES).join(', ')}`,
    );
  }

  return style;
};

/*
text-rotation (round 27.7).  The stored value is the rotation in
**radians**, with `NaN` as the one sentinel, meaning `autorotate`.

That works because 'none' and a rotation of 0 radians are the same
rendering, so collapsing them costs nothing — and it leaves the whole
real line free for numeric values, where an enum id would have
collided (v3 accepts a bare number, and 1 radian is a perfectly
ordinary one).  Autorotate is the only mode that is not an angle at
all: it is resolved per frame from the edge's own slope.
*/
const AUTOROTATE = NaN;

const parseTextRotation = (value: unknown): number => {
  if (value === 'none') {
    return 0;
  }
  if (value === 'autorotate') {
    return AUTOROTATE;
  }
  if (typeof value === 'number' && isFinite(value)) {
    return value;
  }

  throw new Error(
    `The text-rotation '${String(value)}' is unsupported in the GPU prototype; ` +
      `use 'none', 'autorotate', or a number of radians`,
  );
};

/** Stored rotation → the resolved value a getter reports. */
const textRotationName = (rotation: number): string | number => {
  if (Number.isNaN(rotation)) {
    return 'autorotate';
  }

  return rotation === 0 ? 'none' : rotation;
};

/** curve-style keywords (12a: bezier; 12b: the unbundled families). */
const CURVE_STYLES: Record<string, number> = {
  straight: CURVE_STYLE_STRAIGHT,
  bezier: CURVE_STYLE_BEZIER,
  'unbundled-bezier': CURVE_STYLE_UNBUNDLED,
  segments: CURVE_STYLE_SEGMENTS,
  'round-segments': CURVE_STYLE_ROUND_SEGMENTS,
  taxi: CURVE_STYLE_TAXI,
  'round-taxi': CURVE_STYLE_ROUND_TAXI,
  haystack: CURVE_STYLE_HAYSTACK,
  'straight-triangle': CURVE_STYLE_TRIANGLE,
};

const CURVE_STYLE_NAMES: Record<number, string> = {
  [CURVE_STYLE_STRAIGHT]: 'straight',
  [CURVE_STYLE_BEZIER]: 'bezier',
  [CURVE_STYLE_UNBUNDLED]: 'unbundled-bezier',
  [CURVE_STYLE_SEGMENTS]: 'segments',
  [CURVE_STYLE_ROUND_SEGMENTS]: 'round-segments',
  [CURVE_STYLE_TAXI]: 'taxi',
  [CURVE_STYLE_ROUND_TAXI]: 'round-taxi',
  [CURVE_STYLE_HAYSTACK]: 'haystack',
  [CURVE_STYLE_TRIANGLE]: 'straight-triangle',
};

const parseCurveStyle = (value: unknown): number => {
  const style = CURVE_STYLES[String(value)];

  if (style == null) {
    throw new Error(
      `The curve-style '${String(value)}' is unsupported in the GPU prototype; ` +
        `use one of: ${Object.keys(CURVE_STYLES).join(', ')}`,
    );
  }

  return style;
};

/** v3's `numbers` type: a number, an array of numbers, or a
 * whitespace-separated string (as in string sheets). */
const parseNumberList = (prop: string, value: unknown): number[] => {
  if (typeof value === 'number') {
    return [parseNumber(prop, value)];
  }

  const parts = Array.isArray(value)
    ? value
    : String(value).trim() === ''
      ? []
      : String(value).trim().split(/\s+/);

  return parts.map((part) => parseNumber(prop, part));
};

/**
 * shape-polygon-points (C3): flat unit pairs in [-1, 1], v3's
 * evenMultiple rule plus a >= 3 point floor (the SDF needs a real
 * polygon); capped at 32 points, a recorded cap.
 */
const parsePolygonPoints = (prop: string, value: unknown): number[] => {
  const list = parseNumberList(prop, value);

  if (list.length % 2 !== 0 || list.length < 6) {
    throw new Error(
      `The ${prop} list must hold an even number of values (at least 3 x/y pairs)`,
    );
  }

  for (const v of list) {
    if (v < -1 || v > 1) {
      throw new Error(`The ${prop} value ${v} is outside [-1, 1]`);
    }
  }

  return list.length > 64 ? list.slice(0, 64) : list;
};

const RADIUS_TYPES: Record<string, number> = {
  'arc-radius': 1,
  'influence-radius': 0,
};

const RADIUS_TYPE_NAMES: Record<number, string> = {
  1: 'arc-radius',
  0: 'influence-radius',
};

/** radius-type: one keyword or a per-point list (v3's multiple enum). */
const parseRadiusTypes = (prop: string, value: unknown): number[] => {
  const parts = Array.isArray(value)
    ? value
    : String(value).trim().split(/\s+/);

  return parts.map((part) => {
    const id = RADIUS_TYPES[String(part)];

    if (id == null) {
      throw new Error(
        `The ${prop} '${String(part)}' is invalid; use one of: ` +
          Object.keys(RADIUS_TYPES).join(', '),
      );
    }

    return id;
  });
};

const EDGE_DISTANCES: Record<string, number> = {
  intersection: EDGE_DIST_INTERSECTION,
  'node-position': EDGE_DIST_NODE_POSITION,
  endpoints: EDGE_DIST_ENDPOINTS,
};

const EDGE_DISTANCE_NAMES: Record<number, string> = {
  [EDGE_DIST_INTERSECTION]: 'intersection',
  [EDGE_DIST_NODE_POSITION]: 'node-position',
  [EDGE_DIST_ENDPOINTS]: 'endpoints',
};

const parseEdgeDistances = (value: unknown): number => {
  const id = EDGE_DISTANCES[String(value)];

  if (id == null) {
    throw new Error(
      `The edge-distances '${String(value)}' is unsupported in the GPU prototype; ` +
        `use one of: ${Object.keys(EDGE_DISTANCES).join(', ')}`,
    );
  }

  return id;
};

const ENDPT_KEYWORDS: Record<string, number> = {
  'outside-to-node': ENDPT_DEFAULT,
  'inside-to-node': ENDPT_INSIDE,
  'outside-to-line': ENDPT_LINE,
};

const ENDPT_COMPONENT = /^(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(%|px)?$/;

/**
 * v3's edgeEndpoint forms: a keyword, a 2-component point ('%' or px
 * per component), or a single angle ('deg'/'rad' strings, or a plain
 * number in radians — v4's angle convention).  The '-or-label'
 * keywords need the label bounding box v4 doesn't have and throw (a
 * recorded deviation, deferred to the label-bb round).
 */
const parseEndpoint = (prop: string, value: unknown): EndpointEnd => {
  if (typeof value === 'number' && isFinite(value)) {
    return { mode: ENDPT_ANGLE, a: value - Math.PI / 2, b: 0, pct: 0 };
  }

  const parts = Array.isArray(value)
    ? value
    : String(value).trim().split(/\s+/);

  if (parts.length === 1 && typeof parts[0] === 'string') {
    const token = parts[0].trim();
    const keyword = ENDPT_KEYWORDS[token];

    if (keyword != null) {
      return { mode: keyword, a: 0, b: 0, pct: 0 };
    }

    if (
      token === 'outside-to-node-or-label' ||
      token === 'outside-to-line-or-label'
    ) {
      throw new Error(
        `The ${prop} '${token}' is unsupported in the GPU prototype ` +
          `(label bounding boxes are not computed; use the non-label form)`,
      );
    }

    const angle = ANGLE_VALUE.exec(token);

    if (angle != null && angle[2] != null) {
      const num = parseFloat(angle[1]);
      const rad = angle[2] === 'deg' ? (num * Math.PI) / 180 : num;

      return { mode: ENDPT_ANGLE, a: rad - Math.PI / 2, b: 0, pct: 0 };
    }
  }

  if (
    parts.length === 1 &&
    typeof parts[0] === 'number' &&
    isFinite(parts[0])
  ) {
    return { mode: ENDPT_ANGLE, a: parts[0] - Math.PI / 2, b: 0, pct: 0 };
  }

  if (parts.length === 2) {
    let pct = 0;
    const comp = (raw: unknown, bit: number): number => {
      if (typeof raw === 'number' && isFinite(raw)) {
        return raw;
      }

      const m = ENDPT_COMPONENT.exec(String(raw).trim());

      if (m == null) {
        throw new Error(
          `The value '${String(raw)}' is not a valid ${prop} component`,
        );
      }

      const num = parseFloat(m[1]);

      if (m[2] === '%') {
        pct |= bit;

        return num / 100;
      }

      return num;
    };

    const a = comp(parts[0], ENDPT_PCT_X);
    const b = comp(parts[1], ENDPT_PCT_Y);

    return { mode: ENDPT_POINT, a, b, pct };
  }

  throw new Error(
    `The value '${String(value)}' is not a valid ${prop} ` +
      `(use a keyword, an 'x y' point with optional %/px units, or an angle)`,
  );
};

/** endpoint readback: the canonical string form (keywords, 'x y' with
 * % suffixes on pct components, or '<rad>rad' for angles). */
const endpointString = (e: EndpointEnd): string => {
  switch (e.mode) {
    case ENDPT_INSIDE:
      return 'inside-to-node';
    case ENDPT_LINE:
      return 'outside-to-line';
    case ENDPT_POINT: {
      const x = e.pct % 2 === 1 ? `${e.a * 100}%` : `${e.a}`;
      const y = e.pct >= ENDPT_PCT_Y ? `${e.b * 100}%` : `${e.b}`;

      return `${x} ${y}`;
    }
    case ENDPT_ANGLE:
      return `${e.a + Math.PI / 2}rad`;
    default:
      return 'outside-to-node';
  }
};

const TAXI_DIRECTIONS: Record<string, number> = {
  auto: TAXI_AUTO,
  vertical: TAXI_VERTICAL,
  horizontal: TAXI_HORIZONTAL,
  upward: TAXI_UPWARD,
  downward: TAXI_DOWNWARD,
  leftward: TAXI_LEFTWARD,
  rightward: TAXI_RIGHTWARD,
};

const TAXI_DIRECTION_NAMES: Record<number, string> = {
  [TAXI_AUTO]: 'auto',
  [TAXI_VERTICAL]: 'vertical',
  [TAXI_HORIZONTAL]: 'horizontal',
  [TAXI_UPWARD]: 'upward',
  [TAXI_DOWNWARD]: 'downward',
  [TAXI_LEFTWARD]: 'leftward',
  [TAXI_RIGHTWARD]: 'rightward',
};

const parseTaxiDirection = (value: unknown): number => {
  const id = TAXI_DIRECTIONS[String(value)];

  if (id == null) {
    throw new Error(
      `The taxi-direction '${String(value)}' is invalid; use one of: ` +
        Object.keys(TAXI_DIRECTIONS).join(', '),
    );
  }

  return id;
};

const TAXI_TURN_PERCENT = /^(-?(?:\d+\.?\d*|\.\d+))%$/;

/** taxi-turn: a px number (may be negative = from the target side) or a
 * percent string ('50%' stores the fraction, v3's pfValue). */
const parseTaxiTurn = (value: unknown): { value: number; percent: boolean } => {
  if (typeof value === 'number') {
    return { value: parseNumber('taxi-turn', value), percent: false };
  }

  const match = TAXI_TURN_PERCENT.exec(String(value).trim());

  if (match != null) {
    return { value: parseFloat(match[1]) / 100, percent: true };
  }

  return { value: parseNumber('taxi-turn', value), percent: false };
};

const ANGLE_VALUE = /^(-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)(deg|rad)?$/;

/** v3's angle type: plain numbers are radians; strings take deg/rad units. */
const parseAngle = (prop: string, value: unknown): number => {
  if (typeof value === 'number' && isFinite(value)) {
    return value;
  }

  const m = ANGLE_VALUE.exec(String(value).trim());

  if (m == null) {
    throw new Error(
      `The value '${String(value)}' is not a valid angle for '${prop}' ` +
        `(use a number in radians, or a 'deg'/'rad' suffixed string)`,
    );
  }

  const num = parseFloat(m[1]);

  return m[2] === 'deg' ? (num * Math.PI) / 180 : num;
};

const parseArrowShape = (prop: string, value: unknown): ArrowShape => {
  const id = ARROW_ENUM[String(value)];

  if (id == null) {
    throw new Error(
      `The ${prop} '${String(value)}' is unsupported in the GPU prototype; ` +
        `use one of: ${Object.keys(ARROW_ENUM).join(', ')}`,
    );
  }

  return ARROW_NAMES[id];
};

// Round 34.5: the normalization cache.  Every style read normalizes its
// property name first, and the regex replace plus lowercase allocation
// was **36% of `readProp`** in the built bundle — more than the
// 145-case switch it precedes.  The key space is the prop vocabulary (a
// few hundred names across both spellings), so the cache is bounded by
// the API rather than by anything a caller controls; the size guard
// keeps a caller that passes junk from growing it without bound, since
// an unknown name is normalized *before* it is rejected.
const NORMALIZED = new Map<string, string>();
const NORMALIZE_CACHE_MAX = 512;

/**
 * camelCase → kebab-case ('backgroundColor' → 'background-color'),
 * memoized (34.5).
 *
 * @param prop — a property name in either spelling; not validated here,
 *   which is why the memo is bounded (an unknown name is normalized
 *   before it is rejected, so a caller passing junk must not be able to
 *   grow the cache without limit)
 * @returns the kebab-case spelling — the key every prop table is keyed
 *   by.  An already-kebab name is returned unchanged, and an *unknown*
 *   name is normalized rather than rejected, since the rejection happens
 *   downstream against the normalized form
 */
export const normalizeProp = (prop: string): string => {
  const hit = NORMALIZED.get(prop);

  if (hit !== undefined) {
    return hit;
  }

  const normalized = prop.replace(/([A-Z])/g, '-$1').toLowerCase();

  if (NORMALIZED.size < NORMALIZE_CACHE_MAX) {
    NORMALIZED.set(prop, normalized);
  }

  return normalized;
};

/** Apply one (normalized-name) prop onto a computed record. */
const applyProp = (computed: Computed, prop: string, value: unknown): void => {
  switch (prop) {
    // node properties
    case 'background-color':
      computed.fillColor = parseColor(prop, value);
      break;
    case 'border-color':
      computed.borderColor = parseColor(prop, value);
      break;
    case 'width': // node width or edge line width, resolved per group at apply time
      computed.width = parseNumber(prop, value);
      break;
    case 'height':
      computed.height = parseNumber(prop, value);
      break;
    case 'shape':
      computed.shape = parseShape(value);
      break;
    case 'shape-polygon-points':
      computed.shapePolygonPoints = parsePolygonPoints(prop, value);
      break;
    case 'text-outline-width':
      computed.textOutlineWidth = parseNumber(prop, value);
      break;
    case 'text-outline-color':
      computed.textOutlineColor = parseColor(prop, value);
      break;
    case 'text-outline-opacity':
      computed.textOutlineOpacity = parseNumber(prop, value);
      break;
    case 'text-background-color':
      computed.textBgColor = parseColor(prop, value);
      break;
    case 'text-background-opacity':
      computed.textBgOpacity = parseNumber(prop, value);
      break;
    case 'text-background-padding':
      computed.textBgPadding = parseNumber(prop, value);
      break;
    case 'text-margin-x':
      computed.textMarginX = parseNumber(prop, value);
      break;
    case 'text-margin-y':
      computed.textMarginY = parseNumber(prop, value);
      break;
    case 'min-zoomed-font-size':
      computed.minZoomedFontSize = parseNonNegative(prop, value);
      break;
    case 'text-halign':
      computed.textHalign = parseAlign(prop, value, HALIGNS);
      break;
    case 'text-valign':
      computed.textValign = parseAlign(prop, value, VALIGNS);
      break;
    case 'text-rotation':
      computed.textRotation = parseTextRotation(value);
      break;
    case 'text-transform':
      computed.textTransform = parseTextTransform(value);
      break;
    case 'text-wrap':
      computed.textWrap = parseKeyword(prop, TEXT_WRAPS)(value);
      break;
    case 'text-max-width':
      computed.textMaxWidth = parseNonNegative(prop, value);
      break;
    case 'line-height':
      computed.lineHeight = parseNonNegative(prop, value);
      break;
    case 'text-overflow-wrap':
      computed.textOverflowWrap = parseKeyword(prop, OFLOW_WRAPS)(value);
      break;
    case 'text-justification':
      computed.textJustification = parseKeyword(prop, JUSTIFICATIONS)(value);
      break;
    case 'text-background-shape':
      computed.textBgShape = parseTextBgShape(value);
      break;
    case 'text-border-width':
      computed.textBorderWidth = parseNonNegative(prop, value);
      break;
    case 'text-border-color':
      computed.textBorderColor = parseColor(prop, value);
      break;
    case 'text-border-opacity':
      computed.textBorderOpacity = parseZeroOne(prop, value);
      break;
    case 'border-width':
      computed.borderWidth = parseNumber(prop, value);
      break;
    case 'corner-radius':
      computed.cornerRadius = parseLayerRadius(prop, value);
      break;
    case 'border-position':
      computed.borderPosition = parseBorderPosition(value);
      break;
    case 'border-style':
      computed.borderStyle = parseStrokeStyle(prop, value);
      break;
    case 'border-dash-pattern':
      computed.borderDashPattern = normalizeDashPattern(
        parseNumberList(prop, value),
        NODE_DEFAULTS.borderDashPattern,
      );
      break;
    case 'border-dash-offset':
      computed.borderDashOffset = parseNumber(prop, value);
      break;
    case 'outline-style':
      computed.outlineStyle = parseStrokeStyle(prop, value);
      break;
    case 'outline-color':
      computed.outlineColor = parseColor(prop, value);
      break;
    case 'outline-opacity':
      computed.outlineOpacity = parseZeroOne(prop, value);
      break;
    case 'outline-width':
      computed.outlineWidth = parseNonNegative(prop, value);
      break;
    case 'outline-offset':
      computed.outlineOffset = parseNonNegative(prop, value);
      break;
    case 'background-opacity':
      computed.backgroundOpacity = parseZeroOne(prop, value);
      break;
    case 'background-fill':
      computed.backgroundFill = parseFill(prop, value);
      break;
    case 'background-gradient-stop-colors':
      computed.backgroundGradientStopColors = parseColorList(prop, value);
      break;
    case 'background-gradient-stop-positions':
      computed.backgroundGradientStopPositions = parsePercentList(prop, value);
      break;
    case 'background-gradient-direction':
      computed.backgroundGradientDirection = parseGradientDirection(value);
      break;
    case 'line-fill':
      computed.lineFill = parseFill(prop, value);
      break;
    case 'line-gradient-stop-colors':
      computed.lineGradientStopColors = parseColorList(prop, value);
      break;
    case 'line-gradient-stop-positions':
      computed.lineGradientStopPositions = parsePercentList(prop, value);
      break;
    case 'border-opacity':
      computed.borderOpacity = parseZeroOne(prop, value);
      break;
    case 'line-opacity':
      computed.lineOpacity = parseZeroOne(prop, value);
      break;
    case 'line-cap':
      computed.lineCap = parseLineCap(value);
      break;
    case 'line-outline-width':
      computed.lineOutlineWidth = parseNonNegative(prop, value);
      break;
    case 'line-outline-color':
      computed.lineOutlineColor = parseColor(prop, value);
      break;
    case 'line-dash-pattern':
      computed.lineDashPattern = normalizeDashPattern(
        parseNumberList(prop, value),
      );
      break;
    case 'line-dash-offset':
      computed.lineDashOffset = parseNumber(prop, value);
      break;
    case 'text-opacity':
      computed.textOpacity = parseZeroOne(prop, value);
      break;
    case 'events':
      computed.eventsEnabled = parseYesNo(prop, value);
      break;
    case 'visibility':
      if (value !== 'visible' && value !== 'hidden') {
        throw new Error(
          `The visibility '${String(value)}' must be 'visible' or 'hidden'`,
        );
      }

      computed.invisible = value === 'hidden';
      break;
    case 'chart':
      computed.chartKind = parseChartKind(prop, value);
      break;
    case 'chart-values':
      computed.chartValues = parseChartValues(prop, value);
      computed.chartValuesKey = null;
      break;
    case 'chart-colors':
      computed.chartColors = parseChartColors(prop, value);
      break;
    case 'chart-size':
      computed.chartSize = parseChartFraction(prop, value);
      break;
    case 'chart-hole':
      computed.chartHole = parseChartFraction(prop, value);
      break;
    case 'chart-start-angle':
      computed.chartStartAngle = parseAngle(prop, value);
      break;
    case 'chart-direction':
      if (value !== 'vertical' && value !== 'horizontal') {
        throw new Error(
          `The chart-direction '${String(value)}' must be 'vertical' or 'horizontal'`,
        );
      }

      computed.chartDirection = value === 'horizontal' ? 1 : 0;
      break;
    case 'chart-opacity':
      computed.chartOpacity = parseZeroOne(prop, value);
      break;
    case 'text-events':
      computed.textEvents = parseYesNo(prop, value);
      break;
    case 'ghost':
      computed.ghost = parseYesNo(prop, value);
      break;
    case 'ghost-offset-x':
      computed.ghostOffsetX = parseNumber(prop, value);
      break;
    case 'ghost-offset-y':
      computed.ghostOffsetY = parseNumber(prop, value);
      break;
    case 'overlay-color':
      computed.overlayColor = parseColor(prop, value);
      break;
    case 'overlay-opacity':
      computed.overlayOpacity = parseZeroOne(prop, value);
      break;
    case 'overlay-padding':
      computed.overlayPadding = parseNonNegative(prop, value);
      break;
    case 'overlay-shape':
      computed.overlayShape = parseLayerShape(prop, value);
      break;
    case 'overlay-corner-radius':
      computed.overlayRadius = parseLayerRadius(prop, value);
      break;
    case 'underlay-color':
      computed.underlayColor = parseColor(prop, value);
      break;
    case 'underlay-opacity':
      computed.underlayOpacity = parseZeroOne(prop, value);
      break;
    case 'underlay-padding':
      computed.underlayPadding = parseNonNegative(prop, value);
      break;
    case 'underlay-shape':
      computed.underlayShape = parseLayerShape(prop, value);
      break;
    case 'underlay-corner-radius':
      computed.underlayRadius = parseLayerRadius(prop, value);
      break;
    case 'ghost-opacity': {
      const op = parseNumber(prop, value);

      if (op < 0 || op > 1) {
        throw new Error(
          `The ghost-opacity '${String(value)}' must be within [0, 1]`,
        );
      }

      computed.ghostOpacity = op;
      break;
    }
    case 'opacity':
      computed.opacity = parseNumber(prop, value);
      break;
    case 'label': {
      // constant strings, or the data(key) mapper reading the sidecar
      // ('id' reads the first-class id); mapData stays unsupported
      const text = String(value);
      const mapped = DATA_MAPPER.exec(text);

      if (mapped != null) {
        computed.label = '';
        computed.labelKey = mapped[1];
        break;
      }

      if (/^\s*(data|mapData)\s*\(/.test(text)) {
        throw new Error(
          `The label value '${text}' is unsupported in the GPU prototype; ` +
            `only constant strings and 'data(key)' are allowed`,
        );
      }

      computed.label = text;
      computed.labelKey = null;
      break;
    }
    case 'source-label':
    case 'target-label': {
      // same rules as 'label': constants or the data(key) passthrough
      const text = String(value);
      const mapped = DATA_MAPPER.exec(text);
      const src = prop === 'source-label';

      if (mapped != null) {
        if (src) {
          computed.sourceLabel = '';
          computed.sourceLabelKey = mapped[1];
        } else {
          computed.targetLabel = '';
          computed.targetLabelKey = mapped[1];
        }
        break;
      }

      if (/^\s*(data|mapData)\s*\(/.test(text)) {
        throw new Error(
          `The ${prop} value '${text}' is unsupported in the GPU prototype; ` +
            `only constant strings and 'data(key)' are allowed`,
        );
      }

      if (src) {
        computed.sourceLabel = text;
        computed.sourceLabelKey = null;
      } else {
        computed.targetLabel = text;
        computed.targetLabelKey = null;
      }
      break;
    }
    case 'source-text-offset':
      computed.sourceTextOffset = parseNonNegative(prop, value);
      break;
    case 'target-text-offset':
      computed.targetTextOffset = parseNonNegative(prop, value);
      break;
    case 'source-text-margin-x':
      computed.sourceTextMarginX = parseNumber(prop, value);
      break;
    case 'source-text-margin-y':
      computed.sourceTextMarginY = parseNumber(prop, value);
      break;
    case 'target-text-margin-x':
      computed.targetTextMarginX = parseNumber(prop, value);
      break;
    case 'target-text-margin-y':
      computed.targetTextMarginY = parseNumber(prop, value);
      break;
    case 'source-text-rotation':
      computed.sourceTextRotation = parseTextRotation(value);
      break;
    case 'target-text-rotation':
      computed.targetTextRotation = parseTextRotation(value);
      break;
    case 'font-size':
      computed.fontSize = parseNumber(prop, value);
      break;
    case 'font-family': {
      const family = String(value).trim();

      if (family === '') {
        throw new Error(
          `The value '${String(value)}' is not a valid font-family`,
        );
      }

      computed.fontFamily = family;
      break;
    }
    case 'font-style': {
      const style = String(value);

      if (style !== 'normal' && style !== 'italic' && style !== 'oblique') {
        throw new Error(
          `The font-style '${style}' is invalid; use normal, italic or oblique`,
        );
      }

      computed.fontStyle = style;
      break;
    }
    case 'font-weight': {
      // v3's set: the CSS keywords plus the numeric hundreds
      const weight = String(value);
      const num = Number(weight);
      const keyword =
        weight === 'normal' ||
        weight === 'bold' ||
        weight === 'bolder' ||
        weight === 'lighter';

      if (
        !keyword &&
        !(Number.isFinite(num) && num >= 100 && num <= 900 && num % 100 === 0)
      ) {
        throw new Error(
          `The font-weight '${weight}' is invalid; use normal, bold, bolder, lighter or 100..900`,
        );
      }

      computed.fontWeight = weight;
      break;
    }
    case 'color':
      computed.textColor = parseColor(prop, value);
      break;

    // edge properties
    case 'line-color':
      computed.lineColor = parseColor(prop, value);
      break;
    case 'line-style':
      computed.lineStyle = parseLineStyle(value);
      break;
    case 'source-arrow-shape':
      computed.sourceArrowShape = parseArrowShape(prop, value);
      break;
    case 'target-arrow-shape':
      computed.targetArrowShape = parseArrowShape(prop, value);
      break;
    case 'source-arrow-color':
      computed.sourceArrowColor = parseColor(prop, value);
      break;
    case 'arrow-scale': {
      const scale = parseNumber(prop, value);

      if (scale <= 0) {
        throw new Error(`The arrow-scale '${String(value)}' must be positive`);
      }

      computed.arrowScale = scale;
      break;
    }
    case 'source-arrow-fill':
      computed.sourceArrowFill = parseArrowFill(value);
      break;
    case 'target-arrow-fill':
      computed.targetArrowFill = parseArrowFill(value);
      break;
    case 'source-arrow-width':
      computed.sourceArrowWidth = parseArrowWidth(prop, value);
      break;
    case 'target-arrow-width':
      computed.targetArrowWidth = parseArrowWidth(prop, value);
      break;
    case 'target-arrow-color':
      computed.targetArrowColor = parseColor(prop, value);
      break;
    case 'mid-source-arrow-shape':
      computed.midSourceArrowShape = parseArrowShape(prop, value);
      break;
    case 'mid-target-arrow-shape':
      computed.midTargetArrowShape = parseArrowShape(prop, value);
      break;
    case 'mid-source-arrow-color':
      computed.midSourceArrowColor = parseColor(prop, value);
      break;
    case 'mid-target-arrow-color':
      computed.midTargetArrowColor = parseColor(prop, value);
      break;
    case 'curve-style':
      computed.curveStyle = parseCurveStyle(value);
      break;
    case 'control-point-step-size':
      computed.controlPointStepSize = parseNumber(prop, value);
      break;
    case 'control-point-weight':
      computed.controlPointWeight = parseNumber(prop, value);
      break;
    case 'loop-direction':
      computed.loopDirection = parseAngle(prop, value);
      break;
    case 'loop-sweep':
      computed.loopSweep = parseAngle(prop, value);
      break;
    case 'control-point-distances':
      computed.controlPointDistances = parseNumberList(prop, value);
      break;
    case 'control-point-weights':
      computed.controlPointWeights = parseNumberList(prop, value);
      break;
    case 'segment-distances':
      computed.segmentDistances = parseNumberList(prop, value);
      break;
    case 'segment-weights':
      computed.segmentWeights = parseNumberList(prop, value);
      break;
    case 'segment-radii':
      computed.segmentRadii = parseNumberList(prop, value);
      break;
    case 'radius-type':
      computed.radiusTypes = parseRadiusTypes(prop, value);
      break;
    case 'edge-distances':
      computed.edgeDistances = parseEdgeDistances(value);
      break;
    case 'taxi-direction':
      computed.taxiDirection = parseTaxiDirection(value);
      break;
    case 'taxi-turn': {
      const turn = parseTaxiTurn(value);

      computed.taxiTurn = turn.value;
      computed.taxiTurnPercent = turn.percent;
      break;
    }
    case 'taxi-turn-min-distance':
      computed.taxiTurnMinDistance = parseNumber(prop, value);
      break;
    case 'taxi-radius':
      computed.taxiRadius = parseNumber(prop, value);
      break;
    case 'haystack-radius': {
      const radius = parseNumber(prop, value);

      if (radius < 0 || radius > 1) {
        throw new Error(
          `The haystack-radius '${String(value)}' must be within [0, 1]`,
        );
      }

      computed.haystackRadius = radius;
      break;
    }
    case 'source-endpoint':
      computed.sourceEndpoint = parseEndpoint(prop, value);
      break;
    case 'target-endpoint':
      computed.targetEndpoint = parseEndpoint(prop, value);
      break;
    case 'source-distance-from-node':
      computed.sourceDistanceFromNode = parseNonNegative(prop, value);
      break;
    case 'target-distance-from-node':
      computed.targetDistanceFromNode = parseNonNegative(prop, value);
      break;

    // background images (round 15.2); per-image props accept scalars or
    // arrays (v3's multiple: true), distributing last-value-repeats
    case 'background-image':
      computed.backgroundImage = parseUrls(prop, value);
      break;
    case 'background-fit':
      computed.backgroundFit = parseImageList(
        prop,
        value,
        parseImageEnum(prop, BG_FITS),
      );
      break;
    case 'background-image-opacity':
      computed.backgroundImageOpacity = parseImageList(prop, value, (v) => {
        const op = parseNumber(prop, v);

        if (op < 0 || op > 1) {
          throw new Error(`The ${prop} '${String(v)}' must be within [0, 1]`);
        }

        return op;
      });
      break;
    case 'background-position-x':
      computed.backgroundPositionX = parseImageList(
        prop,
        value,
        parseBgLen(prop),
      );
      break;
    case 'background-position-y':
      computed.backgroundPositionY = parseImageList(
        prop,
        value,
        parseBgLen(prop),
      );
      break;
    case 'background-offset-x':
      computed.backgroundOffsetX = parseImageList(
        prop,
        value,
        parseBgLen(prop),
      );
      break;
    case 'background-offset-y':
      computed.backgroundOffsetY = parseImageList(
        prop,
        value,
        parseBgLen(prop),
      );
      break;
    case 'background-width':
      computed.backgroundWidth = parseImageList(prop, value, parseBgSize(prop));
      break;
    case 'background-height':
      computed.backgroundHeight = parseImageList(
        prop,
        value,
        parseBgSize(prop),
      );
      break;
    case 'background-repeat':
      computed.backgroundRepeat = parseImageList(
        prop,
        value,
        parseImageEnum(prop, BG_REPEATS),
      );
      break;
    case 'background-clip':
      computed.backgroundClip = parseImageList(
        prop,
        value,
        parseImageEnum(prop, BG_CLIPS),
      );
      break;
    case 'background-image-containment':
      computed.backgroundImageContainment = parseImageList(
        prop,
        value,
        parseImageEnum(prop, BG_CONTAINMENTS),
      );
      break;
    case 'background-image-smoothing':
      computed.backgroundImageSmoothing = parseImageList(prop, value, (v) =>
        parseYesNo(prop, v),
      );
      break;
    case 'background-image-type':
      computed.backgroundImageType = parseImageList(
        prop,
        value,
        parseImageEnum(prop, IMAGE_TYPES),
      );
      break;
    case 'background-image-color':
      computed.backgroundImageColor = parseColor(prop, value);
      break;
    case 'background-image-crossorigin': {
      const co = String(value);

      if (!BG_CROSSORIGINS.has(co)) {
        throw new Error(
          `The ${prop} '${co}' is unsupported; use anonymous, use-credentials or null`,
        );
      }

      computed.backgroundImageCrossorigin = co;
      break;
    }
    case 'background-width-relative-to':
    case 'background-height-relative-to':
      throw new Error(
        `'${prop}' is not supported in the GPU prototype: a compound parent's stored ` +
          `size is already the padded box (v3's include-padding default), and leaves have no padding`,
      );

    default:
      throw new Error(
        `The style property '${prop}' is unsupported in the GPU prototype`,
      );
  }
};

/**
 * The per-group prop guards, extracted from `resolveConst` (round 63.2)
 * so the bypass parser and the sheet compiler reject a wrong-group or
 * malformed prop with one set of messages.  Assignment-free: throws or
 * returns.
 *
 * @param group — the group the prop is being resolved for
 * @param norm — the normalized (dash-case) prop name
 * @param value — the raw sheet value (mapper specs included; the
 *   `text-rotation` and font guards test it directly)
 * @throws when the prop belongs to the other group, to the parents
 *   group, or is a global font prop given a mapper
 */
const assertGroupProp = (
  group: GroupName,
  norm: string,
  value: unknown,
): void => {
  if (COMPOUND_PROPS.has(norm)) {
    // round 14.6: the compound props live in the parents sheet group
    // (they are auto-bounds inputs, split out before this resolve)
    throw new Error(
      `The style property '${norm}' belongs to the parents group`,
    );
  }

  if (END_LABEL_PROPS.has(norm) && group === 'nodes') {
    throw new Error(`'${norm}' is an edge style property`);
  }

  // the raw sheet value may be a mapper object here, so test the
  // keyword directly rather than parsing
  if (norm === 'text-rotation' && group === 'nodes' && value === 'autorotate') {
    // 27.7: numeric rotations now work on node labels; `autorotate`
    // is still an edge concept — it resolves from the edge's slope,
    // and a node has none
    throw new Error(
      `text-rotation 'autorotate' is edge-only; nodes take a number of radians`,
    );
  }

  if (CURVE_PROPS.has(norm) && group === 'nodes') {
    throw new Error(`'${norm}' is an edge style property`);
  }

  if (
    (GHOST_PROPS.has(norm) ||
      LAYER_SHAPE_PROPS.has(norm) ||
      NODE_ONLY_EXTRA.has(norm) ||
      IMAGE_PROPS.has(norm) ||
      CHART_PROPS.has(norm)) &&
    group === 'edges'
  ) {
    throw new Error(`'${norm}' is a node style property`);
  }

  if (GLOBAL_FONT_PROPS.has(norm)) {
    // one glyph atlas keyed by character ⇒ one font face, globally
    if (group === 'edges') {
      throw new Error(
        `'${norm}' is a node style property (labels are node-only)`,
      );
    }

    if (isMapperSpec(value)) {
      throw new Error(
        `'${norm}' takes a constant only — per-element fonts are unsupported ` +
          `(the glyph atlas holds one font)`,
      );
    }
  }
};

/**
 * One id's bypass, resolved for one group: the `Computed` fields its
 * props assign, captured once at parse time (round 63.2) so the write
 * funnel's merge is field copies with no per-write parsing.
 */
type BypassPatch = readonly (readonly [string, unknown])[];

/**
 * Parse a bypass entry's props for one group into a `BypassPatch`.
 * Sound because `applyProp` only ever *assigns* parsed values into
 * `computed` (no case reads a sibling field — checked at 63.2), so a
 * bare scratch object's own keys are exactly the fields the props
 * touch — including a value that happens to equal the channel default,
 * which a diff-against-defaults capture would silently drop.
 *
 * @param group — the group to resolve against ('width' parses per group)
 * @param props — normalized prop name → raw constant value
 * @returns the captured field pairs, ready for `mergeBypass`
 * @throws on a mapper value (bypasses are constants-only), a global
 *   font prop (one atlas, one font — there is no per-element font to
 *   bypass to), a transition config prop (engine config, not a
 *   channel), a wrong-group prop, or an invalid value
 */
const captureBypassPatch = (
  group: GroupName,
  props: Record<string, unknown>,
): BypassPatch => {
  const scratch = {} as Computed;

  for (const norm of Object.keys(props)) {
    const value = props[norm];

    if (isMapperSpec(value)) {
      throw new Error(
        `A bypass value must be a constant; '${norm}' got a mapper — ` +
          `mappers belong in the sheet's group blocks`,
      );
    }

    if (GLOBAL_FONT_PROPS.has(norm)) {
      throw new Error(
        `'${norm}' is global (the glyph atlas holds one font) and cannot ` +
          `be bypassed per element`,
      );
    }

    if (TRANSITION_CONFIG_PROPS.has(norm)) {
      throw new Error(
        `'${norm}' is per-group engine config, not a channel — set it in ` +
          `the sheet's group block`,
      );
    }

    assertGroupProp(group, norm, value);
    applyProp(scratch, norm, value);
  }

  return Object.entries(scratch);
};

/** background-image props are node-only (round 15.2). */
const IMAGE_PROPS: ReadonlySet<string> = new Set([
  'background-image',
  'background-fit',
  'background-image-opacity',
  'background-position-x',
  'background-position-y',
  'background-offset-x',
  'background-offset-y',
  'background-width',
  'background-height',
  'background-repeat',
  'background-clip',
  'background-image-containment',
  'background-image-smoothing',
  'background-image-crossorigin',
  'background-image-type',
  'background-image-color',
]);

/** the recorded multi-image cap (a fixed FS compositing loop) */
const IMAGE_CAP = 4;

const ARROW_ENUM: Record<string, number> = {
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
const ARROW_NAMES: Record<number, ArrowShape> = {
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
const COMPOUND_ARROWS: ReadonlySet<number> = new Set([
  ARROW_TRIANGLE_TEE,
  ARROW_CIRCLE_TRIANGLE,
  ARROW_TRIANGLE_CROSS,
]);

/** How a mapped prop lands on the computed record. */
interface MappableChannel {
  kind: ChannelKind;
  groups: readonly GroupName[];
  parseEnum?: (value: unknown) => number | null;
  set: (computed: Computed, value: Evaluated) => void;
  default: (group: GroupName) => Evaluated;
  /**
   * String-interning enum channel (round 15.2): range/then/data values
   * are arbitrary strings (urls) interned per compile into an index
   * table; the bound channel's set() maps the evaluated index back.
   * Only discrete programs make sense (continuous already throws on
   * enum kinds).
   */
  intern?: boolean;
}

/** Mapper-capable props ('label' rides the labelKey channel instead). */
const MAPPABLE: Record<string, MappableChannel> = {
  'background-color': {
    kind: 'color',
    groups: ['nodes'],
    set: (c, v) => {
      c.fillColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.fillColor,
  },
  'border-color': {
    kind: 'color',
    groups: ['nodes'],
    set: (c, v) => {
      c.borderColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.borderColor,
  },
  width: {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.width = v as number;
    },
    default: (group) =>
      group === 'nodes' ? NODE_DEFAULTS.width : EDGE_DEFAULTS.width,
  },
  height: {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.height = v as number;
    },
    default: () => NODE_DEFAULTS.height,
  },
  'border-width': {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.borderWidth = v as number;
    },
    default: () => NODE_DEFAULTS.borderWidth,
  },
  opacity: {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.opacity = v as number;
    },
    default: () => NODE_DEFAULTS.opacity,
  },
  shape: {
    kind: 'enum',
    groups: ['nodes'],
    parseEnum: (v) => SHAPES[String(v)] ?? null,
    set: (c, v) => {
      c.shape = v as number;
    },
    default: () => NODE_DEFAULTS.shape,
  },
  'font-size': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.fontSize = v as number;
    },
    default: () => NODE_DEFAULTS.fontSize,
  },
  'min-zoomed-font-size': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.minZoomedFontSize = v as number;
    },
    default: () => NODE_DEFAULTS.minZoomedFontSize,
  },
  'text-halign': {
    kind: 'enum',
    groups: ['nodes'],
    parseEnum: (v) => HALIGNS[String(v)] ?? null,
    set: (c, v) => {
      c.textHalign = v as number;
    },
    default: () => NODE_DEFAULTS.textHalign,
  },
  'text-valign': {
    kind: 'enum',
    groups: ['nodes'],
    parseEnum: (v) => VALIGNS[String(v)] ?? null,
    set: (c, v) => {
      c.textValign = v as number;
    },
    default: () => NODE_DEFAULTS.textValign,
  },
  color: {
    kind: 'color',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.textColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.textColor,
  },
  'text-outline-width': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.textOutlineWidth = v as number;
    },
    default: () => NODE_DEFAULTS.textOutlineWidth,
  },
  'text-outline-color': {
    kind: 'color',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.textOutlineColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.textOutlineColor,
  },
  'text-outline-opacity': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.textOutlineOpacity = v as number;
    },
    default: () => NODE_DEFAULTS.textOutlineOpacity,
  },
  'text-background-color': {
    kind: 'color',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.textBgColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.textBgColor,
  },
  'text-background-opacity': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.textBgOpacity = v as number;
    },
    default: () => NODE_DEFAULTS.textBgOpacity,
  },
  'text-background-padding': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.textBgPadding = v as number;
    },
    default: () => NODE_DEFAULTS.textBgPadding,
  },
  'text-margin-x': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.textMarginX = v as number;
    },
    default: () => NODE_DEFAULTS.textMarginX,
  },
  'text-margin-y': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.textMarginY = v as number;
    },
    default: () => NODE_DEFAULTS.textMarginY,
  },
  'text-rotation': {
    // 27.7: nodes joined edges here — v3 allows a numeric rotation on any
    // label, while `autorotate` stays edge-only (it needs a slope)
    kind: 'enum',
    groups: ['nodes', 'edges'],
    parseEnum: (v) => {
      try {
        return parseTextRotation(v);
      } catch {
        return null;
      }
    },
    set: (c, v) => {
      c.textRotation = v as number;
    },
    default: (group) =>
      group === 'nodes'
        ? NODE_DEFAULTS.textRotation
        : EDGE_DEFAULTS.textRotation,
  },
  'source-text-offset': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.sourceTextOffset = v as number;
    },
    default: () => EDGE_DEFAULTS.sourceTextOffset,
  },
  'target-text-offset': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.targetTextOffset = v as number;
    },
    default: () => EDGE_DEFAULTS.targetTextOffset,
  },
  'source-text-margin-x': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.sourceTextMarginX = v as number;
    },
    default: () => EDGE_DEFAULTS.sourceTextMarginX,
  },
  'source-text-margin-y': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.sourceTextMarginY = v as number;
    },
    default: () => EDGE_DEFAULTS.sourceTextMarginY,
  },
  'target-text-margin-x': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.targetTextMarginX = v as number;
    },
    default: () => EDGE_DEFAULTS.targetTextMarginX,
  },
  'target-text-margin-y': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.targetTextMarginY = v as number;
    },
    default: () => EDGE_DEFAULTS.targetTextMarginY,
  },
  'source-text-rotation': {
    kind: 'enum',
    groups: ['edges'],
    parseEnum: (v) => {
      try {
        return parseTextRotation(v);
      } catch {
        return null;
      }
    },
    set: (c, v) => {
      c.sourceTextRotation = v as number;
    },
    default: () => EDGE_DEFAULTS.sourceTextRotation,
  },
  'target-text-rotation': {
    kind: 'enum',
    groups: ['edges'],
    parseEnum: (v) => {
      try {
        return parseTextRotation(v);
      } catch {
        return null;
      }
    },
    set: (c, v) => {
      c.targetTextRotation = v as number;
    },
    default: () => EDGE_DEFAULTS.targetTextRotation,
  },
  'line-color': {
    kind: 'color',
    groups: ['edges'],
    set: (c, v) => {
      c.lineColor = v as RGBA;
    },
    default: () => EDGE_DEFAULTS.lineColor,
  },
  'line-style': {
    kind: 'enum',
    groups: ['edges'],
    parseEnum: (v) => LINE_STYLES[String(v)] ?? null,
    set: (c, v) => {
      c.lineStyle = v as number;
    },
    default: () => EDGE_DEFAULTS.lineStyle,
  },
  'source-arrow-color': {
    kind: 'color',
    groups: ['edges'],
    set: (c, v) => {
      c.sourceArrowColor = v as RGBA;
    },
    default: () => EDGE_DEFAULTS.sourceArrowColor,
  },
  'target-arrow-color': {
    kind: 'color',
    groups: ['edges'],
    set: (c, v) => {
      c.targetArrowColor = v as RGBA;
    },
    default: () => EDGE_DEFAULTS.targetArrowColor,
  },
  'curve-style': {
    kind: 'enum',
    groups: ['edges'],
    parseEnum: (v) => CURVE_STYLES[String(v)] ?? null,
    set: (c, v) => {
      c.curveStyle = v as number;
    },
    default: () => EDGE_DEFAULTS.curveStyle,
  },
  'control-point-step-size': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.controlPointStepSize = v as number;
    },
    default: () => EDGE_DEFAULTS.controlPointStepSize,
  },
  'control-point-weight': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.controlPointWeight = v as number;
    },
    default: () => EDGE_DEFAULTS.controlPointWeight,
  },
  'loop-direction': {
    kind: 'number',
    groups: ['edges'], // mapped values are radians
    set: (c, v) => {
      c.loopDirection = v as number;
    },
    default: () => EDGE_DEFAULTS.loopDirection,
  },
  'loop-sweep': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.loopSweep = v as number;
    },
    default: () => EDGE_DEFAULTS.loopSweep,
  },
  // 12b scalar/enum curve props are mapper-capable like 12a's; the list
  // props (control-point-distances/-weights, segment-*, radius-type)
  // take constants only — a mapper value is one number/keyword, not a
  // list (a recorded 12b scope note)
  'edge-distances': {
    kind: 'enum',
    groups: ['edges'],
    parseEnum: (v) => EDGE_DISTANCES[String(v)] ?? null,
    set: (c, v) => {
      c.edgeDistances = v as number;
    },
    default: () => EDGE_DEFAULTS.edgeDistances,
  },
  'taxi-direction': {
    kind: 'enum',
    groups: ['edges'],
    parseEnum: (v) => TAXI_DIRECTIONS[String(v)] ?? null,
    set: (c, v) => {
      c.taxiDirection = v as number;
    },
    default: () => EDGE_DEFAULTS.taxiDirection,
  },
  'taxi-turn': {
    // mapped turns are px (a percent turn is constant-only); a missing
    // value falls back to the default fraction as px — set an explicit
    // mapper fallback to control this
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.taxiTurn = v as number;
      c.taxiTurnPercent = false;
    },
    default: () => EDGE_DEFAULTS.taxiTurn,
  },
  'taxi-turn-min-distance': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.taxiTurnMinDistance = v as number;
    },
    default: () => EDGE_DEFAULTS.taxiTurnMinDistance,
  },
  'taxi-radius': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.taxiRadius = v as number;
    },
    default: () => EDGE_DEFAULTS.taxiRadius,
  },
  // B5 node outline (solid ring outside the border)
  'outline-color': {
    kind: 'color',
    groups: ['nodes'],
    set: (c, v) => {
      c.outlineColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.outlineColor,
  },
  'outline-opacity': {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.outlineOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => NODE_DEFAULTS.outlineOpacity,
  },
  'outline-width': {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.outlineWidth = Math.max(0, v as number);
    },
    default: () => NODE_DEFAULTS.outlineWidth,
  },
  'outline-offset': {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.outlineOffset = Math.max(0, v as number);
    },
    default: () => NODE_DEFAULTS.outlineOffset,
  },
  // B2 border/corner geometry (CPU-evaluated; the pick replica reads it)
  'corner-radius': {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.cornerRadius = Math.max(0, v as number);
    },
    default: () => NODE_DEFAULTS.cornerRadius,
  },
  'border-position': {
    kind: 'enum',
    groups: ['nodes'],
    parseEnum: (v) => BORDER_POSITIONS[String(v)] ?? null,
    set: (c, v) => {
      c.borderPosition = v as number;
    },
    default: () => NODE_DEFAULTS.borderPosition,
  },
  'border-style': {
    kind: 'enum',
    groups: ['nodes'],
    parseEnum: (v) => STROKE_STYLES[String(v)] ?? null,
    set: (c, v) => {
      c.borderStyle = v as number;
    },
    default: () => NODE_DEFAULTS.borderStyle,
  },
  'outline-style': {
    kind: 'enum',
    groups: ['nodes'],
    parseEnum: (v) => STROKE_STYLES[String(v)] ?? null,
    set: (c, v) => {
      c.outlineStyle = v as number;
    },
    default: () => NODE_DEFAULTS.outlineStyle,
  },
  'border-dash-offset': {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.borderDashOffset = v as number;
    },
    default: () => NODE_DEFAULTS.borderDashOffset,
  },
  // B6 label box props
  'text-transform': {
    kind: 'enum',
    groups: ['nodes', 'edges'],
    parseEnum: (v) => TEXT_TRANSFORMS[String(v)] ?? null,
    set: (c, v) => {
      c.textTransform = v as number;
    },
    default: () => NODE_DEFAULTS.textTransform,
  },
  'text-background-shape': {
    kind: 'enum',
    groups: ['nodes', 'edges'],
    parseEnum: (v) => TEXT_BG_SHAPES[String(v)] ?? null,
    set: (c, v) => {
      c.textBgShape = v as number;
    },
    default: () => NODE_DEFAULTS.textBgShape,
  },
  // the wrap family (16.2): scalar/enum forms are mapper-capable like
  // every other label channel (CPU-evaluated, the sidecar tier)
  'text-wrap': {
    kind: 'enum',
    groups: ['nodes', 'edges'],
    parseEnum: (v) => TEXT_WRAPS[String(v)] ?? null,
    set: (c, v) => {
      c.textWrap = v as number;
    },
    default: () => NODE_DEFAULTS.textWrap,
  },
  'text-max-width': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.textMaxWidth = Math.max(0, v as number);
    },
    default: () => NODE_DEFAULTS.textMaxWidth,
  },
  'line-height': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.lineHeight = Math.max(0, v as number);
    },
    default: () => NODE_DEFAULTS.lineHeight,
  },
  'text-overflow-wrap': {
    kind: 'enum',
    groups: ['nodes', 'edges'],
    parseEnum: (v) => OFLOW_WRAPS[String(v)] ?? null,
    set: (c, v) => {
      c.textOverflowWrap = v as number;
    },
    default: () => NODE_DEFAULTS.textOverflowWrap,
  },
  'text-justification': {
    kind: 'enum',
    groups: ['nodes', 'edges'],
    parseEnum: (v) => JUSTIFICATIONS[String(v)] ?? null,
    set: (c, v) => {
      c.textJustification = v as number;
    },
    default: () => NODE_DEFAULTS.textJustification,
  },
  'text-border-width': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.textBorderWidth = Math.max(0, v as number);
    },
    default: () => NODE_DEFAULTS.textBorderWidth,
  },
  'text-border-color': {
    kind: 'color',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.textBorderColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.textBorderColor,
  },
  'text-border-opacity': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.textBorderOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => NODE_DEFAULTS.textBorderOpacity,
  },
  // C2 gradient enums (stop lists stay constants-only)
  'background-fill': {
    kind: 'enum',
    groups: ['nodes'],
    parseEnum: (v) => FILL_KINDS[String(v)] ?? null,
    set: (c, v) => {
      c.backgroundFill = v as number;
    },
    default: () => NODE_DEFAULTS.backgroundFill,
  },
  'background-gradient-direction': {
    kind: 'enum',
    groups: ['nodes'],
    parseEnum: (v) => GRADIENT_DIRECTIONS[String(v)] ?? null,
    set: (c, v) => {
      c.backgroundGradientDirection = v as number;
    },
    default: () => NODE_DEFAULTS.backgroundGradientDirection,
  },
  'line-fill': {
    kind: 'enum',
    groups: ['edges'],
    parseEnum: (v) => FILL_KINDS[String(v)] ?? null,
    set: (c, v) => {
      c.lineFill = v as number;
    },
    default: () => EDGE_DEFAULTS.lineFill,
  },
  // C1 mid arrows
  'mid-source-arrow-shape': {
    kind: 'enum',
    groups: ['edges'],
    parseEnum: (v) => ARROW_ENUM[String(v)] ?? null,
    set: (c, v) => {
      c.midSourceArrowShape = ARROW_NAMES[v as number] ?? 'none';
    },
    default: () => 0,
  },
  'mid-target-arrow-shape': {
    kind: 'enum',
    groups: ['edges'],
    parseEnum: (v) => ARROW_ENUM[String(v)] ?? null,
    set: (c, v) => {
      c.midTargetArrowShape = ARROW_NAMES[v as number] ?? 'none';
    },
    default: () => 0,
  },
  'mid-source-arrow-color': {
    kind: 'color',
    groups: ['edges'],
    set: (c, v) => {
      c.midSourceArrowColor = v as RGBA;
    },
    default: () => EDGE_DEFAULTS.midSourceArrowColor,
  },
  'mid-target-arrow-color': {
    kind: 'color',
    groups: ['edges'],
    set: (c, v) => {
      c.midTargetArrowColor = v as RGBA;
    },
    default: () => EDGE_DEFAULTS.midTargetArrowColor,
  },
  // B7 arrow scalars (arrow widths are constants: keyword/% forms)
  'arrow-scale': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.arrowScale = Math.max(0.0625, v as number);
    },
    default: () => EDGE_DEFAULTS.arrowScale,
  },
  'source-arrow-fill': {
    kind: 'enum',
    groups: ['edges'],
    parseEnum: (v) => ARROW_FILLS[String(v)] ?? null,
    set: (c, v) => {
      c.sourceArrowFill = v as number;
    },
    default: () => EDGE_DEFAULTS.sourceArrowFill,
  },
  'target-arrow-fill': {
    kind: 'enum',
    groups: ['edges'],
    parseEnum: (v) => ARROW_FILLS[String(v)] ?? null,
    set: (c, v) => {
      c.targetArrowFill = v as number;
    },
    default: () => EDGE_DEFAULTS.targetArrowFill,
  },
  // B4 line-outline casing
  'line-outline-width': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.lineOutlineWidth = Math.max(0, v as number);
    },
    default: () => EDGE_DEFAULTS.lineOutlineWidth,
  },
  'line-outline-color': {
    kind: 'color',
    groups: ['edges'],
    set: (c, v) => {
      c.lineOutlineColor = v as RGBA;
    },
    default: () => EDGE_DEFAULTS.lineOutlineColor,
  },
  // B3 dash props (pattern is a constants-only list)
  'line-cap': {
    kind: 'enum',
    groups: ['edges'],
    parseEnum: (v) => LINE_CAPS[String(v)] ?? null,
    set: (c, v) => {
      c.lineCap = v as number;
    },
    default: () => EDGE_DEFAULTS.lineCap,
  },
  'line-dash-offset': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.lineDashOffset = v as number;
    },
    default: () => EDGE_DEFAULTS.lineDashOffset,
  },
  // the B1 opacity split (CPU-evaluated; folds at write time)
  'background-opacity': {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.backgroundOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => NODE_DEFAULTS.backgroundOpacity,
  },
  'border-opacity': {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.borderOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => NODE_DEFAULTS.borderOpacity,
  },
  'line-opacity': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.lineOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => EDGE_DEFAULTS.lineOpacity,
  },
  'text-opacity': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.textOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => NODE_DEFAULTS.textOpacity,
  },
  // events (round 20.2): pointer transparency, both groups
  events: {
    kind: 'enum',
    groups: ['nodes', 'edges'],
    parseEnum: (v) =>
      v === 'yes' || v === true ? 1 : v === 'no' || v === false ? 0 : null,
    set: (c, v) => {
      c.eventsEnabled = (v as number) === 1;
    },
    default: () => 1,
  },
  // visibility (round 22): paint-only invisibility, both groups
  visibility: {
    kind: 'enum',
    groups: ['nodes', 'edges'],
    parseEnum: (v) => (v === 'hidden' ? 1 : v === 'visible' ? 0 : null),
    set: (c, v) => {
      c.invisible = (v as number) === 1;
    },
    default: () => 0,
  },
  // chart (round 23): the kind and opacity take mappers; every other
  // chart prop is constants-only (list/config props, the 12b rule)
  chart: {
    kind: 'enum',
    groups: ['nodes'],
    parseEnum: (v) =>
      v === 'none'
        ? CHART_NONE
        : v === 'pie'
          ? CHART_PIE
          : v === 'stripes'
            ? CHART_STRIPES
            : null,
    set: (c, v) => {
      c.chartKind = v as number;
    },
    default: () => CHART_NONE,
  },
  'chart-opacity': {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.chartOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => 1,
  },
  'chart-size': {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.chartSize = Math.max(0, Math.min(1, v as number));
    },
    default: () => 1,
  },
  'chart-hole': {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.chartHole = Math.max(0, Math.min(1, v as number));
    },
    default: () => 0,
  },
  'chart-start-angle': {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.chartStartAngle = v as number;
    },
    default: () => 0,
  },
  'chart-direction': {
    kind: 'enum',
    groups: ['nodes'],
    parseEnum: (v) => (v === 'vertical' ? 0 : v === 'horizontal' ? 1 : null),
    set: (c, v) => {
      c.chartDirection = v as number;
    },
    default: () => 0,
  },
  // text-events (round 20.3): the label box picks the node; node-only
  'text-events': {
    kind: 'enum',
    groups: ['nodes'],
    parseEnum: (v) =>
      v === 'yes' || v === true ? 1 : v === 'no' || v === false ? 0 : null,
    set: (c, v) => {
      c.textEvents = (v as number) === 1;
    },
    default: () => 0,
  },
  // ghost props (round 13 A1; node-only)
  ghost: {
    kind: 'enum',
    groups: ['nodes'],
    parseEnum: (v) =>
      v === 'yes' || v === true ? 1 : v === 'no' || v === false ? 0 : null,
    set: (c, v) => {
      c.ghost = (v as number) === 1;
    },
    default: () => (NODE_DEFAULTS.ghost ? 1 : 0),
  },
  'ghost-offset-x': {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.ghostOffsetX = v as number;
    },
    default: () => NODE_DEFAULTS.ghostOffsetX,
  },
  'ghost-offset-y': {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.ghostOffsetY = v as number;
    },
    default: () => NODE_DEFAULTS.ghostOffsetY,
  },
  'ghost-opacity': {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.ghostOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => NODE_DEFAULTS.ghostOpacity,
  },
  // overlay/underlay props (round 13 A2; node-only)
  'overlay-color': {
    kind: 'color',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.overlayColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.overlayColor,
  },
  'overlay-opacity': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.overlayOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => NODE_DEFAULTS.overlayOpacity,
  },
  'overlay-padding': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.overlayPadding = Math.max(0, v as number);
    },
    default: () => NODE_DEFAULTS.overlayPadding,
  },
  'underlay-color': {
    kind: 'color',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.underlayColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.underlayColor,
  },
  'underlay-opacity': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.underlayOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => NODE_DEFAULTS.underlayOpacity,
  },
  'underlay-padding': {
    kind: 'number',
    groups: ['nodes', 'edges'],
    set: (c, v) => {
      c.underlayPadding = Math.max(0, v as number);
    },
    default: () => NODE_DEFAULTS.underlayPadding,
  },
  // 12c scalar curve props (source/target-endpoint stays constants-only:
  // its point form is a list, per the 12b list-prop scope rule)
  'haystack-radius': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.haystackRadius = Math.max(0, Math.min(1, v as number));
    },
    default: () => EDGE_DEFAULTS.haystackRadius,
  },
  'source-distance-from-node': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.sourceDistanceFromNode = Math.max(0, v as number);
    },
    default: () => EDGE_DEFAULTS.sourceDistanceFromNode,
  },
  'target-distance-from-node': {
    kind: 'number',
    groups: ['edges'],
    set: (c, v) => {
      c.targetDistanceFromNode = Math.max(0, v as number);
    },
    default: () => EDGE_DEFAULTS.targetDistanceFromNode,
  },
  'source-arrow-shape': {
    kind: 'enum',
    groups: ['edges'],
    parseEnum: (v) => ARROW_ENUM[String(v)] ?? null,
    set: (c, v) => {
      c.sourceArrowShape = ARROW_NAMES[v as number] ?? 'none';
    },
    default: () => 0,
  },
  'target-arrow-shape': {
    kind: 'enum',
    groups: ['edges'],
    parseEnum: (v) => ARROW_ENUM[String(v)] ?? null,
    set: (c, v) => {
      c.targetArrowShape = ARROW_NAMES[v as number] ?? 'none';
    },
    default: () => 0,
  },
  // background images (round 15.2): the three mapper-capable single
  // forms; every other image prop is a constants-only list (the 12b
  // scope rule).  The url channel interns strings per compile —
  // set() is wrapped in compileChannel with the intern table.
  'background-image': {
    kind: 'enum',
    groups: ['nodes'],
    intern: true,
    set: () => {
      /* wrapped per compile */
    },
    default: () => 0, // 0 = none in the intern index space
  },
  'background-image-opacity': {
    kind: 'number',
    groups: ['nodes'],
    set: (c, v) => {
      c.backgroundImageOpacity = [Math.max(0, Math.min(1, v as number))];
    },
    default: () => 1,
  },
  'background-image-color': {
    kind: 'color',
    groups: ['nodes'],
    set: (c, v) => {
      c.backgroundImageColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.backgroundImageColor,
  },
};

/** A compiled mapper bound to its target channel. */
interface BoundMapper {
  m: CompiledMapper;
  channel: MappableChannel;
}

/**
 * The state bits a group's mappers read, when they read *nothing else* —
 * else null.  See `GroupDef.partition` for why the distinction earns its
 * place.
 *
 * The test is deliberately strict.  One data-driven mapper in the group
 * puts it back on the per-element path anyway, so there is nothing to
 * win by partitioning the rest; and a `case` mixing a state condition
 * with a data one has a value that varies per element by definition.
 */
const partitionOf = (
  mappers: readonly BoundMapper[],
): GroupDef['partition'] => {
  let mask = 0;

  for (const bm of mappers) {
    const bits = stateOnlyMask(bm);

    if (bits === 0) {
      return null;
    }

    mask |= bits;
  }

  return mask === 0 ? null : { mask, records: new Map(), diffs: new Map() };
};

/**
 * The state bits one mapper reads, when it reads *nothing else* — else 0.
 *
 * A `case` over conditions alone has a value determined by
 * `flags & mask`, which is what lets both the group-wide partition above
 * and `applyMapped`'s per-mapper hoist evaluate it once per distinct
 * word rather than once per element.  A `case` mixing a state condition
 * with a data one varies per element by definition, and answers 0.
 */
const stateOnlyMask = (bm: BoundMapper): number => {
  if (bm.m.program.kind !== 'case') {
    return 0;
  }

  let mask = 0;

  for (const key of bm.m.keys) {
    const bit = CONDITION_FLAGS[key];

    if (bit == null) {
      return 0;
    }

    mask |= bit;
  }

  return mask;
};

/** A bound mapper's channel writer plus its slot evaluator. */
interface Evaluator {
  set: (computed: Computed, value: Evaluated) => void;
  ev: (slot: number) => Evaluated;
}

/** Evaluated-value equality for the round-61 partition diff: colours
 * evaluate to RGBA arrays, everything else to scalars/strings. */
const evaluatedEq = (a: Evaluated, b: Evaluated): boolean =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((v, i) => v === b[i])
    : a === b;

/**
 * Paint channels: props whose stored bytes no CPU path reads back except
 * the style getters — the GPU-eligible half of the mapper split.  (The
 * geometry channels — size, border-width, shape, edge width — feed
 * culling, CPU picking and columnar scans, so they stay CPU-evaluated.)
 */
const PAINT_PROPS: Record<GroupName, ReadonlySet<string>> = {
  nodes: new Set(['background-color', 'border-color', 'opacity']),
  edges: new Set([
    'line-color',
    'opacity',
    'source-arrow-color',
    'target-arrow-color',
    'source-arrow-shape',
    'target-arrow-shape',
  ]),
};

/**
 * The constant channel opacity that folds into a colour prop's stored
 * alpha (round 66.3), so a kernel program can apply the same factor the
 * CPU write path does.
 *
 * Arrow colours answer 1 here deliberately: their fold is the edge
 * opacity and the packer already resolves it from `paintContext`, which
 * also covers the mapped case the constant path cannot.
 *
 * @param group — the element group the prop belongs to
 * @param prop — the colour prop being packed
 * @param computed — that group's resolved constants
 * @returns the multiplier to fold, or 1 when the channel folds nothing
 */
const constOpacityFor = (
  group: GroupName,
  prop: string,
  computed: Computed,
): number => {
  if (group === 'nodes') {
    return prop === 'background-color'
      ? computed.backgroundOpacity
      : prop === 'border-color'
        ? computed.borderOpacity
        : 1;
  }

  return prop === 'line-color' ? computed.lineOpacity : 1;
};

const compileChannel = (
  group: GroupName,
  prop: string,
  spec: MapperSpec,
): BoundMapper => {
  const channel = MAPPABLE[prop];

  if (channel == null || !channel.groups.includes(group)) {
    throw new Error(
      `The style property '${prop}' does not support mappers` +
        (channel == null ? '' : ` on ${group}`),
    );
  }

  if (channel.intern) {
    // url channel (15.2): intern every string the program can yield
    // (range entries, case `then`s, raw data values on passthrough)
    // into a per-compile table; index 0 is 'none'
    const urls: string[] = [];
    const parseEnum = (v: unknown): number | null => {
      if (v == null) {
        return 0;
      }

      const s = String(v).trim();

      if (s === '' || s === 'none') {
        return 0;
      }

      let i = urls.indexOf(s);

      if (i < 0) {
        urls.push(s);
        i = urls.length - 1;
      }

      return i + 1;
    };

    return {
      m: compileMapper(spec, { kind: 'enum', prop, parseEnum }),
      channel: {
        ...channel,
        set: (c, v) => {
          const idx = v as number;

          c.backgroundImage =
            idx > 0 && idx <= urls.length ? [urls[idx - 1]] : [];
        },
      },
    };
  }

  return {
    m: compileMapper(spec, {
      kind: channel.kind,
      prop,
      parseEnum: channel.parseEnum,
    }),
    channel,
  };
};

/** A per-group stylesheet entry as stored: the resolved base + compiled mappers. */
// -- transitions (round 24.1) --

/** The four transition config props — engine config per sheet group,
 * constants-only, never element channels. */
const TRANSITION_CONFIG_PROPS: ReadonlySet<string> = new Set([
  'transition-property',
  'transition-duration',
  'transition-delay',
  'transition-timing-function',
]);

interface TransitionSpec {
  /** normalized prop names, validated against the group's read set */
  props: readonly string[];
  duration: number;
  delay: number;
  easing: string;
}

/**
 * Where a transitionable prop tweens, per group — the animation system's
 * channel set (discrete props snap at the transition's start; the
 * geometry numerics tween since round 25).  Diffs run on *stored
 * truth*, so channel-opacity folds ride the color they fold into, and
 * `rides` carries the derived columns a main channel's style-write
 * bakes (they tween along only when the main channel moved): the arrow
 * columns for the edge-opacity fold, and the stroke/arrow-width lanes
 * for edge width.  `lane` channels (round 25.3) tween one component of
 * a multi-lane column through the store's cascading `setLane`.
 */
interface TxnChannelDesc {
  column: TweenColumn;
  kind: 'scalar' | 'color' | 'lane' | 'fontSize';
  lane?: number;
  paint: boolean;
  min: number;
  max: number;
}

interface TransitionChannel extends TxnChannelDesc {
  rides?: readonly TxnChannelDesc[];
}

const TRANSITION_CHANNELS: Record<
  GroupName,
  Record<string, TransitionChannel>
> = {
  nodes: {
    opacity: {
      column: 'node.opacity',
      kind: 'scalar',
      paint: true,
      min: 0,
      max: 1,
    },
    'background-color': {
      column: 'node.fillColor',
      kind: 'color',
      paint: true,
      min: -Infinity,
      max: Infinity,
    },
    'border-color': {
      column: 'node.borderColor',
      kind: 'color',
      paint: true,
      min: -Infinity,
      max: Infinity,
    },
    'border-width': {
      column: 'node.borderWidth',
      kind: 'scalar',
      paint: false,
      min: 0,
      max: Infinity,
    },
    // round 25.3: the size lanes.  Parent slots never record (their
    // size is auto-bounds-derived); the lane restore/tick runs the
    // full size cascade (outerHalf, label re-anchor, auto-bounds).
    width: {
      column: 'node.size',
      kind: 'lane',
      lane: 0,
      paint: false,
      min: 0,
      max: Infinity,
    },
    height: {
      column: 'node.size',
      kind: 'lane',
      lane: 1,
      paint: false,
      min: 0,
      max: Infinity,
    },
    // round 25.5: the label sidecar's font-size (a fontSize diff with
    // no sidecar entry on either side never records — the -1 sentinel)
    'font-size': {
      column: 'node.fontSize',
      kind: 'fontSize',
      paint: false,
      min: 0,
      max: Infinity,
    },
  },
  edges: {
    opacity: {
      column: 'edge.opacity',
      kind: 'scalar',
      paint: true,
      min: 0,
      max: 1,
      rides: [
        {
          column: 'edge.sourceArrow',
          kind: 'color',
          paint: true,
          min: -Infinity,
          max: Infinity,
        },
        {
          column: 'edge.targetArrow',
          kind: 'color',
          paint: true,
          min: -Infinity,
          max: Infinity,
        },
      ],
    },
    'line-color': {
      column: 'edge.lineColor',
      kind: 'color',
      paint: true,
      min: -Infinity,
      max: Infinity,
    },
    // round 25.3: width plus its style-write-baked derivatives — the
    // apply pass rewrites them in the same funnel, so stored-truth
    // diffing catches each as a lane ride (moving only when the width
    // itself moved)
    width: {
      column: 'edge.width',
      kind: 'scalar',
      paint: false,
      min: 0,
      max: Infinity,
      rides: [
        {
          column: 'edge.casing',
          kind: 'lane',
          lane: 1,
          paint: false,
          min: 0,
          max: Infinity,
        },
        {
          column: 'edge.overlay',
          kind: 'lane',
          lane: 1,
          paint: false,
          min: 0,
          max: Infinity,
        },
        {
          column: 'edge.underlay',
          kind: 'lane',
          lane: 1,
          paint: false,
          min: 0,
          max: Infinity,
        },
        {
          column: 'edge.arrowWidths',
          kind: 'lane',
          lane: 0,
          paint: false,
          min: 0,
          max: Infinity,
        },
        {
          column: 'edge.arrowWidths',
          kind: 'lane',
          lane: 1,
          paint: false,
          min: 0,
          max: Infinity,
        },
      ],
    },
    'font-size': {
      column: 'edge.fontSize',
      kind: 'fontSize',
      paint: false,
      min: 0,
      max: Infinity,
    },
  },
};

/** Split the transition config props out of a sheet block. */
const splitTransitionProps = (
  props: StyleProps,
): { channels: StyleProps; config: Record<string, unknown> } => {
  let any = false;

  for (const raw of Object.keys(props)) {
    if (TRANSITION_CONFIG_PROPS.has(normalizeProp(raw))) {
      any = true;
      break;
    }
  }

  if (!any) {
    return { channels: props, config: {} };
  }

  const channels: StyleProps = {};
  const config: Record<string, unknown> = {};

  for (const raw of Object.keys(props)) {
    const norm = normalizeProp(raw);

    if (TRANSITION_CONFIG_PROPS.has(norm)) {
      config[norm] = (props as Record<string, unknown>)[raw];
    } else {
      (channels as Record<string, unknown>)[raw] = (
        props as Record<string, unknown>
      )[raw];
    }
  }

  return { channels, config };
};

const parseTransitionSpec = (
  group: GroupName,
  config: Record<string, unknown>,
): TransitionSpec => {
  const readSet = group === 'nodes' ? NODE_READ : EDGE_READ;
  const constOnly = (prop: string, v: unknown): void => {
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      throw new Error(
        `'${prop}' takes constants only (transition config can not be mapped)`,
      );
    }
  };

  let props: string[] = [];
  const rawProps = config['transition-property'];

  constOnly('transition-property', rawProps);

  if (rawProps != null && rawProps !== 'none') {
    const list = Array.isArray(rawProps)
      ? rawProps
      : String(rawProps)
          .trim()
          .split(/\s+/)
          .filter((s) => s.length > 0);

    props = list.map((p) => normalizeProp(String(p)));

    for (const p of props) {
      // every prop name is accepted so the surface never changes as more
      // channels become tweenable — but it has to *be* a prop of this group
      if (TRANSITION_CONFIG_PROPS.has(p) || !readSet.has(p)) {
        throw new Error(
          `'${p}' is not a ${group === 'nodes' ? 'node' : 'edge'} style property ` +
            `(transition-property lists the group's own props)`,
        );
      }
    }
  }

  const num = (prop: string): number => {
    const v = config[prop];

    if (v == null) {
      return 0;
    }

    constOnly(prop, v);

    if (typeof v !== 'number' || !isFinite(v) || v < 0) {
      throw new Error(
        `'${prop}' must be a non-negative number of milliseconds`,
      );
    }

    return v;
  };

  const rawEasing = config['transition-timing-function'];

  constOnly('transition-timing-function', rawEasing);

  const easing = rawEasing == null ? 'linear' : String(rawEasing);

  compileEasing(easing); // validate at parse time — unknown names throw here

  return {
    props,
    duration: num('transition-duration'),
    delay: num('transition-delay'),
    easing,
  };
};

/** One channel's accumulated transition diffs over an apply pass. */
interface TxnEntry {
  column: TweenColumn;
  kind: 'scalar' | 'color' | 'lane' | 'padding' | 'fontSize';
  lane?: number;
  paint: boolean;
  min: number;
  max: number;
  refs: Ref[];
  from: (number | RGBA)[];
  to: (number | RGBA)[];
}

/** An open transition capture (one per group-def apply pass).  Entries
 * key on `column:lane` — a lane column (edge.arrowWidths) can carry
 * two independent entries.  `padding` (round 25.4) marks the compound
 * padding as listed — its diff runs beside the channel funnel, in the
 * parents' compound-style write. */
interface TxnCapture {
  group: GroupName;
  spec: TransitionSpec;
  channels: { main: TransitionChannel; rides: readonly TxnChannelDesc[] }[];
  entries: Map<string, TxnEntry>;
  padding: boolean;
}

const rgbaEq = (a: RGBA, b: RGBA): boolean =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

interface GroupDef {
  computed: Computed;
  mappers: BoundMapper[];
  /** data key → what depends on it (null when nothing does) */
  deps: Map<
    string,
    { label: boolean; mappers: boolean; chart: boolean }
  > | null;
  /** the group's transition config (round 24.1) */
  transition: TransitionSpec;
  /**
   * The flag-partition fast path (round 57.1).  Non-null when *every*
   * mapper in the group is a `case` over state conditions alone —
   * `{ selected: true }`, `{ active: true }` and the rest — which is
   * exactly what v4's default stylesheet is.
   *
   * Such a group has one computed record per distinct combination of the
   * bits it reads, not one per element: two for the default sheet's
   * nodes at rest, four once something is both selected and pressed.  So
   * applying it is a mask, a Map hit and the same write the constant
   * path does, instead of running a program per element.  Without this
   * every graph in existence would pay per-element mapper evaluation at
   * load for affordances almost none of its elements are using
   * (measured: ~6% of a 150k-element init).
   *
   * `mask` is the OR of the bits read; `records` is the lazily built
   * cache, keyed by `flags & mask`.
   *
   * `diffs` (round 61) is the state-refresh fast path's cache: for an
   * unordered pair of masked flag words, the writers for exactly the
   * channels whose value differs between the two records — or null when
   * some differing channel has no narrow writer, in which case a flip
   * between those words takes the full `write()` of the target record.
   * Keyed `lo:hi`; sized by pairs over the record cache, so single
   * digits in practice, and discarded with the def like `records`.
   */
  partition: {
    mask: number;
    records: Map<number, Computed>;
    diffs: Map<string, StateWriter[] | null>;
  } | null;
}

/** A narrow channel writer for the state-refresh fast path (round 61):
 * writes one channel's store bytes for `slot` from the resolved record,
 * with the same fold math as `writeChannels` — each is a method of the
 * engine that `writeChannels` itself calls, so the two cannot drift. */
type StateWriter = (slot: number, computed: Computed) => void;

/**
 * Below this many slots a bulk edge run is not worth its setup — the
 * contiguity scan, the state-word scan and one `copyWithin` per column
 * are each O(run), but the per-column call overhead is fixed.
 */
const BULK_MIN_RUN = 64;

const SHEET_KEYS: ReadonlySet<string> = new Set([
  'nodes',
  'edges',
  'parents',
  'core',
  'bypasses',
]);

/**
 * v4's **default stylesheet** (round 57.1) — the rules that make an
 * unstyled graph look like a working one.
 *
 * These are ordinary sheet props, spread *before* the user's block in
 * `setSheet`, which is v3's order-based precedence expressed as an
 * object spread (the same mechanism `PARENT_CHANNEL_OVERLAY` below has
 * used since round 14.6).  So declaring `background-color` in your own
 * `nodes` block replaces this rule entirely — the selection colour with
 * it — exactly as it does in v3, where these live in the default
 * stylesheet and any later block beats them.
 *
 * They are conditional mappers rather than shader constants for the
 * reason v4 has mappers at all: the value stays *declarative*.  It reads
 * back through `style()`, it serializes, and an app can replace it with
 * its own `case` — where a shader-drawn affordance could only be turned
 * off.  The condition is `{ selected: true }`, which round 57.1 added
 * beside round 14.7's `{ parent }`/`{ child }`.
 *
 * The colours are v3's `:selected` and `:parent:selected` blocks
 * verbatim.
 */
const onState = (
  state: 'selected' | 'active',
  then: string | number,
  otherwise: string | number,
): StyleProps[string] =>
  ({ case: [{ when: { [state]: true }, then }], else: otherwise }) as never;

const onSelected = (then: string, otherwise: string): StyleProps[string] =>
  onState('selected', then, otherwise);

/**
 * v3's `:active` block — the press affordance — as one conditional prop.
 *
 * v3 writes three (`overlay-color: black`, `overlay-padding: 10`,
 * `overlay-opacity: 0.25`), but two of them are already v4's constant
 * defaults, so only the opacity has to move.  That matters beyond
 * brevity: it is the whole of the affordance, so `overlay-opacity: 0` in
 * a sheet turns the press highlight off, and any other `overlay-*` value
 * restyles it without losing it.
 *
 * Both groups get it, as in v3.  Until round 57.1 this was drawn from
 * FLAG_ACTIVE inside the layer shader, which meant it could be neither.
 */
const ACTIVE_OVERLAY: StyleProps = {
  'overlay-opacity': onState('active', 0.25, 0),
};

const NODE_DEFAULT_BLOCK: StyleProps = {
  'background-color': onSelected('#0169D9', '#999'),
  ...ACTIVE_OVERLAY,
};

const EDGE_DEFAULT_BLOCK: StyleProps = {
  'line-color': onSelected('#0169D9', '#999'),
  'source-arrow-color': onSelected('#0169D9', '#999'),
  'target-arrow-color': onSelected('#0169D9', '#999'),
  'mid-source-arrow-color': onSelected('#0169D9', '#999'),
  'mid-target-arrow-color': onSelected('#0169D9', '#999'),
  // v3's default sheet carries `edge { width: 3 }` — its only element rule
  width: 3,
  ...ACTIVE_OVERLAY,
};

/** v3's default `:parent` block (round 14.6): the channel overlay parent
 * nodes get on top of the nodes group.  Padding 10 rides the compound
 * defaults instead (it is not a channel).  Its two colours carry v3's
 * `:parent:selected` tint the same way the nodes block above does. */
const PARENT_CHANNEL_OVERLAY: StyleProps = {
  shape: 'rectangle',
  'background-color': onSelected('#CCE1F9', '#eee'),
  'border-width': 1,
  'border-color': onSelected('#aec8e5', '#ccc'),
};

/** The parents-group compound props (constants only; not channels). */
const COMPOUND_PROPS: ReadonlySet<string> = new Set([
  'padding',
  'padding-relative-to',
  'min-width',
  'min-height',
  'compound-sizing-wrt-labels',
]);

const PADDING_RELATIVE_TO = new Set([
  'width',
  'height',
  'average',
  'min',
  'max',
]);

/** Split a parents-block props object into channel props and the parsed
 * compound style (round 14.6).  Compound props take constants only. */
const splitCompoundProps = (
  props: StyleProps,
): {
  channels: StyleProps;
  compound: Partial<CompoundStyle>;
} => {
  const channels: StyleProps = {};
  const compound: Partial<CompoundStyle> = {};

  for (const prop of Object.keys(props)) {
    const norm = normalizeProp(prop);
    const value = props[prop];

    if (!COMPOUND_PROPS.has(norm)) {
      channels[prop] = value;
      continue;
    }

    if (value != null && typeof value === 'object') {
      throw new Error(
        `The compound style property '${norm}' takes constants only`,
      );
    }

    switch (norm) {
      case 'padding': {
        if (typeof value === 'string') {
          const m = /^\s*([\d.]+)\s*%\s*$/.exec(value);

          if (m == null) {
            throw new Error(
              `Invalid padding '${value}' (a number of px, or 'N%')`,
            );
          }

          compound.padding = Number(m[1]) / 100; // v3's pfValue fraction
          compound.paddingUnit = '%';
        } else if (
          typeof value === 'number' &&
          value >= 0 &&
          Number.isFinite(value)
        ) {
          compound.padding = value;
          compound.paddingUnit = 'px';
        } else {
          throw new Error(
            `Invalid padding '${String(value)}' (a number of px, or 'N%')`,
          );
        }

        break;
      }

      case 'padding-relative-to':
        if (typeof value !== 'string' || !PADDING_RELATIVE_TO.has(value)) {
          throw new Error(
            `Invalid padding-relative-to '${String(value)}' (width | height | average | min | max)`,
          );
        }

        compound.relativeTo = value as CompoundStyle['relativeTo'];
        break;

      case 'min-width':
      case 'min-height':
        if (typeof value !== 'number' || !(value >= 0)) {
          throw new Error(
            `Invalid ${norm} '${String(value)}' (a non-negative number of px)`,
          );
        }

        if (norm === 'min-width') {
          compound.minWidth = value;
        } else {
          compound.minHeight = value;
        }

        break;

      case 'compound-sizing-wrt-labels':
        if (value === 'include') {
          throw new Error(
            `compound-sizing-wrt-labels: 'include' is unsupported ` +
              `(compound auto-sizing reads the children's body extents, not labels); use 'exclude'`,
          );
        }

        if (value !== 'exclude') {
          throw new Error(
            `Invalid compound-sizing-wrt-labels '${String(value)}' ('exclude' is the only supported value)`,
          );
        }

        break;
    }
  }

  return { channels, compound };
};

// Round 34.5: the column readers `readProp` dispatches through.  These
// were five closures built *inside* `readProp`, so every style getter
// allocated them before running one case of a 145-case switch — and
// under tsx each allocation also paid esbuild's `__name` wrapper, an
// Object.defineProperty per closure, which is what made the getter look
// 13–21× v3 in round 33's suite instead of the 5.8× the bundle shows.
// Module scope: allocated once, and the switch reads the same columns.
type ColumnIdArg = Parameters<GraphStore['column']>[0];

// lane 0, mirroring GraphStore.setScalar: a scalar channel on a
// multi-component column reads and writes the first lane (edge.width
// carries the arrow bits in lane 1 since round 56)
const readScalar = (store: GraphStore, slot: number, id: ColumnIdArg): number =>
  (store.column(id) as Float32Array | Uint32Array)[
    slot * columnSpec(id as ColumnId).components
  ];

const readPair = (
  store: GraphStore,
  slot: number,
  id: ColumnIdArg,
  i: 0 | 1,
): number => (store.column(id) as Float32Array)[slot * 2 + i];

const readColor = (
  store: GraphStore,
  slot: number,
  id: ColumnIdArg,
): string => {
  const bytes = store.column(id) as Uint8Array;

  return formatRgba(
    bytes[slot * 4],
    bytes[slot * 4 + 1],
    bytes[slot * 4 + 2],
    bytes[slot * 4 + 3],
  );
};

const readAlpha = (store: GraphStore, slot: number, id: ColumnIdArg): number =>
  (store.column(id) as Uint8Array)[slot * 4 + 3];

const packedColor = (packed: number): string =>
  formatRgba(
    packed & 0xff,
    (packed >>> 8) & 0xff,
    (packed >>> 16) & 0xff,
    (packed >>> 24) & 0xff,
  );

/*
Round 35.2: the stored-truth readback, as a dispatch table.

`readProp` used to answer all 150 readable property labels from a single
switch of the same size — a dispatch table written as control flow.  V8
does not hash a string switch that large: moving `border-width`'s case,
body untouched, from the sixth position to the tail cost it 56 → 90 ns
through the built bundle, so a property's read cost depended on where it
happened to sit in the file.

Here it is data.  One `Map.get` answers any property in the same time,
each reader is a small function that can be read on its own, and adding
a property is an entry rather than a position in a 524-line switch.  A
reader takes only the arguments it uses, in the order
`( store, slot, ref, engine, prop )` — `prop` is passed because nine
readers deliberately answer several labels and need to know which.
*/
/**
 * The slice of the engine a property reader may use.  A narrow context
 * rather than the engine itself, so the table can live at module scope
 * without any of `StyleEngine`'s privates becoming public: it is built
 * once per engine, and its getters keep it live across a sheet swap.
 */
interface ReadContext {
  readonly store: GraphStore;
  readonly defs: { nodes: GroupDef; edges: GroupDef; parents: GroupDef };
  defFor(ref: Ref): GroupDef;
  labelChannels(ref: Ref): { fontSize: number; color: string };
  readImageProp(slot: number, prop: string): string | number;
}

type PropReader = (
  store: GraphStore,
  slot: number,
  ref: Ref,
  engine: ReadContext,
  prop: string,
) => string | number | undefined;

const PROP_READERS = new Map<string, PropReader>();

/** Register one reader under every property name it answers. */
const defineReader = (names: string[], read: PropReader): void => {
  for (const name of names) {
    PROP_READERS.set(name, read);
  }
};

defineReader(['background-color'], (store, slot) =>
  readColor(store, slot, 'node.fillColor'),
);

defineReader(['border-color'], (store, slot) =>
  readColor(store, slot, 'node.borderColor'),
);

defineReader(['border-width'], (store, slot) =>
  readScalar(store, slot, 'node.borderWidth'),
);

defineReader(['corner-radius'], (store, slot) => {
  const r = (store.column('node.borderGeom') as Uint32Array)[slot * 4];

  return r === 0xffffffff ? 'auto' : r / 256;
});

defineReader(['border-position'], (store, slot) => {
  return (
    BORDER_POSITION_NAMES[
      (store.column('node.borderGeom') as Uint32Array)[slot * 4 + 1] & 0xff
    ] ?? 'center'
  );
});

defineReader(
  ['border-style'],
  (store, slot) =>
    STROKE_STYLE_NAMES[
      ((store.column('node.borderGeom') as Uint32Array)[slot * 4 + 1] >>>
        BORDER_STYLE_SHIFT) &
        STROKE_STYLE_MASK
    ] ?? 'solid',
);

defineReader(
  ['outline-style'],
  (store, slot) =>
    STROKE_STYLE_NAMES[
      ((store.column('node.borderGeom') as Uint32Array)[slot * 4 + 1] >>>
        OUTLINE_STYLE_SHIFT) &
        STROKE_STYLE_MASK
    ] ?? 'solid',
);

defineReader(['border-dash-pattern'], (store, slot) => {
  const arr = (store.column('node.borderDash') as Float32Array).subarray(
    slot * 4,
    slot * 4 + 4,
  );

  // collapse the normalized two-pair form back to one pair when repeated
  return arr[0] === arr[2] && arr[1] === arr[3]
    ? `${arr[0]} ${arr[1]}`
    : `${arr[0]} ${arr[1]} ${arr[2]} ${arr[3]}`;
});

defineReader(
  ['border-dash-offset'],
  (store, slot) =>
    (store.column('node.borderDashMeta') as Float32Array)[slot * 2],
);

defineReader(
  ['background-fill', 'line-fill'],
  (store, slot, ref, engine, prop) => {
    const gid = prop === 'background-fill' ? 'node.gradient' : 'edge.gradient';
    const meta = (store.column(gid) as Uint32Array)[slot * 8];

    return FILL_KIND_NAMES[meta & 3] ?? 'solid';
  },
);

defineReader(['background-gradient-direction'], (store, slot) => {
  const meta = (store.column('node.gradient') as Uint32Array)[slot * 8];

  return GRADIENT_DIRECTION_NAMES[(meta >>> 2) & 7] ?? 'to-bottom';
});

defineReader(
  ['background-gradient-stop-colors', 'line-gradient-stop-colors'],
  (store, slot, ref, engine, prop) => {
    const gid = prop.startsWith('background')
      ? 'node.gradient'
      : 'edge.gradient';
    const rec = (store.column(gid) as Uint32Array).subarray(
      slot * 8,
      slot * 8 + 8,
    );
    const count = (rec[0] >>> 5) & 7;
    const parts: string[] = [];

    for (let i = 0; i < count; i++) {
      const c = rec[1 + i];

      parts.push(
        formatRgba(
          c & 0xff,
          (c >>> 8) & 0xff,
          (c >>> 16) & 0xff,
          (c >>> 24) & 0xff,
        ),
      );
    }

    return parts.join(' ');
  },
);

defineReader(
  ['background-gradient-stop-positions', 'line-gradient-stop-positions'],
  (store, slot, ref, engine, prop) => {
    const gid = prop.startsWith('background')
      ? 'node.gradient'
      : 'edge.gradient';
    const rec = (store.column(gid) as Uint32Array).subarray(
      slot * 8,
      slot * 8 + 8,
    );
    const count = (rec[0] >>> 5) & 7;
    const parts: string[] = [];

    for (let i = 0; i < count; i++) {
      const raw = i === 4 ? rec[7] & 0xff : (rec[6] >>> (i * 8)) & 0xff;

      parts.push(`${Math.round((raw / 255) * 100)}%`);
    }

    return parts.join(' ');
  },
);

defineReader(['outline-color'], (store, slot) => {
  const rgba = (store.column('node.borderGeom') as Uint32Array)[slot * 4 + 2];

  return formatRgba(
    rgba & 0xff,
    (rgba >>> 8) & 0xff,
    (rgba >>> 16) & 0xff,
    (rgba >>> 24) & 0xff,
  );
});

defineReader(['outline-opacity'], (store, slot) => {
  return (
    Math.round(
      (((store.column('node.borderGeom') as Uint32Array)[slot * 4 + 2] >>> 24) /
        255) *
        1000,
    ) / 1000
  );
});

defineReader(
  ['outline-width'],
  (store, slot) =>
    ((store.column('node.borderGeom') as Uint32Array)[slot * 4 + 3] & 0xffff) /
    256,
);

defineReader(
  ['outline-offset'],
  (store, slot) =>
    ((store.column('node.borderGeom') as Uint32Array)[slot * 4 + 3] >>> 16) /
    256,
);

// the B1 channel opacities read back *folded* (stored alpha /
// 255 — the declared color alpha times the opacity; the
// outline/arrow precedent)
defineReader(
  ['background-opacity'],
  (store, slot) =>
    Math.round(
      ((store.column('node.fillColor') as Uint8Array)[slot * 4 + 3] / 255) *
        1000,
    ) / 1000,
);

defineReader(
  ['border-opacity'],
  (store, slot) =>
    Math.round(
      ((store.column('node.borderColor') as Uint8Array)[slot * 4 + 3] / 255) *
        1000,
    ) / 1000,
);

// background images (15.2): stored-truth readback off the blob
// records; per-image lists read back space-joined (the 12b list
// convention), single images as scalars
defineReader(
  [
    'background-image',
    'background-fit',
    'background-image-opacity',
    'background-position-x',
    'background-position-y',
    'background-offset-x',
    'background-offset-y',
    'background-width',
    'background-height',
    'background-repeat',
    'background-clip',
    'background-image-containment',
    'background-image-smoothing',
    'background-image-crossorigin',
    'background-image-type',
    'background-image-color',
  ],
  (store, slot, ref, engine, prop) => engine.readImageProp(slot, prop),
);

defineReader(['events'], (store, slot, ref) => {
  // 20.2: stored truth is the flag bit
  return store.hasFlag(ref.group, slot, FLAG_NO_EVENTS) ? 'no' : 'yes';
});

defineReader(['text-events'], (store, slot) => {
  // 20.3
  return store.hasFlag('nodes', slot, FLAG_TEXT_EVENTS) ? 'yes' : 'no';
});

defineReader(['visibility'], (store, slot, ref) => {
  // 22: stored truth is the element's own state
  return store.hasFlag(ref.group, slot, FLAG_SELF_INVISIBLE)
    ? 'hidden'
    : 'visible';
});

defineReader(['chart'], (store, slot) => {
  const rec = store.chartAt(slot);

  return rec == null ? 'none' : rec.kind === CHART_PIE ? 'pie' : 'stripes';
});

defineReader(
  ['chart-values'],
  (store, slot) => store.chartAt(slot)?.values.join(' ') ?? '',
);

defineReader(
  ['chart-colors'],
  (store, slot) =>
    store
      .chartAt(slot)
      ?.colors.map((c) => formatRgba(...c))
      .join(' ') ?? '',
);

defineReader(['chart-size'], (store, slot) => store.chartAt(slot)?.size ?? 1);

defineReader(['chart-hole'], (store, slot) => store.chartAt(slot)?.hole ?? 0);

defineReader(
  ['chart-start-angle'],
  (store, slot) => store.chartAt(slot)?.startAngle ?? 0,
);

defineReader(['chart-direction'], (store, slot) =>
  (store.chartAt(slot)?.direction ?? 0) === 1 ? 'horizontal' : 'vertical',
);

defineReader(
  ['chart-opacity'],
  (store, slot) => store.chartAt(slot)?.opacity ?? 1,
);

defineReader(['ghost'], (store, slot) =>
  (store.column('node.ghost') as Float32Array)[slot * 4 + 3] !== 0
    ? 'yes'
    : 'no',
);

defineReader(
  ['ghost-offset-x'],
  (store, slot) => (store.column('node.ghost') as Float32Array)[slot * 4],
);

defineReader(
  ['ghost-offset-y'],
  (store, slot) => (store.column('node.ghost') as Float32Array)[slot * 4 + 1],
);

defineReader(
  ['ghost-opacity'],
  (store, slot) => (store.column('node.ghost') as Float32Array)[slot * 4 + 2],
);

defineReader(
  [
    'overlay-color',
    'overlay-opacity',
    'overlay-padding',
    'overlay-shape',
    'overlay-corner-radius',
    'underlay-color',
    'underlay-opacity',
    'underlay-padding',
    'underlay-shape',
    'underlay-corner-radius',
  ],
  (store, slot, ref, engine, prop) => {
    if (ref.group === 'edges') {
      // edge layers: [rgba folded, strokeWidth×256]; padding reads
      // back as (stroke − width) / 2
      const eid = prop.startsWith('overlay') ? 'edge.overlay' : 'edge.underlay';
      const erec = (store.column(eid) as Uint32Array).subarray(
        slot * 2,
        slot * 2 + 2,
      );

      if (prop.endsWith('-color')) {
        const rgba = erec[0];

        return formatRgba(
          rgba & 0xff,
          (rgba >>> 8) & 0xff,
          (rgba >>> 16) & 0xff,
          (rgba >>> 24) & 0xff,
        );
      }

      if (prop.endsWith('-opacity')) {
        return (erec[0] >>> 24) / 255;
      }

      const width = (store.column('edge.width') as Float32Array)[slot * 2];

      return Math.max(0, erec[1] / 256 - width) / 2;
    }

    const id = prop.startsWith('overlay') ? 'node.overlay' : 'node.underlay';
    const rec = (store.column(id) as Uint32Array).subarray(
      slot * 4,
      slot * 4 + 4,
    );
    const field = prop.replace(/^(overlay|underlay)-/, '');

    // color reads back folded (alpha carries the layer opacity — the
    // arrow-color precedent); opacity reads the folded alpha
    switch (field) {
      case 'color': {
        const rgba = rec[0];

        return formatRgba(
          rgba & 0xff,
          (rgba >>> 8) & 0xff,
          (rgba >>> 16) & 0xff,
          (rgba >>> 24) & 0xff,
        );
      }
      case 'opacity':
        return (rec[0] >>> 24) / 255;
      case 'padding':
        return rec[1] / 256;
      case 'shape':
        return rec[2] === 1 ? 'ellipse' : 'round-rectangle';
      default:
        return rec[3] === 0xffffffff ? 'auto' : rec[3] / 256;
    }
  },
);

defineReader(['height'], (store, slot) =>
  readPair(store, slot, 'node.size', 1),
);

defineReader(
  ['shape'],
  (store, slot) => SHAPE_NAMES[readScalar(store, slot, 'node.shape')],
);

defineReader(['shape-polygon-points'], (store, slot, ref, engine) => {
  const points = store.polygonPointsAt(slot);

  return points != null
    ? Array.from(points).join(' ')
    : engine.defs.nodes.computed.shapePolygonPoints.join(' ');
});

defineReader(
  ['label'],
  (store, slot, ref) => store.labelAt(slot, ref.group)?.text ?? '',
);

defineReader(
  ['font-size'],
  (store, slot, ref, engine) => engine.labelChannels(ref).fontSize,
);

defineReader(['font-family'], (store) => store.labelFont);

defineReader(['font-style'], (store) => store.labelFontStyle);

defineReader(['font-weight'], (store) => store.labelFontWeight);

defineReader(
  ['color'],
  (store, slot, ref, engine) => engine.labelChannels(ref).color,
);

// label visual props (constants; sidecar when labelled, else the sheet
// constants — opacities read back folded into the stored alpha, like
// arrow colors)
defineReader(
  ['text-outline-width'],
  (store, slot, ref, engine) =>
    store.labelAt(slot, ref.group)?.outlineWidth ??
    engine.defFor(ref).computed.textOutlineWidth,
);

defineReader(['text-outline-color'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? packedColor(entry.outlineColor)
    : formatRgba(...engine.defFor(ref).computed.textOutlineColor);
});

defineReader(
  ['text-transform'],
  (store, slot, ref, engine) =>
    TEXT_TRANSFORM_NAMES[engine.defFor(ref).computed.textTransform] ?? 'none',
);

defineReader(['text-wrap'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return (
    TEXT_WRAP_NAMES[
      entry != null ? entry.wrap : engine.defFor(ref).computed.textWrap
    ] ?? 'none'
  );
});

defineReader(['text-max-width'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? entry.maxWidth
    : engine.defFor(ref).computed.textMaxWidth;
});

defineReader(['line-height'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? entry.lineHeight
    : engine.defFor(ref).computed.lineHeight;
});

defineReader(['text-overflow-wrap'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return (
    OFLOW_WRAP_NAMES[
      entry != null
        ? entry.overflowWrap
        : engine.defFor(ref).computed.textOverflowWrap
    ] ?? 'whitespace'
  );
});

defineReader(['text-justification'], (store, slot, ref, engine) => {
  // the sidecar stores the *resolved* justification; the sheet's
  // declared value (incl. 'auto') is what reads back, as v3
  return (
    JUSTIFICATION_NAMES[engine.defFor(ref).computed.textJustification] ?? 'auto'
  );
});

defineReader(['text-background-shape'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return (
    TEXT_BG_SHAPE_NAMES[
      entry != null ? entry.bgShape : engine.defFor(ref).computed.textBgShape
    ] ?? 'rectangle'
  );
});

defineReader(['text-border-width'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? entry.bgBorderWidth
    : engine.defFor(ref).computed.textBorderWidth;
});

defineReader(['min-zoomed-font-size'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? entry.minZoomedFontSize
    : engine.defFor(ref).computed.minZoomedFontSize;
});

defineReader(['text-halign'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, 'nodes');

  return HALIGN_NAMES[
    entry != null
      ? entry.halignShift * 2 + 1
      : engine.defs.nodes.computed.textHalign
  ];
});

defineReader(['text-valign'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, 'nodes');

  return VALIGN_NAMES[
    entry != null
      ? entry.valignShift * 2 + 2
      : engine.defs.nodes.computed.textValign
  ];
});

defineReader(['text-border-color'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? packedColor(entry.bgBorderColor)
    : formatRgba(...engine.defFor(ref).computed.textBorderColor);
});

defineReader(['text-border-opacity'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? Math.round((((entry.bgBorderColor >>> 24) & 0xff) / 255) * 1000) / 1000
    : engine.defFor(ref).computed.textBorderOpacity;
});

defineReader(['text-opacity'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? Math.round((((entry.color >>> 24) & 0xff) / 255) * 1000) / 1000
    : engine.defFor(ref).computed.textOpacity;
});

defineReader(['text-outline-opacity'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? Math.round((((entry.outlineColor >>> 24) & 0xff) / 255) * 1000) / 1000
    : engine.defFor(ref).computed.textOutlineOpacity;
});

defineReader(['text-background-color'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? packedColor(entry.bgColor)
    : formatRgba(...engine.defFor(ref).computed.textBgColor);
});

defineReader(['text-background-opacity'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  return entry != null
    ? Math.round((((entry.bgColor >>> 24) & 0xff) / 255) * 1000) / 1000
    : engine.defFor(ref).computed.textBgOpacity;
});

defineReader(
  ['text-background-padding'],
  (store, slot, ref, engine) =>
    store.labelAt(slot, ref.group)?.bgPadding ??
    engine.defFor(ref).computed.textBgPadding,
);

defineReader(
  ['text-margin-x'],
  (store, slot, ref, engine) =>
    store.labelAt(slot, ref.group)?.marginX ??
    engine.defFor(ref).computed.textMarginX,
);

defineReader(
  ['text-margin-y'],
  (store, slot, ref, engine) =>
    store.labelAt(slot, ref.group)?.marginY ??
    engine.defFor(ref).computed.textMarginY,
);

defineReader(['text-rotation'], (store, slot, ref, engine) => {
  const entry = store.labelAt(slot, ref.group);

  // stored truth: the sidecar keeps the flag and the angle apart
  return entry != null
    ? entry.rotate
      ? 'autorotate'
      : textRotationName(entry.rotation)
    : textRotationName(engine.defFor(ref).computed.textRotation);
});

defineReader(
  [
    'source-label',
    'source-text-offset',
    'source-text-margin-x',
    'source-text-margin-y',
    'source-text-rotation',
    'target-label',
    'target-text-offset',
    'target-text-margin-x',
    'target-text-margin-y',
    'target-text-rotation',
  ],
  (store, slot, ref, engine, prop) => {
    // end labels (D4): the stored stream entry, else the sheet value
    const src = prop.startsWith('source');
    const entry = store.labelAt(slot, src ? 'edgeSource' : 'edgeTarget');
    const d = engine.defs.edges.computed;

    if (prop.endsWith('-label')) {
      return entry?.text ?? '';
    }

    if (prop.endsWith('-offset')) {
      return entry != null
        ? entry.endOffset
        : src
          ? d.sourceTextOffset
          : d.targetTextOffset;
    }

    if (prop.endsWith('-margin-x')) {
      return entry != null
        ? entry.marginX
        : src
          ? d.sourceTextMarginX
          : d.targetTextMarginX;
    }

    if (prop.endsWith('-margin-y')) {
      return entry != null
        ? entry.marginY
        : src
          ? d.sourceTextMarginY
          : d.targetTextMarginY;
    }

    return entry != null
      ? entry.rotate
        ? 'autorotate'
        : textRotationName(entry.rotation)
      : textRotationName(src ? d.sourceTextRotation : d.targetTextRotation);
  },
);

// shared names, resolved per group
defineReader(['width'], (store, slot, ref) =>
  ref.group === 'nodes'
    ? readPair(store, slot, 'node.size', 0)
    : readScalar(store, slot, 'edge.width'),
);

defineReader(['opacity'], (store, slot, ref, engine) => {
  // under compounds the node column stores the ancestor-folded
  // value; the declared style reads the base (round 14.4)
  if (ref.group === 'nodes' && engine.store.hasCompounds()) {
    return engine.store.baseOpacityOf(ref.slot);
  }

  return readScalar(
    store,
    slot,
    ref.group === 'nodes' ? 'node.opacity' : 'edge.opacity',
  );
});

// compound props (round 14.6): stored truth is the per-parent
// record; leaves read the zero defaults (v3 leaves' padding is 0)
defineReader(['padding'], (store, slot, ref, engine) => {
  const cs = engine.store.compoundStyleOf(ref.slot);

  return cs.paddingUnit === '%' ? `${cs.padding * 100}%` : cs.padding;
});

defineReader(
  ['padding-relative-to'],
  (store, slot, ref, engine) =>
    engine.store.compoundStyleOf(ref.slot).relativeTo,
);

defineReader(
  ['min-width'],
  (store, slot, ref, engine) => engine.store.compoundStyleOf(ref.slot).minWidth,
);

defineReader(
  ['min-height'],
  (store, slot, ref, engine) =>
    engine.store.compoundStyleOf(ref.slot).minHeight,
);

defineReader(['compound-sizing-wrt-labels'], () => 'exclude');

// edge channels
defineReader(['line-color'], (store, slot) =>
  readColor(store, slot, 'edge.lineColor'),
);

defineReader(
  ['line-style'],
  (store, slot) => LINE_STYLE_NAMES[readScalar(store, slot, 'edge.lineStyle')],
);

defineReader(['source-arrow-shape'], (store, slot) => {
  return readAlpha(store, slot, 'edge.sourceArrow') > 0
    ? ARROW_NAMES[
        unpackArrowShape(
          readScalar(store, slot, 'edge.arrowShapes'),
          ARROW_SHIFT_SOURCE,
        )
      ]
    : 'none';
});

defineReader(['target-arrow-shape'], (store, slot) => {
  return readAlpha(store, slot, 'edge.targetArrow') > 0
    ? ARROW_NAMES[
        unpackArrowShape(
          readScalar(store, slot, 'edge.arrowShapes'),
          ARROW_SHIFT_TARGET,
        )
      ]
    : 'none';
});

defineReader(
  ['line-opacity'],
  (store, slot) =>
    Math.round(
      ((store.column('edge.lineColor') as Uint8Array)[slot * 4 + 3] / 255) *
        1000,
    ) / 1000,
);

defineReader(
  ['line-cap'],
  (store, slot) =>
    LINE_CAP_NAMES[
      (store.column('edge.dashMeta') as Float32Array)[slot * 2 + 1]
    ] ?? 'butt',
);

defineReader(['line-outline-width'], (store, slot) => {
  // stored stroke = width + outline width (B4)
  const rec = (store.column('edge.casing') as Uint32Array)[slot * 2 + 1];
  const width = (store.column('edge.width') as Float32Array)[slot * 2];

  return rec === 0 ? 0 : Math.max(0, rec / 256 - width);
});

defineReader(['line-outline-color'], (store, slot) => {
  const rgba = (store.column('edge.casing') as Uint32Array)[slot * 2];

  return formatRgba(
    rgba & 0xff,
    (rgba >>> 8) & 0xff,
    (rgba >>> 16) & 0xff,
    (rgba >>> 24) & 0xff,
  );
});

defineReader(
  ['line-dash-offset'],
  (store, slot) => (store.column('edge.dashMeta') as Float32Array)[slot * 2],
);

defineReader(['line-dash-pattern'], (store, slot) => {
  const arr = (store.column('edge.dashPattern') as Float32Array).subarray(
    slot * 4,
    slot * 4 + 4,
  );

  // collapse the normalized two-pair form back to one pair when repeated
  return arr[0] === arr[2] && arr[1] === arr[3]
    ? `${arr[0]} ${arr[1]}`
    : `${arr[0]} ${arr[1]} ${arr[2]} ${arr[3]}`;
});

defineReader(['arrow-scale'], (store, slot) => {
  const q =
    (store.column('edge.arrowShapes') as Uint32Array)[slot] >>>
    ARROW_SHIFT_SCALE;

  return q === 0 ? 1 : q / 16; // quantized ×16 (recorded)
});

defineReader(
  ['source-arrow-fill', 'target-arrow-fill'],
  (store, slot, ref, engine, prop) => {
    const bit = prop.startsWith('source')
      ? ARROW_SHIFT_HOLLOW_SOURCE
      : ARROW_SHIFT_HOLLOW_TARGET;

    return ARROW_FILL_NAMES[
      ((store.column('edge.arrowShapes') as Uint32Array)[slot] >>> bit) & 1
    ];
  },
);

defineReader(
  ['source-arrow-width'],
  (store, slot) => (store.column('edge.arrowWidths') as Float32Array)[slot * 2],
);

defineReader(
  ['target-arrow-width'],
  (store, slot) =>
    (store.column('edge.arrowWidths') as Float32Array)[slot * 2 + 1],
);

defineReader(
  ['mid-source-arrow-shape', 'mid-target-arrow-shape'],
  (store, slot, ref, engine, prop) => {
    const shift = prop.startsWith('mid-source')
      ? ARROW_SHIFT_MID_SOURCE
      : ARROW_SHIFT_MID_TARGET;
    const colId = prop.startsWith('mid-source')
      ? 'edge.midSourceArrow'
      : 'edge.midTargetArrow';
    const a = (store.column(colId) as Uint8Array)[slot * 4 + 3];

    // stored truth: a transparent mid arrow reads 'none' (the
    // end-arrow precedent)
    return a === 0
      ? 'none'
      : ARROW_NAMES[
          unpackArrowShape(
            (store.column('edge.arrowShapes') as Uint32Array)[slot],
            shift,
          )
        ];
  },
);

defineReader(['mid-source-arrow-color'], (store, slot) =>
  readColor(store, slot, 'edge.midSourceArrow'),
);

defineReader(['mid-target-arrow-color'], (store, slot) =>
  readColor(store, slot, 'edge.midTargetArrow'),
);

defineReader(['source-arrow-color'], (store, slot) =>
  readColor(store, slot, 'edge.sourceArrow'),
);

defineReader(['target-arrow-color'], (store, slot) =>
  readColor(store, slot, 'edge.targetArrow'),
);

// curve props read the styled record (stored truth: a lone
// 'bezier' edge reads back 'bezier' even though it renders
// straight — v3 semantics); angles read back in radians.  Lists
// read back as space-separated strings (v3's strValue form);
// percent taxi turns read back as the percent string.
defineReader(
  ['curve-style'],
  (store, slot) => CURVE_STYLE_NAMES[store.curveStyleAt(slot).style],
);

defineReader(
  ['control-point-step-size'],
  (store, slot) => store.curveStyleAt(slot).stepSize,
);

defineReader(
  ['control-point-weight'],
  (store, slot) => store.curveStyleAt(slot).weight,
);

defineReader(
  ['loop-direction'],
  (store, slot) => store.curveStyleAt(slot).loopDirection,
);

defineReader(
  ['loop-sweep'],
  (store, slot) => store.curveStyleAt(slot).loopSweep,
);

defineReader(['control-point-distances'], (store, slot) => {
  const dists = curveExtrasFor(store, slot).ctrlDists;

  return dists == null ? undefined : dists.join(' ');
});

defineReader(['control-point-weights'], (store, slot) =>
  curveExtrasFor(store, slot).ctrlWeights.join(' '),
);

defineReader(['segment-distances'], (store, slot) =>
  curveExtrasFor(store, slot).segDists.join(' '),
);

defineReader(['segment-weights'], (store, slot) =>
  curveExtrasFor(store, slot).segWeights.join(' '),
);

defineReader(['segment-radii'], (store, slot) =>
  curveExtrasFor(store, slot).segRadii.join(' '),
);

defineReader(['radius-type'], (store, slot) => {
  return curveExtrasFor(store, slot)
    .radiusTypes.map((id) => RADIUS_TYPE_NAMES[id])
    .join(' ');
});

defineReader(
  ['edge-distances'],
  (store, slot) =>
    EDGE_DISTANCE_NAMES[curveExtrasFor(store, slot).edgeDistances],
);

defineReader(
  ['taxi-direction'],
  (store, slot) => TAXI_DIRECTION_NAMES[curveExtrasFor(store, slot).taxiDir],
);

defineReader(['taxi-turn'], (store, slot) => {
  const ex = curveExtrasFor(store, slot);

  return ex.taxiTurnPercent ? `${ex.taxiTurn * 100}%` : ex.taxiTurn;
});

defineReader(
  ['taxi-turn-min-distance'],
  (store, slot) => curveExtrasFor(store, slot).taxiTurnMinDist,
);

defineReader(
  ['taxi-radius'],
  (store, slot) => curveExtrasFor(store, slot).taxiRadius,
);

defineReader(
  ['haystack-radius'],
  (store, slot) => store.curveStyleAt(slot).haystackRadius,
);

defineReader(
  ['source-endpoint', 'target-endpoint'],
  (store, slot, ref, engine, prop) => {
    const e = store.curveStyleAt(slot).endpoints;
    const src = prop === 'source-endpoint';

    if (e == null) {
      return 'outside-to-node';
    }

    return endpointString(
      src
        ? { mode: e.srcMode, a: e.srcA, b: e.srcB, pct: e.srcPct }
        : { mode: e.tgtMode, a: e.tgtA, b: e.tgtB, pct: e.tgtPct },
    );
  },
);

defineReader(
  ['source-distance-from-node'],
  (store, slot) => store.curveStyleAt(slot).endpoints?.srcDist ?? 0,
);

defineReader(
  ['target-distance-from-node'],
  (store, slot) => store.curveStyleAt(slot).endpoints?.tgtDist ?? 0,
);

/** The reserved condition keys, as a set — the sheet-scan gate. */
const CONDITION_KEY_SET: ReadonlySet<string> = new Set(
  Object.keys(CONDITION_FLAGS),
);

export class StyleEngine {
  private store: GraphStore;
  /**
   * The narrow view of this engine that the module-scope property
   * readers receive (35.2).  Built once here rather than per read, and
   * its getters stay live across a sheet swap that replaces `defs`.
   */
  private readonly readCtx: ReadContext;
  /** per-raw-name read plans (round 62.4): normalization, group
   * membership, the transition/arrow classifications and the reader,
   * resolved once per spelling — all from module tables no sheet swap
   * changes, so the cache is immortal per engine */
  private readonly readPlans = new Map<
    string,
    {
      prop: string;
      node: boolean;
      edge: boolean;
      transition: boolean;
      arrowColorProp: string | null;
      reader: PropReader | null;
    }
  >();
  private sheet: Stylesheet;
  private defs: { nodes: GroupDef; edges: GroupDef; parents: GroupDef };
  /** the parents-group compound style, applied per parent slot */
  private parentCompound: Partial<CompoundStyle> = { padding: 10 };
  /** normalized channel props the parents overlay resolves differently
   * from the nodes group (defaults + the user parents block) — a
   * GPU-mapped nodes channel in this set demotes to the CPU path */
  private parentsOverride: ReadonlySet<string> = new Set(
    Object.keys(PARENT_CHANNEL_OVERLAY),
  );

  private arrows = { source: false, target: false };
  private midArrows = { source: false, target: false };

  /**
   * Bumps when the paint-mapper state changes (sheet set, or a GPU-owned
   * live auto-domain extent moved) — the renderer's mapper runtime pulls
   * on this to repack its program buffers.
   */
  paintVersion = 0;

  /** props per group the GPU eval kernel currently owns (set by the runtime). */
  private gpuOwnedProps: Record<GroupName, ReadonlySet<string>> = {
    nodes: new Set(),
    edges: new Set(),
  };

  /** a mapped key's column promoted to mixed while kernel-owned: re-derive on CPU */
  private demoted: Record<GroupName, boolean> = { nodes: false, edges: false };

  /** Round 24.1: styled-generation marks (gen + 1; 0 = never styled).  A
   * slot joins transition diffs only when its *current* element has been
   * styled before — the first application on add is instant (v3's rule),
   * and a recycled slot's fresh generation fails the check on its own. */
  private styledGen: Record<GroupName, Uint32Array> = {
    nodes: new Uint32Array(0),
    edges: new Uint32Array(0),
  };

  /**
   * How many edge runs have taken the round-67.2 bulk route.
   *
   * Internal, and not a statistic anyone needs at runtime — it exists so
   * `test/bulk-style-apply.mjs` can assert that the route *ran*.  Without
   * it a comparison against the per-element route passes just as well
   * when the gate declined, which is exactly what the first version of
   * that spec did: its fixture mapped `curve-style` and `label`, neither
   * of which has a narrow writer, so every assertion compared the
   * per-element path against itself.
   */
  _bulkRuns = 0;

  /** Round 24.1: the open transition capture (one per group-def pass). */
  private txn: TxnCapture | null = null;

  // -- per-element bypasses (round 63) --

  /** id → normalized prop → raw value: the live bypass declarations
   * (the `bypasses` sheet section plus the sugar methods' writes),
   * exported by `json()`.  Id-keyed declarations, not element state —
   * an entry survives remove/re-add and may name an id that does not
   * exist yet (inert until it does). */
  private bypassRaw = new Map<string, Record<string, unknown>>();

  /** id → per-group parsed patches.  Both groups parse at declaration
   * time (the id may not resolve yet); null marks a group whose guards
   * reject the entry's props (e.g. a curve prop never applies to a
   * node), decided when the id resolves. */
  private bypassParsed = new Map<
    string,
    { nodes: BypassPatch | null; edges: BypassPatch | null }
  >();

  /** slot → patch per group, resolved lazily against the store's
   * structure epoch — adds, removes and compaction all bump it, and a
   * re-resolution is O(declared ids), never O(elements). */
  private bypassSlots: Record<GroupName, Map<number, BypassPatch>> = {
    nodes: new Map(),
    edges: new Map(),
  };

  private bypassEpoch = -1;

  /** normalized prop → live declaration count across ids — what
   * `paintInputs` demotes by (a kernel-owned mapper would overwrite a
   * bypassed slot's stored bytes on its next dispatch). */
  private bypassPropCounts = new Map<string, number>();

  /** Whether any bypass is declared — the zero-cost gate every touched
   * path checks first (the round-63 performance contract).
   *
   * @returns true when at least one id has a live bypass declaration
   */
  hasBypasses(): boolean {
    return this.bypassRaw.size > 0;
  }

  /** Validate a sheet's `bypasses` section into installable entries —
   * called before any engine state mutates, so a bad section throws
   * from `setSheet` with nothing half-applied. */
  private validateBypasses(section: Stylesheet['bypasses']): Map<
    string,
    {
      raw: Record<string, unknown>;
      parsed: { nodes: BypassPatch | null; edges: BypassPatch | null };
    }
  > {
    const out = new Map<
      string,
      {
        raw: Record<string, unknown>;
        parsed: { nodes: BypassPatch | null; edges: BypassPatch | null };
      }
    >();

    if (section == null) {
      return out;
    }

    if (typeof section !== 'object' || Array.isArray(section)) {
      throw new Error(
        `The 'bypasses' section is an object of { id: { prop: constant } } entries`,
      );
    }

    for (const id of Object.keys(section)) {
      const entry = (section as Record<string, unknown>)[id];

      if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(
          `Invalid bypass for '${id}': an entry is a { prop: constant } object`,
        );
      }

      const raw: Record<string, unknown> = {};

      for (const key of Object.keys(entry)) {
        raw[normalizeProp(key)] = (entry as Record<string, unknown>)[key];
      }

      out.set(id, { raw, parsed: this.parseBypassGroups(id, raw) });
    }

    return out;
  }

  /** Parse one entry's props for both groups; a group whose guards
   * reject them parses null, and both rejecting is the caller's error. */
  private parseBypassGroups(
    id: string,
    raw: Record<string, unknown>,
  ): { nodes: BypassPatch | null; edges: BypassPatch | null } {
    let nodes: BypassPatch | null = null;
    let edges: BypassPatch | null = null;
    let nodesErr: unknown = null;

    try {
      nodes = captureBypassPatch('nodes', raw);
    } catch (e) {
      nodesErr = e;
    }

    try {
      edges = captureBypassPatch('edges', raw);
    } catch {
      // the nodes error carries the message when both reject
    }

    if (nodes == null && edges == null) {
      throw new Error(
        `Invalid bypass for '${id}': ${(nodesErr as Error).message}`,
      );
    }

    return { nodes, edges };
  }

  /** Install validated bypass entries (whole-replace — `setSheet`'s
   * swap semantics: the section is replaced like any other). */
  private installBypasses(
    entries: Map<
      string,
      {
        raw: Record<string, unknown>;
        parsed: { nodes: BypassPatch | null; edges: BypassPatch | null };
      }
    >,
  ): void {
    this.bypassRaw.clear();
    this.bypassParsed.clear();
    this.bypassPropCounts.clear();
    this.bypassEpoch = -1;

    for (const [id, { raw, parsed }] of entries) {
      this.bypassRaw.set(id, raw);
      this.bypassParsed.set(id, parsed);

      for (const norm of Object.keys(raw)) {
        this.bypassPropCounts.set(
          norm,
          (this.bypassPropCounts.get(norm) ?? 0) + 1,
        );
      }
    }
  }

  /** Re-resolve declared ids to live slots when the structure epoch
   * moved — O(declared ids) per structural change, amortized over the
   * writes between changes, and nothing at all when no bypass exists. */
  private rebuildBypassSlots(): void {
    const epoch = this.store.structureEpoch;

    if (epoch === this.bypassEpoch) {
      return;
    }

    this.bypassEpoch = epoch;
    this.bypassSlots.nodes.clear();
    this.bypassSlots.edges.clear();

    for (const [id, parsed] of this.bypassParsed) {
      const ref = this.store.lookup(id);

      if (ref == null) {
        continue; // declared for an id not present — inert until it is
      }

      const patch = parsed[ref.group];

      if (patch != null && patch.length > 0) {
        this.bypassSlots[ref.group].set(ref.slot, patch);
      }
    }
  }

  /** The bypass patch for a slot, or null.  O(1) after the lazy
   * epoch-checked re-resolution. */
  private bypassPatchAt(group: GroupName, slot: number): BypassPatch | null {
    this.rebuildBypassSlots();

    return this.bypassSlots[group].get(slot) ?? null;
  }

  /**
   * Clone-and-patch: the write funnel's bypass merge (round 63.3).  A
   * method rather than an inline spread so specs can count invocations
   * — a bypass-free instance must never reach it, which is the
   * performance contract's zero-cost gate made testable.
   *
   * @param computed — the slot's sheet-resolved record (never mutated)
   * @param patch — the captured field pairs for the slot's bypass
   * @returns a fresh record with the bypassed fields replaced
   */
  mergeBypass(computed: Computed, patch: BypassPatch): Computed {
    const merged = { ...computed } as unknown as Record<string, unknown>;

    for (let i = 0; i < patch.length; i++) {
      merged[patch[i][0] as string] = patch[i][1];
    }

    return merged as unknown as Computed;
  }

  /**
   * Set bypass props for one live element — the sugar path behind
   * `ele.style( name, value )` (round 63.4).  Unlike the sheet
   * section, whose entries parse against both groups because their ids
   * may not have resolved yet, this validates against the element's
   * own group, so a wrong-group prop throws with the group's own
   * message.  The slot re-applies through the normal single-slot apply
   * afterwards, which is what makes transitions and the write-funnel
   * merge ride the same path every restyle does.
   *
   * @param ref — the live element's ref (the caller validates liveness)
   * @param id — its id, the declaration key
   * @param props — prop → constant, dash-case or camelCase
   * @throws on a mapper value, a global font prop, a transition config
   *   prop, a wrong-group prop, or an invalid value
   */
  setBypass(ref: Ref, id: string, props: Record<string, unknown>): void {
    const raw: Record<string, unknown> = {};

    for (const key of Object.keys(props)) {
      raw[normalizeProp(key)] = props[key];
    }

    // validate against the element's own group before any state mutates
    captureBypassPatch(ref.group, raw);

    const prev = this.bypassRaw.get(id);
    const merged = { ...(prev ?? {}), ...raw };

    this.bypassRaw.set(id, merged);
    this.bypassParsed.set(id, this.parseBypassGroups(id, merged));

    let countsMoved = false;

    for (const norm of Object.keys(raw)) {
      if (prev == null || !(norm in prev)) {
        const n = this.bypassPropCounts.get(norm) ?? 0;

        this.bypassPropCounts.set(norm, n + 1);

        if (n === 0) {
          countsMoved = true;
        }
      }
    }

    this.refreshBypassSlot(ref, id);

    if (countsMoved) {
      this.paintVersion++;
    }

    // a first bypass on a kernel-owned channel demotes it, and the
    // kernel stops writing — every slot's stored bytes for that channel
    // must become CPU-derived, which one whole-group apply does (paid
    // once per 0→1 transition of a kernel-owned prop; never headless,
    // where nothing is kernel-owned)
    if (
      countsMoved &&
      Object.keys(raw).some((p) => this.gpuOwnedProps[ref.group].has(p))
    ) {
      this.applyBulk(ref.group, this.store.slotsOrdered(ref.group));
    } else {
      this.applyBulk(ref.group, [ref.slot]);
    }
  }

  /**
   * Remove bypass props for one live element — the path behind
   * `ele.removeStyle( name? )` (round 63.4).  Removing re-applies the
   * slot, so the sheet-resolved values return through the normal
   * funnel (transitions included).
   *
   * @param ref — the live element's ref
   * @param id — its id, the declaration key
   * @param name — the prop to remove, either spelling; omit to clear
   *   the element's whole declaration
   */
  removeBypass(ref: Ref, id: string, name?: string): void {
    const prev = this.bypassRaw.get(id);

    if (prev == null) {
      return;
    }

    let removed: string[];

    if (name == null) {
      removed = Object.keys(prev);
      this.bypassRaw.delete(id);
      this.bypassParsed.delete(id);
    } else {
      const norm = normalizeProp(name);

      if (!(norm in prev)) {
        return;
      }

      delete prev[norm];
      removed = [norm];

      if (Object.keys(prev).length === 0) {
        this.bypassRaw.delete(id);
        this.bypassParsed.delete(id);
      } else {
        this.bypassParsed.set(id, this.parseBypassGroups(id, prev));
      }
    }

    let countsMoved = false;

    for (const norm of removed) {
      const n = this.bypassPropCounts.get(norm) ?? 0;

      if (n <= 1) {
        this.bypassPropCounts.delete(norm);
        countsMoved = true;
      } else {
        this.bypassPropCounts.set(norm, n - 1);
      }
    }

    this.refreshBypassSlot(ref, id);

    if (countsMoved) {
      // a 1→0 transition hands the channel back to the kernel (it
      // re-evaluates every slot on its next dispatch, so no CPU
      // re-derive is owed here)
      this.paintVersion++;
    }

    this.applyBulk(ref.group, [ref.slot]);
  }

  /** Patch one slot's entry in the resolved maps after a sugar write —
   * only when the maps are current (stale maps re-resolve wholesale at
   * the next write anyway). */
  private refreshBypassSlot(ref: Ref, id: string): void {
    if (this.bypassEpoch !== this.store.structureEpoch) {
      return;
    }

    const parsed = this.bypassParsed.get(id);
    const patch = parsed == null ? null : parsed[ref.group];

    if (patch != null && patch.length > 0) {
      this.bypassSlots[ref.group].set(ref.slot, patch);
    } else {
      this.bypassSlots[ref.group].delete(ref.slot);
    }
  }

  /** Round 24.1: receives the diffed transition tweens — wired by the
   * core to AnimationManager.start (the round-21 eviction gives uniform
   * latest-wins); null in engine-only contexts disables capture. */
  transitionSink:
    | ((
        refs: Ref[],
        writes: ChannelWrite[],
        opts: { duration: number; delay: number; easing: string },
      ) => void)
    | null = null;

  /** value reader for mapper/condition keys ('id' is first-class, not in
   * the sidecar; the reserved '::' keys answer a case condition from the
   * flags column — the structural pair since round 14.7, the state
   * family since 57.1) */
  private readValue: ValueReader = (group, slot, key) => {
    const bit = CONDITION_FLAGS[key];

    if (bit != null) {
      // the hierarchy pair is nodes-only; an edge is neither, rather
      // than reading a bit that means nothing on its flags word
      if (group !== 'nodes' && (key === '::parent' || key === '::child')) {
        return false;
      }

      return this.store.hasFlag(group, slot, bit);
    }

    return key === 'id'
      ? this.store.idAt(group, slot)
      : this.store.data.get(group, slot, key);
  };

  /**
   * @param store — the columnar store whose channel columns this engine
   *   resolves style into
   */
  constructor(store: GraphStore) {
    this.store = store;
    this.sheet = {};

    // The readers' view of this engine.  Arrow functions capture `this`
    // directly (no alias); `store` and `defs` are accessors because
    // `defs` is replaced wholesale on a sheet swap, and a snapshot would
    // hand every reader the previous sheet's computed values.
    const ctx = {
      defFor: (ref: Ref) => this.defFor(ref),
      labelChannels: (ref: Ref) => this.labelChannels(ref),
      readImageProp: (slot: number, prop: string) =>
        this.readImageProp(slot, prop),
    } as ReadContext;

    Object.defineProperty(ctx, 'store', { get: () => this.store });
    Object.defineProperty(ctx, 'defs', { get: () => this.defs });

    this.readCtx = ctx;

    // The empty sheet, through the same path a real one takes.  This
    // used to build `defs` inline with `mappers: []` hardcoded, which
    // was harmless while every default was a constant and wrong the
    // moment one was not: round 57.1 made the default `background-color`
    // a conditional mapper, and an instance constructed without a
    // `style` option silently lost it — two paths that agreed only by
    // coincidence.  There is one path now, and "no stylesheet" is the
    // empty stylesheet.
    this.defs = null as never;
    this.setSheet({}, false);

    // a mixed column can't evaluate in the kernel: demote its group's
    // mapped channels back to eager CPU (the runtime repacks on the
    // version bump; the next mapped pass re-derives every slot)
    store.data.onPromote = (group, key) => {
      if (
        this.defs[group].deps?.has(key) &&
        this.gpuOwnedProps[group].size > 0
      ) {
        this.demoted[group] = true;
        this.paintVersion++;
      }
    };
  }

  private coreStyle: CoreStyle = { ...CORE_DEFAULTS };

  /**
   * The resolved core theming props (round 13 A2).
   *
   * @returns the live record — `setSheet` replaces it wholesale, so a
   *   held reference reads the *previous* sheet's theming after a swap
   */
  core(): CoreStyle {
    return this.coreStyle;
  }

  /**
   * Replace the stylesheet and re-apply it to every live element,
   * mapped channels included.
   *
   * The sheet is a plain `{ nodes, edges, parents, core }` object of
   * prop objects — no selector blocks, no style functions.  The
   * `parents` group overlays the `nodes` block under v3's `:parent`
   * defaults.
   *
   * @param sheet — the stylesheet to install
   * @param apply — when false, compile and validate without applying;
   *   the core uses this to defer the apply to the outermost
   *   `endBatch()` while still throwing on a bad sheet at the call site
   * @throws on an unknown sheet key, an unknown property, or an invalid
   *   value
   */
  setSheet(sheet: Stylesheet, apply: boolean = true): void {
    for (const key of Object.keys(sheet)) {
      if (!SHEET_KEYS.has(key)) {
        throw new Error(
          `Unknown stylesheet key '${key}'; supported keys: nodes, edges, parents, core, bypasses`,
        );
      }

      // v3's opaque `( ele ) => props` group form was removed by design
      // (29.3: it was silently *ignored*, so a ported v3 sheet produced
      // an unstyled graph with no error)
      if (typeof (sheet as Record<string, unknown>)[key] === 'function') {
        throw new Error(
          `The style function form ('${key}: ( ele ) => props') is not supported in v4; ` +
            `a group is a props object whose values are constants or mapper objects ` +
            `(use a 'case' mapper for conditionals and 'data(key)' scales for per-element values)`,
        );
      }
    }

    // round 63.2: validate the bypasses section before any engine state
    // mutates, so a bad entry throws with nothing half-applied
    const bypassEntries = this.validateBypasses(sheet.bypasses);

    this.coreStyle = resolveCoreProps(sheet.core);

    // the parents group (round 14.6): channel props overlay the nodes
    // block under v3's :parent defaults; the compound props split out
    // (they are per-parent auto-bounds inputs, not channels)
    const parentsSplit = splitCompoundProps(sheet.parents ?? {});

    const compile = (group: GroupName, def: Stylesheet['nodes']): GroupDef => {
      // the transition config props are engine config, not channels
      // (round 24.1) — split them out before channel resolution
      const { channels, config } = splitTransitionProps(def ?? {});
      const transition = parseTransitionSpec(group, config);
      const mappers: BoundMapper[] = [];
      const computed = this.resolveConst(group, channels, mappers);

      // which mutable data() keys the group's style derives from — the
      // data-write refresh gate (id is immutable and never registers)
      let deps: GroupDef['deps'] = null;
      const dep = (key: string, what: 'label' | 'mappers' | 'chart'): void => {
        if (key === 'id') {
          return;
        }

        deps ??= new Map();

        const entry = deps.get(key) ?? {
          label: false,
          mappers: false,
          chart: false,
        };

        entry[what] = true;
        deps.set(key, entry);
      };

      if (computed.labelKey != null) {
        dep(computed.labelKey, 'label');
      }
      if (computed.sourceLabelKey != null) {
        dep(computed.sourceLabelKey, 'label');
      }
      if (computed.targetLabelKey != null) {
        dep(computed.targetLabelKey, 'label');
      }
      if (computed.chartValuesKey != null) {
        dep(computed.chartValuesKey, 'chart');
      }

      for (const bm of mappers) {
        for (const key of bm.m.keys) {
          dep(key, 'mappers');
        }
      }

      return {
        computed,
        mappers,
        deps,
        transition,
        partition: partitionOf(mappers),
      };
    };

    // v4's default stylesheet goes *first*, so anything the user's own
    // block declares replaces it — v3's order-based precedence, spelled
    // as an object spread (round 57.1)
    const defs = {
      nodes: compile('nodes', {
        ...NODE_DEFAULT_BLOCK,
        ...(sheet.nodes ?? {}),
      }),
      edges: compile('edges', {
        ...EDGE_DEFAULT_BLOCK,
        ...(sheet.edges ?? {}),
      }),
      // v3 precedence is order-based, not specificity-based: the default
      // :parent block sits before the user stylesheet, so a user nodes
      // block overrides it (parity-pinned), and the user parents block
      // overrides everything
      parents: compile('nodes', {
        ...NODE_DEFAULT_BLOCK,
        ...PARENT_CHANNEL_OVERLAY,
        ...(sheet.nodes ?? {}),
        ...parentsSplit.channels,
      }),
    };

    this.parentCompound = { padding: 10, ...parentsSplit.compound };

    // channels the parents def resolves differently from the nodes def:
    // default-overlay keys the user nodes block does NOT override, plus
    // everything in the user parents block (the GPU demotion set)
    const nodeKeys = new Set(Object.keys(sheet.nodes ?? {}).map(normalizeProp));

    this.parentsOverride = new Set([
      ...Object.keys(PARENT_CHANNEL_OVERLAY)
        .map(normalizeProp)
        .filter((k) => !nodeKeys.has(k)),
      ...Object.keys(parentsSplit.channels).map(normalizeProp),
    ]);

    // which arrow ends can any edge have at all — the renderer skips whole
    // arrow draw calls per end when nothing enables it; a mapped arrow
    // shape conservatively enables its end (per-element arrows still
    // collapse in the shader via zero alpha)
    const mapsProp = (def: GroupDef, prop: string): boolean =>
      def.mappers.some((bm) => bm.m.prop === prop);

    // any non-'none' shape draws (the pre-round-10 gate checked
    // 'triangle' only — a latent bug for constant vee/chevron/... sheets)
    this.arrows = {
      source:
        defs.edges.computed.sourceArrowShape !== 'none' ||
        mapsProp(defs.edges, 'source-arrow-shape'),
      target:
        defs.edges.computed.targetArrowShape !== 'none' ||
        mapsProp(defs.edges, 'target-arrow-shape'),
    };
    this.midArrows = {
      source:
        defs.edges.computed.midSourceArrowShape !== 'none' ||
        mapsProp(defs.edges, 'mid-source-arrow-shape'),
      target:
        defs.edges.computed.midTargetArrowShape !== 'none' ||
        mapsProp(defs.edges, 'mid-target-arrow-shape'),
    };

    this.sheet = sheet;
    this.defs = defs;

    // global: routes to the atlas and marks every labelled node
    // label-dirty (metrics change), applied even while batching — the
    // deferred flush re-lays-out against current entries anyway
    this.store.setLabelFont(
      defs.nodes.computed.fontFamily,
      defs.nodes.computed.fontStyle,
      defs.nodes.computed.fontWeight,
    );

    // the store coalesces write spans for paint-mapped keys so the GPU
    // eval pass knows what to re-evaluate without a CPU restyle; owned
    // props reset until the runtime re-configures against the new sheet.
    // Only single-key scale mappers can be GPU-evaluated — conditionals
    // (case, '' key / multi-key) stay CPU-evaluated, so they aren't watched.
    for (const group of ['nodes', 'edges'] as const) {
      this.store.watchDataKeys(
        group,
        defs[group].mappers
          .filter(
            (bm) =>
              PAINT_PROPS[group].has(bm.m.prop) && bm.m.program.kind !== 'case',
          )
          .map((bm) => bm.m.key),
      );
      // the state half (round 57.1): which reserved keys any `case`
      // condition reads, so the store's flag writes know whether a flip
      // needs a restyle.  Nodes fold the parents def — a rule that only
      // applies to compound parents still has to fire when the bit moves
      // on one.
      const states = new Set<string>();

      for (const key of CONDITION_KEY_SET) {
        if (
          defs[group].deps?.has(key) === true ||
          (group === 'nodes' && defs.parents.deps?.has(key) === true)
        ) {
          states.add(key);
        }
      }

      this.store.watchStateKeys(group, states);
      this.gpuOwnedProps[group] = new Set();
    }

    // whole-replace, like every other section (the keep-them idiom is
    // spreading the exported sheet); setSheet's paintVersion bump below
    // already covers any kernel-ownership change this implies
    this.installBypasses(bypassEntries);

    this.paintVersion++;

    if (apply) {
      this.applyAll();
    }
  }

  /**
   * Paint-channel mappers with resolved fallbacks (the runtime's pack
   * input).  A mapped arrow *shape* demotes all edge paint to the CPU:
   * the shape gates the stored arrow alpha, and splitting that fold
   * between CPU and kernel would race.
   *
   * @param group — the element group to collect for
   * @returns each eligible mapper with the fallback its channel resolves to
   */
  paintInputs(group: GroupName): { m: CompiledMapper; fallback: Evaluated }[] {
    const def = this.defs[group];

    if (
      group === 'edges' &&
      def.mappers.some((bm) => bm.m.prop.endsWith('-arrow-shape'))
    ) {
      return [];
    }

    // B1: the channel-opacity split folds into stored alphas at write
    // time, so a kernel colour program has to fold the same factor or it
    // overwrites the folded bytes.  Round 66.3: when the channel opacity
    // is a **constant** the kernel does exactly that — the multiplier
    // rides the program as `alphaMul` and the shader applies it
    // (`domain.w`), which is the mechanism the arrow programs have used
    // since round 13.  Only a *mapped* channel opacity still demotes: its
    // value varies per element, and evaluating it in the kernel is a
    // separate question (the state `case` form, which these sheets use,
    // is not packable at all).
    const computed = def.computed;
    const mapped = (prop: string): boolean =>
      def.mappers.some((bm) => bm.m.prop === prop);
    const demoted = new Set<string>();

    if (group === 'nodes') {
      if (mapped('background-opacity')) {
        demoted.add('background-color');
      }

      if (mapped('border-opacity')) {
        demoted.add('border-color');
      }

      // round 14.4: under compounds the stored node opacity is the
      // ancestor-folded product — a kernel-owned opacity would
      // overwrite the fold, so it stays CPU-evaluated.  Round 14.6:
      // channels the parents overlay resolves differently would be
      // repainted with the nodes value by the kernel (it evaluates
      // every slot), so they demote too.
      if (this.store.hasCompounds()) {
        demoted.add('opacity');

        for (const p of this.parentsOverride) {
          demoted.add(p);
        }
      }
    } else {
      if (mapped('line-opacity')) {
        demoted.add('line-color');
        demoted.add('source-arrow-color');
        demoted.add('target-arrow-color');
      }

      // B4: the casing alpha folds the element opacity at write time,
      // so a kernel-owned opacity would leave stale casing bytes
      if (computed.lineOutlineWidth > 0 || mapped('line-outline-width')) {
        demoted.add('opacity');
      }
    }

    // round 63.3: a channel carrying a bypass demotes while any exists —
    // the kernel evaluates every slot and would overwrite the bypassed
    // slot's stored bytes on its next dispatch.  Count-gated and
    // reversible: the last removal (or a sheet swap without the entry)
    // restores kernel ownership through the paintVersion bump.
    for (const [prop, n] of this.bypassPropCounts) {
      if (n > 0) {
        demoted.add(prop);
      }
    }

    // round 24.2: a listed transition prop's diff reads *stored truth*
    // on the CPU, which is stale exactly when the eval kernel owns the
    // channel — so transitions and kernel ownership are mutually
    // exclusive per channel (the tween itself still rides the GPU tween
    // kernels; only the mapper eval stays CPU).  Under compounds the
    // parents overlay's spec demotes too (parent slots diff through it).
    if (def.transition.duration > 0) {
      for (const p of def.transition.props) {
        demoted.add(p);
      }
    }

    if (
      group === 'nodes' &&
      this.store.hasCompounds() &&
      this.defs.parents.transition.duration > 0
    ) {
      for (const p of this.defs.parents.transition.props) {
        demoted.add(p);
      }
    }

    return def.mappers
      .filter(
        (bm) => PAINT_PROPS[group].has(bm.m.prop) && !demoted.has(bm.m.prop),
      )
      .map((bm) => ({
        m: bm.m,
        fallback: bm.m.fallback ?? bm.channel.default(group),
        alphaMul: constOpacityFor(group, bm.m.prop, computed),
      }));
  }

  /**
   * Edge-sheet constants for the kernel's arrow-alpha folding.
   *
   * @param group — the element group to read the sheet for
   * @returns the constants the kernel needs to fold arrow alpha itself
   */
  paintContext(group: GroupName): {
    opacityMapped: boolean;
    constOpacity: number;
    source: { enabled: boolean; colorMapped: boolean; constColor: RGBA };
    target: { enabled: boolean; colorMapped: boolean; constColor: RGBA };
  } | null {
    const def = this.defs.edges;

    if (group !== 'edges' || def.computed == null) {
      return null;
    }

    const computed = def.computed;
    const mapped = (prop: string): boolean =>
      def.mappers.some((bm) => bm.m.prop === prop);
    // B1: the kernel's arrow fold multiplies by the *element* opacity;
    // line-opacity folds at write time, and a non-default constant
    // rides constOpacity (a mapped line-opacity demotes arrows in
    // paintInputs, so it never reaches the kernel)

    return {
      opacityMapped: mapped('opacity'),
      constOpacity: computed.opacity * computed.lineOpacity,
      source: {
        enabled: computed.sourceArrowShape === 'triangle',
        colorMapped: mapped('source-arrow-color'),
        constColor: computed.sourceArrowColor,
      },
      target: {
        enabled: computed.targetArrowShape === 'triangle',
        colorMapped: mapped('target-arrow-color'),
        constColor: computed.targetArrowColor,
      },
    };
  }

  /**
   * The runtime reports which props its kernel evaluates: the data-write
   * refresh skips their CPU evaluation (the whole point of GPU eval) and
   * the read-back getters evaluate the shared IR lazily instead of
   * trusting the stale stored bytes.
   *
   * @param group — the element group the kernel runs over
   * @param props — the props it evaluates; replaces the previous set
   */
  setGpuOwned(group: GroupName, props: Iterable<string>): void {
    this.gpuOwnedProps[group] = new Set(props);
  }

  /**
   * Whether a data write can change the group's computed style — the gate
   * that keeps an unrelated write from costing a restyle.
   *
   * @param group — the element group being written
   * @param keys — the data() keys the write touches
   * @returns true when any mapped channel or label depends on one of them
   */
  stylesDependOnData(group: GroupName, keys: string[]): boolean {
    // plain loops, no closures: this gate runs twice on every data()
    // write, and the closure-per-call form cost 700 ns through tsx
    // (the round-34 __name tax) against 41 through the bundle (62.3)
    const own = this.defs[group].deps;

    if (own != null) {
      for (let i = 0; i < keys.length; i++) {
        if (own.has(keys[i])) {
          return true;
        }
      }
    }

    if (group === 'nodes' && this.store.hasCompounds()) {
      const parents = this.defs.parents.deps;

      if (parents != null) {
        for (let i = 0; i < keys.length; i++) {
          if (parents.has(keys[i])) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Whether the current sheet styles a flag state — i.e. whether
   * flipping that bit has to restyle at all.  Every flag-write choke
   * point asks this before doing any work, so a sheet that says nothing
   * about a state pays one Set lookup when it changes.
   *
   * v4's default stylesheet says yes for two of them.  Selection: nodes'
   * `background-color`, edges' `line-color` and the four arrow colours
   * are `{ selected: true }` case mappers.  Press: the `overlay-*` props
   * are `{ active: true }` ones.  A sheet that declares those props
   * replaces the rule and the state becomes free again — which is the
   * same trade round 4 made when v4 still had `:selected` blocks,
   * arriving from the other direction.
   *
   * @param group — the element group whose flag is changing
   * @param key — the reserved condition key, e.g. `'::selected'`
   * @returns true when the change must re-evaluate mappers
   */
  dependsOnState(group: GroupName, key: string): boolean {
    return this.stylesDependOnData(group, [key]);
  }

  /**
   * Whether the eval kernel currently owns this prop's stored bytes —
   * the gate a direct column read carries so it never reports a value
   * a kernel has made stale (round 62.6; the same rule readProp keeps).
   *
   * @param group — the element group
   * @param prop — the normalized property name
   * @returns true when the prop is kernel-owned
   */
  ownsProp(group: GroupName, prop: string): boolean {
    return this.gpuOwnedProps[group].has(prop);
  }

  /** Which arrow ends the current stylesheet can enable. */
  get arrowEnds(): { source: boolean; target: boolean } {
    return this.arrows;
  }

  /**
   * Which mid-edge arrow ends the current sheet can enable.  The
   * renderer skips the mid-arrow draw entirely when neither is
   * possible.
   */
  get midArrowEnds(): { source: boolean; target: boolean } {
    return this.midArrows;
  }

  /**
   * The installed stylesheet, as given.  Part of `cy.json()`'s export.
   *
   * @returns the sheet object (live, not a copy — treat as read-only)
   */
  json(): Stylesheet {
    // round 63.2: the bypasses section reflects the *live* declarations
    // (sheet section plus sugar writes), not the object the sheet was
    // set with — and is omitted entirely when none exist
    const { bypasses: _stale, ...rest } = this.sheet as Stylesheet & {
      bypasses?: unknown;
    };

    if (this.bypassRaw.size === 0) {
      return rest;
    }

    const bypasses: Record<string, Record<string, unknown>> = {};

    for (const [id, props] of this.bypassRaw) {
      bypasses[id] = { ...props };
    }

    return { ...rest, bypasses } as Stylesheet;
  }

  /** Re-apply the current sheet (e.g. to re-snapshot live auto-domain extents). */
  update(): void {
    this.applyAll();
  }

  /**
   * Apply the sheet across every live element of both groups.  This is
   * the whole-graph pass a sheet change or a batch flush runs.
   */
  applyAll(): void {
    this.applyBulk('nodes', this.store.slotsOrdered('nodes'));
    this.applyBulk('edges', this.store.slotsOrdered('edges'));
  }

  /**
   * Bulk apply over *live* slots of one group.  The group resolves once
   * (the per-element cost is only the column writes); mapped channels
   * evaluate per element in applyMapped.
   *
   * @param group — the element group to style
   * @param slots — the live slots to write; must all be of that group
   */
  applyBulk(group: GroupName, slots: ArrayLike<number>): void {
    if (slots.length === 0) {
      return;
    }

    if (group === 'nodes' && this.store.hasCompounds()) {
      // parents resolve through the overlay def (round 14.6)
      const flags = this.store.column('node.flags') as Uint32Array;
      const leaves: number[] = [];
      const parents: number[] = [];

      for (let i = 0; i < slots.length; i++) {
        ((flags[slots[i]] & FLAG_PARENT) !== 0 ? parents : leaves).push(
          slots[i],
        );
      }

      if (leaves.length > 0) {
        this.applyGroupDef('nodes', this.defs.nodes, leaves);
      }

      if (parents.length > 0) {
        const def = this.defs.parents;
        // padding transitions (25.4): the compound-style write sits
        // outside the write() funnel, so it takes its own capture.
        // The styled marks are read before the channel pass marks
        // fresh slots (instant-on-add must hold for padding too).
        const txn = this.openTxn('nodes', def);
        const styledBefore =
          txn != null && txn.padding
            ? parents.map((slot) => this.wasStyled('nodes', slot))
            : null;

        try {
          // the inner openTxn no-ops while this capture is open, so
          // the channel diffs land in the same preset animation
          this.applyGroupDef('nodes', def, parents);

          for (let i = 0; i < parents.length; i++) {
            this.applyCompoundStyle(
              txn,
              parents[i],
              styledBefore == null ? false : styledBefore[i],
            );
          }
        } finally {
          this.closeTxn(txn);
        }
      }

      return;
    }

    this.applyGroupDef(group, this.defs[group], slots);
  }

  /**
   * The parents' compound-style write with the padding transition
   * capture (round 25.4): diff the declared padding around the sheet
   * write, snap on a px↔% unit flip (tweening across units has no
   * meaning — recorded), and restore the held pre-restyle value
   * (CSS's delay rule, like the channel diffs).
   */
  private applyCompoundStyle(
    txn: TxnCapture | null,
    slot: number,
    styled: boolean,
  ): void {
    const store = this.store;

    if (txn == null || !txn.padding || !styled) {
      store.setCompoundStyle(slot, this.parentCompound);

      return;
    }

    const before = store.compoundStyleOf(slot);

    store.setCompoundStyle(slot, this.parentCompound);

    const after = store.compoundStyleOf(slot);

    if (
      after.paddingUnit !== before.paddingUnit ||
      after.padding === before.padding
    ) {
      return;
    }

    let entry = txn.entries.get('node.padding');

    if (entry == null) {
      entry = {
        column: 'node.padding',
        kind: 'padding',
        paint: false,
        min: 0,
        max: Infinity,
        refs: [],
        from: [],
        to: [],
      };
      txn.entries.set('node.padding', entry);
    }

    entry.refs.push(store.ref('nodes', slot));
    entry.from.push(before.padding);
    entry.to.push(after.padding);

    store.updateCompoundStyle(slot, { padding: before.padding });
  }

  private applyGroupDef(
    group: GroupName,
    def: GroupDef,
    slots: ArrayLike<number>,
  ): void {
    const txn = this.openTxn(group, def);

    try {
      if (def.mappers.length > 0) {
        this.applyMapped(group, def, slots);
      } else {
        const computed = def.computed;

        // no mappers: nothing varies, so the run needs no writers
        if (this.bulkEdgeRun(group, slots)) {
          this.applyBulkEdges(slots, computed, [], [], []);
        } else {
          for (let i = 0; i < slots.length; i++) {
            this.write(group, slots[i], computed);
          }
        }
      }
    } finally {
      this.closeTxn(txn);
    }
  }

  // -- transitions (round 24.1) --

  /**
   * Open a transition capture for one group-def apply pass: every
   * already-styled slot the pass writes gets its tweenable channels
   * diffed on stored truth.  Null (capture off) when nothing can
   * transition — unconfigured specs cost nothing.
   */
  private openTxn(group: GroupName, def: GroupDef): TxnCapture | null {
    const spec = def.transition;

    if (this.transitionSink == null || this.txn != null) {
      return null;
    }
    if (spec.duration <= 0 || spec.props.length === 0) {
      return null;
    }

    const table = TRANSITION_CHANNELS[group];
    const channels: TxnCapture['channels'] = [];

    for (const prop of spec.props) {
      const ch = table[prop];

      // props with no tweenable channel (discrete) snap — the apply
      // pass already wrote them, so snapping is doing nothing here
      if (ch != null) {
        channels.push({ main: ch, rides: ch.rides ?? [] });
      }
    }

    // compound padding (25.4) diffs in the parents' compound-style
    // write, not the channel funnel — flag it as listed
    const padding = group === 'nodes' && spec.props.includes('padding');

    if (channels.length === 0 && !padding) {
      return null;
    }

    this.txn = { group, spec, channels, entries: new Map(), padding };

    return this.txn;
  }

  /** Close a capture: pack the accumulated diffs into bulk ChannelWrites
   * (one per column — never per-element animations) and hand them to the
   * sink as one transition animation. */
  private closeTxn(txn: TxnCapture | null): void {
    if (txn == null) {
      return;
    }

    this.txn = null;

    if (txn.entries.size === 0) {
      return;
    }

    const writes: ChannelWrite[] = [];
    const refs: Ref[] = [];
    const seen = new Set<number>();

    for (const e of txn.entries.values()) {
      writes.push(
        buildChannelWrite(
          e.column,
          e.kind,
          e.paint,
          e.refs,
          e.from,
          e.to,
          e.min,
          e.max,
          e.lane,
        ),
      );

      for (const ref of e.refs) {
        if (!seen.has(ref.slot)) {
          seen.add(ref.slot);
          refs.push(ref);
        }
      }
    }

    this.transitionSink!(refs, writes, {
      duration: txn.spec.duration,
      delay: txn.spec.delay,
      easing: txn.spec.easing,
    });
  }

  private readTxnValue(ch: TxnChannelDesc, slot: number): number | RGBA {
    if (ch.kind === 'scalar') {
      return (this.store.column(ch.column as ColumnId) as Float32Array)[slot];
    }

    if (ch.kind === 'fontSize') {
      // -1 = no sidecar entry (unlabelled); a diff with a sentinel on
      // either side snaps rather than tweening from/to nothing
      const stream = ch.column === 'node.fontSize' ? 'nodes' : 'edges';

      return this.store.labelAt(slot, stream)?.fontSize ?? -1;
    }

    if (ch.kind === 'lane') {
      // the edge layer records hold their stroke in lane 1, ×256
      // fixed-point (matching setLane's encode)
      if (
        ch.column === 'edge.casing' ||
        ch.column === 'edge.overlay' ||
        ch.column === 'edge.underlay'
      ) {
        return (
          (this.store.column(ch.column) as Uint32Array)[slot * 2 + 1] / 256
        );
      }

      const arr = this.store.column(ch.column as ColumnId) as Float32Array;

      return arr[
        slot * columnSpec(ch.column as ColumnId).components +
          (ch.lane as number)
      ];
    }

    const bytes = this.store.column(ch.column as ColumnId) as Uint8Array;
    const i = slot * 4;

    return [bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]];
  }

  /** Pre-write snapshot of one slot's capture channels (mains + rides). */
  private txnPre(txn: TxnCapture, slot: number): (number | RGBA)[] {
    const out: (number | RGBA)[] = [];

    for (const { main, rides } of txn.channels) {
      out.push(this.readTxnValue(main, slot));

      for (const r of rides) {
        out.push(this.readTxnValue(r, slot));
      }
    }

    return out;
  }

  /**
   * Post-write diff of one slot: record each moved channel (from = the
   * snapshot, to = the newly stored value) and *restore* the old value —
   * the store holds the pre-restyle state until the tween's first
   * post-delay tick, so sync reads during a transition-delay report the
   * old value (CSS's rule) and no frame can flash the target.
   */
  private txnPost(
    txn: TxnCapture,
    group: GroupName,
    slot: number,
    pre: (number | RGBA)[],
  ): void {
    let i = 0;
    let ref: Ref | null = null;

    const record = (
      ch: TxnChannelDesc,
      from: number | RGBA,
      to: number | RGBA,
    ): void => {
      ref ??= this.store.ref(group, slot);

      const key = ch.lane == null ? ch.column : `${ch.column}:${ch.lane}`;
      let entry = txn.entries.get(key);

      if (entry == null) {
        entry = {
          column: ch.column,
          kind: ch.kind,
          lane: ch.lane,
          paint: ch.paint,
          min: ch.min,
          max: ch.max,
          refs: [],
          from: [],
          to: [],
        };
        txn.entries.set(key, entry);
      }

      entry.refs.push(ref);
      entry.from.push(from);
      entry.to.push(to);

      if (ch.kind === 'scalar') {
        this.store.setScalar(ch.column as ColumnId, slot, from as number);
      } else if (ch.kind === 'lane') {
        // the lane restore runs the full cascade (a node.size restore
        // re-anchors the label the apply pass just baked at the target)
        this.store.setLane(
          ch.column as ColumnId,
          slot,
          ch.lane as number,
          from as number,
        );
      } else if (ch.kind === 'fontSize') {
        this.store.setLabelFontSize(
          slot,
          ch.column === 'node.fontSize' ? 'nodes' : 'edges',
          from as number,
        );
      } else {
        const [r, g, b, a] = from as RGBA;

        this.store.setColor(ch.column as ColumnId, slot, r, g, b, a);
      }
    };

    const eq = (
      ch: TxnChannelDesc,
      a: number | RGBA,
      b: number | RGBA,
    ): boolean =>
      ch.kind === 'color'
        ? rgbaEq(a as RGBA, b as RGBA)
        : (a as number) === (b as number);

    // a compound parent's size is auto-bounds-derived: its lanes never
    // record (the tween would fight the derivation — round 25.3)
    const isParentSlot =
      group === 'nodes' &&
      this.store.hasCompounds() &&
      this.store.hasFlag('nodes', slot, FLAG_PARENT);

    for (const { main, rides } of txn.channels) {
      const from = pre[i++];
      const to = this.readTxnValue(main, slot);
      const skip =
        (isParentSlot && main.column === 'node.size') ||
        // a fontSize sentinel on either side means no sidecar entry to
        // tween from/to — the label change snaps (25.5)
        (main.kind === 'fontSize' &&
          ((from as number) < 0 || (to as number) < 0));
      const changed = !skip && !eq(main, from, to);

      if (changed) {
        record(main, from, to);
      }

      for (const r of rides) {
        const rideFrom = pre[i++];

        if (!changed) {
          continue;
        } // rides move only with their main channel

        const rideTo = this.readTxnValue(r, slot);

        if (!eq(r, rideFrom, rideTo)) {
          record(r, rideFrom, rideTo);
        }
      }
    }
  }

  private wasStyled(group: GroupName, slot: number): boolean {
    const arr = this.styledGen[group];

    return (
      slot < arr.length && arr[slot] === this.store.table(group).gen[slot] + 1
    );
  }

  private markStyled(group: GroupName, slot: number): void {
    let arr = this.styledGen[group];

    if (slot >= arr.length) {
      const next = new Uint32Array(Math.max(16, arr.length * 2, slot + 1));

      next.set(arr);
      arr = next;
      this.styledGen[group] = arr;
    }

    arr[slot] = this.store.table(group).gen[slot] + 1;
  }

  /** Slot compaction: live elements moved (and took fresh generations) —
   * refresh the styled marks over the live slots, all of which have been
   * styled (style applies on add, and compaction never runs mid-batch). */
  onCompacted(): void {
    for (const group of ['nodes', 'edges'] as const) {
      const table = this.store.table(group);
      const arr = this.styledGen[group];

      arr.fill(0);

      for (const slot of this.store.slotsOrdered(group)) {
        if (slot < arr.length) {
          arr[slot] = table.gen[slot] + 1;
        }
      }
    }
  }

  /** The group def resolving one element: the parents overlay for parent
   * nodes (round 14.6), else the element's own group. */
  private defFor(ref: Ref): GroupDef {
    if (
      ref.group === 'nodes' &&
      this.store.hasCompounds() &&
      this.store.hasFlag('nodes', ref.slot, FLAG_PARENT)
    ) {
      return this.defs.parents;
    }

    return this.defs[ref.group];
  }

  /** All live slots the given def styles (partitioned under compounds). */
  private allSlotsFor(group: GroupName, def: GroupDef): number[] {
    const all = this.store.slotsOrdered(group);

    if (group !== 'nodes' || !this.store.hasCompounds()) {
      return all;
    }

    const wantParents = def === this.defs.parents;
    const flags = this.store.column('node.flags') as Uint32Array;

    return all.filter(
      (slot) => ((flags[slot] & FLAG_PARENT) !== 0) === wantParents,
    );
  }

  /**
   * Scratch-evaluate every mapped channel and write whole elements — the
   * per-channel write would break the cross-channel couplings that live
   * in write() (circle collapse, arrow-alpha folding, the label anchor).
   * Live auto-domain extents re-check here; a changed extent escalates
   * the pass to the whole group (every slot's mapping moved).
   */
  private applyMapped(
    group: GroupName,
    def: GroupDef,
    slots: ArrayLike<number>,
    skipOwned: boolean = false,
  ): void {
    const store = this.store;

    if (this.demoted[group]) {
      // formerly kernel-owned bytes are stale everywhere: one full CPU
      // pass re-derives them; ownership stays clear until the runtime
      // re-configures against the mixed column
      this.demoted[group] = false;
      this.gpuOwnedProps[group] = new Set();
      slots = this.allSlotsFor(group, def);
      skipOwned = false;
    }

    if (def.partition != null) {
      this.applyPartitioned(group, def, slots);

      return;
    }

    const target = this.checkAutoExtents(group, def)
      ? this.allSlotsFor(group, def)
      : slots;

    // one scratch record: every evaluated channel is reassigned per slot
    // and the rest keep the constant base.  GPU-owned channels skip CPU
    // evaluation on data-write refreshes (the kernel re-derives them);
    // their stored bytes go stale, which the getters compensate for.
    const owned = this.gpuOwnedProps[group];
    const active = skipOwned
      ? def.mappers.filter((bm) => !owned.has(bm.m.prop))
      : def.mappers;
    const scratch: Computed = { ...def.computed };
    const bind = (bm: BoundMapper): Evaluator => ({
      set: bm.channel.set,
      ev: bindEvaluator(
        bm.m,
        store.data,
        group,
        bm.channel.default(group),
        this.readValue,
      ),
    });

    // Round 66.1: the state-only `case` mappers still hoist, even though
    // a data mapper in the same group denied the whole def the round-57.1
    // partition.  Their value is a function of `flags & mask` alone, so
    // re-running them only when that word changes is the same work the
    // partition does — and at rest the word never changes at all, so a
    // sheet's selection affordances cost one evaluation for the group
    // rather than one per element.  `partitionOf`'s comment used to say
    // there was nothing to win here; measured on the 465k-edge harness
    // fixture, two `{ selected: true }` opacity clauses were ~50 ms.
    const stateMask = active.reduce((m, bm) => m | stateOnlyMask(bm), 0);
    const stateEvals: Evaluator[] = [];
    const evals: Evaluator[] = [];

    for (const bm of active) {
      (stateOnlyMask(bm) !== 0 ? stateEvals : evals).push(bind(bm));
    }

    const flagsCol =
      stateEvals.length > 0
        ? (store.column(
            group === 'nodes' ? 'node.flags' : 'edge.flags',
          ) as Uint32Array)
        : null;
    let lastWord = -1;

    // round 67.2: a contiguous run of edges whose per-element variation
    // is confined to props with narrow writers takes the whole styled
    // record from one template slot
    if (this.bulkEdgeRun(group, target)) {
      const writers = this.bulkEdgeWriters(
        group,
        active,
        flagsCol == null || this.uniformMaskedWord(target, flagsCol, stateMask),
      );

      if (writers != null) {
        this.applyBulkEdges(target, scratch, evals, stateEvals, writers);

        return;
      }
    }

    for (let i = 0; i < target.length; i++) {
      const slot = target[i];

      if (flagsCol != null) {
        const word = flagsCol[slot] & stateMask;

        if (word !== lastWord) {
          lastWord = word;

          for (let j = 0; j < stateEvals.length; j++) {
            stateEvals[j].set(scratch, stateEvals[j].ev(slot));
          }
        }
      }

      for (let j = 0; j < evals.length; j++) {
        evals[j].set(scratch, evals[j].ev(slot));
      }

      this.write(group, slot, scratch);
    }
  }

  /**
   * The structural half of the bulk-edge gate (round 67.2): whether this
   * run *could* be written from one template slot and filled.
   *
   * Nodes decline outright — their branch hands out per-slot blob
   * records (custom polygons, images, charts) whose refs a copy would
   * alias.  The rest is what the fill needs: enough slots to pay for the
   * scans, one contiguous ascending range so each column is a single
   * `copyWithin` chain, no open transition capture (which diffs per
   * slot) and no per-element bypasses.
   *
   * `bulkEdgeWriters` carries the other half — what the *mappers* allow.
   *
   * @param group — the group being applied
   * @param slots — the run, in apply order
   * @returns whether the structural preconditions hold
   */
  private bulkEdgeRun(group: GroupName, slots: ArrayLike<number>): boolean {
    if (
      group !== 'edges' ||
      slots.length < BULK_MIN_RUN ||
      this.txn != null || // a transition capture diffs per slot
      this.bypassRaw.size > 0 // a bypassed slot is not the template's
    ) {
      return false;
    }

    // contiguous and ascending, so the fill is one memmove per column
    const first = slots[0];

    for (let i = 1; i < slots.length; i++) {
      if (slots[i] !== first + i) {
        return false;
      }
    }

    return true;
  }

  /** Whether every slot in the run carries the same masked flag word —
   * i.e. whether anything reading state alone can vary across it.  True
   * at rest, which is what a freshly loaded graph is. */
  private uniformMaskedWord(
    slots: ArrayLike<number>,
    flags: Uint32Array,
    mask: number,
  ): boolean {
    const word = flags[slots[0]] & mask;

    for (let i = 1; i < slots.length; i++) {
      if ((flags[slots[i]] & mask) !== word) {
        return false;
      }
    }

    return true;
  }

  /**
   * The narrow writers a bulk edge run needs, or null when the run's
   * mappers rule the route out (round 67.2).  `bulkEdgeRun` carries the
   * structural half of the gate.
   *
   * The route writes one template slot and fills every
   * `EDGE_STYLE_COLUMNS` column from it, so it is admissible exactly
   * when each mapped prop either
   *
   *   1. has a `fastStateWriter` — which by round 61's invariant writes
   *      *every* column that prop affects, so the fill's value for it is
   *      overwritten per slot; or
   *   2. reads state flags only, over a run whose masked flag word never
   *      changes — then its value is the template's for every slot and
   *      the fill is already right.  This is the clause that matters in
   *      practice: a freshly loaded graph has nothing selected, so the
   *      selection affordances this repo's sheets map (`line-opacity`,
   *      which has no narrow writer and could not have one without the
   *      whole B1 fold cluster) cost the route nothing.
   *
   * Anything else declines and the ordinary per-element loop runs.
   *
   * @param group — the group being applied
   * @param active — the mappers this pass will evaluate
   * @param uniformState — whether the run's masked flag word is constant
   * @returns the writers to run per slot, or null to decline
   */
  private bulkEdgeWriters(
    group: GroupName,
    active: BoundMapper[],
    uniformState: boolean,
  ): StateWriter[] | null {
    const writers: StateWriter[] = [];

    for (const bm of active) {
      const writer = this.fastStateWriter(group, bm.m.prop);

      if (writer != null) {
        writers.push(writer);

        continue;
      }

      if (stateOnlyMask(bm) !== 0 && uniformState) {
        continue; // constant over this run; the fill carries it
      }

      return null;
    }

    return writers;
  }

  /**
   * Apply a contiguous edge run from one template slot (round 67.2).
   *
   * The template takes the ordinary `write()`, so every side effect the
   * edge branch has — the arrow-scale and arrow-width meters, the curve
   * record, the label sidecar, the transition-free channel funnel —
   * happens exactly as it always did.  `replicateEdgeStyle` then fills
   * every style-owned column from it, and each remaining slot pays only
   * its own mapped props (through the narrow writers) plus the per-slot
   * half of the edge branch.
   *
   * Measured on a 464,657-edge fixture: 26 ns per `setScalar` against
   * 0.1 ns per element for the fill.
   */
  private applyBulkEdges(
    slots: ArrayLike<number>,
    scratch: Computed,
    evals: Evaluator[],
    stateEvals: Evaluator[],
    writers: StateWriter[],
  ): void {
    this._bulkRuns++;

    const first = slots[0];
    const n = slots.length;

    for (let j = 0; j < stateEvals.length; j++) {
      stateEvals[j].set(scratch, stateEvals[j].ev(first));
    }
    for (let j = 0; j < evals.length; j++) {
      evals[j].set(scratch, evals[j].ev(first));
    }

    this.write('edges', first, scratch);
    this.store.replicateEdgeStyle(first, n);

    for (let i = 1; i < n; i++) {
      const slot = slots[i];

      for (let j = 0; j < evals.length; j++) {
        evals[j].set(scratch, evals[j].ev(slot));
      }
      for (let j = 0; j < writers.length; j++) {
        writers[j](slot, scratch);
      }

      this.writeEdgePerSlot(slot, scratch);
      this.markStyled('edges', slot);
    }
  }

  /**
   * Apply a group whose mappers read only state flags: one record per
   * distinct flag combination, cached on the def, instead of a program
   * run per element.
   *
   * The cache is unbounded in principle and tiny in practice — its size
   * is 2^(number of distinct bits the sheet's conditions read), and a
   * sheet reads one or two.  It lives on the def, so a sheet swap
   * discards it with the def that built it.
   */
  private applyPartitioned(
    group: GroupName,
    def: GroupDef,
    slots: ArrayLike<number>,
  ): void {
    const part = def.partition as NonNullable<GroupDef['partition']>;
    const flags = this.store.column(
      group === 'nodes' ? 'node.flags' : 'edge.flags',
    ) as Uint32Array;

    // round 67.2: at rest every slot carries the same masked word — a
    // freshly loaded graph has nothing selected — so the whole run
    // resolves to one record and takes the bulk route with no writers
    if (
      this.bulkEdgeRun(group, slots) &&
      this.uniformMaskedWord(slots, flags, part.mask)
    ) {
      this.applyBulkEdges(
        slots,
        this.partRecordFor(group, def, part, flags[slots[0]] & part.mask),
        [],
        [],
        [],
      );

      return;
    }

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];

      this.write(
        group,
        slot,
        this.partRecordFor(group, def, part, flags[slot] & part.mask),
      );
    }
  }

  /** The partition record for one masked flag word — cached on the def,
   * resolved on the first miss (round 57.1). */
  private partRecordFor(
    group: GroupName,
    def: GroupDef,
    part: NonNullable<GroupDef['partition']>,
    word: number,
  ): Computed {
    let record = part.records.get(word);

    if (record === undefined) {
      record = this.partitionRecord(group, def, word);
      part.records.set(word, record);
    }

    return record;
  }

  /** Resolve one flag combination into a computed record (cache miss). */
  private partitionRecord(
    group: GroupName,
    def: GroupDef,
    word: number,
  ): Computed {
    // the conditions are answered from `word` rather than from a slot,
    // which is the whole point: the record is the same for every element
    // carrying these bits
    const read: ValueReader = (_group, _slot, key) =>
      (word & (CONDITION_FLAGS[key] ?? 0)) !== 0;
    const record: Computed = { ...def.computed };

    for (const bm of def.mappers) {
      bm.channel.set(
        record,
        bindEvaluator(
          bm.m,
          this.store.data,
          group,
          bm.channel.default(group),
          read,
        )(0),
      );
    }

    return record;
  }

  /**
   * Re-check live auto-domain extents against the data; returns true when
   * any moved (the caller escalates to the whole group).  A moved extent
   * on a GPU-owned program also bumps paintVersion so the runtime repacks
   * its program uniform and re-evaluates in full.
   */
  private checkAutoExtents(group: GroupName, def: GroupDef): boolean {
    let moved = false;

    for (const bm of def.mappers) {
      const program = bm.m.program;

      if (
        (program.kind === 'continuous' || program.kind === 'discrete') &&
        program.autoDomain
      ) {
        if (
          applyAutoExtent(
            program,
            ...autoExtentFor(bm.m, this.store.data, group),
          )
        ) {
          moved = true;

          if (this.gpuOwnedProps[group].has(bm.m.prop)) {
            this.paintVersion++;
          }
        }
      }
    }

    return moved;
  }

  /**
   * Resolve and write one element's channels.
   *
   * @param ref — the element to style; a stale ref is a no-op
   */
  apply(ref: Ref): void {
    if (!this.store.isCurrent(ref)) {
      return;
    }

    this.applyBulk(ref.group, [ref.slot]);
  }

  /**
   * The data-write refresh: re-derive the mapped channels of the written
   * slots, gated per group on the written keys.  A label-only dependency
   * pays just the label text recompute (setLabel no-ops when the entry is
   * unchanged); mapped channels re-evaluate through the whole-element
   * scratch pass, which also escalates to the full group when a live
   * auto-domain extent moved.
   *
   * @param group — the element group that was written
   * @param slots — the written slots
   * @param keys — the data() keys written, which gate what re-evaluates
   */
  refreshMapped(
    group: GroupName,
    slots: ArrayLike<number>,
    keys: string[],
  ): void {
    if (group === 'nodes' && this.store.hasCompounds()) {
      const flags = this.store.column('node.flags') as Uint32Array;
      const leaves: number[] = [];
      const parents: number[] = [];

      for (let i = 0; i < slots.length; i++) {
        ((flags[slots[i]] & FLAG_PARENT) !== 0 ? parents : leaves).push(
          slots[i],
        );
      }

      if (leaves.length > 0) {
        this.refreshGroupDef('nodes', this.defs.nodes, leaves, keys);
      }
      if (parents.length > 0) {
        this.refreshGroupDef('nodes', this.defs.parents, parents, keys);
      }

      return;
    }

    this.refreshGroupDef(group, this.defs[group], slots, keys);
  }

  /**
   * The state-flip refresh (round 61) — `core.onStateChange`'s entry,
   * replacing the `refreshMapped` route that made every select restyle
   * whole elements (the 60.4 regression).  A flipped bit is the one
   * event whose styling consequence is knowable up front: for a
   * partitioned def the old masked word is the new word with `key`'s bit
   * flipped back, both records are cached, and the channels that differ
   * between them — one on a default-sheet node, five on a default-sheet
   * edge — are written narrowly instead of through the ~25-call full
   * `write()`.
   *
   * The general path is kept wherever it is the correct one: an
   * unpartitioned def (a data mapper puts the group per-element anyway),
   * a live transition spec (the txn capture is the general path's), a
   * demoted group, and the structural pseudo-keys (a parent flip changes
   * *which def* resolves the slot — the reparent hooks own that).  A
   * diff containing any channel without a narrow writer falls back to
   * the full `write()` of the target record per slot, byte-for-byte the
   * old behaviour.
   *
   * @param group — the element group whose flag flipped
   * @param key — the reserved condition key ('::selected', '::active', …)
   * @param slots — the slots whose bit actually changed
   */
  refreshState(group: GroupName, key: string, slots: ArrayLike<number>): void {
    // the structural pair changes def resolution, not just values
    if (key === '::parent' || key === '::child') {
      this.refreshMapped(group, slots as number[], [key]);

      return;
    }

    if (group === 'nodes' && this.store.hasCompounds()) {
      const flags = this.store.column('node.flags') as Uint32Array;
      const leaves: number[] = [];
      const parents: number[] = [];

      for (let i = 0; i < slots.length; i++) {
        ((flags[slots[i]] & FLAG_PARENT) !== 0 ? parents : leaves).push(
          slots[i],
        );
      }

      this.refreshStateDef('nodes', this.defs.nodes, leaves, key);
      this.refreshStateDef('nodes', this.defs.parents, parents, key);

      return;
    }

    this.refreshStateDef(group, this.defs[group], slots, key);
  }

  /** One def's share of a state flip: the fast diff path, or the
   * general `refreshGroupDef` wherever that one is correct (see
   * `refreshState`). */
  private refreshStateDef(
    group: GroupName,
    def: GroupDef,
    slots: ArrayLike<number>,
    key: string,
  ): void {
    if (slots.length === 0) {
      return;
    }

    const part = def.partition;
    const spec = def.transition;
    const transitionsLive =
      this.transitionSink != null && spec.duration > 0 && spec.props.length > 0;

    if (part == null || this.demoted[group] || transitionsLive) {
      this.refreshGroupDef(group, def, slots, [key]);

      return;
    }

    const bit = CONDITION_FLAGS[key] ?? 0;

    if ((part.mask & bit) === 0) {
      // the bit is watched for the *group* (the store's set folds the
      // parents def into nodes'), not necessarily read by this def —
      // an empty diff by construction, so the slots are skipped
      return;
    }

    const flags = this.store.column(
      group === 'nodes' ? 'node.flags' : 'edge.flags',
    ) as Uint32Array;
    // a bulk flip's slots almost always share one masked word (nothing
    // else is usually pressed or hovered mid-select), so the record and
    // diff resolve once per run of equal words, not per slot
    let last = -1;
    let record: Computed | null = null;
    let writers: StateWriter[] | null = null;
    const bypassed = this.bypassRaw.size > 0;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const to = flags[slot] & part.mask;

      if (to !== last) {
        last = to;
        record = this.partRecordFor(group, def, part, to);
        writers = this.partitionDiffWriters(group, def, part, to ^ bit, to);
      }

      // round 63.3: a bypassed slot takes the merged full write — the
      // narrow diff writers would stomp a bypassed channel with the
      // partition record's value.  O(bypassed); the run optimization
      // and the diff path are untouched for everything else.
      if (bypassed && this.bypassPatchAt(group, slot) != null) {
        this.write(group, slot, record as Computed);
        continue;
      }

      if (writers == null) {
        this.write(group, slot, record as Computed);
      } else {
        for (let j = 0; j < writers.length; j++) {
          writers[j](slot, record as Computed);
        }
      }
    }
  }

  /**
   * The writers for the channels that differ between two partition
   * records — cached per unordered pair of masked flag words (the
   * changed set is symmetric; which record to write is the caller's).
   * Null when some differing channel has no narrow writer: that pair
   * takes the full `write()`.
   */
  private partitionDiffWriters(
    group: GroupName,
    def: GroupDef,
    part: NonNullable<GroupDef['partition']>,
    from: number,
    to: number,
  ): StateWriter[] | null {
    const cacheKey = from <= to ? `${from}:${to}` : `${to}:${from}`;
    let writers = part.diffs.get(cacheKey);

    if (writers !== undefined) {
      return writers;
    }

    // the partitionRecord reader, per word: a condition is answered from
    // the word rather than from a slot, which is what makes the diff a
    // property of the pair
    const readerFor =
      (word: number): ValueReader =>
      (_group, _slot, condKey) =>
        (word & (CONDITION_FLAGS[condKey] ?? 0)) !== 0;
    const readFrom = readerFor(from);
    const readTo = readerFor(to);

    writers = [];

    for (const bm of def.mappers) {
      const fallback = bm.channel.default(group);
      const a = bindEvaluator(
        bm.m,
        this.store.data,
        group,
        fallback,
        readFrom,
      )(0);
      const b = bindEvaluator(
        bm.m,
        this.store.data,
        group,
        fallback,
        readTo,
      )(0);

      if (evaluatedEq(a, b)) {
        continue;
      }

      const writer = this.fastStateWriter(group, bm.m.prop);

      if (writer == null) {
        writers = null;

        break;
      }

      writers.push(writer);
    }

    part.diffs.set(cacheKey, writers);

    return writers;
  }

  private refreshGroupDef(
    group: GroupName,
    def: GroupDef,
    slots: ArrayLike<number>,
    keys: string[],
  ): void {
    if (slots.length === 0 || def.deps == null) {
      return;
    }

    const txn = this.openTxn(group, def);

    try {
      this.refreshGroupDefInner(group, def, slots, keys);
    } finally {
      this.closeTxn(txn);
    }
  }

  private refreshGroupDefInner(
    group: GroupName,
    def: GroupDef,
    slots: ArrayLike<number>,
    keys: string[],
  ): void {
    if (def.deps == null) {
      return;
    } // narrowed by the caller; re-checked for the types

    let label = false;
    let mapped = false;
    let chart = false;

    for (const key of keys) {
      const entry = def.deps.get(key);

      if (entry == null) {
        continue;
      }

      label = label || entry.label;
      mapped = mapped || entry.mappers;
      chart = chart || entry.chart;
    }

    const narrow = (): void => {
      // the label/chart-only fast paths
      if (label) {
        for (let i = 0; i < slots.length; i++) {
          this.writeLabel(slots[i], def.computed, group);
        }
      }

      if (chart) {
        for (let i = 0; i < slots.length; i++) {
          this.writeChart(slots[i], def.computed);
        }
      }
    };

    // a chart refresh under mapped channels must re-evaluate per slot
    // (the narrow path writes def.computed — the constants record —
    // which is wrong whenever `chart`/size/etc. are themselves mapped)
    if (mapped || (chart && def.mappers.length > 0)) {
      const owned = this.gpuOwnedProps[group];
      // *these* keys' mappers, not every mapper the group has.  A CPU
      // mapper on some other key cannot be stale here, and treating it
      // as though it were forces the whole-element `applyMapped` — which
      // rewrites the kernel-owned channels too, stomping them back to
      // their constants.  Round 57.1 surfaced it (every graph's default
      // `background-color` became a CPU `case`, so the fast path was
      // dead for all of them), but the bug is older than the round: a
      // chart or label mapper had the same effect.
      const affected = def.mappers.filter((bm) =>
        bm.m.keys.some((k) => keys.includes(k)),
      );

      if (
        chart ||
        this.demoted[group] ||
        affected.some((bm) => !owned.has(bm.m.prop))
      ) {
        this.applyMapped(group, def, slots, true);
      } else {
        // every mapped channel is GPU-owned: no CPU restyle at all — the
        // data-write spans drive the kernel; only the extents need a look
        this.checkAutoExtents(group, def);
        narrow();
      }
    } else {
      narrow();
    }
  }

  // -- read-back (the collection's read-only style getters) --

  /*
  Style reads report the *stored* channels — the resolved values the
  renderer draws from — not the sheet's declarations.  Consequences: an
  equal-radii 'circle'/'ellipse' reads back as 'ellipse'; arrow getters
  derive from the stored arrow color (whose alpha folds in edge opacity),
  so a fully transparent arrow reads as shape 'none' and color
  rgba(...,0); label channels ('font-size', 'color') come from the label
  sidecar when the node is labelled, else they resolve through the sheet
  (evaluating a fn sheet for that element).
  */

  /**
   * One resolved prop for a live element.
   *
   * @param ref — the element to read
   * @param propRaw — a style property name
   * @returns the stored value, or undefined when the prop belongs to the
   *   other element group
   * @throws if the name is not a v4 style property at all — a typo must
   *   fail loudly rather than read as undefined
   */
  readProp(ref: Ref, propRaw: string): string | number | undefined {
    // The per-raw-name read plan (round 62.4): one Map hit replaces the
    // normalize memo, four set membership tests and — on every edge
    // read — a per-call regex.  Everything cached here is immortal per
    // engine: name normalization, group membership, the transition and
    // arrow-fold classifications and the reader all come from module
    // tables a sheet swap never changes.
    let plan = this.readPlans.get(propRaw);

    if (plan === undefined) {
      const prop = normalizeProp(propRaw);

      if (!NODE_READ.has(prop) && !EDGE_READ.has(prop)) {
        throw new Error(
          `The style property '${prop}' is unsupported in the GPU prototype`,
        );
      }

      plan = {
        prop,
        node: NODE_READ.has(prop),
        edge: EDGE_READ.has(prop),
        transition: TRANSITION_CONFIG_PROPS.has(prop),
        arrowColorProp: /-arrow-(color|shape)$/.test(prop)
          ? prop.replace('-shape', '-color')
          : null,
        reader: PROP_READERS.get(prop) ?? null,
      };
      this.readPlans.set(propRaw, plan);
    }

    if (!(ref.group === 'nodes' ? plan.node : plan.edge)) {
      return undefined;
    }

    const prop = plan.prop;

    // transition config (round 24.1): answered from the group's spec
    // (the parents overlay for parent nodes, like every channel read)
    if (plan.transition) {
      const spec = this.defFor(ref).transition;

      switch (prop) {
        case 'transition-property':
          return spec.props.length === 0 ? 'none' : spec.props.join(' ');
        case 'transition-duration':
          return spec.duration;
        case 'transition-delay':
          return spec.delay;
        default:
          return spec.easing;
      }
    }

    // GPU-owned channels: the stored bytes go stale after data writes, so
    // evaluate the shared IR lazily (same math the kernel runs, ±1/byte).
    // Arrow getters need the fold: stored alpha = colorAlpha × opacity,
    // either of which may be kernel-owned.
    const owned = this.gpuOwnedProps[ref.group];

    if (ref.group === 'edges' && plan.arrowColorProp != null) {
      const colorProp = plan.arrowColorProp;

      if (owned.has(colorProp) || owned.has('opacity')) {
        const [r, g, b, a] = this.foldedArrow(ref, colorProp);

        return prop.endsWith('-shape')
          ? a > 0
            ? 'triangle'
            : 'none'
          : formatRgba(r, g, b, a);
      }
    } else if (owned.has(prop)) {
      const def = this.defFor(ref);
      const bm = def.mappers.find((bm) => bm.m.prop === prop);

      if (bm != null) {
        const value = bindEvaluator(
          bm.m,
          this.store.data,
          ref.group,
          bm.channel.default(ref.group),
          this.readValue,
        )(ref.slot);

        if (typeof value === 'number') {
          return value;
        }

        // the stored bytes carry the channel opacity folded in, and the
        // kernel folds the same constant (round 66.3) — so re-evaluating
        // here has to fold it too, or a constant-opacity sheet reports a
        // different alpha than it stores and than it draws
        const [r, g, b, a] = foldRgba(
          value,
          constOpacityFor(ref.group, prop, def.computed),
        );

        return formatRgba(r, g, b, a);
      }
    }

    // every readable property is one entry in PROP_READERS (35.2); a
    // name that reaches here without one is admitted by the group
    // guard above but stored nowhere, which reads as undefined
    return plan.reader === null
      ? undefined
      : plan.reader(this.store, ref.slot, ref, this.readCtx, prop);
  }

  /**
   * All resolved props of a live element's group.
   *
   * @param ref — the element to read
   * @returns every readable prop of its group, by name
   */
  readProps(ref: Ref): Record<string, string | number> {
    const props = ref.group === 'nodes' ? NODE_READ : EDGE_READ;
    const out: Record<string, string | number> = {};

    for (const prop of props) {
      out[prop] = this.readProp(ref, prop) as string | number;
    }

    return out;
  }

  /**
   * The constant line-opacity (B1) — the arrow-fold factor animation
   * needs (a mapped line-opacity never coexists with kernel-owned
   * arrows, so the constant is the truth).
   *
   * @returns the edges group's resolved `line-opacity`, the factor an
   *   arrow's stored alpha was folded with
   */
  lineOpacityConst(): number {
    return (this.defs.edges.computed as Computed).lineOpacity;
  }

  /** The sheet's arrow-width modes (constants-only props) — an
   * edge-width tween needs these to carry the style-write-resolved
   * `edge.arrowWidths` along (round 25.2): 'match-line' and percent
   * forms baked the width, plain numbers did not. */
  arrowWidthModes(): {
    source: number | 'match-line' | { percent: number };
    target: number | 'match-line' | { percent: number };
  } {
    const computed = this.defs.edges.computed as Computed;

    return {
      source: computed.sourceArrowWidth,
      target: computed.targetArrowWidth,
    };
  }

  /**
   * An arrow's colour *before* the edge-opacity fold.
   *
   * The arrow vertex stage sits at WebGPU's base 8-storage-buffer
   * limit, so edge opacity is pre-folded into the stored arrow alpha —
   * which means the stored bytes cannot recover the base when the
   * folded opacity was 0.  Animations and transitions that move edge
   * opacity read the base from here instead.
   *
   * @param ref — the edge
   * @param colorProp — `'source-arrow-color'` or
   *   `'target-arrow-color'`
   * @returns the unfolded RGBA, or the no-arrow value when that end
   *   draws no arrow
   */
  arrowBase(ref: Ref, colorProp: string): RGBA {
    const def = this.defs.edges;
    const computed = def.computed as Computed;
    const source = colorProp.startsWith('source');
    const shape = source
      ? computed.sourceArrowShape
      : computed.targetArrowShape;

    if (shape !== 'triangle') {
      return NO_ARROW;
    }

    return this.evalEdgeProp(
      ref,
      colorProp,
      source ? computed.sourceArrowColor : computed.targetArrowColor,
    ) as RGBA;
  }

  /**
   * The stored-arrow-bytes truth when the kernel owns edge paint: the base
   * colour with alpha folded by the (mapped or constant) opacity.  Shapes
   * are never kernel-owned (mapped shapes demote edge paint to the CPU), so
   * the computed constants decide the gate.
   */
  private foldedArrow(ref: Ref, colorProp: string): RGBA {
    const [r, g, b, a] = this.arrowBase(ref, colorProp);
    const computed = this.defs.edges.computed as Computed;
    const opacity = this.evalEdgeProp(
      ref,
      'opacity',
      computed.opacity,
    ) as number;

    // B1: line-opacity folds into the arrow alpha too (constant here —
    // a mapped line-opacity demotes edge paint off the kernel)
    return [r, g, b, Math.round(a * opacity * computed.lineOpacity)];
  }

  /** One edge prop for a slot: the mapper's value when mapped, else the constant. */
  private evalEdgeProp(
    ref: Ref,
    prop: string,
    constant: number | RGBA,
  ): number | RGBA {
    const bm = this.defs.edges.mappers.find((bm) => bm.m.prop === prop);

    return bm == null
      ? constant
      : bindEvaluator(
          bm.m,
          this.store.data,
          'edges',
          bm.channel.default('edges'),
          this.readValue,
        )(ref.slot);
  }

  /** Resolved label channels: the sidecar when labelled, else the sheet. */
  private labelChannels(ref: Ref): { fontSize: number; color: string } {
    const entry = this.store.labelAt(ref.slot, ref.group);

    if (entry != null) {
      const packed = entry.color;

      return {
        fontSize: entry.fontSize,
        color: formatRgba(
          packed & 0xff,
          (packed >>> 8) & 0xff,
          (packed >>> 16) & 0xff,
          (packed >>> 24) & 0xff,
        ),
      };
    }

    const def = this.defFor(ref);
    let computed: Computed;

    if (def.mappers.length > 0) {
      // an unlabelled element still reads mapped font-size/color truthfully
      const scratch: Computed = { ...def.computed };

      for (const bm of def.mappers) {
        bm.channel.set(
          scratch,
          bindEvaluator(
            bm.m,
            this.store.data,
            ref.group,
            bm.channel.default(ref.group),
            this.readValue,
          )(ref.slot),
        );
      }

      computed = scratch;
    } else {
      computed = def.computed;
    }

    return {
      fontSize: computed.fontSize,
      color: formatRgba(...computed.textColor),
    };
  }

  /**
   * Defaults + props for one group ('width' is shared; the group's own
   * default wins).  Mapper specs compile into `mappersOut`; the label
   * passthrough rides the labelKey channel instead.
   */
  private resolveConst(
    group: GroupName,
    props: StyleProps,
    mappersOut: BoundMapper[],
  ): Computed {
    // A later declaration of the same *prop* replaces an earlier one —
    // that is what makes the default stylesheet a default (round 57.1)
    // and what has made `PARENT_CHANNEL_OVERLAY` overridable since round
    // 14.6.  The constant half falls out of the loop below writing over
    // `computed`; the mapper half does not, because a bound mapper is
    // appended to a list and applied after every constant.  So a prop
    // that is set twice — a conditional default and then the app's own
    // colour — has to *drop* the earlier mapper here, or the default
    // silently wins over the sheet that overrode it.
    const bound = new Map<string, BoundMapper>();
    const computed: Computed = {
      ...NODE_DEFAULTS,
      ...EDGE_DEFAULTS,
      width: group === 'nodes' ? NODE_DEFAULTS.width : EDGE_DEFAULTS.width,
    };

    for (const prop of Object.keys(props)) {
      const norm = normalizeProp(prop);
      const value = props[prop];

      assertGroupProp(group, norm, value);

      if (isMapperSpec(value)) {
        // chart-values (round 23): the data passthrough reads a
        // per-element *array* — only { data: key } is supported
        if (norm === 'chart-values') {
          const asScale = value as Mapper;
          const passthrough =
            !('case' in value) &&
            typeof asScale.data === 'string' &&
            asScale.scale == null &&
            asScale.domain == null &&
            asScale.range == null;

          if (!passthrough) {
            throw new Error(
              `Only the passthrough mapper ({ data: key }) is supported for 'chart-values'`,
            );
          }

          computed.chartValues = null;
          computed.chartValuesKey = asScale.data;
          continue;
        }

        if (
          norm === 'label' ||
          norm === 'source-label' ||
          norm === 'target-label'
        ) {
          // the label passthrough rides the per-stream key channel
          const asScale = value as Mapper;
          const passthrough =
            !('case' in value) &&
            typeof asScale.data === 'string' &&
            asScale.scale == null &&
            asScale.domain == null &&
            asScale.range == null;

          if (!passthrough) {
            throw new Error(
              `Only the passthrough mapper ({ data: key }) is supported for '${norm}'`,
            );
          }

          if (norm === 'label') {
            computed.label = '';
            computed.labelKey = asScale.data;
          } else if (norm === 'source-label') {
            computed.sourceLabel = '';
            computed.sourceLabelKey = asScale.data;
          } else {
            computed.targetLabel = '';
            computed.targetLabelKey = asScale.data;
          }
          continue;
        }

        bound.set(norm, compileChannel(group, norm, value));
        continue;
      }

      // a constant for a prop an earlier block mapped drops that mapper:
      // the constant lands in `computed` and the mapper would otherwise
      // overwrite it at apply time
      bound.delete(norm);
      applyProp(computed, norm, value);
    }

    for (const m of bound.values()) {
      mappersOut.push(m);
    }

    return computed;
  }

  /** Stored-truth readback for the background-image family (15.2). */
  private readImageProp(slot: number, prop: string): string | number {
    const recs = this.store.nodeImagesAt(slot);

    if (recs == null) {
      // imageless nodes read the v3 defaults
      switch (prop) {
        case 'background-image':
          return 'none';
        case 'background-fit':
          return 'none';
        case 'background-image-opacity':
          return 1;
        case 'background-position-x':
        case 'background-position-y':
          return '50%';
        case 'background-offset-x':
        case 'background-offset-y':
          return 0;
        case 'background-width':
        case 'background-height':
          return 'auto';
        case 'background-repeat':
          return 'no-repeat';
        case 'background-clip':
          return 'node';
        case 'background-image-containment':
          return 'inside';
        case 'background-image-smoothing':
          return 'yes';
        case 'background-image-crossorigin':
          return 'anonymous';
        case 'background-image-type':
          return 'auto';
        default:
          return formatRgba(...NODE_DEFAULTS.backgroundImageColor);
      }
    }

    const lenOf = (l: BgLen): string | number => (l.pct ? `${l.v}%` : l.v);
    const sizeOf = (s: BgSize): string | number =>
      s.mode === 0 ? 'auto' : s.mode === 2 ? `${s.v}%` : s.v;
    // per-image lists read back space-joined; single images as scalars
    const per = (
      f: (r: NodeImageRecord) => string | number,
    ): string | number => {
      const list = recs.map(f);

      return list.length === 1 ? list[0] : list.join(' ');
    };

    switch (prop) {
      case 'background-image':
        return per((r) => r.url);
      case 'background-fit':
        return per((r) => BG_FIT_NAMES[r.fit]);
      case 'background-image-opacity':
        return per((r) => r.opacity);
      case 'background-position-x':
        return per((r) => lenOf(r.posX));
      case 'background-position-y':
        return per((r) => lenOf(r.posY));
      case 'background-offset-x':
        return per((r) => lenOf(r.offX));
      case 'background-offset-y':
        return per((r) => lenOf(r.offY));
      case 'background-width':
        return per((r) => sizeOf(r.w));
      case 'background-height':
        return per((r) => sizeOf(r.h));
      case 'background-repeat':
        return per((r) => BG_REPEAT_NAMES[r.repeat]);
      case 'background-clip':
        return per((r) => BG_CLIP_NAMES[r.clip]);
      case 'background-image-containment':
        return per((r) => BG_CONTAINMENT_NAMES[r.containment]);
      case 'background-image-smoothing':
        return per((r) => (r.smoothing ? 'yes' : 'no'));
      case 'background-image-crossorigin':
        return (
          this.store.images.get(recs[0].entryId)?.crossOrigin ?? 'anonymous'
        );
      case 'background-image-type':
        return per((r) => IMAGE_TYPE_NAMES[r.sdf ? 1 : 0]);
      default: {
        const [r, g, b, a] = recs[0].tint;

        return formatRgba(r, g, b, a);
      }
    }
  }

  // -- the shared channel writers (round 61) --
  //
  // Single-store-call paint writes factored out of writeChannels so the
  // state-refresh fast path can perform exactly one channel's write with
  // exactly the fold math the full pass uses — one definition, two
  // callers, the dual-consumers discipline.  Everything with a
  // cross-channel coupling (the circle collapse, geometry's cull/pick/
  // label-anchor cascade, the edge-opacity arrow fold cluster) stays
  // inline in writeChannels, which is what confines the fast path to
  // the channels listed in fastStateWriter.

  /** Write `node.fillColor` (the B1 background-opacity fold). */
  private writeNodeFillColor(slot: number, computed: Computed): void {
    this.store.setColor(
      'node.fillColor',
      slot,
      ...foldRgba(computed.fillColor, computed.backgroundOpacity),
    );
  }

  /** Write `node.borderColor` (the B1 border-opacity fold). */
  private writeNodeBorderColor(slot: number, computed: Computed): void {
    this.store.setColor(
      'node.borderColor',
      slot,
      ...foldRgba(computed.borderColor, computed.borderOpacity),
    );
  }

  /** Write `node.opacity` — under compounds the store folds the
   * ancestor product itself (round 14.4), so one call is complete. */
  private writeNodeOpacity(slot: number, computed: Computed): void {
    this.store.setScalar('node.opacity', slot, computed.opacity);
  }

  /** Write the `node.overlay` layer record (the A2 opacity fold). */
  private writeNodeOverlay(slot: number, computed: Computed): void {
    this.store.setNodeLayer(
      'node.overlay',
      slot,
      foldLayerRgba(computed.overlayColor, computed.overlayOpacity),
      computed.overlayPadding,
      computed.overlayShape,
      computed.overlayRadius,
    );
  }

  /** Write the `node.underlay` layer record (the A2 opacity fold). */
  private writeNodeUnderlay(slot: number, computed: Computed): void {
    this.store.setNodeLayer(
      'node.underlay',
      slot,
      foldLayerRgba(computed.underlayColor, computed.underlayOpacity),
      computed.underlayPadding,
      computed.underlayShape,
      computed.underlayRadius,
    );
  }

  /** Write `edge.lineColor` (the B1 line-opacity fold). */
  private writeEdgeLineColor(slot: number, computed: Computed): void {
    this.store.setColor(
      'edge.lineColor',
      slot,
      ...foldRgba(computed.lineColor, computed.lineOpacity),
    );
  }

  /**
   * The B1 arrow fold: v3's effective arrow opacity is opacity ×
   * line-opacity.  A 'none' end — or any end of a haystack edge, which
   * draws no arrows (v3 skips them) — stores NO_ARROW, so the getters
   * read 'none' (the recorded deviation: v3's pstyle still reports the
   * declared shape).
   */
  private edgeArrowRgba(
    computed: Computed,
    shape: ArrowShape,
    color: RGBA,
  ): RGBA {
    return shape === 'none' || computed.curveStyle === CURVE_STYLE_HAYSTACK
      ? NO_ARROW
      : [
          color[0],
          color[1],
          color[2],
          Math.round(color[3] * computed.opacity * computed.lineOpacity),
        ];
  }

  /** Write `edge.sourceArrow` — `setColor` re-derives the round-56
   * shows-line bits itself, so one call is complete. */
  private writeEdgeSourceArrowColor(slot: number, computed: Computed): void {
    this.store.setColor(
      'edge.sourceArrow',
      slot,
      ...this.edgeArrowRgba(
        computed,
        computed.sourceArrowShape,
        computed.sourceArrowColor,
      ),
    );
  }

  /** Write `edge.targetArrow` (see the source twin). */
  private writeEdgeTargetArrowColor(slot: number, computed: Computed): void {
    this.store.setColor(
      'edge.targetArrow',
      slot,
      ...this.edgeArrowRgba(
        computed,
        computed.targetArrowShape,
        computed.targetArrowColor,
      ),
    );
  }

  /** Write `edge.midSourceArrow` — `setMidArrow` maintains the live
   * mid-arrow count, so one call is complete. */
  private writeEdgeMidSourceArrowColor(slot: number, computed: Computed): void {
    this.store.setMidArrow(
      'edge.midSourceArrow',
      slot,
      ...this.edgeArrowRgba(
        computed,
        computed.midSourceArrowShape,
        computed.midSourceArrowColor,
      ),
      'edge.midTargetArrow',
    );
  }

  /** Write `edge.midTargetArrow` (see the source twin). */
  private writeEdgeMidTargetArrowColor(slot: number, computed: Computed): void {
    this.store.setMidArrow(
      'edge.midTargetArrow',
      slot,
      ...this.edgeArrowRgba(
        computed,
        computed.midTargetArrowShape,
        computed.midTargetArrowColor,
      ),
      'edge.midSourceArrow',
    );
  }

  /** Write the `edge.overlay` stroke record (A2: stroke = width +
   * 2·padding, derived here so the layer shaders need no width
   * binding). */
  private writeEdgeOverlay(slot: number, computed: Computed): void {
    this.store.setEdgeLayer(
      'edge.overlay',
      slot,
      foldLayerRgba(computed.overlayColor, computed.overlayOpacity),
      computed.width + 2 * computed.overlayPadding,
    );
  }

  /** Write the `edge.underlay` stroke record (see the overlay twin). */
  private writeEdgeUnderlay(slot: number, computed: Computed): void {
    this.store.setEdgeLayer(
      'edge.underlay',
      slot,
      foldLayerRgba(computed.underlayColor, computed.underlayOpacity),
      computed.width + 2 * computed.underlayPadding,
    );
  }

  /**
   * The narrow writer for one normalized prop, or null when the prop has
   * cross-channel consequences the writers above cannot carry — geometry
   * (bb/cull/pick/label anchors), labels, charts, the edge-opacity fold
   * cluster — in which case a state flip that moves it falls back to the
   * full `write()` of the target record, byte-for-byte the general
   * path's behaviour.  The layer props share one writer per record
   * because they land in one packed store call.
   */
  private fastStateWriter(group: GroupName, prop: string): StateWriter | null {
    if (group === 'nodes') {
      switch (prop) {
        case 'background-color':
          return (slot, c) => this.writeNodeFillColor(slot, c);
        case 'border-color':
          return (slot, c) => this.writeNodeBorderColor(slot, c);
        case 'opacity':
          return (slot, c) => this.writeNodeOpacity(slot, c);
        case 'overlay-color':
        case 'overlay-opacity':
        case 'overlay-padding':
          return (slot, c) => this.writeNodeOverlay(slot, c);
        case 'underlay-color':
        case 'underlay-opacity':
        case 'underlay-padding':
          return (slot, c) => this.writeNodeUnderlay(slot, c);
        default:
          return null;
      }
    }

    switch (prop) {
      case 'line-color':
        return (slot, c) => this.writeEdgeLineColor(slot, c);
      case 'source-arrow-color':
        return (slot, c) => this.writeEdgeSourceArrowColor(slot, c);
      case 'target-arrow-color':
        return (slot, c) => this.writeEdgeTargetArrowColor(slot, c);
      case 'mid-source-arrow-color':
        return (slot, c) => this.writeEdgeMidSourceArrowColor(slot, c);
      case 'mid-target-arrow-color':
        return (slot, c) => this.writeEdgeMidTargetArrowColor(slot, c);
      case 'overlay-color':
      case 'overlay-opacity':
      case 'overlay-padding':
        return (slot, c) => this.writeEdgeOverlay(slot, c);
      case 'underlay-color':
      case 'underlay-opacity':
      case 'underlay-padding':
        return (slot, c) => this.writeEdgeUnderlay(slot, c);
      default:
        return null;
    }
  }

  /**
   * The one channel funnel, wrapped by the transition capture (round
   * 24.1): an already-styled slot written inside an open capture gets
   * its tweenable channels snapshotted before and diffed after — the
   * body itself stays transition-blind.
   */
  private write(group: GroupName, slot: number, computed: Computed): void {
    // round 63.3: a bypassed slot writes the merged record — one gate
    // load for bypass-free instances (the performance contract), and
    // because every restyle path except refreshStateDef's narrow
    // writers funnels through here, correctness is by construction
    if (this.bypassRaw.size > 0) {
      const patch = this.bypassPatchAt(group, slot);

      if (patch != null) {
        computed = this.mergeBypass(computed, patch);
      }
    }

    const txn = this.txn;
    const pre =
      txn != null && this.wasStyled(group, slot)
        ? this.txnPre(txn, slot)
        : null;

    this.writeChannels(group, slot, computed);

    if (txn != null && pre != null) {
      this.txnPost(txn, group, slot, pre);
    }

    this.markStyled(group, slot);
  }

  private writeChannels(
    group: GroupName,
    slot: number,
    computed: Computed,
  ): void {
    const store = this.store;

    if (group === 'nodes') {
      // equal-radii ellipses render via the cheaper exact circle SDF
      const shape =
        computed.shape === SHAPE_ELLIPSE && computed.width === computed.height
          ? SHAPE_CIRCLE
          : computed.shape;

      store.setPair('node.size', slot, computed.width, computed.height);
      store.setFlag('nodes', slot, FLAG_NO_EVENTS, !computed.eventsEnabled); // 20.2
      store.setFlag('nodes', slot, FLAG_TEXT_EVENTS, computed.textEvents); // 20.3
      store.setInvisibility('nodes', slot, computed.invisible); // 22
      this.writeNodeFillColor(slot, computed);
      this.writeNodeBorderColor(slot, computed);
      store.setScalar('node.borderWidth', slot, computed.borderWidth);
      this.writeNodeOpacity(slot, computed);
      store.setScalar('node.shape', slot, shape);
      store.setGhost(
        slot,
        computed.ghostOffsetX,
        computed.ghostOffsetY,
        computed.ghostOpacity,
        computed.ghost,
      );
      // C3: custom polygons park their unit points in the poly blob; a
      // non-polygon write frees any stale record the slot held
      const polyRef = store.setPolygonPoints(
        slot,
        shape === SHAPE_POLYGON_CUSTOM ? computed.shapePolygonPoints : null,
      );

      store.setBorderGeom(
        slot,
        computed.cornerRadius,
        computed.borderPosition,
        computed.outlineWidth > 0
          ? packRgba(foldRgba(computed.outlineColor, computed.outlineOpacity))
          : 0,
        computed.outlineWidth,
        computed.outlineOffset,
        shape,
        polyRef,
        computed.borderStyle,
        computed.outlineStyle,
      ); // C2: the FS reads the shape from borderGeom

      // round 38: the dashed border's pattern + offset (vertex-only
      // columns; the FS gets them as flat varyings)
      const bdp = computed.borderDashPattern;

      store.setVec4('node.borderDash', slot, bdp[0], bdp[1], bdp[2], bdp[3]);
      store.setPair('node.borderDashMeta', slot, computed.borderDashOffset, 0);

      // background gradient (C2): stops fold the background-opacity like
      // the flat fill; unset positions spread evenly (v3/canvas rule)
      store.setGradient(
        'node.gradient',
        slot,
        computed.backgroundGradientStopColors.length > 0
          ? computed.backgroundFill
          : 0,
        computed.backgroundGradientDirection,
        gradientStops(
          computed.backgroundGradientStopColors,
          computed.backgroundGradientStopPositions,
          computed.backgroundOpacity,
        ),
      );

      this.writeNodeOverlay(slot, computed);
      this.writeNodeUnderlay(slot, computed);

      this.writeImages(slot, computed);
      this.writeChart(slot, computed);
      this.writeLabel(slot, computed);
    } else {
      this.writeEdgeColumns(slot, computed);
      this.writeEdgePerSlot(slot, computed);
    }
  }

  /**
   * The edge channels that land in `EDGE_STYLE_COLUMNS` — every edge
   * column a styled record fully determines (round 67.2).  Split from
   * the per-slot half below so the bulk apply can run this once for a
   * run's template slot and fill the rest of the columns from it, while
   * still calling `writeEdgePerSlot` for every slot.  One definition,
   * two callers, as with the round-61 narrow writers.
   */
  private writeEdgeColumns(slot: number, computed: Computed): void {
    const store = this.store;

    this.writeEdgeLineColor(slot, computed);
    // line-fill gradient (C2), stops folded by line-opacity
    store.setGradient(
      'edge.gradient',
      slot,
      computed.lineGradientStopColors.length > 0 ? computed.lineFill : 0,
      0,
      gradientStops(
        computed.lineGradientStopColors,
        computed.lineGradientStopPositions,
        computed.lineOpacity,
      ),
    );

    const dp = computed.lineDashPattern;

    store.setVec4('edge.dashPattern', slot, dp[0], dp[1], dp[2], dp[3]);
    store.setPair(
      'edge.dashMeta',
      slot,
      computed.lineDashOffset,
      computed.lineCap,
    );
    store.setScalar('edge.width', slot, computed.width);
    store.setScalar('edge.opacity', slot, computed.opacity);
    store.setScalar('edge.lineStyle', slot, computed.lineStyle);
    this.writeEdgeSourceArrowColor(slot, computed);
    this.writeEdgeTargetArrowColor(slot, computed);
    // B7: hollow flags at bits 16/17 and arrow-scale ×16 in the top
    // byte (quantized readback — recorded); stroke widths resolve
    // 'match-line'/% against the edge width here
    const scaleQ = Math.max(
      1,
      Math.min(255, Math.round(computed.arrowScale * 16)),
    );

    store.noteArrowScale(computed.arrowScale);
    const srcArrowId = ARROW_ENUM[computed.sourceArrowShape];
    const tgtArrowId = ARROW_ENUM[computed.targetArrowShape];

    // not setScalar: the word is mirrored into edge.width's lane 1 so
    // the edge vertex stages can derive v3's gap (round 56)
    store.setArrowShapes(
      slot,
      packArrowShapes(
        srcArrowId,
        tgtArrowId,
        ARROW_ENUM[computed.midSourceArrowShape],
        ARROW_ENUM[computed.midTargetArrowShape],
        // 27.6: a hollow compound head falls back to filled (recorded)
        COMPOUND_ARROWS.has(srcArrowId) ? 0 : computed.sourceArrowFill,
        COMPOUND_ARROWS.has(tgtArrowId) ? 0 : computed.targetArrowFill,
        scaleQ,
      ),
    );

    // mid-arrow colors fold like the end arrows (C1)
    this.writeEdgeMidSourceArrowColor(slot, computed);
    this.writeEdgeMidTargetArrowColor(slot, computed);

    const resolveAw = (
      aw: number | 'match-line' | { percent: number },
    ): number =>
      aw === 'match-line'
        ? computed.width
        : typeof aw === 'number'
          ? aw
          : aw.percent * computed.width;

    const srcAw = resolveAw(computed.sourceArrowWidth);
    const tgtAw = resolveAw(computed.targetArrowWidth);

    store.setPair('edge.arrowWidths', slot, srcAw, tgtAw);
    // 56: a hollow head's stroke straddles its outline, so the ink
    // reaches half a stroke width outside the polygon.  The arrow
    // vertex stage cannot bind this column, so the quad grows by a
    // frame-level maximum instead — reported here, resolved.
    store.noteArrowWidth(Math.max(srcAw, tgtAw));
    // line-outline casing (B4): stroke = width + outline width (v3's
    // lineWidth), alpha folded by v3's effectiveLineOpacity
    store.setEdgeLayer(
      'edge.casing',
      slot,
      computed.lineOutlineWidth > 0
        ? foldLayerRgba(
            computed.lineOutlineColor,
            computed.opacity * computed.lineOpacity,
          )
        : 0,
      computed.width + computed.lineOutlineWidth,
    );

    // overlay/underlay strokes (A2): stroke width = edge width + 2·padding,
    // derived here so the layer shaders need no width binding
    this.writeEdgeOverlay(slot, computed);
    this.writeEdgeUnderlay(slot, computed);
  }

  /**
   * The edge work a column copy cannot carry: the two flag bits (the
   * flags word holds per-element bits too), the invisibility cascade,
   * the curve index's own per-slot record, and the label sidecar.  Runs
   * for every slot on both paths.
   */
  private writeEdgePerSlot(slot: number, computed: Computed): void {
    const store = this.store;

    store.setFlag('edges', slot, FLAG_NO_EVENTS, !computed.eventsEnabled); // 20.2
    store.setInvisibility('edges', slot, computed.invisible); // 22

    // blob-family styles carry the 12b record; straight/bezier store none
    const extras: CurveStyleExtras | null = isBlobStyle(computed.curveStyle)
      ? {
          ctrlDists: computed.controlPointDistances,
          ctrlWeights: computed.controlPointWeights,
          segDists: computed.segmentDistances,
          segWeights: computed.segmentWeights,
          segRadii: computed.segmentRadii,
          radiusTypes: computed.radiusTypes,
          edgeDistances: computed.edgeDistances,
          taxiDir: computed.taxiDirection,
          taxiTurn: computed.taxiTurn,
          taxiTurnPercent: computed.taxiTurnPercent,
          taxiTurnMinDist: computed.taxiTurnMinDistance,
          taxiRadius: computed.taxiRadius,
        }
      : null;

    // the styled endpoint spec (null when all-default — the common case)
    const se = computed.sourceEndpoint;
    const te = computed.targetEndpoint;
    const endpoints: EndpointSpec | null =
      se.mode === ENDPT_DEFAULT &&
      te.mode === ENDPT_DEFAULT &&
      computed.sourceDistanceFromNode === 0 &&
      computed.targetDistanceFromNode === 0
        ? null
        : {
            srcMode: se.mode,
            srcA: se.a,
            srcB: se.b,
            srcPct: se.pct,
            srcDist: computed.sourceDistanceFromNode,
            tgtMode: te.mode,
            tgtA: te.a,
            tgtB: te.b,
            tgtPct: te.pct,
            tgtDist: computed.targetDistanceFromNode,
          };

    store.setCurveStyle(
      slot,
      computed.curveStyle,
      computed.controlPointStepSize,
      computed.controlPointWeight,
      computed.loopDirection,
      computed.loopSweep,
      extras,
      computed.haystackRadius,
      endpoints,
    );

    this.writeLabel(slot, computed, 'edges');
  }

  /** warn-once flag for the multi-image cap (recorded: 4 per node) */
  private warnedImageCap = false;

  /**
   * Resolve and store a node's chart record (round 23).  Values come
   * from the constant list or the `{ data: key }` passthrough (a
   * per-element array; non-arrays and invalid entries mean no chart);
   * slices cap at CHART_MAX_SLICES and the running total clamps at 1
   * (v3's percent semantics — the remainder stays unpainted).  Colors
   * cycle the palette (category10 by default) and fold chart-opacity
   * into their alphas (the B1 pattern; the header keeps the exact
   * opacity for readback).
   */
  private writeChart(slot: number, computed: Computed): void {
    const store = this.store;

    if (computed.chartKind === CHART_NONE) {
      store.setChart(slot, null);

      return;
    }

    let raw: readonly unknown[] | null = computed.chartValues;

    if (computed.chartValuesKey != null) {
      const dataValue = store.data.get('nodes', slot, computed.chartValuesKey);

      raw = Array.isArray(dataValue) ? dataValue : null;
    }

    if (raw == null || raw.length === 0) {
      store.setChart(slot, null);

      return;
    }

    // clamp cumulative fractions at 1 (v3); zero slices keep their
    // palette position, beyond-full slices drop
    const values: number[] = [];
    let acc = 0;

    for (let i = 0; i < raw.length && i < CHART_MAX_SLICES; i++) {
      if (acc >= 1) {
        break;
      }

      const v =
        typeof raw[i] === 'number'
          ? (raw[i] as number)
          : parseFloat(String(raw[i]));

      if (!isFinite(v) || v < 0) {
        continue;
      } // sidecar junk: skip the entry

      const take = Math.min(v, 1 - acc);

      values.push(take);
      acc += take;
    }

    if (values.length === 0) {
      store.setChart(slot, null);

      return;
    }

    const palette = computed.chartColors ?? DEFAULT_CHART_COLORS;
    const op = computed.chartOpacity;
    const colors = values.map((_, i) => {
      const [r, g, b, a] = palette[i % palette.length];

      return [r, g, b, Math.round(a * op)] as [number, number, number, number];
    });

    store.setChart(slot, {
      kind: computed.chartKind,
      size: computed.chartSize,
      hole: computed.chartHole,
      startAngle: computed.chartStartAngle,
      direction: computed.chartDirection,
      opacity: op,
      values,
      colors,
    });
  }

  /** Resolve a node's background-image records and store them (15.2). */
  private writeImages(slot: number, computed: NodeComputed): void {
    let urls = computed.backgroundImage;

    if (urls.length === 0) {
      this.store.setNodeImages(slot, null);

      return;
    }

    if (urls.length > IMAGE_CAP) {
      if (!this.warnedImageCap) {
        this.warnedImageCap = true;
        console.warn(
          `background-image supports at most ${IMAGE_CAP} images per node ` +
            `in the GPU prototype; extra images are dropped`,
        );
      }

      urls = urls.slice(0, IMAGE_CAP);
    }

    // per-image lists distribute v3-style: index i reads min(i, len-1)
    const at = <T,>(list: T[], i: number): T =>
      list[Math.min(i, list.length - 1)];
    const specs: NodeImageSpec[] = urls.map((url, i) => ({
      url,
      sdf: at(computed.backgroundImageType, i) === 1,
      crossOrigin: computed.backgroundImageCrossorigin,
      fit: at(computed.backgroundFit, i),
      repeat: at(computed.backgroundRepeat, i),
      clip: at(computed.backgroundClip, i),
      containment: at(computed.backgroundImageContainment, i),
      smoothing: at(computed.backgroundImageSmoothing, i),
      opacity: at(computed.backgroundImageOpacity, i),
      posX: at(computed.backgroundPositionX, i),
      posY: at(computed.backgroundPositionY, i),
      offX: at(computed.backgroundOffsetX, i),
      offY: at(computed.backgroundOffsetY, i),
      w: at(computed.backgroundWidth, i),
      h: at(computed.backgroundHeight, i),
      tint: [...computed.backgroundImageColor],
    }));

    this.store.setNodeImages(slot, specs);
  }

  /** Resolve an element's label text from its computed channels and store it. */
  private writeLabel(
    slot: number,
    computed: NodeComputed | Computed,
    group: GroupName = 'nodes',
  ): void {
    const store = this.store;
    const key = computed.labelKey;
    let text =
      key == null
        ? computed.label
        : key === 'id'
          ? (store.idAt(group, slot) ?? '')
          : stringify(store.data.get(group, slot, key));

    // text-transform (B6) applies at glyph-run build, as v3 transforms
    // before measuring
    if (computed.textTransform === 1) {
      text = text.toUpperCase();
    } else if (computed.textTransform === 2) {
      text = text.toLowerCase();
    }

    // text-opacity (B1) is v3's parentOpacity for the whole label block:
    // it folds into the text fill, outline and background alphas alike
    const textOp = computed.textOpacity;
    const fold = ([r, g, b, a]: RGBA, opacity: number): number =>
      packRgba([
        r,
        g,
        b,
        Math.round(a * Math.max(0, Math.min(1, opacity * textOp))),
      ]);

    // node labels anchor on v3's 3x3 grid (D3): the entry carries the
    // node-extent base plus block-fraction shifts the glyph builder
    // resolves against the laid dimensions.  Edges center on the
    // midpoint the shader computes (halign/valign are node-only).
    const nc = computed as NodeComputed;
    let anchorX = 0,
      halignShift = 0,
      valignShift = 0;
    let anchorY = -computed.fontSize / 2 + computed.textMarginY;

    if (group === 'nodes') {
      const halfW = nc.width / 2,
        halfH = nc.height / 2;

      anchorX = (nc.textHalign - 1) * halfW;
      halignShift = (nc.textHalign - 1) * 0.5;
      anchorY =
        (nc.textValign === 0
          ? -halfH - LABEL_MARGIN
          : nc.textValign === 2
            ? halfH + LABEL_MARGIN
            : 0) + computed.textMarginY;
      valignShift = (nc.textValign - 2) * 0.5;
    }

    // text-justification 'auto' resolves against text-halign (v3's
    // rule: a label hanging left of its node right-justifies); edges
    // always center under auto (halign is node-only)
    const justification =
      computed.textJustification !== -1
        ? computed.textJustification
        : group === 'nodes'
          ? nc.textHalign === 0
            ? 2
            : nc.textHalign === 2
              ? 0
              : 1
          : 1;

    // the shared text channels (font, color, box, opacity — v3 reads
    // these unprefixed for all three edge labels)
    const shared = {
      fontSize: computed.fontSize,
      color: fold(computed.textColor, 1),
      minZoomedFontSize: computed.minZoomedFontSize,
      outlineWidth: computed.textOutlineWidth,
      outlineColor: fold(
        computed.textOutlineColor,
        computed.textOutlineOpacity,
      ),
      bgColor: fold(computed.textBgColor, computed.textBgOpacity),
      bgPadding: computed.textBgPadding,
      bgShape: computed.textBgShape,
      bgBorderColor: fold(computed.textBorderColor, computed.textBorderOpacity),
      bgBorderWidth: computed.textBorderWidth,
      // the wrap family (16.2)
      wrap: computed.textWrap,
      maxWidth: computed.textMaxWidth,
      lineHeight: computed.lineHeight,
      overflowWrap: computed.textOverflowWrap,
      justification,
    };

    store.setLabel(
      slot,
      text === ''
        ? null
        : {
            text,
            ...shared,
            anchorX,
            halignShift,
            valignShift,
            anchorY,
            marginX: computed.textMarginX,
            marginY: computed.textMarginY,
            endOffset: 0,
            rotate:
              group === 'edges' &&
              Number.isNaN((computed as Computed).textRotation),
            rotation: Number.isNaN((computed as Computed).textRotation)
              ? 0
              : (computed as Computed).textRotation,
          },
      group,
    );

    // end labels (D4): two more streams per edge, anchored at arc
    // distance *-text-offset from each end (the label VS walks the
    // drawn path); placement channels are prefixed, text style shared
    if (group === 'edges') {
      const ec = computed as Computed;

      for (const end of ['source', 'target'] as const) {
        const src = end === 'source';
        const key2 = src ? ec.sourceLabelKey : ec.targetLabelKey;
        let endText =
          key2 == null
            ? src
              ? ec.sourceLabel
              : ec.targetLabel
            : key2 === 'id'
              ? (store.idAt(group, slot) ?? '')
              : stringify(store.data.get(group, slot, key2));

        if (computed.textTransform === 1) {
          endText = endText.toUpperCase();
        } else if (computed.textTransform === 2) {
          endText = endText.toLowerCase();
        }

        const marginY = src ? ec.sourceTextMarginY : ec.targetTextMarginY;

        store.setLabel(
          slot,
          endText === ''
            ? null
            : {
                text: endText,
                ...shared,
                anchorX: 0,
                halignShift: 0,
                valignShift: 0,
                anchorY: -computed.fontSize / 2 + marginY,
                marginX: src ? ec.sourceTextMarginX : ec.targetTextMarginX,
                marginY,
                endOffset: src ? ec.sourceTextOffset : ec.targetTextOffset,
                rotate: Number.isNaN(
                  src ? ec.sourceTextRotation : ec.targetTextRotation,
                ),
                rotation: ((r) => (Number.isNaN(r) ? 0 : r))(
                  src ? ec.sourceTextRotation : ec.targetTextRotation,
                ),
              },
          src ? 'edgeSource' : 'edgeTarget',
        );
      }
    }
  }
}
