## Round 24 plan — style transitions + animation controls (planned 2026-08-01; landed in full the same day — see the pass records below)

**Signed-off design calls**: the fourth-sitting record above —
trigger taxonomy with instant-on-add, uniform latest-wins eviction,
all-props-accepted with tiered executors (paint tweens now, discrete
+ geometry snap, geometry-tween round logged), bulk-record
whole-channel transitions, the auto-vs-explicit domain contract, and
the `pause`/`resume`/`reverse` control set.

**Pass split** (tests-first; docs in-commit):

- [x] **24.1 Transition props + CPU path** (2026-08-01) — landed as
  planned, with the trigger detection shaped as **one mechanism**:
  the four props split out of each sheet block at compile
  (per-group `TransitionSpec`; the parents def merges
  nodes-then-parents under v3's order precedence; constants-only —
  mapper values throw; `transition-property` accepts arrays or
  space-separated strings and validates every name against the
  group's read set, so unknown or wrong-group names throw while
  discrete/geometry names are accepted and snap), and a **capture
  wrap around the one channel funnel** (`write()`): any apply pass
  under a configured spec (sheet re-application, the mapper refresh
  paths — case flips, scale moves, auto-extent escalation,
  structural `::parent` refreshes, the leaf↔parent flip restyle —
  and the batch flush) snapshots the tweenable columns per slot
  before the write, diffs **stored truth** after it, restores the
  old value (the store holds the pre-restyle state until the first
  post-delay tick — CSS's delay rule, and no target flash), and
  packs the accumulated diffs into **bulk per-column ChannelWrites**
  wrapped in one preset Animation started through the round-21
  manager — so latest-wins eviction between transitions and user
  animations falls out in both directions with zero new eviction
  code.

  Instant-on-add is a per-slot **styled-generation mark**
  (gen + 1; recycled slots fail on their fresh generation; marks
  refresh on slot compaction), which also makes the batch flush's
  applyAll net-change-correct with no call-site special-casing.
  Diffing stored truth gives the fold semantics for free, recorded:
  channel-opacity folds ride the color they fold into, and an
  edge-`opacity` transition carries the pre-folded arrow alphas
  along as ride-along color writes (only when the opacity itself
  moved).

  Tweenable set = the animation system's channels
  (opacity both groups, background/border/line colors,
  border-width); preset animations derive `touchedColumns`/
  `gpuEligible` from their writes (all-paint may offload — 24.2's
  hook; border-width stays CPU).

  Tests-first: 23 Node specs
  (`test/transitions.mjs`, red then green) — the full trigger
  matrix (sheet swap, add, case flip, scale move, auto-extent
  shift, explicit-domain confinement, batch net-change + batch-add,
  parent flip, show/hide non-trigger, zero-duration), snap tiers,
  eviction both directions, delay, edge line-color, the arrow
  ride, and prop parse/validate/readback.  2237 Node tests,
  63 module tests, 151/151 Playwright (goldens untouched — rendered
  scenes without transitions are pixel-identical under the capture
  wrap), typecheck + lint clean.
- [x] **24.2 GPU bulk path + scale proof** (2026-08-01) — the
  offload came almost free from 24.1's preset shape: an all-paint
  preset reports `gpuEligible` and the manager registers its
  ChannelWrites with the existing gpu-tween kernels verbatim, so
  the only new renderer-side code is a **demotion rule**: a listed
  transition prop's mapper eval can not be kernel-owned (the diff
  reads stored truth on the CPU, which is stale exactly when the
  kernel owns the channel) — `paintInputs` demotes every prop in
  the group's spec (the parents overlay's spec too, under
  compounds); transitions and mapper kernel eval are mutually
  exclusive *per channel*, while the tween itself still runs
  on-device (different kernels).

  Playwright (both discriminating,
  in the `renderer` project): a sheet-swap transition tweens pixels
  through OKLab while `style()` reads the pre-restyle value (the
  motion-staleness rule) and settles on the exact resolved end
  state; a scale-mapper transition on a data write tweens rather
  than snapping — the spec fails on the mid-flight green>red
  strictness if the demotion is removed.

  Scale proof
  (`benchmark/transitions.mjs`, headless 200k nodes): the
  auto-extent shift's whole-channel re-derive is 326 ms off →
  594 ms with transitions (1.82× — the diff + restore + bulk spawn
  is a constant factor, not a new class); the explicit-domain
  write is 4.2 → 6.8 µs (O(changed) pinned — ~2.6 µs to diff and
  spawn a one-element tween); a whole-sheet swap is 1.46 → 1.67 s
  (1.15×); and the spawned 200k-slot tween costs 15 ms per CPU
  tick — the number the GPU offload deletes (all-paint presets
  tick on-device at ~zero CPU, the round-9.4 contract).

  The
  domain-contract browser spec folded into the Node spec + the
  benchmark's explicit-domain group (recorded).  2237 Node tests,
  153/153 Playwright (2 new), typecheck + lint clean.
- [x] **24.3 Controls** (2026-08-01) — `pause()`/`resume()`/
  `reverse()` on the Animation handle (element and viewport alike),
  plus read-only `progress()` and `paused()` introspection
  (`progress` is a getter only — no scrubbing; `apply`/`applying`
  stay out).

  Timeline semantics: pause freezes elapsed in place
  (values hold, the promise stays pending, `playing()` reads false)
  and resume shifts the start clock by the paused span; reverse
  swaps every write's from/to halves (and the viewport targets) and
  remaps elapsed to 1 − t, so the current value is continuous —
  exactly for point-symmetric easings (linear included; v3's
  start/end swap carried the same rule) — and reversing inside the
  delay completes at the captured start state.  The controls read a
  `lastNow` clock the manager stamps every advance, so they stay
  deterministic under test-driven ticks.

  GPU lease: pause and
  reverse settle a GPU-driven animation's exact current value onto
  the CPU and release the device (`applyNow` — a settle that does
  not finish); resume/the next advance re-registers through the
  normal eligibility path with the shifted clock (pinned: the
  re-registered start keeps 160 − start = elapsed, and a reversed
  re-registration uploads the swapped from/to).  A paused animation
  still owns its channels — the round-21 eviction stops it like any
  running one (pinned).

  Tests-first: 11 Node specs
  (`test/animation-controls.mjs`, red then green) — timeline
  shift, pending promise, stop-on-paused, eviction-of-paused,
  reverse continuity + delay edge, progress states, both mock-sink
  lease specs, and the viewport.  2248 Node tests, 63 module tests,
  153/153 Playwright, typecheck + lint clean.
- [x] **24.4 Docs closing sweep** (2026-08-01) — README trued up:
  the top summary carries round 24, the sheet listing carries the
  `transition-*` config, the promise-sequencing bullet's "open
  follow-up" became the landed controls paragraph (24.3 commit),
  the animation-surface listing carries the handle controls, and
  the mapper DSL bullet carries the domain performance contract
  (O(n) auto-extent vs O(changed) explicit — the transitions
  bullet holds the long form and the measured numbers).  PLAN.md:
  gap-ledger item 9 closed (round 24 landed in full 2026-08-01);
  the sequencing tail names the **geometry-tween round**
  (size-channel transitions + animation, one benchmarked round
  with the per-tick invalidation cascade) as the successor open
  follow-up.  **Round 24 is complete.**
