/*
The flow layout's compound machinery (round 112.3): global-mode
layering in the Sander tradition — one ranking over the whole nesting,
contiguity and side-consistency in ordering, border walls in
coordinate assignment — with the store's leaves-only rule intact
(parents derive from their placed children; flow never writes a parent
position).

What has to hold for the derived parent boxes to come out right:

1. **Contiguity per rank** — a rank never interleaves a group's
   members with outsiders, or a sibling group's members.  The ordering
   comparator sorts by ancestor chain before barycenter, so
   contiguity holds by construction rather than by repair.
2. **Side-consistency across ranks** — sibling groups keep one
   relative order everywhere (a flip at some rank would overlap the
   two derived boxes).  Each sweep scores every group by its members'
   mean position over *all* ranks, and the comparator uses those
   scores at every level of the chain, so the order is global.
3. **Walls** — after ordering, every group gets a left and a right
   border dummy on every rank of its interval, chained vertically as
   inner segments.  BK aligns each wall straight (a border has exactly
   one upper neighbour), type-1 marking keeps ordinary edges from
   crossing them, and the walls carry the group's horizontal padding
   as their half-width — so outsiders clear the derived box, nested
   walls stack their paddings, and the box's x-extent is protected at
   every rank it spans, member-occupied or not.

Edges incident on a parent node cannot be drawn from the parent by the
layout (parents derive), so for ranking and ordering they expand to
the parent's scoped leaf descendants at `weight / leafCount`, minimum
span 1 — the whole box lands above or below the other endpoint, which
is the drawn meaning of such an edge.

Dummy chains take the LCA chain of their edge's endpoints: a
boundary-crossing edge runs outside the deeper group but inside every
common ancestor, Sander's rule.
*/

import type { Core } from '../core.mjs';
import type { Layered } from './flow-order.mjs';

/** The scope-level compound model (group ids are scope-global). */
export interface GroupModel {
  /** group count */
  count: number;
  /** per group: parent group id or -1 */
  parentOf: Int32Array;
  /** per group: half horizontal padding per side */
  padX: Float64Array;
  /** per group: half vertical padding per side */
  padY: Float64Array;
  /** per scope node: ancestor chain, outermost first (empty = root) */
  chains: number[][];
  /** per group: its parent node's store slot */
  slotOf: number[];
  /** parent node store slot -> group id (for parent-incident edges) */
  groupOfSlot: Map<number, number>;
}

/**
 * Build the group model for the scope: every ancestor of a scoped
 * leaf becomes a group.
 *
 * @param cy — the core
 * @param slots — the scope's node slots
 * @returns the model, or null when nothing in scope is nested
 */
export const buildGroupModel = (
  cy: Core,
  slots: number[],
): GroupModel | null => {
  const store = cy._store;

  if (!store.hasCompounds()) {
    return null;
  }

  const groupIdOf = new Map<number, number>(); // parent slot -> group id
  const parentOf: number[] = [];
  const slotOf: number[] = [];
  const chains: number[][] = [];

  const groupFor = (parentSlot: number): number => {
    let id = groupIdOf.get(parentSlot);

    if (id != null) {
      return id;
    }

    const up = store.parentOf(parentSlot);
    const upId = up < 0 ? -1 : groupFor(up);

    id = parentOf.length;
    groupIdOf.set(parentSlot, id);
    parentOf.push(upId);
    slotOf.push(parentSlot);

    return id;
  };

  let any = false;

  for (const slot of slots) {
    const parent = store.parentOf(slot);

    if (parent < 0) {
      chains.push([]);
      continue;
    }

    any = true;

    const chain: number[] = [];

    for (let g = groupFor(parent); g >= 0; g = parentOf[g]) {
      chain.push(g);
    }

    chain.reverse();
    chains.push(chain);
  }

  if (!any) {
    return null;
  }

  const count = parentOf.length;
  const padX = new Float64Array(count);
  const padY = new Float64Array(count);

  for (let g = 0; g < count; g++) {
    const [sumX, sumY] = store.paddingSumsOf(slotOf[g]);

    padX[g] = sumX / 2;
    padY[g] = sumY / 2;
  }

  return {
    count,
    parentOf: Int32Array.from(parentOf),
    padX,
    padY,
    chains,
    slotOf,
    groupOfSlot: groupIdOf,
  };
};

