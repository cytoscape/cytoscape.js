import {
  GROUP_EDGES,
  GROUP_NODES,
  COL,
  CHART_PIE,
  CHART_STRIPES,
  CHART_HEAT_STRIP,
  CHART_RADIAL_HEAT,
  CHART_BAR,
  FLAG_NO_EVENTS,
  FLAG_SELF_INVISIBLE,
  FLAG_TEXT_EVENTS,
  BORDER_STYLE_SHIFT,
  OUTLINE_STYLE_SHIFT,
  STROKE_STYLE_MASK,
  SHAPE_POLYGON_CUSTOM,
} from '../contract.mjs';
import { PROP } from '../style-props.mjs';
import { formatRgba, SHAPE_NAMES } from './tables.mjs';
import {
  FILL_KIND_NAMES,
  GRADIENT_DIRECTION_NAMES,
  BORDER_POSITION_NAMES,
  STROKE_STYLE_NAMES,
} from './parse.mjs';
import { readScalar, readColor, defineReader } from './readers.mjs';

defineReader([PROP.BACKGROUND_COLOR], (store, slot) =>
  readColor(store, slot, COL.NODE_FILL_COLOR),
);

defineReader([PROP.BORDER_COLOR], (store, slot) =>
  readColor(store, slot, COL.NODE_BORDER_COLOR),
);

defineReader([PROP.BORDER_WIDTH], (store, slot) =>
  store.baseBorderWidthOf(slot),
);

defineReader([PROP.CORNER_RADIUS], (store, slot, ref, engine) => {
  // a custom polygon keeps its point-record ref in the radius word (C3:
  // the radius means nothing for one), so the word is not a radius:
  // answer the sheet's.  Before round 143 this read the ref as a radius
  // — `196608.0234375` — which the golden degrade control found as a
  // property no reset could move (the `shape-polygon` golden "set" it)
  if (readScalar(store, slot, COL.NODE_SHAPE) === SHAPE_POLYGON_CUSTOM) {
    const c = engine.defFor(ref).computed.cornerRadius;

    return c < 0 ? 'auto' : c;
  }

  const r = (store.column(COL.NODE_BORDER_GEOM) as Uint32Array)[slot * 4];

  return r === 0xffffffff ? 'auto' : r / 256 / store.sizeFactorOf(slot);
});

defineReader([PROP.BORDER_POSITION], (store, slot) => {
  return (
    BORDER_POSITION_NAMES[
      (store.column(COL.NODE_BORDER_GEOM) as Uint32Array)[slot * 4 + 1] & 0xff
    ] ?? 'center'
  );
});

defineReader(
  [PROP.BORDER_STYLE],
  (store, slot) =>
    STROKE_STYLE_NAMES[
      ((store.column(COL.NODE_BORDER_GEOM) as Uint32Array)[slot * 4 + 1] >>>
        BORDER_STYLE_SHIFT) &
        STROKE_STYLE_MASK
    ] ?? 'solid',
);

defineReader(
  [PROP.OUTLINE_STYLE],
  (store, slot) =>
    STROKE_STYLE_NAMES[
      ((store.column(COL.NODE_BORDER_GEOM) as Uint32Array)[slot * 4 + 1] >>>
        OUTLINE_STYLE_SHIFT) &
        STROKE_STYLE_MASK
    ] ?? 'solid',
);

defineReader([PROP.BORDER_DASH_PATTERN], (store, slot) => {
  const arr = (store.column(COL.NODE_BORDER_DASH) as Float32Array).subarray(
    slot * 4,
    slot * 4 + 4,
  );

  // collapse the normalized two-pair form back to one pair when repeated
  const factor = store.sizeFactorOf(slot);
  const a = arr[0] / factor;
  const b = arr[1] / factor;
  const c = arr[2] / factor;
  const d = arr[3] / factor;

  return a === c && b === d ? `${a} ${b}` : `${a} ${b} ${c} ${d}`;
});

defineReader(
  [PROP.BORDER_DASH_OFFSET],
  (store, slot) =>
    (store.column(COL.NODE_BORDER_DASH_META) as Float32Array)[slot * 2] /
    store.sizeFactorOf(slot),
);

defineReader(
  [PROP.BACKGROUND_FILL, PROP.LINE_FILL],
  (store, slot, ref, engine, prop) => {
    const gid =
      prop === PROP.BACKGROUND_FILL ? COL.NODE_GRADIENT : COL.EDGE_GRADIENT;
    const meta = (store.column(gid) as Uint32Array)[slot * 8];

    return FILL_KIND_NAMES[meta & 3] ?? 'solid';
  },
);

defineReader([PROP.BACKGROUND_GRADIENT_DIRECTION], (store, slot) => {
  const meta = (store.column(COL.NODE_GRADIENT) as Uint32Array)[slot * 8];

  return GRADIENT_DIRECTION_NAMES[(meta >>> 2) & 7] ?? 'to-bottom';
});

