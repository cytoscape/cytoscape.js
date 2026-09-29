// StyleEngine's sheet diff (round 133, ledger item 67): a whole-sheet
// `cy.style( sheet )` re-writes only the channels whose declaration the
// new sheet changed, per group def, instead of every channel of every
// element.
//
// The rule it keeps: the end state is the one a whole-sheet re-apply
// leaves, column for column.  So everything a full pass would have
// re-derived for a reason other than the sheet's own text is either
// counted as changed or sends its def (or its slots) down the full path:
//
//   - a prop whose narrow writer does not exist (geometry, labels,
//     charts, the fold clusters — `fastStateWriter` returns null) sends
//     its def to the full pass;
//   - a slot bypassed under the old sheet or the new one takes the full
//     write, which is the bypass-clearing rule of a sheet replace (the
//     section is whole-replaced, and a cleared slot returns to the
//     sheet through `write()`'s merge);
//   - a slot not yet styled (added inside the batch the sheet was set
//     in) takes the full write, as it would have at `endBatch`;
//   - a prop the GPU eval kernel owned has stale stored bytes, so it
//     counts as changed;
//   - a live auto-domain extent that moved since the columns were
//     derived counts its prop as changed;
//   - a group an animation has written since its last whole-group pass
//     (`store.styleTouched`), a demoted group, a def with live
//     transitions and an open transition capture take the full pass.

import { GROUP_EDGES, GROUP_NODES, COL, FLAG_PARENT } from '../contract.mjs';
import type { GroupName, Ref } from '../contract.mjs';
import type { StyleProps } from '../public-types.mjs';
import type { CompoundStyle } from '../store/hierarchy.mjs';
import { bindEvaluator } from '../style-scales.mjs';
import { PROP } from '../style-props.mjs';
import type { Computed } from './defaults.mjs';
import { normalizeProp } from './normalize.mjs';
import { stateOnlyMask } from './compile.mjs';
import type { BoundMapper, Evaluator } from './compile.mjs';
import type { GroupDef, StateWriter } from './sheet.mjs';
import type { StyleEngine } from '../style.mjs';
import { fastStateWriter } from './engine-write.mjs';
import {
  applyGroupDef,
  applyParents,
  partRecordFor,
  checkAutoExtents,
} from './engine-apply.mjs';

/** The three compiled defs a sheet installs. */
export type DefKey = GroupName | 'parents';

const DEF_KEYS: readonly DefKey[] = [GROUP_NODES, GROUP_EDGES, 'parents'];

/** The installed defs, as `engine.defs` holds them. */
export type Defs = Record<DefKey, GroupDef>;

/**
 * What the sheet changes since the last apply owe the columns.  One
 * accumulates across every `setSheet` between two applies (a batch can
 * set several), because an element restyled in between — a state flip,
 * a leaf↔parent flip, a bypass write — was written under the sheet
 * current at the time, so a prop that differed in *any* intermediate
 * sheet has to be re-written.
 */
export interface PendingSheet {
  /** per def: the props whose declaration changed, or null for a full pass */
  changed: Record<DefKey, Set<string> | null>;
  /** ids carrying a bypass under any sheet since the last apply */
  bypassIds: Set<string>;
  /** the defs the columns were derived under (the last applied sheet's) */
  from: Defs | null;
  /** how many sheets were set since the last apply */
  sheets: number;
}

/** What `setSheet` captures before it replaces anything. */
export interface SheetBefore {
  defs: Defs | null;
  compound: Partial<CompoundStyle>;
  gpuOwned: Record<GroupName, ReadonlySet<string>>;
  bypassIds: string[];
}

const isPlain = (v: unknown): v is Record<string, unknown> => {
  if (v == null || typeof v !== 'object') {
    return false;
  }

  const proto = Object.getPrototypeOf(v);

  return proto === Object.prototype || proto === null;
};

/**
 * A copy of a declared value that a later in-place mutation of the
 * sheet cannot reach: plain objects and arrays are copied, anything
 * else (a primitive, or an object that is not plain data) is kept as is
 * and compares by identity.
 *
 * @param value — a declared prop value
 * @returns the snapshot
 */
export function snapshotDecl(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(snapshotDecl);
  }

  if (isPlain(value)) {
    const out: Record<string, unknown> = {};

    for (const key of Object.keys(value)) {
      out[key] = snapshotDecl(value[key]);
    }

    return out;
  }

  return value;
}

