/*
Component packing (round 87.1, extracted from the force layout's
round-59.2 machinery), pure and sim-indexed: union-find over edge
pairs, the shelf packer, estimated anchor packing and the exact
translation-only re-pack (v3 cose's `separateComponents` row shape).

Extracted so any layout — built-in or extension — can pack
disconnected components in one call (`LayoutContext.packComponents`),
instead of the packing living module-private inside the force
layout's init.  Everything here is deterministic: component ids are
first-seen order and ties in every sort break on the id.
*/

export interface Components {
  /** per sim-node component id (first-seen order — deterministic) */
  compOf: Int32Array;
  /** per component member count */
  sizes: Int32Array;
  count: number;
}

/**
 * Union-find over the sim's edge pairs.
 *
 * @param n — sim node count
 * @param edges — endpoint pairs in sim-index space
 * @returns the component assignment, ids in first-seen node order
 */
export const computeComponents = (
  n: number,
  edges: Uint32Array,
): Components => {
  const parent = new Int32Array(n);

  for (let i = 0; i < n; i++) {
    parent[i] = i;
  }

  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }

    return x;
  };

  const m = edges.length / 2;

  for (let e = 0; e < m; e++) {
    const a = find(edges[e * 2]);
    const b = find(edges[e * 2 + 1]);

    if (a !== b) {
      parent[a] = b;
    }
  }

  const compOf = new Int32Array(n);
  const idOf = new Map<number, number>();

  for (let i = 0; i < n; i++) {
    const root = find(i);
    let id = idOf.get(root);

    if (id == null) {
      id = idOf.size;
      idOf.set(root, id);
    }

    compOf[i] = id;
  }

  const sizes = new Int32Array(idOf.size);

  for (let i = 0; i < n; i++) {
    sizes[compOf[i]]++;
  }

  return { compOf, sizes, count: idOf.size };
};

/**
 * The disc radius a component is *expected* to settle into: `size`
 * nodes hex-packed at roughly the mean ideal edge length.  An estimate
 * for anchor placement and seeding only — the exact re-pack never
 * reads it.
 *
 * @param size — the component's member count
 * @param meanL — the run's mean ideal edge length
 * @returns the radius in model px, floored at half an edge length
 */
export const estimateComponentRadius = (
  size: number,
  meanL: number,
): number => {
  return Math.max(meanL / 2, Math.sqrt(size / Math.PI) * meanL * 0.85);
};

/** A box handed to `shelfPack`: its (w, h) in, its placed top-left
 * (x, y) out. */
export interface PackBox {
  id: number;
  w: number;
  h: number;
  /** out: the placed top-left */
  x: number;
  y: number;
}

/**
 * Shelf-pack boxes (area-descending, id ties) into rows; mutates each
 * box's (x, y) to its placed top-left.  The v3 `separateComponents`
 * shape: rows wrap at ~sqrt(total area) so the packing tends square.
 *
 * @param boxes — the boxes to place; each `(x, y)` is written in place
 * @param spacing — the gap between boxes, and between rows
 */
export const shelfPack = (boxes: PackBox[], spacing: number): void => {
  const order = [...boxes].sort((a, b) => b.w * b.h - a.w * a.h || a.id - b.id);

  let total = 0;
  let widest = 0;

  for (const box of order) {
    total += (box.w + spacing) * (box.h + spacing);
    widest = Math.max(widest, box.w);
  }

  const rowW = Math.max(widest, Math.sqrt(total) * 1.25);

  let x = 0;
  let y = 0;
  let rowH = 0;

  for (const box of order) {
    if (x > 0 && x + box.w > rowW) {
      y += rowH + spacing;
      x = 0;
      rowH = 0;
    }

    box.x = x;
    box.y = y;
    x += box.w + spacing;
    rowH = Math.max(rowH, box.h);
  }
};

/**
 * Anchor centres per component: estimated discs shelf-packed
 * largest-first, the whole field centred on its own bounding box —
 * a single component sits exactly at the origin.
 *
 * @param sizes — per-component member counts
 * @param meanL — the run's mean ideal edge length
 * @param spacing — the gap between component discs (`componentSpacing`)
 * @returns interleaved anchor coordinates, indexed by component id
 */
