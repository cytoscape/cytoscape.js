/*
The flow layout (round 112): the built-in Sugiyama-class layered
layout — greedy-FAS cycle removal, GKNV network-simplex layering,
dummy-chain normalization, barycenter/median layer sweeps with
transpose scored by exact weighted cross counting, and Brandes–Köpf
coordinates with size-aware block-graph compaction.  The phase notes
live with the phases: `flow-graph.mts`, `flow-rank.mts`,
`flow-order.mts`, `flow-position.mts`.

Like force, flow rides the extension contract (`cy.layout({ name:
'flow' })` wraps this impl in a CustomLayout), so it is the contract's
second production consumer and `promise()` comes for free.  Positions
land through the columnar bulk path unless the finisher's plumbing
(animate / transform / spacingFactor) is asked for, in which case the
run finishes through `ctx.layoutPositions` like every discrete layout.

Edge routing is deliberately absent: flow emits node positions only,
placed so style-driven edges — taxi above all — route themselves
cleanly (rank gaps clear a horizontal band for taxi turns; aligned
chains render as straight drops), and stay correct when a node is
dragged.  See the round-112 record for the taxi contract.

Compound graphs (round 112.3): `compoundMode: 'global'` ranks the
whole nesting in one layering (Sander-style contiguous rank intervals
per parent); leaves place, parents derive (the round-14 rule).  Edges
incident on a parent node attach to the parent's border for ranking.
*/

import {
  buildScope,
  splitComponents,
  greedyFAS,
  dfsFAS,
} from './flow-graph.mjs';
import {
  rankLongestPath,
  rankNetworkSimplex,
  balanceRanks,
  normalizeRanks,
} from './flow-rank.mjs';
import { buildLayers, orderLayers } from './flow-order.mjs';
import { assignX, assignY, applyDirection } from './flow-position.mjs';
import {
  buildGroupModel,
  buildCompoundView,
  insertBorders,
  rankPadMargins,
} from './flow-compound.mjs';
import type { GroupModel } from './flow-compound.mjs';
import { shelfPack } from './pack.mjs';
import type { PackBox } from './pack.mjs';
import {
  isScoreMapping,
  validateScoreMapping,
  checkScoreColumn,
  resolveScores,
} from './layout-mapping.mjs';
import type { FlowComponent } from './flow-graph.mjs';
import type { LayoutContext, LayoutImpl } from './contract.mjs';
import type { Collection } from '../collection.mjs';
import type {
  FlowLayoutOptions,
  LayoutScoreMapping,
  Position,
} from '../public-types.mjs';

const DIRECTIONS = ['downward', 'upward', 'leftward', 'rightward'] as const;
const LAYERINGS = ['network-simplex', 'longest-path', 'auto'] as const;

/** past this scope size, layering 'auto' takes the O(V+E) path */
const AUTO_SIMPLEX_LIMIT = 50_000;

const defaults: Omit<FlowLayoutOptions, 'name'> = {
  fit: true, // whether to fit the viewport to the graph
  padding: 30, // padding used on fit
  direction: 'downward', // drawing direction of the flow
  nodeSep: 50, // px gap between adjacent nodes in a rank
  rankSep: 60, // px gap between rank rows
  layering: 'network-simplex', // 'longest-path' is the huge-graph fast path; 'auto' switches past ~50k nodes
  thoroughness: 7, // crossing-minimization effort, 1..10
  minLength: 1, // ranks an edge must span: number, score mapping or fn
  edgeWeight: 1, // straightening weight: number, score mapping or fn
  acyclic: false, // the graph is known acyclic: skip cycle removal
  cycleRemoval: 'greedy', // 'greedy' (Eades-Lin-Smyth) or 'dfs' (input order dominates)
  alignLongEdges: true, // bias long-edge corridors toward an endpoint x (straight taxi legs)
  rankConstraints: undefined, // { min?: string[], max?: string[], same?: string[][] } — id lists
  componentSpacing: 40, // gap between packed disconnected components
};