/** The component-local compound view ordering and coordinates use. */
export interface CompoundView {
  model: GroupModel;
  /** per layered node (real and dummy): ancestor chain */
  chainOf: number[][];
}

/**
 * Chains for a component's layered form: real nodes take their scope
 * chain; a dummy takes the LCA chain of its edge's endpoints.
 *
 * @param model — the scope group model
 * @param scopeOf — component-local -> scope node index
 * @param edgeSrc — per simple edge, its component-local source
 * @param edgeTgt — per simple edge, its component-local target
 * @param L — the layered form (post-normalization; `L.chains[e]` pairs
 *   with `edgeSrc[e]`/`edgeTgt[e]`)
 * @returns the component view
 */
export const buildCompoundView = (
  model: GroupModel,
  scopeOf: Uint32Array,
  edgeSrc: Uint32Array,
  edgeTgt: Uint32Array,
  L: Layered,
): CompoundView => {
  const chainOf: number[][] = new Array(L.nTotal);

  for (let v = 0; v < L.n; v++) {
    chainOf[v] = model.chains[scopeOf[v]];
  }

  const lca = (a: number[], b: number[]): number[] => {
    let k = 0;

    while (k < a.length && k < b.length && a[k] === b[k]) {
      k++;
    }

    return a.slice(0, k);
  };

  for (let e = 0; e < L.chains.length; e++) {
    const chain = L.chains[e];

    if (chain.length === 0) {
      continue;
    }

    const shared = lca(chainOf[edgeSrc[e]] ?? [], chainOf[edgeTgt[e]] ?? []);

    for (const d of chain) {
      chainOf[d] = shared;
    }
  }

  for (let v = 0; v < L.nTotal; v++) {
    chainOf[v] ??= [];
  }

  return { model, chainOf };
};

/**
 * Insert border walls: per group, a left and right border dummy on
 * every rank of its interval, flanking the group's contiguous item
 * span, chained vertically as inner segments.  Extends `L` in place
 * (nTotal, rank, pos, layers, unit edges, CSRs) and the view's chains
 * (a wall carries its group's chain, ending in the group itself).
 *
 * @param L — the ordered layered form
 * @param view — the component compound view
 * @returns per layered node the wall's group id, or -1 for non-walls
 *   (walls carry the group's padding as half-width in x-assignment)
 */