export const packAnchors = (
  sizes: Int32Array,
  meanL: number,
  spacing: number,
): Float32Array => {
  const count = sizes.length;
  const anchors = new Float32Array(count * 2);

  if (count <= 1) {
    return anchors;
  }

  const boxes: PackBox[] = [];

  for (let c = 0; c < count; c++) {
    const r = estimateComponentRadius(sizes[c], meanL);

    boxes.push({ id: c, w: 2 * r, h: 2 * r, x: 0, y: 0 });
  }

  shelfPack(boxes, spacing);

  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;

  for (const box of boxes) {
    x1 = Math.min(x1, box.x);
    y1 = Math.min(y1, box.y);
    x2 = Math.max(x2, box.x + box.w);
    y2 = Math.max(y2, box.y + box.h);
  }

  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;

  for (const box of boxes) {
    anchors[box.id * 2] = box.x + box.w / 2 - cx;
    anchors[box.id * 2 + 1] = box.y + box.h / 2 - cy;
  }

  return anchors;
};

/** Per-node extents relative to the node position (the `LayoutNodeDims`
 * shape, or any four parallel arrays). */
export interface NodeExtents {
  x1: ArrayLike<number>;
  y1: ArrayLike<number>;
  x2: ArrayLike<number>;
  y2: ArrayLike<number>;
}

/**
 * The exact translation-only re-pack over component *body* boxes
 * (round 114.4, flow's 112.2 `packBodies` made shared): per-component
 * boxes are the union of each member's box at its position, shelf-packed
 * largest-first with `spacing` between them, every member translated
 * with its component.  With `extents` null the boxes are point boxes —
 * `packComponentsExact`'s shape, where two singleton components could
 * overlap by a node width.  `holdLargest` keeps the largest component's
 * centre where it was (force's fixed point); otherwise the packed field
 * starts at the origin (flow centres afterwards).
 *
 * @param n — sim node count
 * @param compOf — per-node component id
 * @param count — component count
 * @param positions — 2n interleaved coordinates, translated in place
 * @param extents — per-node node-local boxes, or null for point boxes
 * @param spacing — the gap between component boxes
 * @param holdLargest — keep the largest component's centre fixed
 */
export const packComponentBodies = (
  n: number,
  compOf: Int32Array,
  count: number,
  positions: Float32Array | Float64Array,
  extents: NodeExtents | null,
  spacing: number,
  holdLargest: boolean,
): void => {
  if (count <= 1 || n === 0) {
    return;
  }

  const x1 = new Float64Array(count).fill(Infinity);
  const y1 = new Float64Array(count).fill(Infinity);
  const x2 = new Float64Array(count).fill(-Infinity);
  const y2 = new Float64Array(count).fill(-Infinity);

  for (let i = 0; i < n; i++) {
    const c = compOf[i];
    const x = positions[i * 2];
    const y = positions[i * 2 + 1];

    if (extents == null) {
      x1[c] = Math.min(x1[c], x);
      y1[c] = Math.min(y1[c], y);
      x2[c] = Math.max(x2[c], x);
      y2[c] = Math.max(y2[c], y);
    } else {
      x1[c] = Math.min(x1[c], x + extents.x1[i]);
      y1[c] = Math.min(y1[c], y + extents.y1[i]);
      x2[c] = Math.max(x2[c], x + extents.x2[i]);
      y2[c] = Math.max(y2[c], y + extents.y2[i]);
    }
  }

  const boxes: PackBox[] = [];

  for (let c = 0; c < count; c++) {
    boxes.push({
      id: c,
      w: Math.max(1, x2[c] - x1[c]),
      h: Math.max(1, y2[c] - y1[c]),
      x: 0,
      y: 0,
    });
  }

  // the largest component's centre is the fixed point of the re-pack
  let largest = 0;

  for (let c = 1; c < count; c++) {
    if (boxes[c].w * boxes[c].h > boxes[largest].w * boxes[largest].h) {
      largest = c;
    }
  }

  const holdX = (x1[largest] + x2[largest]) / 2;
  const holdY = (y1[largest] + y2[largest]) / 2;

  shelfPack(boxes, spacing);

  // translate members: component c's box moves from (x1, y1) to the
  // packed top-left
  const dx = new Float64Array(count);
  const dy = new Float64Array(count);

  for (const box of boxes) {
    dx[box.id] = box.x - x1[box.id];
    dy[box.id] = box.y - y1[box.id];
  }

  // shift the whole packed field so the largest component's centre
  // stays put
  let shiftX = 0;
  let shiftY = 0;

  if (holdLargest) {
    const packedLargest = boxes.find((b) => b.id === largest) as PackBox;

    shiftX = holdX - (packedLargest.x + packedLargest.w / 2);
    shiftY = holdY - (packedLargest.y + packedLargest.h / 2);
  }

  for (let i = 0; i < n; i++) {
    const c = compOf[i];

    positions[i * 2] += dx[c] + shiftX;
    positions[i * 2 + 1] += dy[c] + shiftY;
  }
};

