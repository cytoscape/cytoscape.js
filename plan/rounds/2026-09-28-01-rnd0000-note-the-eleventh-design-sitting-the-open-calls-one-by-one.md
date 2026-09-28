## The eleventh design sitting — the open calls, one by one

The maintainer went through every open call in PLAN.md's ledger, then
the logged ideas and the open questions on the planned round files,
one at a time, each put with its background and priced options.  The
frame was the alpha gate in `docs/feature-direction.md`: the two hard
minimums (SVG export, rendering without WebGPU) and the contracts that
must be decided rather than built before the first alpha.  This file
records each answer as given; PLAN.md's items carry a one-line pointer
here.

### The ledger's open calls

- **Item 23 — `arrow-scale` quantized to 1/16: leave it.**  The 1.8%
  stays a recorded deviation and the reserved bits 18..23 stay
  reserved.  The maintainer logged a new question beside it instead:
  an **arrow-shape review** (item 72) — the shape vocabulary may
  consolidate (`triangle-tee` and `triangle-line` as one, for
  example), and `tee` may match the edge width in v4.
- **Item 27 — the edge overlay/underlay band: keep v4's
  `width + 2 × padding`** as a deliberate deviation from v3's
  `2 × padding`, documented in `MIGRATING.md` and `features.csv`.
- **Item 21 — hollow mid arrows: excluded; the mid-arrow width:
  added.**  `mid-*-arrow-fill` is dropped (mid arrows are filled, as
  today; additive later if asked), so SVG export and the WebGL path
  draw them filled too.  `mid-*-arrow-width` has no compositing
  problem and is to be implemented — a task, not a round.
- **Item 18 — warming the tween pipelines: deferred to round 73.**
  The WebGL fallback's capability selection decides whether software
  WebGPU adapters (the population the warm-up was for) are served by
  WebGL2 instead, which has no compute stage to warm.
- **Item 52 — the chain spec's intermittent failure: a task**, not a
  call.  It goes with the layout round (below), beside the other
  logged layout work.
- **Item 53 — the merged branches: kept.**  All eight local branches
  merged into `v4` stay; the item closes.
- **Item 54 — the unscreened benchmark rows: the checklist for the
  next performance review** (repeats for the one-shot row, the `x32`
  amplification, a `--repeat` for the CPU one-shots, a driver line in
  `meta.adapter`, a re-baseline of the `--layout` rows).  It leaves
  the open calls.
- **Item 61 — the layout option surface: the bounding box is a hint
  by default**, with an explicit option for when it binds; one
  spelling for the gap and one meaning for compacting, the names
  decided on the option matrix.  Scheduled into **the layout round**:
  the round-125 page sittings, item 61, item 62 and item 52 together.
- **Item 62 — AVSDF: in the layout round**, measured first (crossings
  under id order, `sort` and AVSDF), added as a `sort` value only if
  it clearly wins.
- **Item 63 — the constants' bundle price: folded into round 126.**
  Inline at build time only if 126 finds a real (non-regex)
  transform; otherwise accept the 2.7 KB gzipped.
- **Item 65 — the Brandes reference's layout: go, a small task.**
  Run the flat body in-thread as the reference, measure the score
  difference, re-pin parity.
- **Item 66 — edge id registration: measure, then the numeric fast
  path.**  Split string cost from interning cost first; lazy ids only
  if the fast path is not enough.
- **Item 67 — the whole-sheet re-apply: a sheet diff, before alpha.**
  The bypass-clearing rule of a sheet replace is kept.
- **Item 68 — animated layouts at scale: one column animation per
  layout, before alpha.**  Per-node observability during a layout
  tween (`animated()`, stopping one node) is settled as part of the
  contract.
- **Item 69 — the offload builders: one-pass builders** in round 74's
  style, with the build share measured at 8k / 32k / 128k first.
- **Item 70 — the k-clusterings' offload lane: build it before
  alpha** — one named-metric kernel shared by the reference and the
  workers, the closure path kept for custom metrics, with its parity
  record.
- **Item 71 — the eleven 1,000–1,600-line files: left as they are.**
  The item closes without a rule.
