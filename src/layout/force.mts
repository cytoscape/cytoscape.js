/*
The built-in `force` layout (round 18.2): the round-17 extension
contract's first production consumer — `cy.layout({ name: 'force' })`
simply wraps ForceLayoutImpl in the same CustomLayout plumbing an
external layout would use.

Executors: the CPU reference simulation always exists (headless
instances, compound graphs — a GPU lease would leave the CPU columns
the auto-bounds derivation reads stale, the 14.11 rule) and is the
correctness spec; the GPU fast path (18.3) takes over per-iteration
integration for flat rendered graphs regardless of how the run is
shown (87.2 — presentation is not what picks the executor).

Presentation (114.5): `animate: true` means what it means for every
other layout — the sim settles silently, then the nodes tween from
where they are to where they landed through the shared finisher, the
viewport fitting alongside.  `animateLive: true` is the streaming run
(the pre-114 `animate: true`): positions land per frame while the sim
runs, presenting each frame on the GPU executor.  Either way a
rendered flat-graph run is async — read positions at `layoutstop` /
`promise()`.

Overlap (114.5; the dense case rebuilt in 115): the sim is point-based,
so `avoidOverlap` (default true) separates node bodies — labels on
request (`nodeDimensionsIncludeLabels`) — after the
settle, pinned nodes as obstacles, before the component re-pack.  A
constructive rule cannot exist for a force field, so this is the one
post-pass in the layout portfolio; invisible under the tween, an
end-of-run adjustment under `animateLive` (the same class as the
re-pack shift 59.2 recorded).

Scoping: leaves only (parents derive from their placed children);
locked nodes are *pinned* — they take part in every force pair but
never move; subset scopes (`eles.layout`) simulate the subset only,
non-members ignored entirely (recorded).
*/

import { FLAG_LOCKED, FLAG_PARENT } from '../contract.mjs';
import { ForceSim, defaultForceParams } from './force-sim.mjs';
import {
  computeComponents,
  packAnchors,
  packComponentBodies,
} from './pack.mjs';
import type { LayoutNodeDims } from './dims.mjs';
import { separationAlong } from './separation.mjs';
import { seedAroundAnchors, spectralSeed } from './force-init.mjs';
import {
  checkScoreColumn,
  isScoreMapping,
  resolveScores,
  validateScoreMapping,
} from './layout-mapping.mjs';
import { resolveConstraints } from './force-constraints.mjs';
import type {
  AlignmentSpec,
  RelativePlacementSpec,
} from './force-constraints.mjs';
import type { LayoutScoreMapping } from '../public-types.mjs';
import type { LayoutContext, LayoutImpl } from './contract.mjs';
import type { Collection } from '../collection.mjs';
import type { Renderer } from '../render/renderer.mjs';
import type { GpuForceRuntime } from '../render/gpu-force.mjs';

