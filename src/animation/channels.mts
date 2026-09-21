// The animation channel tables and the write kit (round 130 split): which
// style props tween, how a channel write is built, and TWEEN_COL.

import { color2tuple } from '../util/colors.mjs';
import { oklabToSrgb, srgbToOklab } from '../style-schemes.mjs';
import { GROUP_EDGES, GROUP_NODES, COL } from '../contract.mjs';
import type { ColumnId, GroupName, Ref } from '../contract.mjs';
import type { GraphStore } from '../store/graph-store.mjs';
import { PROP } from '../style-props.mjs';

/**
 * The tween pseudo-columns (round 127): write targets that are not
 * store columns — compound padding and label font-size, see
 * `TweenColumn` — spelled once, beside `COL` for the real ones.
 */
export const TWEEN_COL = {
  NODE_PADDING: 'node.padding',
  NODE_FONT_SIZE: 'node.fontSize',
  EDGE_FONT_SIZE: 'edge.fontSize',
} as const;

/** `t` clamped to [0, 1]. */
export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

export type RGBA = [number, number, number, number];

export const GROUPS: GroupName[] = [GROUP_NODES, GROUP_EDGES];

/**
 * Where an animatable style prop lands, per group — a shared name like
 * `opacity` resolves to a different column in each.
 *
 * `tier` decides GPU eligibility.  **Paint** channels have no CPU consumer:
 * culling, CPU picking and the columnar scans (`boundingBox`, `refsInBox`)
 * never read them, which is why they were the ones made GPU-evaluable in
 * the mapper split — so a GPU tween can own the column outright while it
 * runs.  **Geometry** channels are read by all three, so they stay
 * CPU-canonical; a GPU-owned size tween reopens the store→style layering
 * seam and belongs with that work, not here.
 */
export interface StyleChannel {
  columns: Partial<Record<GroupName, TweenColumn>>;
  kind: 'scalar' | 'color';
  tier: 'paint' | 'geometry';
  /** round 25: the channel is one lane of a multi-component column
   * (node.size lanes 0/1) — tweened via the `lane` write kind, which
   * routes through the store's cascading lane writer */
  lanes?: Partial<Record<GroupName, number>>;
  /**
   * Valid range for a scalar channel.  A bouncy easing overshoots its
   * endpoints on purpose — fine for position, but an opacity of 1.04 or a
   * negative border width is not a value the renderer should ever see, so
   * scalars clamp (as v3 does, via each property's own min/max).
   */
  min?: number;
  max?: number;
}

export const STYLE_CHANNELS: Record<string, StyleChannel> = {
  [PROP.OPACITY]: {
    columns: { nodes: COL.NODE_OPACITY, edges: COL.EDGE_OPACITY },
    kind: 'scalar',
    tier: 'paint',
    min: 0,
    max: 1,
  },
  [PROP.BACKGROUND_COLOR]: {
    columns: { nodes: COL.NODE_FILL_COLOR },
    kind: 'color',
    tier: 'paint',
  },
  [PROP.BORDER_COLOR]: {
    columns: { nodes: COL.NODE_BORDER_COLOR },
    kind: 'color',
    tier: 'paint',
  },
  [PROP.LINE_COLOR]: {
    columns: { edges: COL.EDGE_LINE_COLOR },
    kind: 'color',
    tier: 'paint',
  },
  [PROP.BORDER_WIDTH]: {
    columns: { nodes: COL.NODE_BORDER_WIDTH },
    kind: 'scalar',
    tier: 'geometry',
    min: 0,
  },
  // round 25.1: node size — two lanes of one pair column.  Sharing the
  // column means width and height share the round-21 eviction channel
  // (recorded).  Compound parents are skipped at capture *and* per tick
  // (auto-bounds own their size column).  25.2: three derived channels
  // bake the edge width at style-write — the capture carries them as
  // ride-along lane writes (see captureEdgeWidthRides).
  // Round 56: edge width became lane 0 of a two-lane column (lane 1 is
  // the arrow-bits mirror), so this is a lane write on both groups now.
  // It costs nothing: lane writes never offload, and the geometry tier
  // never did.
  [PROP.WIDTH]: {
    columns: { nodes: COL.NODE_SIZE, edges: COL.EDGE_WIDTH },
    lanes: { nodes: 0, edges: 0 },
    kind: 'scalar',
    tier: 'geometry',
    min: 0,
  },
  [PROP.HEIGHT]: {
    columns: { nodes: COL.NODE_SIZE },
    lanes: { nodes: 1 },
    kind: 'scalar',
    tier: 'geometry',
    min: 0,
  },
  // round 25.4: compound padding — the declared value in its declared
  // unit (px, or a fraction under '%'); parents only, resolved by the
  // auto-bounds flush per tick
  [PROP.PADDING]: {
    columns: { nodes: TWEEN_COL.NODE_PADDING },
    kind: 'scalar',
    tier: 'geometry',
    min: 0,
  },
  // round 25.5: label font-size — the sidecar, patched per tick;
  // unlabelled elements are filtered at capture
  [PROP.FONT_SIZE]: {
    columns: {
      nodes: TWEEN_COL.NODE_FONT_SIZE,
      edges: TWEEN_COL.EDGE_FONT_SIZE,
    },
    kind: 'scalar',
    tier: 'geometry',
    min: 0,
  },
};

