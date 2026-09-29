import {
  FLAG_ALIVE,
  FLAG_DRAWN,
  FLAG_EMPHASIZED,
  LABEL_DECLUTTER_CULL,
  LABEL_DECLUTTER_NONE,
} from '../contract.mjs';
import type { LabelEntry } from '../contract.mjs';

/*
Label decluttering (round 104): which node labels draw, and in what
order they fade.

Two inputs from the sheet.  `label-priority` (a node prop, mapper-able)
ranks the labels; the core `label-declutter` (`none` | `cull`) turns the
occupancy pass on.  One output per node slot, the *gate*: a float the
glyph cull and the node label shader read beside the glyph —

  gate > 0  the label's fade scale k ∈ [1, FADE_ORDER_SPAN]: its glyphs
            fade over [F·k/2, F·k] displayed px instead of [F/2, F]
            (F = labelFadePx).  The top-ranked labels keep k = 1, today's
            band exactly; the lowest-ranked fade first, at FADE_ORDER_SPAN
            times the size — so zooming out takes labels away in priority
            order, lowest first.  Every label ranks top when no priority
            is declared (all equal), so an unprioritized graph draws what
            it drew before this round, bit for bit.
  gate = 0  culled: the occupancy pass lost this label (or never
            decided it — undecided never draws, so a stale gate cannot
            draw soup).

The pass (mode `cull`) is a greedy claim over a grid, highest priority
first: a label claims the cells its rect covers, and a label that would
land on a claimed cell is culled — hidden, not faded.  Three properties
are designed in rather than hoped for:

- **The grid is anchored in model space.**  Cells are DECLUTTER_CELL_PX
  CSS px on screen, but their edges sit at multiples of that size in
  model px from the model origin — so a pure pan moves no rect across a
  cell edge, and the winners of a pan are the winners of its first
  frame (labels are model-space, so overlap itself is pan-invariant).
  Zoom re-quantizes, which is the point: zoomed in, the cells are fine
  against the labels and more of them fit.
- **Membership is the pre-fade set.**  A label is a candidate when the
  GPU would draw it — shown, above its min-zoomed-font-size, above
  labelMinPx, fade > 0 at its own fade scale, inside the decided region
  — and a half-faded candidate claims exactly as a whole one.  The cull
  decides membership; the fade decides alpha.
- **Hysteresis.**  A label shown by the last pass (an incumbent) keeps
  its claim until a challenger outranks it by DECLUTTER_HYSTERESIS (in
  rank units, [0, 1]), so a label entering the region cannot strobe
  an equal neighbour, and a second pass at the same view is a fixed
  point.  The emphasized set (round 102) ranks above everything.

Ties break by slot, so the result is deterministic.  All of it is
renderer-local by contract: never stored truth, never serialized, never
read back through the public API.
*/

/** `label-declutter: none` — every label draws (the default). */
export const DECLUTTER_NONE = LABEL_DECLUTTER_NONE;
/** `label-declutter: cull` — the occupancy pass decides membership. */
export const DECLUTTER_CULL = LABEL_DECLUTTER_CULL;

/** The occupancy grid's cell edge, CSS px.  Measured in round 104.1
 * (benchmark/label-declutter.mjs): 4 px is the knee — at 8 px the
 * grid's *false culls* (a culled label touching no shown one) triple on
 * ndex-x-large at fit (992 → 2,853), and 2 px halves them for 14% more
 * pass time and four times the cells a zoomed-in label stamps. */
export const DECLUTTER_CELL_PX = 4;
/** How far past the viewport labels are decided too, CSS px — so a pan
 * reveals labels already decided, and a chain of cull decisions changes
 * off-screen rather than at the viewport edge. */
export const DECLUTTER_MARGIN_PX = 128;
/** The rank margin a challenger must beat an incumbent by. */
export const DECLUTTER_HYSTERESIS = 0.1;
/** How many cells an incumbent's conflict test is inset by — the
 * spatial half of the hysteresis (see `run`). */
