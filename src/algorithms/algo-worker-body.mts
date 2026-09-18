/*
The worker body of the `'workers'` executor (round 74.2): one exported,
fully self-contained function that the pool stringifies and evaluates
inside a plain worker — Node `worker_threads` or a browser `Worker` —
so the bundles stay single-file and no build step knows a worker exists.

The constraints that shape every line here follow from that carriage:

  - **No imports, no outer references, no class syntax.**  The function
    is re-created from its source text in a scope that holds nothing
    but the port adapter it is handed; a reference to anything outside
    it is a ReferenceError at first message.  `test/modules/
    algo-worker-body.mjs` evaluates the body in a bare scope from the
    built ESM, the built UMD and under tsx for exactly that reason.
  - **ES2018-plain.**  A transpiler helper (`__name` under tsx, or an
    optional-chaining lowering) would be an outer reference too; the
    pool's preamble defines a no-op `__name`, and the body avoids
    every syntax whose lowering could need a helper.
  - **The arithmetic order is the reference's.**  The per-column
    families (heat kernel columns, RWR columns, closeness row sums)
    are copied from `diffuseVector`, `solveWalk` and
    `closenessRowSumsBfs` operation for operation, so a worker's column
    is bit-identical to the CPU's.  Brandes is the exception by
    construction (74's fact 5): the partial sums per source range are
    exact, but merging ranges in range order groups the f64 additions
    differently from the sequential reference — f64-tight, never bits.

The protocol, kept tiny: a `snapshot` message installs the run's
inputs (structured-cloned per worker, priced in 74.1 at ~0.2 ms for a
100 KB CSR), then each `job` names a contiguous source or column range
and answers one transferred `Float64Array`.  `ping` is the pool's
liveness probe at spawn.

The offload lane (round 129.1) adds one snapshot kind and one job: a
`kernel` snapshot names a function in the registry the pool hands the
body at evaluation (`algo-kernels.mts`, each carried as source text
beside this one) and holds its input; a `kernel` job runs it once and
answers its output with every typed array transferred.  The body
never knows a kernel's shape — it is the same function the in-thread
`'cpu'` path calls, which is the whole point.
*/

/** The port the body talks through — one method each way, so the pool
 * can adapt Node's `parentPort` and the browser's `self` identically. */
export interface WorkerPortLike {
  on(handler: (msg: AlgoWorkerRequest) => void): void;
  post(msg: AlgoWorkerReply, transfer?: ArrayBuffer[]): void;
}

/** A Brandes run's inputs: CSR neighbor lists, weights when weighted. */
export interface BrandesSnapshot {
  kind: 'brandes';
  n: number;
  rowPtr: Int32Array;
  colIdx: Int32Array;
  /** one weight per CSR entry, or null for the unit-step walk */
  w: Float64Array | null;
}

/** A closeness run's inputs: the same CSR, unweighted. */
export interface ClosenessSnapshot {
  kind: 'closeness';
  n: number;
  rowPtr: Int32Array;
  colIdx: Int32Array;
  harmonic: boolean;
}

/** A heat-kernel run's inputs: `buildHeatStructure`'s arcs plus time. */
export interface HeatSnapshot {
  kind: 'heat';
  n: number;
  srcs: Int32Array;
  dsts: Int32Array;
  ws: Float64Array;
  arcs: number;
  degrees: Float64Array;
  squarings: number;
  time: number;
  terms: number;
}

/** An RWR-proximity run's inputs: `buildWalkArcs`'s arcs plus the walk. */
export interface WalkSnapshot {
  kind: 'walk';
  n: number;
  srcs: Int32Array;
  dsts: Int32Array;
  ws: Float64Array;
  arcs: number;
  c: number;
  maxIterations: number;
  tolerance: number;
}

/** An offload run's inputs (129.1): a kernel by name and its input. */
export interface KernelWorkerSnapshot {
  kind: 'kernel';
  name: string;
  input: Record<string, unknown>;
}