export interface ForceRunOptions {
  /** ideal edge length: a number; a `{ data, scale?, range?, invert?,
   * default? }` score mapping (85.3 — the canonical, serializable
   * spelling); or a plain function of the edge handle.  Resolved once
   * at start either way (the algorithms-round rule) */
  edgeLength?: number | LayoutScoreMapping | ((edge: Collection) => number);
  repulsion?: number;
  stiffness?: number;
  gravity?: number;
  decay?: number;
  iterations?: number;
  threshold?: number;
  seed?: number;
  /** fresh seeded scatter (true) vs relaxing the current positions */
  randomize?: boolean;
  /** tween the nodes from their current positions to the settled ones
   * through the shared finisher (114.5 — the discrete layouts'
   * meaning), the viewport fitting alongside; `spacingFactor`,
   * `transform`, `animateFilter`, `animationDuration`,
   * `animationEasing`, `zoom` and `pan` apply.  False lands the settle
   * in one write.  Executor choice is availability-driven either way
   * (87.2), so a rendered flat-graph run is async for both values —
   * read positions at `layoutstop` / `promise()`.  Headless runs with
   * `animate: false` stay synchronous. */
  animate?: boolean;
  /** stream the run: positions land per frame while the sim runs,
   * presenting each frame on the GPU executor (the pre-114 `animate:
   * true`).  Takes precedence over `animate`; the settle's overlap
   * separation and re-pack land as one end-of-run adjustment. */
  animateLive?: boolean;
  fit?: boolean;
  padding?: number;
  /** iterations advanced per animation frame (animateLive: true) */
  stepsPerFrame?: number;
  /** separate overlapping node bodies after the settle (114.5; default
   * true) — labels included only when `nodeDimensionsIncludeLabels` is
   * false, pinned (locked) nodes as obstacles */
  avoidOverlap?: boolean;
  /** the gap kept between separated bodies (default 10) */
  avoidOverlapPadding?: number;
  /** the boxes overlap avoidance reads: bodies and labels (default) or
   * bodies alone */
  nodeDimensionsIncludeLabels?: boolean;
  /** the gap between disconnected components' packed boxes (59.2;
   * v3 cose's option of the same name — default 40) */
  componentSpacing?: number;
  /** what a fresh placement is (59.4): 'spectral' (the default —
   * landmark-MDS per component, the global untangling) or 'scatter'
   * (the plain seeded scatter).  Ignored under `randomize: false`. */
  init?: 'spectral' | 'scatter';
  /** ideal-length multiplier per compound boundary an edge spans
   * (59.5; v3 cose's rule — length × levels × nestingFactor; 1.2) */
  nestingFactor?: number;
  /** the compound centroid pull, as a multiple of `gravity` (59.5;
   * the Bilkent line's gravityCompound — default 1.5) */
  gravityCompound?: number;
  /** alignment constraints (85.2, fcose's shape): `horizontal` groups
   * share a y coordinate, `vertical` groups an x; id arrays,
   * serializable; groups sharing a node merge transitively.  A locked
   * member pins its group's coordinate.  Constrained runs take the
   * CPU executor (the compound precedent — see run()).
   * @throws at start on an unknown id, or two locked members of one
   *   group at different coordinates */
  alignment?: AlignmentSpec;
  /** relative-placement constraints (85.2):
   * `{ left, right, gap? }` keeps left at least `gap` px left of
   * right (`{ top, bottom, gap? }` likewise vertically), `gap`
   * defaulting to the run's mean ideal edge length.
   * @throws at start on an unknown id, a malformed entry, or a cycle
   *   in either axis's placement DAG */
  relativePlacement?: RelativePlacementSpec;
}

const DEFAULT_EDGE_LENGTH = 60;

/** local sweeps tried first — the sparse case clears in one or two */
const SEPARATE_SWEEPS = 8;

/** the most a pair's distance is asked to grow in one stress round */
const SEPARATE_GROWTH_CAP = 1.5;

/** a clear pair's weight relative to an overlapping pair's: the holds
 * keep the structure but must not out-vote the pile's expansion */
const SEPARATE_HOLD_WEIGHT = 0.25;

/** stress iterations per proximity graph */
const SEPARATE_STRESS_ITERATIONS = 20;

/** clear neighbours each node keeps in the proximity graph — the
 * nearest few stand in for a Delaunay neighbourhood; every overlapping
 * pair is kept regardless */
const SEPARATE_NEAREST = 6;

/** proximity-stress rounds before the separation gives up */
const SEPARATE_ROUNDS = 40;

/** the closing sweep budget for the residue */
const SEPARATE_SWEEPS_FINAL = 64;

/**
 * Separate overlapping node bodies in place (114.5; the dense case
 * rebuilt in 115).  Deterministic (fixed order, fixed tie rules):
 *
 * 1. **Local sweeps** — a uniform grid hashed by the largest box, so
 *    any two overlapping boxes share a 3 x 3 neighbourhood; then
 *    Gauss–Seidel sweeps in index order pushing each overlapping pair
 *    apart along the axis of smaller overlap — half each when both
 *    move, all of it onto the free node when one is pinned, nothing
 *    when both are.  Clears the sparse case (a settled field has few
 *    overlaps) in a sweep or two.
 * 2. **Proximity stress** — a dense pile (a clique of wide labels)
 *    expands under pairwise pushes only slowly, and 114.5's answer,
 *    scaling the whole component by its *worst* pair's factor, spread
 *    every settled graph several times over: two nodes the sim left
 *    a pixel apart asked for the cap.  What lands instead is PRISM's
 *    proximity stress (Gansner & Hu): over the pairs that share a
 *    grid neighbourhood, an overlapping pair's target distance is its
 *    current distance times the factor that separates it along its
 *    own direction (capped per round), a clear pair's target is its
 *    current distance, and a few stress-majorization iterations move
 *    every node to the weighted average its neighbours ask for.  The
 *    graph is thinned to each node's nearest few clear neighbours
 *    (PRISM's Delaunay neighbourhood, approximately) — every clear
 *    pair in a 3 x 3 cell block would hold the pile rigid — so the
 *    pile opens locally, the clear pairs hold the structure around
 *    it, and the far field never moves.
 * 3. **Local sweeps** again for the residue.
 *
 * @param n — sim node count
 * @param pos — 2n interleaved positions, moved in place
 * @param dims — the padded node-local boxes, sim-indexed
 * @param pinned — per-node 1 when the node must not move
 * @param compOf — per-node component id
 * @param count — component count
 */
