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
    // sqrt(u) makes the scatter uniform in *area* (59.4) — a
    // uniform-in-radius draw piles density at the centre, and the
    // seed's density is what the anneal budget mostly preserves
    const radius =
      Math.sqrt((h >>> 16) / 0x10000) * spread * (1 + 0.02 * (i % 7));

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

/**
 * The spectral seed (round 59.4): landmark MDS per component, fCoSE's
 * scheme — BFS hop distances from up to 25 farthest-first pivots,
 * squared and double-centred, the top two eigenpairs by power
 * iteration, every node embedded from its pivot-distance vector.  The
 * global untangling this buys is the one thing local refinement
 * cannot reach from a random scatter (a curled chain is a legitimate
 * minimum of any short-range model); the force phase then only has
 * local detail to fix.
 *
 * Guards, each earned by a measured failure in the design prototype:
 * a component under 4 nodes keeps its scatter (nothing to embed); a
 * degenerate eigenvalue (≤ a small fraction of the separation scale)
 * keeps the scatter for that component; the embedding is rescaled
 * down whenever it exceeds the component's own hop-diameter extent
 * (the legitimate maximum — a healthy path embeds long, so the clamp
 * is the diameter, not the disc estimate); and a deterministic jitter
 * separates coincident embeddings (a star's leaves all sit one hop
 * from every pivot).
 *
 * Deterministic throughout: pivot choice, BFS order, the power
 * iteration's hash-seeded start vector, and the jitter.
 *
 * @param n — sim node count
 * @param edges — endpoint pairs in sim-index space
 * @param compOf — per-node component id
 * @param sizes — per-component member counts
 * @param anchors — interleaved anchor coordinates per component
 * @param meanL — the run's mean ideal edge length
 * @param positions — 2n interleaved coordinates; components ≥ 4 nodes
 *   are overwritten with their embedding about their anchor, smaller
 *   ones keep whatever the caller seeded
 */
