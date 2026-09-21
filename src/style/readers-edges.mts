import {
  GROUP_NODES,
  COL,
  ARROW_SHIFT_HOLLOW_SOURCE,
  ARROW_SHIFT_HOLLOW_TARGET,
  ARROW_SHIFT_MID_SOURCE,
  ARROW_SHIFT_MID_TARGET,
  ARROW_SHIFT_SCALE,
  ARROW_SHIFT_SOURCE,
  ARROW_SHIFT_TARGET,
  unpackArrowShape,
} from '../contract.mjs';
import { PROP } from '../style-props.mjs';
import { curveExtrasFor, formatRgba, ARROW_NAMES } from './tables.mjs';
import { ARROW_FILL_NAMES, LINE_CAP_NAMES } from './parse.mjs';
import {
  LINE_STYLE_NAMES,
  CURVE_STYLE_NAMES,
  RADIUS_TYPE_NAMES,
  EDGE_DISTANCE_NAMES,
  endpointString,
  TAXI_DIRECTION_NAMES,
  TAXI_TRACK_NAMES,
} from './parse-edge.mjs';
import {
  readScalar,
  readPair,
  readColor,
  readAlpha,
  defineReader,
} from './readers.mjs';

// shared names, resolved per group
defineReader([PROP.WIDTH], (store, slot, ref) =>
  ref.group === GROUP_NODES
    ? readPair(store, slot, COL.NODE_SIZE, 0)
    : readScalar(store, slot, COL.EDGE_WIDTH),
);

defineReader([PROP.OPACITY], (store, slot, ref, engine) => {
  // under compounds the node column stores the ancestor-folded
  // value; the declared style reads the base (round 14.4)
  if (ref.group === GROUP_NODES && engine.store.hasCompounds()) {
    return engine.store.baseOpacityOf(ref.slot);
  }

  return readScalar(
    store,
    slot,
    ref.group === GROUP_NODES ? COL.NODE_OPACITY : COL.EDGE_OPACITY,
  );
});

// compound props (round 14.6): stored truth is the per-parent
// record; leaves read the zero defaults (v3 leaves' padding is 0)
defineReader([PROP.PADDING], (store, slot, ref, engine) => {
  const cs = engine.store.compoundStyleOf(ref.slot);

  return cs.paddingUnit === '%' ? `${cs.padding * 100}%` : cs.padding;
});

// per-side padding (85.4): a set side reads back its own spelling;
// unset reads back the uniform padding's, which is what applies
for (const [prop, field] of [
  [PROP.PADDING_LEFT, 'paddingLeft'],
  [PROP.PADDING_RIGHT, 'paddingRight'],
  [PROP.PADDING_TOP, 'paddingTop'],
  [PROP.PADDING_BOTTOM, 'paddingBottom'],
]) {
  defineReader([prop], (store, slot, ref, engine) => {
    const cs = engine.store.compoundStyleOf(ref.slot);
    const side = cs[field as 'paddingLeft'];

    if (side == null) {
      return cs.paddingUnit === '%' ? `${cs.padding * 100}%` : cs.padding;
    }

    return side.unit === '%' ? `${side.value * 100}%` : side.value;
  });
}

defineReader(
  [PROP.PADDING_RELATIVE_TO],
  (store, slot, ref, engine) =>
    engine.store.compoundStyleOf(ref.slot).relativeTo,
);

defineReader(
  [PROP.MIN_WIDTH],
  (store, slot, ref, engine) => engine.store.compoundStyleOf(ref.slot).minWidth,
);

defineReader(
  [PROP.MIN_HEIGHT],
  (store, slot, ref, engine) =>
    engine.store.compoundStyleOf(ref.slot).minHeight,
);

defineReader([PROP.COMPOUND_SIZING_WRT_LABELS], () => 'exclude');

// edge channels
defineReader([PROP.LINE_COLOR], (store, slot) =>
  readColor(store, slot, COL.EDGE_LINE_COLOR),
);

defineReader(
  [PROP.LINE_STYLE],
  (store, slot) =>
    LINE_STYLE_NAMES[readScalar(store, slot, COL.EDGE_LINE_STYLE)],
);

defineReader([PROP.SOURCE_ARROW_SHAPE], (store, slot) => {
  return readAlpha(store, slot, COL.EDGE_SOURCE_ARROW) > 0
    ? ARROW_NAMES[
        unpackArrowShape(
          readScalar(store, slot, COL.EDGE_ARROW_SHAPES),
          ARROW_SHIFT_SOURCE,
        )
      ]
    : 'none';
});