/** Loud validation for a node-id list option (no selector strings). */
const checkIdList = (
  cy: LayoutContext['cy'],
  ids: unknown,
  optionName: string,
): number[] => {
  if (!Array.isArray(ids)) {
    throw new TypeError(
      `The flow layout's ${optionName} must be an array of node ids`,
    );
  }

  const slots: number[] = [];

  for (const id of ids) {
    if (typeof id !== 'string') {
      throw new TypeError(
        `The flow layout's ${optionName} must contain node ids (strings)`,
      );
    }

    if (id.startsWith('#') || id.includes('[')) {
      throw new TypeError(
        `The flow layout's ${optionName} takes node ids, not selectors — got '${id}'`,
      );
    }

    const ref = cy._store.lookup(id);

    if (ref == null || ref.group !== 'nodes') {
      throw new Error(
        `The flow layout's ${optionName} names node '${id}', which does not exist`,
      );
    }

    slots.push(ref.slot);
  }

  return slots;
};

/** Resolve a per-edge numeric option (number | mapping | fn), once. */
const resolveEdgeOption = (
  ctx: LayoutContext,
  edgeSlots: number[],
  value: number | LayoutScoreMapping | ((edge: unknown) => number),
  optionName: string,
  fallback: number,
): Float64Array => {
  const out = new Float64Array(edgeSlots.length);

  if (typeof value === 'number') {
    out.fill(value);

    return out;
  }

  if (isScoreMapping(value)) {
    validateScoreMapping(value, optionName);
    checkScoreColumn(ctx.cy, 'edges', value, optionName);

    const read = ctx.cy._store.data.reader('edges', value.data);

    return resolveScores(edgeSlots.map(read), value, fallback);
  }

  if (typeof value === 'function') {
    for (let i = 0; i < edgeSlots.length; i++) {
      const v = value(ctx.cy._ele('edges', edgeSlots[i]));

      out[i] = typeof v === 'number' && Number.isFinite(v) ? v : fallback;
    }

    return out;
  }

  throw new TypeError(
    `The flow layout's ${optionName} must be a number, a { data, … } mapping or a function`,
  );
};

/** The resolved run inputs shared across phases. */
interface RunState {
  opts: Required<
    Pick<
      FlowLayoutOptions,
      | 'direction'
      | 'nodeSep'
      | 'rankSep'
      | 'layering'
      | 'thoroughness'
      | 'acyclic'
      | 'cycleRemoval'
      | 'alignLongEdges'
      | 'componentSpacing'
    >
  >;
  slots: number[];
  xy: Float64Array;
}

export class FlowLayoutImpl implements LayoutImpl {
  /**
   * Run the layered pipeline over the scope and write positions.
   *
   * @param ctx — the layout context
   */
  run(ctx: LayoutContext): void {
    const options = ctx.options as unknown as FlowLayoutOptions;
    const merged = { ...defaults, ...options };
    const state = this.validate(ctx, merged);
    const { slots } = state;

    if (slots.length === 0) {
      return;
    }

    this.compute(ctx, merged, state);

    // finisher plumbing demanded: hand the computed positions to the
    // shared discrete finisher (grid's rule, 87.3)
    if (
      merged.animate ||
      merged.animateFilter != null ||
      merged.transform != null ||
      merged.spacingFactor != null
    ) {
      const posOf = new Map<number, Position>();

      for (let i = 0; i < slots.length; i++) {
        posOf.set(slots[i], { x: state.xy[i * 2], y: state.xy[i * 2 + 1] });
      }

      ctx.layoutPositions((node: Collection): Position => {
        const ref = ctx.cy._store.lookup(node.id() as string);

        return (
          (ref != null ? posOf.get(ref.slot) : undefined) ??
          (node.position() as Position)
        );
      });

      return;
    }

    ctx.setPositions(slots, Float32Array.from(state.xy));

    if (merged.fit !== false) {
      ctx.cy.fit(
        (merged.eles as Collection | undefined) ?? undefined,
        merged.padding ?? 30,
      );
    } else {
      if (merged.zoom != null) {
        ctx.cy.zoom(merged.zoom);
      }

      if (merged.pan != null) {
        ctx.cy.pan(merged.pan);
      }
    }
  }

