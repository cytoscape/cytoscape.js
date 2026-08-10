const EMPTY = new Uint32Array(0);

/** What adjacency queries return: iterate or index it, don't mutate it. */
export type EdgeSlots = ArrayLike<number> & Iterable<number>;

/*
Incident-edge index: CSR base + incremental overlay.

A columnar bulk load builds CSR in two passes over the endpoints column
(count degrees → prefix sum → scatter): three Uint32Arrays per direction,
no per-node JS arrays.  Queries on a bulk-loaded graph return subarray
views — zero allocation.  Edges added after the build (or via the
per-element path) go to per-node overlay arrays; a query concatenates
only when a node actually has both CSR and overlay edges.

Removal compacts the edge out of its node's CSR run in place (order
preserved, O(degree) — the same cost the splice-based overlay pays), and
the freed space is stranded: fixed per-node segments mean later adds
can't reuse it.  Stranded CSR entries and overlay entries are metered
(`csrStranded`/`overlayEntries`) and the owner (GraphStore) triggers
`rebuild()` on a threshold — a fresh two-pass CSR build over the live
edges in insertion order, which folds the overlay back into CSR and
drops the stranded space.  Insertion order is what the incremental
paths produce anyway (CSR runs predate every overlay append), so a
rebuild preserves per-node incident order; the one exception is an
edge re-pointed by moveEdge, which sits at its re-add position until a
rebuild returns it to insertion order.
*/
export class Adjacency {
  // CSR base: prefix offsets (built once per bulk), effective lengths
  // (shrink on removal), edge slots.  Null until a bulk build happens.
  private csrOutOff: Uint32Array | null = null;
  private csrOutLen: Uint32Array | null = null;
  private csrOutE: Uint32Array | null = null;
  private csrInnOff: Uint32Array | null = null;
  private csrInnLen: Uint32Array | null = null;
  private csrInnE: Uint32Array | null = null;
  private csrN = 0;

  // incremental overlay; overlayCount counts list *entries* (an edge holds
  // one in out[source] and one in inn[target]), matching the per-entry
  // decrements in removeEdge/clearNode
  private out: (number[] | undefined)[] = [];
  private inn: (number[] | undefined)[] = [];
  private overlayCount = 0;
  // CSR entries stranded by removals (fixed segments can't be refilled)
  private csrDead = 0;

  /** stranded CSR entries — one per direction per removed CSR edge */
  get csrStranded(): number {
    return this.csrDead;
  }

  /** overlay list entries — two per overlay edge */
  get overlayEntries(): number {
    return this.overlayCount;
  }

  /**
   * Register one edge.  Always lands in the overlay — CSR segments are
   * fixed-size, so an add can never grow one — which is why a graph
   * built edge-by-edge has no CSR at all until a `rebuild()`.  The
   * endpoints are passed in rather than read from the column so the
   * caller controls ordering against its own column writes.
   *
   * @param edgeSlot — the edge's slot
   * @param sourceSlot — the source node's slot
   * @param targetSlot — the target node's slot (equal to source for a loop)
   */
  addEdge(edgeSlot: number, sourceSlot: number, targetSlot: number): void {
    (this.out[sourceSlot] ??= []).push(edgeSlot);
    (this.inn[targetSlot] ??= []).push(edgeSlot);
    this.overlayCount += 2;
  }

  /**
   * Bulk registration from a columnar ingest: `endpoints` is the
   * interleaved edge.endpoints column, indexed by the slots in
   * `edgeSlots`.  On a fresh index this builds CSR in two counting
   * passes; otherwise the edges append to the overlay.
   */
  addBulk(
    edgeSlots: Uint32Array,
    endpoints: Uint32Array,
    nodeCap: number,
  ): void {
    if (this.csrOutOff != null || this.overlayCount > 0) {
      for (const slot of edgeSlots) {
        this.addEdge(slot, endpoints[slot * 2], endpoints[slot * 2 + 1]);
      }

      return;
    }

    this.buildCsr(edgeSlots, endpoints, nodeCap);
  }

  /**
   * Rebuild CSR from the live edges (insertion order): folds the overlay
   * back into CSR and drops stranded entries.  O(edges); the owner
   * triggers it when the waste meters cross a threshold, so the cost
   * amortizes over the mutations that created the waste.
   */
  rebuild(
    edgeSlots: ArrayLike<number>,
    endpoints: Uint32Array,
    nodeCap: number,
  ): void {
    this.out = [];
    this.inn = [];
    this.overlayCount = 0;
    this.csrDead = 0;

    if (edgeSlots.length === 0) {
      this.csrOutOff = this.csrOutLen = this.csrOutE = null;
      this.csrInnOff = this.csrInnLen = this.csrInnE = null;
      this.csrN = 0;

      return;
    }

    this.buildCsr(edgeSlots, endpoints, nodeCap);
  }

