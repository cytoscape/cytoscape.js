## Round 48 — robustness + soak (planned 2026-08-04; Node tier landed 2026-08-04; complete with 48.6, 2026-08-08)

The tier of testing a release needs and feature rounds never owed.  It
ran as `npm run test:soak` — its own script because the leak specs need
`--expose-gc`, and a leak spec that cannot force a collection is a flake
generator — and joins the `npm test` chain.  **24 specs across four
files, and they found four defects**, which is the whole argument for
the tier: every one of them was reachable from a public entry point and
none was reachable from any test the suite already had.

- [x] **48.1 Lifecycle leaks** (`test/soak/lifecycle.mjs`, 7 specs) —
  and the method note is the finding.  The obvious gate is a byte
  bound, and it is the wrong one: 1000 create/destroy cycles of a
  400-element graph grow `heapUsed` by a steady **~2.2 KB per cycle**,
  *linear across five 200-cycle blocks* — which reads exactly like a
  leak and is not one.  Holding a `WeakRef` to each destroyed core shows
  every one collected; what grows is V8's own bookkeeping.  So the gate
  is **reachability**, which is what the contract actually says, and the
  byte bound survives only as a wide backstop.

  Also pinned: destroy
  removes every listener, `on`/`off` is symmetric over 2000 handlers,
  destroy is idempotent, and an app that holds a collection past
  teardown pins *that* instance and no other.  The first spec is the
  control — held instances must stay reachable and unheld ones must
  not — without which every other spec here passes by doing nothing.
- [x] **48.2 The churn profile, promoted to a gate**
  (`test/soak/churn.mjs`, 5 specs) — round 11 identified sustained
  remove-and-re-add at stable size as "the most motivated real-world
  case, and invisible to a dead-slot-ratio meter", fixed it, and proved
  it by measuring once.  A number in a commit message does not stop a
  regression.  4000 nodes, 40 rounds of a 400-element band, **fresh ids
  and fresh per-element strings every round** — re-adding the same ids
  would refill the same blob bytes and pass with every reclaim removed.
  Measured flat: the id blob holds ~42 KiB at round 0 and at round 40,
  capacity never moves off 64 KiB, `highWater` never moves off 4400.
- [x] **48.3 Wire-format fuzzing** (`test/soak/wire-fuzz.mjs`, 5 specs)
  — seeded LCG mutations in three regions, requiring every outcome to
  be either a thrown `Error` or a graph that loads *and answers*.  **It
  found three defects on its first run**, all the same shape — a count
  or index read out of the payload, unvalidated, driving allocation:
  - a **dictionary index** in a data column (zero-copy, so nothing had
    looked at it) became 2,566,914,049 against a 3-entry dictionary;
    `ingestColumn`'s `refs[ at - 1 ]++` then inflated a plain array to
    that length and reduced over it.  `cytoscape( { elements: buffer } )`
    went from 0.6 ms to **never returning**, with no error anywhere.
  - a corrupt **flags word** made the reader consume position bytes as
    the packed-id offsets, so the declared total id length became a
    float bit pattern and `setBulk` grew its blob to it: **25.9 s**
    before reaching the duplicate-id error it should have raised at
    once.
  - a corrupt **data-block key count** did the same one level up.
  Fixed at the cheapest honest place in each case, which is the part
  worth keeping: the dictionary guard went into `DataStore.ingestColumn`
  because **both ingest branches already walk every index**, so fused it
  costs nothing — where the same validation in `deserializeElements`
  measured **4×** on that function (0.106 → 0.46 ms per 200k indices),
  against a reader whose headline property is being O(1) per column.
  The id-blob guard is O(1) (a declared total cannot exceed the blob
  carrying it) and the count guard is O(1) per count.  Suite went 31.5 s
  → 247 ms.

    Each guard is *also* pinned deterministically in
  `test/wire.mjs`, because the throw-coverage gate measures `test/*.mjs`
  only and a guard reachable solely from a fuzzer is one the gate cannot
  see.
  Two of the four original failures were **the spec's fault, not the
  library's**, and both are recorded in it: a ratio threshold written
  from the header's intuition failed the tail region for behaving
  correctly (17/250 loading is right — the data blocks are
  self-describing, so corruption there is mostly caught), and a
  `for...of` over a Collection, which is not iterable.