  /** Validate the merged options loudly; gather the scope. */
  private validate(
    ctx: LayoutContext,
    merged: FlowLayoutOptions & typeof defaults,
  ): RunState {
    if (!DIRECTIONS.includes(merged.direction!)) {
      throw new Error(
        `The flow layout's direction must be one of ` +
          `'downward', 'upward', 'leftward', 'rightward' — got '${String(merged.direction)}'`,
      );
    }

    if (!LAYERINGS.includes(merged.layering!)) {
      throw new Error(
        `The flow layout's layering must be 'network-simplex', 'longest-path' or 'auto' — ` +
          `got '${String(merged.layering)}'`,
      );
    }

    if (merged.cycleRemoval !== 'greedy' && merged.cycleRemoval !== 'dfs') {
      throw new Error(
        `The flow layout's cycleRemoval must be 'greedy' or 'dfs' — got '${String(merged.cycleRemoval)}'`,
      );
    }

    if (!(merged.nodeSep! > 0) || !(merged.rankSep! > 0)) {
      throw new Error(
        `The flow layout's nodeSep and rankSep must be positive numbers`,
      );
    }

    const t = merged.thoroughness!;

    if (!Number.isFinite(t) || t < 1 || t > 10) {
      throw new Error(
        `The flow layout's thoroughness must be between 1 and 10 — got ${String(t)}`,
      );
    }

    const slots = ctx.nodeSlots();

    return {
      opts: {
        direction: merged.direction!,
        nodeSep: merged.nodeSep!,
        rankSep: merged.rankSep!,
        layering: merged.layering!,
        thoroughness: t,
        acyclic: merged.acyclic!,
        cycleRemoval: merged.cycleRemoval!,
        alignLongEdges: merged.alignLongEdges!,
        componentSpacing: merged.componentSpacing!,
      },
      slots,
      xy: new Float64Array(slots.length * 2),
    };
  }

  /** The pipeline proper: positions land in `state.xy` (scope order). */
  private compute(
    ctx: LayoutContext,
    merged: FlowLayoutOptions & typeof defaults,
    state: RunState,
  ): void {
    const cy = ctx.cy;
    const store = cy._store;
    const { slots, opts } = state;
    const n = slots.length;

    const indexOf = new Map<number, number>();

    for (let i = 0; i < n; i++) {
      indexOf.set(slots[i], i);
    }

    // sizes off the columns (grid's pattern)
    const size = store.column('node.size') as Float32Array;
    const border = store.column('node.borderWidth') as Float32Array;
    const halfW = new Float64Array(n);
    const halfH = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      const slot = slots[i];

      halfW[i] = (size[slot * 2] + border[slot]) / 2;
      halfH[i] = (size[slot * 2 + 1] + border[slot]) / 2;
    }

    const groupModel = buildGroupModel(cy, slots);

    // scoped edges with both endpoints in scope; an endpoint on a
    // parent node expands to the parent's scoped leaves at
    // weight/leafCount (112.3 — the drawn meaning: the whole box sits
    // above or below the other endpoint)
    const endpoints = ctx.endpoints();
    const rawPairs: number[] = [];
    const rawSlots: number[] = [];
    const rawScale: number[] = [];

    let leavesOf: Map<number, number[]> | null = null;

    if (groupModel != null) {
      leavesOf = new Map();

      for (let i = 0; i < n; i++) {
        for (const g of groupModel.chains[i]) {
          let list = leavesOf.get(g);

          if (list == null) {
            leavesOf.set(g, (list = []));
          }

          list.push(i);
        }
      }
    }

    const endsFor = (slot: number): number[] | null => {
      const i = indexOf.get(slot);

      if (i != null) {
        return [i];
      }

      if (groupModel != null) {
        const g = groupModel.groupOfSlot.get(slot);

        if (g != null) {
          return leavesOf!.get(g) ?? null;
        }
      }

      return null;
    };

    for (const edgeSlot of ctx.edgeSlots()) {
      const ss = endsFor(endpoints[edgeSlot * 2]);
      const ts = endsFor(endpoints[edgeSlot * 2 + 1]);

      if (ss == null || ts == null) {
        continue;
      }

      const scale = 1 / (ss.length * ts.length);

      for (const s of ss) {
        for (const t of ts) {
          rawPairs.push(s, t);
          rawSlots.push(edgeSlot);
          rawScale.push(scale);
        }
      }
    }