  private buildCsr(
    edgeSlots: ArrayLike<number>,
    endpoints: Uint32Array,
    nodeCap: number,
  ): void {
    const e = edgeSlots.length;
    const outLen = new Uint32Array(nodeCap);
    const innLen = new Uint32Array(nodeCap);

    for (let i = 0; i < e; i++) {
      outLen[endpoints[edgeSlots[i] * 2]]++;
      innLen[endpoints[edgeSlots[i] * 2 + 1]]++;
    }

    const outOff = new Uint32Array(nodeCap + 1);
    const innOff = new Uint32Array(nodeCap + 1);

    for (let n = 0; n < nodeCap; n++) {
      outOff[n + 1] = outOff[n] + outLen[n];
      innOff[n + 1] = innOff[n] + innLen[n];
    }

    const outE = new Uint32Array(e);
    const innE = new Uint32Array(e);
    const outCur = outOff.slice(0, nodeCap);
    const innCur = innOff.slice(0, nodeCap);

    for (let i = 0; i < e; i++) {
      const slot = edgeSlots[i];

      outE[outCur[endpoints[slot * 2]]++] = slot;
      innE[innCur[endpoints[slot * 2 + 1]]++] = slot;
    }

    this.csrOutOff = outOff;
    this.csrOutLen = outLen;
    this.csrOutE = outE;
    this.csrInnOff = innOff;
    this.csrInnLen = innLen;
    this.csrInnE = innE;
    this.csrN = nodeCap;
  }

  /**
   * Unregister one edge from both directions.  O(degree): the CSR run is
   * compacted in place (order preserved) or the overlay list spliced.
   * The vacated CSR entry is stranded, not reusable — it only comes back
   * on `rebuild()`, which the owner triggers off the waste meters.
   *
   * Silently tolerates an edge that is not indexed, so a double removal
   * is harmless; the endpoints must be the ones it was added under.
   *
   * @param edgeSlot — the edge's slot
   * @param sourceSlot — the source node's slot at add time
   * @param targetSlot — the target node's slot at add time
   */
  removeEdge(edgeSlot: number, sourceSlot: number, targetSlot: number): void {
    if (
      !this.removeFromCsr(
        edgeSlot,
        sourceSlot,
        this.csrOutOff,
        this.csrOutLen,
        this.csrOutE,
      )
    ) {
      if (removeFrom(this.out[sourceSlot], edgeSlot)) {
        this.overlayCount--;
      }
    }

    if (
      !this.removeFromCsr(
        edgeSlot,
        targetSlot,
        this.csrInnOff,
        this.csrInnLen,
        this.csrInnE,
      )
    ) {
      if (removeFrom(this.inn[targetSlot], edgeSlot)) {
        this.overlayCount--;
      }
    }
  }

  /**
   * The node's outgoing edge slots, in incident order.  The result
   * aliases internal state — a CSR subarray view or the overlay array
   * itself — so it must be treated as read-only and re-fetched after any
   * mutation.  Only a node with both CSR *and* overlay edges allocates
   * (the concatenation); the common cases are allocation-free.
   *
   * @param nodeSlot — the node's slot
   */
  outEdges(nodeSlot: number): EdgeSlots {
    return this.edgesFor(
      nodeSlot,
      this.csrOutOff,
      this.csrOutLen,
      this.csrOutE,
      this.out,
    );
  }

  /**
   * The node's incoming edge slots, in incident order.  Same aliasing
   * and allocation rules as `outEdges`.
   *
   * @param nodeSlot — the node's slot
   */
  inEdges(nodeSlot: number): EdgeSlots {
    return this.edgesFor(
      nodeSlot,
      this.csrInnOff,
      this.csrInnLen,
      this.csrInnE,
      this.inn,
    );
  }

  /**
   * Outgoing degree, counted from the CSR lengths and overlay sizes — no
   * list is materialized, so this is O(1) even where `outEdges` would
   * concatenate.  Loops count here and in `inDegree` both.
   *
   * @param nodeSlot — the node's slot
   */
  outDegree(nodeSlot: number): number {
    return (
      this.csrLen(nodeSlot, this.csrOutLen) + (this.out[nodeSlot]?.length ?? 0)
    );
  }

  /**
   * Incoming degree; O(1), like `outDegree`.
   *
   * @param nodeSlot — the node's slot
   */
  inDegree(nodeSlot: number): number {
    return (
      this.csrLen(nodeSlot, this.csrInnLen) + (this.inn[nodeSlot]?.length ?? 0)
    );
  }

