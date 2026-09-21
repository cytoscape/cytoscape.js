// GraphStore's flag writes and the styled-state notification (round 130
// split).

import {
  GROUP_EDGES,
  GROUP_NODES,
  COL,
  CONDITION_FLAG_MASK,
  CONDITION_KEY_OF,
} from '../../contract.mjs';
import type { ColumnId, GroupName, Ref } from '../../contract.mjs';
import { ONE_SLOT } from '../graph-store.mjs';
import type { GraphStore } from '../graph-store.mjs';

/**
 * Bulk flag write over a refs array (a collection's _refs): sets or
 * clears `bit` on every live ref, with the flags/gen columns hoisted out
 * of the loop and one coalesced dirty span per touched group.  Refs
 * lacking `requireBit` (when non-zero) are skipped, as are refs already
 * in the target state.  When `changedIdx` is given, the refs-array index
 * of each changed ref is appended (for per-element restyle/emit).
 * Returns the changed count.
 */
export function flagRefs(
  gs: GraphStore,
  refs: readonly Ref[],
  bit: number,
  on: boolean,
  requireBit = 0,
  changedIdx: number[] | null = null,
): number {
  const nodeFlags = gs.nodes.column(COL.NODE_FLAGS) as Uint32Array;
  const edgeFlags = gs.edges.column(COL.EDGE_FLAGS) as Uint32Array;
  const nodeGen = gs.nodes.gen;
  const edgeGen = gs.edges.gen;
  // collecting the changed slots is only worth it when some `case`
  // condition actually *watches* the bit — a bulk grabify() (or lock,
  // under the default sheet, which watches selection and press only)
  // should not build an array `noteStateChange` then discards.  The
  // 57.1d gate stopped at "is a condition-family bit", which left
  // every unwatched state paying the collection: measured at 1.83×
  // on a 256-band lock+unlock through the built bundle (round 61.5).
  // Per group, because the watched sets are.
  const stateKey = CONDITION_KEY_OF.get(bit);
  const notify = stateKey != null && gs.onStateChange != null;
  const styledNodes = notify && gs.watchedStates.nodes.has(stateKey);
  const styledEdges = notify && gs.watchedStates.edges.has(stateKey);
  const nodeStateSlots: number[] = [];
  const edgeStateSlots: number[] = [];
  let nMin = Infinity;
  let nMax = -1;
  let eMin = Infinity;
  let eMax = -1;
  let changed = 0;

  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    const slot = ref.slot;
    const isNode = ref.group === GROUP_NODES;
    const gen = isNode ? nodeGen : edgeGen;

    if (gen[slot] !== ref.gen) {
      continue;
    }

    const flags = isNode ? nodeFlags : edgeFlags;
    const prev = flags[slot];

    if (requireBit !== 0 && (prev & requireBit) === 0) {
      continue;
    }

    const next = on ? prev | bit : prev & ~bit;

    if (next === prev) {
      continue;
    }

    flags[slot] = next;
    changed++;

    if (isNode ? styledNodes : styledEdges) {
      (isNode ? nodeStateSlots : edgeStateSlots).push(slot);
    }

    if (isNode) {
      if (slot < nMin) {
        nMin = slot;
      }
      if (slot > nMax) {
        nMax = slot;
      }
    } else {
      if (slot < eMin) {
        eMin = slot;
      }
      if (slot > eMax) {
        eMax = slot;
      }
    }

    if (changedIdx != null) {
      changedIdx.push(i);
    }
  }

  if (nMax >= 0) {
    gs.dirty.mark(COL.NODE_FLAGS, nMin, nMax + 1);
  }
  if (eMax >= 0) {
    gs.dirty.mark(COL.EDGE_FLAGS, eMin, eMax + 1);
  }

  if (nodeStateSlots.length > 0) {
    noteStateChange(gs, GROUP_NODES, bit, nodeStateSlots);
  }
  if (edgeStateSlots.length > 0) {
    noteStateChange(gs, GROUP_EDGES, bit, edgeStateSlots);
  }

  return changed;
}

/**
 * Set or clear flag bits on one slot, marking the flags column dirty
 * only when the word actually changes.  Raw: derived bits (VISIBLE,
 * DRAWN, PARENT, CHILD, CURVED) have owners that recompute them —
 * write those through setVisibility / setInvisibility / setParent /
 * the curve writers rather than here.
 */
export function setFlag(
  gs: GraphStore,
  group: GroupName,
  slot: number,
  bit: number,
  on: boolean,
): void {
  const id: ColumnId = group === GROUP_NODES ? COL.NODE_FLAGS : COL.EDGE_FLAGS;
  const arr = gs.table(group).column(id) as Uint32Array;
  const prev = arr[slot];
  const next = on ? prev | bit : prev & ~bit;

  if (next === prev) {
    return;
  }

  arr[slot] = next;
  gs.dirty.mark(id, slot);
  if (((prev ^ next) & CONDITION_FLAG_MASK) !== 0) {
    ONE_SLOT[0] = slot;
    noteStateChange(gs, group, prev ^ next, ONE_SLOT);
  }
}

/**
 * Tell the style engine that a *styled* state bit flipped, so the
 * affected slots restyle.  This is what makes `{ when: { active:
 * true } }` work on any property: the flag write is the only event,
 * and every consequence — the mapper re-evaluation, the column
 * writes, the upload — is the ordinary refresh path from there.
 *
 * Cheap when nothing styles the state, which is the common case: the
 * mask test rejects the structural and internal bits outright, and
 * `markDataWrite`'s watched-key set rejects a state no `case`
 * condition mentions.  A sheet that says nothing about press pays one
 * `&` per press.
 */
export function noteStateChange(
  gs: GraphStore,
  group: GroupName,
  changed: number,
  slots: number[],
): void {
  if (gs.onStateChange == null) {
    return;
  }

  for (const [bit, key] of CONDITION_KEY_OF) {
    if ((changed & bit) !== 0 && gs.watchedStates[group].has(key)) {
      gs.onStateChange(group, key, slots);
    }
  }
}
