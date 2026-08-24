## Landed (round 9.4 — GPU paint tweens, 2026-07-27)

Executes the paint half of the round-9 follow-up under the design calls above.
The scope correction made while planning it: `border-width` was listed with the
paint channels in round 9, but it is **geometry** — `boundingBox()` reads
position ± size/2 + border/2 — so it stays CPU-canonical and moves to the R8.5
geometry-seam work.

- **Paint/geometry tiers** (`animation.mts`).  Channels carry a `tier`:
  *paint* (`opacity` both groups, `background-color`, `border-color`,
  `line-color`) may offload, *geometry* (`border-width`, and later size /
  `edge.width`) may not.  Paint has **no CPU consumer** — nothing in cull, CPU
  pick, or a columnar scan reads it, which is why it went GPU-evaluable in the
  mapper split — so a tween can own the column outright.  Eligibility is
  all-or-nothing per animation, so a column is never half-owned.
- **One capture, two executors.**  `capture()` snapshots start values into
  per-channel `ChannelWrite`s (column, kind, slots, packed from/to) once; the
  CPU tick and the GPU kernels consume the same numbers, so they agree by
  construction rather than by parallel implementations.
- **Three kernels** (`render/gpu-tween.mts`): `position` (vec2), `scalar`
  (f32), `color` (packed rgba8).  Dispatch counts come from WGSL
  `arrayLength(&slots)`, not a uniform — `queue.writeBuffer` is ordered against
  submitted command buffers, *not* against dispatches inside one, so a
  per-dispatch value cannot live in a shared uniform (a bug caught while
  authoring; pinned by a test).
- **Tween-wins precedence, free mapper reclaim.**  Paint dispatches are encoded
  inside the cull pass *after* `mapperRuntime.encode()`; dispatches in one pass
  observe prior dispatches' writes (the guarantee the cull kernels already rely
  on), so a live tween beats the eval kernel for the same channel.  On settle,
  the CPU write dirties the column — already the mapper's re-evaluation
  trigger — so the mapped value returns with no new machinery.
- **Colors tween in OKLab**, matching color mappers' default: one perceptual
  model across the library instead of a mapper/animation split.  Endpoints are
  converted on the CPU and packed as two `vec4f` (L, a, b, alpha), so the
  kernel needs only the OKLab→sRGB direction it shares with the mapper kernel.
  **Deliberate v3 divergence** (v3 tweened per-channel in sRGB) and a change to
  round 9's shipped CPU behaviour.
- **Arrow-alpha fold rides along.**  The arrow VS is at WebGPU's base
  8-storage-buffer limit, so edge opacity is pre-folded into stored arrow alpha
  (`stored.a = base.a × opacity`).  The fold is linear in opacity, so animating
  `edge.opacity` also emits a color tween per arrow end to `base × toOpacity` —
  identical math on both executors.  The base comes from
  `StyleEngine.arrowBase()`, not the stored bytes, which cannot recover it when
  the folded opacity was 0.
- **Bugs fixed on the way in** (all pre-existing, all now covered):
  `eles.animate({style: {opacity}})` was a silent no-op on **edges** (the
  channel map was node-only); `stop()` on a GPU-driven animation left the CPU
  at the start value while the device buffers held the last frame drawn, with
  nothing to reconcile them (it now settles, matching v3's leave-it-where-it-got
  -to); a custom easing **function** was silently downgraded to `'ease'` on the
  GPU (made ineligible here, then dropped from the API in R9.5); and the GPU
  path captured start values *before* the delay elapsed,
  unlike the CPU path.
- **A reserved-word trap, and the guard for it.**  `target` is a WGSL reserved
  keyword: all three tween pipelines failed to compile, the dispatches became
  silent no-ops, and the specs still passed on stale buffer contents.  Two
  guards now close that hole — the webgpu Playwright project fails any test
  whose console reports a WGSL/validation error, and a Node test
  (`test/modules/wgsl-identifiers.mjs`) checks every shader's declared
  identifiers against the reserved list, so a GPU-less CI catches it too.
- **Verification**: 1411 Node tests + 47 module tests, typecheck and lint
  clean, and 24/24 webgpu Playwright specs on a real (SwiftShader) adapter —
  including a paint-lease spec (pixels fade through the OKLab path mid-flight
  while CPU `style()` reads the start value; settles exactly on the target) and
  a precedence spec (a tween outranks a mapped `opacity`, which reclaims the
  channel on stop).
- **Still deferred:** the *size* tween (`width`/`height`, `border-width`,
  `edge.width`) with the R8.5 geometry seam, and GPU layouts.
