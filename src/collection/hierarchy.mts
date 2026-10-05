// Collection's compound hierarchy and DAG traversal (round 130 split).

import { GROUP_EDGES, GROUP_NODES, COL, FLAG_PARENT } from '../contract.mjs';
import type { Ref } from '../contract.mjs';
import { Animation } from '../animation.mjs';
import type {
  AnimateOptions,
  CollapsedAnimationDriver,
} from '../animation.mjs';
import type { FilterLike } from './shared.mjs';
import type { Collection } from '../collection.mjs';

/** Immediate parents of every node in the collection (unique).  v4
 * always returns a proper collection — v3's single-element raw-ref
 * shortcut (which also ignored the selector argument) is not ported.   *
 * @param criterion — an optional query object or predicate applied to
 *   the result, exactly as `filter()` takes it
 * @returns the immediate parents
 */
export function parent(self: Collection, criterion?: FilterLike): Collection {
  const store = self._store;
  const refs: Ref[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group !== GROUP_NODES || !store.isCurrent(ref)) {
      continue;
    }

    const p = store.parentOf(ref.slot);

    if (p >= 0 && !seen.has(p)) {
      seen.add(p);
      refs.push(store.ref(GROUP_NODES, p));
    }
  }

  const eles = self._spawnLive(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/**
 * All ancestors, level by level: every nearest parent first, then the
 * grandparents, and so on (v3's iterated-parent() order).   *
 * @param criterion — an optional query object or predicate applied to
 *   the result, exactly as `filter()` takes it
 * @returns the ancestors, nearest first
 */
export function parents(self: Collection, criterion?: FilterLike): Collection {
  const store = self._store;
  const refs: Ref[] = [];
  const seen = new Set<number>();
  let level: number[] = [];

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group === GROUP_NODES && store.isCurrent(ref)) {
      level.push(ref.slot);
    }
  }

  while (level.length > 0) {
    const next: number[] = [];

    for (const slot of level) {
      const p = store.parentOf(slot);

      if (p >= 0 && !seen.has(p)) {
        seen.add(p);
        refs.push(store.ref(GROUP_NODES, p));
        next.push(p);
      }
    }

    level = next;
  }

  const eles = self._spawnLive(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/**
 * Direct children of every node, in link order per parent.   *
 * @param criterion — an optional query object or predicate applied to
 *   the result, exactly as `filter()` takes it
 * @returns the children
 */
export function children(self: Collection, criterion?: FilterLike): Collection {
  const store = self._store;
  const refs: Ref[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group !== GROUP_NODES || !store.isCurrent(ref)) {
      continue;
    }

    for (const child of store.childrenOf(ref.slot)) {
      if (!seen.has(child)) {
        seen.add(child);
        refs.push(store.ref(GROUP_NODES, child));
      }
    }
  }

  const eles = self._spawnLive(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/**
 * The subtree below every node in pre-order, excluding the nodes
 * themselves.   *
 * @param criterion — an optional query object or predicate applied to
 *   the result, exactly as `filter()` takes it
 * @returns the descendants
 */
export function descendants(
  self: Collection,
  criterion?: FilterLike,
): Collection {
  const store = self._store;
  const refs: Ref[] = [];
  const seen = new Set<number>();
  const stack: number[] = [];

  const pushChildren = (slot: number): void => {
    const kids = store.childrenOf(slot);

    for (let j = kids.length - 1; j >= 0; j--) {
      stack.push(kids[j]);
    }
  };

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group !== GROUP_NODES || !store.isCurrent(ref)) {
      continue;
    }

    pushChildren(ref.slot);

    while (stack.length > 0) {
      const slot = stack.pop() as number;

      if (seen.has(slot)) {
        continue;
      }

      seen.add(slot);
      refs.push(store.ref(GROUP_NODES, slot));
      pushChildren(slot);
    }
  }

  const eles = self._spawnLive(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/** The nodes that have a parent (`wantChild`) or have none, filtered by `criterion` — `nonorphans` and `orphans`. */
export function _byParentedness(
  self: Collection,
  wantChild: boolean,
  criterion?: FilterLike,
): Collection {
  const store = self._store;
  const refs: Ref[] = [];

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group !== GROUP_NODES || !store.isCurrent(ref)) {
      continue;
    }

    if (store.parentOf(ref.slot) >= 0 === wantChild) {
      refs.push(store.ref(GROUP_NODES, ref.slot));
    }
  }

  const eles = self._spawnLive(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/**
 * Ancestors common to every element, closest first (an edge in the
 * collection has no ancestors, so it empties the result — v3).   *
 * @param criterion — an optional query object or predicate applied to
 *   the result, exactly as `filter()` takes it
 * @returns the shared ancestors, closest first
 */
export function commonAncestors(
  self: Collection,
  criterion?: FilterLike,
): Collection {
  const store = self._store;
  let chain: number[] | null = null;

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (!store.isCurrent(ref)) {
      continue;
    }

    const own: number[] = [];

    if (ref.group === GROUP_NODES) {
      for (let p = store.parentOf(ref.slot); p >= 0; p = store.parentOf(p)) {
        own.push(p);
      }
    }

    if (chain == null) {
      chain = own;
    } else {
      const keep = new Set(own);

      chain = chain.filter((slot) => keep.has(slot));
    }

    if (chain.length === 0) {
      break;
    }
  }

  const eles = self._spawnLive(
    (chain ?? []).map((slot) => store.ref(GROUP_NODES, slot)),
  );

  return criterion == null ? eles : eles.filter(criterion);
}

/** Collapse or expand every compound parent in ancestor-first order. */
export function setCollapsed(
  self: Collection,
  collapsed: boolean,
  timing?: Pick<AnimateOptions, 'duration' | 'easing'>,
): Collection {
  const store = self._store;
  const targets = parentTargets(self, collapsed);

  if (targets.length === 0) {
    return self;
  }

  const scales = new Map<number, number>();

  for (const slot of targets) {
    scales.set(slot, collapsed ? store.collapseScaleOf(slot) : 1);
  }

  validateProjectedScales(store, scales);

  if (timing != null) {
    const ani = createCollapsedAnimation(self, {
      ...timing,
      collapsed,
    });

    self._cy._animations.start(ani);

    return self;
  }

  applyCollapsedTargets(
    self,
    targets.map((slot) => ({
      slot,
      collapsed,
      scale: scales.get(slot) as number,
    })),
  );

  return self;
}

/** Build a collapsed-state animation with ownership over the geometry it refreshes. */
export function createCollapsedAnimation(
  self: Collection,
  opts: AnimateOptions,
): Animation {
  if (opts.collapsed == null) {
    throw new Error('A collapsed animation requires a collapsed target');
  }

  if (
    opts.style != null ||
    opts.position != null ||
    opts.pan != null ||
    opts.panBy != null ||
    opts.zoom != null ||
    opts.fit != null ||
    opts.center != null
  ) {
    throw new Error(
      'The collapsed target cannot be combined with other animation targets',
    );
  }

  const targets = parentTargets(self, opts.collapsed);
  const scales = new Map<number, number>();

  for (const slot of targets) {
    scales.set(slot, opts.collapsed ? self._store.collapseScaleOf(slot) : 1);
  }

  validateProjectedScales(self._store, scales);

  const ani = new Animation(
    self._store,
    null,
    collapseOwnerRefs(self._store, targets),
    false,
    opts,
    self._cy._styleEngine,
  );

  ani.collapsedDriver = new CollapsedTween(self, targets, opts.collapsed);

  return ani;
}

/** Reconcile a live style target change through the immediate collapse path. */
export function retargetCollapsedScale(self: Collection, slot: number): void {
  const store = self._store;

  if (
    !store.isCollapsed(slot) ||
    !store.hasFlag(GROUP_NODES, slot, FLAG_PARENT)
  ) {
    return;
  }

  applyCollapsedTargets(self, [
    { slot, collapsed: true, scale: store.collapseScaleOf(slot) },
  ]);
}

interface CollapseTarget {
  slot: number;
  collapsed: boolean;
  scale: number;
}

interface CollapseTrack extends CollapseTarget {
  fromCollapsed: boolean;
  fromScale: number;
}

class CollapsedTween implements CollapsedAnimationDriver {
  private readonly self: Collection;
  private readonly targets: number[];
  private readonly collapsed: boolean;
  private tracks: CollapseTrack[] = [];
  private captured = false;

  constructor(self: Collection, targets: number[], collapsed: boolean) {
    this.self = self;
    this.targets = targets;
    this.collapsed = collapsed;
  }

  capture(): void {
    if (this.captured) {
      return;
    }

    const store = this.self._store;
    const projected = new Map<number, number>();

    for (const slot of this.targets) {
      const fromCollapsed = store.isCollapsed(slot);
      const fromScale = fromCollapsed ? store.appliedCollapseScaleOf(slot) : 1;
      const toScale = this.collapsed ? store.collapseScaleOf(slot) : 1;

      projected.set(slot, toScale);
      this.tracks.push({
        slot,
        fromCollapsed,
        fromScale,
        collapsed: this.collapsed,
        scale: toScale,
      });
    }

    validateProjectedScales(store, projected);

    // Collapse state is observable from the first frame; expansion keeps
    // the flag until its final frame. Install all starts before notifying.
    const newlyCollapsed: number[] = [];

    for (const track of this.tracks) {
      if (track.collapsed && !track.fromCollapsed) {
        store.setCollapsed(track.slot, true, track.fromScale);
        newlyCollapsed.push(track.slot);
      }
    }

    this.captured = true;

    for (const slot of newlyCollapsed) {
      this.self._cy._emitOnEle(
        'collapse',
        this.self._cy._ele(GROUP_NODES, slot),
      );
    }
  }

  apply(progress: number): void {
    this.capture();

    if (this.tracks.length === 0) {
      return;
    }

    const store = this.self._store;
    const e = Math.max(0, Math.min(1, progress));
    const refreshSlots: number[] = [];
    const movedSlots = new Set<number>();
    const completedEvents: { slot: number; type: 'collapse' | 'expand' }[] = [];

    for (const track of this.tracks) {
      const wasCollapsed = store.isCollapsed(track.slot);
      const oldScale = store.appliedCollapseScaleOf(track.slot);
      const nextScale = track.fromScale + (track.scale - track.fromScale) * e;
      const atEnd = e >= 1;
      const nextCollapsed = atEnd
        ? track.collapsed
        : track.fromCollapsed || track.collapsed;
      const ratio = nextScale / oldScale;

      if (!Number.isFinite(ratio) || ratio <= 0) {
        throw new Error('collapse scale change is not representable');
      }

      const moved = store.rescaleDescendants(
        track.slot,
        ratio,
        this.self._cy.autolock() === true,
      );

      for (const slot of moved) {
        movedSlots.add(slot);
      }

      store.setCollapsed(track.slot, nextCollapsed, nextScale);

      if (ratio !== 1 || wasCollapsed !== nextCollapsed) {
        refreshSlots.push(track.slot);
      }

      if (wasCollapsed !== nextCollapsed) {
        completedEvents.push({
          slot: track.slot,
          type: nextCollapsed ? 'collapse' : 'expand',
        });
      }
    }

    if (refreshSlots.length > 0) {
      refreshCollapsedGeometry(this.self, refreshSlots);
    }

    for (const slot of movedSlots) {
      this.self._cy._emitOnEle(
        'position',
        this.self._cy._ele(GROUP_NODES, slot),
      );
    }

    for (const event of completedEvents) {
      this.self._cy._emitOnEle(
        event.type,
        this.self._cy._ele(GROUP_NODES, event.slot),
      );
    }
  }

  swapEnds(): void {
    for (const track of this.tracks) {
      const scale = track.fromScale;
      track.fromScale = track.scale;
      track.scale = scale;

      const collapsed = track.fromCollapsed;
      track.fromCollapsed = track.collapsed;
      track.collapsed = collapsed;
    }
  }
}

function parentTargets(self: Collection, collapsed: boolean): number[] {
  const targets: number[] = [];
  const seen = new Set<number>();
  const flags = self._store.hotNodeFlags();

  for (const ref of self._refs) {
    if (!self._store.isCurrent(ref)) {
      continue;
    }

    if (ref.group !== GROUP_NODES || (flags[ref.slot] & FLAG_PARENT) === 0) {
      throw new Error(
        `${collapsed ? 'collapse()' : 'expand()'} requires compound parents`,
      );
    }

    if (!seen.has(ref.slot)) {
      seen.add(ref.slot);
      targets.push(ref.slot);
    }
  }

  sortParentSlots(self._store, targets);

  return targets;
}

function sortParentSlots(store: Collection['_store'], slots: number[]): void {
  const depth = (slot: number): number => {
    let n = 0;

    for (let p = store.parentOf(slot); p >= 0; p = store.parentOf(p)) {
      n++;
    }

    return n;
  };

  slots.sort((a, b) => depth(a) - depth(b) || a - b);
}

function validateProjectedScales(
  store: Collection['_store'],
  projectedScale: ReadonlyMap<number, number>,
): void {
  for (const slot of store.slotsOrdered(GROUP_NODES)) {
    let factor = 1;

    for (let p = store.parentOf(slot); p >= 0; p = store.parentOf(p)) {
      if (projectedScale.has(p)) {
        factor *= projectedScale.get(p) as number;
      } else if (store.isCollapsed(p)) {
        factor *= store.appliedCollapseScaleOf(p);
      }
    }

    if (!Number.isFinite(factor) || Math.fround(factor) === 0) {
      throw new Error('collapse scale would underflow effective geometry');
    }

    const [width, height] = store.baseSizeOf(slot);
    const effectiveWidth = Math.fround(width * factor);
    const effectiveHeight = Math.fround(height * factor);

    if (
      !Number.isFinite(effectiveWidth) ||
      !Number.isFinite(effectiveHeight) ||
      (width > 0 && effectiveWidth === 0) ||
      (height > 0 && effectiveHeight === 0)
    ) {
      throw new Error('collapse scale would underflow effective geometry');
    }
  }
}

function collapseOwnerRefs(
  store: Collection['_store'],
  parents: readonly number[],
): Ref[] {
  const nodes = new Set<number>(parents);

  for (const parent of parents) {
    for (const slot of descendantSlots(store, parent)) {
      nodes.add(slot);
    }
  }

  const refs = [...nodes].map((slot) => store.ref(GROUP_NODES, slot));
  const edges = new Set<number>();

  for (const slot of nodes) {
    for (const edge of store.adj.connectedEdges(slot)) {
      edges.add(edge);
    }
  }

  for (const edge of edges) {
    refs.push(store.ref(GROUP_EDGES, edge));
  }

  return refs;
}

function applyCollapsedTargets(
  self: Collection,
  targets: readonly CollapseTarget[],
): void {
  const store = self._store;
  const projected = new Map<number, number>();

  for (const target of targets) {
    projected.set(target.slot, target.scale);
  }

  validateProjectedScales(store, projected);

  const ownerRefs = collapseOwnerRefs(
    store,
    targets.map((target) => target.slot),
  );

  self._cy._animations.interruptCollapsedRefs(ownerRefs);
  const refreshSlots: number[] = [];
  const movedSlots = new Set<number>();
  const changedStates: CollapseTarget[] = [];

  for (const target of targets) {
    store.flushDerived();

    const wasCollapsed = store.isCollapsed(target.slot);
    const oldScale = store.appliedCollapseScaleOf(target.slot);

    if (wasCollapsed === target.collapsed && oldScale === target.scale) {
      continue;
    }

    const ratio = target.scale / oldScale;

    if (!Number.isFinite(ratio) || ratio <= 0) {
      throw new Error('collapse scale change is not representable');
    }

    const moved = store.rescaleDescendants(
      target.slot,
      ratio,
      self._cy.autolock() === true,
    );

    for (const slot of moved) {
      movedSlots.add(slot);
    }

    store.setCollapsed(target.slot, target.collapsed, target.scale);

    if (ratio !== 1 || wasCollapsed !== target.collapsed) {
      refreshSlots.push(target.slot);
    }

    if (wasCollapsed !== target.collapsed) {
      changedStates.push(target);
    }
  }

  if (refreshSlots.length > 0) {
    refreshCollapsedGeometry(self, refreshSlots);
  } else {
    store.flushDerived();
  }

  for (const slot of movedSlots) {
    self._cy._emitOnEle('position', self._cy._ele(GROUP_NODES, slot));
  }

  for (const target of changedStates) {
    self._cy._emitOnEle(
      target.collapsed ? 'collapse' : 'expand',
      self._cy._ele(GROUP_NODES, target.slot),
    );
  }
}

function descendantSlots(store: Collection['_store'], slot: number): number[] {
  const descendants: number[] = [];
  const stack = [...store.childrenOf(slot)];

  while (stack.length > 0) {
    const child = stack.pop() as number;

    descendants.push(child);

    for (const nested of store.childrenOf(child)) {
      stack.push(nested);
    }
  }

  return descendants;
}

/**
 * Re-apply geometry after collapse state has been adopted without moving
 * descendant positions. Multiple parent slots may be supplied so snapshot
 * and follow adoption can install all factors before refreshing once.
 *
 * @param self — a collection from the core whose store carries the adopted state
 * @param parentSlots — adopted parent slots whose descendant geometry is stale
 */
export function refreshCollapsedGeometry(
  self: Collection,
  parentSlots: readonly number[],
): void {
  const store = self._store;
  const descendants = new Set<number>();

  for (const parent of parentSlots) {
    for (const child of descendantSlots(store, parent)) {
      descendants.add(child);
    }
  }

  refreshGeometryForNodes(self, [...descendants]);
}

/** Re-apply inherited geometry after a subtree changes compound parents. */
export function refreshReparentedGeometry(
  self: Collection,
  rootSlots: readonly number[],
): void {
  const store = self._store;
  const nodes = new Set<number>();

  for (const root of rootSlots) {
    nodes.add(root);

    for (const child of descendantSlots(store, root)) {
      nodes.add(child);
    }
  }

  refreshGeometryForNodes(self, [...nodes]);
}

function refreshGeometryForNodes(self: Collection, nodeSlots: number[]): void {
  const store = self._store;

  if (nodeSlots.length > 0) {
    self._cy._styleEngine.applyBulk(GROUP_NODES, nodeSlots);
  }

  const edgeSlots = new Set<number>();

  for (const slot of nodeSlots) {
    for (const edge of store.adj.connectedEdges(slot)) {
      edgeSlots.add(edge);
    }
  }

  if (edgeSlots.size > 0) {
    self._cy._styleEngine.applyBulk(GROUP_EDGES, [...edgeSlots]);
  }

  store.flushDerived();
}

/** The first ref when it is a live node, else null — the raw-ref fast read the compound predicates share (the 62.6 shape). */
export function _liveNodeRef(self: Collection): Ref | null {
  // raw ref + isCurrent (which repairs a forwarded ref in place)
  // instead of the syncing getter — the 62.6 fast-read shape
  const ref = self.__refs[0];

  return ref != null && ref.group === GROUP_NODES && self._store.isCurrent(ref)
    ? ref
    : null;
}

/** The nodes with no incoming (`direction` 'in': roots) or outgoing ('out': leaves) edges, filtered by `criterion`. */
export function _dagExtremity(
  self: Collection,
  direction: 'in' | 'out',
  criterion?: FilterLike,
): Collection {
  const store = self._store;
  const adj = store.adj;
  const endpoints = store.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const refs: Ref[] = [];

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group !== GROUP_NODES || !store.isCurrent(ref)) {
      continue;
    }

    const edges =
      direction === 'in' ? adj.inEdges(ref.slot) : adj.outEdges(ref.slot);
    let disqualified = false;

    for (let j = 0; j < edges.length; j++) {
      const edgeSlot = edges[j];

      // a loop (source === target) never disqualifies
      if (endpoints[edgeSlot * 2] !== endpoints[edgeSlot * 2 + 1]) {
        disqualified = true;
        break;
      }
    }

    if (!disqualified) {
      refs.push(ref);
    }
  }

  const eles = self._spawnLive(refs);

  return criterion == null ? eles : eles.filter(criterion);
}

