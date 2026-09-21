// StyleEngine's write side (round 130 split): the shared channel writers
// and the column write dispatch, `write` down to `writeLabel`.

import {
  GROUP_EDGES,
  GROUP_NODES,
  DATA_TARGET,
  DATA_SOURCE,
  DATA_ID,
  COL,
  packArrowShapes,
  CHART_MAX_SLICES,
  CHART_NONE,
  FLAG_NO_EVENTS,
  FLAG_TEXT_EVENTS,
  LABEL_MARGIN,
  SHAPE_CIRCLE,
  SHAPE_ELLIPSE,
  SHAPE_POLYGON_CUSTOM,
} from '../contract.mjs';
import { CURVE_STYLE_HAYSTACK, isBlobStyle } from '../store/curve-index.mjs';
import type { CurveStyleExtras, EndpointSpec } from '../store/curve-index.mjs';
import type { NodeImageSpec } from '../store/graph-store.mjs';
import { ENDPT_DEFAULT } from '../curve-geometry.mjs';
import type { GroupName } from '../contract.mjs';
import { PROP } from '../style-props.mjs';
import { NO_ARROW } from './defaults.mjs';
import type { RGBA, NodeComputed, Computed, ArrowShape } from './defaults.mjs';
import {
  stringify,
  packRgba,
  foldRgba,
  foldLayerRgba,
  DEFAULT_CHART_COLORS,
  IMAGE_CAP,
  ARROW_ENUM,
  COMPOUND_ARROWS,
} from './tables.mjs';
import { gradientStops } from './parse.mjs';
import { EMPTY_END_TEXTS } from './sheet.mjs';
import type { StateWriter } from './sheet.mjs';
import type { StyleEngine } from '../style.mjs';
import { txnPre, txnPost } from './engine-txn.mjs';
import { bypassPatchAt } from './engine-bypass.mjs';

/** Write `node.fillColor` (the B1 background-opacity fold). */
export function writeNodeFillColor(
  engine: StyleEngine,
  slot: number,
  computed: Computed,
): void {
  engine.store.setColor(
    COL.NODE_FILL_COLOR,
    slot,
    ...foldRgba(computed.fillColor, computed.backgroundOpacity),
  );
}

/** Write `node.borderColor` (the B1 border-opacity fold). */
export function writeNodeBorderColor(
  engine: StyleEngine,
  slot: number,
  computed: Computed,
): void {
  engine.store.setColor(
    COL.NODE_BORDER_COLOR,
    slot,
    ...foldRgba(computed.borderColor, computed.borderOpacity),
  );
}

/** Write `node.opacity` — under compounds the store folds the
 * ancestor product itself (round 14.4), so one call is complete. */
export function writeNodeOpacity(
  engine: StyleEngine,
  slot: number,
  computed: Computed,
): void {
  engine.store.setScalar(COL.NODE_OPACITY, slot, computed.opacity);
}

/** Write the `node.overlay` layer record (the A2 opacity fold). */
export function writeNodeOverlay(
  engine: StyleEngine,
  slot: number,
  computed: Computed,
): void {
  engine.store.setNodeLayer(
    COL.NODE_OVERLAY,
    slot,
    foldLayerRgba(computed.overlayColor, computed.overlayOpacity),
    computed.overlayPadding,
    computed.overlayShape,
    computed.overlayRadius,
  );
}

/** Write the `node.underlay` layer record (the A2 opacity fold). */
export function writeNodeUnderlay(
  engine: StyleEngine,
  slot: number,
  computed: Computed,
): void {
  engine.store.setNodeLayer(
    COL.NODE_UNDERLAY,
    slot,
    foldLayerRgba(computed.underlayColor, computed.underlayOpacity),
    computed.underlayPadding,
    computed.underlayShape,
    computed.underlayRadius,
  );
}

