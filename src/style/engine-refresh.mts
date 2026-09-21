// StyleEngine's refresh side (round 130 split): a data write, a state
// flip or a compaction re-derives exactly the mapped channels that read
// what changed.

import {
  GROUP_NODES,
  COL,
  CONDITION_FLAGS,
  FLAG_PARENT,
} from '../contract.mjs';
import { bindEvaluator } from '../style-scales.mjs';
import type { ValueReader } from '../style-scales.mjs';
import type { GroupName } from '../contract.mjs';
import type { Computed } from './defaults.mjs';
import { evaluatedEq } from './compile.mjs';
import type { GroupDef, StateWriter } from './sheet.mjs';
import type { StyleEngine } from '../style.mjs';
import {
  applyMapped,
  partRecordFor,
  checkAutoExtents,
} from './engine-apply.mjs';
import { fastStateWriter, writeChart, writeLabel } from './engine-write.mjs';
import { openTxn, closeTxn } from './engine-txn.mjs';
import { bypassPatchAt } from './engine-bypass.mjs';

/** One def's share of a state flip: the fast diff path, or the
 * general `refreshGroupDef` wherever that one is correct (see
 * `refreshState`). */
export function refreshStateDef(
  engine: StyleEngine,
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
    engine.transitionSink != null && spec.duration > 0 && spec.props.length > 0;

  if (part == null || engine.demoted[group] || transitionsLive) {
    refreshGroupDef(engine, group, def, slots, [key]);

    return;
  }

  const bit = CONDITION_FLAGS[key] ?? 0;

  if ((part.mask & bit) === 0) {
    // the bit is watched for the *group* (the store's set folds the
    // parents def into nodes'), not necessarily read by engine def —
    // an empty diff by construction, so the slots are skipped
    return;
  }

  const flags = engine.store.column(
    group === GROUP_NODES ? COL.NODE_FLAGS : COL.EDGE_FLAGS,
  ) as Uint32Array;
  // a bulk flip's slots almost always share one masked word (nothing
  // else is usually pressed or hovered mid-select), so the record and
  // diff resolve once per run of equal words, not per slot
  let last = -1;
  let record: Computed | null = null;
  let writers: StateWriter[] | null = null;
  const bypassed = engine.bypassRaw.size > 0;

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const to = flags[slot] & part.mask;

    if (to !== last) {
      last = to;
      record = partRecordFor(engine, group, def, part, to);
      writers = partitionDiffWriters(engine, group, def, part, to ^ bit, to);
    }

    // round 63.3: a bypassed slot takes the merged full write — the
    // narrow diff writers would stomp a bypassed channel with the
    // partition record's value.  O(bypassed); the run optimization
    // and the diff path are untouched for everything else.
    if (bypassed && bypassPatchAt(engine, group, slot) != null) {
      engine.write(group, slot, record as Computed);
      continue;
    }

    if (writers == null) {
      engine.write(group, slot, record as Computed);
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
export function partitionDiffWriters(
  engine: StyleEngine,
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
      engine.store.data,
      group,
      fallback,
      readFrom,
    )(0);
    const b = bindEvaluator(
      bm.m,
      engine.store.data,
      group,
      fallback,
      readTo,
    )(0);

    if (evaluatedEq(a, b)) {
      continue;
    }

    const writer = fastStateWriter(engine, group, bm.m.prop);

    if (writer == null) {
      writers = null;

      break;
    }

    writers.push(writer);
  }

  part.diffs.set(cacheKey, writers);

  return writers;
}

/** Re-derive the mapped channels of one group's slots against a definition (the sheet's or the parents overlay), inside one transition capture. */
export function refreshGroupDef(
  engine: StyleEngine,
  group: GroupName,
  def: GroupDef,
  slots: ArrayLike<number>,
  keys: string[],
): void {
  if (slots.length === 0 || def.deps == null) {
    return;
  }

  const txn = openTxn(engine, group, def);

  try {
    refreshGroupDefInner(engine, group, def, slots, keys);
  } finally {
    closeTxn(engine, txn);
  }
}

/** `refreshGroupDef` without the transition capture: the per-partition mapper re-evaluation on the given slots. */
export function refreshGroupDefInner(
  engine: StyleEngine,
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
        writeLabel(engine, slots[i], def.computed, group);
      }
    }

    if (chart) {
      for (let i = 0; i < slots.length; i++) {
        writeChart(engine, slots[i], def.computed);
      }
    }
  };

  // a chart refresh under mapped channels must re-evaluate per slot
  // (the narrow path writes def.computed — the constants record —
  // which is wrong whenever `chart`/size/etc. are themselves mapped)
  if (mapped || (chart && def.mappers.length > 0)) {
    const owned = engine.gpuOwnedProps[group];
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
      engine.demoted[group] ||
      affected.some((bm) => !owned.has(bm.m.prop))
    ) {
      applyMapped(engine, group, def, slots, true);
    } else {
      // every mapped channel is GPU-owned: no CPU restyle at all — the
      // data-write spans drive the kernel; only the extents need a look
      checkAutoExtents(engine, group, def);
      narrow();
    }
  } else {
    narrow();
  }
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
export function refreshMapped(
  engine: StyleEngine,
  group: GroupName,
  slots: ArrayLike<number>,
  keys: string[],
): void {
  if (group === GROUP_NODES && engine.store.hasCompounds()) {
    const flags = engine.store.column(COL.NODE_FLAGS) as Uint32Array;
    const leaves: number[] = [];
    const parents: number[] = [];

    for (let i = 0; i < slots.length; i++) {
      ((flags[slots[i]] & FLAG_PARENT) !== 0 ? parents : leaves).push(slots[i]);
    }

    if (leaves.length > 0) {
      refreshGroupDef(engine, GROUP_NODES, engine.defs.nodes, leaves, keys);
    }
    if (parents.length > 0) {
      refreshGroupDef(engine, GROUP_NODES, engine.defs.parents, parents, keys);
    }

    return;
  }

  refreshGroupDef(engine, group, engine.defs[group], slots, keys);
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
export function refreshState(
  engine: StyleEngine,
  group: GroupName,
  key: string,
  slots: ArrayLike<number>,
): void {
  // the structural pair changes def resolution, not just values
  if (key === '::parent' || key === '::child') {
    refreshMapped(engine, group, slots as number[], [key]);

    return;
  }

  if (group === GROUP_NODES && engine.store.hasCompounds()) {
    const flags = engine.store.column(COL.NODE_FLAGS) as Uint32Array;
    const leaves: number[] = [];
    const parents: number[] = [];

    for (let i = 0; i < slots.length; i++) {
      ((flags[slots[i]] & FLAG_PARENT) !== 0 ? parents : leaves).push(slots[i]);
    }

    refreshStateDef(engine, GROUP_NODES, engine.defs.nodes, leaves, key);
    refreshStateDef(engine, GROUP_NODES, engine.defs.parents, parents, key);

    return;
  }

  refreshStateDef(engine, group, engine.defs[group], slots, key);
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
export function stylesDependOnData(
  engine: StyleEngine,
  group: GroupName,
  keys: string[],
): boolean {
  // plain loops, no closures: engine gate runs twice on every data()
  // write, and the closure-per-call form cost 700 ns through tsx
  // (the round-34 __name tax) against 41 through the bundle (62.3)
  const own = engine.defs[group].deps;

  if (own != null) {
    for (let i = 0; i < keys.length; i++) {
      if (own.has(keys[i])) {
        return true;
      }
    }
  }

  if (group === GROUP_NODES && engine.store.hasCompounds()) {
    const parents = engine.defs.parents.deps;

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
