import { CHART_NONE, LINE_SOLID, SHAPE_ELLIPSE } from '../contract.mjs';
import { CURVE_DEFAULTS, CURVE_EXTRA_DEFAULTS } from '../store/curve-index.mjs';
import type { BgLen, BgSize } from '../store/graph-store.mjs';
import { ENDPT_DEFAULT } from '../curve-geometry.mjs';

/** One styled end of source/target-endpoint (12c): the parsed form of
 * v3's edgeEndpoint type.  Angles store the *effective* radians (the
 * 12-o'clock start already applied); point pct components store the
 * fraction (v3's pfValue). */
export interface EndpointEnd {
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

export type RGBA = [number, number, number, number];

/** Resolved channel values for one element, before writing to columns. */
export interface NodeComputed {
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
  /** `taxi-turn: auto` (round 124): the turn comes from the track pass */
  taxiTurnAuto: boolean;
  taxiTurnMinDistance: number;
  taxiRadius: number;
  /** `taxi-track` (124): TRACK_SOURCE | TRACK_TARGET | TRACK_FAMILY */
  taxiTrack: number;
  /** `taxi-track-spacing` (124): px between neighbouring tracks */
  taxiTrackSpacing: number;
}

export type Computed = NodeComputed & EdgeComputed;

export type ArrowShape =
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

export const NODE_DEFAULTS: NodeComputed = {
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

export const DATA_MAPPER = /^\s*data\s*\(\s*([\w-]+)\s*\)\s*$/;

export const EDGE_DEFAULTS: EdgeComputed = {
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
  taxiTurnAuto: CURVE_EXTRA_DEFAULTS.taxiTurnAuto,
  taxiTurnMinDistance: CURVE_EXTRA_DEFAULTS.taxiTurnMinDist,
  taxiRadius: CURVE_EXTRA_DEFAULTS.taxiRadius,
  taxiTrack: CURVE_EXTRA_DEFAULTS.taxiTrack,
  taxiTrackSpacing: CURVE_EXTRA_DEFAULTS.taxiTrackSpacing,
};

export const NO_ARROW: RGBA = [0, 0, 0, 0]; // a=0 collapses the arrow in the shader