    const rawWeight = resolveEdgeOption(
      ctx,
      rawSlots,
      merged.edgeWeight!,
      'edgeWeight',
      1,
    );
    const rawMinLenF = resolveEdgeOption(
      ctx,
      rawSlots,
      merged.minLength!,
      'minLength',
      1,
    );
    const rawMinLen = new Int32Array(rawSlots.length);

    for (let e = 0; e < rawSlots.length; e++) {
      rawMinLen[e] = Math.max(1, Math.round(rawMinLenF[e]));
      rawWeight[e] *= rawScale[e];
    }

    const scope = buildScope(
      n,
      Uint32Array.from(rawPairs),
      rawSlots,
      rawWeight,
      rawMinLen,
      halfW,
      halfH,
    );

    // rank constraints resolve to scope indices before the split so
    // same-groups can weld components together
    const constraints = this.resolveConstraints(ctx, merged, indexOf);
    const syntheticPairs: number[] = [];

    for (const group of constraints.same) {
      for (let i = 1; i < group.length; i++) {
        syntheticPairs.push(group[0], group[i]);
      }
    }

    // a compound's members must share a component: a split parent
    // would derive one box across two packed component tiles
    if (leavesOf != null) {
      for (const list of leavesOf.values()) {
        for (let i = 1; i < list.length; i++) {
          syntheticPairs.push(list[0], list[i]);
        }
      }
    }

    const { comps, compOf } = splitComponents(scope, syntheticPairs);

    for (const comp of comps) {
      this.layoutComponent(comp, opts, constraints, state, groupModel);
    }

    if (comps.length > 1) {
      // pack by *body* extents, not point positions — deps-style scopes
      // carry hundreds of singleton components whose point boxes are
      // empty, and packComponentsExact would overlap their bodies
      this.packBodies(
        n,
        compOf,
        comps.length,
        state.xy,
        halfW,
        halfH,
        opts.componentSpacing,
      );
    }