/** A style prop name in its canonical spelling (the style engine's `normalizeProp`, applied to animation targets). */
export const normalizeProp = (prop: string): string =>
  prop.replace(/([A-Z])/g, '-$1').toLowerCase();

/** An animation colour target as an `RGBA` byte tuple; throws on an unparsable colour. */
export const parseColor = (value: unknown): RGBA => {
  const tuple = color2tuple(value as string);

  if (tuple == null) {
    throw new Error(`Invalid animation colour '${String(value)}'`);
  }

  const [r, g, b, a] = tuple;

  return [r, g, b, Math.round((a ?? 1) * 255)];
};

/** An animation numeric target as a finite number; throws on anything else. */
export const parseNumber = (value: unknown): number => {
  const n = typeof value === 'number' ? value : parseFloat(String(value));

  if (!isFinite(n)) {
    throw new Error(`Invalid animation number '${String(value)}'`);
  }

  return n;
};

export type WriteKind =
  | 'position'
  | 'scalar'
  | 'color'
  | 'lane'
  | 'padding'
  | 'fontSize';

/**
 * Tween write targets: the real columns plus the pseudo-columns of the
 * round-25 geometry kinds — compound padding (25.4: a per-parent
 * compound style input routed through `updateCompoundStyle`, resolved
 * by the auto-bounds flush) and label font-size (25.5: the label
 * sidecar, patched per tick through `setLabelFontSize` — an edge's
 * write drives its end-label streams and fontSize-derived anchorY
 * along).
 */
export type TweenColumn = ColumnId | (typeof TWEEN_COL)[keyof typeof TWEEN_COL];

/**
 * One column's worth of resolved tween data, captured once at start.
 *
 * `data` is what both executors read.  Per slot: position `(fx, fy, tx,
 * ty)`; scalar `(from, to)`; colour two OKLab vec4s `(L, a, b, alpha)`,
 * alpha normalized — pre-converted on the CPU so the kernel only needs the
 * OKLab→sRGB direction it already has, and so both sides interpolate the
 * exact same numbers.
 */
export interface ChannelWrite {
  column: TweenColumn;
  kind: WriteKind;
  /** the column has no CPU consumer, so a GPU tween may own it outright */
  paint: boolean;
  /** parallel to `slots`; carries the generation for liveness checks */
  refs: Ref[];
  slots: Uint32Array;
  data: Float32Array;
  /** scalar bounds against easing overshoot (see StyleChannel) */
  min: number;
  max: number;
  /** round 25: which component a `lane` write targets.  Lane writes are
   * geometry-tier (never GPU-registered) and route through the store's
   * cascading lane writer. */
  lane?: number;
}

/** Linear interpolation from `a` to `b` at `t`. */
export const lerp = (a: number, b: number, t: number): number =>
  a + (b - a) * t;

/** `v` clamped to [`lo`, `hi`]. */
export const clampTo = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

/** Floats per slot in `ChannelWrite.data`, by kind. */
export const STRIDE: Record<WriteKind, number> = {
  position: 4,
  scalar: 2,
  color: 8,
  lane: 2,
  padding: 2,
  fontSize: 2,
};

