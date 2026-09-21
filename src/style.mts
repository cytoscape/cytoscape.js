/*
StyleEngine: the v4 stylesheet is `{ nodes, edges }` — no selectors, no
style functions.  Each key is a props object whose values are constants
or mapper objects; all per-element variation is declarative (style-
scales.mts: `data(key)` scales and `case` conditionals), so every value
is analyzable, serializable, and GPU-evaluable.  Prop names are kebab-
case or camelCase; `label` (and the D4 `source-label`/`target-label`)
additionally take the legacy `data(key)` string, which normalizes to
the `{ data: key }` passthrough.

Every mapper is cheaply CPU-evaluable — that invariant keeps `ele.style()`
synchronous, keeps headless mode and Node tests working (the same IR runs
on CPU, GPU, and in tests), and keeps determinism.  GPU evaluation is an
optimization layered over the CPU-evaluable IR, never a source of values
the CPU can't reproduce.

Refresh: constant props and declarative mappers stay fresh automatically —
a data() write re-derives the mapped channels of exactly the written
slots, gated per group on the mapped keys, and a change in a live
auto-domain extent re-derives the whole channel.  A select never restyles
(the `:selected` accent ring is drawn by the shader).

Defaults ≈ v3: gray 30×30 ellipse nodes, 2px gray lines.
*/
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
  columnSpec,
  CONDITION_FLAGS,
  FLAG_NO_EVENTS,
  FLAG_PARENT,
  FLAG_TEXT_EVENTS,
  LABEL_MARGIN,
  SHAPE_CIRCLE,
  SHAPE_ELLIPSE,
  SHAPE_POLYGON_CUSTOM,
} from './contract.mjs';
import {
  bindEvaluator,
  isMapperSpec,
  autoExtentFor,
  applyAutoExtent,
} from './style-scales.mjs';
import { CURVE_STYLE_HAYSTACK, isBlobStyle } from './store/curve-index.mjs';
import type { CurveStyleExtras, EndpointSpec } from './store/curve-index.mjs';
import type { CompoundStyle } from './store/hierarchy.mjs';
import type {
  BgLen,
  BgSize,
  NodeImageRecord,
  NodeImageSpec,
} from './store/graph-store.mjs';
import { ENDPT_DEFAULT } from './curve-geometry.mjs';
import { TWEEN_COL, buildChannelWrite } from './animation.mjs';
import type { ChannelWrite } from './animation.mjs';
import type {
  CompiledMapper,
  Evaluated,
  ValueReader,
} from './style-scales.mjs';
import type { ColumnId, GroupName, Ref } from './contract.mjs';
import type { GraphStore } from './store/graph-store.mjs';
import type { StyleProps, Stylesheet, Mapper } from './public-types.mjs';
import { PROP } from './style-props.mjs';
import { NODE_DEFAULTS, EDGE_DEFAULTS, NO_ARROW } from './style/defaults.mjs';
import type {
  RGBA,
  NodeComputed,
  Computed,
  ArrowShape,
} from './style/defaults.mjs';
import {
  stringify,
  packRgba,
  formatRgba,
  foldRgba,
  foldLayerRgba,
  NODE_READ,
  EDGE_READ,
  CORE_DEFAULTS,
  resolveCoreProps,
  DEFAULT_CHART_COLORS,
  IMAGE_CAP,
  ARROW_ENUM,
  COMPOUND_ARROWS,
} from './style/tables.mjs';
import type { CoreStyle } from './style/tables.mjs';
import {
  BG_FIT_NAMES,
  BG_REPEAT_NAMES,
  BG_CLIP_NAMES,
  BG_CONTAINMENT_NAMES,
  IMAGE_TYPE_NAMES,
  gradientStops,
} from './style/parse.mjs';
import { normalizeProp } from './style/normalize.mjs';
import {
  applyProp,
  assertGroupProp,
  captureBypassPatch,
} from './style/apply-prop.mjs';
import type { BypassPatch } from './style/apply-prop.mjs';
import {
  partitionOf,
  stateOnlyMask,
  evaluatedEq,
  PAINT_PROPS,
  constOpacityFor,
  compileChannel,
  TRANSITION_CONFIG_PROPS,
  TRANSITION_CHANNELS,
  splitTransitionProps,
  parseTransitionSpec,
  rgbaEq,
} from './style/compile.mjs';
import type {
  BoundMapper,
  Evaluator,
  TxnChannelDesc,
  TxnCapture,
} from './style/compile.mjs';
import {
  BULK_MIN_RUN,
  EMPTY_END_TEXTS,
  SHEET_KEYS,
  NODE_DEFAULT_BLOCK,
  EDGE_DEFAULT_BLOCK,
  PARENT_CHANNEL_OVERLAY,
  splitCompoundProps,
  CONDITION_KEY_SET,
} from './style/sheet.mjs';
import type { GroupDef, StateWriter } from './style/sheet.mjs';
import { unfoldLabelAlpha, PROP_READERS } from './style/readers.mjs';
import type { ReadContext, PropReader } from './style/readers.mjs';
// the property readers register themselves into PROP_READERS at module
// evaluation (35.2), so the three reader modules are imported for that
// side effect before any read runs
import './style/readers-nodes.mjs';
import './style/readers-labels.mjs';
import './style/readers-edges.mjs';
export type { CoreStyle } from './style/tables.mjs';
export { normalizeProp } from './style/normalize.mjs';
export class StyleEngine {
  private store: GraphStore;
  /**
   * The narrow view of this engine that the module-scope property
   * readers receive (35.2).  Built once here rather than per read, and
   * its getters stay live across a sheet swap that replaces `defs`.
   */
  private readonly readCtx: ReadContext;
  /** per-raw-name read plans (round 62.4): normalization, group
   * membership, the transition/arrow classifications and the reader,
   * resolved once per spelling — all from module tables no sheet swap
   * changes, so the cache is immortal per engine */
  private readonly readPlans = new Map<
    string,
    {
      prop: string;
      node: boolean;
      edge: boolean;
      transition: boolean;
      arrowColorProp: string | null;
      reader: PropReader | null;
    }
  >();
  private sheet: Stylesheet;
  private defs: { nodes: GroupDef; edges: GroupDef; parents: GroupDef };
  /** the parents-group compound style, applied per parent slot */
  private parentCompound: Partial<CompoundStyle> = { padding: 10 };
  /** normalized channel props the parents overlay resolves differently
   * from the nodes group (defaults + the user parents block) — a
   * GPU-mapped nodes channel in this set demotes to the CPU path */
  private parentsOverride: ReadonlySet<string> = new Set(
    Object.keys(PARENT_CHANNEL_OVERLAY),
  );

  private arrows = { source: false, target: false };
  private midArrows = { source: false, target: false };

  /**
   * Bumps when the paint-mapper state changes (sheet set, or a GPU-owned
   * live auto-domain extent moved) — the renderer's mapper runtime pulls
   * on this to repack its program buffers.
   * @internal
   */
  paintVersion = 0;

  /** props per group the GPU eval kernel currently owns (set by the runtime). */
  private gpuOwnedProps: Record<GroupName, ReadonlySet<string>> = {
    nodes: new Set(),
    edges: new Set(),
  };

  /** a mapped key's column promoted to mixed while kernel-owned: re-derive on CPU */
  private demoted: Record<GroupName, boolean> = { nodes: false, edges: false };

  /** Round 24.1: styled-generation marks (gen + 1; 0 = never styled).  A
   * slot joins transition diffs only when its *current* element has been
   * styled before — the first application on add is instant (v3's rule),
   * and a recycled slot's fresh generation fails the check on its own. */
  private styledGen: Record<GroupName, Uint32Array> = {
    nodes: new Uint32Array(0),
    edges: new Uint32Array(0),
  };

  /**
   * How many edge runs have taken the round-67.2 bulk route.
   *
   * Internal, and not a statistic anyone needs at runtime — it exists so
   * `test/bulk-style-apply.mjs` can assert that the route *ran*.  Without
   * it a comparison against the per-element route passes just as well
   * when the gate declined, which is exactly what the first version of
   * that spec did: its fixture mapped `curve-style` and `label`, neither
   * of which has a narrow writer, so every assertion compared the
   * per-element path against itself.
   */
  _bulkRuns = 0;

  /** Round 24.1: the open transition capture (one per group-def pass). */
  private txn: TxnCapture | null = null;

  // -- per-element bypasses (round 63) --

  /** id → normalized prop → raw value: the live bypass declarations
   * (the `bypasses` sheet section plus the sugar methods' writes),
   * exported by `json()`.  Id-keyed declarations, not element state —
   * an entry survives remove/re-add and may name an id that does not
   * exist yet (inert until it does). */
  private bypassRaw = new Map<string, Record<string, unknown>>();

  /** id → per-group parsed patches.  Both groups parse at declaration
   * time (the id may not resolve yet); null marks a group whose guards
   * reject the entry's props (e.g. a curve prop never applies to a
   * node), decided when the id resolves. */
  private bypassParsed = new Map<
    string,
    { nodes: BypassPatch | null; edges: BypassPatch | null }
  >();

  /** slot → patch per group, resolved lazily against the store's
   * structure epoch — adds, removes and compaction all bump it, and a
   * re-resolution is O(declared ids), never O(elements). */
  private bypassSlots: Record<GroupName, Map<number, BypassPatch>> = {
    nodes: new Map(),
    edges: new Map(),
  };

  private bypassEpoch = -1;

  /** normalized prop → live declaration count across ids — what
   * `paintInputs` demotes by (a kernel-owned mapper would overwrite a
   * bypassed slot's stored bytes on its next dispatch). */
  private bypassPropCounts = new Map<string, number>();

  /** Whether any bypass is declared — the zero-cost gate every touched
   * path checks first (the round-63 performance contract).
   *
   * @returns true when at least one id has a live bypass declaration
   */
  hasBypasses(): boolean {
    return this.bypassRaw.size > 0;
  }