export const insertBorders = (L: Layered, view: CompoundView): Int32Array => {
  const { model, chainOf } = view;

  // group intervals and membership per rank
  const minRank = new Int32Array(model.count).fill(0x7fffffff);
  const maxRank = new Int32Array(model.count).fill(-1);

  for (let v = 0; v < L.nTotal; v++) {
    for (const g of chainOf[v]) {
      minRank[g] = Math.min(minRank[g], L.rank[v]);
      maxRank[g] = Math.max(maxRank[g], L.rank[v]);
    }
  }

  // depth-ascending group order so outer walls insert first and nested
  // walls land inside them
  const depthOf = (g: number): number => {
    let d = 0;

    for (let p = model.parentOf[g]; p >= 0; p = model.parentOf[p]) {
      d++;
    }

    return d;
  };

  const groups = [];

  for (let g = 0; g < model.count; g++) {
    if (maxRank[g] >= 0) {
      groups.push(g);
    }
  }

  groups.sort((a, b) => depthOf(a) - depthOf(b) || a - b);

  const wallGroup: number[] = new Array(L.nTotal).fill(-1);
  const usrc = Array.from(L.usrc);
  const utgt = Array.from(L.utgt);
  const uweight = Array.from(L.uweight);
  const inner = Array.from(L.inner);
  const rank: number[] = Array.from(L.rank);

  const inGroup = (v: number, g: number): boolean => chainOf[v].includes(g);

  for (const g of groups) {
    let prevLeft = -1;
    let prevRight = -1;

    for (let r = minRank[g]; r <= maxRank[g]; r++) {
      const layer = L.layers[r];
      // the contiguous span of items in g (may be empty on a gap rank)
      let lo = -1;
      let hi = -1;

      for (let i = 0; i < layer.length; i++) {
        if (inGroup(layer[i], g)) {
          if (lo < 0) {
            lo = i;
          }

          hi = i;
        }
      }

      const left = rank.length;

      rank.push(r);
      chainOf[left] = chainToGroup(model, g);
      wallGroup[left] = g;

      const right = rank.length;

      rank.push(r);
      chainOf[right] = chainToGroup(model, g);
      wallGroup[right] = g;

      if (lo < 0) {
        // gap rank: walls sit adjacent, at the position the interval
        // passes through — after the previous rank's projected spot;
        // append at the end (x-assignment holds them together via the
        // wall chains)
        layer.push(left, right);
      } else {
        layer.splice(hi + 1, 0, right);
        layer.splice(lo, 0, left);
      }

      if (prevLeft >= 0) {
        usrc.push(prevLeft);
        utgt.push(left);
        uweight.push(2);
        inner.push(1);
        usrc.push(prevRight);
        utgt.push(right);
        uweight.push(2);
        inner.push(1);
      }

      prevLeft = left;
      prevRight = right;
    }
  }

  // rebuild the layered arrays
  const nTotal = rank.length;

  L.nTotal = nTotal;
  L.rank = Int32Array.from(rank);
  L.usrc = Uint32Array.from(usrc);
  L.utgt = Uint32Array.from(utgt);
  L.uweight = Float64Array.from(uweight);
  L.inner = Uint8Array.from(inner);
  L.pos = new Int32Array(nTotal);

  for (const layer of L.layers) {
    for (let i = 0; i < layer.length; i++) {
      L.pos[layer[i]] = i;
    }
  }

  const mu = usrc.length;
  const upOff = new Uint32Array(nTotal + 1);
  const downOff = new Uint32Array(nTotal + 1);

  for (let e = 0; e < mu; e++) {
    downOff[usrc[e] + 1]++;
    upOff[utgt[e] + 1]++;
  }

  for (let v = 0; v < nTotal; v++) {
    downOff[v + 1] += downOff[v];
    upOff[v + 1] += upOff[v];
  }

  const downAdj = new Uint32Array(mu);
  const upAdj = new Uint32Array(mu);
  const dc = downOff.slice(0, nTotal);
  const uc = upOff.slice(0, nTotal);

  for (let e = 0; e < mu; e++) {
    downAdj[dc[usrc[e]]++] = e;
    upAdj[uc[utgt[e]]++] = e;
  }

  L.upOff = upOff;
  L.upAdj = upAdj;
  L.downOff = downOff;
  L.downAdj = downAdj;

  return Int32Array.from(wallGroup);
};

/** The full ancestor chain ending in (and including) group g. */
const chainToGroup = (model: GroupModel, g: number): number[] => {
  const chain: number[] = [];

  for (let at = g; at >= 0; at = model.parentOf[at]) {
    chain.push(at);
  }

  return chain.reverse();
};

/**
 * Per-rank extra vertical margins from group padding: a rank where a
 * group's interval starts (ends) reserves the group's top (bottom)
 * padding above (below) its row, nesting summed.
 *
 * @param L — the layered form (borders inserted)
 * @param view — the component compound view
 * @returns `{ top, bottom }` extra margin per rank
 */
export const rankPadMargins = (
  L: Layered,
  view: CompoundView,
): { top: Float64Array; bottom: Float64Array } => {
  const { model, chainOf } = view;
  const rankCount = L.layers.length;
  const top = new Float64Array(rankCount);
  const bottom = new Float64Array(rankCount);
  const minRank = new Int32Array(model.count).fill(0x7fffffff);
  const maxRank = new Int32Array(model.count).fill(-1);

  for (let v = 0; v < L.nTotal; v++) {
    for (const g of chainOf[v]) {
      minRank[g] = Math.min(minRank[g], L.rank[v]);
      maxRank[g] = Math.max(maxRank[g], L.rank[v]);
    }
  }

  for (let g = 0; g < model.count; g++) {
    if (maxRank[g] < 0) {
      continue;
    }

    top[minRank[g]] += model.padY[g];
    bottom[maxRank[g]] += model.padY[g];
  }

  return { top, bottom };
};
