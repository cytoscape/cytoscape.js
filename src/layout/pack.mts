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