  /** Validate a sheet's `bypasses` section into installable entries —
   * called before any engine state mutates, so a bad section throws
   * from `setSheet` with nothing half-applied. */
  private validateBypasses(section: Stylesheet['bypasses']): Map<
    string,
    {
      raw: Record<string, unknown>;
      parsed: { nodes: BypassPatch | null; edges: BypassPatch | null };
    }
  > {
    const out = new Map<
      string,
      {
        raw: Record<string, unknown>;
        parsed: { nodes: BypassPatch | null; edges: BypassPatch | null };
      }
    >();

    if (section == null) {
      return out;
    }

    if (typeof section !== 'object' || Array.isArray(section)) {
      throw new Error(
        `The 'bypasses' section is an object of { id: { prop: constant } } entries`,
      );
    }

    for (const id of Object.keys(section)) {
      const entry = (section as Record<string, unknown>)[id];

      if (entry == null || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error(
          `Invalid bypass for '${id}': an entry is a { prop: constant } object`,
        );
      }

      const raw: Record<string, unknown> = {};

      for (const key of Object.keys(entry)) {
        raw[normalizeProp(key)] = (entry as Record<string, unknown>)[key];
      }

      out.set(id, { raw, parsed: this.parseBypassGroups(id, raw) });
    }

    return out;
  }

  /** Parse one entry's props for both groups; a group whose guards
   * reject them parses null, and both rejecting is the caller's error. */
  private parseBypassGroups(
    id: string,
    raw: Record<string, unknown>,
  ): { nodes: BypassPatch | null; edges: BypassPatch | null } {
    let nodes: BypassPatch | null = null;
    let edges: BypassPatch | null = null;
    let nodesErr: unknown = null;

    try {
      nodes = captureBypassPatch(GROUP_NODES, raw);
    } catch (e) {
      nodesErr = e;
    }

    try {
      edges = captureBypassPatch(GROUP_EDGES, raw);
    } catch {
      // the nodes error carries the message when both reject
    }

    if (nodes == null && edges == null) {
      throw new Error(
        `Invalid bypass for '${id}': ${(nodesErr as Error).message}`,
      );
    }

    return { nodes, edges };
  }

  /** Install validated bypass entries (whole-replace — `setSheet`'s
   * swap semantics: the section is replaced like any other). */
  private installBypasses(
    entries: Map<
      string,
      {
        raw: Record<string, unknown>;
        parsed: { nodes: BypassPatch | null; edges: BypassPatch | null };
      }
    >,
  ): void {
    this.bypassRaw.clear();
    this.bypassParsed.clear();
    this.bypassPropCounts.clear();
    this.bypassEpoch = -1;

    for (const [id, { raw, parsed }] of entries) {
      this.bypassRaw.set(id, raw);
      this.bypassParsed.set(id, parsed);

      for (const norm of Object.keys(raw)) {
        this.bypassPropCounts.set(
          norm,
          (this.bypassPropCounts.get(norm) ?? 0) + 1,
        );
      }
    }
  }

  /** Re-resolve declared ids to live slots when the structure epoch
   * moved — O(declared ids) per structural change, amortized over the
   * writes between changes, and nothing at all when no bypass exists. */
  private rebuildBypassSlots(): void {
    const epoch = this.store.structureEpoch;

    if (epoch === this.bypassEpoch) {
      return;
    }

    this.bypassEpoch = epoch;
    this.bypassSlots.nodes.clear();
    this.bypassSlots.edges.clear();

    for (const [id, parsed] of this.bypassParsed) {
      const ref = this.store.lookup(id);

      if (ref == null) {
        continue; // declared for an id not present — inert until it is
      }

      const patch = parsed[ref.group];

      if (patch != null && patch.length > 0) {
        this.bypassSlots[ref.group].set(ref.slot, patch);
      }
    }
  }

  /** The bypass patch for a slot, or null.  O(1) after the lazy
   * epoch-checked re-resolution. */
  private bypassPatchAt(group: GroupName, slot: number): BypassPatch | null {
    this.rebuildBypassSlots();

    return this.bypassSlots[group].get(slot) ?? null;
  }

  /**
   * Clone-and-patch: the write funnel's bypass merge (round 63.3).  A
   * method rather than an inline spread so specs can count invocations
   * — a bypass-free instance must never reach it, which is the
   * performance contract's zero-cost gate made testable.
   *
   * @param computed — the slot's sheet-resolved record (never mutated)
   * @param patch — the captured field pairs for the slot's bypass
   * @returns a fresh record with the bypassed fields replaced
   * @internal
   */
  mergeBypass(computed: Computed, patch: BypassPatch): Computed {
    const merged = { ...computed } as unknown as Record<string, unknown>;

    for (let i = 0; i < patch.length; i++) {
      merged[patch[i][0] as string] = patch[i][1];
    }

    return merged as unknown as Computed;
  }

  /**
   * Set bypass props for one live element — the sugar path behind
   * `ele.style( name, value )` (round 63.4).  Unlike the sheet
   * section, whose entries parse against both groups because their ids
   * may not have resolved yet, this validates against the element's
   * own group, so a wrong-group prop throws with the group's own
   * message.  The slot re-applies through the normal single-slot apply
   * afterwards, which is what makes transitions and the write-funnel
   * merge ride the same path every restyle does.
   *
   * @param ref — the live element's ref (the caller validates liveness)
   * @param id — its id, the declaration key
   * @param props — prop → constant, dash-case or camelCase
   * @throws on a mapper value, a global font prop, a transition config
   *   prop, a wrong-group prop, or an invalid value
   */
  setBypass(ref: Ref, id: string, props: Record<string, unknown>): void {
    const raw: Record<string, unknown> = {};

    for (const key of Object.keys(props)) {
      raw[normalizeProp(key)] = props[key];
    }

    // validate against the element's own group before any state mutates
    captureBypassPatch(ref.group, raw);

    const prev = this.bypassRaw.get(id);
    const merged = { ...(prev ?? {}), ...raw };

    this.bypassRaw.set(id, merged);
    this.bypassParsed.set(id, this.parseBypassGroups(id, merged));

    let countsMoved = false;

    for (const norm of Object.keys(raw)) {
      if (prev == null || !(norm in prev)) {
        const n = this.bypassPropCounts.get(norm) ?? 0;

        this.bypassPropCounts.set(norm, n + 1);

        if (n === 0) {
          countsMoved = true;
        }
      }
    }

    this.refreshBypassSlot(ref, id);

    if (countsMoved) {
      this.paintVersion++;
    }

    // a first bypass on a kernel-owned channel demotes it, and the
    // kernel stops writing — every slot's stored bytes for that channel
    // must become CPU-derived, which one whole-group apply does (paid
    // once per 0→1 transition of a kernel-owned prop; never headless,
    // where nothing is kernel-owned)
    if (
      countsMoved &&
      Object.keys(raw).some((p) => this.gpuOwnedProps[ref.group].has(p))
    ) {
      this.applyBulk(ref.group, this.store.slotsOrdered(ref.group));
    } else {
      this.applyBulk(ref.group, [ref.slot]);
    }
  }

  /**
   * Remove bypass props for one live element — the path behind
   * `ele.removeStyle( name? )` (round 63.4).  Removing re-applies the
   * slot, so the sheet-resolved values return through the normal
   * funnel (transitions included).
   *
   * @param ref — the live element's ref
   * @param id — its id, the declaration key
   * @param name — the prop to remove, either spelling; omit to clear
   *   the element's whole declaration
   */
  removeBypass(ref: Ref, id: string, name?: string): void {
    const prev = this.bypassRaw.get(id);

    if (prev == null) {
      return;
    }

    let removed: string[];

    if (name == null) {
      removed = Object.keys(prev);
      this.bypassRaw.delete(id);
      this.bypassParsed.delete(id);
    } else {
      const norm = normalizeProp(name);

      if (!(norm in prev)) {
        return;
      }

      delete prev[norm];
      removed = [norm];

      if (Object.keys(prev).length === 0) {
        this.bypassRaw.delete(id);
        this.bypassParsed.delete(id);
      } else {
        this.bypassParsed.set(id, this.parseBypassGroups(id, prev));
      }
    }

    let countsMoved = false;

    for (const norm of removed) {
      const n = this.bypassPropCounts.get(norm) ?? 0;

      if (n <= 1) {
        this.bypassPropCounts.delete(norm);
        countsMoved = true;
      } else {
        this.bypassPropCounts.set(norm, n - 1);
      }
    }

    this.refreshBypassSlot(ref, id);

    if (countsMoved) {
      // a 1→0 transition hands the channel back to the kernel (it
      // re-evaluates every slot on its next dispatch, so no CPU
      // re-derive is owed here)
      this.paintVersion++;
    }

    this.applyBulk(ref.group, [ref.slot]);
  }

  /** Patch one slot's entry in the resolved maps after a sugar write —
   * only when the maps are current (stale maps re-resolve wholesale at
   * the next write anyway). */
  private refreshBypassSlot(ref: Ref, id: string): void {
    if (this.bypassEpoch !== this.store.structureEpoch) {
      return;
    }

    const parsed = this.bypassParsed.get(id);
    const patch = parsed == null ? null : parsed[ref.group];

    if (patch != null && patch.length > 0) {
      this.bypassSlots[ref.group].set(ref.slot, patch);
    } else {
      this.bypassSlots[ref.group].delete(ref.slot);
    }
  }

  /** Round 24.1: receives the diffed transition tweens — wired by the
   * core to AnimationManager.start (the round-21 eviction gives uniform
   * latest-wins); null in engine-only contexts disables capture.
   * @internal */
  transitionSink:
    | ((
        refs: Ref[],
        writes: ChannelWrite[],
        opts: { duration: number; delay: number; easing: string },
      ) => void)
    | null = null;

  /** value reader for mapper/condition keys ('id' is first-class, not in
   * the sidecar; the reserved '::' keys answer a case condition from the
   * flags column — the structural pair since round 14.7, the state
   * family since 57.1) */
  private readValue: ValueReader = (group, slot, key) => {
    const bit = CONDITION_FLAGS[key];

    if (bit != null) {
      // the hierarchy pair is nodes-only; an edge is neither, rather
      // than reading a bit that means nothing on its flags word
      if (group !== GROUP_NODES && (key === '::parent' || key === '::child')) {
        return false;
      }

      return this.store.hasFlag(group, slot, bit);
    }

    return key === DATA_ID
      ? this.store.idAt(group, slot)
      : this.store.data.get(group, slot, key);
  };