/**
 * The exact translation-only re-pack over point boxes — the round-59.2
 * shape, kept as the name force's specs know: `packComponentBodies`
 * with no extents and the largest component held.
 *
 * @param n — sim node count
 * @param compOf — per-node component id
 * @param count — component count
 * @param positions — 2n interleaved coordinates, translated in place
 * @param spacing — the gap between component boxes
 */
export const packComponentsExact = (
  n: number,
  compOf: Int32Array,
  count: number,
  positions: Float32Array,
  spacing: number,
): void => {
  packComponentBodies(n, compOf, count, positions, null, spacing, true);
};

/** A layout `boundingBox` as the options spell it: `{ x1, y1 }` plus
 * either `{ x2, y2 }` or `{ w, h }`. */
export interface BoxInput {
  x1: number;
  y1: number;
  x2?: number;
  y2?: number;
  w?: number;
  h?: number;
}

/**
 * Fit a drawing's *bodies* into an explicit box (flow's 114.6 rule,
 * made shared in 116.2 so force honours `boundingBox` by the same
 * sentence): scale the centres down — never up — about their centre
 * until every box lies within the given width and height, then centre
 * the body extents in the box.  Uniform, so the drawing's structure is
 * kept; spacing options own the density, the box owns placement.  A
 * box narrower than the widest body cannot hold it: the centres
 * collapse toward the box centre (scale 0).  With `extents` null the
 * boxes are points.
 *
 * @param n — node count
 * @param xy — 2n interleaved positions, moved in place
 * @param extents — per-node node-local boxes, or null for point boxes
 * @param box — the target box
 */