/**
 * Structural equality over declared values: primitives by `Object.is`,
 * arrays and plain objects by their entries, anything else by identity.
 *
 * @param a — one value
 * @param b — the other
 * @returns whether the two declare the same thing
 */
export function declEq(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) {
      return false;
    }

    for (let i = 0; i < a.length; i++) {
      if (!declEq(a[i], b[i])) {
        return false;
      }
    }

    return true;
  }

  if (isPlain(a) && isPlain(b)) {
    const ka = Object.keys(a);

    if (ka.length !== Object.keys(b).length) {
      return false;
    }

    for (const key of ka) {
      if (
        !Object.prototype.hasOwnProperty.call(b, key) ||
        !declEq(a[key], b[key])
      ) {
        return false;
      }
    }

    return true;
  }

  return false;
}

/**
 * A def's declarations: normalized prop → snapshot, the later
 * declaration of a prop replacing the earlier (`resolveConst`'s rule;
 * `applyProp` reads no sibling field, so the order of *different*
 * props does not matter).
 *
 * @param props — the channel props the def compiles from
 * @returns the declaration map
 */
export function declOf(props: StyleProps): Map<string, unknown> {
  const out = new Map<string, unknown>();

  for (const key of Object.keys(props)) {
    out.set(
      normalizeProp(key),
      snapshotDecl((props as Record<string, unknown>)[key]),
    );
  }

  return out;
}

/**
 * The props whose declaration differs between two defs — declared in
 * one and not the other, or declared differently.
 *
 * @param a — one def's declarations
 * @param b — the other's
 * @returns the differing props
 */
export function declDiff(
  a: ReadonlyMap<string, unknown>,
  b: ReadonlyMap<string, unknown>,
): Set<string> {
  const out = new Set<string>();

  for (const [prop, value] of a) {
    if (!b.has(prop) || !declEq(value, b.get(prop))) {
      out.add(prop);
    }
  }

  for (const prop of b.keys()) {
    if (!a.has(prop)) {
      out.add(prop);
    }
  }

  return out;
}

/** What `setSheet` has to remember before it replaces the sheet. */
export function captureBefore(engine: StyleEngine): SheetBefore {
  return {
    // null only while the constructor installs the empty sheet
    defs: (engine.defs as Defs | null) ?? null,
    compound: engine.parentCompound,
    gpuOwned: { ...engine.gpuOwnedProps },
    bypassIds: [...engine.bypassRaw.keys()],
  };
}

/**
 * Fold one sheet replacement into the pending diff — called by
 * `setSheet` once the new defs, compound record and bypasses are
 * installed.
 *
 * @param before — what `captureBefore` took
 */
export function noteSheetChange(
  engine: StyleEngine,
  before: SheetBefore,
): void {
  const next = engine.defs;
  const pending: PendingSheet = engine.pendingSheet ?? {
    changed: { nodes: new Set(), edges: new Set(), parents: new Set() },
    bypassIds: new Set(),
    from: before.defs,
    sheets: 0,
  };

  pending.sheets++;

  for (const key of DEF_KEYS) {
    const changed = pending.changed[key];

    if (changed == null) {
      continue;
    }

    if (before.defs == null) {
      pending.changed[key] = null;
      continue;
    }

    for (const prop of declDiff(before.defs[key].decl, next[key].decl)) {
      changed.add(prop);
    }

    // kernel-owned bytes are stale: re-derive them on the CPU, as the
    // full pass does (the runtime re-takes ownership on the version bump)
    const owned =
      before.gpuOwned[key === GROUP_EDGES ? GROUP_EDGES : GROUP_NODES];

    for (const prop of owned) {
      changed.add(prop);
    }
  }

  if (!declEq(before.compound, engine.parentCompound)) {
    pending.changed.parents = null;
  }

  for (const id of before.bypassIds) {
    pending.bypassIds.add(id);
  }

  engine.pendingSheet = pending;
}

/** The layer props share one packed store call, so one writer each. */
const writerKey = (prop: string): string => {
  switch (prop) {
    case PROP.OVERLAY_OPACITY:
    case PROP.OVERLAY_PADDING:
      return PROP.OVERLAY_COLOR;
    case PROP.UNDERLAY_OPACITY:
    case PROP.UNDERLAY_PADDING:
      return PROP.UNDERLAY_COLOR;
    default:
      return prop;
  }
};

