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
  fitBodiesToBox,
  packAnchors,
  packComponentBodies,
  tidySmallComponents,
} from './pack.mjs';
import type { BoxInput } from './pack.mjs';
import type { LayoutNodeDims } from './dims.mjs';
import { OverlapGrid, separationAlong } from './separation.mjs';
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
import type { Event } from '../event.mjs';
import type { Position } from '../public-types.mjs';
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
  /** the settle test, in model px: the run ends once every node's
   * per-tick displacement has stayed under it for a few ticks.
   * Default (119.3) for a run nobody watches (`animate` either way):
   * 2% of the mean ideal edge length — 1.2 px at the default length —
   * measured to reproduce the 0.1 px settle's edge lengths, stress and
   * overlaps within noise on every fixture at 2–3× the speed.  A
   * presented run (`animateLive`, `infinite`) keeps 0.1 px: its stop is
   * motion the eye sees, and a field still creeping a pixel a tick
   * would stop visibly short.  Under boxes the separation sweep has
   * its own quiet test (`SWEEP_QUIET`), whatever this is. */
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
  /** fit the settle into an explicit box (116.2 — flow's rule): the
   * drawing scales down, never up, until every body lies within the
   * box's width and height, then its body extents centre in the box.
   * Uniform, so the sim's structure is kept — `edgeLength` and
   * `repulsion` own the density, the box owns placement.  Skipped
   * exactly when the component re-pack is (a pinned node, or
   * constraints): a scale would move a locked node or break a relative
   * gap.  Under `animateLive` the stream shows the sim's own frame and
   * the box lands with the end-of-run adjustment. */
  boundingBox?: BoxInput;
  /** iterations advanced per animation frame under `animateLive` /
   * `infinite` (default 3).  A run nobody watches mid-run — `animate:
   * false`, or `animate: true`'s tween to the settle — is not paced by
   * it: the GPU executor batches as many iterations per frame as the
   * device keeps up with (119), and the CPU executor runs to
   * convergence synchronously. */
  stepsPerFrame?: number;
  /** the run has no end of its own (118.3): streams like `animateLive`,
   * ticks only while the field moves, reheats on a drag / a moved node
   * / an add or remove, ends on `stop()` with the positions as they
   * stand (no settle pass, re-pack, fit or tween) */
  infinite?: boolean;
  /** keep node bodies apart — labels included when
   * `nodeDimensionsIncludeLabels` is true, pinned (locked) nodes as
   * obstacles — and how (118.2): `true` or `'settle'` (the default)
   * separates them exactly after the settle (114.5; the dense case
   * rebuilt in 115, the crammed case in 118.1); `'sim'` runs a
   * separation sweep after every tick instead, on both executors, so
   * the run holds its piles open as it streams — a field denser than
   * its boxes allow needs the settle's expansion, so `'both'`; `false`
   * neither.  Any other value throws at start */
  avoidOverlap?: boolean | 'settle' | 'sim' | 'both';
  /** the gap kept between separated bodies (default 10) */
  avoidOverlapPadding?: number;
  /** the smallest components take canonical shapes at the settle
   * (round 120, default true): two nodes stand as a vertical barbell,
   * three as a point-up triangle, four as a diamond, sized to the
   * component's edge length and its bodies' clearance — so every
   * component of a size is the same box and the largest-first re-pack
   * lays them out in orderly rows, and two centre labels on a pair
   * never sit side by side.  A component holding a locked node keeps
   * its sim shape, as does one whose edges ask for different lengths;
   * constrained and infinite runs skip it with the re-pack. */
  tidyComponents?: boolean;
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
/** the default settle threshold as a fraction of the mean ideal edge
 * length (119.3) */
const THRESHOLD_FRACTION = 0.02;

/** How `avoidOverlap` keeps the boxes apart (118.2). */
export type OverlapMode = 'none' | 'settle' | 'sim' | 'both';

/**
 * The overlap mechanism an `avoidOverlap` value spells: `true` (the
 * default) and `'settle'` are the settle's exact pass, `'sim'` is the
 * sim's per-tick sweep alone, `'both'` runs the sweep and the pass,
 * `false` is neither.
 *
 * @param value — the option as given
 * @returns the mode
 * @throws TypeError on any other value — a typo must not silently
 *   mean the default
 */
export const resolveOverlapMode = (value: unknown): OverlapMode => {
  if (value == null || value === true || value === 'settle') {
    return 'settle';
  }

  if (value === false) {
    return 'none';
  }

  if (value === 'sim' || value === 'both') {
    return value;
  }

  throw new TypeError(
    `force: avoidOverlap must be true, false, 'settle', 'sim' or 'both', got ${JSON.stringify(value)}`,
  );
};

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

