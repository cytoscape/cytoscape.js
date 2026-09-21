import { GROUP_EDGES, GROUP_NODES, CONDITION_FLAGS } from '../contract.mjs';
import type { CompoundStyle } from '../store/hierarchy.mjs';
import type { StyleProps } from '../public-types.mjs';
import { PROP } from '../style-props.mjs';
import type { Computed } from './defaults.mjs';
import { normalizeProp } from './normalize.mjs';
import type { BoundMapper, TransitionSpec } from './compile.mjs';

export interface GroupDef {
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
export type StateWriter = (slot: number, computed: Computed) => void;

/**
 * Below this many slots a bulk edge run is not worth its setup — the
 * contiguity scan, the state-word scan and one `copyWithin` per column
 * are each O(run), but the per-column call overhead is fixed.
 */
export const BULK_MIN_RUN = 64;

/** A node has no end-label streams; shared so the common path allocates
 * nothing to say so. */
export const EMPTY_END_TEXTS: readonly string[] = ['', ''];

export const SHEET_KEYS: ReadonlySet<string> = new Set([
  GROUP_NODES,
  GROUP_EDGES,
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
  [PROP.OVERLAY_OPACITY]: onState('active', 0.25, 0),
};

export const NODE_DEFAULT_BLOCK: StyleProps = {
  [PROP.BACKGROUND_COLOR]: onSelected('#0169D9', '#999'),
  ...ACTIVE_OVERLAY,
};

export const EDGE_DEFAULT_BLOCK: StyleProps = {
  [PROP.LINE_COLOR]: onSelected('#0169D9', '#999'),
  [PROP.SOURCE_ARROW_COLOR]: onSelected('#0169D9', '#999'),
  [PROP.TARGET_ARROW_COLOR]: onSelected('#0169D9', '#999'),
  [PROP.MID_SOURCE_ARROW_COLOR]: onSelected('#0169D9', '#999'),
  [PROP.MID_TARGET_ARROW_COLOR]: onSelected('#0169D9', '#999'),
  // v3's default sheet carries `edge { width: 3 }` — its only element rule
  width: 3,
  ...ACTIVE_OVERLAY,
};

/** v3's default `:parent` block (round 14.6): the channel overlay parent
 * nodes get on top of the nodes group.  Padding 10 rides the compound
 * defaults instead (it is not a channel).  Its two colours carry v3's
 * `:parent:selected` tint the same way the nodes block above does. */
export const PARENT_CHANNEL_OVERLAY: StyleProps = {
  shape: 'rectangle',
  [PROP.BACKGROUND_COLOR]: onSelected('#CCE1F9', '#eee'),
  [PROP.BORDER_WIDTH]: 1,
  [PROP.BORDER_COLOR]: onSelected('#aec8e5', '#ccc'),
};

/** The parents-group compound props (constants only; not channels). */
export const COMPOUND_PROPS: ReadonlySet<string> = new Set([
  PROP.PADDING,
  PROP.PADDING_LEFT,
  PROP.PADDING_RIGHT,
  PROP.PADDING_TOP,
  PROP.PADDING_BOTTOM,
  PROP.PADDING_RELATIVE_TO,
  PROP.MIN_WIDTH,
  PROP.MIN_HEIGHT,
  PROP.COMPOUND_SIZING_WRT_LABELS,
]);

export const PADDING_RELATIVE_TO = new Set([
  PROP.WIDTH,
  PROP.HEIGHT,
  'average',
  'min',
  'max',
]);

/** Split a parents-block props object into channel props and the parsed
 * compound style (round 14.6).  Compound props take constants only. */
export const splitCompoundProps = (
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
      case PROP.PADDING: {
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

      case PROP.PADDING_LEFT:
      case PROP.PADDING_RIGHT:
      case PROP.PADDING_TOP:
      case PROP.PADDING_BOTTOM: {
        // 85.4: same spelling as `padding` (px number, or 'N%' resolved
        // per `padding-relative-to`); unset sides take the uniform value
        let side: { value: number; unit: 'px' | '%' };

        if (typeof value === 'string') {
          const m = /^\s*([\d.]+)\s*%\s*$/.exec(value);

          if (m == null) {
            throw new Error(
              `Invalid ${norm} '${value}' (a number of px, or 'N%')`,
            );
          }

          side = { value: Number(m[1]) / 100, unit: '%' };
        } else if (
          typeof value === 'number' &&
          value >= 0 &&
          Number.isFinite(value)
        ) {
          side = { value, unit: 'px' };
        } else {
          throw new Error(
            `Invalid ${norm} '${String(value)}' (a number of px, or 'N%')`,
          );
        }

        if (norm === PROP.PADDING_LEFT) {
          compound.paddingLeft = side;
        } else if (norm === PROP.PADDING_RIGHT) {
          compound.paddingRight = side;
        } else if (norm === PROP.PADDING_TOP) {
          compound.paddingTop = side;
        } else {
          compound.paddingBottom = side;
        }

        break;
      }

      case PROP.PADDING_RELATIVE_TO:
        if (typeof value !== 'string' || !PADDING_RELATIVE_TO.has(value)) {
          throw new Error(
            `Invalid padding-relative-to '${String(value)}' (width | height | average | min | max)`,
          );
        }

        compound.relativeTo = value as CompoundStyle['relativeTo'];
        break;

      case PROP.MIN_WIDTH:
      case PROP.MIN_HEIGHT:
        if (typeof value !== 'number' || !(value >= 0)) {
          throw new Error(
            `Invalid ${norm} '${String(value)}' (a non-negative number of px)`,
          );
        }

        if (norm === PROP.MIN_WIDTH) {
          compound.minWidth = value;
        } else {
          compound.minHeight = value;
        }

        break;

      case PROP.COMPOUND_SIZING_WRT_LABELS:
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

/** The reserved condition keys, as a set — the sheet-scan gate. */
export const CONDITION_KEY_SET: ReadonlySet<string> = new Set(
  Object.keys(CONDITION_FLAGS),
);