    this.applyBoundingBox(merged, state);
  }

  /** Rank constraints resolved to scope indices, validated loudly. */
  private resolveConstraints(
    ctx: LayoutContext,
    merged: FlowLayoutOptions,
    indexOf: Map<number, number>,
  ): { min: number[]; max: number[]; same: number[][] } {
    const rc = merged.rankConstraints;
    const out = {
      min: [] as number[],
      max: [] as number[],
      same: [] as number[][],
    };

    if (rc == null) {
      return out;
    }

    const toScope = (slots: number[], optionName: string): number[] => {
      const scoped: number[] = [];

      for (const slot of slots) {
        const i = indexOf.get(slot);

        if (i == null) {
          throw new Error(
            `The flow layout's ${optionName} names a node outside the layout scope ` +
              `(locked, a parent, or not in the eles subset)`,
          );
        }

        scoped.push(i);
      }

      return scoped;
    };

    if (rc.min != null) {
      out.min = toScope(
        checkIdList(ctx.cy, rc.min, 'rankConstraints.min'),
        'rankConstraints.min',
      );
    }

    if (rc.max != null) {
      out.max = toScope(
        checkIdList(ctx.cy, rc.max, 'rankConstraints.max'),
        'rankConstraints.max',
      );
    }

    if (rc.same != null) {
      if (!Array.isArray(rc.same)) {
        throw new TypeError(
          `The flow layout's rankConstraints.same must be an array of id arrays`,
        );
      }

      for (const group of rc.same) {
        const scoped = toScope(
          checkIdList(ctx.cy, group, 'rankConstraints.same'),
          'rankConstraints.same',
        );

        if (scoped.length > 1) {
          out.same.push(scoped);
        }
      }
    }

    return out;
  }

  /** One component through the whole pipeline; writes into state.xy. */
  private layoutComponent(
    comp: FlowComponent,
    opts: RunState['opts'],
    constraints: { min: number[]; max: number[]; same: number[][] },
    state: RunState,
    groupModel: GroupModel | null,
  ): void {
    if (!opts.acyclic) {
      if (opts.cycleRemoval === 'dfs') {
        dfsFAS(comp);
      } else {
        greedyFAS(comp);
      }
    }

    const rank = this.rankComponent(comp, opts, constraints, state);
    const rankCount = normalizeRanks(rank);
    const L = buildLayers(comp, rank, rankCount);

    // compound path (112.3): grouped ordering, border walls, padding
    let nested = false;

    if (groupModel != null) {
      for (let v = 0; v < comp.n && !nested; v++) {
        nested = groupModel.chains[comp.scopeOf[v]].length > 0;
      }
    }

    let margins: { top: Float64Array; bottom: Float64Array } | null = null;
    let halfWAll: Float64Array = comp.halfW;

    if (nested) {
      const view = buildCompoundView(
        groupModel!,
        comp.scopeOf,
        comp.src,
        comp.tgt,
        L,
      );

      orderLayers(L, opts.thoroughness, view.chainOf);

      const wallGroup = insertBorders(L, view);

      margins = rankPadMargins(L, view);
      halfWAll = new Float64Array(L.nTotal).fill(1);
      halfWAll.set(comp.halfW.subarray(0, comp.n));

      for (let v = 0; v < L.nTotal; v++) {
        if (wallGroup[v] >= 0) {
          halfWAll[v] = Math.max(1, groupModel!.padX[wallGroup[v]]);
        }
      }
    } else {
      orderLayers(L, opts.thoroughness);
    }

    const x = assignX(L, halfWAll, { nodeSep: opts.nodeSep });
    const y = assignY(L, comp.halfH, opts.rankSep, margins);
    const [outX, outY] = applyDirection(x, y, opts.direction);

    for (let v = 0; v < comp.n; v++) {
      const i = comp.scopeOf[v];

      state.xy[i * 2] = outX[v];
      state.xy[i * 2 + 1] = outY[v];
    }
  }

  /** Ranking with same/min/max constraints via contraction. */
  private rankComponent(
    comp: FlowComponent,
    opts: RunState['opts'],
    constraints: { min: number[]; max: number[]; same: number[][] },
    state: RunState,
  ): Int32Array {
    const scopeToLocal = new Map<number, number>();

    for (let v = 0; v < comp.n; v++) {
      scopeToLocal.set(comp.scopeOf[v], v);
    }

    // union-find over same-groups (component-local)
    const rep = new Int32Array(comp.n);

    for (let v = 0; v < comp.n; v++) {
      rep[v] = v;
    }

    const find = (v: number): number => {
      while (rep[v] !== v) {
        rep[v] = rep[rep[v]];
        v = rep[v];
      }

      return v;
    };

    const localGroups: number[][] = [];

    for (const group of constraints.same) {
      const locals = group
        .map((i) => scopeToLocal.get(i))
        .filter((v): v is number => v != null);

      if (locals.length > 1) {
        localGroups.push(locals);

        for (let i = 1; i < locals.length; i++) {
          const a = find(locals[0]);
          const b = find(locals[i]);

          if (a !== b) {
            rep[b] = a;
          }
        }
      }
    }

    const localMin = constraints.min
      .map((i) => scopeToLocal.get(i))
      .filter((v): v is number => v != null);
    const localMax = constraints.max
      .map((i) => scopeToLocal.get(i))
      .filter((v): v is number => v != null);

    const hasConstraints =
      localGroups.length > 0 || localMin.length > 0 || localMax.length > 0;

    if (!hasConstraints) {
      const rank = rankLongestPath(comp);

      if (this.useSimplex(opts, state)) {
        rankNetworkSimplex(comp, rank, Math.min(2 * comp.n + 100, 4000));
        balanceRanks(comp, rank);
      }

      return rank;
    }

    // contracted view: representatives plus optional min/max anchors
    const repIds = new Map<number, number>(); // find(v) -> contracted id
    const contractedOf = new Int32Array(comp.n);

    for (let v = 0; v < comp.n; v++) {
      const r = find(v);
      let id = repIds.get(r);

      if (id == null) {
        id = repIds.size;
        repIds.set(r, id);
      }

      contractedOf[v] = id;
    }

    let cn = repIds.size;
    const minAnchor = localMin.length > 0 ? cn++ : -1;
    const maxAnchor = localMax.length > 0 ? cn++ : -1;

    const csrc: number[] = [];
    const ctgt: number[] = [];
    const cweight: number[] = [];
    const cminLen: number[] = [];

    for (let e = 0; e < comp.m; e++) {
      const s = contractedOf[comp.src[e]];
      const t = contractedOf[comp.tgt[e]];

      if (s === t) {
        if (comp.minLen[e] > 0) {
          throw new Error(
            `The flow layout's rankConstraints.same puts an edge's endpoints on one rank — ` +
              `contradictory constraints`,
          );
        }

        continue;
      }

      csrc.push(s);
      ctgt.push(t);
      cweight.push(comp.weight[e]);
      cminLen.push(comp.minLen[e]);
    }

    // min-group ≤ every other contracted node; max-group ≥ every one
    if (minAnchor >= 0) {
      const g = contractedOf[localMin[0]];

      for (const v of localMin) {
        if (contractedOf[v] !== g) {
          // distinct same-groups both pinned to min collapse together
          csrc.push(g, contractedOf[v]);
          ctgt.push(contractedOf[v], g);
          cweight.push(0, 0);
          cminLen.push(0, 0);
        }
      }

      for (let id = 0; id < cn; id++) {
        if (id !== g && id !== minAnchor && id !== maxAnchor) {
          csrc.push(g);
          ctgt.push(id);
          cweight.push(0);
          cminLen.push(0);
        }
      }
    }

    if (maxAnchor >= 0) {
      const g = contractedOf[localMax[0]];

      for (const v of localMax) {
        if (contractedOf[v] !== g) {
          csrc.push(g, contractedOf[v]);
          ctgt.push(contractedOf[v], g);
          cweight.push(0, 0);
          cminLen.push(0, 0);
        }
      }

      for (let id = 0; id < cn; id++) {
        if (id !== g && id !== minAnchor && id !== maxAnchor) {
          csrc.push(id);
          ctgt.push(g);
          cweight.push(0);
          cminLen.push(0);
        }
      }
    }

    const contracted = this.makeContracted(cn, csrc, ctgt, cweight, cminLen);

    // constraint edges may complete a cycle: that is a contradiction,
    // reported as such rather than as a residual-cycle defect
    let crank: Int32Array;

    try {
      crank = rankLongestPath(contracted);
    } catch {
      throw new Error(
        `The flow layout's rankConstraints are contradictory — ` +
          `min/max/same cannot all hold on this graph`,
      );
    }

    if (this.useSimplex(opts, state)) {
      rankNetworkSimplex(contracted, crank, Math.min(2 * cn + 100, 4000));
      balanceRanks(contracted, crank);
    }

    const rank = new Int32Array(comp.n);

    for (let v = 0; v < comp.n; v++) {
      rank[v] = crank[contractedOf[v]];
    }

    return rank;
  }

  /** Assemble a bare FlowComponent for the contracted ranking view. */
  private makeContracted(
    n: number,
    src: number[],
    tgt: number[],
    weight: number[],
    minLen: number[],
  ): FlowComponent {
    const comp: FlowComponent = {
      n,
      m: src.length,
      src: Uint32Array.from(src),
      tgt: Uint32Array.from(tgt),
      weight: Float64Array.from(weight),
      minLen: Int32Array.from(minLen),
      reversed: new Uint8Array(src.length),
      outOff: new Uint32Array(0),
      outAdj: new Uint32Array(0),
      inOff: new Uint32Array(0),
      inAdj: new Uint32Array(0),
      scopeOf: new Uint32Array(n),
      halfW: new Float64Array(n),
      halfH: new Float64Array(n),
    };

    // CSR for the rankers
    const outOff = new Uint32Array(n + 1);
    const inOff = new Uint32Array(n + 1);

    for (let e = 0; e < comp.m; e++) {
      outOff[comp.src[e] + 1]++;
      inOff[comp.tgt[e] + 1]++;
    }

    for (let i = 0; i < n; i++) {
      outOff[i + 1] += outOff[i];
      inOff[i + 1] += inOff[i];
    }

    const outAdj = new Uint32Array(comp.m);
    const inAdj = new Uint32Array(comp.m);
    const oc = outOff.slice(0, n);
    const ic = inOff.slice(0, n);

    for (let e = 0; e < comp.m; e++) {
      outAdj[oc[comp.src[e]]++] = e;
      inAdj[ic[comp.tgt[e]]++] = e;
    }

    comp.outOff = outOff;
    comp.outAdj = outAdj;
    comp.inOff = inOff;
    comp.inAdj = inAdj;

    return comp;
  }

  /** Shelf-pack component *body* boxes and translate members. */
  private packBodies(
    n: number,
    compOf: Int32Array,
    count: number,
    xy: Float64Array,
    halfW: Float64Array,
    halfH: Float64Array,
    spacing: number,
  ): void {
    const x1 = new Float64Array(count).fill(Infinity);
    const y1 = new Float64Array(count).fill(Infinity);
    const x2 = new Float64Array(count).fill(-Infinity);
    const y2 = new Float64Array(count).fill(-Infinity);

    for (let i = 0; i < n; i++) {
      const c = compOf[i];

      x1[c] = Math.min(x1[c], xy[i * 2] - halfW[i]);
      x2[c] = Math.max(x2[c], xy[i * 2] + halfW[i]);
      y1[c] = Math.min(y1[c], xy[i * 2 + 1] - halfH[i]);
      y2[c] = Math.max(y2[c], xy[i * 2 + 1] + halfH[i]);
    }

    const boxes: PackBox[] = [];

    for (let c = 0; c < count; c++) {
      boxes.push({ id: c, w: x2[c] - x1[c], h: y2[c] - y1[c], x: 0, y: 0 });
    }

    shelfPack(boxes, spacing);

    const dx = new Float64Array(count);
    const dy = new Float64Array(count);

    for (const box of boxes) {
      dx[box.id] = box.x - x1[box.id];
      dy[box.id] = box.y - y1[box.id];
    }

    for (let i = 0; i < n; i++) {
      xy[i * 2] += dx[compOf[i]];
      xy[i * 2 + 1] += dy[compOf[i]];
    }
  }

  private useSimplex(opts: RunState['opts'], state: RunState): boolean {
    if (opts.layering === 'longest-path') {
      return false;
    }

    if (opts.layering === 'auto') {
      return state.slots.length <= AUTO_SIMPLEX_LIMIT;
    }

    return true;
  }

  /** Fit the drawing into an explicit boundingBox, if one was given. */
  private applyBoundingBox(merged: FlowLayoutOptions, state: RunState): void {
    const bbIn = merged.boundingBox as
      | {
          x1: number;
          y1: number;
          x2?: number;
          y2?: number;
          w?: number;
          h?: number;
        }
      | undefined;

    if (bbIn == null || state.slots.length === 0) {
      return;
    }

    const bw = bbIn.w ?? bbIn.x2! - bbIn.x1;
    const bh = bbIn.h ?? bbIn.y2! - bbIn.y1;
    const { xy } = state;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < state.slots.length; i++) {
      minX = Math.min(minX, xy[i * 2]);
      maxX = Math.max(maxX, xy[i * 2]);
      minY = Math.min(minY, xy[i * 2 + 1]);
      maxY = Math.max(maxY, xy[i * 2 + 1]);
    }

    // scale down (never up) to fit, then centre in the box — nodeSep and
    // rankSep own the density; the box owns placement
    const w = Math.max(1e-9, maxX - minX);
    const h = Math.max(1e-9, maxY - minY);
    const scale = Math.min(1, bw / w, bh / h);
    const cx = bbIn.x1 + bw / 2;
    const cy = bbIn.y1 + bh / 2;
    const mx = (minX + maxX) / 2;
    const my = (minY + maxY) / 2;

    for (let i = 0; i < state.slots.length; i++) {
      xy[i * 2] = cx + (xy[i * 2] - mx) * scale;
      xy[i * 2 + 1] = cy + (xy[i * 2 + 1] - my) * scale;
    }
  }
}
