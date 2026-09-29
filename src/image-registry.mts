/*
ImageRegistry (round 15.1): the unique-image pool behind the
`background-image` family.

Unique images dedup by (kind, crossorigin, url) into refcounted entries —
the string-dictionary discipline applied to rasters.  Each rgba entry is
assigned a size *tier* (IMAGE_TIER_SIZES; texture_2d_array layers
renderer-side, round 15.3) from its decoded size; `sdf-icon` entries
raster once at SDF_IMAGE_SIZE for the single r8 icon array (round 15.5)
and carry no rgba tier.  Entry ids are slots: freed ids recycle through a
free-list, and the renderer reclaims their layers via `takeFreed()`.

Decoding runs behind an injectable async rasterizer so the registry is
fully Node-testable and headless-safe: without a decoder entries stay
pending and nothing throws; `setDecoder()` (the renderer supplies the
browser decoder at mount) kicks every pending entry.  A failed decode
warns once per url and renders imageless — no per-element error state
(recorded).  A decode that resolves after its entry was freed is dropped
by object identity, so recycled ids can never receive stale rasters.

The worker host mirrors the registry across the thread boundary (round
141): the canonical registry on the main thread acquires and releases —
style application runs there — and journals each entry's creation and
freeing (`setJournal` / `takeJournal`, or `snapshotOps` for the full
transfer); the worker's registry replays those ops by id (`adopt` /
`drop`) and owns the decoder, so decodes run where the rasters are
uploaded and no raster crosses back.  Entry ids agree on both sides
because only the canonical side allocates them.

Vector sources (SVG) re-raster losslessly: `promote(id, demandPx)`
re-decodes a vector entry at the smallest tier covering the on-screen
demand (the 15.6 zoom-promotion meter calls this; exports call it at
export scale).  Raster sources never promote — source resolution is
their ceiling, as in v3.
*/

/** rgba tier sizes (px, longest side); the last entry is the cap tier
 * (`imageMaxSize` trims or extends this per renderer instance). */
export const IMAGE_TIER_SIZES: readonly number[] = [128, 512, 1024];

/** fixed raster size for sdf-icon entries (the glyph-EDT path, 15.5) */
export const SDF_IMAGE_SIZE = 128;

export const IMAGE_KIND_AUTO = 0;
export const IMAGE_KIND_SDF = 1;

export const IMAGE_PENDING = 0;
export const IMAGE_READY = 1;
export const IMAGE_FAILED = 2;

/** What a decoder yields: an opaque raster handle plus its dimensions.
 * `data` is an ImageBitmap in the browser; tests pass anything. */
export interface DecodedImage {
  data: unknown;
  width: number;
  height: number;
  /** vector sources (SVG) re-raster losslessly at any target size */
  vector: boolean;
}

export interface ImageDecodeOpts {
  crossOrigin: string;
  /** raster size hint (px, longest side); 0 = the source's natural size */
  targetPx: number;
  /** rasterize for the single-channel sdf-icon path */
  sdf: boolean;
}

export type ImageDecoder = (
  url: string,
  opts: ImageDecodeOpts,
) => Promise<DecodedImage>;

export interface ImageEntry {
  id: number;
  url: string;
  kind: number;
  crossOrigin: string;
  refCount: number;
  status: number;
  /** opaque decoded raster (renderer uploads it; null until ready) */
  data: unknown;
  /** native source dims (vector: the intrinsic size of the last raster) */
  width: number;
  height: number;
  vector: boolean;
  /** rgba tier index into IMAGE_TIER_SIZES; -1 until ready and for sdf entries */
  tier: number;
  /** longest side of the current raster (vector promotion compares demand to this) */
  rasterPx: number;
}

/**
 * One entry lifecycle event, as the worker host carries it across the
 * boundary (round 141): an entry created at an id, or the entry at an id
 * freed.  Replayed in order by {@link ImageRegistry.adopt} /
 * {@link ImageRegistry.drop}.
 */
export type ImageLifecycleOp =
  | {
      op: 'create';
      id: number;
      url: string;
      kind: number;
      crossOrigin: string;
    }
  | { op: 'free'; id: number };

