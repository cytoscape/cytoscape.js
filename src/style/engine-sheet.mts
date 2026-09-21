// StyleEngine's sheet compile (round 130 split): `setSheet` and the
// paint-side introspection the renderer reads.

import { GROUP_EDGES, GROUP_NODES, DATA_ID } from '../contract.mjs';
import type { CompiledMapper, Evaluated } from '../style-scales.mjs';
import type { GroupName } from '../contract.mjs';
import type { Stylesheet } from '../public-types.mjs';
import { PROP } from '../style-props.mjs';
import type { RGBA } from './defaults.mjs';
import { resolveCoreProps } from './tables.mjs';
import { normalizeProp } from './normalize.mjs';
import {
  partitionOf,
  PAINT_PROPS,
  constOpacityFor,
  splitTransitionProps,
  parseTransitionSpec,
} from './compile.mjs';
import type { BoundMapper } from './compile.mjs';
import {
  SHEET_KEYS,
  NODE_DEFAULT_BLOCK,
  EDGE_DEFAULT_BLOCK,
  PARENT_CHANNEL_OVERLAY,
  splitCompoundProps,
  CONDITION_KEY_SET,
} from './sheet.mjs';
import type { GroupDef } from './sheet.mjs';
import type { StyleEngine } from '../style.mjs';
import { resolveConst } from './engine-read.mjs';
import { validateBypasses, installBypasses } from './engine-bypass.mjs';

/**
 * Replace the stylesheet and re-apply it to every live element,
 * mapped channels included.
 *
 * The sheet is a plain `{ nodes, edges, parents, core }` object of
 * prop objects — no selector blocks, no style functions.  The
 * `parents` group overlays the `nodes` block under v3's `:parent`
 * defaults.
 *
 * @param sheet — the stylesheet to install
 * @param apply — when false, compile and validate without applying;
 *   the core uses this to defer the apply to the outermost
 *   `endBatch()` while still throwing on a bad sheet at the call site
 * @throws on an unknown sheet key, an unknown property, or an invalid
 *   value
 */