export type AlgoWorkerSnapshot =
  | BrandesSnapshot
  | ClosenessSnapshot
  | HeatSnapshot
  | WalkSnapshot
  | KernelWorkerSnapshot;

export type AlgoWorkerRequest =
  | { type: 'ping'; id: number }
  | { type: 'snapshot'; id: number; snapshot: AlgoWorkerSnapshot }
  | { type: 'job'; id: number; s0: number; s1: number }
  | { type: 'kernel'; id: number };

export type AlgoWorkerReply =
  | { type: 'pong'; id: number }
  | { type: 'ready'; id: number }
  | { type: 'done'; id: number; out: Float64Array }
  | { type: 'result'; id: number; out: Record<string, unknown> }
  | { type: 'error'; id: number; message: string };

/** The kernels as the body receives them: one function per name. */
export type WorkerKernels = Record<
  string,
  (input: Record<string, unknown>) => Record<string, unknown>
>;

/**
 * The worker's message loop.  Self-contained by contract (see the
 * module note): the pool evaluates `algoWorkerBody.toString()` inside
 * the worker and hands it a port adapter and the kernel registry.
 *
 * @param port — the adapted message port
 * @param kernels — the offload kernels by name (129.1), re-created in
 *   the worker from their own source text
 */
export function algoWorkerBody(
  port: WorkerPortLike,
  kernels: WorkerKernels,
): void {
  let snapshot: AlgoWorkerSnapshot | null = null;

  // -- Brandes over a CSR: one contiguous source range ------------------
  const brandesRange = (
    snap: BrandesSnapshot,
    s0: number,
    s1: number,
  ): Float64Array => {
    const n = snap.n;
    const rowPtr = snap.rowPtr;
    const colIdx = snap.colIdx;
    const w = snap.w;
    const weighted = w !== null;
    const C = new Float64Array(n);
    const d = new Float64Array(n);
    const g = new Float64Array(n); // sigma: shortest-path counts
    const e = new Float64Array(n); // dependency accumulator
    const settled = new Uint8Array(n);
    // predecessor lists as one linked pool: at most one entry per CSR
    // arc per source, so `arcs + 1` slots (index 0 is the null link)
    const arcs = rowPtr[n];
    const pHead = new Int32Array(n);
    const pNext = new Int32Array(arcs + 1);
    const pVal = new Int32Array(arcs + 1);
    const S = new Int32Array(n);
    // an indexed binary min-heap over d, the reference's NodeHeap inline
    const heap = new Int32Array(n);
    const pos = new Int32Array(n);
    let hn = 0;

    const up = (p: number): void => {
      const item = heap[p];
      const s = d[item];

      while (p > 0) {
        const parent = (p - 1) >> 1;
        const parentItem = heap[parent];

        if (d[parentItem] <= s) {
          break;
        }

        heap[p] = parentItem;
        pos[parentItem] = p;
        p = parent;
      }

      heap[p] = item;
      pos[item] = p;
    };

    const down = (p: number): void => {
      const item = heap[p];
      const s = d[item];

      for (;;) {
        let c = 2 * p + 1;

        if (c >= hn) {
          break;
        }

        if (c + 1 < hn && d[heap[c + 1]] < d[heap[c]]) {
          c++;
        }

        const childItem = heap[c];

        if (s <= d[childItem]) {
          break;
        }

        heap[p] = childItem;
        pos[childItem] = p;
        p = c;
      }

      heap[p] = item;
      pos[item] = p;
    };

    const push = (i: number): void => {
      heap[hn] = i;
      pos[i] = hn;
      up(hn++);
    };

    const pop = (): number => {
      const root = heap[0];

      hn--;
      pos[root] = -1;

      if (hn > 0) {
        const last = heap[hn];

        heap[0] = last;
        pos[last] = 0;
        down(0);
      }

      return root;
    };

    for (let s = s0; s < s1; s++) {
      d.fill(Infinity);
      g.fill(0);
      e.fill(0);
      settled.fill(0);
      pHead.fill(-1);
      pos.fill(-1);

      let pCount = 0;
      let sLen = 0;

      hn = 0;
      g[s] = 1;
      d[s] = 0;
      push(s);

      while (hn > 0) {
        const v = pop();

        settled[v] = 1;
        S[sLen++] = v;

        const end = rowPtr[v + 1];

        for (let j = rowPtr[v]; j < end; j++) {
          const t = colIdx[j];
          const step = weighted ? (w as Float64Array)[j] : 1;

          if (settled[t] === 0 && d[v] + step < d[t]) {
            d[t] = d[v] + step;

            if (pos[t] >= 0) {
              up(pos[t]);
            } else {
              push(t);
            }

            g[t] = 0;
            pHead[t] = -1;
          }

          if (d[t] === d[v] + step) {
            g[t] += g[v];
            pCount++;
            pVal[pCount] = v;
            pNext[pCount] = pHead[t];
            pHead[t] = pCount;
          }
        }
      }

      for (let i = sLen - 1; i >= 0; i--) {
        const t = S[i];

        // the reference walks P[w] in push order; the linked list is
        // last-in-first, so reverse it once before accumulating
        let p = pHead[t];
        let rev = -1;

        while (p !== -1) {
          const next = pNext[p];

          pNext[p] = rev;
          rev = p;
          p = next;
        }

        for (p = rev; p !== -1; p = pNext[p]) {
          const v = pVal[p];

          e[v] += (g[v] / g[t]) * (1 + e[t]);
        }

        if (t !== s) {
          C[t] += e[t];
        }
      }
    }

    return C;
  };

  // -- closeness row sums by BFS: `closenessRowSumsBfs`, per range ------
  const closenessRange = (
    snap: ClosenessSnapshot,
    s0: number,
    s1: number,
  ): Float64Array => {
    const n = snap.n;
    const starts = snap.rowPtr;
    const entries = snap.colIdx;
    const harmonic = snap.harmonic;
    const sums = new Float64Array(s1 - s0);
    const dist = new Int32Array(n);
    const queue = new Int32Array(n);

    for (let s = s0; s < s1; s++) {
      dist.fill(-1);
      dist[s] = 0;
      queue[0] = s;

      let head = 0;
      let tail = 1;
      let sum = 0;

      while (head < tail) {
        const v = queue[head++];
        const dv = dist[v] + 1;
        const term = harmonic ? 1 / dv : dv;
        const end = starts[v + 1];

        for (let e = starts[v]; e < end; e++) {
          const t = entries[e];

          if (dist[t] === -1) {
            dist[t] = dv;
            queue[tail++] = t;
            sum += term;
          }
        }
      }

      sums[s - s0] = !harmonic && tail < n ? Infinity : sum;
    }

    return sums;
  };

  // -- heat-kernel columns: `diffuseVector` per unit vector -------------
  const heatRange = (
    snap: HeatSnapshot,
    s0: number,
    s1: number,
  ): Float64Array => {
    const n = snap.n;
    const srcs = snap.srcs;
    const dsts = snap.dsts;
    const ws = snap.ws;
    const arcs = snap.arcs;
    const degrees = snap.degrees;
    const step = -snap.time / Math.pow(2, snap.squarings);
    const applications = Math.pow(2, snap.squarings);
    const terms = snap.terms;
    const out = new Float64Array((s1 - s0) * n);
    const v = new Float64Array(n);
    const u = new Float64Array(n);
    const lu = new Float64Array(n);

    for (let s = s0; s < s1; s++) {
      v.fill(0);
      v[s] = 1;

      for (let r = 0; r < applications; r++) {
        u.set(v);

        for (let k = 1; k <= terms; k++) {
          for (let i = 0; i < n; i++) {
            lu[i] = degrees[i] * u[i];
          }

          for (let a = 0; a < arcs; a++) {
            lu[dsts[a]] -= ws[a] * u[srcs[a]];
          }

          const scale = step / k;

          for (let i = 0; i < n; i++) {
            u[i] = lu[i] * scale;
            v[i] += u[i];
          }
        }
      }

      out.set(v, (s - s0) * n);
    }

    return out;
  };

  // -- RWR-proximity columns: `solveWalk` per unit restart --------------
  const walkRange = (
    snap: WalkSnapshot,
    s0: number,
    s1: number,
  ): Float64Array => {
    const n = snap.n;
    const srcs = snap.srcs;
    const dsts = snap.dsts;
    const ws = snap.ws;
    const arcs = snap.arcs;
    const c = snap.c;
    const follow = 1 - c;
    const out = new Float64Array((s1 - s0) * n);
    const p0 = new Float64Array(n);

    for (let s = s0; s < s1; s++) {
      p0.fill(0);
      p0[s] = 1;

      let p = Float64Array.from(p0);
      let next = new Float64Array(n);

      for (let iter = 0; iter < snap.maxIterations; iter++) {
        for (let i = 0; i < n; i++) {
          next[i] = c * p0[i];
        }

        for (let a = 0; a < arcs; a++) {
          next[dsts[a]] += follow * ws[a] * p[srcs[a]];
        }

        let diff = 0;

        for (let i = 0; i < n; i++) {
          diff += Math.abs(next[i] - p[i]);
        }

        const previous = p;

        p = next;
        next = previous;

        if (diff < snap.tolerance) {
          break;
        }
      }

      out.set(p, (s - s0) * n);
    }

    return out;
  };

  const runKernel = (): Record<string, unknown> => {
    if (snapshot === null) {
      throw new Error('a kernel job arrived before its snapshot');
    }

    if (snapshot.kind !== 'kernel') {
      throw new Error('a kernel job arrived on a range snapshot');
    }

    const kernel = kernels[snapshot.name];

    if (typeof kernel !== 'function') {
      throw new Error('unknown kernel: ' + snapshot.name);
    }

    const out = kernel(snapshot.input);

    // a kernel may answer the snapshot's own buffers (relaxed in
    // place); they transfer out below, so the snapshot is spent
    snapshot = null;

    return out;
  };

  const buffersOf = (out: Record<string, unknown>): ArrayBuffer[] => {
    const buffers: ArrayBuffer[] = [];

    for (const key in out) {
      const value = out[key];

      if (ArrayBuffer.isView(value)) {
        buffers.push(value.buffer as ArrayBuffer);
      }
    }

    return buffers;
  };

  const runJob = (s0: number, s1: number): Float64Array => {
    if (snapshot === null) {
      throw new Error('a job arrived before its snapshot');
    }

    if (snapshot.kind === 'kernel') {
      throw new Error('a range job arrived on a kernel snapshot');
    }

    if (snapshot.kind === 'brandes') {
      return brandesRange(snapshot, s0, s1);
    }

    if (snapshot.kind === 'closeness') {
      return closenessRange(snapshot, s0, s1);
    }

    if (snapshot.kind === 'heat') {
      return heatRange(snapshot, s0, s1);
    }

    if (snapshot.kind === 'walk') {
      return walkRange(snapshot, s0, s1);
    }

    // loud, never zeros: a kind the body does not know is a protocol
    // defect between the pool and the body
    throw new Error(
      'unknown snapshot kind: ' + String((snapshot as { kind: string }).kind),
    );
  };

  port.on((msg: AlgoWorkerRequest): void => {
    if (msg.type === 'ping') {
      port.post({ type: 'pong', id: msg.id });
    } else if (msg.type === 'snapshot') {
      snapshot = msg.snapshot;
      port.post({ type: 'ready', id: msg.id });
    } else if (msg.type === 'job') {
      try {
        const out = runJob(msg.s0, msg.s1);

        port.post({ type: 'done', id: msg.id, out }, [
          out.buffer as ArrayBuffer,
        ]);
      } catch (err) {
        port.post({
          type: 'error',
          id: msg.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    } else if (msg.type === 'kernel') {
      try {
        const out = runKernel();

        port.post({ type: 'result', id: msg.id, out }, buffersOf(out));
      } catch (err) {
        port.post({
          type: 'error',
          id: msg.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });
}