export const DECLUTTER_INSET_CELLS = 1;
/** The lowest-ranked label's fade band, as a multiple of labelFadePx. */
export const FADE_ORDER_SPAN = 2;

const SHOWN = FLAG_ALIVE | FLAG_DRAWN;
/** the per-slot rect record: x0, y0, x1, y1 (model px, from the node
 * position), the tallest glyph's LOD height (model px), zoomDprMin */
const REC = 6;
/** a grid larger than this many cells means a degenerate view; the
 * pass declines (every candidate draws) rather than allocate it */
const MAX_CELLS = 1 << 24;

/** The view one pass decides, in the units the frame uses. */
export interface DeclutterView {
  /** CSS px per model px (`cy.zoom()`): sizes the model-anchored grid */
  zoom: number;
  /** displayed device px per model px, at which label LOD is judged */
  zoomDpr: number;
  /** the decided region, model px (the viewport plus the margin) */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** the frame's labelFadePx and labelMinPx, displayed px */
  fadePx: number;
  minPx: number;
}

/** What one pass did (stats and the round's measurements). */
export interface DeclutterStats {
  /** labels the GPU would draw before the pass */
  candidates: number;
  /** candidates that won their cells */
  shown: number;
  /** candidates culled */
  culled: number;
  /** labels whose gate changed since the previous pass */
  flips: number;
  /** wall-clock ms of the pass */
  ms: number;
}

/**
 * The GPU's fade, `smoothstep( lo, hi, x )` — the CPU twin of the WGSL
 * labelFade, so the pass admits exactly what the cull keeps.
 *
 * @param heightPx — displayed glyph height
 * @param fadePx — the fade band's top (already scaled by the label's k)
 * @returns the label's LOD alpha in [0, 1]
 */
export function labelFade(heightPx: number, fadePx: number): number {
  const lo = fadePx * 0.5;
  const t = Math.min(1, Math.max(0, (heightPx - lo) / (fadePx - lo)));

  return t * t * (3 - 2 * t);
}

/**
 * The fade scale of a label at rank `r` (1 top, 0 bottom).
 *
 * @param rank — the label's rank in [0, 1]
 * @returns k ∈ [1, FADE_ORDER_SPAN]
 */
export function fadeScale(rank: number): number {
  return 1 + (FADE_ORDER_SPAN - 1) * (1 - rank);
}

/**
 * A node label's rect, model px from the node position: the laid block
 * placed as the label layer places it (text-halign/-valign shifts,
 * text-margin-x), grown by the text outline and — when the label has a
 * background — the background padding, then, for a rotated label, the
 * axis-aligned bound of the rect turned about the anchor.  The block
 * extents, not the glyph quads, which carry the SDF halo past the ink.
 *
 * @param entry — the label's sidecar entry
 * @param blockW — the laid block's width, model px
 * @param blockH — the laid block's height, model px
 * @param out — receives x0, y0, x1, y1
 * @returns `out`
 */
export function nodeLabelRect(
  entry: Pick<
    LabelEntry,
    | 'anchorX'
    | 'anchorY'
    | 'halignShift'
    | 'valignShift'
    | 'marginX'
    | 'outlineWidth'
    | 'bgColor'
    | 'bgPadding'
    | 'rotation'
  >,
  blockW: number,
  blockH: number,
  out: [number, number, number, number] = [0, 0, 0, 0],
): [number, number, number, number] {
  const dx = entry.anchorX + entry.halignShift * blockW + entry.marginX;
  const dy = entry.anchorY + entry.valignShift * blockH;
  const bg = ((entry.bgColor >>> 24) & 0xff) > 0 ? entry.bgPadding : 0;
  const grow = Math.max(entry.outlineWidth, bg);
  let x0 = dx - blockW / 2 - grow;
  let x1 = dx + blockW / 2 + grow;
  let y0 = dy - grow;
  let y1 = dy + blockH + grow;

  if (entry.rotation !== 0) {
    const c = Math.cos(entry.rotation);
    const s = Math.sin(entry.rotation);
    const xs = [x0, x1, x1, x0];
    const ys = [y0, y0, y1, y1];

    x0 = y0 = Infinity;
    x1 = y1 = -Infinity;

    for (let i = 0; i < 4; i++) {
      const rx = c * xs[i] - s * ys[i];
      const ry = s * xs[i] + c * ys[i];

      x0 = Math.min(x0, rx);
      x1 = Math.max(x1, rx);
      y0 = Math.min(y0, ry);
      y1 = Math.max(y1, ry);
    }
  }

  out[0] = x0;
  out[1] = y0;
  out[2] = x1;
  out[3] = y1;

  return out;
}

