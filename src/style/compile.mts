import { GROUP_NODES, COL, CONDITION_FLAGS } from '../contract.mjs';
import { compileMapper } from '../style-scales.mjs';
import { compileEasing } from '../easing.mjs';
import { TWEEN_COL } from '../animation.mjs';
import type { TweenColumn } from '../animation.mjs';
import type { CompiledMapper, Evaluated } from '../style-scales.mjs';
import type { GroupName, Ref } from '../contract.mjs';
import type { StyleProps, MapperSpec } from '../public-types.mjs';
import { PROP } from '../style-props.mjs';
import type { RGBA, Computed } from './defaults.mjs';
import { NODE_READ, EDGE_READ } from './tables.mjs';
import { TAXI_TURN_AUTO_SENTINEL } from './parse-edge.mjs';
import { normalizeProp } from './normalize.mjs';
import { MAPPABLE } from './mappable.mjs';
import type { MappableChannel } from './mappable.mjs';
import type { GroupDef } from './sheet.mjs';

/** A compiled mapper bound to its target channel. */
export interface BoundMapper {
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
export const partitionOf = (
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
export const stateOnlyMask = (bm: BoundMapper): number => {
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
export interface Evaluator {
  set: (computed: Computed, value: Evaluated) => void;
  ev: (slot: number) => Evaluated;
}

/** Evaluated-value equality for the round-61 partition diff: colours
 * evaluate to RGBA arrays, everything else to scalars/strings. */
export const evaluatedEq = (a: Evaluated, b: Evaluated): boolean =>
  Array.isArray(a) && Array.isArray(b)
    ? a.length === b.length && a.every((v, i) => v === b[i])
    : a === b;

/**
 * Paint channels: props whose stored bytes no CPU path reads back except
 * the style getters — the GPU-eligible half of the mapper split.  (The
 * geometry channels — size, border-width, shape, edge width — feed
 * culling, CPU picking and columnar scans, so they stay CPU-evaluated.)
 */
export const PAINT_PROPS: Record<GroupName, ReadonlySet<string>> = {
  nodes: new Set([PROP.BACKGROUND_COLOR, PROP.BORDER_COLOR, PROP.OPACITY]),
  edges: new Set([
    PROP.LINE_COLOR,
    PROP.OPACITY,
    PROP.SOURCE_ARROW_COLOR,
    PROP.TARGET_ARROW_COLOR,
    PROP.SOURCE_ARROW_SHAPE,
    PROP.TARGET_ARROW_SHAPE,
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
export const constOpacityFor = (
  group: GroupName,
  prop: string,
  computed: Computed,
): number => {
  if (group === GROUP_NODES) {
    return prop === PROP.BACKGROUND_COLOR
      ? computed.backgroundOpacity
      : prop === PROP.BORDER_COLOR
        ? computed.borderOpacity
        : 1;
  }

  return prop === PROP.LINE_COLOR ? computed.lineOpacity : 1;
};

/** Compile one mapper spec against its `MAPPABLE` channel: the bound evaluator, its partition and state mask. */
export const compileChannel = (
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

  // `taxi-turn`'s `fallback: 'auto'` (124): the keyword is not a number,
  // so it compiles as the sentinel the channel's setter reads back
  const mapperSpec =
    prop === PROP.TAXI_TURN &&
    !Array.isArray(spec) &&
    typeof spec === 'object' &&
    spec != null &&
    String((spec as { fallback?: unknown }).fallback).trim() === 'auto'
      ? { ...spec, fallback: TAXI_TURN_AUTO_SENTINEL }
      : spec;

  return {
    m: compileMapper(mapperSpec, {
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
export const TRANSITION_CONFIG_PROPS: ReadonlySet<string> = new Set([
  PROP.TRANSITION_PROPERTY,
  PROP.TRANSITION_DURATION,
  PROP.TRANSITION_DELAY,
  PROP.TRANSITION_TIMING_FUNCTION,
]);

export interface TransitionSpec {
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
export interface TxnChannelDesc {
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

export const TRANSITION_CHANNELS: Record<
  GroupName,
  Record<string, TransitionChannel>
> = {
  nodes: {
    opacity: {
      column: COL.NODE_OPACITY,
      kind: 'scalar',
      paint: true,
      min: 0,
      max: 1,
    },
    [PROP.BACKGROUND_COLOR]: {
      column: COL.NODE_FILL_COLOR,
      kind: 'color',
      paint: true,
      min: -Infinity,
      max: Infinity,
    },
    [PROP.BORDER_COLOR]: {
      column: COL.NODE_BORDER_COLOR,
      kind: 'color',
      paint: true,
      min: -Infinity,
      max: Infinity,
    },
    [PROP.BORDER_WIDTH]: {
      column: COL.NODE_BORDER_WIDTH,
      kind: 'scalar',
      paint: false,
      min: 0,
      max: Infinity,
    },
    // round 25.3: the size lanes.  Parent slots never record (their
    // size is auto-bounds-derived); the lane restore/tick runs the
    // full size cascade (outerHalf, label re-anchor, auto-bounds).
    width: {
      column: COL.NODE_SIZE,
      kind: 'lane',
      lane: 0,
      paint: false,
      min: 0,
      max: Infinity,
    },
    height: {
      column: COL.NODE_SIZE,
      kind: 'lane',
      lane: 1,
      paint: false,
      min: 0,
      max: Infinity,
    },
    // round 25.5: the label sidecar's font-size (a fontSize diff with
    // no sidecar entry on either side never records — the -1 sentinel)
    [PROP.FONT_SIZE]: {
      column: TWEEN_COL.NODE_FONT_SIZE,
      kind: 'fontSize',
      paint: false,
      min: 0,
      max: Infinity,
    },
  },
  edges: {
    opacity: {
      column: COL.EDGE_OPACITY,
      kind: 'scalar',
      paint: true,
      min: 0,
      max: 1,
      rides: [
        {
          column: COL.EDGE_SOURCE_ARROW,
          kind: 'color',
          paint: true,
          min: -Infinity,
          max: Infinity,
        },
        {
          column: COL.EDGE_TARGET_ARROW,
          kind: 'color',
          paint: true,
          min: -Infinity,
          max: Infinity,
        },
      ],
    },
    [PROP.LINE_COLOR]: {
      column: COL.EDGE_LINE_COLOR,
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
      column: COL.EDGE_WIDTH,
      kind: 'scalar',
      paint: false,
      min: 0,
      max: Infinity,
      rides: [
        {
          column: COL.EDGE_CASING,
          kind: 'lane',
          lane: 1,
          paint: false,
          min: 0,
          max: Infinity,
        },
        {
          column: COL.EDGE_OVERLAY,
          kind: 'lane',
          lane: 1,
          paint: false,
          min: 0,
          max: Infinity,
        },
        {
          column: COL.EDGE_UNDERLAY,
          kind: 'lane',
          lane: 1,
          paint: false,
          min: 0,
          max: Infinity,
        },
        {
          column: COL.EDGE_ARROW_WIDTHS,
          kind: 'lane',
          lane: 0,
          paint: false,
          min: 0,
          max: Infinity,
        },
        {
          column: COL.EDGE_ARROW_WIDTHS,
          kind: 'lane',
          lane: 1,
          paint: false,
          min: 0,
          max: Infinity,
        },
      ],
    },
    [PROP.FONT_SIZE]: {
      column: TWEEN_COL.EDGE_FONT_SIZE,
      kind: 'fontSize',
      paint: false,
      min: 0,
      max: Infinity,
    },
  },
};

/** Split the transition config props out of a sheet block. */
export const splitTransitionProps = (
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

/** The transition config of a group block (`transition-property`, duration, delay, easing) as a `TransitionSpec`. */
export const parseTransitionSpec = (
  group: GroupName,
  config: Record<string, unknown>,
): TransitionSpec => {
  const readSet = group === GROUP_NODES ? NODE_READ : EDGE_READ;
  const constOnly = (prop: string, v: unknown): void => {
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      throw new Error(
        `'${prop}' takes constants only (transition config can not be mapped)`,
      );
    }
  };

  let props: string[] = [];
  const rawProps = config[PROP.TRANSITION_PROPERTY];

  constOnly(PROP.TRANSITION_PROPERTY, rawProps);

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
          `'${p}' is not a ${group === GROUP_NODES ? 'node' : 'edge'} style property ` +
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

  const rawEasing = config[PROP.TRANSITION_TIMING_FUNCTION];

  constOnly(PROP.TRANSITION_TIMING_FUNCTION, rawEasing);

  const easing = rawEasing == null ? 'linear' : String(rawEasing);

  compileEasing(easing); // validate at parse time — unknown names throw here

  return {
    props,
    duration: num(PROP.TRANSITION_DURATION),
    delay: num(PROP.TRANSITION_DELAY),
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
export interface TxnCapture {
  group: GroupName;
  spec: TransitionSpec;
  channels: { main: TransitionChannel; rides: readonly TxnChannelDesc[] }[];
  entries: Map<string, TxnEntry>;
  padding: boolean;
}

/** Component-wise equality of two `RGBA` tuples. */
export const rgbaEq = (a: RGBA, b: RGBA): boolean =>
  a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
