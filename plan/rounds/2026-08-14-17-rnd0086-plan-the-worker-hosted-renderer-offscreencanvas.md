## The worker-hosted renderer (OffscreenCanvas)

The oldest renderer demand on the tracker (#1350, #2799): move
rendering off the main thread entirely.  WebGPU works in workers
(Chrome; other engines to-verify — round 73's reach table carries the
in-worker columns for exactly this).  Planning verified the coupling
before designing, and the finding that organises the round: **the
model↔renderer boundary is already message-shaped, and the one
load-bearing sync API never touches the GPU.**  What the code does
today, verified:

1. The renderer reads the model only through `ModelView`
   (contract.mts:990-1030): typed-array columns, **one coalesced
   dirty span per column** per frame (`store/dirty.mts:47-68`,
   `take()`-and-clear at :103), the four blobs under the same span
   rules (`StoreDelta`, contract.mts:878-896), the label sidecar
   with its own dirty list, `parentOrder()`, and the image
   registry.  `ColumnMirror` consumes it as byte-for-byte span
   copies (column-mirror.mts:13-14).  So the question the plan was
   asked — are the diffs already enumerable? — is answered by
   reading: the delta the renderer drains each frame *is* the
   enumeration, and a `(columnId, start, end, bytes)` message
   carries it verbatim.
2. But the renderer also holds direct core refs beyond ModelView:
   `cy._store` (37 call sites), `cy._styleEngine` (the
   `arrowEnds`/`midArrowEnds` tables, renderer.mts:1839-1869),
   `cy._viewport` (pan/zoom read per frame, renderer.mts:595, 2478),
   `cy._ele` for pick decode (renderer.mts:617-636), and —
   the deepest coupling — `cy._animations`: **the frame loop is the
   animation clock** (`attachDriver` at renderer.mts:1171,
   `cy._animations.tick(t0)` at renderer.mts:1276).  The core's own
   view of the renderer is, by contrast, already narrow and mostly
   async: `RendererLike` (core.mts:82-95) — destroy / pick
   (Promise) / requestRender / resize / stats / forceActive /
   exportImage (Promise) — plus the force layout duck-typing
   `renderer.startForce` (layout/force.mts:426-445).
3. The sync surface: `pickNodeSync` (renderer.mts:580; five pointer
   call sites, the pan-vs-grab decision at pointer.mts:342) resolves
   through `pickNodeAt` over the **CPU-canonical columns**
   (renderer.mts:602, cpu-pick.mts:36-41) — no GPU, no renderer
   state beyond view constants.  With the store staying main-side,
   the sync pick stays main-side and **stays sync**.  `exportImage`
   and `pick` are Promises already; `stats()` is a sync counter
   snapshot.
4. Events: the pointer handler binds to the **renderer's canvas**
   (pointer.mts:1693 — not the container, correcting the planning
   premise) and writes back through the core API.  Under
   `transferControlToOffscreen()` the canvas element stays in the
   DOM and keeps receiving events, so input needs no forwarding at
   all — only what the frame already consumes (viewport state,
   diffs) crosses.
5. The wire format (`wire.mts:17-25`) is the precedent and the seed
   for the **initial full-state transfer**; per-frame traffic is
   spans, not the wire format.

Design, pass 1: **renderer-only in the worker** — store, style,
animation manager, layouts and pointer all stay on main.  A
main-side `RendererProxy` implements `RendererLike`; a worker-side
`RemoteModelView` implements `ModelView` over local typed arrays fed
by span messages; the frame loop, mirror and pipelines run in the
worker unchanged.  The named hard couplings and their resolutions:
the animation manager reclaims its own rAF loop (it already owns one
for the sink-less case, animation.mts:1740-1750) and the tween sink
becomes a register/unregister proxy — the settle contract
("re-derive on CPU, no readback", gpu-tween.mts:16-19) survives
untouched, a designed-for property; pick decode + staleness
revalidation (renderer.mts:617-636) moves main-side over raw ids;
image decodes move to the worker (`createImageBitmap` +
transferables); device loss forwards out and the core's re-mount
recovery (core.mts:2917) tears down and respawns the worker;
`startForce` is deferred or proxied — decided in-round on 86.1's
cadence numbers.

### 86.1 — the coupling audit and the messaging contract, written first

Enumerate every renderer→core touch (the census above is the start)
and classify each: served by RemoteModelView / moved main-side /
forwarded / deferred.  Write the message schema — init transfer
(wire-format-seeded), per-batch delta (spans + blobs + label entries
+ viewport + tween registrations), pick request/reply, export,
resize, devicelost, stats snapshot — as a typed module under the
contract.mts discipline: co-signed, changed first.
**Measure-first gate:** the per-frame copy cost.  A CPU-side
position animation or layout tick dirties a span covering most of
`node.position`; measure copy + transfer at harness scale
(`ndex-x-large`) before committing to the copy design.
SharedArrayBuffer would erase the copy but demands cross-origin
isolation the library cannot impose on embedders, so it can only
ever be an opt-in tier — priced here, decided by the maintainer
(Open).

### 86.2 — extract the seam (behaviour-neutral, lands alone)

The renderer stops reaching into `cy._*`: it takes at construction a
ModelView, a viewport view, the style arrow tables, and a tween-sink
registration surface; pick decode moves core-side.  No worker yet —
the same-thread path remains the default and must stay
byte-identical.  **Verified by** the full existing suite with the
goldens moving zero pixels, plus the round-42 restructure rule: a
green suite proves the paths resolve, so the proof is the call-site
diff audited against the one change the pass is allowed to make.
This pass is independently valuable — it is also the seam a WebGL
fallback renderer or a headless-Node renderer would mount through —
which is why it is separated from 86.3.

### 86.3 — the worker host, behind `renderer: { worker: true }`

Opt-in on `RendererOptions` (public-types.mts:528); the default is
untouched.  The worker bundle question — a rolldown worker entry
versus spawning from the existing UMD — is decided with
`test/modules/packaging.mjs`'s gates in mind, not around them.
Fail-loudly: absent OffscreenCanvas / worker-side
`navigator.gpu`, mount rejects with a clear message on the
`index.mts:60-65` precedent (whether a documented capability probe
should accompany it is an Open call — never a silent same-thread
fallback).  **Verified by**: a worker variant of a golden *subset*
diffed exact-zero against the same scenes' same-thread goldens (same
SwiftShader pin — the strongest available parity statement); the
renderer project's interaction specs run once under the worker
config; and a soak spec asserting the worker is terminated and the
instance collected across create/destroy cycles (the WeakRef
discipline).  The frame-driver note is re-verified deliberately:
worker rAF under CI's SwiftShader has never been measured here, and
the mid-flight specs' polling rule already assumes nothing about
when frames land.