/** a component is *crammed* (118.1) once this fraction of its nodes
 * overlaps a neighbour: the overlap is then a property of the field's
 * density, not of a few pairs, and only a global expansion can open
 * it — the local passes below move each node to what its neighbours
 * ask, and a uniformly dense field's neighbours ask for nothing net */
const CRAMMED_FRACTION = 0.6;

/** ... and *large*: under this many nodes a component is a pile, and
 * the proximity stress opens a pile as far as the boxes need where a
 * uniform scale keeps the pile's shape (the 60-clique of labels fills
 * 0.45 of its field under the stress rounds, 0.33 under a scale —
 * 114.5's over-separation).  The stress rounds are local Jacobi steps
 * whose global mode converges across a pile's few hops and not across
 * a field's hundreds: measured on crammed random fields, the local
 * passes alone clear 2k nodes (72% touching) and leave 3k (80%) with
 * 1,347 pairs after the whole budget */
const CRAMMED_MIN_SIZE = 1000;

/** the growth one expansion round applies: the 75th-percentile
 * overlapping pair's requirement, capped — the rounds repeat while the
 * component stays crammed, so a cap costs rounds rather than reach */
const EXPAND_PERCENTILE = 0.5;
const EXPAND_CAP = 1.25;

/** expansion rounds before the field is left to the local passes */
const EXPAND_ROUNDS = 12;

/**
 * Separate overlapping node bodies in place (114.5; the dense case
 * rebuilt in 115; the crammed case, 118.1).  Deterministic (fixed
 * order, fixed tie rules):
 *
 * 0. **Expansion** (118.1 — item 57) — a large component most of
 *    whose nodes overlap a neighbour is a field too dense for its
 *    boxes, and no local pass opens it: measured on the sim's 25k
 *    random field, the sweeps below pushed pairs the full box depth
 *    into their neighbours and forty stress rounds added pairs while
 *    the bounding box never moved.  Such a component is scaled about
 *    its centroid by what its median overlapping pair asks for
 *    (capped per round), again while it stays crammed; a pinned node
 *    holds its component back, as it holds the re-pack.  Small
 *    components are piles and keep the stress rounds, which open a
 *    pile only as far as its boxes need where a scale keeps its shape.
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
 * And a **best-state guard** (118.1): the summed overlap depth is
 * measured at entry and after every stage, and the pass hands back
 * the shallowest field it reached — never a deeper one than it was
 * given, which round 117 measured it doing at 25k.
 *
 * @param n — sim node count
 * @param pos — 2n interleaved positions, moved in place
 * @param dims — the padded node-local boxes, sim-indexed
 * @param pinned — per-node 1 when the node must not move
 * @param compOf — per-node component id
 * @param count — component count
 * @param trace — called after each stage with its name (`sweeps`,
 *   `stress:<round>`, `final`) — the per-stage measurement hook the
 *   modules tier and item 57's probe read; never called by the layout
 */
