/*
The built-in `force` layout (round 18.2): the round-17 extension
contract's first production consumer — `cy.layout({ name: 'force' })`
simply wraps ForceLayoutImpl in the same CustomLayout plumbing an
external layout would use.

Executors: the CPU reference simulation always exists (headless
instances, compound graphs — a GPU lease would leave the CPU columns
the auto-bounds derivation reads stale, the 14.11 rule) and is the
correctness spec; the GPU fast path (18.3) takes over per-iteration
integration for flat rendered graphs regardless of `animate` (87.2 —
`animate` is presentation only: true presents each frame, false runs
silently and lands the settle in one write).

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
  packComponentsExact,
} from './pack.mjs';
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
  /** live display: positions stream to the store per frame while the
   * sim runs; false shows nothing until convergence and applies once.
   * Presentation only (87.2): executor choice is availability-driven,
   * and a rendered flat-graph run is async for both values — read
   * positions at `layoutstop` / `promise()`, not on the next line.
   * Headless runs stay synchronous. */
  animate?: boolean;
  fit?: boolean;
  padding?: number;
  /** iterations advanced per animation frame (animate: true) */
  stepsPerFrame?: number;
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
   * integrator takes over for **both** animate values (87.2 —
   * availability-driven, not animate-driven): seven named passes plus a
   * per-level reduce per iteration, encoded ahead of the cull pass, so
   * 100k-node layouts settle with edges and labels following on-device.
   *
   * `animate` is presentation only.  A presenting run owns
   * `node.position` (the tween lease), so CPU position reads are stale
   * for the duration; a silent run publishes off-mirror and the screen
   * holds the pre-run frame.  Either way convergence triggers a single
   * readback that settles the columns — a rendered flat-graph run is
   * async for both animate values, settling at `layoutstop` /
   * `promise()` (87.2's named semantics change; headless is the
   * synchronous spelling).
   *
   * @param ctx — the layout context: unlocked leaf slots, live position
   *   views, O(1) CSR degrees and the bulk `setPositions` write
   * @returns a promise that resolves at convergence, or void when the
   *   run completed synchronously (headless / compound / no device
   *   under `animate: false`)
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

    for (let i = 0; i < n; i++) {
      if ((flags[simSlots[i]] & FLAG_LOCKED) !== 0) {
        pinned[i] = 1;
      } else {
        movable.push(i);
      }
    }

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
    const repack = (arr: Float32Array): void => {
      if (!skipRepack) {
        packComponentsExact(n, comps.compOf, comps.count, arr, spacing);
      }
    };

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
    const writeBack = (): void => {
      const xy = new Array<number>(movable.length * 2);

      for (let k = 0; k < movable.length; k++) {
        xy[k * 2] = positions[movable[k] * 2];
        xy[k * 2 + 1] = positions[movable[k] * 2 + 1];
      }

      ctx.setPositions(movableSlots, xy);
    };

    const applyViewport = (): void => {
      if (options.fit !== false) {
        cy.fit(ctx.eles, options.padding ?? 30);
      }
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
          options.animate === true,
        );

        if (runtime != null) {
          return this.runGpu(
            runtime,
            ctx,
            renderer,
            movableSlots,
            movable,
            applyViewport,
            repack,
          );
        }
      }
    }

    if (options.animate !== true) {
      // settle-then-draw on the CPU executor: run to convergence
      // synchronously, apply once.  Reached only when the GPU
      // integrator is unavailable (headless, compounds, no device) —
      // a flat rendered graph took the silent GPU path above (87.2)
      while (!sim.converged() && !this.stopped) {
        sim.step(50);
      }

      repack(positions);
      writeBack();
      applyViewport();

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
          repack(positions);
          writeBack();
          applyViewport();
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
    ctx: LayoutContext,
    renderer: Renderer,
    movableSlots: number[],
    movable: number[],
    applyViewport: () => void,
    repack: (arr: Float32Array) => void,
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const poll = (): void => {
        if (!this.stopped && !runtime.converged()) {
          setTimeout(poll, 60);

          return;
        }

        runtime.readPositions().then((finalPositions) => {
          // release the lease before the CPU write, so the settle
          // uploads through the normal dirty-span path
          renderer.finishForce();

          repack(finalPositions);

          const xy = new Array<number>(movable.length * 2);

          for (let k = 0; k < movable.length; k++) {
            xy[k * 2] = finalPositions[movable[k] * 2];
            xy[k * 2 + 1] = finalPositions[movable[k] * 2 + 1];
          }

          ctx.setPositions(movableSlots, xy);
          applyViewport();
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