export const fitBodiesToBox = (
  n: number,
  xy: Float32Array | Float64Array | number[],
  extents: NodeExtents | null,
  box: BoxInput,
): void => {
  if (n === 0) {
    return;
  }

  const bw = box.w ?? (box.x2 as number) - box.x1;
  const bh = box.h ?? (box.y2 as number) - box.y1;
  const left = (i: number): number => (extents == null ? 0 : -extents.x1[i]);
  const right = (i: number): number => (extents == null ? 0 : extents.x2[i]);
  const top = (i: number): number => (extents == null ? 0 : -extents.y1[i]);
  const bottom = (i: number): number => (extents == null ? 0 : extents.y2[i]);

  // the body extents: scaling moves centres, not sizes, so the room the
  // box has for the centre span is the box less the widest overhangs at
  // either end
  const bodyExtents = (): [number, number, number, number] => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < n; i++) {
      minX = Math.min(minX, xy[i * 2] - left(i));
      maxX = Math.max(maxX, xy[i * 2] + right(i));
      minY = Math.min(minY, xy[i * 2 + 1] - top(i));
      maxY = Math.max(maxY, xy[i * 2 + 1] + bottom(i));
    }

    return [minX, minY, maxX, maxY];
  };

  let [minX, minY, maxX, maxY] = bodyExtents();
  let maxLeft = 0;
  let maxRight = 0;
  let maxTop = 0;
  let maxBottom = 0;
  let cMinX = Infinity;
  let cMaxX = -Infinity;
  let cMinY = Infinity;
  let cMaxY = -Infinity;

  for (let i = 0; i < n; i++) {
    maxLeft = Math.max(maxLeft, left(i));
    maxRight = Math.max(maxRight, right(i));
    maxTop = Math.max(maxTop, top(i));
    maxBottom = Math.max(maxBottom, bottom(i));
    cMinX = Math.min(cMinX, xy[i * 2]);
    cMaxX = Math.max(cMaxX, xy[i * 2]);
    cMinY = Math.min(cMinY, xy[i * 2 + 1]);
    cMaxY = Math.max(cMaxY, xy[i * 2 + 1]);
  }

  if (maxX - minX > bw || maxY - minY > bh) {
    const scale = Math.max(
      0,
      Math.min(
        1,
        (bw - maxLeft - maxRight) / Math.max(1e-9, cMaxX - cMinX),
        (bh - maxTop - maxBottom) / Math.max(1e-9, cMaxY - cMinY),
      ),
    );
    const mx = (cMinX + cMaxX) / 2;
    const my = (cMinY + cMaxY) / 2;

    for (let i = 0; i < n; i++) {
      xy[i * 2] = mx + (xy[i * 2] - mx) * scale;
      xy[i * 2 + 1] = my + (xy[i * 2 + 1] - my) * scale;
    }

    [minX, minY, maxX, maxY] = bodyExtents();
  }

  const dx = box.x1 + bw / 2 - (minX + maxX) / 2;
  const dy = box.y1 + bh / 2 - (minY + maxY) / 2;

  for (let i = 0; i < n; i++) {
    xy[i * 2] += dx;
    xy[i * 2 + 1] += dy;
  }
};

/**
 * Canonical shapes for the smallest components (round 120): two nodes
 * stand as a vertical barbell, three as a point-up triangle, four as a
 * diamond.  A sim leaves a two-node component at whatever angle its
 * seed gave it and a triangle skewed by its transient, so the packed
 * rows of small components read as noise; canonical shapes make every
 * component of a size the same box, which the largest-first shelf pack
 * then lays out in orderly rows — and the barbell's vertical stance
 * keeps two centre-aligned labels, which read left to right, off each
 * other.  Singletons have no shape to take.
 *
 * Each shape's radius is the largest of what its edges ask (the
 * component's mean ideal length along every side) and what its bodies
 * need (horizontal neighbours a body width plus `gap` apart, vertical
 * ones a body height plus `gap`), so the separation pass finds them
 * clear.  Nodes are placed around the perimeter in walk order from the
 * highest-degree member — a path or a cycle runs round the shape, a
 * star's hub takes the top — and the shape is centred where the
 * component's centroid was.  A component holding a pinned node is left
 * as it is, and so is one whose edges ask for different lengths.
 *
 * @param n — sim node count
 * @param edges — endpoint pairs in sim-index space
 * @param edgeLength — per-edge ideal length
 * @param comps — the component assignment
 * @param positions — 2n interleaved coordinates, rewritten in place
 * @param dims — per-node body boxes (node-local), or null for points
 * @param gap — the clearance between neighbouring bodies
 * @param pinned — per-node non-zero for a node that must not move
 * @returns how many components took a shape
 */
