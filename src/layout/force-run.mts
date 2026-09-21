// One force run (round 130 split): read the options, build the sim set,
// the edges and lengths, the constraints and the seed, then dispatch to
// the GPU, worker, live or synchronous executor.  See `ForceLayoutImpl`
// in ./force.mts.

import { GROUP_EDGES, COL, FLAG_LOCKED, FLAG_PARENT } from '../contract.mjs';
import type { Ref } from '../contract.mjs';
import { ForceSim, defaultForceParams } from './force-sim.mjs';
import {
  componentBoxes,
  computeComponents,
  fitBodiesToBox,
  orientComponents,
  packAnchors,
  packComponentBodies,
  tidySmallComponents,
} from './pack.mjs';
import type { PackGrouping } from './pack.mjs';
import { groupingOf, validatePackOptions } from './per-component.mjs';
import type { LayoutComponent } from './per-component.mjs';
import { seedAroundAnchors, spectralSeed } from './force-init.mjs';
import {
  checkScoreColumn,
  isScoreMapping,
  resolveScores,
  validateScoreMapping,
} from './layout-mapping.mjs';
import { resolveConstraints } from './force-constraints.mjs';
import type { LayoutContext } from './contract.mjs';
import type { ForceHostLike } from '../render/gpu-force.mjs';
import { projectConstraints } from './force-constraints.mjs';
import { forceWorkerSupported } from './force-remote.mjs';
import type { ForceSimInputs } from './force-sim.mjs';
import {
  resolveForceExecutor,
  DEFAULT_EDGE_LENGTH,
  THRESHOLD_FRACTION,
  resolveOverlapMode,
} from './force-options.mjs';
import type { ForceRunOptions } from './force-options.mjs';
import { separateBodies } from './force-separate.mjs';
import type { ForceLayoutImpl } from './force.mjs';
import { runLive, runRemote, runGpu } from './force-executors.mjs';

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
 * the nodes into place through the shared finisher.  A run is async
 * wherever the integrator or the sim worker takes it — a rendered
 * flat graph, and any instance with a worker platform, headless
 * included (129.3, revisited in 131) — settling at `layoutstop` /
 * `promise()`; `executor: 'cpu'` is the synchronous spelling.
 *
 * @param ctx — the layout context: unlocked leaf slots, live position
 *   views, O(1) CSR degrees and the bulk `setPositions` write
 * @returns a promise that resolves at convergence, or void when the
 *   run completed synchronously (`executor: 'cpu'`, or `'auto'` on a
 *   platform with neither an integrator nor a worker, with neither
 *   `animate` nor `animateLive`)
 */