export class ImageRegistry {
  /** the lifecycle journal while a worker host mirrors this registry
   * (round 141), else null — nothing is recorded */
  private journal: ImageLifecycleOp[] | null = null;
  /** journaled creates not yet taken, by id: a free of one of these
   * cancels the create instead of journaling a free */
  private journalCreates = new Map<number, ImageLifecycleOp>();
  private entries: (ImageEntry | null)[] = [];
  private freeIds: number[] = [];
  private byKey = new Map<string, number>();
  private decoder: ImageDecoder | null = null;
  private readyQueue: number[] = [];
  private freedQueue: number[] = [];
  private warned = new Set<string>();
  private tiers: readonly number[];
  /** decodes in flight (initial and promotion re-rasters alike) */
  private inFlight = 0;
  private settleResolvers: (() => void)[] = [];

  /** fires when any entry changes state (ready, failed, freed) — the
   * store routes it to the dirty scheduler so a frame redraws */
  onChange: (() => void) | null = null;

  /**
   * @param tierSizes — the rgba tier ladder, ascending; the last entry is
   *   the cap tier.  The renderer passes a list trimmed or extended to its
   *   `imageMaxSize`, so tier indices are only meaningful against the
   *   registry that produced them
   */
  constructor(tierSizes: readonly number[] = IMAGE_TIER_SIZES) {
    this.tiers = tierSizes;
  }

  /** the smallest tier covering px, else the cap tier */
  tierFor(px: number): number {
    for (let i = 0; i < this.tiers.length; i++) {
      if (px <= this.tiers[i]) {
        return i;
      }
    }

    return this.tiers.length - 1;
  }

  /**
   * Take a reference on the entry for (kind, crossOrigin, url), creating
   * and kicking a decode for it if it is new.  Every `acquire` must be
   * paired with exactly one `release`.  Returns immediately: a fresh entry
   * is `IMAGE_PENDING` and carries no raster until the decode lands (or
   * forever, if no decoder is attached).  A url that already failed once
   * is created straight into `IMAGE_FAILED` without re-kicking.
   *
   * @param url — the image source
   * @param kind — `IMAGE_KIND_AUTO` or `IMAGE_KIND_SDF`
   * @param crossOrigin — part of the dedup key, so the same url under two
   *   crossorigin modes is two entries
   * @returns the entry id — a recycled slot, valid only until its last
   *   `release`
   */
  acquire(
    url: string,
    kind: number,
    crossOrigin: string = 'anonymous',
  ): number {
    const key = `${kind}|${crossOrigin}|${url}`;
    const existing = this.byKey.get(key);

    if (existing != null) {
      this.entries[existing]!.refCount++;

      return existing;
    }

    const id =
      this.freeIds.length > 0 ? this.freeIds.pop()! : this.entries.length;
    const entry: ImageEntry = {
      id,
      url,
      kind,
      crossOrigin,
      refCount: 1,
      status: IMAGE_PENDING,
      data: null,
      width: 0,
      height: 0,
      vector: false,
      tier: -1,
      rasterPx: 0,
    };

    this.entries[id] = entry;
    this.byKey.set(key, id);

    if (this.journal != null) {
      const op: ImageLifecycleOp = { op: 'create', id, url, kind, crossOrigin };

      this.journal.push(op);
      this.journalCreates.set(id, op);
    }

    // a url that already failed once stays failed: warn-once, no re-kick
    if (this.warned.has(url)) {
      entry.status = IMAGE_FAILED;
    } else {
      this.kick(entry);
    }

    return id;
  }

  /**
   * Drop one reference.  On the last one the entry is destroyed, its id
   * pushed to the free list and to `takeFreed()` so the renderer can
   * reclaim the texture layer, and `onChange` fires.  Releasing an
   * already-freed id is a no-op; over-releasing a live id is not caught.
   *
   * @param id — an id from `acquire`
   */
  release(id: number): void {
    const entry = this.entries[id];

    if (entry == null) {
      return;
    }

    if (--entry.refCount > 0) {
      return;
    }

    this.byKey.delete(`${entry.kind}|${entry.crossOrigin}|${entry.url}`);
    this.entries[id] = null;
    this.freeIds.push(id);
    this.freedQueue.push(id);
    this.journalFree(id);
    this.onChange?.();
  }