const separateBodies = (
  n: number,
  pos: Float32Array,
  dims: LayoutNodeDims,
  pinned: Uint8Array,
  compOf: Int32Array,
  count: number,
): void => {
  if (n < 2 || count < 1) {
    return;
  }

  const cell = Math.max(dims.maxW, dims.maxH, 1);
  const cellOf = new Int32Array(n);
  const order = new Int32Array(n);

  // visit every pair (j > i) sharing a 3 x 3 cell neighbourhood once,
  // over a grid built from the positions as they stand at the call,
  // with the pair's overlap on each axis (non-positive when clear);
  // `visit` may move nodes.  Returns whether any pair overlapped.
  const forEachNear = (
    visit: (i: number, j: number, ox: number, oy: number) => void,
    overlappingOnly: boolean,
  ): boolean => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, pos[i * 2]);
      maxX = Math.max(maxX, pos[i * 2]);
      minY = Math.min(minY, pos[i * 2 + 1]);
      maxY = Math.max(maxY, pos[i * 2 + 1]);
    }

    const cols = Math.max(1, Math.floor((maxX - minX) / cell) + 1);
    const rows = Math.max(1, Math.floor((maxY - minY) / cell) + 1);
    const start = new Int32Array(cols * rows + 1);

    for (let i = 0; i < n; i++) {
      const cx = Math.min(cols - 1, Math.floor((pos[i * 2] - minX) / cell));
      const cy = Math.min(rows - 1, Math.floor((pos[i * 2 + 1] - minY) / cell));

      cellOf[i] = cy * cols + cx;
      start[cellOf[i] + 1]++;
    }

    for (let c = 0; c < cols * rows; c++) {
      start[c + 1] += start[c];
    }

    const fill = start.slice(0, cols * rows);

    for (let i = 0; i < n; i++) {
      order[fill[cellOf[i]]++] = i;
    }

    let found = false;

    for (let i = 0; i < n; i++) {
      const ci = cellOf[i];
      const cx = ci % cols;
      const cy = (ci - cx) / cols;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;

        if (ny < 0 || ny >= rows) {
          continue;
        }

        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;

          if (nx < 0 || nx >= cols) {
            continue;
          }

          const c = ny * cols + nx;

          for (let k = start[c]; k < start[c + 1]; k++) {
            const j = order[k];

            if (j <= i) {
              continue;
            }

            const ax = pos[i * 2];
            const ay = pos[i * 2 + 1];
            const bx = pos[j * 2];
            const by = pos[j * 2 + 1];
            const ox =
              Math.min(ax + dims.x2[i], bx + dims.x2[j]) -
              Math.max(ax + dims.x1[i], bx + dims.x1[j]);
            const oy =
              Math.min(ay + dims.y2[i], by + dims.y2[j]) -
              Math.max(ay + dims.y1[i], by + dims.y1[j]);
            const overlapping = ox > 0 && oy > 0;

            if (overlapping) {
              found = true;
            } else if (overlappingOnly) {
              continue;
            }

            visit(i, j, ox, oy);
          }
        }
      }
    }

    return found;
  };

  const push = (i: number, j: number, ox: number, oy: number): void => {
    if (pinned[i] === 1 && pinned[j] === 1) {
      return;
    }

    // along the axis of smaller overlap, a hair past touching; the
    // lower index goes to the negative side on a tie
    const alongX = ox <= oy;
    const axis = alongX ? 0 : 1;
    const amount = (alongX ? ox : oy) + 0.5;
    const ca = pos[i * 2 + axis];
    const cb = pos[j * 2 + axis];
    const sign = ca < cb || (ca === cb && i < j) ? -1 : 1;
    const shareA = pinned[i] === 1 ? 0 : pinned[j] === 1 ? 1 : 0.5;

    pos[i * 2 + axis] += sign * amount * shareA;
    pos[j * 2 + axis] -= sign * amount * (1 - shareA);
  };

  const sweeps = (limit: number): boolean => {
    for (let k = 0; k < limit; k++) {
      if (!forEachNear(push, true)) {
        return false;
      }
    }

    return true;
  };

  // phase 2: one proximity-stress round — gather the near pairs with
  // their target distances, then majorize.  Returns false when no
  // pair overlapped (nothing to do).
  const candI: number[] = [];
  const candJ: number[] = [];
  const candD: number[] = [];
  const candOverlap: number[] = [];
  const pairI: number[] = [];
  const pairJ: number[] = [];
  const target: number[] = [];
  const holdOf: number[] = [];
  const sumW = new Float64Array(n);
  const accX = new Float64Array(n);
  const accY = new Float64Array(n);
  const nearest = new Float64Array(n * SEPARATE_NEAREST);

  const stressRound = (): boolean => {
    candI.length = 0;
    candJ.length = 0;
    candD.length = 0;
    candOverlap.length = 0;

    const found = forEachNear((i, j, ox, oy) => {
      if (compOf[i] !== compOf[j]) {
        return; // cross-component overlap is the re-pack's job
      }
      if (pinned[i] === 1 && pinned[j] === 1) {
        return;
      }

      candI.push(i);
      candJ.push(j);
      candD.push(
        Math.hypot(pos[j * 2] - pos[i * 2], pos[j * 2 + 1] - pos[i * 2 + 1]),
      );
      candOverlap.push(ox > 0 && oy > 0 ? 1 : 0);
    }, false);

    if (!found) {
      return false;
    }

    // thin the clear pairs: each node keeps its nearest few (the
    // distance threshold per node is its k-th nearest candidate)
    nearest.fill(Infinity);

    for (let p = 0; p < candI.length; p++) {
      for (const node of [candI[p], candJ[p]]) {
        const base = node * SEPARATE_NEAREST;
        const d = candD[p];

        if (d < nearest[base + SEPARATE_NEAREST - 1]) {
          let k = SEPARATE_NEAREST - 1;

          while (k > 0 && nearest[base + k - 1] > d) {
            nearest[base + k] = nearest[base + k - 1];
            k--;
          }

          nearest[base + k] = d;
        }
      }
    }

    pairI.length = 0;
    pairJ.length = 0;
    target.length = 0;
    holdOf.length = 0;

    for (let p = 0; p < candI.length; p++) {
      const i = candI[p];
      const j = candJ[p];
      const overlapping = candOverlap[p] === 1;

      if (
        !overlapping &&
        candD[p] > nearest[i * SEPARATE_NEAREST + SEPARATE_NEAREST - 1] &&
        candD[p] > nearest[j * SEPARATE_NEAREST + SEPARATE_NEAREST - 1]
      ) {
        continue;
      }

      let dx = pos[j * 2] - pos[i * 2];
      let dy = pos[j * 2 + 1] - pos[i * 2 + 1];
      let d = candD[p];

      if (d < 1e-6) {
        // coincident: a deterministic pseudo-direction from the indices
        const a = ((i * 7919 + j * 104729) % 360) * (Math.PI / 180);

        dx = Math.cos(a);
        dy = Math.sin(a);
        d = 1e-6;
      } else {
        dx /= d;
        dy /= d;
      }

      let t = d;

      if (overlapping) {
        const need = separationAlong(dims, i, j, dx, dy) + 0.5;

        t = Math.min(need, d * SEPARATE_GROWTH_CAP);
        t = Math.max(t, d); // never pull an overlapping pair closer
      }

      pairI.push(i);
      pairJ.push(j);
      target.push(t);
      holdOf.push(overlapping ? 0 : 1);
    }

    for (let it = 0; it < SEPARATE_STRESS_ITERATIONS; it++) {
      sumW.fill(0);
      accX.fill(0);
      accY.fill(0);

      for (let p = 0; p < pairI.length; p++) {
        const i = pairI[p];
        const j = pairJ[p];
        const t = target[p];
        const w = (holdOf[p] === 1 ? SEPARATE_HOLD_WEIGHT : 1) / (t * t);
        let dx = pos[j * 2] - pos[i * 2];
        let dy = pos[j * 2 + 1] - pos[i * 2 + 1];
        const d = Math.hypot(dx, dy);

        if (d < 1e-6) {
          const a = ((i * 7919 + j * 104729) % 360) * (Math.PI / 180);

          dx = Math.cos(a);
          dy = Math.sin(a);
        } else {
          dx /= d;
          dy /= d;
        }

        // each end's wish: the other end, plus the target along the pair
        accX[i] += w * (pos[j * 2] - t * dx);
        accY[i] += w * (pos[j * 2 + 1] - t * dy);
        accX[j] += w * (pos[i * 2] + t * dx);
        accY[j] += w * (pos[i * 2 + 1] + t * dy);
        sumW[i] += w;
        sumW[j] += w;
      }

      for (let i = 0; i < n; i++) {
        if (pinned[i] === 1 || sumW[i] === 0) {
          continue;
        }

        pos[i * 2] = accX[i] / sumW[i];
        pos[i * 2 + 1] = accY[i] / sumW[i];
      }
    }

    return true;
  };

  if (!sweeps(SEPARATE_SWEEPS)) {
    return;
  }

  for (let round = 0; round < SEPARATE_ROUNDS; round++) {
    if (!stressRound()) {
      break;
    }
  }

  sweeps(SEPARATE_SWEEPS_FINAL);
};