- [x] **48.4 Multi-instance isolation** (`test/soak/isolation.mjs`, 7
  specs) — id space, writes, style, selection, events, destroy order,
  compaction, and forty instances at once.  **It found the round's
  fourth defect, and the worst-behaved one**: a ref is
  `{ group, slot, gen }` and identity keys on those three packed into an
  integer — all per instance — so the first node of one graph and the
  first node of another pack *identically*.

  Every one of the twelve
  methods round 29.3 guarded then answered as though they were one
  element: `same()` was **true**, `contains()` true, `indexOf()` 0,
  `intersection()` returned everything, `difference()` returned nothing,
  and `union()` silently dropped the other graph's elements entirely —
  two graphs of two nodes united to two, reading back the first graph's
  data twice.

  Fixed in `assertCollection`, the guard round 29.3 added to those exact
  twelve methods for the exact same reason ("they crashed on
  `other._refs` — or, in `same()`'s case, quietly returned false, which
  reads as working code").  This is that sentence again with a different
  wrong answer, so it is the same fix: one core-identity comparison per
  call, on a path that already validates its argument.  **A behaviour
  change to public API**, recorded as such — these calls returned wrong
  answers and now throw — and carried in `CHANGELOG.md`.

- [x] **48.5 Device loss under load** (2026-08-04, the `renderer`
  project, 3 specs) — round 10's spec loses the device on an *idle*
  instance, which is the easy case: nothing owns a column, nothing is
  mid-readback, and the rebuild has only the model to replay.

  These
  lose it while something is in flight, which is where a lease that is
  never released or a promise that is never settled shows up as a hang
  rather than an error: **mid-animation** (a GPU-leased position tween —
  the promise must settle, the lease must release, and the column must
  be CPU-owned and writable afterwards), **mid-export** (the one
  readback in the architecture, encoded in the frame loop and mapped
  after — the promise must settle either way), and **mid-force-run** (the
  stronger lease: the sim owns the position column for its whole run,
  and every position must come back finite and writable).

  **The control is the point here**, and it caught a weak spec: with
  `_debugLoseDevice` neutered, the export spec still passed, because it
  accepts a resolved *or* a rejected export and with no loss the export
  simply resolves.  It now asserts the loss happened as well as the
  settling — round 27.7's lesson, in a third costume.  With the hook
  no-opped and the bundle rebuilt, all three fail; restored, all three
  pass.

- [x] **48.6 The documented limit edges** (2026-08-08, the `renderer`
  project, 3 specs) — the tail the record above had left "still to do,
  and deliberately not claimed": the 256-layer image tier cap, a full
  glyph atlas, and the export texture cap.  Each got the fixture big
  enough to reach its limit, and each spec pins the *contract at the
  edge* rather than the limit alone: the resource just inside still
  works, the first thing past it degrades the documented way
  (warn-once, render without the resource — never a crash), and the
  instance carries on.

  - **The image tier cap is two-sided.**  Phase 1 loads exactly 256
    unique data-URI images into one tier and asserts *no* warning —
    the 256th image must fit, so a cap firing a layer early fails the
    spec — then a pixel proves an under-cap image actually renders
    (the probe node draws its blue image, not its red background).
    Phase 2 adds three more: exactly **one** warning (warn-once, not
    one per overflow), the overflow node draws its background colour
    where its image would have been, and the under-cap images are
    undisturbed.
  - **A full glyph atlas separates "full" from "broken".**  ~1500
    distinct characters (ASCII through Cyrillic first — ranges a Linux
    CI font stack has real ink for — with CJK filler, which consumes
    cells even as `.notdef` boxes because the cache keys on the
    character) overfill the 1024² shelf packing.  After the warn: a
    label of *novel* characters lays out empty and does not re-warn,
    and a label of *cached* characters still renders in full
    (`stats().glyphs` grows by exactly its glyph count) — which is the
    behaviour the warning's own text promises.
  - **The export cap is exact, and the error's advice works.**
    `png( { full: true, maxWidth: limit } )` succeeds with output width
    exactly `device.limits.maxTextureDimension2D`; `limit + 1` rejects
    naming the dimensions and the limit.  And because round 31 found an
    error message advising a form the library rejects, the spec follows
    this message's advice on the same instance: after the over-limit
    `scale` rejection, the `maxWidth` form it recommends must actually
    resolve.

  **Five controls, every one failing where it should**: the cap at 255
  fails phase 1's no-warn assertion; the cap at 512 fails phase 2's
  warn assertion (and trips the device-validation `afterEach`, since
  layers then write past the texture); the atlas going full *silently*
  fails the warn poll; the export guard at `>=` fails the at-limit
  export; the guard deleted fails the past-limit message match (the
  device rejects the texture instead, which is exactly the raw failure
  the guard exists to pre-empt).