export function runOnce(
  fl: ForceLayoutImpl,
  ctx: LayoutContext,
): void | Promise<void> {
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

  // the grouping and the order (121.1) are functions or nothing —
  // a data key here would fail silently at the settle
  validatePackOptions(options, 'force');

  // where the sim runs (129.3): validated here so a bad value throws
  // at start, like every other option
  const executor = resolveForceExecutor(options.executor);

  if (executor === 'workers' && !forceWorkerSupported()) {
    throw new Error(
      "force layout: executor 'workers' needs a worker platform and a " +
        "bundle loaded from a URL — use 'cpu' or 'auto'",
    );
  }

  // the sim set: every leaf in scope — unlocked ones move, locked
  // ones pin in place as obstacles
  const flags = store.column(COL.NODE_FLAGS) as Uint32Array;
  const simSlots: number[] = [];
  const simRefs: Ref[] = [];
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
    simRefs.push(ref);
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
    checkScoreColumn(cy, GROUP_EDGES, lengthOf, 'edgeLength');

    const read = store.data.reader(GROUP_EDGES, lengthOf.data);

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
          ? lengthOf(cy._ele(GROUP_EDGES, edgeSlot))
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
    lengthsArr.length > 0 ? lengthSum / lengthsArr.length : DEFAULT_EDGE_LENGTH;

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

  if (options.randomize !== false && !fl.resumed) {
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
  const extents = overlapMode === 'sim' || overlapMode === 'both' ? dims : null;

  const simInputs: ForceSimInputs = {
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
  };
  // the in-thread sim, constructed only where it runs (129.3 — the
  // worker and the GPU build their own from the same inputs)
  let sim: ForceSim | null = null;
  const inThreadSim = (): ForceSim => {
    if (sim == null) {
      sim = new ForceSim(simInputs);

      // the seed is constraint-blind (spectral or scatter alike), so
      // a constrained run projects once before the first tick to
      // shorten the transient (85.2)
      if (constraints != null) {
        sim.project();
      }
    }

    return sim;
  };
  // the settle's projection (85.2; a pure function since 129.3, so a
  // remote sim's positions project like the in-thread sim's own)
  const pairCorrections =
    constraints != null && constraints.pairs.length > 0
      ? new Float64Array(n * 2)
      : null;

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

  // the caller's grouping and order (121.1): each component described
  // once — its nodes as a collection, its count, its body box as the
  // re-pack will see it — the keys sorted into group indices, the
  // comparator wrapped over component ids
  const groupOf = options.componentGroup;
  const orderOf = options.componentOrder;
  const describeComponents = (arr: Float32Array): PackGrouping => {
    if (groupOf == null && orderOf == null) {
      return {};
    }

    const boxes = componentBoxes(n, comps.compOf, comps.count, arr, dims);
    const refsOf: Ref[][] = Array.from({ length: comps.count }, () => []);

    for (let i = 0; i < n; i++) {
      refsOf[comps.compOf[i]].push(simRefs[i]);
    }

    const described: LayoutComponent[] = refsOf.map((refs, c) => ({
      nodes: ctx.nodes._spawnUnique(refs),
      size: refs.length,
      width: Math.max(1, boxes.x2[c] - boxes.x1[c]),
      height: Math.max(1, boxes.y2[c] - boxes.y1[c]),
    }));
    return groupingOf(described, options, spacing);
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
        // the settle's dims already carry the padding (half per
        // side); raw boxes take it here
        avoidOverlap ? 0 : (options.avoidOverlapPadding ?? 10),
        pinned,
      );
      // and the larger ones turn to a canonical angle (121.2) — the
      // principal axis flat, or a ring's farthest node up.  A turn
      // re-overlaps axis-aligned boxes, so it needs the settle pass
      // after it: a `'sim'` run, whose sweeps are all it has, keeps
      // the sim's angles
      if (overlapMode !== 'sim') {
        orientComponents(n, comps, arr, pinned);
      }
    }

    if (overlapMode === 'settle' || overlapMode === 'both') {
      // within components when the re-pack follows (125.1): the
      // re-pack places components apart; a pass across them only
      // broke the small components' shapes
      separateBodies(
        n,
        arr,
        dims,
        pinned,
        comps.compOf,
        comps.count,
        undefined,
        !skipRepack,
      );
    }

    if (constraints != null) {
      projectConstraints(n, arr, pinned, constraints, pairCorrections);
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
        describeComponents(arr),
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

  fl.stopped = false;

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
  if (
    !store.hasCompounds() &&
    constraints == null &&
    executor !== 'cpu' &&
    executor !== 'workers'
  ) {
    // both hosts answer the same three verbs (129.2): the same-thread
    // renderer runs the integrator itself, the worker host's proxy
    // runs it in the worker and mirrors its state
    const renderer = cy.renderer() as ForceHostLike | null;

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
        fl.current = {
          indexOf: (slot) => simIndex.get(slot),
          setPosition: (i, x, y) => runtime.setPosition(i, x, y),
          setPinned: (i, flag) => runtime.setPinned(i, flag),
          reheat: (alpha) => runtime.reheat(alpha),
          wake: () => renderer.wakeForce(),
        };

        return runGpu(fl, runtime, renderer, settle);
      }
    }
  }

  if (executor === 'gpu') {
    throw new Error(
      "force layout: executor 'gpu' needs the GPU integrator — a flat, " +
        'unconstrained graph on a rendered instance with a WebGPU device ' +
        "— use 'cpu', 'workers' or 'auto'",
    );
  }

  // the CPU simulation on a worker (129.3): explicitly, or under
  // 'auto' wherever a worker can be constructed — headless included
  // (131.x revisits 129.3's deviation: a Node process wants its main
  // thread free for the event loop as much as a page wants its UI
  // thread free).  A headless 'auto' run is therefore asynchronous
  // where the platform offers a worker; `'cpu'` is the synchronous
  // spelling.
  if (
    executor === 'workers' ||
    (executor === 'auto' && forceWorkerSupported())
  ) {
    return runRemote(
      fl,
      cy,
      simInputs,
      live,
      infinite,
      options.stepsPerFrame ?? 3,
      executor === 'workers',
      simIndex,
      positions,
      writeBack,
      settle,
      inThreadSim,
    );
  }

  if (!live) {
    // settle-then-land on the CPU executor: run to convergence
    // synchronously, settle once (a tween under `animate`).  Reached
    // when neither the GPU integrator nor the worker sim applies (an
    // explicit 'cpu'; a platform with no worker) — a flat rendered
    // graph took the silent GPU path above (87.2), anything else with
    // a worker platform the worker (129.3, headless too since 131)
    const cpuSim = inThreadSim();

    while (!cpuSim.converged() && !fl.stopped) {
      cpuSim.step(50);
    }

    if (!fl.cancelled) {
      settle(positions);
    }

    return;
  }

  return runLive(
    fl,
    inThreadSim(),
    infinite,
    options.stepsPerFrame ?? 3,
    simIndex,
    positions,
    writeBack,
    settle,
  );
}