defineReader([PROP.TARGET_ARROW_SHAPE], (store, slot) => {
  return readAlpha(store, slot, COL.EDGE_TARGET_ARROW) > 0
    ? ARROW_NAMES[
        unpackArrowShape(
          readScalar(store, slot, COL.EDGE_ARROW_SHAPES),
          ARROW_SHIFT_TARGET,
        )
      ]
    : 'none';
});

defineReader(
  [PROP.LINE_OPACITY],
  (store, slot) =>
    Math.round(
      ((store.column(COL.EDGE_LINE_COLOR) as Uint8Array)[slot * 4 + 3] / 255) *
        1000,
    ) / 1000,
);

defineReader(
  [PROP.LINE_CAP],
  (store, slot) =>
    LINE_CAP_NAMES[
      (store.column(COL.EDGE_DASH_META) as Float32Array)[slot * 2 + 1]
    ] ?? 'butt',
);

defineReader([PROP.LINE_OUTLINE_WIDTH], (store, slot) => {
  // stored stroke = width + outline width (B4)
  const rec = (store.column(COL.EDGE_CASING) as Uint32Array)[slot * 2 + 1];
  const width = (store.column(COL.EDGE_WIDTH) as Float32Array)[slot * 2];

  return rec === 0 ? 0 : Math.max(0, rec / 256 - width);
});

defineReader([PROP.LINE_OUTLINE_COLOR], (store, slot) => {
  const rgba = (store.column(COL.EDGE_CASING) as Uint32Array)[slot * 2];

  return formatRgba(
    rgba & 0xff,
    (rgba >>> 8) & 0xff,
    (rgba >>> 16) & 0xff,
    (rgba >>> 24) & 0xff,
  );
});

defineReader(
  [PROP.LINE_DASH_OFFSET],
  (store, slot) => (store.column(COL.EDGE_DASH_META) as Float32Array)[slot * 2],
);

defineReader([PROP.LINE_DASH_PATTERN], (store, slot) => {
  const arr = (store.column(COL.EDGE_DASH_PATTERN) as Float32Array).subarray(
    slot * 4,
    slot * 4 + 4,
  );

  // collapse the normalized two-pair form back to one pair when repeated
  return arr[0] === arr[2] && arr[1] === arr[3]
    ? `${arr[0]} ${arr[1]}`
    : `${arr[0]} ${arr[1]} ${arr[2]} ${arr[3]}`;
});

defineReader([PROP.ARROW_SCALE], (store, slot) => {
  const q =
    (store.column(COL.EDGE_ARROW_SHAPES) as Uint32Array)[slot] >>>
    ARROW_SHIFT_SCALE;

  return q === 0 ? 1 : q / 16; // quantized ×16 (recorded)
});

defineReader(
  [PROP.SOURCE_ARROW_FILL, PROP.TARGET_ARROW_FILL],
  (store, slot, ref, engine, prop) => {
    const bit = prop.startsWith('source')
      ? ARROW_SHIFT_HOLLOW_SOURCE
      : ARROW_SHIFT_HOLLOW_TARGET;

    return ARROW_FILL_NAMES[
      ((store.column(COL.EDGE_ARROW_SHAPES) as Uint32Array)[slot] >>> bit) & 1
    ];
  },
);

defineReader(
  [PROP.SOURCE_ARROW_WIDTH],
  (store, slot) =>
    (store.column(COL.EDGE_ARROW_WIDTHS) as Float32Array)[slot * 2],
);

defineReader(
  [PROP.TARGET_ARROW_WIDTH],
  (store, slot) =>
    (store.column(COL.EDGE_ARROW_WIDTHS) as Float32Array)[slot * 2 + 1],
);

defineReader(
  [PROP.MID_SOURCE_ARROW_SHAPE, PROP.MID_TARGET_ARROW_SHAPE],
  (store, slot, ref, engine, prop) => {
    const shift = prop.startsWith('mid-source')
      ? ARROW_SHIFT_MID_SOURCE
      : ARROW_SHIFT_MID_TARGET;
    const colId = prop.startsWith('mid-source')
      ? COL.EDGE_MID_SOURCE_ARROW
      : COL.EDGE_MID_TARGET_ARROW;
    const a = (store.column(colId) as Uint8Array)[slot * 4 + 3];

    // stored truth: a transparent mid arrow reads 'none' (the
    // end-arrow precedent)
    return a === 0
      ? 'none'
      : ARROW_NAMES[
          unpackArrowShape(
            (store.column(COL.EDGE_ARROW_SHAPES) as Uint32Array)[slot],
            shift,
          )
        ];
  },
);

defineReader([PROP.MID_SOURCE_ARROW_COLOR], (store, slot) =>
  readColor(store, slot, COL.EDGE_MID_SOURCE_ARROW),
);

