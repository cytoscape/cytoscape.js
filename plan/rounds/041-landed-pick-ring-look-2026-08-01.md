## Landed (pick-ring look, 2026-08-01)

The hardware pass flagged its pick numbers — 4–5 of 25
hover-while-panning requests returning null, attributed to
staging-ring exhaustion — for a look.  The look found the attribution
**wrong**, and a latent policy wart behind the phrasing it leaned on:

- **The nulls were background answers, not drops.**  The benchmark's
  pick scenario holds at most *one* pick in flight (a new `cy.pick()`
  is only issued once the previous one resolved, with a 120 ms gap),
  and one logical request consumes at most one ring slot — so the
  3-slot staging ring **cannot exhaust under that driver**.  The
  nulls are genuine background answers: at fit-all the five probe
  points (0.3–0.7 along the diagonal) mostly sample empty space
  between hairline edges, and far-zoom decimation additionally makes
  sub-half-alpha edges unpickable (the recorded deviation).

  The
  scenario's own comment admitted the ambiguity ("background answer
  or a dropped request — the API can't tell them apart"); the
  hardware-pass note picked the wrong branch.
- **Drop-on-exhaustion is gone; a full ring defers instead.**  The
  old policy resolved requests null when no staging buffer was free —
  and the frame had *already encoded and submitted* the full pick
  cull + draw pass before `encodeCopy` threw the copy away.  Now the
  frame checks `hasFreeSlot()` before encoding anything: a saturated
  ring skips the pick pass entirely and leaves the request pending
  (still coalescing latest-wins), and the frame loop's existing
  `hasPending()` reschedule retries it — a slot frees as soon as the
  oldest readback maps, so the extra latency is bounded by in-flight
  GPU work (~1–2 frames).

  A pick now resolves null only for
  background, destroy, or device loss — spurious nulls are
  structurally impossible, which also makes the benchmark's `nulls`
  count unambiguous (background only).
- **Saturation is observable**: `renderer().stats().pickDeferrals`
  counts frames that found the ring full and deferred; the pick
  scenario reports it per run (`N background, M ring-deferred`).
- **Confirmed on the hardware-pass box** (RX 580, same config): the
  pick scenario on the four 25k scenes (flat, curved, compound,
  images) reports 4/4/5/5 background answers and **0 ring-deferred**
  on every scene at p50 16.9–18.1 ms — the same numbers the hardware
  pass recorded, now with the null counts attributed correctly.
- Tests: `test/modules/picking.mjs` unit-tests the ring against a
  fake device (latest-wins coalescing; exhaustion defers — the
  request survives the full ring unresolved, acquires the next freed
  slot, and resolves with a real answer; destroy resolves null), seen
  red under the drop policy first.  A `webgpu` Playwright spec
  saturates picks across frames over an edge (pan-jiggled so every
  request misses the cache) and asserts none resolve null.