  /**
   * Append this node's incident edge slots (out then in) to `dst`,
   * skipping any slot already in `seen` and recording what it appends —
   * the allocation-free form of `outEdges`/`inEdges` for bulk traversal
   * consumers (round 62.6): the CSR rows are read in place, so no
   * subarray view is created per node.  Loops dedupe like any shared
   * slot.
   *
   * @param nodeSlot — the node's slot
   * @param seen — the caller's dedupe set, updated in place
   * @param dst — the output array, appended in incident order
   */
  appendIncident(nodeSlot: number, seen: Set<number>, dst: number[]): void {
    const e = this.csrOutE;

    if (e != null && nodeSlot < this.csrN) {
      const outOff = this.csrOutOff![nodeSlot];
      const outEnd = outOff + this.csrOutLen![nodeSlot];

      for (let i = outOff, arr = e; i < outEnd; i++) {
        const slot = arr[i];

        if (!seen.has(slot)) {
          seen.add(slot);
          dst.push(slot);
        }
      }

      const innE = this.csrInnE!;
      const innOff = this.csrInnOff![nodeSlot];
      const innEnd = innOff + this.csrInnLen![nodeSlot];

      for (let i = innOff; i < innEnd; i++) {
        const slot = innE[i];

        if (!seen.has(slot)) {
          seen.add(slot);
          dst.push(slot);
        }
      }
    }

    const oExtra = this.out[nodeSlot];

    if (oExtra != null) {
      for (let i = 0; i < oExtra.length; i++) {
        const slot = oExtra[i];

        if (!seen.has(slot)) {
          seen.add(slot);
          dst.push(slot);
        }
      }
    }

    const iExtra = this.inn[nodeSlot];

    if (iExtra != null) {
      for (let i = 0; i < iExtra.length; i++) {
        const slot = iExtra[i];

        if (!seen.has(slot)) {
          seen.add(slot);
          dst.push(slot);
        }
      }
    }
  }

  /** All incident edge slots (loop edges appear once). */
  connectedEdges(nodeSlot: number): number[] {
    const out = this.outEdges(nodeSlot);
    const inn = this.inEdges(nodeSlot);
    const edges: number[] = [];

    for (const e of out) {
      edges.push(e);
    }

    for (const e of inn) {
      if (!includes(out, e)) {
        edges.push(e);
      } // exclude loops already listed
    }

    return edges;
  }

  /**
   * Drop every incidence recorded *at* this node, for node removal.  It
   * clears only this node's own entries: the mirrored entry each edge
   * holds at its far endpoint is not touched, so the caller must have
   * removed the incident edges first (v3's cascade rule) or the far
   * lists will list edges that no longer exist.
   *
   * @param nodeSlot — the node's slot
   */
  clearNode(nodeSlot: number): void {
    if (this.csrOutLen != null && nodeSlot < this.csrN) {
      this.csrDead += this.csrOutLen[nodeSlot] + this.csrInnLen![nodeSlot];
      this.csrOutLen[nodeSlot] = 0;
      this.csrInnLen![nodeSlot] = 0;
    }

    this.overlayCount -=
      (this.out[nodeSlot]?.length ?? 0) + (this.inn[nodeSlot]?.length ?? 0);
    this.out[nodeSlot] = undefined;
    this.inn[nodeSlot] = undefined;
  }

  // -- internals --

  private csrLen(nodeSlot: number, len: Uint32Array | null): number {
    return len != null && nodeSlot < this.csrN ? len[nodeSlot] : 0;
  }

  private edgesFor(
    nodeSlot: number,
    off: Uint32Array | null,
    len: Uint32Array | null,
    e: Uint32Array | null,
    overlay: (number[] | undefined)[],
  ): EdgeSlots {
    const extra = overlay[nodeSlot];
    const n = this.csrLen(nodeSlot, len);

    if (n === 0) {
      return extra ?? EMPTY;
    }

    const base = e!.subarray(off![nodeSlot], off![nodeSlot] + n);

    if (extra == null || extra.length === 0) {
      return base;
    }

    const both = new Array<number>(n + extra.length);

    for (let i = 0; i < n; i++) {
      both[i] = base[i];
    }
    for (let i = 0; i < extra.length; i++) {
      both[n + i] = extra[i];
    }

    return both;
  }

  /** Compact `edgeSlot` out of the node's CSR run, preserving order; false when not there. */
  private removeFromCsr(
    edgeSlot: number,
    nodeSlot: number,
    off: Uint32Array | null,
    len: Uint32Array | null,
    e: Uint32Array | null,
  ): boolean {
    const n = this.csrLen(nodeSlot, len);

    if (n === 0) {
      return false;
    }

    const lo = off![nodeSlot];

    for (let i = lo; i < lo + n; i++) {
      if (e![i] === edgeSlot) {
        e!.copyWithin(i, i + 1, lo + n);
        len![nodeSlot] = n - 1;
        this.csrDead++;

        return true;
      }
    }

    return false;
  }
}

const removeFrom = (list: number[] | undefined, value: number): boolean => {
  if (list == null) {
    return false;
  }

  const i = list.indexOf(value);

  if (i < 0) {
    return false;
  }

  list.splice(i, 1);

  return true;
};

const includes = (list: EdgeSlots, value: number): boolean => {
  for (let i = 0; i < list.length; i++) {
    if (list[i] === value) {
      return true;
    }
  }

  return false;
};