defineReader(
  [PROP.BACKGROUND_GRADIENT_STOP_COLORS, PROP.LINE_GRADIENT_STOP_COLORS],
  (store, slot, ref, engine, prop) => {
    const gid = prop.startsWith('background')
      ? COL.NODE_GRADIENT
      : COL.EDGE_GRADIENT;
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
  [PROP.BACKGROUND_GRADIENT_STOP_POSITIONS, PROP.LINE_GRADIENT_STOP_POSITIONS],
  (store, slot, ref, engine, prop) => {
    const gid = prop.startsWith('background')
      ? COL.NODE_GRADIENT
      : COL.EDGE_GRADIENT;
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

defineReader([PROP.OUTLINE_COLOR], (store, slot) => {
  const rgba = (store.column(COL.NODE_BORDER_GEOM) as Uint32Array)[
    slot * 4 + 2
  ];

  return formatRgba(
    rgba & 0xff,
    (rgba >>> 8) & 0xff,
    (rgba >>> 16) & 0xff,
    (rgba >>> 24) & 0xff,
  );
});

defineReader([PROP.OUTLINE_OPACITY], (store, slot) => {
  return (
    Math.round(
      (((store.column(COL.NODE_BORDER_GEOM) as Uint32Array)[slot * 4 + 2] >>>
        24) /
        255) *
        1000,
    ) / 1000
  );
});

defineReader(
  [PROP.OUTLINE_WIDTH],
  (store, slot) =>
    ((store.column(COL.NODE_BORDER_GEOM) as Uint32Array)[slot * 4 + 3] &
      0xffff) /
    256 /
    store.sizeFactorOf(slot),
);

defineReader(
  [PROP.OUTLINE_OFFSET],
  (store, slot) =>
    ((store.column(COL.NODE_BORDER_GEOM) as Uint32Array)[slot * 4 + 3] >>> 16) /
    256 /
    store.sizeFactorOf(slot),
);

// the B1 channel opacities read back *folded* (stored alpha /
// 255 — the declared color alpha times the opacity; the
// outline/arrow precedent)
defineReader(
  [PROP.BACKGROUND_OPACITY],
  (store, slot) =>
    Math.round(
      ((store.column(COL.NODE_FILL_COLOR) as Uint8Array)[slot * 4 + 3] / 255) *
        1000,
    ) / 1000,
);

defineReader(
  [PROP.BORDER_OPACITY],
  (store, slot) =>
    Math.round(
      ((store.column(COL.NODE_BORDER_COLOR) as Uint8Array)[slot * 4 + 3] /
        255) *
        1000,
    ) / 1000,
);

// background images (15.2): stored-truth readback off the blob
// records; per-image lists read back space-joined (the 12b list
// convention), single images as scalars
defineReader(
  [
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
  ],
  (store, slot, ref, engine, prop) => engine.readImageProp(slot, prop),
);

defineReader([PROP.EVENTS], (store, slot, ref) => {
  // 20.2: stored truth is the flag bit
  return store.hasFlag(ref.group, slot, FLAG_NO_EVENTS) ? 'no' : 'yes';
});

defineReader([PROP.TEXT_EVENTS], (store, slot) => {
  // 20.3
  return store.hasFlag(GROUP_NODES, slot, FLAG_TEXT_EVENTS) ? 'yes' : 'no';
});

defineReader([PROP.VISIBILITY], (store, slot, ref) => {
  // 22: stored truth is the element's own state
  return store.hasFlag(ref.group, slot, FLAG_SELF_INVISIBLE)
    ? 'hidden'
    : 'visible';
});

defineReader([PROP.CHART], (store, slot) => {
  const rec = store.chartAt(slot);
  if (rec == null) return 'none';
  return rec.kind === CHART_PIE
    ? 'pie'
    : rec.kind === CHART_STRIPES
      ? 'stripes'
      : rec.kind === CHART_HEAT_STRIP
        ? 'heat-strip'
        : rec.kind === CHART_RADIAL_HEAT
          ? 'radial-heat'
          : rec.kind === CHART_BAR
            ? 'bar'
            : 'none';
});

defineReader(
  [PROP.CHART_VALUES],
  (store, slot) =>
    store
      .chartAt(slot)
      ?.values.map((v) => (v == null ? '' : String(v)))
      .join(' ') ?? '',
);

defineReader(
  [PROP.CHART_COLORS],
  (store, slot) =>
    store
      .chartAt(slot)
      ?.colors.map((c) => formatRgba(...c))
      .join(' ') ?? '',
);

defineReader(
  [PROP.CHART_SIZE],
  (store, slot) => store.chartAt(slot)?.size ?? 1,
);

defineReader(
  [PROP.CHART_HOLE],
  (store, slot) => store.chartAt(slot)?.hole ?? 0,
);

defineReader(
  [PROP.CHART_START_ANGLE],
  (store, slot) => store.chartAt(slot)?.startAngle ?? 0,
);

defineReader([PROP.CHART_DIRECTION], (store, slot) =>
  (store.chartAt(slot)?.direction ?? 0) === 1 ? 'horizontal' : 'vertical',
);

defineReader(
  [PROP.CHART_OPACITY],
  (store, slot) => store.chartAt(slot)?.opacity ?? 1,
);

defineReader([PROP.CHART_SCALE], (_store, _slot, ref, engine) => {
  const spec = engine.defFor(ref).computed.chartScaleSpec;
  return spec == null ? 'none' : JSON.stringify(spec);
});

defineReader(
  [PROP.CHART_DOMAIN],
  (_store, _slot, ref, engine) =>
    engine.defFor(ref).computed.chartDomain?.join(' ') ?? 'none',
);

defineReader([PROP.CHART_MISSING_COLOR], (_store, _slot, ref, engine) =>
  formatRgba(...engine.defFor(ref).computed.chartMissingColor),
);

defineReader([PROP.GHOST], (store, slot) =>
  (store.column(COL.NODE_GHOST) as Float32Array)[slot * 4 + 3] !== 0
    ? 'yes'
    : 'no',
);

defineReader(
  [PROP.GHOST_OFFSET_X],
  (store, slot) =>
    (store.column(COL.NODE_GHOST) as Float32Array)[slot * 4] /
    store.sizeFactorOf(slot),
);

defineReader(
  [PROP.GHOST_OFFSET_Y],
  (store, slot) =>
    (store.column(COL.NODE_GHOST) as Float32Array)[slot * 4 + 1] /
    store.sizeFactorOf(slot),
);

defineReader(
  [PROP.GHOST_OPACITY],
  (store, slot) => (store.column(COL.NODE_GHOST) as Float32Array)[slot * 4 + 2],
);

defineReader(
  [
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
  ],
  (store, slot, ref, engine, prop) => {
    if (ref.group === GROUP_EDGES) {
      // edge layers: [rgba folded, strokeWidth×256]; padding reads
      // back as (stroke − width) / 2
      const eid = prop.startsWith('overlay')
        ? COL.EDGE_OVERLAY
        : COL.EDGE_UNDERLAY;
      const erec = (store.column(eid) as Uint32Array).subarray(
        slot * 4,
        slot * 4 + 2,
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

      const width = (store.column(COL.EDGE_WIDTH) as Float32Array)[slot * 2];

      // the stroke is stored rounded to 1/256 px, so subtract the width
      // on the same grid: a width off it (a mapped 1.85) otherwise reads
      // back a padding of 10.00039 for a 10 (round 105's golden found it)
      return (
        Math.max(0, erec[1] - Math.round(width * 256)) /
        512 /
        store.edgeSizeFactorOf(slot)
      );
    }

    const id = prop.startsWith('overlay')
      ? COL.NODE_OVERLAY
      : COL.NODE_UNDERLAY;
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
        return rec[1] / 256 / store.sizeFactorOf(slot);
      case 'shape':
        return rec[2] === 1 ? 'ellipse' : 'round-rectangle';
      default:
        return rec[3] === 0xffffffff
          ? 'auto'
          : rec[3] / 256 / store.sizeFactorOf(slot);
    }
  },
);

defineReader([PROP.HEIGHT], (store, slot) => store.baseSizeOf(slot)[1]);

defineReader([PROP.COLLAPSE_SCALE], (store, slot) =>
  store.collapseScaleOf(slot),
);

defineReader(
  [PROP.SHAPE],
  (store, slot) => SHAPE_NAMES[readScalar(store, slot, COL.NODE_SHAPE)],
);

defineReader([PROP.SHAPE_POLYGON_POINTS], (store, slot, ref, engine) => {
  const points = store.polygonPointsAt(slot);

  return points != null
    ? Array.from(points).join(' ')
    : engine.defs.nodes.computed.shapePolygonPoints.join(' ');
});

defineReader(
  [PROP.LABEL],
  (store, slot, ref) => store.labelAt(slot, ref.group)?.text ?? '',
);

defineReader(
  [PROP.FONT_SIZE],
  (store, slot, ref, engine) => engine.labelChannels(ref).fontSize,
);

defineReader([PROP.FONT_FAMILY], (store) => store.labelFont);

defineReader([PROP.FONT_STYLE], (store) => store.labelFontStyle);

defineReader([PROP.FONT_WEIGHT], (store) => store.labelFontWeight);

defineReader(
  [PROP.COLOR],
  (store, slot, ref, engine) => engine.labelChannels(ref).color,
);
