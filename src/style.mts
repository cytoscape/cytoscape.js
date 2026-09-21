import * as engineApply from './style/engine-apply.mjs';
import * as engineRead from './style/engine-read.mjs';
import * as engineWrite from './style/engine-write.mjs';
import * as engineBypass from './style/engine-bypass.mjs';
import * as engineSheet from './style/engine-sheet.mjs';
import * as engineRefresh from './style/engine-refresh.mjs'; /*
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
  DATA_ID,
  COL,
  CONDITION_FLAGS,
  FLAG_PARENT,
} from './contract.mjs';
import type { CompoundStyle } from './store/hierarchy.mjs';
import type { ChannelWrite } from './animation.mjs';
import type {
  CompiledMapper,
  Evaluated,
  ValueReader,
} from './style-scales.mjs';
import type { GroupName, Ref } from './contract.mjs';
import type { GraphStore } from './store/graph-store.mjs';
import type { Stylesheet } from './public-types.mjs';
import type { RGBA, Computed } from './style/defaults.mjs';
import { CORE_DEFAULTS } from './style/tables.mjs';
import type { CoreStyle } from './style/tables.mjs';
import type { BypassPatch } from './style/apply-prop.mjs';
import type { TxnCapture } from './style/compile.mjs';
import { PARENT_CHANNEL_OVERLAY } from './style/sheet.mjs';
import type { GroupDef } from './style/sheet.mjs';
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
  /** @internal */
  store: GraphStore;
  /**
   * The narrow view of this engine that the module-scope property
   * readers receive (35.2).  Built once here rather than per read, and
   * its getters stay live across a sheet swap that replaces `defs`.
   * @internal
   */
  readonly readCtx: ReadContext;
  /** per-raw-name read plans (round 62.4): normalization, group
   * membership, the transition/arrow classifications and the reader,
   * resolved once per spelling — all from module tables no sheet swap
   * changes, so the cache is immortal per engine
   * @internal */
  readonly readPlans = new Map<
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
  /** @internal */
  sheet: Stylesheet;
  /** @internal */
  defs: { nodes: GroupDef; edges: GroupDef; parents: GroupDef };
  /** the parents-group compound style, applied per parent slot @internal */
  parentCompound: Partial<CompoundStyle> = { padding: 10 };
  /** normalized channel props the parents overlay resolves differently
   * from the nodes group (defaults + the user parents block) — a
   * GPU-mapped nodes channel in this set demotes to the CPU path
   * @internal */
  parentsOverride: ReadonlySet<string> = new Set(
    Object.keys(PARENT_CHANNEL_OVERLAY),
  );

  /** @internal */
  arrows = { source: false, target: false };
  /** @internal */
  midArrows = { source: false, target: false };

  /**
   * Bumps when the paint-mapper state changes (sheet set, or a GPU-owned
   * live auto-domain extent moved) — the renderer's mapper runtime pulls
   * on this to repack its program buffers.
   * @internal
   */
  paintVersion = 0;

  /** props per group the GPU eval kernel currently owns (set by the runtime). @internal */
  gpuOwnedProps: Record<GroupName, ReadonlySet<string>> = {
    nodes: new Set(),
    edges: new Set(),
  };

  /** a mapped key's column promoted to mixed while kernel-owned: re-derive on CPU @internal */
  demoted: Record<GroupName, boolean> = { nodes: false, edges: false };

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

  /** Round 24.1: the open transition capture (one per group-def pass). @internal */
  txn: TxnCapture | null = null;

  // -- per-element bypasses (round 63) --

  /** id → normalized prop → raw value: the live bypass declarations
   * (the `bypasses` sheet section plus the sugar methods' writes),
   * exported by `json()`.  Id-keyed declarations, not element state —
   * an entry survives remove/re-add and may name an id that does not
   * exist yet (inert until it does).
   * @internal */
  bypassRaw = new Map<string, Record<string, unknown>>();

  /** id → per-group parsed patches.  Both groups parse at declaration
   * time (the id may not resolve yet); null marks a group whose guards
   * reject the entry's props (e.g. a curve prop never applies to a
   * node), decided when the id resolves.
   * @internal */
  bypassParsed = new Map<
    string,
    { nodes: BypassPatch | null; edges: BypassPatch | null }
  >();

  /** slot → patch per group, resolved lazily against the store's
   * structure epoch — adds, removes and compaction all bump it, and a
   * re-resolution is O(declared ids), never O(elements).
   * @internal */
  bypassSlots: Record<GroupName, Map<number, BypassPatch>> = {
    nodes: new Map(),
    edges: new Map(),
  };

  /** @internal */
  bypassEpoch = -1;

  /** normalized prop → live declaration count across ids — what
   * `paintInputs` demotes by (a kernel-owned mapper would overwrite a
   * bypassed slot's stored bytes on its next dispatch).
   * @internal */
  bypassPropCounts = new Map<string, number>();

  /** Whether any bypass is declared — the zero-cost gate every touched
   * path checks first (the round-63 performance contract).
   *
   * @returns true when at least one id has a live bypass declaration
   */
  hasBypasses(): boolean {
    return this.bypassRaw.size > 0;
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
    return engineBypass.mergeBypass(this, computed, patch);
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
    engineBypass.setBypass(this, ref, id, props);
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
    engineBypass.removeBypass(this, ref, id, name);
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
   * family since 57.1)
   * @internal */
  readValue: ValueReader = (group, slot, key) => {
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

  /** @internal */
  coreStyle: CoreStyle = { ...CORE_DEFAULTS };

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
    engineSheet.setSheet(this, sheet, apply);
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
    return engineSheet.paintInputs(this, group);
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
    return engineSheet.paintContext(this, group);
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
    return engineRefresh.stylesDependOnData(this, group, keys);
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
    engineApply.applyBulk(this, group, slots);
  }

  // -- transitions (round 24.1) --

  /** @internal */
  wasStyled(group: GroupName, slot: number): boolean {
    const arr = this.styledGen[group];

    return (
      slot < arr.length && arr[slot] === this.store.table(group).gen[slot] + 1
    );
  }

  /** @internal */
  markStyled(group: GroupName, slot: number): void {
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
   * nodes (round 14.6), else the element's own group.
   * @internal */
  defFor(ref: Ref): GroupDef {
    if (
      ref.group === GROUP_NODES &&
      this.store.hasCompounds() &&
      this.store.hasFlag(GROUP_NODES, ref.slot, FLAG_PARENT)
    ) {
      return this.defs.parents;
    }

    return this.defs[ref.group];
  }

  /** All live slots the given def styles (partitioned under compounds). @internal */
  allSlotsFor(group: GroupName, def: GroupDef): number[] {
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
    engineRefresh.refreshMapped(this, group, slots, keys);
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
    engineRefresh.refreshState(this, group, key, slots);
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
    return engineRead.readProp(this, ref, propRaw);
  }

  /**
   * All resolved props of a live element's group.
   *
   * @param ref — the element to read
   * @returns every readable prop of its group, by name
   * @internal
   */
  readProps(ref: Ref): Record<string, string | number> {
    return engineRead.readProps(this, ref);
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
    return engineRead.lineOpacityConst(this);
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
    return engineRead.arrowWidthModes(this);
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
    return engineRead.arrowBase(this, ref, colorProp);
  }

  /** Resolved label channels: the sidecar when labelled, else the sheet. @internal */
  labelChannels(ref: Ref): { fontSize: number; color: string } {
    return engineRead.labelChannels(this, ref);
  }

  /** Stored-truth readback for the background-image family (15.2). @internal */
  readImageProp(slot: number, prop: string): string | number {
    return engineRead.readImageProp(this, slot, prop);
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

  /**
   * The one channel funnel, wrapped by the transition capture (round
   * 24.1): an already-styled slot written inside an open capture gets
   * its tweenable channels snapshotted before and diffed after — the
   * body itself stays transition-blind.
   * @internal
   */
  write(group: GroupName, slot: number, computed: Computed): void {
    engineWrite.write(this, group, slot, computed);
  }

  /** warn-once flag for the multi-image cap (recorded: 4 per node) @internal */
  warnedImageCap = false;
}