/**
 * The narrow writers a def's changed props need, or null when the def
 * must take the full pass (a prop with no narrow writer, a live
 * transition, an open capture).  Moved auto-domain extents join the
 * changed set here, after the new programs have read the data.
 */
function writersFor(
  engine: StyleEngine,
  group: GroupName,
  key: DefKey,
  def: GroupDef,
  pending: PendingSheet,
): StateWriter[] | null {
  const changed = pending.changed[key];
  const spec = def.transition;

  if (
    changed == null ||
    engine.txn != null ||
    (engine.transitionSink != null &&
      spec.duration > 0 &&
      spec.props.length > 0)
  ) {
    return null;
  }

  const props = new Set(changed);

  checkAutoExtents(engine, group, def);

  for (const bm of def.mappers) {
    const program = bm.m.program;

    if (
      (program.kind !== 'continuous' && program.kind !== 'discrete') ||
      !program.autoDomain ||
      props.has(bm.m.prop)
    ) {
      continue;
    }

    // the columns were derived under the previous program's extent —
    // unless sheets in between may have re-derived some slots under
    // theirs, in which case the prop re-writes outright
    const prev =
      pending.sheets === 1
        ? pending.from?.[key].mappers.find((p) => p.m.prop === bm.m.prop)
        : undefined;
    const was = prev?.m.program;

    if (
      was == null ||
      was.kind !== program.kind ||
      !declEq(
        (was as { applied: unknown }).applied,
        (program as { applied: unknown }).applied,
      )
    ) {
      props.add(bm.m.prop);
    }
  }

  const byKey = new Map<string, StateWriter>();

  for (const prop of props) {
    const k = writerKey(prop);

    if (byKey.has(k)) {
      continue;
    }

    const writer = fastStateWriter(engine, group, prop);

    if (writer == null) {
      return null;
    }

    byKey.set(k, writer);
  }

  return [...byKey.values()];
}

/**
 * The per-slot resolved record a narrow writer reads — the fold
 * partners of a changed channel (a mapped `background-opacity` beside a
 * changed `background-color`) have to be the slot's own.  The same
 * three shapes `applyGroupDef` resolves through: the partition cache,
 * the constants record, or a scratch evaluation with the state-only
 * mappers hoisted per masked flag word (round 66.1).
 */
function recorder(
  engine: StyleEngine,
  group: GroupName,
  def: GroupDef,
): (slot: number) => Computed {
  const store = engine.store;
  const flagsId = group === GROUP_NODES ? COL.NODE_FLAGS : COL.EDGE_FLAGS;
  const part = def.partition;

  if (part != null) {
    const flags = store.column(flagsId) as Uint32Array;

    return (slot) =>
      partRecordFor(engine, group, def, part, flags[slot] & part.mask);
  }

  if (def.mappers.length === 0) {
    return () => def.computed;
  }

  const scratch: Computed = { ...def.computed };
  const bind = (bm: BoundMapper): Evaluator => ({
    set: bm.channel.set,
    ev: bindEvaluator(
      bm.m,
      store.data,
      group,
      bm.channel.default(group),
      engine.readValue,
    ),
  });
  const stateMask = def.mappers.reduce((m, bm) => m | stateOnlyMask(bm), 0);
  const stateEvals: Evaluator[] = [];
  const evals: Evaluator[] = [];

  for (const bm of def.mappers) {
    (stateOnlyMask(bm) !== 0 ? stateEvals : evals).push(bind(bm));
  }

  const flags =
    stateEvals.length > 0 ? (store.column(flagsId) as Uint32Array) : null;
  let lastWord = -1;

  return (slot) => {
    if (flags != null) {
      const word = flags[slot] & stateMask;

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

    return scratch;
  };
}

/** The whole-sheet pass over one def's slots (the parents' includes
 * the compound-style write). */
function fullPass(
  engine: StyleEngine,
  group: GroupName,
  key: DefKey,
  run: number[],
): void {
  if (key === 'parents') {
    applyParents(engine, run);
  } else {
    applyGroupDef(engine, group, engine.defs[key], run);
  }
}

/** One def's share of a group's apply: its writers, or null for the full pass. */
interface DefPlan {
  key: DefKey;
  writers: StateWriter[] | null;
  slots: number[];
}

/**
 * The narrow pass over one def's slots: each changed channel's writer
 * per slot, from the slot's own resolved record.  The extras (bypassed
 * under either sheet, or never styled) take the full write instead.
 */
function narrowPass(
  engine: StyleEngine,
  group: GroupName,
  plan: DefPlan,
  extra: ReadonlySet<number>,
): void {
  const writers = plan.writers as StateWriter[];
  const slots = plan.slots;
  const record = recorder(engine, group, engine.defs[plan.key]);
  const rest: number[] = [];
  const check = extra.size > 0;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];

    if (check && extra.has(slot)) {
      rest.push(slot);
      continue;
    }

    const computed = record(slot);

    for (let j = 0; j < writers.length; j++) {
      writers[j](slot, computed);
    }
  }

  if (rest.length > 0) {
    fullPass(engine, group, plan.key, rest);
  }
}