export function setSheet(
  engine: StyleEngine,
  sheet: Stylesheet,
  apply: boolean = true,
): void {
  for (const key of Object.keys(sheet)) {
    if (!SHEET_KEYS.has(key)) {
      throw new Error(
        `Unknown stylesheet key '${key}'; supported keys: nodes, edges, parents, core, bypasses`,
      );
    }

    // v3's opaque `( ele ) => props` group form was removed by design
    // (29.3: it was silently *ignored*, so a ported v3 sheet produced
    // an unstyled graph with no error)
    if (typeof (sheet as Record<string, unknown>)[key] === 'function') {
      throw new Error(
        `The style function form ('${key}: ( ele ) => props') is not supported in v4; ` +
          `a group is a props object whose values are constants or mapper objects ` +
          `(use a 'case' mapper for conditionals and 'data(key)' scales for per-element values)`,
      );
    }
  }

  // round 63.2: validate the bypasses section before any engine state
  // mutates, so a bad entry throws with nothing half-applied
  const bypassEntries = validateBypasses(engine, sheet.bypasses);

  engine.coreStyle = resolveCoreProps(sheet.core);

  // the parents group (round 14.6): channel props overlay the nodes
  // block under v3's :parent defaults; the compound props split out
  // (they are per-parent auto-bounds inputs, not channels)
  const parentsSplit = splitCompoundProps(sheet.parents ?? {});

  const compile = (
    group: GroupName,
    def: Stylesheet[typeof GROUP_NODES],
  ): GroupDef => {
    // the transition config props are engine config, not channels
    // (round 24.1) — split them out before channel resolution
    const { channels, config } = splitTransitionProps(def ?? {});
    const transition = parseTransitionSpec(group, config);
    const mappers: BoundMapper[] = [];
    const computed = resolveConst(engine, group, channels, mappers);

    // which mutable data() keys the group's style derives from — the
    // data-write refresh gate (id is immutable and never registers)
    let deps: GroupDef['deps'] = null;
    const dep = (key: string, what: 'label' | 'mappers' | 'chart'): void => {
      if (key === DATA_ID) {
        return;
      }

      deps ??= new Map();

      const entry = deps.get(key) ?? {
        label: false,
        mappers: false,
        chart: false,
      };

      entry[what] = true;
      deps.set(key, entry);
    };

    if (computed.labelKey != null) {
      dep(computed.labelKey, 'label');
    }
    if (computed.sourceLabelKey != null) {
      dep(computed.sourceLabelKey, 'label');
    }
    if (computed.targetLabelKey != null) {
      dep(computed.targetLabelKey, 'label');
    }
    if (computed.chartValuesKey != null) {
      dep(computed.chartValuesKey, 'chart');
    }

    for (const bm of mappers) {
      for (const key of bm.m.keys) {
        dep(key, 'mappers');
      }
    }

    return {
      computed,
      mappers,
      deps,
      transition,
      partition: partitionOf(mappers),
    };
  };

  // v4's default stylesheet goes *first*, so anything the user's own
  // block declares replaces it — v3's order-based precedence, spelled
  // as an object spread (round 57.1)
  const defs = {
    nodes: compile(GROUP_NODES, {
      ...NODE_DEFAULT_BLOCK,
      ...(sheet.nodes ?? {}),
    }),
    edges: compile(GROUP_EDGES, {
      ...EDGE_DEFAULT_BLOCK,
      ...(sheet.edges ?? {}),
    }),
    // v3 precedence is order-based, not specificity-based: the default
    // :parent block sits before the user stylesheet, so a user nodes
    // block overrides it (parity-pinned), and the user parents block
    // overrides everything
    parents: compile(GROUP_NODES, {
      ...NODE_DEFAULT_BLOCK,
      ...PARENT_CHANNEL_OVERLAY,
      ...(sheet.nodes ?? {}),
      ...parentsSplit.channels,
    }),
  };

  engine.parentCompound = { padding: 10, ...parentsSplit.compound };

  // channels the parents def resolves differently from the nodes def:
  // default-overlay keys the user nodes block does NOT override, plus
  // everything in the user parents block (the GPU demotion set)
  const nodeKeys = new Set(Object.keys(sheet.nodes ?? {}).map(normalizeProp));

  engine.parentsOverride = new Set([
    ...Object.keys(PARENT_CHANNEL_OVERLAY)
      .map(normalizeProp)
      .filter((k) => !nodeKeys.has(k)),
    ...Object.keys(parentsSplit.channels).map(normalizeProp),
  ]);

  // which arrow ends can any edge have at all — the renderer skips whole
  // arrow draw calls per end when nothing enables it; a mapped arrow
  // shape conservatively enables its end (per-element arrows still
  // collapse in the shader via zero alpha)
  const mapsProp = (def: GroupDef, prop: string): boolean =>
    def.mappers.some((bm) => bm.m.prop === prop);

  // any non-'none' shape draws (the pre-round-10 gate checked
  // 'triangle' only — a latent bug for constant vee/chevron/... sheets)
  engine.arrows = {
    source:
      defs.edges.computed.sourceArrowShape !== 'none' ||
      mapsProp(defs.edges, PROP.SOURCE_ARROW_SHAPE),
    target:
      defs.edges.computed.targetArrowShape !== 'none' ||
      mapsProp(defs.edges, PROP.TARGET_ARROW_SHAPE),
  };
  engine.midArrows = {
    source:
      defs.edges.computed.midSourceArrowShape !== 'none' ||
      mapsProp(defs.edges, PROP.MID_SOURCE_ARROW_SHAPE),
    target:
      defs.edges.computed.midTargetArrowShape !== 'none' ||
      mapsProp(defs.edges, PROP.MID_TARGET_ARROW_SHAPE),
  };

  engine.sheet = sheet;
  engine.defs = defs;

  // global: routes to the atlas and marks every labelled node
  // label-dirty (metrics change), applied even while batching — the
  // deferred flush re-lays-out against current entries anyway
  engine.store.setLabelFont(
    defs.nodes.computed.fontFamily,
    defs.nodes.computed.fontStyle,
    defs.nodes.computed.fontWeight,
  );

  // the store coalesces write spans for paint-mapped keys so the GPU
  // eval pass knows what to re-evaluate without a CPU restyle; owned
  // props reset until the runtime re-configures against the new sheet.
  // Only single-key scale mappers can be GPU-evaluated — conditionals
  // (case, '' key / multi-key) stay CPU-evaluated, so they aren't watched.
  for (const group of [GROUP_NODES, GROUP_EDGES] as const) {
    engine.store.watchDataKeys(
      group,
      defs[group].mappers
        .filter(
          (bm) =>
            PAINT_PROPS[group].has(bm.m.prop) && bm.m.program.kind !== 'case',
        )
        .map((bm) => bm.m.key),
    );
    // the state half (round 57.1): which reserved keys any `case`
    // condition reads, so the store's flag writes know whether a flip
    // needs a restyle.  Nodes fold the parents def — a rule that only
    // applies to compound parents still has to fire when the bit moves
    // on one.
    const states = new Set<string>();

    for (const key of CONDITION_KEY_SET) {
      if (
        defs[group].deps?.has(key) === true ||
        (group === GROUP_NODES && defs.parents.deps?.has(key) === true)
      ) {
        states.add(key);
      }
    }

    engine.store.watchStateKeys(group, states);
    engine.gpuOwnedProps[group] = new Set();
  }

  // whole-replace, like every other section (the keep-them idiom is
  // spreading the exported sheet); setSheet's paintVersion bump below
  // already covers any kernel-ownership change engine implies
  installBypasses(engine, bypassEntries);

  engine.paintVersion++;

  if (apply) {
    engine.applyAll();
  }
}

