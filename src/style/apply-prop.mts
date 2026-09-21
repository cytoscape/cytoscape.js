import { GROUP_EDGES, GROUP_NODES } from '../contract.mjs';
import { isMapperSpec } from '../style-scales.mjs';
import type { GroupName } from '../contract.mjs';
import { PROP } from '../style-props.mjs';
import { NODE_DEFAULTS, DATA_MAPPER } from './defaults.mjs';
import type { Computed } from './defaults.mjs';
import {
  CURVE_PROPS,
  GLOBAL_FONT_PROPS,
  END_LABEL_PROPS,
  NODE_ONLY_EXTRA,
  GHOST_PROPS,
  CHART_PROPS,
  LAYER_SHAPE_PROPS,
  IMAGE_PROPS,
} from './tables.mjs';
import {
  parseColor,
  parseNumber,
  parseZeroOne,
  parseLayerShape,
  parseLayerRadius,
  TEXT_WRAPS,
  OFLOW_WRAPS,
  JUSTIFICATIONS,
  parseKeyword,
  parseTextTransform,
  parseTextBgShape,
  parseArrowFill,
  parseArrowWidth,
  parseLineCap,
  normalizeDashPattern,
  parseFill,
  parseGradientDirection,
  parseColorList,
  parsePercentList,
  BG_FITS,
  BG_REPEATS,
  BG_CLIPS,
  BG_CONTAINMENTS,
  IMAGE_TYPES,
  BG_CROSSORIGINS,
  parseImageList,
  parseImageEnum,
  parseBgLen,
  parseBgSize,
  parseUrls,
  HALIGNS,
  VALIGNS,
  parseAlign,
  parseBorderPosition,
  parseStrokeStyle,
  parseChartKind,
  parseChartValues,
  parseChartColors,
  parseChartFraction,
  parseYesNo,
} from './parse.mjs';
import {
  parseNonNegative,
  parseShape,
  parseLineStyle,
  parseTextRotation,
  parseCurveStyle,
  parseNumberList,
  parsePolygonPoints,
  parseRadiusTypes,
  parseEdgeDistances,
  parseEndpoint,
  parseTaxiDirection,
  parseTaxiTurn,
  parseTaxiTrack,
  parseAngle,
  parseArrowShape,
} from './parse-edge.mjs';
import { TRANSITION_CONFIG_PROPS } from './compile.mjs';
import { COMPOUND_PROPS } from './sheet.mjs';