export const separateBodies = (
  n: number,
  pos: Float32Array,
  dims: LayoutNodeDims,
  pinned: Uint8Array,
  compOf: Int32Array,
  count: number,
  trace?: (stage: string) => void,
): void => {
  if (n < 2 || count < 1) {
    return;
  }

  const grid = new OverlapGrid(n, dims);
  const forEachNear = (
    visit: (i: number, j: number, ox: number, oy: number) => void,
    overlappingOnly: boolean,
  ): boolean => grid.forEach(pos, visit, overlappingOnly);

  const sweeps = (limit: number): boolean => {
    for (let k = 0; k < limit; k++) {
      if (grid.sweep(pos, pinned) === 0) {
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

  // the field as it stands: per component, how many nodes overlap a
  // neighbour and what growth each overlapping pair asks for; and the
  // whole field's overlap depth, the one number the best-state guard
  // compares.  One grid pass, the same one every stage makes.
  const compSize = new Int32Array(count);
  const compTouched = new Int32Array(count);
  const touched = new Uint8Array(n);
  const ratiosOf: number[][] = [];

  for (let i = 0; i < n; i++) {
    compSize[compOf[i]]++;
  }

  const measure = (): number => {
    let depth = 0;

    touched.fill(0);
    compTouched.fill(0);
    ratiosOf.length = 0;

    forEachNear((i, j, ox, oy) => {
      depth += Math.min(ox, oy);

      if (compOf[i] !== compOf[j]) {
        return;
      }

      for (const node of [i, j]) {
        if (touched[node] === 0) {
          touched[node] = 1;
          compTouched[compOf[node]]++;
        }
      }

      const dx = pos[j * 2] - pos[i * 2];
      const dy = pos[j * 2 + 1] - pos[i * 2 + 1];
      const d = Math.hypot(dx, dy);

      if (d < 1e-6) {
        return; // coincident: no scale clears it (the sweeps do)
      }

      const c = compOf[i];

      (ratiosOf[c] ??= []).push(
        (separationAlong(dims, i, j, dx / d, dy / d) + 0.5) / d,
      );
    }, true);

    return depth;
  };

  // the best-state guard (118.1 — item 57): the pass hands back the
  // shallowest field any stage reached, never a deeper one than it
  // was given.  Round 117 measured the 25k random scene coming out
  // deeper than it went in (12,352 pairs at 5.6 px in, 13,406 at
  // 11.8 px out): the closing sweeps, on a field the stress rounds had
  // not opened, pushed pairs the full box depth into their neighbours
  let bestDepth = measure();
  let best: Float32Array | null = null;

  const keepBest = (): void => {
    const depth = measure();

    if (depth < bestDepth) {
      bestDepth = depth;
      best = best == null ? pos.slice() : best;
      best.set(pos);
    }
  };

  if (bestDepth === 0) {
    return;
  }

  // 1. expansion (118.1): a crammed, shallow component — most of its
  // nodes overlapping, each pair by a little — is a field too dense
  // for its boxes, and the local passes cannot open it (measured on
  // the 25k scene: forty stress rounds left the bounding box exactly
  // where it was and added pairs).  Scale it about its centroid by
  // what a high-percentile pair asks for, and repeat while it stays
  // crammed.  A component holding a pinned node is left to the local
  // passes: a scale moves everything, and a pinned node must not move
  const compPinned = new Uint8Array(count);

  for (let i = 0; i < n; i++) {
    if (pinned[i] === 1) {
      compPinned[compOf[i]] = 1;
    }
  }

  const sumX = new Float64Array(count);
  const sumY = new Float64Array(count);
  const scaleOf = new Float64Array(count);

  for (let round = 0; round < EXPAND_ROUNDS; round++) {
    if (round > 0) {
      measure();
    }

    let any = false;

    scaleOf.fill(1);

    for (let c = 0; c < count; c++) {
      const ratios = ratiosOf[c];

      if (
        ratios == null ||
        compPinned[c] === 1 ||
        compSize[c] < CRAMMED_MIN_SIZE ||
        compTouched[c] < CRAMMED_FRACTION * compSize[c]
      ) {
        continue;
      }

      ratios.sort((a, b) => a - b);

      const pick = ratios[Math.floor((ratios.length - 1) * EXPAND_PERCENTILE)];
      const s = Math.min(EXPAND_CAP, Math.max(1, pick));

      if (s > 1) {
        scaleOf[c] = s;
        any = true;
      }
    }

    if (!any) {
      break;
    }

    sumX.fill(0);
    sumY.fill(0);

    for (let i = 0; i < n; i++) {
      sumX[compOf[i]] += pos[i * 2];
      sumY[compOf[i]] += pos[i * 2 + 1];
    }

    for (let i = 0; i < n; i++) {
      const c = compOf[i];
      const s = scaleOf[c];

      if (s === 1) {
        continue;
      }

      const cx = sumX[c] / compSize[c];
      const cy = sumY[c] / compSize[c];

      pos[i * 2] = cx + (pos[i * 2] - cx) * s;
      pos[i * 2 + 1] = cy + (pos[i * 2 + 1] - cy) * s;
    }

    trace?.(`expand:${round}`);
  }

  keepBest();

  // 2. the local sweeps for the sparse case
  if (!sweeps(SEPARATE_SWEEPS)) {
    trace?.('sweeps');

    return;
  }

  trace?.('sweeps');
  keepBest();

  // 3. proximity stress for what a pile leaves
  for (let round = 0; round < SEPARATE_ROUNDS; round++) {
    if (!stressRound()) {
      break;
    }

    trace?.(`stress:${round}`);
    keepBest();
  }

  // 4. the closing sweeps for the residue — then the guard
  sweeps(SEPARATE_SWEEPS_FINAL);
  trace?.('final');
  keepBest();

  if (best != null && measure() > bestDepth) {
    pos.set(best);
    trace?.('restored');
  }
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
/** What a running sim exposes to the infinite run's event wiring
 * (118.3): the same four verbs on either executor. */
interface ActiveRun {
  /** node slot → sim index */
  indexOf(slot: number): number | undefined;
  setPosition(i: number, x: number, y: number): void;
  setPinned(i: number, pinned: boolean): void;
  reheat(alpha?: number): void;
  /** resume ticking after an idle */
  wake(): void;
}

export class ForceLayoutImpl implements LayoutImpl {
  private stopped = false;
  /** the sim under way (118.3), for the drag / position / reheat wiring */
  private current: ActiveRun | null = null;
  /** an add or remove asked for the sim to be rebuilt on the live graph */
  private restartWanted = false;
  /** a rebuilt run relaxes the positions where they stand */
  private resumed = false;

  /**
   * Run the layout (118.3 added the infinite shape).  A one-shot run
   * is `runOnce`; an `infinite` run wires the graph's grab / free /
   * position / add / remove events to the sim and re-runs the sim on
   * the live graph whenever the topology changes, until `stop()`.
   *
   * @param ctx — the layout context
   * @returns a promise that resolves at `stop()` for an infinite run;
   *   otherwise `runOnce`'s
   */
  run(ctx: LayoutContext): void | Promise<void> {
    const options = ctx.options as ForceRunOptions;

    this.stopped = false;
    this.resumed = false;
    this.restartWanted = false;

    if (options.infinite !== true) {
      return this.runOnce(ctx);
    }

    const cy = ctx.cy;
    const subset = (ctx.options as { eles?: unknown }).eles != null;
    const indexOfTarget = (target: unknown): number | undefined => {
      const ref = (target as Collection | undefined)?._eventRef?.();

      return ref != null && ref.group === 'nodes'
        ? this.current?.indexOf(ref.slot)
        : undefined;
    };
    const onGrab = (e: Event): void => {
      const i = indexOfTarget(e.target);

      if (i != null) {
        this.current?.setPinned(i, true);
      }
    };
    const onFree = (e: Event): void => {
      const i = indexOfTarget(e.target);

      if (i != null) {
        this.current?.setPinned(i, false);
        this.current?.reheat();
        this.current?.wake();
      }
    };
    const onPosition = (e: Event): void => {
      const i = indexOfTarget(e.target);

      if (i != null) {
        const p = (e.target as Collection).position() as Position;

        this.current?.setPosition(i, p.x, p.y);
        this.current?.reheat();
        this.current?.wake();
      }
    };
    const onTopology = (): void => {
      // a subset scope is the caller's collection and stays what it was
      if (!subset) {
        this.restartWanted = true;
        this.current?.wake();
      }
    };

    cy.on('grab', onGrab);
    cy.on('free', onFree);
    cy.on('position', onPosition);
    cy.on('add', onTopology);
    cy.on('remove', onTopology);

    return (async () => {
      try {
        do {
          this.restartWanted = false;
          ctx.refreshScope();
          await this.runOnce(ctx);
          this.resumed = true;
        } while (this.restartWanted && !this.stopped);
      } finally {
        cy.off('grab', onGrab);
        cy.off('free', onFree);
        cy.off('position', onPosition);
        cy.off('add', onTopology);
        cy.off('remove', onTopology);
        this.current = null;
      }
    })();
  }

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
  private runOnce(ctx: LayoutContext): void | Promise<void> {
    const cy = ctx.cy;
    const store = cy._store;
    const options = ctx.options as ForceRunOptions;
    const params = { ...defaultForceParams() };
    const infinite = options.infinite === true;

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
    // Which mechanism keeps them apart is the option's value (118.2):
    // the settle's exact pass, the sim's per-tick sweep, or both
    // ... and an infinite run has no settle for a pass to land on
    // (118.3), so its overlap avoidance is the sweep
    let overlapMode = resolveOverlapMode(options.avoidOverlap);

    if (infinite && overlapMode !== 'none') {
      overlapMode = 'sim';
    }

    const avoidOverlap = overlapMode !== 'none';
    const dims = ctx.nodeDimensions(simSlots, {
      padding: avoidOverlap ? (options.avoidOverlapPadding ?? 10) : 0,
    });
    const live = infinite || options.animateLive === true;

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

    // the settle test's default is relative to the field's scale
    // (119.3): the sim's 0.1 px is a tenth of a percent of the mean
    // edge length, and the anneal spent its last two hundred ticks
    // moving nodes by less than anything measured — the fixture sweep
    // is on the round
    if (options.threshold == null && !live) {
      params.threshold = THRESHOLD_FRACTION * meanL;
    }

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

    if (options.randomize !== false && !this.resumed) {
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

    // the sim keeps the same boxes apart that the settle separates —
    // one separation sweep after every tick (118.2; 116.1's contact
    // force before it) — under 'sim' and 'both'.  Not by default: the
    // settle's exact pass clears a one-shot run more cheaply than a
    // sweep per tick, and item 56's measurement is why (117)
    const extents =
      overlapMode === 'sim' || overlapMode === 'both' ? dims : null;

    const sim = new ForceSim({
      n,
      edges: edgesArr,
      edgeLength: lengthsArr,
      positions,
      pinned,
      anchors: nodeAnchors,
      extents,
      groups,
      constraints: constraints ?? undefined,
      infinite,
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
    // an infinite run's end (118.3) is the positions as they stand —
    // the person is looking at them, and a pass, a re-pack, a fit or a
    // tween would move what they see for no reason they asked for
    const land = (arr: Float32Array): void => {
      ctx.setPositions(movableSlots, movableXy(arr));
    };

    const settle = (arr: Float32Array): void => {
      if (infinite) {
        land(arr);

        return;
      }

      // the small components' shapes (120), before the separation so
      // the pass finds them clear and before the re-pack so their
      // boxes are what it packs; a constrained run keeps the sim's
      // shapes, as it keeps its field
      if (options.tidyComponents !== false && constraints == null) {
        tidySmallComponents(
          n,
          edgesArr,
          lengthsArr,
          comps,
          arr,
          dims,
          avoidOverlap ? (options.avoidOverlapPadding ?? 10) : 10,
          pinned,
        );
      }

      if (overlapMode === 'settle' || overlapMode === 'both') {
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

        // the box (116.2), after the re-pack so the packed field is
        // what scales; held back by the same rule as the re-pack
        if (options.boundingBox != null) {
          fitBodiesToBox(n, arr, dims, options.boundingBox);
        }
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
            extents,
            slots: simSlots,
            params,
            cutoff,
            frame: {
              x: (minX + maxX) / 2 - spanW / 2,
              y: (minY + maxY) / 2 - spanH / 2,
              w: spanW,
              h: spanH,
            },
            infinite,
          },
          options.stepsPerFrame ?? 3,
          live,
        );

        if (runtime != null) {
          this.current = {
            indexOf: (slot) => simIndex.get(slot),
            setPosition: (i, x, y) => runtime.setPosition(i, x, y),
            setPinned: (i, flag) => runtime.setPinned(i, flag),
            reheat: (alpha) => runtime.reheat(alpha),
            wake: () => renderer.wakeForce(),
          };

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
    // watchable-layout path (the 18.3 GPU integrator hooks in here).
    // An infinite run (118.3) sleeps once the sim is idle — no frame is
    // scheduled — and a wake (a drag, a moved node, a reheat, a stop)
    // schedules the next
    const stepsPerFrame = options.stepsPerFrame ?? 3;
    const tick =
      typeof requestAnimationFrame !== 'undefined'
        ? (cb: () => void) => requestAnimationFrame(cb)
        : (cb: () => void) => setTimeout(cb, 16);

    return new Promise<void>((resolve) => {
      let scheduled = false;
      let done = false;
      const frame = (): void => {
        scheduled = false;

        if (done) {
          return;
        }

        if (this.stopped || this.restartWanted || sim.converged()) {
          done = true;
          settle(positions);
          resolve();

          return;
        }

        if (infinite && sim.idle()) {
          return; // asleep until a wake
        }

        sim.step(stepsPerFrame);
        writeBack();
        schedule();
      };
      const schedule = (): void => {
        if (!scheduled && !done) {
          scheduled = true;
          tick(frame);
        }
      };

      this.current = {
        indexOf: (slot) => simIndex.get(slot),
        setPosition: (i, x, y) => {
          positions[i * 2] = x;
          positions[i * 2 + 1] = y;
        },
        setPinned: (i, flag) => sim.setPinned(i, flag),
        reheat: (alpha) => sim.reheat(alpha),
        wake: schedule,
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
        if (!this.stopped && !this.restartWanted && !runtime.converged()) {
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
   * where they have reached.  An idle infinite run is woken so the
   * stop lands (118.3).
   */
  stop(): void {
    this.stopped = true;
    this.current?.wake();
  }

  /**
   * Heat a running sim back up (118.3): alpha rises to `alpha` (0.3 by
   * default) and an idle infinite run resumes ticking.  A one-shot run
   * that has already converged is unaffected.
   *
   * @param alpha — the temperature to restore
   */
  reheat(alpha?: number): void {
    this.current?.reheat(alpha);
    this.current?.wake();
  }
}