  /**
   * Journal a free: an entry created and freed between two takes never
   * crosses at all (its create is cancelled in place), anything older
   * crosses as a free.
   */
  private journalFree(id: number): void {
    if (this.journal == null) {
      return;
    }

    const create = this.journalCreates.get(id);

    if (create != null) {
      this.journalCreates.delete(id);

      const at = this.journal.lastIndexOf(create);

      if (at >= 0) {
        this.journal.splice(at, 1);
      }

      return;
    }

    this.journal.push({ op: 'free', id });
  }

  /**
   * Start or stop journaling entry lifecycle for a worker-host mirror
   * (round 141).  Starting clears any old journal; stopping drops it.
   * The journal's consumer is the registry's one lifecycle consumer on
   * this thread, so taking it also clears the ready and freed queues
   * (no renderer drains them here).
   *
   * @param on — journal from now on, or stop
   */
  setJournal(on: boolean): void {
    this.journal = on ? [] : null;
    this.journalCreates.clear();
  }

  /**
   * The lifecycle ops since the last take (or since journaling started),
   * in order; clears the journal and the ready / freed queues.
   *
   * @returns the ops, empty when nothing changed or journaling is off
   */
  takeJournal(): ImageLifecycleOp[] {
    this.readyQueue = [];
    this.freedQueue = [];

    if (this.journal == null || this.journal.length === 0) {
      return [];
    }

    const out = this.journal;

    this.journal = [];
    this.journalCreates.clear();

    return out;
  }

  /**
   * Every live entry as a create op, in id order — the full transfer a
   * mirror starts from.  Clears the journal (the snapshot subsumes it).
   *
   * @returns one create per live entry
   */
  snapshotOps(): ImageLifecycleOp[] {
    const out: ImageLifecycleOp[] = [];

    for (const entry of this.entries) {
      if (entry != null) {
        out.push({
          op: 'create',
          id: entry.id,
          url: entry.url,
          kind: entry.kind,
          crossOrigin: entry.crossOrigin,
        });
      }
    }

    this.takeJournal();

    return out;
  }

  /**
   * Mirror side (round 141): create the entry the canonical registry
   * created, at its id, and kick its decode (or fail it straight away
   * for a url that already failed here).  An entry already at that id
   * is dropped first.  The mirror never allocates ids itself.
   *
   * @param op — the canonical side's create
   */
  adopt(op: {
    id: number;
    url: string;
    kind: number;
    crossOrigin: string;
  }): void {
    if (this.entries[op.id] != null) {
      this.drop(op.id);
    }

    const entry: ImageEntry = {
      id: op.id,
      url: op.url,
      kind: op.kind,
      crossOrigin: op.crossOrigin,
      refCount: 1,
      status: IMAGE_PENDING,
      data: null,
      width: 0,
      height: 0,
      vector: false,
      tier: -1,
      rasterPx: 0,
    };

    this.entries[op.id] = entry;
    this.byKey.set(`${op.kind}|${op.crossOrigin}|${op.url}`, op.id);

    if (this.warned.has(op.url)) {
      entry.status = IMAGE_FAILED;
    } else {
      this.kick(entry);
    }

    this.onChange?.();
  }

  /**
   * Mirror side (round 141): free the entry the canonical registry
   * freed, whatever its count — queued for `takeFreed()` so the renderer
   * reclaims its layer.  A decode in flight for it is dropped on landing,
   * as for any freed entry.  No-op for an empty id.
   *
   * @param id — the freed id
   */
  drop(id: number): void {
    const entry = this.entries[id];

    if (entry == null) {
      return;
    }

    this.byKey.delete(`${entry.kind}|${entry.crossOrigin}|${entry.url}`);
    this.entries[id] = null;
    this.freedQueue.push(id);
    this.onChange?.();
  }

  /** Mirror side: drop every entry (a full transfer replaces the set). */
  dropAll(): void {
    for (let id = 0; id < this.entries.length; id++) {
      this.drop(id);
    }
  }

