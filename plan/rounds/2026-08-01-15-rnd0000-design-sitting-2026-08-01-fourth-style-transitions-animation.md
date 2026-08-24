## Design sitting (2026-08-01, fourth) — style transitions + animation controls

The open half of gap item 9, scoped with the user as **round 24**.
Calls taken:

1. **Transitions are in** — the `transition-property`/`-duration`/
   `-delay`/`-timing-function` family returns as sugar over the
   animation system.  The trigger taxonomy is v4-specific (no
   classes, no bypass): a transition fires whenever an element's
   *resolved* channel value changes through a restyle — sheet
   re-application, mapper re-evaluation on data writes (`case`
   clause flips, scale output moves, auto-domain extent shifts) and
   structural restyles (leaf↔parent flips, structural `case`
   conditions).  **Instant on add** (v3's rule — a new element's
   first style application never tweens from channel defaults).

   Non-triggers, recorded: `visibility`/`show`/`hide` flips (flags,
   not tweenable channels — fade is spelled with an `opacity`
   transition) and descendant effective-opacity folds (they follow
   an ancestor's tween per tick; no per-descendant transitions).
   Batched writes capture at the outermost `endBatch` — one
   transition per *net* change.
2. **Interruption: latest wins, uniformly.**  The round-21
   channel-eviction rule applies with no priority tiers: whichever
   starts later (transition or user animation) captures from the
   current mid-flight value and stops the older one in place, both
   directions.
3. **`transition-property` accepts every prop name from day one;
   executors are tiered.**  Number/color channels that are
   animatable today actually tween — the paint set (opacity,
   background/border/line colors, with the arrow-alpha fold riding
   along) on the GPU bulk path, `border-width` on the CPU path —
   while discrete channels (enums, strings, lists) snap at the
   transition's start (CSS's rule, recorded) and the not-yet-
   animatable geometry numerics (`width`/`height`, `font-size`,
   `padding`, edge `width`) snap too, **logged as the
   geometry-tween follow-up round**: their per-tick invalidation
   cascade (curve re-derivation, compound auto-bounds, label
   anchors) is the same work the width/height *animation* follow-up
   needs, so both land together, once, with benchmarks.

   The API
   surface never changes when that round lands.
4. **Whole-channel transitions must be one bulk tween record** —
   a slot list + packed from/to buffers (the round-9.4 shape),
   never per-element Animation objects.  This keeps the
   auto-domain-shift worst case (one write moves the live extent →
   the whole channel re-derives) in the cost class it already
   occupies today: the O(n) re-derive plus a constant (one stored-
   channel read for the from values, one from/to upload, ~zero per
   frame while running).
5. **The domain performance contract** (user's condition: both
   modes stay supported).  Explicit `domain` — already in the
   round-7 DSL, no new mapper type — is the documented escape
   hatch: with a pinned domain a data write re-evaluates *written
   elements only* (O(changed), never whole-channel); with
   `'auto'`, in-range writes are identically O(changed) and only
   extent-moving writes pay the O(n) re-derive.  Recorded as docs
   guidance (mapper docs + transition docs): auto is the ergonomic
   default, pin `domain` when a stream grows its own extent.  No
   warning machinery.
6. **Controls: `pause`/`resume`/`reverse` land; `progress` stays a
   getter** (no scrubbing), and v3's `apply`/`applying` stay out
   (promises cover the use case; one name per concept).  A paused
   GPU tween settles its lease (values freeze on the CPU) and
   re-acquires on resume.