/**
 * Paint-channel mappers with resolved fallbacks (the runtime's pack
 * input).  A mapped arrow *shape* demotes all edge paint to the CPU:
 * the shape gates the stored arrow alpha, and splitting that fold
 * between CPU and kernel would race.
 *
 * @param group — the element group to collect for
 * @returns each eligible mapper with the fallback its channel resolves to
 * @internal
 */
export function paintInputs(
  engine: StyleEngine,
  group: GroupName,
): { m: CompiledMapper; fallback: Evaluated }[] {
  const def = engine.defs[group];

  if (
    group === GROUP_EDGES &&
    def.mappers.some((bm) => bm.m.prop.endsWith('-arrow-shape'))
  ) {
    return [];
  }

  // B1: the channel-opacity split folds into stored alphas at write
  // time, so a kernel colour program has to fold the same factor or it
  // overwrites the folded bytes.  Round 66.3: when the channel opacity
  // is a **constant** the kernel does exactly that — the multiplier
  // rides the program as `alphaMul` and the shader applies it
  // (`domain.w`), which is the mechanism the arrow programs have used
  // since round 13.  Only a *mapped* channel opacity still demotes: its
  // value varies per element, and evaluating it in the kernel is a
  // separate question (the state `case` form, which these sheets use,
  // is not packable at all).
  const computed = def.computed;
  const mapped = (prop: string): boolean =>
    def.mappers.some((bm) => bm.m.prop === prop);
  const demoted = new Set<string>();

  if (group === GROUP_NODES) {
    if (mapped(PROP.BACKGROUND_OPACITY)) {
      demoted.add(PROP.BACKGROUND_COLOR);
    }

    if (mapped(PROP.BORDER_OPACITY)) {
      demoted.add(PROP.BORDER_COLOR);
    }

    // round 14.4: under compounds the stored node opacity is the
    // ancestor-folded product — a kernel-owned opacity would
    // overwrite the fold, so it stays CPU-evaluated.  Round 14.6:
    // channels the parents overlay resolves differently would be
    // repainted with the nodes value by the kernel (it evaluates
    // every slot), so they demote too.
    if (engine.store.hasCompounds()) {
      demoted.add(PROP.OPACITY);

      for (const p of engine.parentsOverride) {
        demoted.add(p);
      }
    }
  } else {
    if (mapped(PROP.LINE_OPACITY)) {
      demoted.add(PROP.LINE_COLOR);
      demoted.add(PROP.SOURCE_ARROW_COLOR);
      demoted.add(PROP.TARGET_ARROW_COLOR);
    }

    // B4: the casing alpha folds the element opacity at write time,
    // so a kernel-owned opacity would leave stale casing bytes
    if (computed.lineOutlineWidth > 0 || mapped(PROP.LINE_OUTLINE_WIDTH)) {
      demoted.add(PROP.OPACITY);
    }
  }

  // round 63.3: a channel carrying a bypass demotes while any exists —
  // the kernel evaluates every slot and would overwrite the bypassed
  // slot's stored bytes on its next dispatch.  Count-gated and
  // reversible: the last removal (or a sheet swap without the entry)
  // restores kernel ownership through the paintVersion bump.
  for (const [prop, n] of engine.bypassPropCounts) {
    if (n > 0) {
      demoted.add(prop);
    }
  }

  // round 24.2: a listed transition prop's diff reads *stored truth*
  // on the CPU, which is stale exactly when the eval kernel owns the
  // channel — so transitions and kernel ownership are mutually
  // exclusive per channel (the tween itself still rides the GPU tween
  // kernels; only the mapper eval stays CPU).  Under compounds the
  // parents overlay's spec demotes too (parent slots diff through it).
  if (def.transition.duration > 0) {
    for (const p of def.transition.props) {
      demoted.add(p);
    }
  }

  if (
    group === GROUP_NODES &&
    engine.store.hasCompounds() &&
    engine.defs.parents.transition.duration > 0
  ) {
    for (const p of engine.defs.parents.transition.props) {
      demoted.add(p);
    }
  }

  return def.mappers
    .filter(
      (bm) => PAINT_PROPS[group].has(bm.m.prop) && !demoted.has(bm.m.prop),
    )
    .map((bm) => ({
      m: bm.m,
      fallback: bm.m.fallback ?? bm.channel.default(group),
      alphaMul: constOpacityFor(group, bm.m.prop, computed),
    }));
}