  /**
   * @param store — the columnar store whose channel columns this engine
   *   resolves style into
   */
  constructor(store: GraphStore) {
    this.store = store;
    this.sheet = {};

    // The readers' view of this engine.  Arrow functions capture `this`
    // directly (no alias); `store` and `defs` are accessors because
    // `defs` is replaced wholesale on a sheet swap, and a snapshot would
    // hand every reader the previous sheet's computed values.
    const ctx = {
      defFor: (ref: Ref) => this.defFor(ref),
      labelChannels: (ref: Ref) => this.labelChannels(ref),
      readImageProp: (slot: number, prop: string) =>
        this.readImageProp(slot, prop),
    } as ReadContext;

    Object.defineProperty(ctx, 'store', { get: () => this.store });
    Object.defineProperty(ctx, 'defs', { get: () => this.defs });

    this.readCtx = ctx;

    // The empty sheet, through the same path a real one takes.  This
    // used to build `defs` inline with `mappers: []` hardcoded, which
    // was harmless while every default was a constant and wrong the
    // moment one was not: round 57.1 made the default `background-color`
    // a conditional mapper, and an instance constructed without a
    // `style` option silently lost it — two paths that agreed only by
    // coincidence.  There is one path now, and "no stylesheet" is the
    // empty stylesheet.
    this.defs = null as never;
    this.setSheet({}, false);

    // a mixed column can't evaluate in the kernel: demote its group's
    // mapped channels back to eager CPU (the runtime repacks on the
    // version bump; the next mapped pass re-derives every slot)
    store.data.onPromote = (group, key) => {
      if (
        this.defs[group].deps?.has(key) &&
        this.gpuOwnedProps[group].size > 0
      ) {
        this.demoted[group] = true;
        this.paintVersion++;
      }
    };
  }

  private coreStyle: CoreStyle = { ...CORE_DEFAULTS };

