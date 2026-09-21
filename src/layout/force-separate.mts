// The force layout's landed separation (round 130 split): `separateBodies`
// and its tuning constants.

import type { LayoutNodeDims } from './dims.mjs';
import { OverlapGrid, separationAlong } from './separation.mjs';

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
 * @param withinComponents — separate only pairs of one component
 *   (125.1): what the settle asks when its re-pack follows, since the
 *   re-pack places components apart by their boxes anyway and a sweep
 *   that pushed a foreign node into a small component's canonical
 *   shape (120) broke the shape for nothing.  The stress rounds and
 *   the expansion were already per component; this extends the rule
 *   to the sweeps and to the depth the best-state guard compares.
 */
export const separateBodies = (
  n: number,
  pos: Float32Array,
  dims: LayoutNodeDims,
  pinned: Uint8Array,
  compOf: Int32Array,
  count: number,
  trace?: (stage: string) => void,
  withinComponents: boolean = false,
): void => {
  if (n < 2 || count < 1) {
    return;
  }

  const grid = new OverlapGrid(n, dims);
  const sweepComps = withinComponents ? compOf : null;
  const forEachNear = (
    visit: (i: number, j: number, ox: number, oy: number) => void,
    overlappingOnly: boolean,
  ): boolean => grid.forEach(pos, visit, overlappingOnly);

  const sweeps = (limit: number): boolean => {
    for (let k = 0; k < limit; k++) {
      if (grid.sweep(pos, pinned, sweepComps) === 0) {
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
      if (compOf[i] !== compOf[j]) {
        // a foreign pair's depth is the re-pack's to clear when one
        // follows; counting it would have the guard hold a field back
        // for overlaps this pass no longer touches
        if (!withinComponents) {
          depth += Math.min(ox, oy);
        }

        return;
      }

      depth += Math.min(ox, oy);

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