/**
 * The renderer-local declutter state for the node label stream: the
 * per-slot label rects the label layer records, the priority order,
 * the last pass's winners, and the gate the GPU reads.
 */
export class LabelDeclutter {
  /** the gate per node slot (see the file header); 1 where unlabelled */
  gate = new Float32Array(0);
  /** the hysteresis margin (DECLUTTER_HYSTERESIS; 0 turns it off — the
   * flicker probe's control) */
  hysteresis = DECLUTTER_HYSTERESIS;
  /** the grid cell edge, CSS px */
  cellPx = DECLUTTER_CELL_PX;
  /** the incumbent's inset, cells (DECLUTTER_INSET_CELLS; 0 turns the
   * spatial hysteresis off — the flicker probe's control) */
  insetCells = DECLUTTER_INSET_CELLS;
  /** the last pass's numbers */
  stats: DeclutterStats = {
    candidates: 0,
    shown: 0,
    culled: 0,
    flips: 0,
    ms: 0,
  };
  /** passes run since construction */
  passes = 0;

  // lowest/highest slot whose gate changed since the last upload
  // (lo > hi: none)
  private gateLo = Infinity;
  private gateHi = -1;
  private cap = 0;
  private has = new Uint8Array(0);
  private rec = new Float32Array(0);
  private prio = new Float64Array(0);
  private rank = new Float32Array(0);
  private won = new Uint8Array(0);
  private order = new Uint32Array(0);
  private orderLen = 0;
  private orderDirty = false;
  private labelled = 0;
  private stamps = new Uint32Array(0);
  private epoch = 0;
  // per-pass scratch: the three candidate lists, in priority order
  private emph = new Uint32Array(0);
  private inc = new Uint32Array(0);
  private chal = new Uint32Array(0);

  /**
   * Grow the per-slot arrays to hold `cap` node slots.
   *
   * @param cap — the node capacity
   */
  ensure(cap: number): void {
    if (cap <= this.cap) {
      return;
    }

    const next = Math.max(cap, this.cap * 2, 64);
    const grow = <T extends Float32Array | Float64Array | Uint8Array>(
      old: T,
      make: (n: number) => T,
      stride = 1,
    ): T => {
      const out = make(next * stride);

      out.set(old);

      return out;
    };

    this.has = grow(this.has, (n) => new Uint8Array(n));
    this.rec = grow(this.rec, (n) => new Float32Array(n), REC);
    this.prio = grow(this.prio, (n) => new Float64Array(n));
    this.rank = grow(this.rank, (n) => new Float32Array(n));
    this.won = grow(this.won, (n) => new Uint8Array(n));

    const gate = new Float32Array(next).fill(1);

    gate.set(this.gate);
    this.gate = gate;
    this.cap = next;
    this.markGate(0, next - 1);
  }

  /** the per-slot capacity (≥ the node capacity once ensured) */
  capacity(): number {
    return this.cap;
  }