/** Apply one (normalized-name) prop onto a computed record. */
export const applyProp = (
  computed: Computed,
  prop: string,
  value: unknown,
): void => {
  switch (prop) {
    // node properties
    case PROP.BACKGROUND_COLOR:
      computed.fillColor = parseColor(prop, value);
      break;
    case PROP.BORDER_COLOR:
      computed.borderColor = parseColor(prop, value);
      break;
    case PROP.WIDTH: // node width or edge line width, resolved per group at apply time
      computed.width = parseNumber(prop, value);
      break;
    case PROP.HEIGHT:
      computed.height = parseNumber(prop, value);
      break;
    case PROP.SHAPE:
      computed.shape = parseShape(value);
      break;
    case PROP.SHAPE_POLYGON_POINTS:
      computed.shapePolygonPoints = parsePolygonPoints(prop, value);
      break;
    case PROP.TEXT_OUTLINE_WIDTH:
      computed.textOutlineWidth = parseNumber(prop, value);
      break;
    case PROP.TEXT_OUTLINE_COLOR:
      computed.textOutlineColor = parseColor(prop, value);
      break;
    case PROP.TEXT_OUTLINE_OPACITY:
      computed.textOutlineOpacity = parseNumber(prop, value);
      break;
    case PROP.TEXT_BACKGROUND_COLOR:
      computed.textBgColor = parseColor(prop, value);
      break;
    case PROP.TEXT_BACKGROUND_OPACITY:
      computed.textBgOpacity = parseNumber(prop, value);
      break;
    case PROP.TEXT_BACKGROUND_PADDING:
      computed.textBgPadding = parseNumber(prop, value);
      break;
    case PROP.TEXT_MARGIN_X:
      computed.textMarginX = parseNumber(prop, value);
      break;
    case PROP.TEXT_MARGIN_Y:
      computed.textMarginY = parseNumber(prop, value);
      break;
    case PROP.MIN_ZOOMED_FONT_SIZE:
      computed.minZoomedFontSize = parseNonNegative(prop, value);
      break;
    case PROP.TEXT_HALIGN:
      computed.textHalign = parseAlign(prop, value, HALIGNS);
      break;
    case PROP.TEXT_VALIGN:
      computed.textValign = parseAlign(prop, value, VALIGNS);
      break;
    case PROP.TEXT_ROTATION:
      computed.textRotation = parseTextRotation(value);
      break;
    case PROP.TEXT_TRANSFORM:
      computed.textTransform = parseTextTransform(value);
      break;
    case PROP.TEXT_WRAP:
      computed.textWrap = parseKeyword(prop, TEXT_WRAPS)(value);
      break;
    case PROP.TEXT_MAX_WIDTH:
      computed.textMaxWidth = parseNonNegative(prop, value);
      break;
    case PROP.LINE_HEIGHT:
      computed.lineHeight = parseNonNegative(prop, value);
      break;
    case PROP.TEXT_OVERFLOW_WRAP:
      computed.textOverflowWrap = parseKeyword(prop, OFLOW_WRAPS)(value);
      break;
    case PROP.TEXT_JUSTIFICATION:
      computed.textJustification = parseKeyword(prop, JUSTIFICATIONS)(value);
      break;
    case PROP.TEXT_BACKGROUND_SHAPE:
      computed.textBgShape = parseTextBgShape(value);
      break;
    case PROP.TEXT_BORDER_WIDTH:
      computed.textBorderWidth = parseNonNegative(prop, value);
      break;
    case PROP.TEXT_BORDER_COLOR:
      computed.textBorderColor = parseColor(prop, value);
      break;
    case PROP.TEXT_BORDER_OPACITY:
      computed.textBorderOpacity = parseZeroOne(prop, value);
      break;
    case PROP.BORDER_WIDTH:
      computed.borderWidth = parseNumber(prop, value);
      break;
    case PROP.CORNER_RADIUS:
      computed.cornerRadius = parseLayerRadius(prop, value);
      break;
    case PROP.BORDER_POSITION:
      computed.borderPosition = parseBorderPosition(value);
      break;
    case PROP.BORDER_STYLE:
      computed.borderStyle = parseStrokeStyle(prop, value);
      break;
    case PROP.BORDER_DASH_PATTERN:
      computed.borderDashPattern = normalizeDashPattern(
        parseNumberList(prop, value),
        NODE_DEFAULTS.borderDashPattern,
      );
      break;
    case PROP.BORDER_DASH_OFFSET:
      computed.borderDashOffset = parseNumber(prop, value);
      break;
    case PROP.OUTLINE_STYLE:
      computed.outlineStyle = parseStrokeStyle(prop, value);
      break;
    case PROP.OUTLINE_COLOR:
      computed.outlineColor = parseColor(prop, value);
      break;
    case PROP.OUTLINE_OPACITY:
      computed.outlineOpacity = parseZeroOne(prop, value);
      break;
    case PROP.OUTLINE_WIDTH:
      computed.outlineWidth = parseNonNegative(prop, value);
      break;
    case PROP.OUTLINE_OFFSET:
      computed.outlineOffset = parseNonNegative(prop, value);
      break;
    case PROP.BACKGROUND_OPACITY:
      computed.backgroundOpacity = parseZeroOne(prop, value);
      break;
    case PROP.BACKGROUND_FILL:
      computed.backgroundFill = parseFill(prop, value);
      break;
    case PROP.BACKGROUND_GRADIENT_STOP_COLORS:
      computed.backgroundGradientStopColors = parseColorList(prop, value);
      break;
    case PROP.BACKGROUND_GRADIENT_STOP_POSITIONS:
      computed.backgroundGradientStopPositions = parsePercentList(prop, value);
      break;
    case PROP.BACKGROUND_GRADIENT_DIRECTION:
      computed.backgroundGradientDirection = parseGradientDirection(value);
      break;
    case PROP.LINE_FILL:
      computed.lineFill = parseFill(prop, value);
      break;
    case PROP.LINE_GRADIENT_STOP_COLORS:
      computed.lineGradientStopColors = parseColorList(prop, value);
      break;
    case PROP.LINE_GRADIENT_STOP_POSITIONS:
      computed.lineGradientStopPositions = parsePercentList(prop, value);
      break;
    case PROP.BORDER_OPACITY:
      computed.borderOpacity = parseZeroOne(prop, value);
      break;
    case PROP.LINE_OPACITY:
      computed.lineOpacity = parseZeroOne(prop, value);
      break;
    case PROP.LINE_CAP:
      computed.lineCap = parseLineCap(value);
      break;
    case PROP.LINE_OUTLINE_WIDTH:
      computed.lineOutlineWidth = parseNonNegative(prop, value);
      break;
    case PROP.LINE_OUTLINE_COLOR:
      computed.lineOutlineColor = parseColor(prop, value);
      break;
    case PROP.LINE_DASH_PATTERN:
      computed.lineDashPattern = normalizeDashPattern(
        parseNumberList(prop, value),
      );
      break;
    case PROP.LINE_DASH_OFFSET:
      computed.lineDashOffset = parseNumber(prop, value);
      break;
    case PROP.TEXT_OPACITY:
      computed.textOpacity = parseZeroOne(prop, value);
      break;
    case PROP.EVENTS:
      computed.eventsEnabled = parseYesNo(prop, value);
      break;
    case PROP.VISIBILITY:
      if (value !== 'visible' && value !== 'hidden') {
        throw new Error(
          `The visibility '${String(value)}' must be 'visible' or 'hidden'`,
        );
      }

      computed.invisible = value === 'hidden';
      break;
    case PROP.CHART:
      computed.chartKind = parseChartKind(prop, value);
      break;
    case PROP.CHART_VALUES:
      computed.chartValues = parseChartValues(prop, value);
      computed.chartValuesKey = null;
      break;
    case PROP.CHART_COLORS:
      computed.chartColors = parseChartColors(prop, value);
      break;
    case PROP.CHART_SIZE:
      computed.chartSize = parseChartFraction(prop, value);
      break;
    case PROP.CHART_HOLE:
      computed.chartHole = parseChartFraction(prop, value);
      break;
    case PROP.CHART_START_ANGLE:
      computed.chartStartAngle = parseAngle(prop, value);
      break;
    case PROP.CHART_DIRECTION:
      if (value !== 'vertical' && value !== 'horizontal') {
        throw new Error(
          `The chart-direction '${String(value)}' must be 'vertical' or 'horizontal'`,
        );
      }

      computed.chartDirection = value === 'horizontal' ? 1 : 0;
      break;
    case PROP.CHART_OPACITY:
      computed.chartOpacity = parseZeroOne(prop, value);
      break;
    case PROP.TEXT_EVENTS:
      computed.textEvents = parseYesNo(prop, value);
      break;
    case PROP.GHOST:
      computed.ghost = parseYesNo(prop, value);
      break;
    case PROP.GHOST_OFFSET_X:
      computed.ghostOffsetX = parseNumber(prop, value);
      break;
    case PROP.GHOST_OFFSET_Y:
      computed.ghostOffsetY = parseNumber(prop, value);
      break;
    case PROP.OVERLAY_COLOR:
      computed.overlayColor = parseColor(prop, value);
      break;
    case PROP.OVERLAY_OPACITY:
      computed.overlayOpacity = parseZeroOne(prop, value);
      break;
    case PROP.OVERLAY_PADDING:
      computed.overlayPadding = parseNonNegative(prop, value);
      break;
    case PROP.OVERLAY_SHAPE:
      computed.overlayShape = parseLayerShape(prop, value);
      break;
    case PROP.OVERLAY_CORNER_RADIUS:
      computed.overlayRadius = parseLayerRadius(prop, value);
      break;
    case PROP.UNDERLAY_COLOR:
      computed.underlayColor = parseColor(prop, value);
      break;
    case PROP.UNDERLAY_OPACITY:
      computed.underlayOpacity = parseZeroOne(prop, value);
      break;
    case PROP.UNDERLAY_PADDING:
      computed.underlayPadding = parseNonNegative(prop, value);
      break;
    case PROP.UNDERLAY_SHAPE:
      computed.underlayShape = parseLayerShape(prop, value);
      break;
    case PROP.UNDERLAY_CORNER_RADIUS:
      computed.underlayRadius = parseLayerRadius(prop, value);
      break;
    case PROP.GHOST_OPACITY: {
      const op = parseNumber(prop, value);

      if (op < 0 || op > 1) {
        throw new Error(
          `The ghost-opacity '${String(value)}' must be within [0, 1]`,
        );
      }

      computed.ghostOpacity = op;
      break;
    }
    case PROP.OPACITY:
      computed.opacity = parseNumber(prop, value);
      break;
    case PROP.LABEL: {
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
    case PROP.SOURCE_LABEL:
    case PROP.TARGET_LABEL: {
      // same rules as 'label': constants or the data(key) passthrough
      const text = String(value);
      const mapped = DATA_MAPPER.exec(text);
      const src = prop === PROP.SOURCE_LABEL;

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
    case PROP.SOURCE_TEXT_OFFSET:
      computed.sourceTextOffset = parseNonNegative(prop, value);
      break;
    case PROP.TARGET_TEXT_OFFSET:
      computed.targetTextOffset = parseNonNegative(prop, value);
      break;
    case PROP.SOURCE_TEXT_MARGIN_X:
      computed.sourceTextMarginX = parseNumber(prop, value);
      break;
    case PROP.SOURCE_TEXT_MARGIN_Y:
      computed.sourceTextMarginY = parseNumber(prop, value);
      break;
    case PROP.TARGET_TEXT_MARGIN_X:
      computed.targetTextMarginX = parseNumber(prop, value);
      break;
    case PROP.TARGET_TEXT_MARGIN_Y:
      computed.targetTextMarginY = parseNumber(prop, value);
      break;
    case PROP.SOURCE_TEXT_ROTATION:
      computed.sourceTextRotation = parseTextRotation(value);
      break;
    case PROP.TARGET_TEXT_ROTATION:
      computed.targetTextRotation = parseTextRotation(value);
      break;
    case PROP.FONT_SIZE:
      computed.fontSize = parseNumber(prop, value);
      break;
    case PROP.FONT_FAMILY: {
      const family = String(value).trim();

      if (family === '') {
        throw new Error(
          `The value '${String(value)}' is not a valid font-family`,
        );
      }

      computed.fontFamily = family;
      break;
    }
    case PROP.FONT_STYLE: {
      const style = String(value);

      if (style !== 'normal' && style !== 'italic' && style !== 'oblique') {
        throw new Error(
          `The font-style '${style}' is invalid; use normal, italic or oblique`,
        );
      }

      computed.fontStyle = style;
      break;
    }
    case PROP.FONT_WEIGHT: {
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
    case PROP.COLOR:
      computed.textColor = parseColor(prop, value);
      break;

    // edge properties
    case PROP.LINE_COLOR:
      computed.lineColor = parseColor(prop, value);
      break;
    case PROP.LINE_STYLE:
      computed.lineStyle = parseLineStyle(value);
      break;
    case PROP.SOURCE_ARROW_SHAPE:
      computed.sourceArrowShape = parseArrowShape(prop, value);
      break;
    case PROP.TARGET_ARROW_SHAPE:
      computed.targetArrowShape = parseArrowShape(prop, value);
      break;
    case PROP.SOURCE_ARROW_COLOR:
      computed.sourceArrowColor = parseColor(prop, value);
      break;
    case PROP.ARROW_SCALE: {
      const scale = parseNumber(prop, value);

      if (scale <= 0) {
        throw new Error(`The arrow-scale '${String(value)}' must be positive`);
      }

      computed.arrowScale = scale;
      break;
    }
    case PROP.SOURCE_ARROW_FILL:
      computed.sourceArrowFill = parseArrowFill(value);
      break;
    case PROP.TARGET_ARROW_FILL:
      computed.targetArrowFill = parseArrowFill(value);
      break;
    case PROP.SOURCE_ARROW_WIDTH:
      computed.sourceArrowWidth = parseArrowWidth(prop, value);
      break;
    case PROP.TARGET_ARROW_WIDTH:
      computed.targetArrowWidth = parseArrowWidth(prop, value);
      break;
    case PROP.TARGET_ARROW_COLOR:
      computed.targetArrowColor = parseColor(prop, value);
      break;
    case PROP.MID_SOURCE_ARROW_SHAPE:
      computed.midSourceArrowShape = parseArrowShape(prop, value);
      break;
    case PROP.MID_TARGET_ARROW_SHAPE:
      computed.midTargetArrowShape = parseArrowShape(prop, value);
      break;
    case PROP.MID_SOURCE_ARROW_COLOR:
      computed.midSourceArrowColor = parseColor(prop, value);
      break;
    case PROP.MID_TARGET_ARROW_COLOR:
      computed.midTargetArrowColor = parseColor(prop, value);
      break;
    case PROP.CURVE_STYLE:
      computed.curveStyle = parseCurveStyle(value);
      break;
    case PROP.CONTROL_POINT_STEP_SIZE:
      computed.controlPointStepSize = parseNumber(prop, value);
      break;
    case PROP.CONTROL_POINT_WEIGHT:
      computed.controlPointWeight = parseNumber(prop, value);
      break;
    case PROP.LOOP_DIRECTION:
      computed.loopDirection = parseAngle(prop, value);
      break;
    case PROP.LOOP_SWEEP:
      computed.loopSweep = parseAngle(prop, value);
      break;
    case PROP.CONTROL_POINT_DISTANCES:
      computed.controlPointDistances = parseNumberList(prop, value);
      break;
    case PROP.CONTROL_POINT_WEIGHTS:
      computed.controlPointWeights = parseNumberList(prop, value);
      break;
    case PROP.SEGMENT_DISTANCES:
      computed.segmentDistances = parseNumberList(prop, value);
      break;
    case PROP.SEGMENT_WEIGHTS:
      computed.segmentWeights = parseNumberList(prop, value);
      break;
    case PROP.SEGMENT_RADII:
      computed.segmentRadii = parseNumberList(prop, value);
      break;
    case PROP.RADIUS_TYPE:
      computed.radiusTypes = parseRadiusTypes(prop, value);
      break;
    case PROP.EDGE_DISTANCES:
      computed.edgeDistances = parseEdgeDistances(value);
      break;
    case PROP.TAXI_DIRECTION:
      computed.taxiDirection = parseTaxiDirection(value);
      break;
    case PROP.TAXI_TURN: {
      const turn = parseTaxiTurn(value);

      computed.taxiTurn = turn.value;
      computed.taxiTurnPercent = turn.percent;
      computed.taxiTurnAuto = turn.auto;
      break;
    }
    case PROP.TAXI_TURN_MIN_DISTANCE:
      computed.taxiTurnMinDistance = parseNumber(prop, value);
      break;
    case PROP.TAXI_RADIUS:
      computed.taxiRadius = parseNumber(prop, value);
      break;
    case PROP.TAXI_TRACK:
      computed.taxiTrack = parseTaxiTrack(value);
      break;
    case PROP.TAXI_TRACK_SPACING:
      computed.taxiTrackSpacing = parseNonNegative(prop, value);
      break;
    case PROP.HAYSTACK_RADIUS: {
      const radius = parseNumber(prop, value);

      if (radius < 0 || radius > 1) {
        throw new Error(
          `The haystack-radius '${String(value)}' must be within [0, 1]`,
        );
      }

      computed.haystackRadius = radius;
      break;
    }
    case PROP.SOURCE_ENDPOINT:
      computed.sourceEndpoint = parseEndpoint(prop, value);
      break;
    case PROP.TARGET_ENDPOINT:
      computed.targetEndpoint = parseEndpoint(prop, value);
      break;
    case PROP.SOURCE_DISTANCE_FROM_NODE:
      computed.sourceDistanceFromNode = parseNonNegative(prop, value);
      break;
    case PROP.TARGET_DISTANCE_FROM_NODE:
      computed.targetDistanceFromNode = parseNonNegative(prop, value);
      break;

    // background images (round 15.2); per-image props accept scalars or
    // arrays (v3's multiple: true), distributing last-value-repeats
    case PROP.BACKGROUND_IMAGE:
      computed.backgroundImage = parseUrls(prop, value);
      break;
    case PROP.BACKGROUND_FIT:
      computed.backgroundFit = parseImageList(
        prop,
        value,
        parseImageEnum(prop, BG_FITS),
      );
      break;
    case PROP.BACKGROUND_IMAGE_OPACITY:
      computed.backgroundImageOpacity = parseImageList(prop, value, (v) => {
        const op = parseNumber(prop, v);

        if (op < 0 || op > 1) {
          throw new Error(`The ${prop} '${String(v)}' must be within [0, 1]`);
        }

        return op;
      });
      break;
    case PROP.BACKGROUND_POSITION_X:
      computed.backgroundPositionX = parseImageList(
        prop,
        value,
        parseBgLen(prop),
      );
      break;
    case PROP.BACKGROUND_POSITION_Y:
      computed.backgroundPositionY = parseImageList(
        prop,
        value,
        parseBgLen(prop),
      );
      break;
    case PROP.BACKGROUND_OFFSET_X:
      computed.backgroundOffsetX = parseImageList(
        prop,
        value,
        parseBgLen(prop),
      );
      break;
    case PROP.BACKGROUND_OFFSET_Y:
      computed.backgroundOffsetY = parseImageList(
        prop,
        value,
        parseBgLen(prop),
      );
      break;
    case PROP.BACKGROUND_WIDTH:
      computed.backgroundWidth = parseImageList(prop, value, parseBgSize(prop));
      break;
    case PROP.BACKGROUND_HEIGHT:
      computed.backgroundHeight = parseImageList(
        prop,
        value,
        parseBgSize(prop),
      );
      break;
    case PROP.BACKGROUND_REPEAT:
      computed.backgroundRepeat = parseImageList(
        prop,
        value,
        parseImageEnum(prop, BG_REPEATS),
      );
      break;
    case PROP.BACKGROUND_CLIP:
      computed.backgroundClip = parseImageList(
        prop,
        value,
        parseImageEnum(prop, BG_CLIPS),
      );
      break;
    case PROP.BACKGROUND_IMAGE_CONTAINMENT:
      computed.backgroundImageContainment = parseImageList(
        prop,
        value,
        parseImageEnum(prop, BG_CONTAINMENTS),
      );
      break;
    case PROP.BACKGROUND_IMAGE_SMOOTHING:
      computed.backgroundImageSmoothing = parseImageList(prop, value, (v) =>
        parseYesNo(prop, v),
      );
      break;
    case PROP.BACKGROUND_IMAGE_TYPE:
      computed.backgroundImageType = parseImageList(
        prop,
        value,
        parseImageEnum(prop, IMAGE_TYPES),
      );
      break;
    case PROP.BACKGROUND_IMAGE_COLOR:
      computed.backgroundImageColor = parseColor(prop, value);
      break;
    case PROP.BACKGROUND_IMAGE_CROSSORIGIN: {
      const co = String(value);

      if (!BG_CROSSORIGINS.has(co)) {
        throw new Error(
          `The ${prop} '${co}' is unsupported; use anonymous, use-credentials or null`,
        );
      }

      computed.backgroundImageCrossorigin = co;
      break;
    }
    case PROP.BACKGROUND_WIDTH_RELATIVE_TO:
    case PROP.BACKGROUND_HEIGHT_RELATIVE_TO:
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
export const assertGroupProp = (
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

  if (END_LABEL_PROPS.has(norm) && group === GROUP_NODES) {
    throw new Error(`'${norm}' is an edge style property`);
  }

  // the raw sheet value may be a mapper object here, so test the
  // keyword directly rather than parsing
  if (
    norm === PROP.TEXT_ROTATION &&
    group === GROUP_NODES &&
    value === 'autorotate'
  ) {
    // 27.7: numeric rotations now work on node labels; `autorotate`
    // is still an edge concept — it resolves from the edge's slope,
    // and a node has none
    throw new Error(
      `text-rotation 'autorotate' is edge-only; nodes take a number of radians`,
    );
  }

  if (CURVE_PROPS.has(norm) && group === GROUP_NODES) {
    throw new Error(`'${norm}' is an edge style property`);
  }

  if (
    (GHOST_PROPS.has(norm) ||
      LAYER_SHAPE_PROPS.has(norm) ||
      NODE_ONLY_EXTRA.has(norm) ||
      IMAGE_PROPS.has(norm) ||
      CHART_PROPS.has(norm)) &&
    group === GROUP_EDGES
  ) {
    throw new Error(`'${norm}' is a node style property`);
  }

  if (GLOBAL_FONT_PROPS.has(norm)) {
    // one glyph atlas keyed by character ⇒ one font face, globally
    if (group === GROUP_EDGES) {
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
export type BypassPatch = readonly (readonly [string, unknown])[];

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
export const captureBypassPatch = (
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
