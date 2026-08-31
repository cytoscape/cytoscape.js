/*
The force layout's seeding (round 59.2/59.4), pure and sim-indexed:
deterministic scatter around component anchors and the spectral seed
(landmark MDS per component).  The component/packing machinery this
seeding places against moved to `pack.mts` in round 87.1 so any
layout can reach it; the seeding itself stays force-private — it
encodes the force model's density assumptions, not a reusable
post-pass.

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

import { estimateComponentRadius } from './pack.mjs';

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