  /**
   * The live entry for an id, or null if it was freed.  The entry is the
   * registry's own mutable object, not a copy: its `status`, `data`, and
   * `tier` change under the caller as decodes and promotions land, so read
   * it per frame rather than holding it.
   *
   * @param id — an id from `acquire`
   */
  get(id: number): ImageEntry | null {
    return this.entries[id] ?? null;
  }

  /** Attach (or replace) the async rasterizer; kicks every pending entry. */
  setDecoder(decoder: ImageDecoder | null): void {
    this.decoder = decoder;

    if (decoder == null) {
      return;
    }

    for (const entry of this.entries) {
      if (entry != null && entry.status === IMAGE_PENDING) {
        this.kick(entry);
      }
    }
  }

  /**
   * Re-raster a vector entry to cover an on-screen demand (px, longest
   * side).  Snaps to the smallest tier covering the demand, clamped at
   * the cap tier; raster sources and already-covered demands no-op.
   */
  promote(id: number, demandPx: number): void {
    const entry = this.entries[id];

    if (entry == null || !entry.vector || entry.status !== IMAGE_READY) {
      return;
    }

    const target = this.tiers[this.tierFor(demandPx)];

    if (target <= entry.rasterPx) {
      return;
    }

    this.kick(entry, target);
  }

  /** entry ids decoded since the last call; returns-and-clears */
  takeReady(): number[] {
    if (this.readyQueue.length === 0) {
      return [];
    }

    const out = this.readyQueue;

    this.readyQueue = [];

    return out;
  }

  /** entry ids freed since the last call; returns-and-clears */
  takeFreed(): number[] {
    if (this.freedQueue.length === 0) {
      return [];
    }

    const out = this.freedQueue;

    this.freedQueue = [];

    return out;
  }

  /** How many distinct entries are held, in any status. */
  liveCount(): number {
    return this.byKey.size;
  }

  /** true while any decode (initial or promotion) is in flight */
  busy(): boolean {
    return this.inFlight > 0;
  }

  /** Resolves once no decode is in flight (immediately when idle) —
   * the export path awaits this after promoting at export scale (15.6). */
  whenSettled(): Promise<void> {
    if (this.inFlight === 0) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.settleResolvers.push(resolve);
    });
  }

  private settle(): void {
    this.inFlight--;

    if (this.inFlight === 0 && this.settleResolvers.length > 0) {
      const resolvers = this.settleResolvers;

      this.settleResolvers = [];

      for (const resolve of resolvers) {
        resolve();
      }
    }
  }

  /** How many entries are still awaiting a first decode — an O(n) scan of
   * the entry table, so for tests and diagnostics, not per frame. */
  pendingCount(): number {
    let n = 0;

    for (const entry of this.entries) {
      if (entry != null && entry.status === IMAGE_PENDING) {
        n++;
      }
    }

    return n;
  }

  private kick(entry: ImageEntry, targetPx: number = 0): void {
    if (this.decoder == null) {
      return;
    }

    const sdf = entry.kind === IMAGE_KIND_SDF;
    const opts: ImageDecodeOpts = {
      crossOrigin: entry.crossOrigin,
      targetPx: sdf ? SDF_IMAGE_SIZE : targetPx,
      sdf,
    };

    this.inFlight++;
    this.decoder(entry.url, opts).then(
      (decoded) => {
        this.settle();

        // dropped if the entry was freed (or recycled) while in flight
        if (this.entries[entry.id] !== entry) {
          return;
        }

        entry.data = decoded.data;
        entry.width = decoded.width;
        entry.height = decoded.height;
        entry.vector = decoded.vector;
        entry.rasterPx = Math.max(decoded.width, decoded.height);
        entry.tier = sdf ? -1 : this.tierFor(entry.rasterPx);
        entry.status = IMAGE_READY;
        this.readyQueue.push(entry.id);
        this.onChange?.();
      },
      (err: unknown) => {
        this.settle();

        if (this.entries[entry.id] !== entry) {
          return;
        }

        if (!this.warned.has(entry.url)) {
          this.warned.add(entry.url);
          console.warn(
            `The background image '${entry.url}' failed to load and will not render`,
            err instanceof Error ? `(${err.message})` : '',
          );
        }

        entry.status = IMAGE_FAILED;
        this.onChange?.();
      },
    );
  }
}