/**
 * The built-in force layout (round 18; model rebuilt in round 59):
 * spring–electric with uniform-grid repulsion, degree-normalised
 * springs toward per-edge ideal lengths, component-aware
 * constant-magnitude gravity, and capped damped gradient integration
 * under d3-shaped alpha annealing.  Disconnected components lay out
 * around packed anchors and are re-packed exactly at settle
 * (`componentSpacing`), so multi-component graphs neither interleave
 * nor drift.
 *
 * It is an ordinary consumer of the round-17 extension contract — the
 * built-in is the contract's first production user, so an external
 * layout has exactly the same capabilities.
 *
 * Deviations worth knowing: GPU trajectories are not bit-stable run to
 * run because in-cell scatter order is atomic — seeded
 * bit-reproducibility is the CPU executor's guarantee, and the two
 * executors agree on invariants, not trajectories.  The settle re-pack
 * is skipped whenever the scope holds a pinned (locked) node, since a
 * re-pack translates whole components and a locked node must never
 * move.
 */
export class ForceLayoutImpl implements LayoutImpl {
  private stopped = false;

  /**
   * Run the simulation.  Two executors, one spec: the CPU reference is
   * always available (headless instances, compound graphs, no device)
   * and is what the specs pin, while on a flat rendered graph the GPU
   * integrator takes over however the run is shown (87.2 —
   * availability-driven, not presentation-driven): seven named passes
   * plus a per-level reduce per iteration, encoded ahead of the cull
   * pass, so 100k-node layouts settle with edges and labels following
   * on-device.
   *
   * Presentation (114.5): `animateLive` streams — a presenting run owns
   * `node.position` (the tween lease), so CPU position reads are stale
   * for the duration.  Otherwise the run publishes off-mirror, the
   * screen holds the pre-run frame, and convergence triggers a single
   * readback that settles the columns — then `animate: true` tweens
   * the nodes into place through the shared finisher.  A rendered
   * flat-graph run is async either way, settling at `layoutstop` /
   * `promise()`; headless `animate: false` is the synchronous spelling.
   *
   * @param ctx — the layout context: unlocked leaf slots, live position
   *   views, O(1) CSR degrees and the bulk `setPositions` write
   * @returns a promise that resolves at convergence, or void when the
   *   run completed synchronously (headless / compound / no device
   *   with neither `animate` nor `animateLive`)
   */
  run(ctx: LayoutContext): void | Promise<void> {
    const cy = ctx.cy;
    const store = cy._store;
    const options = ctx.options as ForceRunOptions;
    const params = { ...defaultForceParams() };

    if (options.repulsion != null) {
      params.repulsion = options.repulsion;
    }
    if (options.stiffness != null) {
      params.stiffness = options.stiffness;
    }
    if (options.gravity != null) {
      params.gravity = options.gravity;
    }
    if (options.decay != null) {
      params.decay = options.decay;
    }
    if (options.iterations != null) {
      params.iterations = options.iterations;
    }
    if (options.threshold != null) {
      params.threshold = options.threshold;
    }
    if (
      options.init != null &&
      options.init !== 'spectral' &&
      options.init !== 'scatter'
    ) {
      throw new Error(
        `force layout: unknown init '${String(options.init)}' — ` +
          `'spectral' (default) or 'scatter'`,
      );
    }

    // the sim set: every leaf in scope — unlocked ones move, locked
    // ones pin in place as obstacles
    const flags = store.column('node.flags') as Uint32Array;
    const simSlots: number[] = [];
    const simIndex = new Map<number, number>();

    for (let i = 0; i < ctx.nodes.length; i++) {
      const ref = ctx.nodes[i]._eventRef();

      if (ref == null || !ctx.nodes[i].inside()) {
        continue;
      }
      if ((flags[ref.slot] & FLAG_PARENT) !== 0) {
        continue;
      }

      simIndex.set(ref.slot, simSlots.length);
      simSlots.push(ref.slot);
    }

    const n = simSlots.length;

    if (n === 0) {
      return;
    }

    const pinned = new Uint8Array(n);
    const movable: number[] = [];
    const lockAll = cy.autolock() === true; // 114.3: autolock pins them all

    for (let i = 0; i < n; i++) {
      if (lockAll || (flags[simSlots[i]] & FLAG_LOCKED) !== 0) {
        pinned[i] = 1;
      } else {
        movable.push(i);
      }
    }

    // the boxes the settle separates (114.5): bodies plus labels by
    // default, padded by half the gap per side
    const avoidOverlap = options.avoidOverlap !== false;
    const dims = ctx.nodeDimensions(simSlots, {
      padding: avoidOverlap ? (options.avoidOverlapPadding ?? 10) : 0,
    });
    const live = options.animateLive === true;

    // scope edges whose both endpoints simulate
    const endpoints = ctx.endpoints();
    const simEdges: number[] = [];
    const lengths: number[] = [];
    const lengthOf = options.edgeLength;

    // nesting (59.5): an edge spanning compound boundaries takes an
    // elevated ideal length — v3 cose's rule, length × levels ×
    // nestingFactor, levels = both ends' depths below their lowest
    // common ancestor compound
    const hasCompounds = store.hasCompounds();
    const nestingFactor = options.nestingFactor ?? 1.2;
    const spannedLevels = (a: number, b: number): number => {
      if (!hasCompounds) {
        return 0;
      }

      const chain = (slot: number): number[] => {
        const out: number[] = [];
        let at = store.parentOf(slot);

        while (at >= 0) {
          out.push(at);
          at = store.parentOf(at);
        }

        return out;
      };
      const ca = chain(a);
      const cb = chain(b);

      // walk back from the root ends while the ancestors agree
      let ia = ca.length - 1;
      let ib = cb.length - 1;

      while (ia >= 0 && ib >= 0 && ca[ia] === cb[ib]) {
        ia--;
        ib--;
      }

      return ia + 1 + (ib + 1);
    };

    // the score-mapping form (85.3): the column read once through the
    // hoisted reader, normalized once — the serializable spelling; the
    // fn form stays as the escape hatch.  Zero sim changes either way:
    // both spellings land in the same lengths array.
    const edgeSlots = ctx.edgeSlots();
    let mappedLengths: Float64Array | null = null;

    if (isScoreMapping(lengthOf)) {
      validateScoreMapping(lengthOf, 'edgeLength');
      checkScoreColumn(cy, 'edges', lengthOf, 'edgeLength');

      const read = store.data.reader('edges', lengthOf.data);

      mappedLengths = resolveScores(
        edgeSlots.map(read),
        lengthOf,
        DEFAULT_EDGE_LENGTH,
      );
    }

    for (let ei = 0; ei < edgeSlots.length; ei++) {
      const edgeSlot = edgeSlots[ei];
      const sSlot = endpoints[edgeSlot * 2];
      const tSlot = endpoints[edgeSlot * 2 + 1];
      const s = simIndex.get(sSlot);
      const t = simIndex.get(tSlot);

      if (s == null || t == null || s === t) {
        continue;
      }

      simEdges.push(s, t);

      const base =
        mappedLengths != null
          ? mappedLengths[ei]
          : typeof lengthOf === 'function'
            ? lengthOf(cy._ele('edges', edgeSlot))
            : ((lengthOf as number | undefined) ?? DEFAULT_EDGE_LENGTH);
      const levels = spannedLevels(sSlot, tSlot);

      lengths.push(levels > 0 ? base * levels * nestingFactor : base);
    }

    const edgesArr = Uint32Array.from(simEdges);
    const lengthsArr = Float32Array.from(lengths);

    let lengthSum = 0;

    for (let e = 0; e < lengthsArr.length; e++) {
      lengthSum += lengthsArr[e];
    }

    const meanL =
      lengthsArr.length > 0
        ? lengthSum / lengthsArr.length
        : DEFAULT_EDGE_LENGTH;

    // constraints (85.2): resolved and validated up front — unknown
    // ids, placement cycles and contradictory locked members all throw
    // here, before anything moves
    const constraints = resolveConstraints(
      cy,
      options.alignment,
      options.relativePlacement,
      simIndex,
      pinned,
      ctx.positions(),
      simSlots,
      meanL,
    );

    // the component field (59.2): union-find over the sim edges, one
    // packed anchor per component, one anchor coordinate pair per node
    const comps = computeComponents(n, edgesArr);
    const spacing = options.componentSpacing ?? 40;
    const positions = new Float32Array(n * 2);
    const column = ctx.positions();
    const compAnchors = new Float32Array(comps.count * 2);

    if (options.randomize !== false) {
      // fresh placement: packed anchors, nodes scattered around them
      compAnchors.set(packAnchors(comps.sizes, meanL, spacing));
      seedAroundAnchors(
        n,
        options.seed ?? 1,
        comps.compOf,
        comps.sizes,
        compAnchors,
        meanL,
        positions,
      );

      // the spectral seed (59.4): landmark MDS per component, the
      // global untangling a local force phase cannot reach from a
      // scatter; 'scatter' keeps the plain seeded start (the control
      // path, and the escape hatch)
      if (options.init !== 'scatter') {
        spectralSeed(
          n,
          edgesArr,
          comps.compOf,
          comps.sizes,
          compAnchors,
          meanL,
          positions,
        );
      }

      // pinned nodes keep their real coordinates even under randomize
      for (let i = 0; i < n; i++) {
        if (pinned[i] === 1) {
          positions[i * 2] = column[simSlots[i] * 2];
          positions[i * 2 + 1] = column[simSlots[i] * 2 + 1];
        }
      }
    } else {
      // incremental: relax the current positions where they stand —
      // each component anchors at its own current centroid, so gravity
      // holds pieces in place rather than dragging them to a new field
      for (let i = 0; i < n; i++) {
        positions[i * 2] = column[simSlots[i] * 2];
        positions[i * 2 + 1] = column[simSlots[i] * 2 + 1];
      }

      const counts = new Float64Array(comps.count);

      for (let i = 0; i < n; i++) {
        const c = comps.compOf[i];

        compAnchors[c * 2] += positions[i * 2];
        compAnchors[c * 2 + 1] += positions[i * 2 + 1];
        counts[c]++;
      }

      for (let c = 0; c < comps.count; c++) {
        if (counts[c] > 0) {
          compAnchors[c * 2] /= counts[c];
          compAnchors[c * 2 + 1] /= counts[c];
        }
      }
    }

    const nodeAnchors = new Float32Array(n * 2);

    for (let i = 0; i < n; i++) {
      const c = comps.compOf[i];

      nodeAnchors[i * 2] = compAnchors[c * 2];
      nodeAnchors[i * 2 + 1] = compAnchors[c * 2 + 1];
    }

    // the settle re-pack (59.2): translate whole components into
    // non-overlapping boxes once the sim lands.  Skipped whenever
    // anything is pinned — a re-pack moves whole components, and a
    // locked node must never move (recorded scope note) — and for any
    // constrained run (85.2): a translation would carry an aligned
    // group past a locked member's pin and shear cross-component
    // relative pairs
    const skipRepack = movable.length < n || constraints != null;

    // compound owner groups (59.5): each leaf pulls toward its direct
    // parent's live centroid on the CPU executor (compound graphs
    // never take the GPU path — the 14.11 lease rule)
    let groups: { of: Int32Array; count: number; pull: number } | undefined;

    if (hasCompounds) {
      const of = new Int32Array(n).fill(-1);
      const gid = new Map<number, number>();

      for (let i = 0; i < n; i++) {
        const parent = store.parentOf(simSlots[i]);

        if (parent >= 0) {
          let g = gid.get(parent);

          if (g == null) {
            g = gid.size;
            gid.set(parent, g);
          }

          of[i] = g;
        }
      }

      if (gid.size > 0) {
        groups = {
          of,
          count: gid.size,
          pull: params.gravity * (options.gravityCompound ?? 1.5),
        };
      }
    }

    const sim = new ForceSim({
      n,
      edges: edgesArr,
      edgeLength: lengthsArr,
      positions,
      pinned,
      anchors: nodeAnchors,
      groups,
      constraints: constraints ?? undefined,
      ...params,
    });

    // the seed is constraint-blind (spectral or scatter alike), so a
    // constrained run projects once before the first tick to shorten
    // the transient (85.2)
    if (constraints != null) {
      sim.project();
    }

    const movableSlots = movable.map((i) => simSlots[i]);
    const movableXy = (arr: Float32Array): number[] => {
      const xy = new Array<number>(movable.length * 2);

      for (let k = 0; k < movable.length; k++) {
        xy[k * 2] = arr[movable[k] * 2];
        xy[k * 2 + 1] = arr[movable[k] * 2 + 1];
      }

      return xy;
    };

    // the live loop's per-frame write (animateLive): the bulk slot path
    const writeBack = (): void => {
      ctx.setPositions(movableSlots, movableXy(positions));
    };

    // the settle (114.5), one order for both executors: separate the
    // bodies first (it can widen a component), project the constraints
    // (alignment wins over separation — documented), re-pack whole
    // components by body box (translation only, so it reintroduces no
    // overlap), then land the positions by the contract's one rule —
    // the finisher's tween under `animate`, the bulk write otherwise.
    // A streamed run already showed the motion, so its settle lands
    // as one write rather than a second tween.
    const settle = (arr: Float32Array): void => {
      if (avoidOverlap) {
        separateBodies(n, arr, dims, pinned, comps.compOf, comps.count);
      }

      if (constraints != null && arr === positions) {
        sim.project();
      }

      if (!skipRepack) {
        packComponentBodies(
          n,
          comps.compOf,
          comps.count,
          arr,
          dims,
          spacing,
          true,
        );
      }

      ctx.finish(movableSlots, movableXy(arr), {
        animate: live ? false : options.animate === true,
      });
    };

    this.stopped = false;

    // the GPU fast path (18.3; availability-driven since 87.2): flat
    // rendered graphs hand per-iteration integration to the device for
    // *both* animate values.  Presenting (animate: true): the position
    // column is GPU-owned for the run (the tween lease), CPU reads are
    // stale mid-run, and one readback settles on convergence (the
    // round-9 design).  Silent (animate: false): the run publishes into
    // a runtime-owned buffer, the screen holds the pre-run frame, and
    // the same single readback settles — the run is async either way
    // (the 87.2 semantics change: settle at layoutstop / promise()).
    // Compounds demote to the CPU executor (a lease would starve the
    // auto-bounds derivation — the 14.11 rule), and so do constrained
    // runs (85.2's v1 contract, the same precedent: the projection
    // runs CPU-side after each step, and a per-tick readback is the
    // one thing the architecture forbids — the measured demotion price
    // is in the render bench's --layout mode, and the on-device
    // `constrain` dispatch design is recorded in the round for the day
    // the demand justifies it).
    if (!store.hasCompounds() && constraints == null) {
      const renderer = cy.renderer() as Renderer | null;

      if (renderer != null && typeof renderer.startForce === 'function') {
        // the fixed grid frame for the whole run: the seed bounds grown
        // generously (outliers clamp into edge cells — sound, recorded)
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        for (let i = 0; i < n; i++) {
          minX = Math.min(minX, positions[i * 2]);
          maxX = Math.max(maxX, positions[i * 2]);
          minY = Math.min(minY, positions[i * 2 + 1]);
          maxY = Math.max(maxY, positions[i * 2 + 1]);
        }

        const spanW = Math.max(1000, (maxX - minX) * 3);
        const spanH = Math.max(1000, (maxY - minY) * 3);
        const cutoff = Math.max(40, meanL);

        const runtime = renderer.startForce(
          {
            n,
            edges: edgesArr,
            edgeLength: lengthsArr,
            positions,
            pinned,
            anchors: nodeAnchors,
            slots: simSlots,
            params,
            cutoff,
            frame: {
              x: (minX + maxX) / 2 - spanW / 2,
              y: (minY + maxY) / 2 - spanH / 2,
              w: spanW,
              h: spanH,
            },
          },
          options.stepsPerFrame ?? 3,
          live,
        );

        if (runtime != null) {
          return this.runGpu(runtime, renderer, settle);
        }
      }
    }

    if (!live) {
      // settle-then-land on the CPU executor: run to convergence
      // synchronously, settle once (a tween under `animate`).  Reached
      // only when the GPU integrator is unavailable (headless,
      // compounds, no device) — a flat rendered graph took the silent
      // GPU path above (87.2)
      while (!sim.converged() && !this.stopped) {
        sim.step(50);
      }

      settle(positions);

      return;
    }

    // live mode: the sim streams positions to the store per frame — the
    // watchable-layout path (the 18.3 GPU integrator hooks in here)
    const stepsPerFrame = options.stepsPerFrame ?? 3;
    const tick =
      typeof requestAnimationFrame !== 'undefined'
        ? (cb: () => void) => requestAnimationFrame(cb)
        : (cb: () => void) => setTimeout(cb, 16);

    return new Promise<void>((resolve) => {
      const frame = (): void => {
        if (this.stopped || sim.converged()) {
          settle(positions);
          resolve();

          return;
        }

        sim.step(stepsPerFrame);
        writeBack();
        tick(frame);
      };

      frame();
    });
  }

  /** Poll the device sim to convergence, then the one settle readback. */
  private runGpu(
    runtime: GpuForceRuntime,
    renderer: Renderer,
    settle: (arr: Float32Array) => void,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const poll = (): void => {
        if (!this.stopped && !runtime.converged()) {
          setTimeout(poll, 60);

          return;
        }

        runtime.readPositions().then((finalPositions) => {
          // release the lease before the CPU write, so the settle
          // uploads through the normal dirty-span path — and so the
          // finisher's tween, under `animate`, takes a lease of its own
          renderer.finishForce();
          settle(finalPositions);
          resolve();
        });
      };

      poll();
    });
  }

  /**
   * Stop the simulation at the next iteration boundary, leaving nodes
   * where they have reached.
   */
  stop(): void {
    this.stopped = true;
  }
}
