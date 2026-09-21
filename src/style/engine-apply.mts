// StyleEngine's apply side (round 130 split): the mapped, bulk and
// partitioned apply paths, as functions over the engine.  See
// `StyleEngine` in ../style.mts for the surface.

import {
  GROUP_EDGES,
  GROUP_NODES,
  COL,
  CONDITION_FLAGS,
  FLAG_PARENT,
} from '../contract.mjs';
import {
  bindEvaluator,
  autoExtentFor,
  applyAutoExtent,
} from '../style-scales.mjs';
import { TWEEN_COL } from '../animation.mjs';
import type { ValueReader } from '../style-scales.mjs';
import type { GroupName } from '../contract.mjs';
import type { Computed } from './defaults.mjs';
import { stateOnlyMask } from './compile.mjs';
import type { BoundMapper, Evaluator, TxnCapture } from './compile.mjs';
import { BULK_MIN_RUN } from './sheet.mjs';
import type { GroupDef, StateWriter } from './sheet.mjs';
import type { StyleEngine } from '../style.mjs';
import { fastStateWriter, writeEdgePerSlot } from './engine-write.mjs';
import { openTxn, closeTxn } from './engine-txn.mjs';

/**
 * Scratch-evaluate every mapped channel and write whole elements — the
 * per-channel write would break the cross-channel couplings that live
 * in write() (circle collapse, arrow-alpha folding, the label anchor).
 * Live auto-domain extents re-check here; a changed extent escalates
 * the pass to the whole group (every slot's mapping moved).
 */