  /**
   * Record a node label's rect (the label layer, on each rebuilt run).
   *
   * @param slot — the node slot
   * @param x0 — rect left, model px from the node position
   * @param y0 — rect top
   * @param x1 — rect right
   * @param y1 — rect bottom
   * @param lodH — the tallest glyph's LOD height, model px
   * @param zoomDprMin — the min-zoomed-font-size floor as a zoomDpr (0 none)
   * @param priority — the label's `label-priority`
   */
  setLabel(
    slot: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    lodH: number,
    zoomDprMin: number,
    priority: number,
  ): void {
    this.ensure(slot + 1);

    const at = slot * REC;
    const rec = this.rec;

    rec[at] = x0;
    rec[at + 1] = y0;
    rec[at + 2] = x1;
    rec[at + 3] = y1;
    rec[at + 4] = lodH;
    rec[at + 5] = zoomDprMin;

    if (this.has[slot] === 0) {
      this.has[slot] = 1;
      this.labelled++;
      this.orderDirty = true;
    } else if (this.prio[slot] !== priority) {
      this.orderDirty = true;
    }

    this.prio[slot] = priority;
  }

  /**
   * Forget a node's label (cleared, or its run emptied).
   *
   * @param slot — the node slot
   */
  clearLabel(slot: number): void {
    if (slot >= this.cap || this.has[slot] === 0) {
      return;
    }

    this.has[slot] = 0;
    this.won[slot] = 0;
    this.labelled--;
    this.orderDirty = true;

    if (this.gate[slot] !== 1) {
      this.gate[slot] = 1;
      this.markGate(slot, slot);
    }
  }

  /** Forget every label (slot compaction: every slot went stale). */
  clearAll(): void {
    this.has.fill(0);
    this.won.fill(0);
    this.gate.fill(1);
    this.labelled = 0;
    this.orderLen = 0;
    this.orderDirty = false;
    this.markGate(0, this.cap - 1);
  }

  /** labelled node slots */
  count(): number {
    return this.labelled;
  }

  /**
   * The label's rank in [0, 1] (1 top), after the order is current.
   *
   * @param slot — the node slot
   * @returns the rank; 1 for an unlabelled slot
   */
  rankOf(slot: number): number {
    this.ensureOrder();

    return this.has[slot] === 1 ? this.rank[slot] : 1;
  }

  /**
   * Whether the last pass drew this slot's label (renderer-local; the
   * specs and the flicker probe read it).
   *
   * @param slot — the node slot
   * @returns true when the gate admits the label
   */
  drawn(slot: number): boolean {
    return slot < this.cap && this.has[slot] === 1 && this.gate[slot] > 0;
  }

  /** Record a changed gate span for the next upload. */
  private markGate(lo: number, hi: number): void {
    if (lo < this.gateLo) {
      this.gateLo = lo;
    }

    if (hi > this.gateHi) {
      this.gateHi = hi;
    }
  }

  /** Returns-and-clears the changed gate span, or null when clean. */
  takeGateSpan(): { lo: number; hi: number } | null {
    if (this.gateLo > this.gateHi) {
      return null;
    }

    const span = { lo: this.gateLo, hi: Math.min(this.gateHi, this.cap - 1) };

    this.gateLo = Infinity;
    this.gateHi = -1;

    return span;
  }

  /**
   * Rebuild the priority order and the ranks when a priority or the
   * labelled set changed: labelled slots by priority descending, slot
   * ascending; a label's rank is 1 − (labels strictly above it) / (n − 1),
   * so equal priorities share a rank and an all-equal graph ranks every
   * label top.
   */
  private ensureOrder(): void {
    if (!this.orderDirty) {
      return;
    }

    this.orderDirty = false;

    if (this.order.length < this.labelled) {
      this.order = new Uint32Array(Math.max(this.labelled, 64));
    }

    const order = this.order;
    let n = 0;

    for (let slot = 0; slot < this.cap; slot++) {
      if (this.has[slot] === 1) {
        order[n++] = slot;
      }
    }

    const prio = this.prio;
    const live = order.subarray(0, n);

    live.sort((a, b) => prio[b] - prio[a] || a - b);
    this.orderLen = n;

    let first = 0;

    for (let i = 0; i < n; i++) {
      if (i > 0 && prio[live[i]] !== prio[live[i - 1]]) {
        first = i;
      }

      this.rank[live[i]] = n > 1 ? 1 - first / (n - 1) : 1;
    }
  }