export const spectralSeed = (
  n: number,
  edges: Uint32Array,
  compOf: Int32Array,
  sizes: Int32Array,
  anchors: Float32Array,
  meanL: number,
  positions: Float32Array,
): void => {
  // fCoSE separates pivots by ~1.5x the ideal edge length
  const SEP = meanL * 1.5;

  // incidence lists (the sim's own CSR shape, rebuilt here so the
  // module stays pure and callable before any sim exists)
  const m = edges.length / 2;
  const starts = new Int32Array(n + 1);

  for (let e = 0; e < m; e++) {
    starts[edges[e * 2] + 1]++;
    starts[edges[e * 2 + 1] + 1]++;
  }

  for (let i = 0; i < n; i++) {
    starts[i + 1] += starts[i];
  }

  const incident = new Int32Array(m * 2);
  const cursor = starts.slice(0, n);

  for (let e = 0; e < m; e++) {
    incident[cursor[edges[e * 2]]++] = e;
    incident[cursor[edges[e * 2 + 1]]++] = e;
  }

  // members per component, in ascending node order (deterministic)
  const byComp = new Map<number, number[]>();

  for (let i = 0; i < n; i++) {
    let list = byComp.get(compOf[i]);

    if (list == null) {
      byComp.set(compOf[i], (list = []));
    }

    list.push(i);
  }

  for (const [comp, members] of byComp) {
    const nn = members.length;

    if (nn < 4) {
      continue;
    }

    const local = new Map<number, number>();

    for (let idx = 0; idx < nn; idx++) {
      local.set(members[idx], idx);
    }

    const k = Math.min(25, nn);

    // BFS hop distances from one member, over the incident lists
    const bfs = (startLocal: number, out: Int32Array): void => {
      out.fill(-1);

      let queue = [members[startLocal]];

      out[startLocal] = 0;

      while (queue.length > 0) {
        const next: number[] = [];

        for (const g of queue) {
          const dg = out[local.get(g) as number];

          for (let at = starts[g]; at < starts[g + 1]; at++) {
            const e = incident[at];
            const s = edges[e * 2];
            const t = edges[e * 2 + 1];
            const other = s === g ? t : s;
            const lo = local.get(other);

            if (lo != null && out[lo] === -1) {
              out[lo] = dg + 1;
              next.push(other);
            }
          }
        }

        queue = next;
      }
    };

    // farthest-first pivots, starting at the component's first member
    const pivots = [0];
    const dist: Int32Array[] = [];
    const minDist = new Float64Array(nn).fill(Infinity);
    let maxHop = 1;

    for (let j = 0; j < k; j++) {
      const d = new Int32Array(nn);

      bfs(pivots[j], d);
      dist.push(d);

      let far = -1;
      let farD = -1;

      for (let i = 0; i < nn; i++) {
        const di = d[i] < 0 ? 0 : d[i];

        if (di > maxHop) {
          maxHop = di;
        }
        if (di < minDist[i]) {
          minDist[i] = di;
        }
        if (minDist[i] > farD) {
          farD = minDist[i];
          far = i;
        }
      }

      if (j + 1 < k) {
        pivots.push(far);
      }
    }

    // squared pivot-pivot distances in model px, double-centred
    const D2 = new Float64Array(k * k);

    for (let a = 0; a < k; a++) {
      for (let b = 0; b < k; b++) {
        const d = Math.max(0, dist[b][pivots[a]]) * SEP;

        D2[a * k + b] = d * d;
      }
    }

    const rowMean = new Float64Array(k);
    const colMean = new Float64Array(k);
    let grand = 0;

    for (let a = 0; a < k; a++) {
      for (let b = 0; b < k; b++) {
        rowMean[a] += D2[a * k + b] / k;
        colMean[b] += D2[a * k + b] / k;
        grand += D2[a * k + b] / (k * k);
      }
    }

    const B = new Float64Array(k * k);

    for (let a = 0; a < k; a++) {
      for (let b = 0; b < k; b++) {
        B[a * k + b] = -0.5 * (D2[a * k + b] - rowMean[a] - colMean[b] + grand);
      }
    }

    // top-2 eigenpairs by power iteration + deflation, hash-seeded
    const eig = (
      deflate: Float64Array | null,
    ): { v: Float64Array; lambda: number } => {
      const v = new Float64Array(k);

      for (let a = 0; a < k; a++) {
        v[a] = (((a + 1) * 2654435761) >>> 16) / 65536 - 0.5;
      }

      let lambda = 0;

      for (let it = 0; it < 300; it++) {
        const w = new Float64Array(k);

        for (let a = 0; a < k; a++) {
          let s = 0;

          for (let b = 0; b < k; b++) {
            s += B[a * k + b] * v[b];
          }

          w[a] = s;
        }

        if (deflate != null) {
          let dot = 0;

          for (let a = 0; a < k; a++) {
            dot += w[a] * deflate[a];
          }

          for (let a = 0; a < k; a++) {
            w[a] -= dot * deflate[a];
          }
        }

        let norm = 0;

        for (let a = 0; a < k; a++) {
          norm += w[a] * w[a];
        }

        norm = Math.sqrt(norm);

        if (norm < 1e-12) {
          return { v, lambda: 0 };
        }

        for (let a = 0; a < k; a++) {
          v[a] = w[a] / norm;
        }

        lambda = norm;
      }

      return { v, lambda };
    };

    const e1 = eig(null);
    const e2 = eig(e1.v);

    // a dead spectrum keeps the scatter; a rank-1 spectrum is a
    // legitimate 1-D metric (a path!) and embeds on the first axis
    // alone, the jitter below providing the second dimension
    if (e1.lambda < SEP * SEP * 0.01) {
      continue;
    }

    const oneD = e2.lambda < SEP * SEP * 1e-4;
    const s1 = Math.sqrt(e1.lambda);
    const s2 = oneD ? 1 : Math.sqrt(e2.lambda);

    // pivot-distance column means (the LMDS out-of-sample formula)
    const dMean = new Float64Array(k);

    for (let a = 0; a < k; a++) {
      let s = 0;

      for (let b = 0; b < k; b++) {
        s += D2[b * k + a];
      }

      dMean[a] = s / k;
    }

    // embed, tracking the extent for the clamp
    const ex = new Float64Array(nn);
    const ey = new Float64Array(nn);
    let maxR = 0;

    for (let i = 0; i < nn; i++) {
      let px = 0;
      let py = 0;

      for (let j = 0; j < k; j++) {
        const d = Math.max(0, dist[j][i]) * SEP;
        const diff = dMean[j] - d * d;

        px += e1.v[j] * diff;
        py += e2.v[j] * diff;
      }

      ex[i] = px / (2 * s1);
      ey[i] = oneD ? 0 : py / (2 * s2);
      maxR = Math.max(maxR, Math.hypot(ex[i], ey[i]));
    }

    // the legitimate maximum extent is the component's own hop
    // diameter; a spectrum blowup past it rescales down (the design
    // prototype's one observed failure, made harmless)
    const maxLegit = maxHop * SEP;
    const scale = maxR > maxLegit ? maxLegit / maxR : 1;

    // deterministic jitter so coincident embeddings (a star's leaves)
    // separate for the local phase
    const jitter = meanL / 6;

    for (let i = 0; i < nn; i++) {
      const g = members[i];
      const h = ((g + 1) * 2654435761) >>> 0;

      positions[g * 2] =
        anchors[comp * 2] +
        ex[i] * scale +
        ((h & 0xffff) / 0x10000 - 0.5) * jitter;
      positions[g * 2 + 1] =
        anchors[comp * 2 + 1] +
        ey[i] * scale +
        ((h >>> 16) / 0x10000 - 0.5) * jitter;
    }
  }
};
