import {
  GROUP_EDGES,
  GROUP_NODES,
  CHART_NONE,
  CHART_PIE,
  CHART_STRIPES,
} from '../contract.mjs';
import type { ChannelKind, Evaluated } from '../style-scales.mjs';
import type { GroupName } from '../contract.mjs';
import { PROP } from '../style-props.mjs';
import { NODE_DEFAULTS, EDGE_DEFAULTS } from './defaults.mjs';
import type { RGBA, Computed } from './defaults.mjs';
import { SHAPES, ARROW_ENUM, ARROW_NAMES } from './tables.mjs';
import {
  TEXT_TRANSFORMS,
  TEXT_WRAPS,
  OFLOW_WRAPS,
  JUSTIFICATIONS,
  TEXT_BG_SHAPES,
  ARROW_FILLS,
  LINE_CAPS,
  FILL_KINDS,
  GRADIENT_DIRECTIONS,
  HALIGNS,
  VALIGNS,
  BORDER_POSITIONS,
  STROKE_STYLES,
} from './parse.mjs';
import {
  LINE_STYLES,
  parseTextRotation,
  CURVE_STYLES,
  EDGE_DISTANCES,
  TAXI_DIRECTIONS,
  TAXI_TURN_AUTO_SENTINEL,
  TAXI_TRACKS,
} from './parse-edge.mjs';