/**
 * Apply the pending sheet change: the diff, or the whole-sheet pass
 * when there is nothing to diff against or the diff is switched off.
 *
 * @param unstyled — elements added since the last apply and not yet
 *   styled (a batch's deferred additions); they take the full write.
 *   Outside a batch every live element is styled on add, so there are
 *   none.
 * @returns true when every live slot took the full pass — the caller's
 *   cue that deferred per-slot work (a batch's data refreshes) is
 *   subsumed, as it always was by `applyAll()`
 */
export function applySheet(
  engine: StyleEngine,
  unstyled: readonly Ref[] = [],
): boolean {
  const pending = engine.pendingSheet;

  engine.pendingSheet = null;

  if (pending == null || !engine.sheetDiff) {
    engine.applyAll();

    return true;
  }

  const store = engine.store;
  // the slots the narrow path cannot serve: bypassed under either sheet
  // (the merged record, or the clear, is `write()`'s — the bypass-
  // clearing rule of a sheet replace), or never styled
  const extra: Record<GroupName, Set<number>> = {
    nodes: new Set(),
    edges: new Set(),
  };

  for (const ids of [pending.bypassIds, engine.bypassRaw.keys()]) {
    for (const id of ids) {
      const ref = store.lookup(id);

      if (ref != null) {
        extra[ref.group].add(ref.slot);
      }
    }
  }

  for (const ref of unstyled) {
    if (store.isCurrent(ref)) {
      extra[ref.group].add(ref.slot);
    }
  }

  let all = true;

  for (const group of [GROUP_NODES, GROUP_EDGES] as const) {
    // stored truth an animation wrote, or kernel bytes a mixed column
    // demoted: the whole group re-derives, as it always did
    const whole = store.styleTouched[group] || engine.demoted[group];
    const compounds = group === GROUP_NODES && store.hasCompounds();
    const keys: DefKey[] =
      group === GROUP_EDGES
        ? [GROUP_EDGES]
        : compounds
          ? [GROUP_NODES, 'parents']
          : [GROUP_NODES];
    const plans: DefPlan[] = keys.map((key) => ({
      key,
      writers: whole
        ? null
        : writersFor(engine, group, key, engine.defs[key], pending),
      slots: [],
    }));
    const flags = compounds
      ? (store.column(COL.NODE_FLAGS) as Uint32Array)
      : null;
    const planOf = (slot: number): DefPlan =>
      flags != null && (flags[slot] & FLAG_PARENT) !== 0 ? plans[1] : plans[0];

    if (plans.every((p) => p.writers != null && p.writers.length === 0)) {
      // nothing the sheet changed reaches this group's columns: only
      // the extras are written, and no live-slot walk is paid
      for (const slot of extra[group]) {
        planOf(slot).slots.push(slot);
      }

      for (const plan of plans) {
        if (plan.slots.length > 0) {
          fullPass(engine, group, plan.key, plan.slots);
        }
      }

      all = false;
      continue;
    }

    store.forEachAlive(group, (slot) => {
      planOf(slot).slots.push(slot);
    });

    for (const plan of plans) {
      if (plan.slots.length === 0) {
        continue;
      }

      if (plan.writers == null) {
        fullPass(engine, group, plan.key, plan.slots);
      } else if (plan.writers.length === 0) {
        const run = plan.slots.filter((slot) => extra[group].has(slot));

        if (run.length > 0) {
          fullPass(engine, group, plan.key, run);
        }
      } else {
        narrowPass(engine, group, plan, extra[group]);
      }
    }

    if (plans.every((p) => p.writers == null)) {
      store.styleTouched[group] = false;
    } else {
      all = false;
    }
  }

  return all;
}