export const tidySmallComponents = (
  n: number,
  edges: Uint32Array,
  edgeLength: ArrayLike<number>,
  comps: Components,
  positions: Float32Array | Float64Array,
  dims: NodeExtents | null,
  gap: number,
  pinned: ArrayLike<number> | null,
): number => {
  const { compOf, sizes, count } = comps;
  const members: number[][] = [];
  const adjacency: number[][] = Array.from({ length: n }, () => []);
  const lengthSum = new Float64Array(count);
  const lengthCount = new Int32Array(count);
  const lengthMin = new Float64Array(count).fill(Infinity);
  const lengthMax = new Float64Array(count).fill(-Infinity);
  const hold = new Uint8Array(count);

  for (let c = 0; c < count; c++) {
    members.push([]);
  }

  for (let i = 0; i < n; i++) {
    members[compOf[i]].push(i);

    if (pinned != null && pinned[i] !== 0) {
      hold[compOf[i]] = 1;
    }
  }

  const m = edges.length / 2;

  for (let e = 0; e < m; e++) {
    const a = edges[e * 2];
    const b = edges[e * 2 + 1];

    adjacency[a].push(b);
    adjacency[b].push(a);
    lengthSum[compOf[a]] += edgeLength[e];
    lengthCount[compOf[a]]++;
    lengthMin[compOf[a]] = Math.min(lengthMin[compOf[a]], edgeLength[e]);
    lengthMax[compOf[a]] = Math.max(lengthMax[compOf[a]], edgeLength[e]);
  }

  let shaped = 0;

  for (let c = 0; c < count; c++) {
    const size = sizes[c];

    // a component whose edges ask for different lengths (a data-driven
    // `edgeLength`) keeps the sim's shape: a canonical shape has one
    // side, and the lengths were the caller's point
    if (
      size < 2 ||
      size > 4 ||
      hold[c] === 1 ||
      lengthMax[c] - lengthMin[c] > 1e-6 * Math.max(1, lengthMax[c])
    ) {
      continue;
    }

    const nodes = members[c];
    const meanL = lengthCount[c] > 0 ? lengthSum[c] / lengthCount[c] : 0;

    // the widest and tallest body in the component, for the clearance
    let bodyW = 0;
    let bodyH = 0;
    let cx = 0;
    let cy = 0;

    for (const i of nodes) {
      if (dims != null) {
        bodyW = Math.max(bodyW, dims.x2[i] - dims.x1[i]);
        bodyH = Math.max(bodyH, dims.y2[i] - dims.y1[i]);
      }

      cx += positions[i * 2];
      cy += positions[i * 2 + 1];
    }

    cx /= size;
    cy /= size;

    // walk order round the perimeter: a path starts at an end and a
    // cycle anywhere, so their edges run along the shape's sides; a
    // star starts at its hub, which takes the top.  Depth-first, so
    // the walk follows the edges rather than fanning out
    const degree = (i: number): number => adjacency[i].length;
    const ends = nodes.filter((i) => degree(i) === 1);
    const isPath = ends.length === 2 && nodes.every((i) => degree(i) <= 2);
    const start = isPath
      ? Math.min(...ends)
      : [...nodes].sort((a, b) => degree(b) - degree(a) || a - b)[0];
    const seen = new Set<number>([start]);
    const order: number[] = [];
    const stack = [start];

    while (stack.length > 0) {
      const u = stack.pop() as number;

      order.push(u);

      const next = [...adjacency[u]].sort((a, b) => b - a);

      for (const v of next) {
        if (!seen.has(v)) {
          seen.add(v);
          stack.push(v);
        }
      }
    }

    // the shape's radius: the edge length along every side, or the
    // bodies' clearance, whichever is larger
    let r: number;
    let points: [number, number][];

    if (size === 2) {
      r = Math.max(meanL / 2, (bodyH + gap) / 2);
      points = [
        [0, -r],
        [0, r],
      ];
    } else if (size === 3) {
      // circumradius of an equilateral triangle of side meanL, point up;
      // the base pair sits side by side, a body width apart
      r = Math.max(meanL / Math.sqrt(3), (bodyW + gap) / Math.sqrt(3));
      points = [
        [0, -r],
        [r * Math.cos(Math.PI / 6), r * Math.sin(Math.PI / 6)],
        [-r * Math.cos(Math.PI / 6), r * Math.sin(Math.PI / 6)],
      ];
    } else {
      // a diamond of side meanL: top, right, bottom, left
      r = Math.max(meanL / Math.SQRT2, (bodyW + gap) / 2, (bodyH + gap) / 2);
      points = [
        [0, -r],
        [r, 0],
        [0, r],
        [-r, 0],
      ];
    }

    for (let k = 0; k < order.length; k++) {
      const i = order[k];

      positions[i * 2] = cx + points[k][0];
      positions[i * 2 + 1] = cy + points[k][1];
    }

    shaped++;
  }

  return shaped;
};