/** How a mapped prop lands on the computed record. */
export interface MappableChannel {
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
export const MAPPABLE: Record<string, MappableChannel> = {
  [PROP.BACKGROUND_COLOR]: {
    kind: 'color',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.fillColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.fillColor,
  },
  [PROP.BORDER_COLOR]: {
    kind: 'color',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.borderColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.borderColor,
  },
  width: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.width = v as number;
    },
    default: (group) =>
      group === GROUP_NODES ? NODE_DEFAULTS.width : EDGE_DEFAULTS.width,
  },
  height: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.height = v as number;
    },
    default: () => NODE_DEFAULTS.height,
  },
  [PROP.BORDER_WIDTH]: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.borderWidth = v as number;
    },
    default: () => NODE_DEFAULTS.borderWidth,
  },
  opacity: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.opacity = v as number;
    },
    default: () => NODE_DEFAULTS.opacity,
  },
  shape: {
    kind: 'enum',
    groups: [GROUP_NODES],
    parseEnum: (v) => SHAPES[String(v)] ?? null,
    set: (c, v) => {
      c.shape = v as number;
    },
    default: () => NODE_DEFAULTS.shape,
  },
  [PROP.FONT_SIZE]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.fontSize = v as number;
    },
    default: () => NODE_DEFAULTS.fontSize,
  },
  [PROP.MIN_ZOOMED_FONT_SIZE]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.minZoomedFontSize = v as number;
    },
    default: () => NODE_DEFAULTS.minZoomedFontSize,
  },
  [PROP.TEXT_HALIGN]: {
    kind: 'enum',
    groups: [GROUP_NODES],
    parseEnum: (v) => HALIGNS[String(v)] ?? null,
    set: (c, v) => {
      c.textHalign = v as number;
    },
    default: () => NODE_DEFAULTS.textHalign,
  },
  [PROP.TEXT_VALIGN]: {
    kind: 'enum',
    groups: [GROUP_NODES],
    parseEnum: (v) => VALIGNS[String(v)] ?? null,
    set: (c, v) => {
      c.textValign = v as number;
    },
    default: () => NODE_DEFAULTS.textValign,
  },
  color: {
    kind: 'color',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.textColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.textColor,
  },
  [PROP.TEXT_OUTLINE_WIDTH]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.textOutlineWidth = v as number;
    },
    default: () => NODE_DEFAULTS.textOutlineWidth,
  },
  [PROP.TEXT_OUTLINE_COLOR]: {
    kind: 'color',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.textOutlineColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.textOutlineColor,
  },
  [PROP.TEXT_OUTLINE_OPACITY]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.textOutlineOpacity = v as number;
    },
    default: () => NODE_DEFAULTS.textOutlineOpacity,
  },
  [PROP.TEXT_BACKGROUND_COLOR]: {
    kind: 'color',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.textBgColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.textBgColor,
  },
  [PROP.TEXT_BACKGROUND_OPACITY]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.textBgOpacity = v as number;
    },
    default: () => NODE_DEFAULTS.textBgOpacity,
  },
  [PROP.TEXT_BACKGROUND_PADDING]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.textBgPadding = v as number;
    },
    default: () => NODE_DEFAULTS.textBgPadding,
  },
  [PROP.TEXT_MARGIN_X]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.textMarginX = v as number;
    },
    default: () => NODE_DEFAULTS.textMarginX,
  },
  [PROP.TEXT_MARGIN_Y]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.textMarginY = v as number;
    },
    default: () => NODE_DEFAULTS.textMarginY,
  },
  [PROP.TEXT_ROTATION]: {
    // 27.7: nodes joined edges here — v3 allows a numeric rotation on any
    // label, while `autorotate` stays edge-only (it needs a slope)
    kind: 'enum',
    groups: [GROUP_NODES, GROUP_EDGES],
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
      group === GROUP_NODES
        ? NODE_DEFAULTS.textRotation
        : EDGE_DEFAULTS.textRotation,
  },
  [PROP.SOURCE_TEXT_OFFSET]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.sourceTextOffset = v as number;
    },
    default: () => EDGE_DEFAULTS.sourceTextOffset,
  },
  [PROP.TARGET_TEXT_OFFSET]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.targetTextOffset = v as number;
    },
    default: () => EDGE_DEFAULTS.targetTextOffset,
  },
  [PROP.SOURCE_TEXT_MARGIN_X]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.sourceTextMarginX = v as number;
    },
    default: () => EDGE_DEFAULTS.sourceTextMarginX,
  },
  [PROP.SOURCE_TEXT_MARGIN_Y]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.sourceTextMarginY = v as number;
    },
    default: () => EDGE_DEFAULTS.sourceTextMarginY,
  },
  [PROP.TARGET_TEXT_MARGIN_X]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.targetTextMarginX = v as number;
    },
    default: () => EDGE_DEFAULTS.targetTextMarginX,
  },
  [PROP.TARGET_TEXT_MARGIN_Y]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.targetTextMarginY = v as number;
    },
    default: () => EDGE_DEFAULTS.targetTextMarginY,
  },
  [PROP.SOURCE_TEXT_ROTATION]: {
    kind: 'enum',
    groups: [GROUP_EDGES],
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
  [PROP.TARGET_TEXT_ROTATION]: {
    kind: 'enum',
    groups: [GROUP_EDGES],
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
  [PROP.LINE_COLOR]: {
    kind: 'color',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.lineColor = v as RGBA;
    },
    default: () => EDGE_DEFAULTS.lineColor,
  },
  [PROP.LINE_STYLE]: {
    kind: 'enum',
    groups: [GROUP_EDGES],
    parseEnum: (v) => LINE_STYLES[String(v)] ?? null,
    set: (c, v) => {
      c.lineStyle = v as number;
    },
    default: () => EDGE_DEFAULTS.lineStyle,
  },
  [PROP.SOURCE_ARROW_COLOR]: {
    kind: 'color',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.sourceArrowColor = v as RGBA;
    },
    default: () => EDGE_DEFAULTS.sourceArrowColor,
  },
  [PROP.TARGET_ARROW_COLOR]: {
    kind: 'color',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.targetArrowColor = v as RGBA;
    },
    default: () => EDGE_DEFAULTS.targetArrowColor,
  },
  [PROP.CURVE_STYLE]: {
    kind: 'enum',
    groups: [GROUP_EDGES],
    parseEnum: (v) => CURVE_STYLES[String(v)] ?? null,
    set: (c, v) => {
      c.curveStyle = v as number;
    },
    default: () => EDGE_DEFAULTS.curveStyle,
  },
  [PROP.CONTROL_POINT_STEP_SIZE]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.controlPointStepSize = v as number;
    },
    default: () => EDGE_DEFAULTS.controlPointStepSize,
  },
  [PROP.CONTROL_POINT_WEIGHT]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.controlPointWeight = v as number;
    },
    default: () => EDGE_DEFAULTS.controlPointWeight,
  },
  [PROP.LOOP_DIRECTION]: {
    kind: 'number',
    groups: [GROUP_EDGES], // mapped values are radians
    set: (c, v) => {
      c.loopDirection = v as number;
    },
    default: () => EDGE_DEFAULTS.loopDirection,
  },
  [PROP.LOOP_SWEEP]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.loopSweep = v as number;
    },
    default: () => EDGE_DEFAULTS.loopSweep,
  },
  // 12b scalar/enum curve props are mapper-capable like 12a's; the list
  // props (control-point-distances/-weights, segment-*, radius-type)
  // take constants only — a mapper value is one number/keyword, not a
  // list (a recorded 12b scope note)
  [PROP.EDGE_DISTANCES]: {
    kind: 'enum',
    groups: [GROUP_EDGES],
    parseEnum: (v) => EDGE_DISTANCES[String(v)] ?? null,
    set: (c, v) => {
      c.edgeDistances = v as number;
    },
    default: () => EDGE_DEFAULTS.edgeDistances,
  },
  [PROP.TAXI_DIRECTION]: {
    kind: 'enum',
    groups: [GROUP_EDGES],
    parseEnum: (v) => TAXI_DIRECTIONS[String(v)] ?? null,
    set: (c, v) => {
      c.taxiDirection = v as number;
    },
    default: () => EDGE_DEFAULTS.taxiDirection,
  },
  [PROP.TAXI_TURN]: {
    // mapped turns are px (a percent turn is constant-only); a missing
    // value falls back to the default fraction as px — set an explicit
    // mapper fallback to control this.  `fallback: 'auto'` (124) rides
    // the sentinel and lands as the auto flag.
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      if (v === TAXI_TURN_AUTO_SENTINEL) {
        c.taxiTurn = 0.5;
        c.taxiTurnPercent = true;
        c.taxiTurnAuto = true;
      } else {
        c.taxiTurn = v as number;
        c.taxiTurnPercent = false;
        c.taxiTurnAuto = false;
      }
    },
    default: () => EDGE_DEFAULTS.taxiTurn,
  },
  [PROP.TAXI_TURN_MIN_DISTANCE]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.taxiTurnMinDistance = v as number;
    },
    default: () => EDGE_DEFAULTS.taxiTurnMinDistance,
  },
  [PROP.TAXI_RADIUS]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.taxiRadius = v as number;
    },
    default: () => EDGE_DEFAULTS.taxiRadius,
  },
  // round 124: which edges share a track, and how far apart tracks sit
  [PROP.TAXI_TRACK]: {
    kind: 'enum',
    groups: [GROUP_EDGES],
    parseEnum: (v) => TAXI_TRACKS[String(v)] ?? null,
    set: (c, v) => {
      c.taxiTrack = v as number;
    },
    default: () => EDGE_DEFAULTS.taxiTrack,
  },
  [PROP.TAXI_TRACK_SPACING]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.taxiTrackSpacing = Math.max(0, v as number);
    },
    default: () => EDGE_DEFAULTS.taxiTrackSpacing,
  },
  // B5 node outline (solid ring outside the border)
  [PROP.OUTLINE_COLOR]: {
    kind: 'color',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.outlineColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.outlineColor,
  },
  [PROP.OUTLINE_OPACITY]: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.outlineOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => NODE_DEFAULTS.outlineOpacity,
  },
  [PROP.OUTLINE_WIDTH]: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.outlineWidth = Math.max(0, v as number);
    },
    default: () => NODE_DEFAULTS.outlineWidth,
  },
  [PROP.OUTLINE_OFFSET]: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.outlineOffset = Math.max(0, v as number);
    },
    default: () => NODE_DEFAULTS.outlineOffset,
  },
  // B2 border/corner geometry (CPU-evaluated; the pick replica reads it)
  [PROP.CORNER_RADIUS]: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.cornerRadius = Math.max(0, v as number);
    },
    default: () => NODE_DEFAULTS.cornerRadius,
  },
  [PROP.BORDER_POSITION]: {
    kind: 'enum',
    groups: [GROUP_NODES],
    parseEnum: (v) => BORDER_POSITIONS[String(v)] ?? null,
    set: (c, v) => {
      c.borderPosition = v as number;
    },
    default: () => NODE_DEFAULTS.borderPosition,
  },
  [PROP.BORDER_STYLE]: {
    kind: 'enum',
    groups: [GROUP_NODES],
    parseEnum: (v) => STROKE_STYLES[String(v)] ?? null,
    set: (c, v) => {
      c.borderStyle = v as number;
    },
    default: () => NODE_DEFAULTS.borderStyle,
  },
  [PROP.OUTLINE_STYLE]: {
    kind: 'enum',
    groups: [GROUP_NODES],
    parseEnum: (v) => STROKE_STYLES[String(v)] ?? null,
    set: (c, v) => {
      c.outlineStyle = v as number;
    },
    default: () => NODE_DEFAULTS.outlineStyle,
  },
  [PROP.BORDER_DASH_OFFSET]: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.borderDashOffset = v as number;
    },
    default: () => NODE_DEFAULTS.borderDashOffset,
  },
  // B6 label box props
  [PROP.TEXT_TRANSFORM]: {
    kind: 'enum',
    groups: [GROUP_NODES, GROUP_EDGES],
    parseEnum: (v) => TEXT_TRANSFORMS[String(v)] ?? null,
    set: (c, v) => {
      c.textTransform = v as number;
    },
    default: () => NODE_DEFAULTS.textTransform,
  },
  [PROP.TEXT_BACKGROUND_SHAPE]: {
    kind: 'enum',
    groups: [GROUP_NODES, GROUP_EDGES],
    parseEnum: (v) => TEXT_BG_SHAPES[String(v)] ?? null,
    set: (c, v) => {
      c.textBgShape = v as number;
    },
    default: () => NODE_DEFAULTS.textBgShape,
  },
  // the wrap family (16.2): scalar/enum forms are mapper-capable like
  // every other label channel (CPU-evaluated, the sidecar tier)
  [PROP.TEXT_WRAP]: {
    kind: 'enum',
    groups: [GROUP_NODES, GROUP_EDGES],
    parseEnum: (v) => TEXT_WRAPS[String(v)] ?? null,
    set: (c, v) => {
      c.textWrap = v as number;
    },
    default: () => NODE_DEFAULTS.textWrap,
  },
  [PROP.TEXT_MAX_WIDTH]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.textMaxWidth = Math.max(0, v as number);
    },
    default: () => NODE_DEFAULTS.textMaxWidth,
  },
  [PROP.LINE_HEIGHT]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.lineHeight = Math.max(0, v as number);
    },
    default: () => NODE_DEFAULTS.lineHeight,
  },
  [PROP.TEXT_OVERFLOW_WRAP]: {
    kind: 'enum',
    groups: [GROUP_NODES, GROUP_EDGES],
    parseEnum: (v) => OFLOW_WRAPS[String(v)] ?? null,
    set: (c, v) => {
      c.textOverflowWrap = v as number;
    },
    default: () => NODE_DEFAULTS.textOverflowWrap,
  },
  [PROP.TEXT_JUSTIFICATION]: {
    kind: 'enum',
    groups: [GROUP_NODES, GROUP_EDGES],
    parseEnum: (v) => JUSTIFICATIONS[String(v)] ?? null,
    set: (c, v) => {
      c.textJustification = v as number;
    },
    default: () => NODE_DEFAULTS.textJustification,
  },
  [PROP.TEXT_BORDER_WIDTH]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.textBorderWidth = Math.max(0, v as number);
    },
    default: () => NODE_DEFAULTS.textBorderWidth,
  },
  [PROP.TEXT_BORDER_COLOR]: {
    kind: 'color',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.textBorderColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.textBorderColor,
  },
  [PROP.TEXT_BORDER_OPACITY]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.textBorderOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => NODE_DEFAULTS.textBorderOpacity,
  },
  // C2 gradient enums (stop lists stay constants-only)
  [PROP.BACKGROUND_FILL]: {
    kind: 'enum',
    groups: [GROUP_NODES],
    parseEnum: (v) => FILL_KINDS[String(v)] ?? null,
    set: (c, v) => {
      c.backgroundFill = v as number;
    },
    default: () => NODE_DEFAULTS.backgroundFill,
  },
  [PROP.BACKGROUND_GRADIENT_DIRECTION]: {
    kind: 'enum',
    groups: [GROUP_NODES],
    parseEnum: (v) => GRADIENT_DIRECTIONS[String(v)] ?? null,
    set: (c, v) => {
      c.backgroundGradientDirection = v as number;
    },
    default: () => NODE_DEFAULTS.backgroundGradientDirection,
  },
  [PROP.LINE_FILL]: {
    kind: 'enum',
    groups: [GROUP_EDGES],
    parseEnum: (v) => FILL_KINDS[String(v)] ?? null,
    set: (c, v) => {
      c.lineFill = v as number;
    },
    default: () => EDGE_DEFAULTS.lineFill,
  },
  // C1 mid arrows
  [PROP.MID_SOURCE_ARROW_SHAPE]: {
    kind: 'enum',
    groups: [GROUP_EDGES],
    parseEnum: (v) => ARROW_ENUM[String(v)] ?? null,
    set: (c, v) => {
      c.midSourceArrowShape = ARROW_NAMES[v as number] ?? 'none';
    },
    default: () => 0,
  },
  [PROP.MID_TARGET_ARROW_SHAPE]: {
    kind: 'enum',
    groups: [GROUP_EDGES],
    parseEnum: (v) => ARROW_ENUM[String(v)] ?? null,
    set: (c, v) => {
      c.midTargetArrowShape = ARROW_NAMES[v as number] ?? 'none';
    },
    default: () => 0,
  },
  [PROP.MID_SOURCE_ARROW_COLOR]: {
    kind: 'color',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.midSourceArrowColor = v as RGBA;
    },
    default: () => EDGE_DEFAULTS.midSourceArrowColor,
  },
  [PROP.MID_TARGET_ARROW_COLOR]: {
    kind: 'color',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.midTargetArrowColor = v as RGBA;
    },
    default: () => EDGE_DEFAULTS.midTargetArrowColor,
  },
  // B7 arrow scalars (arrow widths are constants: keyword/% forms)
  [PROP.ARROW_SCALE]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.arrowScale = Math.max(0.0625, v as number);
    },
    default: () => EDGE_DEFAULTS.arrowScale,
  },
  [PROP.SOURCE_ARROW_FILL]: {
    kind: 'enum',
    groups: [GROUP_EDGES],
    parseEnum: (v) => ARROW_FILLS[String(v)] ?? null,
    set: (c, v) => {
      c.sourceArrowFill = v as number;
    },
    default: () => EDGE_DEFAULTS.sourceArrowFill,
  },
  [PROP.TARGET_ARROW_FILL]: {
    kind: 'enum',
    groups: [GROUP_EDGES],
    parseEnum: (v) => ARROW_FILLS[String(v)] ?? null,
    set: (c, v) => {
      c.targetArrowFill = v as number;
    },
    default: () => EDGE_DEFAULTS.targetArrowFill,
  },
  // B4 line-outline casing
  [PROP.LINE_OUTLINE_WIDTH]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.lineOutlineWidth = Math.max(0, v as number);
    },
    default: () => EDGE_DEFAULTS.lineOutlineWidth,
  },
  [PROP.LINE_OUTLINE_COLOR]: {
    kind: 'color',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.lineOutlineColor = v as RGBA;
    },
    default: () => EDGE_DEFAULTS.lineOutlineColor,
  },
  // B3 dash props (pattern is a constants-only list)
  [PROP.LINE_CAP]: {
    kind: 'enum',
    groups: [GROUP_EDGES],
    parseEnum: (v) => LINE_CAPS[String(v)] ?? null,
    set: (c, v) => {
      c.lineCap = v as number;
    },
    default: () => EDGE_DEFAULTS.lineCap,
  },
  [PROP.LINE_DASH_OFFSET]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.lineDashOffset = v as number;
    },
    default: () => EDGE_DEFAULTS.lineDashOffset,
  },
  // the B1 opacity split (CPU-evaluated; folds at write time)
  [PROP.BACKGROUND_OPACITY]: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.backgroundOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => NODE_DEFAULTS.backgroundOpacity,
  },
  [PROP.BORDER_OPACITY]: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.borderOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => NODE_DEFAULTS.borderOpacity,
  },
  [PROP.LINE_OPACITY]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.lineOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => EDGE_DEFAULTS.lineOpacity,
  },
  [PROP.TEXT_OPACITY]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.textOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => NODE_DEFAULTS.textOpacity,
  },
  // events (round 20.2): pointer transparency, both groups
  events: {
    kind: 'enum',
    groups: [GROUP_NODES, GROUP_EDGES],
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
    groups: [GROUP_NODES, GROUP_EDGES],
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
    groups: [GROUP_NODES],
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
  [PROP.CHART_OPACITY]: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.chartOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => 1,
  },
  [PROP.CHART_SIZE]: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.chartSize = Math.max(0, Math.min(1, v as number));
    },
    default: () => 1,
  },
  [PROP.CHART_HOLE]: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.chartHole = Math.max(0, Math.min(1, v as number));
    },
    default: () => 0,
  },
  [PROP.CHART_START_ANGLE]: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.chartStartAngle = v as number;
    },
    default: () => 0,
  },
  [PROP.CHART_DIRECTION]: {
    kind: 'enum',
    groups: [GROUP_NODES],
    parseEnum: (v) => (v === 'vertical' ? 0 : v === 'horizontal' ? 1 : null),
    set: (c, v) => {
      c.chartDirection = v as number;
    },
    default: () => 0,
  },
  // text-events (round 20.3): the label box picks the node; node-only
  [PROP.TEXT_EVENTS]: {
    kind: 'enum',
    groups: [GROUP_NODES],
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
    groups: [GROUP_NODES],
    parseEnum: (v) =>
      v === 'yes' || v === true ? 1 : v === 'no' || v === false ? 0 : null,
    set: (c, v) => {
      c.ghost = (v as number) === 1;
    },
    default: () => (NODE_DEFAULTS.ghost ? 1 : 0),
  },
  [PROP.GHOST_OFFSET_X]: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.ghostOffsetX = v as number;
    },
    default: () => NODE_DEFAULTS.ghostOffsetX,
  },
  [PROP.GHOST_OFFSET_Y]: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.ghostOffsetY = v as number;
    },
    default: () => NODE_DEFAULTS.ghostOffsetY,
  },
  [PROP.GHOST_OPACITY]: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.ghostOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => NODE_DEFAULTS.ghostOpacity,
  },
  // overlay/underlay props (round 13 A2; node-only)
  [PROP.OVERLAY_COLOR]: {
    kind: 'color',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.overlayColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.overlayColor,
  },
  [PROP.OVERLAY_OPACITY]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.overlayOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => NODE_DEFAULTS.overlayOpacity,
  },
  [PROP.OVERLAY_PADDING]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.overlayPadding = Math.max(0, v as number);
    },
    default: () => NODE_DEFAULTS.overlayPadding,
  },
  [PROP.UNDERLAY_COLOR]: {
    kind: 'color',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.underlayColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.underlayColor,
  },
  [PROP.UNDERLAY_OPACITY]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.underlayOpacity = Math.max(0, Math.min(1, v as number));
    },
    default: () => NODE_DEFAULTS.underlayOpacity,
  },
  [PROP.UNDERLAY_PADDING]: {
    kind: 'number',
    groups: [GROUP_NODES, GROUP_EDGES],
    set: (c, v) => {
      c.underlayPadding = Math.max(0, v as number);
    },
    default: () => NODE_DEFAULTS.underlayPadding,
  },
  // 12c scalar curve props (source/target-endpoint stays constants-only:
  // its point form is a list, per the 12b list-prop scope rule)
  [PROP.HAYSTACK_RADIUS]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.haystackRadius = Math.max(0, Math.min(1, v as number));
    },
    default: () => EDGE_DEFAULTS.haystackRadius,
  },
  [PROP.SOURCE_DISTANCE_FROM_NODE]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.sourceDistanceFromNode = Math.max(0, v as number);
    },
    default: () => EDGE_DEFAULTS.sourceDistanceFromNode,
  },
  [PROP.TARGET_DISTANCE_FROM_NODE]: {
    kind: 'number',
    groups: [GROUP_EDGES],
    set: (c, v) => {
      c.targetDistanceFromNode = Math.max(0, v as number);
    },
    default: () => EDGE_DEFAULTS.targetDistanceFromNode,
  },
  [PROP.SOURCE_ARROW_SHAPE]: {
    kind: 'enum',
    groups: [GROUP_EDGES],
    parseEnum: (v) => ARROW_ENUM[String(v)] ?? null,
    set: (c, v) => {
      c.sourceArrowShape = ARROW_NAMES[v as number] ?? 'none';
    },
    default: () => 0,
  },
  [PROP.TARGET_ARROW_SHAPE]: {
    kind: 'enum',
    groups: [GROUP_EDGES],
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
  [PROP.BACKGROUND_IMAGE]: {
    kind: 'enum',
    groups: [GROUP_NODES],
    intern: true,
    set: () => {
      /* wrapped per compile */
    },
    default: () => 0, // 0 = none in the intern index space
  },
  [PROP.BACKGROUND_IMAGE_OPACITY]: {
    kind: 'number',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.backgroundImageOpacity = [Math.max(0, Math.min(1, v as number))];
    },
    default: () => 1,
  },
  [PROP.BACKGROUND_IMAGE_COLOR]: {
    kind: 'color',
    groups: [GROUP_NODES],
    set: (c, v) => {
      c.backgroundImageColor = v as RGBA;
    },
    default: () => NODE_DEFAULTS.backgroundImageColor,
  },
};
