## Round 103 plan — progressive ingest: a first frame before the last byte (proposed 2026-08-20)

Rounds 66/67 took monolithic init from 2899 ms to 1756 ms and
then to 622 ms headless (1.92× in one A/B), but the pipeline
shape is unchanged: fetch → parse → init → first frame, strictly
serial, first pixel after the last byte.  For app-scale loads —
GeneMANIA results over a slow link, Cytoscape Web sessions — the
next factor of perceived speed is not another 2× on init, it is
showing a correct partial graph early.  The verified constraints
that shape the design:

- **A wire/columnar payload is self-contained by construction**:
  edge endpoints are u32 indices *into that payload's nodes*
  (`src/public-types.mts:90-97`; the wire sections mirror it),
  so a later chunk's edges cannot name an earlier chunk's nodes
  at all today.  Chunking therefore means one of: vertex-closed
  subgraph chunks with **cut edges carried in definition form**
  (id-keyed, the slow path, but it works today); or an id-keyed
  endpoint mode in the columnar/wire ingest — a format evolution
  that belongs with item 43's version-header work, not alone.
- The round-67 browser decomposition (fetch 105 / parse 175 /
  convert 105 / init 1150 / ready 100 / first frame 85–400 ms)
  is the baseline instrument and stays the harness for this
  round; the wire path already removes the parse row.

The plan, measure-first:

1. **The zero-format-change baseline**: split ndex-x-large into
   k = 10 chunks, `cytoscape()` on chunk one, `cy.add()` per
   subsequent chunk, cut edges as definitions.  Measure
   time-to-first-frame, total time versus monolithic (the churn
   factor), and *where* the churn lands — per-add style apply,
   curve re-derivation (`CurveIndex` re-derives a pair when a
   member arrives), renderer reallocation cadence under 10×
   growth.  This number decides whether the round is an API
   round or first a churn-fixing round.
2. **The API sketch**, refined after (1): a chunk-accepting load
   — `cytoscape( { elements: asyncIterable, ... } )` or an
   explicit `cy.load( stream )` — with a **viewport policy**
   stated up front (fit once on the first chunk, then hold;
   never re-fit per chunk — the screen must not jump), progress
   events per chunk, and `cy.ready` meaning "first chunk
   rendered" with a second signal for "complete" (naming open).
3. **Positions**: the streamed case that matters ships
   server-computed positions (preset), which is both flagship
   apps' shape.  Running a generated layout per chunk is
   explicitly out of scope; one open question below covers the
   layout-after-complete convention.
4. **The wire evolution decision**, taken jointly with item 43:
   if (1) shows cut-edge definitions dominating, the id-keyed
   endpoint mode (or a row-group segmented format) becomes the
   payload of promoting the format, and the two rounds should
   merge rather than evolve the header twice.

Controls: the chunked load's end state must be **columns-equal**
to the monolithic load of the same fixture (the round-42 method
applied to store state, not files); the first-frame spec asserts
a frame rendered while a later chunk is knowably absent (assert
the precondition, the 48.5 rule).

Risks: event semantics are public API (what does `add` batching
look like per chunk; does a layout started mid-stream see a
moving target — recommended: refuse or queue); a progressive
render shows an incorrect *partial* graph by design, and the
docs must say what is guaranteed (every rendered element is
correct; completeness arrives).

**Open (maintainer):** API spelling (options-form async iterable
versus explicit `load()`); the ready/complete event names;
whether chunking joins item 43's public format now (one header
evolution) or stays app-side (the app slices its own subgraphs);
minimum chunk granularity worth supporting before overhead eats
the win.

