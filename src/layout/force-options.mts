// The force layout's options (round 130 split): the executor and overlap
// mode resolvers and the documented run options.

import type { LayoutComponent } from './per-component.mjs';
import type { BoxInput } from './pack.mjs';
import type {
  AlignmentSpec,
  RelativePlacementSpec,
} from './force-constraints.mjs';
import type { LayoutScoreMapping } from '../public-types.mjs';
import type { Collection } from '../collection.mjs';

/** Where the force simulation runs (129.3); see `executor`. */
export type ForceExecutor = 'auto' | 'cpu' | 'gpu' | 'workers';

/**
 * Validate the `executor` option at start.
 *
 * @param value — the option as passed, or undefined for the default
 * @returns the resolved executor ('auto' when omitted)
 * @throws if the value is not 'auto', 'cpu', 'gpu' or 'workers'
 */
export const resolveForceExecutor = (
  value: ForceExecutor | undefined,
): ForceExecutor => {
  if (value == null) {
    return 'auto';
  }

  if (
    value === 'auto' ||
    value === 'cpu' ||
    value === 'gpu' ||
    value === 'workers'
  ) {
    return value;
  }

  throw new Error(
    "force layout: executor must be 'auto', 'cpu', 'gpu' or 'workers' — " +
      `got ${String(value)}`,
  );
};

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
   * (87.2), so a run is async for both values wherever the integrator
   * or the sim worker takes it (a rendered flat graph; any instance
   * with a worker platform, headless included — 129.3 as revisited in
   * 131) — read positions at `layoutstop` / `promise()`.  `executor:
   * 'cpu'` is the synchronous spelling. */
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
  /** where the simulation runs (129.3; default `'auto'`).  `'auto'`
   * is availability-driven, as 87.2 made it: the GPU integrator where
   * the renderer offers one (a flat rendered graph with a device, on
   * either host), else the CPU simulation on a worker that loaded this
   * same bundle wherever one can be constructed — headless included
   * (131 revisited 129.3: a Node process wants its main thread free
   * for the event loop as a page wants its UI thread free) — so the
   * run is asynchronous (read positions at `layoutstop` /
   * `promise()`), else the in-thread simulation.  `'cpu'` is the
   * in-thread reference (bit-reproducible) and the synchronous
   * spelling; `'workers'` is the worker simulation, throwing at start
   * where none can be constructed; `'gpu'` throws at start where no
   * integrator is available (headless, a compound graph, a constrained
   * run, no device).  Any other value throws at start. */
  executor?: ForceExecutor;
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
   * component's edge length and its bodies' clearance by the
   * separation pass's own rule (125.1), so the pass leaves the shape
   * standing — so every
   * component of a size is the same box and the largest-first re-pack
   * lays them out in orderly rows, and two centre labels on a pair
   * never sit side by side.  A component holding a locked node keeps
   * its sim shape, as does one whose edges ask for different lengths;
   * constrained and infinite runs skip it with the re-pack. */
  tidyComponents?: boolean;
  /** group the components at the settle's re-pack (121.1): called once
   * per disconnected component with its description, and the
   * components sharing a key pack on their own, the groups standing in
   * a row left to right by key — numbers ascending, then strings, then
   * the components the function gave no key.  The EnrichmentMap shape
   * is `({ nodes }) => Math.sign(mean NES)`: negatives left, positives
   * right.  Ignored when the re-pack is (a locked node in scope, or
   * constraints).
   * @throws at start when it is not a function */
  componentGroup?: (
    component: LayoutComponent,
  ) => string | number | null | undefined;
  /** the order the re-pack lays components out in (121.1), a comparator
   * over two descriptions; largest box first is the default and breaks
   * the comparator's ties, so `(a, b) => b.size - a.size || score(b) -
   * score(a)` gives rows by node count with each row by score.  Within
   * each group under `componentGroup`.
   * @throws at start when it is not a function */
  componentOrder?: (a: LayoutComponent, b: LayoutComponent) => number;
  /** the gap between the groups' packed boxes (121.1; default three
   * `componentSpacing`s) */
  groupSpacing?: number;
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

export const DEFAULT_EDGE_LENGTH = 60;
/** the default settle threshold as a fraction of the mean ideal edge
 * length (119.3) */
export const THRESHOLD_FRACTION = 0.02;

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
