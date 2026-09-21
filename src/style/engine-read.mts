// StyleEngine's read-back side (round 130 split): `readProp` and the
// per-family resolvers it dispatches to.

import { GROUP_EDGES, GROUP_NODES } from '../contract.mjs';
import { bindEvaluator, isMapperSpec } from '../style-scales.mjs';
import type { BgLen, BgSize, NodeImageRecord } from '../store/graph-store.mjs';
import type { GroupName, Ref } from '../contract.mjs';
import type { StyleProps, Mapper } from '../public-types.mjs';
import { PROP } from '../style-props.mjs';
import { NODE_DEFAULTS, EDGE_DEFAULTS, NO_ARROW } from './defaults.mjs';
import type { RGBA, Computed } from './defaults.mjs';
import { formatRgba, foldRgba, NODE_READ, EDGE_READ } from './tables.mjs';
import {
  BG_FIT_NAMES,
  BG_REPEAT_NAMES,
  BG_CLIP_NAMES,
  BG_CONTAINMENT_NAMES,
  IMAGE_TYPE_NAMES,
} from './parse.mjs';
import { normalizeProp } from './normalize.mjs';
import { applyProp, assertGroupProp } from './apply-prop.mjs';
import {
  constOpacityFor,
  compileChannel,
  TRANSITION_CONFIG_PROPS,
} from './compile.mjs';
import type { BoundMapper } from './compile.mjs';
import { unfoldLabelAlpha, PROP_READERS } from './readers.mjs';
import type { StyleEngine } from '../style.mjs';

/**
 * One resolved prop for a live element.
 *
 * @param ref — the element to read
 * @param propRaw — a style property name
 * @returns the stored value, or undefined when the prop belongs to the
 *   other element group
 * @throws if the name is not a v4 style property at all — a typo must
 *   fail loudly rather than read as undefined
 * @internal
 */