### 86.4 — measure, record, close

A benchmark row whose subject is the point: **main-thread occupancy
per frame** under drag/animation at harness scale, worker versus
same-thread — total frame time would measure nothing, since the work
does not shrink, it moves.  Plus the pick-latency delta (one hop).
New suite ⇒ new fingerprint; publish serial per the standing rules.
Close: src/README.md section, MIGRATING/CHANGELOG rows if any public
surface moved, JSDoc gates, d.ts regenerated, this record.

### The round-73 dependency, flagged

This round's architecture **depends on round 73's outcome**, and
86.2 is where it bites.  If a WebGL fallback is built — pre- or
post-4.0 — the worker split must sit *above* renderer choice: the
message schema and RemoteModelView renderer-agnostic (nothing
WebGPU-typed in the contract), or the matrix becomes two renderers ×
two hosts with private plumbing in each cell.  If 73 recommends
never, the seam may keep WebGPU types and stay simpler.  Also
re-checked after 73: WebGL2-in-worker OffscreenCanvas support is
likely *broader* than WebGPU-in-worker (to-verify — 73.3's reach
table carries both columns), which could invert which renderer the
worker host serves first.  Whichever assumption this round builds
on, the record states it and names what 73's data would have to say
to overturn it.

### Risks named at planning

- The per-frame copy can eat the win on position-heavy frames: GPU
  force and GPU position tweens publish on-device (no spans), but
  CPU layouts and CPU-channel animations produce near-full-column
  spans every tick.  86.1's gate exists because this number decides
  the design, not tunes it.
- Worker rAF throttling differs per engine and changes background-
  tab behaviour; document against today's main-thread throttling
  rather than fixing what is not this round's subject.
- Two host configurations widen the Playwright surface; the worker
  tier runs a golden subset, exact where it runs, rather than
  doubling all 45.
- 86.2 is the stranded-doc-block refactor shape (65.4/65.8, 72.3's
  warning) — the JSDoc gate runs before each commit.
- `stats()` under a worker is a mirrored snapshot; a spec that
  samples it must key off `gpuFrameReadings` transitions, exactly as
  its doc comment already instructs (public-types.mts:573-577).

**Open:** the option shape and the unavailable behaviour (reject
loudly as planned, with or without a public capability probe); the
SharedArrayBuffer opt-in tier — pursue, or decline with the
measurement recorded; whether `stats()` stays a documented
stale-snapshot or goes async (recommendation: sync snapshot plus a
freshness field); the worker option's own pre/post-4.0 positioning —
it is additive and opt-in, so unlike 73's subject it does not change
what 4.0 *is*, and the recommendation is post-4.0 unless 73's
outcome bundles the two splits into one boundary round; whether
`startForce` crosses the boundary in pass 1 or waits; and whether
86.2 should be pulled forward to land beside round 73's decision,
since it is the seam both futures share.