/** Every node reachable along `direction` from the collection's nodes, with the edges walked — `successors` and `predecessors`. */
export function _dagAllHops(
  self: Collection,
  direction: 'out' | 'in',
  criterion?: FilterLike,
): Collection {
  const store = self._store;
  const adj = store.adj;
  const endpoints = store.column(COL.EDGE_ENDPOINTS) as Uint32Array;
  const acc: Ref[] = [];
  // packed (group, slot) keys: node = slot * 2, edge = slot * 2 + 1;
  // a raw slot BFS — no per-hop collection spawns or handle interning
  const seen = new Set<number>();
  let frontier: number[] = [];

  for (let i = 0; i < self._refs.length; i++) {
    const ref = self._refs[i];

    if (ref.group === GROUP_NODES && store.isCurrent(ref)) {
      frontier.push(ref.slot);
    }
  }

  while (frontier.length > 0) {
    const next: number[] = [];

    for (let i = 0; i < frontier.length; i++) {
      const nodeSlot = frontier[i];
      const edgeSlots =
        direction === 'out' ? adj.outEdges(nodeSlot) : adj.inEdges(nodeSlot);

      for (let j = 0; j < edgeSlots.length; j++) {
        const edgeSlot = edgeSlots[j];
        const otherSlot =
          direction === 'out'
            ? endpoints[edgeSlot * 2 + 1]
            : endpoints[edgeSlot * 2];

        if (!seen.has(edgeSlot * 2 + 1)) {
          seen.add(edgeSlot * 2 + 1);
          acc.push(store.ref(GROUP_EDGES, edgeSlot));
        }

        if (!seen.has(otherSlot * 2)) {
          seen.add(otherSlot * 2);
          acc.push(store.ref(GROUP_NODES, otherSlot));
          next.push(otherSlot);
        }
      }
    }

    frontier = next;
  }

  const out = self._spawnLive(acc);

  return criterion == null ? out : out.filter(criterion);
}
