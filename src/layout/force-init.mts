/*
The force layout's component machinery (round 59.2), pure and
sim-indexed: union-find over the sim edges, deterministic anchor
packing (v3 cose's `separateComponents` row shape, applied *up front*
so the simulation itself is component-aware), seeding around anchors,
and the exact re-pack that lands at settle.

Why anchors and not only a post-pass: gravity in the sim is
constant-magnitude toward the node's component anchor (round 59's
FA2-shaped containment), so disconnected pieces neither interleave at
a shared centre (AntV's failure mode) nor drift apart (round 18's).
The estimates that place the anchors are rough by construction —
`packComponentsExact` re-packs the *real* settled boxes at the end,
which is exactly v3's `separateComponents`, translation-only.

Everything here is deterministic: component ids are first-seen order,
ties in every sort break on the id, and the seeding hash is the same
Knuth-multiplicative scatter `seedPositions` uses.
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

interface PackBox {
  id: number;
  w: number;
  h: number;
  /** out: the placed top-left */
  x: number;
  y: number;
}

/** Shelf-pack boxes (area-descending, id ties) into rows; mutates each
 * box's (x, y) to its placed top-left.  The v3 `separateComponents`
 * shape: rows wrap at ~sqrt(total area) so the packing tends square. */
const shelfPack = (boxes: PackBox[], spacing: number): void => {
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

/**
 * Deterministic scatter around each node's component anchor, spread by
 * the component's own radius estimate — the whole-graph scatter of
 * round 18, made component-aware so gravity holds pieces where they
 * start rather than having to retrieve them.
 *
 * @param n — sim node count
 * @param seed — the run's seed
 * @param compOf — per-node component id
 * @param sizes — per-component member counts
 * @param anchors — interleaved anchor coordinates per component
 * @param meanL — the run's mean ideal edge length
 * @param out — 2n interleaved coordinates, written in place
 */
export const seedAroundAnchors = (
  n: number,
  seed: number,
  compOf: Int32Array,
  sizes: Int32Array,
  anchors: Float32Array,
  meanL: number,
  out: Float32Array,
): void => {
  for (let i = 0; i < n; i++) {
    const comp = compOf[i];
    const spread = Math.max(
      30,
      estimateComponentRadius(sizes[comp], meanL) * 0.8,
    );
    const h = ((i + 1) * 2654435761 + seed * 40503) >>> 0;
    const angle = ((h & 0xffff) / 0x10000) * Math.PI * 2;
    const radius = ((h >>> 16) / 0x10000) * spread + spread * 0.02 * (i % 7);

    out[i * 2] = anchors[comp * 2] + Math.cos(angle) * radius;
    out[i * 2 + 1] = anchors[comp * 2 + 1] + Math.sin(angle) * radius;
  }
};

/**
 * The settle re-pack (v3's `separateComponents`, translation-only):
 * per-component bounding boxes of the *settled* positions, shelf-packed
 * largest-first with `spacing` between boxes, every member translated
 * with its component.  The packed field is centred where the largest
 * component sat, so the dominant structure holds its place and the
 * strays come to it.
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

    x1[c] = Math.min(x1[c], x);
    y1[c] = Math.min(y1[c], y);
    x2[c] = Math.max(x2[c], x);
    y2[c] = Math.max(y2[c], y);
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
  const packedLargest = boxes.find((b) => b.id === largest) as PackBox;
  const shiftX = holdX - (packedLargest.x + packedLargest.w / 2);
  const shiftY = holdY - (packedLargest.y + packedLargest.h / 2);

  for (let i = 0; i < n; i++) {
    const c = compOf[i];

    positions[i * 2] += dx[c] + shiftX;
    positions[i * 2 + 1] += dy[c] + shiftY;
  }
};