  /**
   * The resolved core theming props (round 13 A2).
   *
   * @returns the live record — `setSheet` replaces it wholesale, so a
   *   held reference reads the *previous* sheet's theming after a swap
   * @internal
   */
  core(): CoreStyle {
    return this.coreStyle;
  }

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
  setSheet(sheet: Stylesheet, apply: boolean = true): void {
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
    const bypassEntries = this.validateBypasses(sheet.bypasses);

    this.coreStyle = resolveCoreProps(sheet.core);

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
      const computed = this.resolveConst(group, channels, mappers);

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

    this.parentCompound = { padding: 10, ...parentsSplit.compound };

    // channels the parents def resolves differently from the nodes def:
    // default-overlay keys the user nodes block does NOT override, plus
    // everything in the user parents block (the GPU demotion set)
    const nodeKeys = new Set(Object.keys(sheet.nodes ?? {}).map(normalizeProp));

    this.parentsOverride = new Set([
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
    this.arrows = {
      source:
        defs.edges.computed.sourceArrowShape !== 'none' ||
        mapsProp(defs.edges, PROP.SOURCE_ARROW_SHAPE),
      target:
        defs.edges.computed.targetArrowShape !== 'none' ||
        mapsProp(defs.edges, PROP.TARGET_ARROW_SHAPE),
    };
    this.midArrows = {
      source:
        defs.edges.computed.midSourceArrowShape !== 'none' ||
        mapsProp(defs.edges, PROP.MID_SOURCE_ARROW_SHAPE),
      target:
        defs.edges.computed.midTargetArrowShape !== 'none' ||
        mapsProp(defs.edges, PROP.MID_TARGET_ARROW_SHAPE),
    };

    this.sheet = sheet;
    this.defs = defs;

    // global: routes to the atlas and marks every labelled node
    // label-dirty (metrics change), applied even while batching — the
    // deferred flush re-lays-out against current entries anyway
    this.store.setLabelFont(
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
      this.store.watchDataKeys(
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

      this.store.watchStateKeys(group, states);
      this.gpuOwnedProps[group] = new Set();
    }

    // whole-replace, like every other section (the keep-them idiom is
    // spreading the exported sheet); setSheet's paintVersion bump below
    // already covers any kernel-ownership change this implies
    this.installBypasses(bypassEntries);

    this.paintVersion++;

    if (apply) {
      this.applyAll();
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
  paintInputs(group: GroupName): { m: CompiledMapper; fallback: Evaluated }[] {
    const def = this.defs[group];

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
      if (this.store.hasCompounds()) {
        demoted.add(PROP.OPACITY);

        for (const p of this.parentsOverride) {
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
    for (const [prop, n] of this.bypassPropCounts) {
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
      this.store.hasCompounds() &&
      this.defs.parents.transition.duration > 0
    ) {
      for (const p of this.defs.parents.transition.props) {
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
  paintContext(group: GroupName): {
    opacityMapped: boolean;
    constOpacity: number;
    source: { enabled: boolean; colorMapped: boolean; constColor: RGBA };
    target: { enabled: boolean; colorMapped: boolean; constColor: RGBA };
  } | null {
    const def = this.defs.edges;

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

  /**
   * The runtime reports which props its kernel evaluates: the data-write
   * refresh skips their CPU evaluation (the whole point of GPU eval) and
   * the read-back getters evaluate the shared IR lazily instead of
   * trusting the stale stored bytes.
   *
   * @param group — the element group the kernel runs over
   * @param props — the props it evaluates; replaces the previous set
   * @internal
   */
  setGpuOwned(group: GroupName, props: Iterable<string>): void {
    this.gpuOwnedProps[group] = new Set(props);
  }

  /**
   * Whether a data write can change the group's computed style — the gate
   * that keeps an unrelated write from costing a restyle.
   *
   * @param group — the element group being written
   * @param keys — the data() keys the write touches
   * @returns true when any mapped channel or label depends on one of them
   * @internal
   */
  stylesDependOnData(group: GroupName, keys: string[]): boolean {
    // plain loops, no closures: this gate runs twice on every data()
    // write, and the closure-per-call form cost 700 ns through tsx
    // (the round-34 __name tax) against 41 through the bundle (62.3)
    const own = this.defs[group].deps;

    if (own != null) {
      for (let i = 0; i < keys.length; i++) {
        if (own.has(keys[i])) {
          return true;
        }
      }
    }

    if (group === GROUP_NODES && this.store.hasCompounds()) {
      const parents = this.defs.parents.deps;

      if (parents != null) {
        for (let i = 0; i < keys.length; i++) {
          if (parents.has(keys[i])) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Whether the current sheet styles a flag state — i.e. whether
   * flipping that bit has to restyle at all.  Every flag-write choke
   * point asks this before doing any work, so a sheet that says nothing
   * about a state pays one Set lookup when it changes.
   *
   * v4's default stylesheet says yes for two of them.  Selection: nodes'
   * `background-color`, edges' `line-color` and the four arrow colours
   * are `{ selected: true }` case mappers.  Press: the `overlay-*` props
   * are `{ active: true }` ones.  A sheet that declares those props
   * replaces the rule and the state becomes free again — which is the
   * same trade round 4 made when v4 still had `:selected` blocks,
   * arriving from the other direction.
   *
   * @param group — the element group whose flag is changing
   * @param key — the reserved condition key, e.g. `'::selected'`
   * @returns true when the change must re-evaluate mappers
   * @internal
   */
  dependsOnState(group: GroupName, key: string): boolean {
    return this.stylesDependOnData(group, [key]);
  }

  /**
   * Whether the eval kernel currently owns this prop's stored bytes —
   * the gate a direct column read carries so it never reports a value
   * a kernel has made stale (round 62.6; the same rule readProp keeps).
   *
   * @param group — the element group
   * @param prop — the normalized property name
   * @returns true when the prop is kernel-owned
   * @internal
   */
  ownsProp(group: GroupName, prop: string): boolean {
    return this.gpuOwnedProps[group].has(prop);
  }

  /** Which arrow ends the current stylesheet can enable.
   *
   * @internal */
  get arrowEnds(): { source: boolean; target: boolean } {
    return this.arrows;
  }

  /**
   * Which mid-edge arrow ends the current sheet can enable.  The
   * renderer skips the mid-arrow draw entirely when neither is
   * possible.
   * @internal
   */
  get midArrowEnds(): { source: boolean; target: boolean } {
    return this.midArrows;
  }

  /**
   * The installed stylesheet, as given.  Part of `cy.json()`'s export.
   *
   * @returns the sheet object (live, not a copy — treat as read-only)
   */
  json(): Stylesheet {
    // round 63.2: the bypasses section reflects the *live* declarations
    // (sheet section plus sugar writes), not the object the sheet was
    // set with — and is omitted entirely when none exist
    const { bypasses: _stale, ...rest } = this.sheet as Stylesheet & {
      bypasses?: unknown;
    };

    if (this.bypassRaw.size === 0) {
      return rest;
    }

    const bypasses: Record<string, Record<string, unknown>> = {};

    for (const [id, props] of this.bypassRaw) {
      bypasses[id] = { ...props };
    }

    return { ...rest, bypasses } as Stylesheet;
  }

  /** Re-apply the current sheet (e.g. to re-snapshot live auto-domain extents). */
  update(): void {
    this.applyAll();
  }

  /**
   * Apply the sheet across every live element of both groups.  This is
   * the whole-graph pass a sheet change or a batch flush runs.
   * @internal
   */
  applyAll(): void {
    this.applyBulk(GROUP_NODES, this.store.slotsOrdered(GROUP_NODES));
    this.applyBulk(GROUP_EDGES, this.store.slotsOrdered(GROUP_EDGES));
  }

  /**
   * Bulk apply over *live* slots of one group.  The group resolves once
   * (the per-element cost is only the column writes); mapped channels
   * evaluate per element in applyMapped.
   *
   * @param group — the element group to style
   * @param slots — the live slots to write; must all be of that group
   * @internal
   */
  applyBulk(group: GroupName, slots: ArrayLike<number>): void {
    if (slots.length === 0) {
      return;
    }

    if (group === GROUP_NODES && this.store.hasCompounds()) {
      // parents resolve through the overlay def (round 14.6)
      const flags = this.store.column(COL.NODE_FLAGS) as Uint32Array;
      const leaves: number[] = [];
      const parents: number[] = [];

      for (let i = 0; i < slots.length; i++) {
        ((flags[slots[i]] & FLAG_PARENT) !== 0 ? parents : leaves).push(
          slots[i],
        );
      }

      if (leaves.length > 0) {
        this.applyGroupDef(GROUP_NODES, this.defs.nodes, leaves);
      }

      if (parents.length > 0) {
        const def = this.defs.parents;
        // padding transitions (25.4): the compound-style write sits
        // outside the write() funnel, so it takes its own capture.
        // The styled marks are read before the channel pass marks
        // fresh slots (instant-on-add must hold for padding too).
        const txn = this.openTxn(GROUP_NODES, def);
        const styledBefore =
          txn != null && txn.padding
            ? parents.map((slot) => this.wasStyled(GROUP_NODES, slot))
            : null;

        try {
          // the inner openTxn no-ops while this capture is open, so
          // the channel diffs land in the same preset animation
          this.applyGroupDef(GROUP_NODES, def, parents);

          for (let i = 0; i < parents.length; i++) {
            this.applyCompoundStyle(
              txn,
              parents[i],
              styledBefore == null ? false : styledBefore[i],
            );
          }
        } finally {
          this.closeTxn(txn);
        }
      }

      return;
    }

    this.applyGroupDef(group, this.defs[group], slots);
  }

  /**
   * The parents' compound-style write with the padding transition
   * capture (round 25.4): diff the declared padding around the sheet
   * write, snap on a px↔% unit flip (tweening across units has no
   * meaning — recorded), and restore the held pre-restyle value
   * (CSS's delay rule, like the channel diffs).
   */
  private applyCompoundStyle(
    txn: TxnCapture | null,
    slot: number,
    styled: boolean,
  ): void {
    const store = this.store;

    if (txn == null || !txn.padding || !styled) {
      store.setCompoundStyle(slot, this.parentCompound);

      return;
    }

    const before = store.compoundStyleOf(slot);

    store.setCompoundStyle(slot, this.parentCompound);

    const after = store.compoundStyleOf(slot);

    if (
      after.paddingUnit !== before.paddingUnit ||
      after.padding === before.padding
    ) {
      return;
    }

    let entry = txn.entries.get(TWEEN_COL.NODE_PADDING);

    if (entry == null) {
      entry = {
        column: TWEEN_COL.NODE_PADDING,
        kind: 'padding',
        paint: false,
        min: 0,
        max: Infinity,
        refs: [],
        from: [],
        to: [],
      };
      txn.entries.set(TWEEN_COL.NODE_PADDING, entry);
    }

    entry.refs.push(store.ref(GROUP_NODES, slot));
    entry.from.push(before.padding);
    entry.to.push(after.padding);

    store.updateCompoundStyle(slot, { padding: before.padding });
  }

  private applyGroupDef(
    group: GroupName,
    def: GroupDef,
    slots: ArrayLike<number>,
  ): void {
    const txn = this.openTxn(group, def);

    try {
      if (def.mappers.length > 0) {
        this.applyMapped(group, def, slots);
      } else {
        const computed = def.computed;

        // no mappers: nothing varies, so the run needs no writers
        if (this.bulkEdgeRun(group, slots)) {
          this.applyBulkEdges(slots, computed, [], [], []);
        } else {
          for (let i = 0; i < slots.length; i++) {
            this.write(group, slots[i], computed);
          }
        }
      }
    } finally {
      this.closeTxn(txn);
    }
  }

  // -- transitions (round 24.1) --

  /**
   * Open a transition capture for one group-def apply pass: every
   * already-styled slot the pass writes gets its tweenable channels
   * diffed on stored truth.  Null (capture off) when nothing can
   * transition — unconfigured specs cost nothing.
   */
  private openTxn(group: GroupName, def: GroupDef): TxnCapture | null {
    const spec = def.transition;

    if (this.transitionSink == null || this.txn != null) {
      return null;
    }
    if (spec.duration <= 0 || spec.props.length === 0) {
      return null;
    }

    const table = TRANSITION_CHANNELS[group];
    const channels: TxnCapture['channels'] = [];

    for (const prop of spec.props) {
      const ch = table[prop];

      // props with no tweenable channel (discrete) snap — the apply
      // pass already wrote them, so snapping is doing nothing here
      if (ch != null) {
        channels.push({ main: ch, rides: ch.rides ?? [] });
      }
    }

    // compound padding (25.4) diffs in the parents' compound-style
    // write, not the channel funnel — flag it as listed
    const padding = group === GROUP_NODES && spec.props.includes(PROP.PADDING);

    if (channels.length === 0 && !padding) {
      return null;
    }

    this.txn = { group, spec, channels, entries: new Map(), padding };

    return this.txn;
  }

  /** Close a capture: pack the accumulated diffs into bulk ChannelWrites
   * (one per column — never per-element animations) and hand them to the
   * sink as one transition animation. */
  private closeTxn(txn: TxnCapture | null): void {
    if (txn == null) {
      return;
    }

    this.txn = null;

    if (txn.entries.size === 0) {
      return;
    }

    const writes: ChannelWrite[] = [];
    const refs: Ref[] = [];
    const seen = new Set<number>();

    for (const e of txn.entries.values()) {
      writes.push(
        buildChannelWrite(
          e.column,
          e.kind,
          e.paint,
          e.refs,
          e.from,
          e.to,
          e.min,
          e.max,
          e.lane,
        ),
      );

      for (const ref of e.refs) {
        if (!seen.has(ref.slot)) {
          seen.add(ref.slot);
          refs.push(ref);
        }
      }
    }

    this.transitionSink!(refs, writes, {
      duration: txn.spec.duration,
      delay: txn.spec.delay,
      easing: txn.spec.easing,
    });
  }

  private readTxnValue(ch: TxnChannelDesc, slot: number): number | RGBA {
    if (ch.kind === 'scalar') {
      return (this.store.column(ch.column as ColumnId) as Float32Array)[slot];
    }

    if (ch.kind === 'fontSize') {
      // -1 = no sidecar entry (unlabelled); a diff with a sentinel on
      // either side snaps rather than tweening from/to nothing
      const stream =
        ch.column === TWEEN_COL.NODE_FONT_SIZE ? GROUP_NODES : GROUP_EDGES;

      return this.store.labelAt(slot, stream)?.fontSize ?? -1;
    }

    if (ch.kind === 'lane') {
      // the edge layer records hold their stroke in lane 1, ×256
      // fixed-point (matching setLane's encode)
      if (
        ch.column === COL.EDGE_CASING ||
        ch.column === COL.EDGE_OVERLAY ||
        ch.column === COL.EDGE_UNDERLAY
      ) {
        return (
          (this.store.column(ch.column) as Uint32Array)[slot * 2 + 1] / 256
        );
      }

      const arr = this.store.column(ch.column as ColumnId) as Float32Array;

      return arr[
        slot * columnSpec(ch.column as ColumnId).components +
          (ch.lane as number)
      ];
    }

    const bytes = this.store.column(ch.column as ColumnId) as Uint8Array;
    const i = slot * 4;

    return [bytes[i], bytes[i + 1], bytes[i + 2], bytes[i + 3]];
  }

  /** Pre-write snapshot of one slot's capture channels (mains + rides). */
  private txnPre(txn: TxnCapture, slot: number): (number | RGBA)[] {
    const out: (number | RGBA)[] = [];

    for (const { main, rides } of txn.channels) {
      out.push(this.readTxnValue(main, slot));

      for (const r of rides) {
        out.push(this.readTxnValue(r, slot));
      }
    }

    return out;
  }

  /**
   * Post-write diff of one slot: record each moved channel (from = the
   * snapshot, to = the newly stored value) and *restore* the old value —
   * the store holds the pre-restyle state until the tween's first
   * post-delay tick, so sync reads during a transition-delay report the
   * old value (CSS's rule) and no frame can flash the target.
   */
  private txnPost(
    txn: TxnCapture,
    group: GroupName,
    slot: number,
    pre: (number | RGBA)[],
  ): void {
    let i = 0;
    let ref: Ref | null = null;

    const record = (
      ch: TxnChannelDesc,
      from: number | RGBA,
      to: number | RGBA,
    ): void => {
      ref ??= this.store.ref(group, slot);

      const key = ch.lane == null ? ch.column : `${ch.column}:${ch.lane}`;
      let entry = txn.entries.get(key);

      if (entry == null) {
        entry = {
          column: ch.column,
          kind: ch.kind,
          lane: ch.lane,
          paint: ch.paint,
          min: ch.min,
          max: ch.max,
          refs: [],
          from: [],
          to: [],
        };
        txn.entries.set(key, entry);
      }

      entry.refs.push(ref);
      entry.from.push(from);
      entry.to.push(to);

      if (ch.kind === 'scalar') {
        this.store.setScalar(ch.column as ColumnId, slot, from as number);
      } else if (ch.kind === 'lane') {
        // the lane restore runs the full cascade (a node.size restore
        // re-anchors the label the apply pass just baked at the target)
        this.store.setLane(
          ch.column as ColumnId,
          slot,
          ch.lane as number,
          from as number,
        );
      } else if (ch.kind === 'fontSize') {
        this.store.setLabelFontSize(
          slot,
          ch.column === TWEEN_COL.NODE_FONT_SIZE ? GROUP_NODES : GROUP_EDGES,
          from as number,
        );
      } else {
        const [r, g, b, a] = from as RGBA;

        this.store.setColor(ch.column as ColumnId, slot, r, g, b, a);
      }
    };

    const eq = (
      ch: TxnChannelDesc,
      a: number | RGBA,
      b: number | RGBA,
    ): boolean =>
      ch.kind === 'color'
        ? rgbaEq(a as RGBA, b as RGBA)
        : (a as number) === (b as number);

    // a compound parent's size is auto-bounds-derived: its lanes never
    // record (the tween would fight the derivation — round 25.3)
    const isParentSlot =
      group === GROUP_NODES &&
      this.store.hasCompounds() &&
      this.store.hasFlag(GROUP_NODES, slot, FLAG_PARENT);

    for (const { main, rides } of txn.channels) {
      const from = pre[i++];
      const to = this.readTxnValue(main, slot);
      const skip =
        (isParentSlot && main.column === COL.NODE_SIZE) ||
        // a fontSize sentinel on either side means no sidecar entry to
        // tween from/to — the label change snaps (25.5)
        (main.kind === 'fontSize' &&
          ((from as number) < 0 || (to as number) < 0));
      const changed = !skip && !eq(main, from, to);

      if (changed) {
        record(main, from, to);
      }

      for (const r of rides) {
        const rideFrom = pre[i++];

        if (!changed) {
          continue;
        } // rides move only with their main channel

        const rideTo = this.readTxnValue(r, slot);

        if (!eq(r, rideFrom, rideTo)) {
          record(r, rideFrom, rideTo);
        }
      }
    }
  }

  private wasStyled(group: GroupName, slot: number): boolean {
    const arr = this.styledGen[group];

    return (
      slot < arr.length && arr[slot] === this.store.table(group).gen[slot] + 1
    );
  }

  private markStyled(group: GroupName, slot: number): void {
    let arr = this.styledGen[group];

    if (slot >= arr.length) {
      const next = new Uint32Array(Math.max(16, arr.length * 2, slot + 1));

      next.set(arr);
      arr = next;
      this.styledGen[group] = arr;
    }

    arr[slot] = this.store.table(group).gen[slot] + 1;
  }

  /** Slot compaction: live elements moved (and took fresh generations) —
   * refresh the styled marks over the live slots, all of which have been
   * styled (style applies on add, and compaction never runs mid-batch).
   * @internal */
  onCompacted(): void {
    for (const group of [GROUP_NODES, GROUP_EDGES] as const) {
      const table = this.store.table(group);
      const arr = this.styledGen[group];

      arr.fill(0);

      for (const slot of this.store.slotsOrdered(group)) {
        if (slot < arr.length) {
          arr[slot] = table.gen[slot] + 1;
        }
      }
    }
  }

  /** The group def resolving one element: the parents overlay for parent
   * nodes (round 14.6), else the element's own group. */
  private defFor(ref: Ref): GroupDef {
    if (
      ref.group === GROUP_NODES &&
      this.store.hasCompounds() &&
      this.store.hasFlag(GROUP_NODES, ref.slot, FLAG_PARENT)
    ) {
      return this.defs.parents;
    }

    return this.defs[ref.group];
  }

  /** All live slots the given def styles (partitioned under compounds). */
  private allSlotsFor(group: GroupName, def: GroupDef): number[] {
    const all = this.store.slotsOrdered(group);

    if (group !== GROUP_NODES || !this.store.hasCompounds()) {
      return all;
    }

    const wantParents = def === this.defs.parents;
    const flags = this.store.column(COL.NODE_FLAGS) as Uint32Array;

    return all.filter(
      (slot) => ((flags[slot] & FLAG_PARENT) !== 0) === wantParents,
    );
  }

  /**
   * Scratch-evaluate every mapped channel and write whole elements — the
   * per-channel write would break the cross-channel couplings that live
   * in write() (circle collapse, arrow-alpha folding, the label anchor).
   * Live auto-domain extents re-check here; a changed extent escalates
   * the pass to the whole group (every slot's mapping moved).
   */
  private applyMapped(
    group: GroupName,
    def: GroupDef,
    slots: ArrayLike<number>,
    skipOwned: boolean = false,
  ): void {
    const store = this.store;

    if (this.demoted[group]) {
      // formerly kernel-owned bytes are stale everywhere: one full CPU
      // pass re-derives them; ownership stays clear until the runtime
      // re-configures against the mixed column
      this.demoted[group] = false;
      this.gpuOwnedProps[group] = new Set();
      slots = this.allSlotsFor(group, def);
      skipOwned = false;
    }

    if (def.partition != null) {
      this.applyPartitioned(group, def, slots);

      return;
    }

    const target = this.checkAutoExtents(group, def)
      ? this.allSlotsFor(group, def)
      : slots;

    // one scratch record: every evaluated channel is reassigned per slot
    // and the rest keep the constant base.  GPU-owned channels skip CPU
    // evaluation on data-write refreshes (the kernel re-derives them);
    // their stored bytes go stale, which the getters compensate for.
    const owned = this.gpuOwnedProps[group];
    const active = skipOwned
      ? def.mappers.filter((bm) => !owned.has(bm.m.prop))
      : def.mappers;
    const scratch: Computed = { ...def.computed };
    const bind = (bm: BoundMapper): Evaluator => ({
      set: bm.channel.set,
      ev: bindEvaluator(
        bm.m,
        store.data,
        group,
        bm.channel.default(group),
        this.readValue,
      ),
    });

    // Round 66.1: the state-only `case` mappers still hoist, even though
    // a data mapper in the same group denied the whole def the round-57.1
    // partition.  Their value is a function of `flags & mask` alone, so
    // re-running them only when that word changes is the same work the
    // partition does — and at rest the word never changes at all, so a
    // sheet's selection affordances cost one evaluation for the group
    // rather than one per element.  `partitionOf`'s comment used to say
    // there was nothing to win here; measured on the 465k-edge harness
    // fixture, two `{ selected: true }` opacity clauses were ~50 ms.
    const stateMask = active.reduce((m, bm) => m | stateOnlyMask(bm), 0);
    const stateEvals: Evaluator[] = [];
    const evals: Evaluator[] = [];

    for (const bm of active) {
      (stateOnlyMask(bm) !== 0 ? stateEvals : evals).push(bind(bm));
    }

    const flagsCol =
      stateEvals.length > 0
        ? (store.column(
            group === GROUP_NODES ? COL.NODE_FLAGS : COL.EDGE_FLAGS,
          ) as Uint32Array)
        : null;
    let lastWord = -1;

    // round 67.2: a contiguous run of edges whose per-element variation
    // is confined to props with narrow writers takes the whole styled
    // record from one template slot
    if (this.bulkEdgeRun(group, target)) {
      const uniform =
        flagsCol == null || this.uniformMaskedWord(target, flagsCol, stateMask);
      const writers = this.bulkEdgeWriters(group, active, uniform);

      if (writers != null) {
        // a uniform run needs no word watch in the loop: every state
        // mapper's value is the template's, and `bulkEdgeWriters` has
        // already dropped their writers
        this.applyBulkEdges(
          target,
          scratch,
          evals,
          stateEvals,
          writers,
          uniform ? null : flagsCol,
          stateMask,
        );

        return;
      }
    }

    for (let i = 0; i < target.length; i++) {
      const slot = target[i];

      if (flagsCol != null) {
        const word = flagsCol[slot] & stateMask;

        if (word !== lastWord) {
          lastWord = word;

          for (let j = 0; j < stateEvals.length; j++) {
            stateEvals[j].set(scratch, stateEvals[j].ev(slot));
          }
        }
      }

      for (let j = 0; j < evals.length; j++) {
        evals[j].set(scratch, evals[j].ev(slot));
      }

      this.write(group, slot, scratch);
    }
  }

  /**
   * The structural half of the bulk-edge gate (round 67.2): whether this
   * run *could* be written from one template slot and filled.
   *
   * Nodes decline outright — their branch hands out per-slot blob
   * records (custom polygons, images, charts) whose refs a copy would
   * alias.  The rest is what the fill needs: enough slots to pay for the
   * scans, one contiguous ascending range so each column is a single
   * `copyWithin` chain, no open transition capture (which diffs per
   * slot) and no per-element bypasses.
   *
   * `bulkEdgeWriters` carries the other half — what the *mappers* allow.
   *
   * @param group — the group being applied
   * @param slots — the run, in apply order
   * @returns whether the structural preconditions hold
   */
  private bulkEdgeRun(group: GroupName, slots: ArrayLike<number>): boolean {
    if (
      group !== GROUP_EDGES ||
      slots.length < BULK_MIN_RUN ||
      this.txn != null || // a transition capture diffs per slot
      this.bypassRaw.size > 0 // a bypassed slot is not the template's
    ) {
      return false;
    }

    // contiguous and ascending, so the fill is one memmove per column
    const first = slots[0];

    for (let i = 1; i < slots.length; i++) {
      if (slots[i] !== first + i) {
        return false;
      }
    }

    return true;
  }

  /** Whether every slot in the run carries the same masked flag word —
   * i.e. whether anything reading state alone can vary across it.  True
   * at rest, which is what a freshly loaded graph is. */
  private uniformMaskedWord(
    slots: ArrayLike<number>,
    flags: Uint32Array,
    mask: number,
  ): boolean {
    const word = flags[slots[0]] & mask;

    for (let i = 1; i < slots.length; i++) {
      if ((flags[slots[i]] & mask) !== word) {
        return false;
      }
    }

    return true;
  }

  /**
   * The narrow writers a bulk edge run needs, or null when the run's
   * mappers rule the route out (round 67.2).  `bulkEdgeRun` carries the
   * structural half of the gate.
   *
   * The route writes one template slot and fills every
   * `EDGE_STYLE_COLUMNS` column from it, so it is admissible exactly
   * when each mapped prop either
   *
   *   1. has a `fastStateWriter` — which by round 61's invariant writes
   *      *every* column that prop affects, so the fill's value for it is
   *      overwritten per slot; or
   *   2. reads state flags only, over a run whose masked flag word never
   *      changes — then its value is the template's for every slot and
   *      the fill is already right.  This is the clause that matters in
   *      practice: a freshly loaded graph has nothing selected, so the
   *      selection affordances this repo's sheets map (`line-opacity`,
   *      which has no narrow writer and could not have one without the
   *      whole B1 fold cluster) cost the route nothing.
   *
   * Anything else declines and the ordinary per-element loop runs.
   *
   * @param group — the group being applied
   * @param active — the mappers this pass will evaluate
   * @param uniformState — whether the run's masked flag word is constant
   * @returns the writers to run per slot, or null to decline
   */
  private bulkEdgeWriters(
    group: GroupName,
    active: BoundMapper[],
    uniformState: boolean,
  ): StateWriter[] | null {
    const writers: StateWriter[] = [];

    for (const bm of active) {
      // A state-only mapper over a uniform run never leaves the
      // template's value, so the fill already carries it and there is
      // nothing to write — whether or not the prop has a narrow writer.
      // This clause is checked *first* deliberately: it is what keeps
      // the selection affordances off the per-slot loop, and they are
      // most of the mappers on an ordinary sheet.  Ordering it after the
      // writer lookup cost 143 ms of a 498 ms apply on the 464,657-edge
      // fixture, running eight writers per edge to rewrite bytes the
      // fill had already put there.
      if (stateOnlyMask(bm) !== 0 && uniformState) {
        continue;
      }

      const writer = this.fastStateWriter(group, bm.m.prop);

      if (writer == null) {
        return null;
      }

      writers.push(writer);
    }

    return writers;
  }

  /**
   * Apply a contiguous edge run from one template slot (round 67.2).
   *
   * The template takes the ordinary `write()`, so every side effect the
   * edge branch has — the arrow-scale and arrow-width meters, the curve
   * record, the label sidecar, the transition-free channel funnel —
   * happens exactly as it always did.  `replicateEdgeStyle` then fills
   * every style-owned column from it, and each remaining slot pays only
   * its own mapped props (through the narrow writers) plus the per-slot
   * half of the edge branch.
   *
   * Measured on a 464,657-edge fixture: 26 ns per `setScalar` against
   * 0.1 ns per element for the fill.
   */
  private applyBulkEdges(
    slots: ArrayLike<number>,
    scratch: Computed,
    evals: Evaluator[],
    stateEvals: Evaluator[],
    writers: StateWriter[],
    flagsCol: Uint32Array | null = null,
    stateMask = 0,
  ): void {
    this._bulkRuns++;

    const first = slots[0];
    const n = slots.length;

    for (let j = 0; j < stateEvals.length; j++) {
      stateEvals[j].set(scratch, stateEvals[j].ev(first));
    }
    for (let j = 0; j < evals.length; j++) {
      evals[j].set(scratch, evals[j].ev(first));
    }

    this.write(GROUP_EDGES, first, scratch);
    this.store.replicateEdgeStyle(first, n);

    // A state-only mapper reaches the loop only when the run's word is
    // *not* uniform — `bulkEdgeWriters` drops the uniform ones — and its
    // value then has to be re-evaluated on a word change like round
    // 66.1's hoist, or every slot is written the template's.  Skipping
    // this re-evaluation is not caught by a graph loaded at rest: it
    // needs a data mapper (so the def has no partition) beside a state
    // mapper that *has* a narrow writer, over a mixed selection.  That
    // is what the spec named for it builds.
    let lastWord = flagsCol == null ? 0 : flagsCol[first] & stateMask;

    for (let i = 1; i < n; i++) {
      const slot = slots[i];

      if (flagsCol != null && stateEvals.length > 0) {
        const word = flagsCol[slot] & stateMask;

        if (word !== lastWord) {
          lastWord = word;

          for (let j = 0; j < stateEvals.length; j++) {
            stateEvals[j].set(scratch, stateEvals[j].ev(slot));
          }
        }
      }

      for (let j = 0; j < evals.length; j++) {
        evals[j].set(scratch, evals[j].ev(slot));
      }
      for (let j = 0; j < writers.length; j++) {
        writers[j](slot, scratch);
      }

      this.writeEdgePerSlot(slot, scratch);
      this.markStyled(GROUP_EDGES, slot);
    }
  }

  /**
   * Apply a group whose mappers read only state flags: one record per
   * distinct flag combination, cached on the def, instead of a program
   * run per element.
   *
   * The cache is unbounded in principle and tiny in practice — its size
   * is 2^(number of distinct bits the sheet's conditions read), and a
   * sheet reads one or two.  It lives on the def, so a sheet swap
   * discards it with the def that built it.
   */
  private applyPartitioned(
    group: GroupName,
    def: GroupDef,
    slots: ArrayLike<number>,
  ): void {
    const part = def.partition as NonNullable<GroupDef['partition']>;
    const flags = this.store.column(
      group === GROUP_NODES ? COL.NODE_FLAGS : COL.EDGE_FLAGS,
    ) as Uint32Array;

    // round 67.2: at rest every slot carries the same masked word — a
    // freshly loaded graph has nothing selected — so the whole run
    // resolves to one record and takes the bulk route with no writers
    if (
      this.bulkEdgeRun(group, slots) &&
      this.uniformMaskedWord(slots, flags, part.mask)
    ) {
      this.applyBulkEdges(
        slots,
        this.partRecordFor(group, def, part, flags[slots[0]] & part.mask),
        [],
        [],
        [],
      );

      return;
    }

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];

      this.write(
        group,
        slot,
        this.partRecordFor(group, def, part, flags[slot] & part.mask),
      );
    }
  }

  /** The partition record for one masked flag word — cached on the def,
   * resolved on the first miss (round 57.1). */
  private partRecordFor(
    group: GroupName,
    def: GroupDef,
    part: NonNullable<GroupDef['partition']>,
    word: number,
  ): Computed {
    let record = part.records.get(word);

    if (record === undefined) {
      record = this.partitionRecord(group, def, word);
      part.records.set(word, record);
    }

    return record;
  }

  /** Resolve one flag combination into a computed record (cache miss). */
  private partitionRecord(
    group: GroupName,
    def: GroupDef,
    word: number,
  ): Computed {
    // the conditions are answered from `word` rather than from a slot,
    // which is the whole point: the record is the same for every element
    // carrying these bits
    const read: ValueReader = (_group, _slot, key) =>
      (word & (CONDITION_FLAGS[key] ?? 0)) !== 0;
    const record: Computed = { ...def.computed };

    for (const bm of def.mappers) {
      bm.channel.set(
        record,
        bindEvaluator(
          bm.m,
          this.store.data,
          group,
          bm.channel.default(group),
          read,
        )(0),
      );
    }

    return record;
  }

  /**
   * Re-check live auto-domain extents against the data; returns true when
   * any moved (the caller escalates to the whole group).  A moved extent
   * on a GPU-owned program also bumps paintVersion so the runtime repacks
   * its program uniform and re-evaluates in full.
   */
  private checkAutoExtents(group: GroupName, def: GroupDef): boolean {
    let moved = false;

    for (const bm of def.mappers) {
      const program = bm.m.program;

      if (
        (program.kind === 'continuous' || program.kind === 'discrete') &&
        program.autoDomain
      ) {
        if (
          applyAutoExtent(
            program,
            ...autoExtentFor(bm.m, this.store.data, group),
          )
        ) {
          moved = true;

          if (this.gpuOwnedProps[group].has(bm.m.prop)) {
            this.paintVersion++;
          }
        }
      }
    }

    return moved;
  }

  /**
   * Resolve and write one element's channels.
   *
   * @param ref — the element to style; a stale ref is a no-op
   * @internal
   */
  apply(ref: Ref): void {
    if (!this.store.isCurrent(ref)) {
      return;
    }

    this.applyBulk(ref.group, [ref.slot]);
  }

  /**
   * The data-write refresh: re-derive the mapped channels of the written
   * slots, gated per group on the written keys.  A label-only dependency
   * pays just the label text recompute (setLabel no-ops when the entry is
   * unchanged); mapped channels re-evaluate through the whole-element
   * scratch pass, which also escalates to the full group when a live
   * auto-domain extent moved.
   *
   * @param group — the element group that was written
   * @param slots — the written slots
   * @param keys — the data() keys written, which gate what re-evaluates
   * @internal
   */
  refreshMapped(
    group: GroupName,
    slots: ArrayLike<number>,
    keys: string[],
  ): void {
    if (group === GROUP_NODES && this.store.hasCompounds()) {
      const flags = this.store.column(COL.NODE_FLAGS) as Uint32Array;
      const leaves: number[] = [];
      const parents: number[] = [];

      for (let i = 0; i < slots.length; i++) {
        ((flags[slots[i]] & FLAG_PARENT) !== 0 ? parents : leaves).push(
          slots[i],
        );
      }

      if (leaves.length > 0) {
        this.refreshGroupDef(GROUP_NODES, this.defs.nodes, leaves, keys);
      }
      if (parents.length > 0) {
        this.refreshGroupDef(GROUP_NODES, this.defs.parents, parents, keys);
      }

      return;
    }

    this.refreshGroupDef(group, this.defs[group], slots, keys);
  }

  /**
   * The state-flip refresh (round 61) — `core.onStateChange`'s entry,
   * replacing the `refreshMapped` route that made every select restyle
   * whole elements (the 60.4 regression).  A flipped bit is the one
   * event whose styling consequence is knowable up front: for a
   * partitioned def the old masked word is the new word with `key`'s bit
   * flipped back, both records are cached, and the channels that differ
   * between them — one on a default-sheet node, five on a default-sheet
   * edge — are written narrowly instead of through the ~25-call full
   * `write()`.
   *
   * The general path is kept wherever it is the correct one: an
   * unpartitioned def (a data mapper puts the group per-element anyway),
   * a live transition spec (the txn capture is the general path's), a
   * demoted group, and the structural pseudo-keys (a parent flip changes
   * *which def* resolves the slot — the reparent hooks own that).  A
   * diff containing any channel without a narrow writer falls back to
   * the full `write()` of the target record per slot, byte-for-byte the
   * old behaviour.
   *
   * @param group — the element group whose flag flipped
   * @param key — the reserved condition key ('::selected', '::active', …)
   * @param slots — the slots whose bit actually changed
   * @internal
   */
  refreshState(group: GroupName, key: string, slots: ArrayLike<number>): void {
    // the structural pair changes def resolution, not just values
    if (key === '::parent' || key === '::child') {
      this.refreshMapped(group, slots as number[], [key]);

      return;
    }

    if (group === GROUP_NODES && this.store.hasCompounds()) {
      const flags = this.store.column(COL.NODE_FLAGS) as Uint32Array;
      const leaves: number[] = [];
      const parents: number[] = [];

      for (let i = 0; i < slots.length; i++) {
        ((flags[slots[i]] & FLAG_PARENT) !== 0 ? parents : leaves).push(
          slots[i],
        );
      }

      this.refreshStateDef(GROUP_NODES, this.defs.nodes, leaves, key);
      this.refreshStateDef(GROUP_NODES, this.defs.parents, parents, key);

      return;
    }

    this.refreshStateDef(group, this.defs[group], slots, key);
  }

  /** One def's share of a state flip: the fast diff path, or the
   * general `refreshGroupDef` wherever that one is correct (see
   * `refreshState`). */
  private refreshStateDef(
    group: GroupName,
    def: GroupDef,
    slots: ArrayLike<number>,
    key: string,
  ): void {
    if (slots.length === 0) {
      return;
    }

    const part = def.partition;
    const spec = def.transition;
    const transitionsLive =
      this.transitionSink != null && spec.duration > 0 && spec.props.length > 0;

    if (part == null || this.demoted[group] || transitionsLive) {
      this.refreshGroupDef(group, def, slots, [key]);

      return;
    }

    const bit = CONDITION_FLAGS[key] ?? 0;

    if ((part.mask & bit) === 0) {
      // the bit is watched for the *group* (the store's set folds the
      // parents def into nodes'), not necessarily read by this def —
      // an empty diff by construction, so the slots are skipped
      return;
    }

    const flags = this.store.column(
      group === GROUP_NODES ? COL.NODE_FLAGS : COL.EDGE_FLAGS,
    ) as Uint32Array;
    // a bulk flip's slots almost always share one masked word (nothing
    // else is usually pressed or hovered mid-select), so the record and
    // diff resolve once per run of equal words, not per slot
    let last = -1;
    let record: Computed | null = null;
    let writers: StateWriter[] | null = null;
    const bypassed = this.bypassRaw.size > 0;

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const to = flags[slot] & part.mask;

      if (to !== last) {
        last = to;
        record = this.partRecordFor(group, def, part, to);
        writers = this.partitionDiffWriters(group, def, part, to ^ bit, to);
      }

      // round 63.3: a bypassed slot takes the merged full write — the
      // narrow diff writers would stomp a bypassed channel with the
      // partition record's value.  O(bypassed); the run optimization
      // and the diff path are untouched for everything else.
      if (bypassed && this.bypassPatchAt(group, slot) != null) {
        this.write(group, slot, record as Computed);
        continue;
      }

      if (writers == null) {
        this.write(group, slot, record as Computed);
      } else {
        for (let j = 0; j < writers.length; j++) {
          writers[j](slot, record as Computed);
        }
      }
    }
  }

  /**
   * The writers for the channels that differ between two partition
   * records — cached per unordered pair of masked flag words (the
   * changed set is symmetric; which record to write is the caller's).
   * Null when some differing channel has no narrow writer: that pair
   * takes the full `write()`.
   */
  private partitionDiffWriters(
    group: GroupName,
    def: GroupDef,
    part: NonNullable<GroupDef['partition']>,
    from: number,
    to: number,
  ): StateWriter[] | null {
    const cacheKey = from <= to ? `${from}:${to}` : `${to}:${from}`;
    let writers = part.diffs.get(cacheKey);

    if (writers !== undefined) {
      return writers;
    }

    // the partitionRecord reader, per word: a condition is answered from
    // the word rather than from a slot, which is what makes the diff a
    // property of the pair
    const readerFor =
      (word: number): ValueReader =>
      (_group, _slot, condKey) =>
        (word & (CONDITION_FLAGS[condKey] ?? 0)) !== 0;
    const readFrom = readerFor(from);
    const readTo = readerFor(to);

    writers = [];

    for (const bm of def.mappers) {
      const fallback = bm.channel.default(group);
      const a = bindEvaluator(
        bm.m,
        this.store.data,
        group,
        fallback,
        readFrom,
      )(0);
      const b = bindEvaluator(
        bm.m,
        this.store.data,
        group,
        fallback,
        readTo,
      )(0);

      if (evaluatedEq(a, b)) {
        continue;
      }

      const writer = this.fastStateWriter(group, bm.m.prop);

      if (writer == null) {
        writers = null;

        break;
      }

      writers.push(writer);
    }

    part.diffs.set(cacheKey, writers);

    return writers;
  }

  private refreshGroupDef(
    group: GroupName,
    def: GroupDef,
    slots: ArrayLike<number>,
    keys: string[],
  ): void {
    if (slots.length === 0 || def.deps == null) {
      return;
    }

    const txn = this.openTxn(group, def);

    try {
      this.refreshGroupDefInner(group, def, slots, keys);
    } finally {
      this.closeTxn(txn);
    }
  }

  private refreshGroupDefInner(
    group: GroupName,
    def: GroupDef,
    slots: ArrayLike<number>,
    keys: string[],
  ): void {
    if (def.deps == null) {
      return;
    } // narrowed by the caller; re-checked for the types

    let label = false;
    let mapped = false;
    let chart = false;

    for (const key of keys) {
      const entry = def.deps.get(key);

      if (entry == null) {
        continue;
      }

      label = label || entry.label;
      mapped = mapped || entry.mappers;
      chart = chart || entry.chart;
    }

    const narrow = (): void => {
      // the label/chart-only fast paths
      if (label) {
        for (let i = 0; i < slots.length; i++) {
          this.writeLabel(slots[i], def.computed, group);
        }
      }

      if (chart) {
        for (let i = 0; i < slots.length; i++) {
          this.writeChart(slots[i], def.computed);
        }
      }
    };

    // a chart refresh under mapped channels must re-evaluate per slot
    // (the narrow path writes def.computed — the constants record —
    // which is wrong whenever `chart`/size/etc. are themselves mapped)
    if (mapped || (chart && def.mappers.length > 0)) {
      const owned = this.gpuOwnedProps[group];
      // *these* keys' mappers, not every mapper the group has.  A CPU
      // mapper on some other key cannot be stale here, and treating it
      // as though it were forces the whole-element `applyMapped` — which
      // rewrites the kernel-owned channels too, stomping them back to
      // their constants.  Round 57.1 surfaced it (every graph's default
      // `background-color` became a CPU `case`, so the fast path was
      // dead for all of them), but the bug is older than the round: a
      // chart or label mapper had the same effect.
      const affected = def.mappers.filter((bm) =>
        bm.m.keys.some((k) => keys.includes(k)),
      );

      if (
        chart ||
        this.demoted[group] ||
        affected.some((bm) => !owned.has(bm.m.prop))
      ) {
        this.applyMapped(group, def, slots, true);
      } else {
        // every mapped channel is GPU-owned: no CPU restyle at all — the
        // data-write spans drive the kernel; only the extents need a look
        this.checkAutoExtents(group, def);
        narrow();
      }
    } else {
      narrow();
    }
  }

  // -- read-back (the collection's read-only style getters) --

  /*
  Style reads report the *stored* channels — the resolved values the
  renderer draws from — not the sheet's declarations.  Consequences: an
  equal-radii 'circle'/'ellipse' reads back as 'ellipse'; arrow getters
  derive from the stored arrow color (whose alpha folds in edge opacity),
  so a fully transparent arrow reads as shape 'none' and color
  rgba(...,0); label channels ('font-size', 'color') come from the label
  sidecar when the node is labelled, else they resolve through the sheet
  (evaluating a fn sheet for that element).
  */

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
  readProp(ref: Ref, propRaw: string): string | number | undefined {
    // The per-raw-name read plan (round 62.4): one Map hit replaces the
    // normalize memo, four set membership tests and — on every edge
    // read — a per-call regex.  Everything cached here is immortal per
    // engine: name normalization, group membership, the transition and
    // arrow-fold classifications and the reader all come from module
    // tables a sheet swap never changes.
    let plan = this.readPlans.get(propRaw);

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
      this.readPlans.set(propRaw, plan);
    }

    if (!(ref.group === GROUP_NODES ? plan.node : plan.edge)) {
      return undefined;
    }

    const prop = plan.prop;

    // transition config (round 24.1): answered from the group's spec
    // (the parents overlay for parent nodes, like every channel read)
    if (plan.transition) {
      const spec = this.defFor(ref).transition;

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
    const owned = this.gpuOwnedProps[ref.group];

    if (ref.group === GROUP_EDGES && plan.arrowColorProp != null) {
      const colorProp = plan.arrowColorProp;

      if (owned.has(colorProp) || owned.has(PROP.OPACITY)) {
        const [r, g, b, a] = this.foldedArrow(ref, colorProp);

        return prop.endsWith('-shape')
          ? a > 0
            ? 'triangle'
            : 'none'
          : formatRgba(r, g, b, a);
      }
    } else if (owned.has(prop)) {
      const def = this.defFor(ref);
      const bm = def.mappers.find((bm) => bm.m.prop === prop);

      if (bm != null) {
        const value = bindEvaluator(
          bm.m,
          this.store.data,
          ref.group,
          bm.channel.default(ref.group),
          this.readValue,
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
      : plan.reader(this.store, ref.slot, ref, this.readCtx, prop);
  }

  /**
   * All resolved props of a live element's group.
   *
   * @param ref — the element to read
   * @returns every readable prop of its group, by name
   * @internal
   */
  readProps(ref: Ref): Record<string, string | number> {
    const props = ref.group === GROUP_NODES ? NODE_READ : EDGE_READ;
    const out: Record<string, string | number> = {};

    for (const prop of props) {
      out[prop] = this.readProp(ref, prop) as string | number;
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
  lineOpacityConst(): number {
    return (this.defs.edges.computed as Computed).lineOpacity;
  }

  /** The sheet's arrow-width modes (constants-only props) — an
   * edge-width tween needs these to carry the style-write-resolved
   * `edge.arrowWidths` along (round 25.2): 'match-line' and percent
   * forms baked the width, plain numbers did not.
   * @internal */
  arrowWidthModes(): {
    source: number | 'match-line' | { percent: number };
    target: number | 'match-line' | { percent: number };
  } {
    const computed = this.defs.edges.computed as Computed;

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
  arrowBase(ref: Ref, colorProp: string): RGBA {
    const def = this.defs.edges;
    const computed = def.computed as Computed;
    const source = colorProp.startsWith('source');
    const shape = source
      ? computed.sourceArrowShape
      : computed.targetArrowShape;

    if (shape !== 'triangle') {
      return NO_ARROW;
    }

    return this.evalEdgeProp(
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
  private foldedArrow(ref: Ref, colorProp: string): RGBA {
    const [r, g, b, a] = this.arrowBase(ref, colorProp);
    const computed = this.defs.edges.computed as Computed;
    const opacity = this.evalEdgeProp(
      ref,
      PROP.OPACITY,
      computed.opacity,
    ) as number;

    // B1: line-opacity folds into the arrow alpha too (constant here —
    // a mapped line-opacity demotes edge paint off the kernel)
    return [r, g, b, Math.round(a * opacity * computed.lineOpacity)];
  }

  /** One edge prop for a slot: the mapper's value when mapped, else the constant. */
  private evalEdgeProp(
    ref: Ref,
    prop: string,
    constant: number | RGBA,
  ): number | RGBA {
    const bm = this.defs.edges.mappers.find((bm) => bm.m.prop === prop);

    return bm == null
      ? constant
      : bindEvaluator(
          bm.m,
          this.store.data,
          GROUP_EDGES,
          bm.channel.default(GROUP_EDGES),
          this.readValue,
        )(ref.slot);
  }

  /** Resolved label channels: the sidecar when labelled, else the sheet. */
  private labelChannels(ref: Ref): { fontSize: number; color: string } {
    const entry = this.store.labelAt(ref.slot, ref.group);

    if (entry != null) {
      const packed = unfoldLabelAlpha(this.store, ref.slot, ref, entry.color);

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

    const def = this.defFor(ref);
    let computed: Computed;

    if (def.mappers.length > 0) {
      // an unlabelled element still reads mapped font-size/color truthfully
      const scratch: Computed = { ...def.computed };

      for (const bm of def.mappers) {
        bm.channel.set(
          scratch,
          bindEvaluator(
            bm.m,
            this.store.data,
            ref.group,
            bm.channel.default(ref.group),
            this.readValue,
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
  private resolveConst(
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
  private readImageProp(slot: number, prop: string): string | number {
    const recs = this.store.nodeImagesAt(slot);

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
    const per = (
      f: (r: NodeImageRecord) => string | number,
    ): string | number => {
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
          this.store.images.get(recs[0].entryId)?.crossOrigin ?? 'anonymous'
        );
      case PROP.BACKGROUND_IMAGE_TYPE:
        return per((r) => IMAGE_TYPE_NAMES[r.sdf ? 1 : 0]);
      default: {
        const [r, g, b, a] = recs[0].tint;

        return formatRgba(r, g, b, a);
      }
    }
  }

  // -- the shared channel writers (round 61) --
  //
  // Single-store-call paint writes factored out of writeChannels so the
  // state-refresh fast path can perform exactly one channel's write with
  // exactly the fold math the full pass uses — one definition, two
  // callers, the dual-consumers discipline.  Everything with a
  // cross-channel coupling (the circle collapse, geometry's cull/pick/
  // label-anchor cascade, the edge-opacity arrow fold cluster) stays
  // inline in writeChannels, which is what confines the fast path to
  // the channels listed in fastStateWriter.

  /** Write `node.fillColor` (the B1 background-opacity fold). */
  private writeNodeFillColor(slot: number, computed: Computed): void {
    this.store.setColor(
      COL.NODE_FILL_COLOR,
      slot,
      ...foldRgba(computed.fillColor, computed.backgroundOpacity),
    );
  }

  /** Write `node.borderColor` (the B1 border-opacity fold). */
  private writeNodeBorderColor(slot: number, computed: Computed): void {
    this.store.setColor(
      COL.NODE_BORDER_COLOR,
      slot,
      ...foldRgba(computed.borderColor, computed.borderOpacity),
    );
  }

  /** Write `node.opacity` — under compounds the store folds the
   * ancestor product itself (round 14.4), so one call is complete. */
  private writeNodeOpacity(slot: number, computed: Computed): void {
    this.store.setScalar(COL.NODE_OPACITY, slot, computed.opacity);
  }

  /** Write the `node.overlay` layer record (the A2 opacity fold). */
  private writeNodeOverlay(slot: number, computed: Computed): void {
    this.store.setNodeLayer(
      COL.NODE_OVERLAY,
      slot,
      foldLayerRgba(computed.overlayColor, computed.overlayOpacity),
      computed.overlayPadding,
      computed.overlayShape,
      computed.overlayRadius,
    );
  }

  /** Write the `node.underlay` layer record (the A2 opacity fold). */
  private writeNodeUnderlay(slot: number, computed: Computed): void {
    this.store.setNodeLayer(
      COL.NODE_UNDERLAY,
      slot,
      foldLayerRgba(computed.underlayColor, computed.underlayOpacity),
      computed.underlayPadding,
      computed.underlayShape,
      computed.underlayRadius,
    );
  }

  /** Write `edge.lineColor` (the B1 line-opacity fold). */
  private writeEdgeLineColor(slot: number, computed: Computed): void {
    this.store.setColor(
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
  private edgeArrowRgba(
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
  private writeEdgeSourceArrowColor(slot: number, computed: Computed): void {
    this.store.setColor(
      COL.EDGE_SOURCE_ARROW,
      slot,
      ...this.edgeArrowRgba(
        computed,
        computed.sourceArrowShape,
        computed.sourceArrowColor,
      ),
    );
  }

  /** Write `edge.targetArrow` (see the source twin). */
  private writeEdgeTargetArrowColor(slot: number, computed: Computed): void {
    this.store.setColor(
      COL.EDGE_TARGET_ARROW,
      slot,
      ...this.edgeArrowRgba(
        computed,
        computed.targetArrowShape,
        computed.targetArrowColor,
      ),
    );
  }

  /** Write `edge.midSourceArrow` — `setMidArrow` maintains the live
   * mid-arrow count, so one call is complete. */
  private writeEdgeMidSourceArrowColor(slot: number, computed: Computed): void {
    this.store.setMidArrow(
      COL.EDGE_MID_SOURCE_ARROW,
      slot,
      ...this.edgeArrowRgba(
        computed,
        computed.midSourceArrowShape,
        computed.midSourceArrowColor,
      ),
      COL.EDGE_MID_TARGET_ARROW,
    );
  }

  /** Write `edge.midTargetArrow` (see the source twin). */
  private writeEdgeMidTargetArrowColor(slot: number, computed: Computed): void {
    this.store.setMidArrow(
      COL.EDGE_MID_TARGET_ARROW,
      slot,
      ...this.edgeArrowRgba(
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
  private writeEdgeOverlay(slot: number, computed: Computed): void {
    this.store.setEdgeLayer(
      COL.EDGE_OVERLAY,
      slot,
      foldLayerRgba(computed.overlayColor, computed.overlayOpacity),
      computed.width + 2 * computed.overlayPadding,
    );
  }

  /** Write the `edge.underlay` stroke record (see the overlay twin). */
  private writeEdgeUnderlay(slot: number, computed: Computed): void {
    this.store.setEdgeLayer(
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
  private fastStateWriter(group: GroupName, prop: string): StateWriter | null {
    if (group === GROUP_NODES) {
      switch (prop) {
        case PROP.BACKGROUND_COLOR:
          return (slot, c) => this.writeNodeFillColor(slot, c);
        case PROP.BORDER_COLOR:
          return (slot, c) => this.writeNodeBorderColor(slot, c);
        case PROP.OPACITY:
          return (slot, c) => this.writeNodeOpacity(slot, c);
        case PROP.OVERLAY_COLOR:
        case PROP.OVERLAY_OPACITY:
        case PROP.OVERLAY_PADDING:
          return (slot, c) => this.writeNodeOverlay(slot, c);
        case PROP.UNDERLAY_COLOR:
        case PROP.UNDERLAY_OPACITY:
        case PROP.UNDERLAY_PADDING:
          return (slot, c) => this.writeNodeUnderlay(slot, c);
        default:
          return null;
      }
    }

    switch (prop) {
      case PROP.LINE_COLOR:
        return (slot, c) => this.writeEdgeLineColor(slot, c);
      case PROP.SOURCE_ARROW_COLOR:
        return (slot, c) => this.writeEdgeSourceArrowColor(slot, c);
      case PROP.TARGET_ARROW_COLOR:
        return (slot, c) => this.writeEdgeTargetArrowColor(slot, c);
      case PROP.MID_SOURCE_ARROW_COLOR:
        return (slot, c) => this.writeEdgeMidSourceArrowColor(slot, c);
      case PROP.MID_TARGET_ARROW_COLOR:
        return (slot, c) => this.writeEdgeMidTargetArrowColor(slot, c);
      case PROP.OVERLAY_COLOR:
      case PROP.OVERLAY_OPACITY:
      case PROP.OVERLAY_PADDING:
        return (slot, c) => this.writeEdgeOverlay(slot, c);
      case PROP.UNDERLAY_COLOR:
      case PROP.UNDERLAY_OPACITY:
      case PROP.UNDERLAY_PADDING:
        return (slot, c) => this.writeEdgeUnderlay(slot, c);
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
  private write(group: GroupName, slot: number, computed: Computed): void {
    // round 63.3: a bypassed slot writes the merged record — one gate
    // load for bypass-free instances (the performance contract), and
    // because every restyle path except refreshStateDef's narrow
    // writers funnels through here, correctness is by construction
    if (this.bypassRaw.size > 0) {
      const patch = this.bypassPatchAt(group, slot);

      if (patch != null) {
        computed = this.mergeBypass(computed, patch);
      }
    }

    const txn = this.txn;
    const pre =
      txn != null && this.wasStyled(group, slot)
        ? this.txnPre(txn, slot)
        : null;

    this.writeChannels(group, slot, computed);

    if (txn != null && pre != null) {
      this.txnPost(txn, group, slot, pre);
    }

    this.markStyled(group, slot);
  }

  private writeChannels(
    group: GroupName,
    slot: number,
    computed: Computed,
  ): void {
    const store = this.store;

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
      this.writeNodeFillColor(slot, computed);
      this.writeNodeBorderColor(slot, computed);
      store.setScalar(COL.NODE_BORDER_WIDTH, slot, computed.borderWidth);
      this.writeNodeOpacity(slot, computed);
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

      this.writeNodeOverlay(slot, computed);
      this.writeNodeUnderlay(slot, computed);

      this.writeImages(slot, computed);
      this.writeChart(slot, computed);
      this.writeLabel(slot, computed);
    } else {
      this.writeEdgeColumns(slot, computed);
      this.writeEdgePerSlot(slot, computed);
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
  private writeEdgeColumns(slot: number, computed: Computed): void {
    const store = this.store;

    this.writeEdgeLineColor(slot, computed);
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
    this.writeEdgeSourceArrowColor(slot, computed);
    this.writeEdgeTargetArrowColor(slot, computed);
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
    this.writeEdgeMidSourceArrowColor(slot, computed);
    this.writeEdgeMidTargetArrowColor(slot, computed);

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
    // vertex stage cannot bind this column, so the quad grows by a
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
    this.writeEdgeOverlay(slot, computed);
    this.writeEdgeUnderlay(slot, computed);
  }

  /**
   * The edge work a column copy cannot carry: the two flag bits (the
   * flags word holds per-element bits too), the invisibility cascade,
   * the curve index's own per-slot record, and the label sidecar.  Runs
   * for every slot on both paths.
   */
  private writeEdgePerSlot(slot: number, computed: Computed): void {
    const store = this.store;

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

    this.writeLabel(slot, computed, GROUP_EDGES);
  }

  /** warn-once flag for the multi-image cap (recorded: 4 per node) */
  private warnedImageCap = false;

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
  private writeChart(slot: number, computed: Computed): void {
    const store = this.store;

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
  private writeImages(slot: number, computed: NodeComputed): void {
    let urls = computed.backgroundImage;

    if (urls.length === 0) {
      this.store.setNodeImages(slot, null);

      return;
    }

    if (urls.length > IMAGE_CAP) {
      if (!this.warnedImageCap) {
        this.warnedImageCap = true;
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

    this.store.setNodeImages(slot, specs);
  }

  /** Resolve an element's label text from its computed channels and store it. */
  private writeLabel(
    slot: number,
    computed: NodeComputed | Computed,
    group: GroupName = GROUP_NODES,
  ): void {
    const store = this.store;
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
      outlineColor: fold(
        computed.textOutlineColor,
        computed.textOutlineOpacity,
      ),
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
}