/**
 * Edge-sheet constants for the kernel's arrow-alpha folding.
 *
 * @param group — the element group to read the sheet for
 * @returns the constants the kernel needs to fold arrow alpha itself
 * @internal
 */
export function paintContext(
  engine: StyleEngine,
  group: GroupName,
): {
  opacityMapped: boolean;
  constOpacity: number;
  source: { enabled: boolean; colorMapped: boolean; constColor: RGBA };
  target: { enabled: boolean; colorMapped: boolean; constColor: RGBA };
} | null {
  const def = engine.defs.edges;

  if (group !== GROUP_EDGES || def.computed == null) {
    return null;
  }

  const computed = def.computed;
  const mapped = (prop: string): boolean =>
    def.mappers.some((bm) => bm.m.prop === prop);
  // B1: the kernel's arrow fold multiplies by the *element* opacity;
  // line-opacity folds at write time, and a non-default constant
  // rides constOpacity (a mapped line-opacity demotes arrows in
  // paintInputs, so it never reaches the kernel)

  return {
    opacityMapped: mapped(PROP.OPACITY),
    constOpacity: computed.opacity * computed.lineOpacity,
    source: {
      enabled: computed.sourceArrowShape === 'triangle',
      colorMapped: mapped(PROP.SOURCE_ARROW_COLOR),
      constColor: computed.sourceArrowColor,
    },
    target: {
      enabled: computed.targetArrowShape === 'triangle',
      colorMapped: mapped(PROP.TARGET_ARROW_COLOR),
      constColor: computed.targetArrowColor,
    },
  };
}