export function readProp(
  engine: StyleEngine,
  ref: Ref,
  propRaw: string,
): string | number | undefined {
  // The per-raw-name read plan (round 62.4): one Map hit replaces the
  // normalize memo, four set membership tests and — on every edge
  // read — a per-call regex.  Everything cached here is immortal per
  // engine: name normalization, group membership, the transition and
  // arrow-fold classifications and the reader all come from module
  // tables a sheet swap never changes.
  let plan = engine.readPlans.get(propRaw);

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
    engine.readPlans.set(propRaw, plan);
  }

  if (!(ref.group === GROUP_NODES ? plan.node : plan.edge)) {
    return undefined;
  }

  const prop = plan.prop;

  // transition config (round 24.1): answered from the group's spec
  // (the parents overlay for parent nodes, like every channel read)
  if (plan.transition) {
    const spec = engine.defFor(ref).transition;

    switch (prop) {
      case PROP.TRANSITION_PROPERTY:
        return spec.props.length === 0 ? 'none' : spec.props.join(' ');
      case PROP.TRANSITION_DURATION:
        return spec.duration;
      case PROP.TRANSITION_DELAY:
        return spec.delay;
      default:
        return spec.easing;
    }
  }

  // GPU-owned channels: the stored bytes go stale after data writes, so
  // evaluate the shared IR lazily (same math the kernel runs, ±1/byte).
  // Arrow getters need the fold: stored alpha = colorAlpha × opacity,
  // either of which may be kernel-owned.
  const owned = engine.gpuOwnedProps[ref.group];

  if (ref.group === GROUP_EDGES && plan.arrowColorProp != null) {
    const colorProp = plan.arrowColorProp;

    if (owned.has(colorProp) || owned.has(PROP.OPACITY)) {
      const [r, g, b, a] = foldedArrow(engine, ref, colorProp);

      return prop.endsWith('-shape')
        ? a > 0
          ? 'triangle'
          : 'none'
        : formatRgba(r, g, b, a);
    }
  } else if (owned.has(prop)) {
    const def = engine.defFor(ref);
    const bm = def.mappers.find((bm) => bm.m.prop === prop);

    if (bm != null) {
      const value = bindEvaluator(
        bm.m,
        engine.store.data,
        ref.group,
        bm.channel.default(ref.group),
        engine.readValue,
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
    : plan.reader(engine.store, ref.slot, ref, engine.readCtx, prop);
}

/**
 * All resolved props of a live element's group.
 *
 * @param ref — the element to read
 * @returns every readable prop of its group, by name
 * @internal
 */
export function readProps(
  engine: StyleEngine,
  ref: Ref,
): Record<string, string | number> {
  const props = ref.group === GROUP_NODES ? NODE_READ : EDGE_READ;
  const out: Record<string, string | number> = {};

  for (const prop of props) {
    out[prop] = readProp(engine, ref, prop) as string | number;
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
 * @internal
 */
export function lineOpacityConst(engine: StyleEngine): number {
  return (engine.defs.edges.computed as Computed).lineOpacity;
}

/** The sheet's arrow-width modes (constants-only props) — an
 * edge-width tween needs these to carry the style-write-resolved
 * `edge.arrowWidths` along (round 25.2): 'match-line' and percent
 * forms baked the width, plain numbers did not.
 * @internal */
export function arrowWidthModes(engine: StyleEngine): {
  source: number | 'match-line' | { percent: number };
  target: number | 'match-line' | { percent: number };
} {
  const computed = engine.defs.edges.computed as Computed;

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
 * @internal
 */
export function arrowBase(
  engine: StyleEngine,
  ref: Ref,
  colorProp: string,
): RGBA {
  const def = engine.defs.edges;
  const computed = def.computed as Computed;
  const source = colorProp.startsWith('source');
  const shape = source ? computed.sourceArrowShape : computed.targetArrowShape;

  if (shape !== 'triangle') {
    return NO_ARROW;
  }

  return evalEdgeProp(
    engine,
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
export function foldedArrow(
  engine: StyleEngine,
  ref: Ref,
  colorProp: string,
): RGBA {
  const [r, g, b, a] = arrowBase(engine, ref, colorProp);
  const computed = engine.defs.edges.computed as Computed;
  const opacity = evalEdgeProp(
    engine,
    ref,
    PROP.OPACITY,
    computed.opacity,
  ) as number;

  // B1: line-opacity folds into the arrow alpha too (constant here —
  // a mapped line-opacity demotes edge paint off the kernel)
  return [r, g, b, Math.round(a * opacity * computed.lineOpacity)];
}

/** One edge prop for a slot: the mapper's value when mapped, else the constant. */
export function evalEdgeProp(
  engine: StyleEngine,
  ref: Ref,
  prop: string,
  constant: number | RGBA,
): number | RGBA {
  const bm = engine.defs.edges.mappers.find((bm) => bm.m.prop === prop);

  return bm == null
    ? constant
    : bindEvaluator(
        bm.m,
        engine.store.data,
        GROUP_EDGES,
        bm.channel.default(GROUP_EDGES),
        engine.readValue,
      )(ref.slot);
}

/** Resolved label channels: the sidecar when labelled, else the sheet. */
export function labelChannels(
  engine: StyleEngine,
  ref: Ref,
): { fontSize: number; color: string } {
  const entry = engine.store.labelAt(ref.slot, ref.group);

  if (entry != null) {
    const packed = unfoldLabelAlpha(engine.store, ref.slot, ref, entry.color);

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

  const def = engine.defFor(ref);
  let computed: Computed;

  if (def.mappers.length > 0) {
    // an unlabelled element still reads mapped font-size/color truthfully
    const scratch: Computed = { ...def.computed };

    for (const bm of def.mappers) {
      bm.channel.set(
        scratch,
        bindEvaluator(
          bm.m,
          engine.store.data,
          ref.group,
          bm.channel.default(ref.group),
          engine.readValue,
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
export function resolveConst(
  engine: StyleEngine,
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
    width: group === GROUP_NODES ? NODE_DEFAULTS.width : EDGE_DEFAULTS.width,
  };

  for (const prop of Object.keys(props)) {
    const norm = normalizeProp(prop);
    const value = props[prop];

    assertGroupProp(group, norm, value);

    if (isMapperSpec(value)) {
      // chart-values (round 23): the data passthrough reads a
      // per-element *array* — only { data: key } is supported
      if (norm === PROP.CHART_VALUES) {
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
        norm === PROP.LABEL ||
        norm === PROP.SOURCE_LABEL ||
        norm === PROP.TARGET_LABEL
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

        if (norm === PROP.LABEL) {
          computed.label = '';
          computed.labelKey = asScale.data;
        } else if (norm === PROP.SOURCE_LABEL) {
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
export function readImageProp(
  engine: StyleEngine,
  slot: number,
  prop: string,
): string | number {
  const recs = engine.store.nodeImagesAt(slot);

  if (recs == null) {
    // imageless nodes read the v3 defaults
    switch (prop) {
      case PROP.BACKGROUND_IMAGE:
        return 'none';
      case PROP.BACKGROUND_FIT:
        return 'none';
      case PROP.BACKGROUND_IMAGE_OPACITY:
        return 1;
      case PROP.BACKGROUND_POSITION_X:
      case PROP.BACKGROUND_POSITION_Y:
        return '50%';
      case PROP.BACKGROUND_OFFSET_X:
      case PROP.BACKGROUND_OFFSET_Y:
        return 0;
      case PROP.BACKGROUND_WIDTH:
      case PROP.BACKGROUND_HEIGHT:
        return 'auto';
      case PROP.BACKGROUND_REPEAT:
        return 'no-repeat';
      case PROP.BACKGROUND_CLIP:
        return 'node';
      case PROP.BACKGROUND_IMAGE_CONTAINMENT:
        return 'inside';
      case PROP.BACKGROUND_IMAGE_SMOOTHING:
        return 'yes';
      case PROP.BACKGROUND_IMAGE_CROSSORIGIN:
        return 'anonymous';
      case PROP.BACKGROUND_IMAGE_TYPE:
        return 'auto';
      default:
        return formatRgba(...NODE_DEFAULTS.backgroundImageColor);
    }
  }

  const lenOf = (l: BgLen): string | number => (l.pct ? `${l.v}%` : l.v);
  const sizeOf = (s: BgSize): string | number =>
    s.mode === 0 ? 'auto' : s.mode === 2 ? `${s.v}%` : s.v;
  // per-image lists read back space-joined; single images as scalars
  const per = (f: (r: NodeImageRecord) => string | number): string | number => {
    const list = recs.map(f);

    return list.length === 1 ? list[0] : list.join(' ');
  };

  switch (prop) {
    case PROP.BACKGROUND_IMAGE:
      return per((r) => r.url);
    case PROP.BACKGROUND_FIT:
      return per((r) => BG_FIT_NAMES[r.fit]);
    case PROP.BACKGROUND_IMAGE_OPACITY:
      return per((r) => r.opacity);
    case PROP.BACKGROUND_POSITION_X:
      return per((r) => lenOf(r.posX));
    case PROP.BACKGROUND_POSITION_Y:
      return per((r) => lenOf(r.posY));
    case PROP.BACKGROUND_OFFSET_X:
      return per((r) => lenOf(r.offX));
    case PROP.BACKGROUND_OFFSET_Y:
      return per((r) => lenOf(r.offY));
    case PROP.BACKGROUND_WIDTH:
      return per((r) => sizeOf(r.w));
    case PROP.BACKGROUND_HEIGHT:
      return per((r) => sizeOf(r.h));
    case PROP.BACKGROUND_REPEAT:
      return per((r) => BG_REPEAT_NAMES[r.repeat]);
    case PROP.BACKGROUND_CLIP:
      return per((r) => BG_CLIP_NAMES[r.clip]);
    case PROP.BACKGROUND_IMAGE_CONTAINMENT:
      return per((r) => BG_CONTAINMENT_NAMES[r.containment]);
    case PROP.BACKGROUND_IMAGE_SMOOTHING:
      return per((r) => (r.smoothing ? 'yes' : 'no'));
    case PROP.BACKGROUND_IMAGE_CROSSORIGIN:
      return (
        engine.store.images.get(recs[0].entryId)?.crossOrigin ?? 'anonymous'
      );
    case PROP.BACKGROUND_IMAGE_TYPE:
      return per((r) => IMAGE_TYPE_NAMES[r.sdf ? 1 : 0]);
    default: {
      const [r, g, b, a] = recs[0].tint;

      return formatRgba(r, g, b, a);
    }
  }
}