/** An empty `ChannelWrite` for a column and kind, sized for `n` slots at the kind's stride. */
export const blankWrite = (
  column: TweenColumn,
  kind: WriteKind,
  paint: boolean,
  refs: Ref[],
  min = -Infinity,
  max = Infinity,
): ChannelWrite => ({
  column,
  kind,
  paint,
  refs,
  min,
  max,
  slots: Uint32Array.from(refs, (r) => r.slot),
  data: new Float32Array(refs.length * STRIDE[kind]),
});

/** The current scalar of a column at `slot`, lane 0 — the from-value of a scalar tween. */
export const readScalar = (
  store: GraphStore,
  column: ColumnId,
  slot: number,
): number => (store.column(column) as Float32Array)[slot];

/** The current RGBA bytes of a colour column at `slot` — the from-value of a colour tween. */
export const readColor = (
  store: GraphStore,
  column: ColumnId,
  slot: number,
): RGBA => {
  const bytes = store.column(column) as Uint8Array;
  const i = slot * 4;

  return [bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]];
};

/** Write an sRGB byte tuple into `out` at `i` as OKLab + normalized alpha. */
export const packOklab = (out: Float32Array, i: number, rgba: RGBA): void => {
  const [L, a, b] = srgbToOklab(rgba[0], rgba[1], rgba[2]);

  out[i] = L;
  out[i + 1] = a;
  out[i + 2] = b;
  out[i + 3] = rgba[3] / 255;
};

/** Interpolate one colour slot of `data` in OKLab, back to sRGB bytes. */
export const mixOklab = (data: Float32Array, i: number, e: number): RGBA => {
  const [r, g, b] = oklabToSrgb(
    lerp(data[i], data[i + 4], e),
    lerp(data[i + 1], data[i + 5], e),
    lerp(data[i + 2], data[i + 6], e),
  );

  // the rgb conversion clamps on its own; alpha would wrap in a byte column
  return [
    r,
    g,
    b,
    Math.round(clampTo(lerp(data[i + 3], data[i + 7], e), 0, 1) * 255),
  ];
};

/**
 * Round 24.1: build a pre-resolved ChannelWrite for a style transition.
 * The style engine diffs stored truth around a restyle (from = the
 * pre-restyle values, to = the newly resolved ones) and the tween
 * machinery consumes the write exactly as it would a captured
 * animation's — one set of numbers, the same two executors.
 *
 * @param column — the target column, or a `padding`/`fontSize` pseudo
 *   column for the two channels that are not stored as one (round 25)
 * @param kind — how the packed numbers are read back: a whole scalar or
 *   colour, one `lane` of a multi-lane column, or the two pseudo kinds
 * @param paint — whether the channel is paint-tier, which is what makes
 *   the write eligible to offload; geometry-tier writes never are
 * @param refs — the elements, parallel to `from`/`to`
 * @param from — the pre-restyle values, read from stored truth
 * @param to — the newly resolved values
 * @param min — lower clamp for the tweened value, as v3 clamps by
 *   property (`opacity` at 0, `border-width` at 0); bouncy easings
 *   overshoot without it
 * @param max — upper clamp, likewise
 * @param lane — which lane of the column, for the `lane` kind
 * @returns a write already carrying its from/to values, so the animation
 *   it is handed to has nothing to capture at play time — which is what
 *   keeps a whole-channel transition one bulk record instead of one
 *   Animation per element
 * @internal
 */
export const buildChannelWrite = (
  column: TweenColumn,
  kind: 'scalar' | 'color' | 'lane' | 'padding' | 'fontSize',
  paint: boolean,
  refs: Ref[],
  from: (number | RGBA)[],
  to: (number | RGBA)[],
  min = -Infinity,
  max = Infinity,
  lane?: number,
): ChannelWrite => {
  const write = blankWrite(column, kind, paint, refs, min, max);

  if (lane != null) {
    write.lane = lane;
  }

  for (let i = 0; i < refs.length; i++) {
    if (kind === 'color') {
      packOklab(write.data, i * 8, from[i] as RGBA);
      packOklab(write.data, i * 8 + 4, to[i] as RGBA);
    } else {
      // scalar and lane share the (from, to) stride
      write.data[i * 2] = from[i] as number;
      write.data[i * 2 + 1] = to[i] as number;
    }
  }

  return write;
};