defineReader([PROP.MID_TARGET_ARROW_COLOR], (store, slot) =>
  readColor(store, slot, COL.EDGE_MID_TARGET_ARROW),
);

defineReader([PROP.SOURCE_ARROW_COLOR], (store, slot) =>
  readColor(store, slot, COL.EDGE_SOURCE_ARROW),
);

defineReader([PROP.TARGET_ARROW_COLOR], (store, slot) =>
  readColor(store, slot, COL.EDGE_TARGET_ARROW),
);

// curve props read the styled record (stored truth: a lone
// 'bezier' edge reads back 'bezier' even though it renders
// straight — v3 semantics); angles read back in radians.  Lists
// read back as space-separated strings (v3's strValue form);
// percent taxi turns read back as the percent string.
defineReader(
  [PROP.CURVE_STYLE],
  (store, slot) => CURVE_STYLE_NAMES[store.curveStyleAt(slot).style],
);

defineReader(
  [PROP.CONTROL_POINT_STEP_SIZE],
  (store, slot) => store.curveStyleAt(slot).stepSize,
);

defineReader(
  [PROP.CONTROL_POINT_WEIGHT],
  (store, slot) => store.curveStyleAt(slot).weight,
);

defineReader(
  [PROP.LOOP_DIRECTION],
  (store, slot) => store.curveStyleAt(slot).loopDirection,
);

defineReader(
  [PROP.LOOP_SWEEP],
  (store, slot) => store.curveStyleAt(slot).loopSweep,
);

defineReader([PROP.CONTROL_POINT_DISTANCES], (store, slot) => {
  const dists = curveExtrasFor(store, slot).ctrlDists;

  return dists == null ? undefined : dists.join(' ');
});

defineReader([PROP.CONTROL_POINT_WEIGHTS], (store, slot) =>
  curveExtrasFor(store, slot).ctrlWeights.join(' '),
);

defineReader([PROP.SEGMENT_DISTANCES], (store, slot) =>
  curveExtrasFor(store, slot).segDists.join(' '),
);

defineReader([PROP.SEGMENT_WEIGHTS], (store, slot) =>
  curveExtrasFor(store, slot).segWeights.join(' '),
);

defineReader([PROP.SEGMENT_RADII], (store, slot) =>
  curveExtrasFor(store, slot).segRadii.join(' '),
);

defineReader([PROP.RADIUS_TYPE], (store, slot) => {
  return curveExtrasFor(store, slot)
    .radiusTypes.map((id) => RADIUS_TYPE_NAMES[id])
    .join(' ');
});

defineReader(
  [PROP.EDGE_DISTANCES],
  (store, slot) =>
    EDGE_DISTANCE_NAMES[curveExtrasFor(store, slot).edgeDistances],
);

defineReader(
  [PROP.TAXI_DIRECTION],
  (store, slot) => TAXI_DIRECTION_NAMES[curveExtrasFor(store, slot).taxiDir],
);

defineReader([PROP.TAXI_TURN], (store, slot) => {
  const ex = curveExtrasFor(store, slot);

  if (ex.taxiTurnAuto) {
    return 'auto';
  }

  return ex.taxiTurnPercent ? `${ex.taxiTurn * 100}%` : ex.taxiTurn;
});

defineReader(
  [PROP.TAXI_TRACK],
  (store, slot) => TAXI_TRACK_NAMES[curveExtrasFor(store, slot).taxiTrack],
);

defineReader(
  [PROP.TAXI_TRACK_SPACING],
  (store, slot) => curveExtrasFor(store, slot).taxiTrackSpacing,
);

defineReader(
  [PROP.TAXI_TURN_MIN_DISTANCE],
  (store, slot) => curveExtrasFor(store, slot).taxiTurnMinDist,
);

defineReader(
  [PROP.TAXI_RADIUS],
  (store, slot) => curveExtrasFor(store, slot).taxiRadius,
);

defineReader(
  [PROP.HAYSTACK_RADIUS],
  (store, slot) => store.curveStyleAt(slot).haystackRadius,
);

defineReader(
  [PROP.SOURCE_ENDPOINT, PROP.TARGET_ENDPOINT],
  (store, slot, ref, engine, prop) => {
    const e = store.curveStyleAt(slot).endpoints;
    const src = prop === PROP.SOURCE_ENDPOINT;

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
  [PROP.SOURCE_DISTANCE_FROM_NODE],
  (store, slot) => store.curveStyleAt(slot).endpoints?.srcDist ?? 0,
);

defineReader(
  [PROP.TARGET_DISTANCE_FROM_NODE],
  (store, slot) => store.curveStyleAt(slot).endpoints?.tgtDist ?? 0,
);