  /**
   * One pass: decide every labelled node's gate for `view`.  Under
   * `DECLUTTER_NONE` the gate is the fade scale alone; under
   * `DECLUTTER_CULL` the occupancy pass above decides membership.
   *
   * @param mode — DECLUTTER_NONE or DECLUTTER_CULL
   * @param view — the region and the LOD terms
   * @param positions — the node.position column (x, y interleaved)
   * @param flags — the node.flags column
   * @returns the pass's stats (also kept on `stats`)
   */
  run(
    mode: number,
    view: DeclutterView,
    positions: Float32Array,
    flags: Uint32Array,
  ): DeclutterStats {
    const t0 = performance.now();

    this.ensureOrder();

    const stats: DeclutterStats = {
      candidates: 0,
      shown: 0,
      culled: 0,
      flips: 0,
      ms: 0,
    };
    const order = this.order;
    const n = this.orderLen;
    const rank = this.rank;
    const gate = this.gate;
    const won = this.won;

    if (mode !== DECLUTTER_CULL) {
      for (let i = 0; i < n; i++) {
        const slot = order[i];
        const k =
          (flags[slot] & FLAG_EMPHASIZED) !== 0 ? 1 : fadeScale(rank[slot]);

        won[slot] = 0;
        this.setGate(slot, k, stats);
      }

      return this.finish(stats, t0);
    }

    if (this.emph.length < n) {
      this.emph = new Uint32Array(this.order.length);
      this.inc = new Uint32Array(this.order.length);
      this.chal = new Uint32Array(this.order.length);
    }

    const { emph, inc, chal, rec } = this;
    let ne = 0;
    let ni = 0;
    let nc = 0;

    // membership, in priority order: the lists stay sorted
    for (let i = 0; i < n; i++) {
      const slot = order[i];
      const f = flags[slot];
      const at = slot * REC;
      const heightPx = rec[at + 4] * view.zoomDpr;
      const emphasized = (f & FLAG_EMPHASIZED) !== 0;
      const k = emphasized ? 1 : fadeScale(rank[slot]);
      const x = positions[slot * 2];
      const y = positions[slot * 2 + 1];

      if (
        (f & SHOWN) !== SHOWN ||
        view.zoomDpr < rec[at + 5] ||
        heightPx < view.minPx ||
        labelFade(heightPx, view.fadePx * k) <= 0.001 ||
        x + rec[at + 2] < view.x1 ||
        x + rec[at] > view.x2 ||
        y + rec[at + 3] < view.y1 ||
        y + rec[at + 1] > view.y2
      ) {
        won[slot] = 0;
        this.setGate(slot, 0, stats);

        continue;
      }

      if (emphasized) {
        emph[ne++] = slot;
      } else if (won[slot] === 1) {
        inc[ni++] = slot;
      } else {
        chal[nc++] = slot;
      }
    }

    stats.candidates = ne + ni + nc;

    // the model-anchored grid over the region
    const cm = this.cellPx / view.zoom;
    const gx0 = Math.floor(view.x1 / cm);
    const gy0 = Math.floor(view.y1 / cm);
    const cols = Math.floor(view.x2 / cm) - gx0 + 1;
    const rows = Math.floor(view.y2 / cm) - gy0 + 1;

    if (!(cols > 0 && rows > 0 && cols * rows <= MAX_CELLS)) {
      // a degenerate view: decline, and draw every candidate
      for (const [list, len] of [
        [emph, ne],
        [inc, ni],
        [chal, nc],
      ] as const) {
        for (let i = 0; i < len; i++) {
          this.place(
            list[i],
            true,
            list === emph ? 1 : fadeScale(rank[list[i]]),
            stats,
          );
        }
      }

      return this.finish(stats, t0);
    }

    if (this.stamps.length < cols * rows) {
      this.stamps = new Uint32Array(cols * rows);
      this.epoch = 0;
    }

    if (++this.epoch === 0xffffffff) {
      this.stamps.fill(0);
      this.epoch = 1;
    }

    const stamps = this.stamps;
    const epoch = this.epoch;
    // an incumbent tests its rect inset by `inset` cells (never past its
    // centre cell) and stamps the whole of it: re-quantization under a
    // zoom cannot then make two incumbents collide, and a challenger
    // still needs every cell free — the spatial half of the hysteresis
    const claim = (slot: number, inset: number): boolean => {
      const at = slot * REC;
      const x = positions[slot * 2];
      const y = positions[slot * 2 + 1];
      const c0 = Math.max(0, Math.floor((x + rec[at]) / cm) - gx0);
      const c1 = Math.min(cols - 1, Math.floor((x + rec[at + 2]) / cm) - gx0);
      const r0 = Math.max(0, Math.floor((y + rec[at + 1]) / cm) - gy0);
      const r1 = Math.min(rows - 1, Math.floor((y + rec[at + 3]) / cm) - gy0);
      const cm0 = (c0 + c1) >> 1;
      const rm0 = (r0 + r1) >> 1;
      const tc0 = Math.min(c0 + inset, cm0);
      const tc1 = Math.max(c1 - inset, cm0);
      const tr0 = Math.min(r0 + inset, rm0);
      const tr1 = Math.max(r1 - inset, rm0);

      for (let r = tr0; r <= tr1; r++) {
        const base = r * cols;

        for (let c = tc0; c <= tc1; c++) {
          if (stamps[base + c] === epoch) {
            return false;
          }
        }
      }

      for (let r = r0; r <= r1; r++) {
        const base = r * cols;

        for (let c = c0; c <= c1; c++) {
          stamps[base + c] = epoch;
        }
      }

      return true;
    };

    // the emphasized set claims first and fades last (round 102's
    // follow-up: its labels are the ones a hover is about)
    for (let i = 0; i < ne; i++) {
      this.place(emph[i], claim(emph[i], 0), 1, stats);
    }

    // incumbents and challengers merge by rank, an incumbent's raised by
    // the hysteresis margin; ties go to the incumbent, then the slot
    const h = this.hysteresis;
    const inset = this.insetCells;
    let a = 0;
    let b = 0;

    while (a < ni || b < nc) {
      let pick: number;
      let incumbent: boolean;

      if (b >= nc) {
        incumbent = true;
      } else if (a >= ni) {
        incumbent = false;
      } else {
        const ka = rank[inc[a]] + h;
        const kb = rank[chal[b]];

        incumbent = ka > kb || (ka === kb && (h > 0 || inc[a] < chal[b]));
      }

      if (incumbent) {
        pick = inc[a++];
      } else {
        pick = chal[b++];
      }

      this.place(
        pick,
        claim(pick, incumbent ? inset : 0),
        fadeScale(rank[pick]),
        stats,
      );
    }

    return this.finish(stats, t0);
  }

  /** Settle one candidate: its gate (`k` when shown), its incumbency,
   * the counts. */
  private place(
    slot: number,
    shown: boolean,
    k: number,
    stats: DeclutterStats,
  ): void {
    this.won[slot] = shown ? 1 : 0;

    if (shown) {
      stats.shown++;
    } else {
      stats.culled++;
    }

    this.setGate(slot, shown ? k : 0, stats);
  }

  private setGate(slot: number, value: number, stats: DeclutterStats): void {
    const old = this.gate[slot];

    if (old !== value) {
      if (old > 0 !== value > 0) {
        stats.flips++;
      }

      this.gate[slot] = value;
      this.markGate(slot, slot);
    }
  }

  private finish(stats: DeclutterStats, t0: number): DeclutterStats {
    stats.ms = performance.now() - t0;
    this.stats = stats;
    this.passes++;

    return stats;
  }
}