/** Write `edge.lineColor` (the B1 line-opacity fold). */
export function writeEdgeLineColor(
  engine: StyleEngine,
  slot: number,
  computed: Computed,
): void {
  engine.store.setColor(
    COL.EDGE_LINE_COLOR,
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
export function edgeArrowRgba(
  engine: StyleEngine,
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
export function writeEdgeSourceArrowColor(
  engine: StyleEngine,
  slot: number,
  computed: Computed,
): void {
  engine.store.setColor(
    COL.EDGE_SOURCE_ARROW,
    slot,
    ...edgeArrowRgba(
      engine,
      computed,
      computed.sourceArrowShape,
      computed.sourceArrowColor,
    ),
  );
}

/** Write `edge.targetArrow` (see the source twin). */
export function writeEdgeTargetArrowColor(
  engine: StyleEngine,
  slot: number,
  computed: Computed,
): void {
  engine.store.setColor(
    COL.EDGE_TARGET_ARROW,
    slot,
    ...edgeArrowRgba(
      engine,
      computed,
      computed.targetArrowShape,
      computed.targetArrowColor,
    ),
  );
}

/** Write `edge.midSourceArrow` — `setMidArrow` maintains the live
 * mid-arrow count, so one call is complete. */
export function writeEdgeMidSourceArrowColor(
  engine: StyleEngine,
  slot: number,
  computed: Computed,
): void {
  engine.store.setMidArrow(
    COL.EDGE_MID_SOURCE_ARROW,
    slot,
    ...edgeArrowRgba(
      engine,
      computed,
      computed.midSourceArrowShape,
      computed.midSourceArrowColor,
    ),
    COL.EDGE_MID_TARGET_ARROW,
  );
}

/** Write `edge.midTargetArrow` (see the source twin). */
export function writeEdgeMidTargetArrowColor(
  engine: StyleEngine,
  slot: number,
  computed: Computed,
): void {
  engine.store.setMidArrow(
    COL.EDGE_MID_TARGET_ARROW,
    slot,
    ...edgeArrowRgba(
      engine,
      computed,
      computed.midTargetArrowShape,
      computed.midTargetArrowColor,
    ),
    COL.EDGE_MID_SOURCE_ARROW,
  );
}

/** Write the `edge.overlay` stroke record (A2: stroke = width +
 * 2·padding, derived here so the layer shaders need no width
 * binding). */
export function writeEdgeOverlay(
  engine: StyleEngine,
  slot: number,
  computed: Computed,
): void {
  engine.store.setEdgeLayer(
    COL.EDGE_OVERLAY,
    slot,
    foldLayerRgba(computed.overlayColor, computed.overlayOpacity),
    computed.width + 2 * computed.overlayPadding,
  );
}

/** Write the `edge.underlay` stroke record (see the overlay twin). */
export function writeEdgeUnderlay(
  engine: StyleEngine,
  slot: number,
  computed: Computed,
): void {
  engine.store.setEdgeLayer(
    COL.EDGE_UNDERLAY,
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
export function fastStateWriter(
  engine: StyleEngine,
  group: GroupName,
  prop: string,
): StateWriter | null {
  if (group === GROUP_NODES) {
    switch (prop) {
      case PROP.BACKGROUND_COLOR:
        return (slot, c) => writeNodeFillColor(engine, slot, c);
      case PROP.BORDER_COLOR:
        return (slot, c) => writeNodeBorderColor(engine, slot, c);
      case PROP.OPACITY:
        return (slot, c) => writeNodeOpacity(engine, slot, c);
      case PROP.OVERLAY_COLOR:
      case PROP.OVERLAY_OPACITY:
      case PROP.OVERLAY_PADDING:
        return (slot, c) => writeNodeOverlay(engine, slot, c);
      case PROP.UNDERLAY_COLOR:
      case PROP.UNDERLAY_OPACITY:
      case PROP.UNDERLAY_PADDING:
        return (slot, c) => writeNodeUnderlay(engine, slot, c);
      default:
        return null;
    }
  }

  switch (prop) {
    case PROP.LINE_COLOR:
      return (slot, c) => writeEdgeLineColor(engine, slot, c);
    case PROP.SOURCE_ARROW_COLOR:
      return (slot, c) => writeEdgeSourceArrowColor(engine, slot, c);
    case PROP.TARGET_ARROW_COLOR:
      return (slot, c) => writeEdgeTargetArrowColor(engine, slot, c);
    case PROP.MID_SOURCE_ARROW_COLOR:
      return (slot, c) => writeEdgeMidSourceArrowColor(engine, slot, c);
    case PROP.MID_TARGET_ARROW_COLOR:
      return (slot, c) => writeEdgeMidTargetArrowColor(engine, slot, c);
    case PROP.OVERLAY_COLOR:
    case PROP.OVERLAY_OPACITY:
    case PROP.OVERLAY_PADDING:
      return (slot, c) => writeEdgeOverlay(engine, slot, c);
    case PROP.UNDERLAY_COLOR:
    case PROP.UNDERLAY_OPACITY:
    case PROP.UNDERLAY_PADDING:
      return (slot, c) => writeEdgeUnderlay(engine, slot, c);
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
export function write(
  engine: StyleEngine,
  group: GroupName,
  slot: number,
  computed: Computed,
): void {
  // round 63.3: a bypassed slot writes the merged record — one gate
  // load for bypass-free instances (the performance contract), and
  // because every restyle path except refreshStateDef's narrow
  // writers funnels through here, correctness is by construction
  if (engine.bypassRaw.size > 0) {
    const patch = bypassPatchAt(engine, group, slot);

    if (patch != null) {
      computed = engine.mergeBypass(computed, patch);
    }
  }

  const txn = engine.txn;
  const pre =
    txn != null && engine.wasStyled(group, slot)
      ? txnPre(engine, txn, slot)
      : null;

  writeChannels(engine, group, slot, computed);

  if (txn != null && pre != null) {
    txnPost(engine, txn, group, slot, pre);
  }

  engine.markStyled(group, slot);
}

/** Write one computed record onto a node slot, channel by channel — the node half of `write`. */
export function writeChannels(
  engine: StyleEngine,
  group: GroupName,
  slot: number,
  computed: Computed,
): void {
  const store = engine.store;

  if (group === GROUP_NODES) {
    // equal-radii ellipses render via the cheaper exact circle SDF
    const shape =
      computed.shape === SHAPE_ELLIPSE && computed.width === computed.height
        ? SHAPE_CIRCLE
        : computed.shape;

    store.setPair(COL.NODE_SIZE, slot, computed.width, computed.height);
    store.setFlag(GROUP_NODES, slot, FLAG_NO_EVENTS, !computed.eventsEnabled); // 20.2
    store.setFlag(GROUP_NODES, slot, FLAG_TEXT_EVENTS, computed.textEvents); // 20.3
    store.setInvisibility(GROUP_NODES, slot, computed.invisible); // 22
    writeNodeFillColor(engine, slot, computed);
    writeNodeBorderColor(engine, slot, computed);
    store.setScalar(COL.NODE_BORDER_WIDTH, slot, computed.borderWidth);
    writeNodeOpacity(engine, slot, computed);
    store.setScalar(COL.NODE_SHAPE, slot, shape);
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

    store.setVec4(COL.NODE_BORDER_DASH, slot, bdp[0], bdp[1], bdp[2], bdp[3]);
    store.setPair(
      COL.NODE_BORDER_DASH_META,
      slot,
      computed.borderDashOffset,
      0,
    );

    // background gradient (C2): stops fold the background-opacity like
    // the flat fill; unset positions spread evenly (v3/canvas rule)
    store.setGradient(
      COL.NODE_GRADIENT,
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

    writeNodeOverlay(engine, slot, computed);
    writeNodeUnderlay(engine, slot, computed);

    writeImages(engine, slot, computed);
    writeChart(engine, slot, computed);
    writeLabel(engine, slot, computed);
  } else {
    writeEdgeColumns(engine, slot, computed);
    writeEdgePerSlot(engine, slot, computed);
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
export function writeEdgeColumns(
  engine: StyleEngine,
  slot: number,
  computed: Computed,
): void {
  const store = engine.store;

  writeEdgeLineColor(engine, slot, computed);
  // line-fill gradient (C2), stops folded by line-opacity
  store.setGradient(
    COL.EDGE_GRADIENT,
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

  store.setVec4(COL.EDGE_DASH_PATTERN, slot, dp[0], dp[1], dp[2], dp[3]);
  store.setPair(
    COL.EDGE_DASH_META,
    slot,
    computed.lineDashOffset,
    computed.lineCap,
  );
  store.setScalar(COL.EDGE_WIDTH, slot, computed.width);
  store.setScalar(COL.EDGE_OPACITY, slot, computed.opacity);
  store.setScalar(COL.EDGE_LINE_STYLE, slot, computed.lineStyle);
  writeEdgeSourceArrowColor(engine, slot, computed);
  writeEdgeTargetArrowColor(engine, slot, computed);
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
  writeEdgeMidSourceArrowColor(engine, slot, computed);
  writeEdgeMidTargetArrowColor(engine, slot, computed);

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

  store.setPair(COL.EDGE_ARROW_WIDTHS, slot, srcAw, tgtAw);
  // 56: a hollow head's stroke straddles its outline, so the ink
  // reaches half a stroke width outside the polygon.  The arrow
  // vertex stage cannot bind engine column, so the quad grows by a
  // frame-level maximum instead — reported here, resolved.
  store.noteArrowWidth(Math.max(srcAw, tgtAw));
  // line-outline casing (B4): stroke = width + outline width (v3's
  // lineWidth), alpha folded by v3's effectiveLineOpacity
  store.setEdgeLayer(
    COL.EDGE_CASING,
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
  writeEdgeOverlay(engine, slot, computed);
  writeEdgeUnderlay(engine, slot, computed);
}

/**
 * The edge work a column copy cannot carry: the two flag bits (the
 * flags word holds per-element bits too), the invisibility cascade,
 * the curve index's own per-slot record, and the label sidecar.  Runs
 * for every slot on both paths.
 */
export function writeEdgePerSlot(
  engine: StyleEngine,
  slot: number,
  computed: Computed,
): void {
  const store = engine.store;

  store.setFlag(GROUP_EDGES, slot, FLAG_NO_EVENTS, !computed.eventsEnabled); // 20.2
  store.setInvisibility(GROUP_EDGES, slot, computed.invisible); // 22

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
        taxiTurnAuto: computed.taxiTurnAuto,
        taxiTurnMinDist: computed.taxiTurnMinDistance,
        taxiRadius: computed.taxiRadius,
        taxiTrack: computed.taxiTrack,
        taxiTrackSpacing: computed.taxiTrackSpacing,
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

  writeLabel(engine, slot, computed, GROUP_EDGES);
}

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
export function writeChart(
  engine: StyleEngine,
  slot: number,
  computed: Computed,
): void {
  const store = engine.store;

  if (computed.chartKind === CHART_NONE) {
    store.setChart(slot, null);

    return;
  }

  let raw: readonly unknown[] | null = computed.chartValues;

  if (computed.chartValuesKey != null) {
    const dataValue = store.data.get(
      GROUP_NODES,
      slot,
      computed.chartValuesKey,
    );

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
export function writeImages(
  engine: StyleEngine,
  slot: number,
  computed: NodeComputed,
): void {
  let urls = computed.backgroundImage;

  if (urls.length === 0) {
    engine.store.setNodeImages(slot, null);

    return;
  }

  if (urls.length > IMAGE_CAP) {
    if (!engine.warnedImageCap) {
      engine.warnedImageCap = true;
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

  engine.store.setNodeImages(slot, specs);
}

/** Resolve an element's label text from its computed channels and store it. */
export function writeLabel(
  engine: StyleEngine,
  slot: number,
  computed: NodeComputed | Computed,
  group: GroupName = GROUP_NODES,
): void {
  const store = engine.store;
  const key = computed.labelKey;
  let text =
    key == null
      ? computed.label
      : key === DATA_ID
        ? (store.idAt(group, slot) ?? '')
        : stringify(store.data.get(group, slot, key));

  // text-transform (B6) applies at glyph-run build, as v3 transforms
  // before measuring
  if (computed.textTransform === 1) {
    text = text.toUpperCase();
  } else if (computed.textTransform === 2) {
    text = text.toLowerCase();
  }

  // the two end-label streams (D4), resolved here rather than at their
  // own loop below so that an element with *no* text at all can leave
  // before the shared record is built
  const endTexts =
    group === GROUP_EDGES
      ? ([DATA_SOURCE, DATA_TARGET] as const).map((end) => {
          const ec = computed as Computed;
          const key2 =
            end === DATA_SOURCE ? ec.sourceLabelKey : ec.targetLabelKey;
          const raw =
            key2 == null
              ? end === DATA_SOURCE
                ? ec.sourceLabel
                : ec.targetLabel
              : key2 === DATA_ID
                ? (store.idAt(group, slot) ?? '')
                : stringify(store.data.get(group, slot, key2));

          return computed.textTransform === 1
            ? raw.toUpperCase()
            : computed.textTransform === 2
              ? raw.toLowerCase()
              : raw;
        })
      : EMPTY_END_TEXTS;

  // Round 67.2c: an unlabelled element used to pay for the whole
  // record — ~15 colour folds, an anchor solve and a closure per call
  // — to hand `setLabel` a null it discards.  On the harness's
  // 464,657-edge fixture, whose edges carry no label of any kind, that
  // measured **75 ms per load**.  Clearing is still correct for a slot
  // that *had* a label: `setLabel( null )` is what does it, and it is
  // the cheap half.
  if (text === '' && endTexts[0] === '' && endTexts[1] === '') {
    store.setLabel(slot, null, group);

    if (group === GROUP_EDGES) {
      store.setLabel(slot, null, 'edgeSource');
      store.setLabel(slot, null, 'edgeTarget');
    }

    return;
  }

  // text-opacity (B1) is v3's parentOpacity for the whole label block:
  // it folds into the text fill, outline and background alphas alike.
  // Element opacity joins the fold for edge labels (115.6: v3's
  // effective alpha is opacity x text-opacity; the edge label pipeline
  // is at its storage-buffer budget, so it cannot read the column the
  // way node labels do since 115.6, and folds like edge lines do)
  const textOp =
    computed.textOpacity * (group === GROUP_EDGES ? computed.opacity : 1);
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

  if (group === GROUP_NODES) {
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
      : group === GROUP_NODES
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
    outlineColor: fold(computed.textOutlineColor, computed.textOutlineOpacity),
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
            group === GROUP_EDGES &&
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
  if (group === GROUP_EDGES) {
    const ec = computed as Computed;

    for (const end of [DATA_SOURCE, DATA_TARGET] as const) {
      const src = end === DATA_SOURCE;
      const endText = endTexts[src ? 0 : 1];
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
