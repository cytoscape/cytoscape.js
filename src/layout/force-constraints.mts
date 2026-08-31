import type { Core } from '../core.mjs';

/*
Force-layout constraints (round 85.2 — fcose #54/#53 absorbed): the
declarative surface and its validation.  Three kinds:

- fixed — already spelled `lock()`: a locked node takes part in every
  force pair but never moves.  There is deliberately no second
  spelling here.
- alignment — `{ horizontal?: string[][], vertical?: string[][] }`
  (fcose's shape; id arrays, serializable).  `horizontal` groups
  share a y coordinate, `vertical` groups an x.  Groups sharing a
  node merge transitively per orientation.
- relative placement —
  `[{ left, right, gap? } | { top, bottom, gap? }]`: left stays at
  least `gap` px left of right (top/bottom likewise), `gap`
  defaulting to the run's mean ideal edge length (fcose's stance).

Validation fails loudly at start (the 85.3 rule — a typo'd id must
not lay out plausibly wrong): unknown ids throw, a cycle in either
axis's placement DAG throws, and two locked members of one alignment
group at different coordinates throw.  The resolved output is
sim-indexed and consumed by the CPU executor's projection step
(force-sim.mts); constrained runs take the CPU executor (the
compound precedent — see the run() doc in force.mts).
*/

/** axis 0 = x (vertical alignment, left/right placement); 1 = y */
export interface AlignmentGroup {
  axis: 0 | 1;
  members: Int32Array;
  /** the coordinate a locked member pins the whole group to */
  pinnedAt?: number;
}

export interface RelativePair {
  /** the lesser-coordinate node (left, or top) */
  a: number;
  /** the greater-coordinate node (right, or bottom) */
  b: number;
  axis: 0 | 1;
  gap: number;
}

export interface ForceConstraints {
  groups: AlignmentGroup[];
  pairs: RelativePair[];
}

export interface AlignmentSpec {
  horizontal?: string[][];
  vertical?: string[][];
}

export type RelativePlacementSpec = (
  | { left: string; right: string; gap?: number }
  | { top: string; bottom: string; gap?: number }
)[];

/**
 * Resolve and validate the constraint options into sim-indexed form.
 *
 * @param cy — the core, for id resolution
 * @param alignment — the alignment option, if any
 * @param relativePlacement — the relative-placement option, if any
 * @param simIndex — node slot → sim index for the run's scope
 * @param pinned — per-sim-node pinned flags (locked nodes)
 * @param positions — the store's position column, slot-indexed — what
 *   a locked member pins its group to
 * @param slotOf — sim index → node slot (for reading a pinned
 *   member's coordinate)
 * @param defaultGap — the gap a relative pair takes when unspecified
 *   (the run's mean ideal edge length)
 * @returns the resolved constraints, or null when none were given
 * @throws on an unknown or out-of-scope id, a malformed
 *   relative-placement entry, two locked members of one alignment
 *   group at different coordinates, or a cycle in either axis's
 *   placement DAG
 */