export function applyMapped(
  engine: StyleEngine,
  group: GroupName,
  def: GroupDef,
  slots: ArrayLike<number>,
  skipOwned: boolean = false,
): void {
  const store = engine.store;

  if (engine.demoted[group]) {
    // formerly kernel-owned bytes are stale everywhere: one full CPU
    // pass re-derives them; ownership stays clear until the runtime
    // re-configures against the mixed column
    engine.demoted[group] = false;
    engine.gpuOwnedProps[group] = new Set();
    slots = engine.allSlotsFor(group, def);
    skipOwned = false;
  }

  if (def.partition != null) {
    applyPartitioned(engine, group, def, slots);

    return;
  }

  const target = checkAutoExtents(engine, group, def)
    ? engine.allSlotsFor(group, def)
    : slots;

  // one scratch record: every evaluated channel is reassigned per slot
  // and the rest keep the constant base.  GPU-owned channels skip CPU
  // evaluation on data-write refreshes (the kernel re-derives them);
  // their stored bytes go stale, which the getters compensate for.
  const owned = engine.gpuOwnedProps[group];
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
      engine.readValue,
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
  if (bulkEdgeRun(engine, group, target)) {
    const uniform =
      flagsCol == null ||
      uniformMaskedWord(engine, target, flagsCol, stateMask);
    const writers = bulkEdgeWriters(engine, group, active, uniform);

    if (writers != null) {
      // a uniform run needs no word watch in the loop: every state
      // mapper's value is the template's, and `bulkEdgeWriters` has
      // already dropped their writers
      applyBulkEdges(
        engine,
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

    engine.write(group, slot, scratch);
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
export function bulkEdgeRun(
  engine: StyleEngine,
  group: GroupName,
  slots: ArrayLike<number>,
): boolean {
  if (
    group !== GROUP_EDGES ||
    slots.length < BULK_MIN_RUN ||
    engine.txn != null || // a transition capture diffs per slot
    engine.bypassRaw.size > 0 // a bypassed slot is not the template's
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
export function uniformMaskedWord(
  engine: StyleEngine,
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
export function bulkEdgeWriters(
  engine: StyleEngine,
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

    const writer = fastStateWriter(engine, group, bm.m.prop);

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
export function applyBulkEdges(
  engine: StyleEngine,
  slots: ArrayLike<number>,
  scratch: Computed,
  evals: Evaluator[],
  stateEvals: Evaluator[],
  writers: StateWriter[],
  flagsCol: Uint32Array | null = null,
  stateMask = 0,
): void {
  engine._bulkRuns++;

  const first = slots[0];
  const n = slots.length;

  for (let j = 0; j < stateEvals.length; j++) {
    stateEvals[j].set(scratch, stateEvals[j].ev(first));
  }
  for (let j = 0; j < evals.length; j++) {
    evals[j].set(scratch, evals[j].ev(first));
  }

  engine.write(GROUP_EDGES, first, scratch);
  engine.store.replicateEdgeStyle(first, n);

  // A state-only mapper reaches the loop only when the run's word is
  // *not* uniform — `bulkEdgeWriters` drops the uniform ones — and its
  // value then has to be re-evaluated on a word change like round
  // 66.1's hoist, or every slot is written the template's.  Skipping
  // engine re-evaluation is not caught by a graph loaded at rest: it
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

    writeEdgePerSlot(engine, slot, scratch);
    engine.markStyled(GROUP_EDGES, slot);
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
export function applyPartitioned(
  engine: StyleEngine,
  group: GroupName,
  def: GroupDef,
  slots: ArrayLike<number>,
): void {
  const part = def.partition as NonNullable<GroupDef['partition']>;
  const flags = engine.store.column(
    group === GROUP_NODES ? COL.NODE_FLAGS : COL.EDGE_FLAGS,
  ) as Uint32Array;

  // round 67.2: at rest every slot carries the same masked word — a
  // freshly loaded graph has nothing selected — so the whole run
  // resolves to one record and takes the bulk route with no writers
  if (
    bulkEdgeRun(engine, group, slots) &&
    uniformMaskedWord(engine, slots, flags, part.mask)
  ) {
    applyBulkEdges(
      engine,
      slots,
      partRecordFor(engine, group, def, part, flags[slots[0]] & part.mask),
      [],
      [],
      [],
    );

    return;
  }

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];

    engine.write(
      group,
      slot,
      partRecordFor(engine, group, def, part, flags[slot] & part.mask),
    );
  }
}

/** The partition record for one masked flag word — cached on the def,
 * resolved on the first miss (round 57.1). */
export function partRecordFor(
  engine: StyleEngine,
  group: GroupName,
  def: GroupDef,
  part: NonNullable<GroupDef['partition']>,
  word: number,
): Computed {
  let record = part.records.get(word);

  if (record === undefined) {
    record = partitionRecord(engine, group, def, word);
    part.records.set(word, record);
  }

  return record;
}

/** Resolve one flag combination into a computed record (cache miss). */
export function partitionRecord(
  engine: StyleEngine,
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
        engine.store.data,
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
export function checkAutoExtents(
  engine: StyleEngine,
  group: GroupName,
  def: GroupDef,
): boolean {
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
          ...autoExtentFor(bm.m, engine.store.data, group),
        )
      ) {
        moved = true;

        if (engine.gpuOwnedProps[group].has(bm.m.prop)) {
          engine.paintVersion++;
        }
      }
    }
  }

  return moved;
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
export function applyBulk(
  engine: StyleEngine,
  group: GroupName,
  slots: ArrayLike<number>,
): void {
  if (slots.length === 0) {
    return;
  }

  if (group === GROUP_NODES && engine.store.hasCompounds()) {
    // parents resolve through the overlay def (round 14.6)
    const flags = engine.store.column(COL.NODE_FLAGS) as Uint32Array;
    const leaves: number[] = [];
    const parents: number[] = [];

    for (let i = 0; i < slots.length; i++) {
      ((flags[slots[i]] & FLAG_PARENT) !== 0 ? parents : leaves).push(slots[i]);
    }

    if (leaves.length > 0) {
      applyGroupDef(engine, GROUP_NODES, engine.defs.nodes, leaves);
    }

    if (parents.length > 0) {
      const def = engine.defs.parents;
      // padding transitions (25.4): the compound-style write sits
      // outside the write() funnel, so it takes its own capture.
      // The styled marks are read before the channel pass marks
      // fresh slots (instant-on-add must hold for padding too).
      const txn = openTxn(engine, GROUP_NODES, def);
      const styledBefore =
        txn != null && txn.padding
          ? parents.map((slot) => engine.wasStyled(GROUP_NODES, slot))
          : null;

      try {
        // the inner openTxn no-ops while engine capture is open, so
        // the channel diffs land in the same preset animation
        applyGroupDef(engine, GROUP_NODES, def, parents);

        for (let i = 0; i < parents.length; i++) {
          applyCompoundStyle(
            engine,
            txn,
            parents[i],
            styledBefore == null ? false : styledBefore[i],
          );
        }
      } finally {
        closeTxn(engine, txn);
      }
    }

    return;
  }

  applyGroupDef(engine, group, engine.defs[group], slots);
}

/**
 * The parents' compound-style write with the padding transition
 * capture (round 25.4): diff the declared padding around the sheet
 * write, snap on a px↔% unit flip (tweening across units has no
 * meaning — recorded), and restore the held pre-restyle value
 * (CSS's delay rule, like the channel diffs).
 */
export function applyCompoundStyle(
  engine: StyleEngine,
  txn: TxnCapture | null,
  slot: number,
  styled: boolean,
): void {
  const store = engine.store;

  if (txn == null || !txn.padding || !styled) {
    store.setCompoundStyle(slot, engine.parentCompound);

    return;
  }

  const before = store.compoundStyleOf(slot);

  store.setCompoundStyle(slot, engine.parentCompound);

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

/** Apply one group definition to the given slots: its constants, then its mappers, inside one transition capture. */
export function applyGroupDef(
  engine: StyleEngine,
  group: GroupName,
  def: GroupDef,
  slots: ArrayLike<number>,
): void {
  const txn = openTxn(engine, group, def);

  try {
    if (def.mappers.length > 0) {
      applyMapped(engine, group, def, slots);
    } else {
      const computed = def.computed;

      // no mappers: nothing varies, so the run needs no writers
      if (bulkEdgeRun(engine, group, slots)) {
        applyBulkEdges(engine, slots, computed, [], [], []);
      } else {
        for (let i = 0; i < slots.length; i++) {
          engine.write(group, slots[i], computed);
        }
      }
    }
  } finally {
    closeTxn(engine, txn);
  }
}