export const resolveConstraints = (
  cy: Core,
  alignment: AlignmentSpec | undefined,
  relativePlacement: RelativePlacementSpec | undefined,
  simIndex: Map<number, number>,
  pinned: Uint8Array,
  positions: Float32Array,
  slotOf: number[],
  defaultGap: number,
): ForceConstraints | null => {
  if (alignment == null && relativePlacement == null) {
    return null;
  }

  const indexOf = (id: string, what: string): number => {
    const entry = cy._store.lookup(id);
    const sim = entry?.group === 'nodes' ? simIndex.get(entry.slot) : undefined;

    if (sim == null) {
      throw new Error(
        `force ${what} names node '${id}', which is not in the layout scope`,
      );
    }

    return sim;
  };

  // -- alignment: resolve, then merge groups sharing a node (per
  // orientation) with a union-find over sim indices
  const groups: AlignmentGroup[] = [];

  for (const [key, axis] of [
    ['horizontal', 1],
    ['vertical', 0],
  ] as const) {
    const lists = alignment?.[key];

    if (lists == null) {
      continue;
    }

    const parent = new Map<number, number>();
    const find = (x: number): number => {
      let root = parent.get(x) as number;

      while (root !== parent.get(root)) {
        root = parent.get(root) as number;
      }

      return root;
    };

    for (const list of lists) {
      let first: number | null = null;

      for (const id of list) {
        const sim = indexOf(id, `alignment (${key})`);

        if (!parent.has(sim)) {
          parent.set(sim, sim);
        }
        if (first == null) {
          first = sim;
        } else {
          parent.set(find(sim), find(first));
        }
      }
    }

    const byRoot = new Map<number, number[]>();

    for (const sim of parent.keys()) {
      const root = find(sim);
      let list = byRoot.get(root);

      if (list == null) {
        byRoot.set(root, (list = []));
      }

      list.push(sim);
    }

    for (const members of byRoot.values()) {
      if (members.length < 2) {
        continue;
      }

      members.sort((a, b) => a - b);

      // a locked member pins the whole group to its coordinate; two
      // locked members must already agree or the group is unsatisfiable
      let pinnedAt: number | undefined;

      for (const sim of members) {
        if (pinned[sim] !== 1) {
          continue;
        }

        const at = positions[slotOf[sim] * 2 + axis];

        if (pinnedAt != null && Math.abs(pinnedAt - at) > 1e-6) {
          throw new Error(
            `force alignment (${key}): two locked members sit at different ` +
              `${axis === 0 ? 'x' : 'y'} coordinates (${pinnedAt} vs ${at}) — ` +
              `the group cannot be satisfied`,
          );
        }

        pinnedAt = at;
      }

      groups.push({ axis, members: Int32Array.from(members), pinnedAt });
    }
  }

  // -- relative placement: resolve, then reject a cycle per axis
  const pairs: RelativePair[] = [];

  for (const entry of relativePlacement ?? []) {
    const e = entry as {
      left?: string;
      right?: string;
      top?: string;
      bottom?: string;
    };
    const horizontal = e.left != null && e.right != null;
    const vertical = e.top != null && e.bottom != null;

    if (horizontal === vertical) {
      throw new Error(
        `force relativePlacement: each entry is { left, right, gap? } or ` +
          `{ top, bottom, gap? } — got ${JSON.stringify(entry)}`,
      );
    }

    const [aId, bId, axis] = horizontal
      ? [
          (entry as { left: string }).left,
          (entry as { right: string }).right,
          0 as const,
        ]
      : [
          (entry as { top: string }).top,
          (entry as { bottom: string }).bottom,
          1 as const,
        ];

    pairs.push({
      a: indexOf(aId, 'relativePlacement'),
      b: indexOf(bId, 'relativePlacement'),
      axis,
      gap: entry.gap ?? defaultGap,
    });
  }

  for (const axis of [0, 1] as const) {
    assertAcyclic(
      pairs.filter((p) => p.axis === axis),
      axis,
    );
  }

  return groups.length === 0 && pairs.length === 0 ? null : { groups, pairs };
};

/** Kahn's algorithm over one axis's a→b pairs; leftovers are a cycle. */
const assertAcyclic = (pairs: RelativePair[], axis: 0 | 1): void => {
  if (pairs.length === 0) {
    return;
  }

  const inDegree = new Map<number, number>();
  const out = new Map<number, number[]>();

  for (const { a, b } of pairs) {
    inDegree.set(a, inDegree.get(a) ?? 0);
    inDegree.set(b, (inDegree.get(b) ?? 0) + 1);

    let list = out.get(a);

    if (list == null) {
      out.set(a, (list = []));
    }

    list.push(b);
  }

  const queue: number[] = [];

  for (const [node, deg] of inDegree) {
    if (deg === 0) {
      queue.push(node);
    }
  }

  let seen = 0;

  while (queue.length > 0) {
    const node = queue.pop() as number;

    seen++;

    for (const next of out.get(node) ?? []) {
      const deg = (inDegree.get(next) as number) - 1;

      inDegree.set(next, deg);

      if (deg === 0) {
        queue.push(next);
      }
    }
  }

  if (seen !== inDegree.size) {
    throw new Error(
      `force relativePlacement: the ${axis === 0 ? 'left/right' : 'top/bottom'} ` +
        `constraints contain a cycle — no placement can satisfy them`,
    );
  }
};
