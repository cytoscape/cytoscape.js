## Round 35 plan — the style-read dispatch table (planned 2026-08-03)

Round 34 left the style getters at 2.3× v3 with "no obvious cause — it
is the 145-case switch and the guard lookups that precede it", and
logged that as appetite rather than a decision.  The maintainer's
reaction to that sentence is this round: **145 cases is a code smell;
why is there not a direct lookup?**  Both halves of that turn out to be
right, and the second is measurable.

**Why there are so many cases** — this part is not accidental
complexity.  `readProp` answers *every readable style property* from
stored truth, and each property has its own storage: a column, a
packing, a fold, a sidecar entry, or a derived record.  **150 case
labels over 111 groups** in the big switch (plus four in the small
transition-config switch above it; 153 distinct readable properties in
all), median **2 lines** each, 49 of them one-liners.  It is a dispatch
table that happens to be written as control flow — the vocabulary's
size, not repeated logic.

*(This paragraph first said "153 labels over 97 groups", from a
throwaway parse that mis-split labels written several to a line.  The
figures here are the shipped transformer's, which 35.2's table is built
from.  Fourth time a hand-rolled scan has produced a wrong count in a
plan — the standing advice to reuse the audits' scanner applies to
one-off analysis too.)*

**Why the shape costs something.**  V8 does not hash a string switch
this large.  Measured two ways:

- *Synthetically*, a generated 145-case string switch costs 48.7 ns at
  the first case, **552.9 ns at the last**, and 336 ns rotating across
  the range; a `Map` dispatch to the same readers is **14 ns** and
  position-independent.
- *In the real method*, moving `border-width`'s case — body untouched —
  from position #6 to the tail took it from **56 ns to 90 ns** through
  the built bundle.  (Less than the synthetic gap, because the real
  switch has grouped labels and early-exit branches above it, so V8
  manages some of it better; the effect is still ~1.6× on an identical
  body.)

So a property's cost depends on where it happens to sit in the file —
which is exactly the kind of thing that should not be true, and why the
round-33/34 measurements (which used `background-color`, the **4th**
case) understated the getters for everything else.

**Design calls:**

1. **The switch becomes a `Map` from property name to a reader
   function** — `( engine, ref, store, slot ) => value` — built once at
   module load.  Dispatch is one `Map.get` plus a call, the same for
   every property.  This is the structure the code already *is*; the
   round makes it data instead of control flow.
2. **Value-for-value equivalence is the acceptance test, not a
   sample.**  86% of the readable props (132/153) have a spec that
   passes them to a getter today, which is not enough to refactor 524
   lines behind.  35.1 therefore lands a **characterization spec
   first**: every property in the table, read on a styled node *and* a
   styled edge, asserted against the values the current implementation
   returns.  It is explicitly a refactor guard — it pins *what v4 does
   today*, bugs included — and it closes the 21-prop readback gap
   permanently.
3. **Fall-through groups stay one reader with several keys**, so the
   19 grouped labels do not become 19 copies.
4. **If the transformation cannot be completed safely, it is
   abandoned, not half-done.**  A hybrid (table plus a residual switch)
   would be worse than either.

**Pass split** (tests-first; docs in-commit):

- [ ] **35.0 Docs-first** — this plan.
- [x] **35.1 The characterization spec** (2026-08-03) —
  `test/style-readback-all.mjs`: 153 properties × a styled node and
  a styled edge, 306 assertions, generated from the implementation as
  it stood and **seen green before 35.2 touched anything**.  The 117
  rows that read `undefined` are pinned too — they are how a node-only
  property stays node-only.  Controls: making one property read the
  wrong column fails 1 spec; letting a node-only property leak onto
  edges fails 1.
- [x] **35.2 The dispatch table** (2026-08-03) — the switch is gone.

  `PROP_READERS` is a module-scope `Map` of 111 readers over 150
  labels (nine readers deliberately answer several labels), and
  `readProp` is now **60 lines**: the guards, then a `Map.get` and a
  call.  A reader takes only the arguments it uses, in the order
  `( store, slot, ref, engine, prop )`.
  Encapsulation held: the readers need five engine members
  (`defFor` ×21, `store` ×6, `defs` ×4, `labelChannels` ×2,
  `readImageProp` ×1), all private, so rather than widen the class the
  engine builds **one narrow `ReadContext` per instance** — arrow
  functions capturing `this`, with `store`/`defs` as accessors because
  a sheet swap replaces `defs` wholesale and a snapshot would hand
  every reader the previous sheet.
  Three parser bugs were found and fixed *before* applying anything,
  by inspecting the generated table rather than by running it: labels
  written several to a line (`case 'a': case 'b':`) were silently
  dropping 12 of the 150; a nested switch inside one reader body
  confused a depth-based split; and section comments written above a
  case were being pulled into the *previous* reader, which is this
  codebase's stranded-comment pattern in a new costume — they now lead
  the group they document.
- [x] **35.3 Measure + sweep** (2026-08-03) — **the table flattens the
  cost; it does not lower all of it.**  Through the built bundle, by
  the property's old position in the switch:

  | property (old position) | switch | table |
  |---|---|---|
  | `border-width` (#6) | 56 ns | 73 ns |
  | `background-color` (#4) | 108 ns | 110 ns |
  | `text-wrap` (#73) | 56 ns | 52 ns |
  | `text-max-width` (#74) | 59 ns | 48 ns |
  | `taxi-radius` (#142) | 115 ns | 91 ns |
  | `target-distance-from-node` (#150) | 286 ns | **108 ns** |

  The spread was **56–286 ns (5.1×)** and is now **48–110 ns (2.3×)**:
  the worst property is **2.6× faster**, the earliest few are ~15 ns
  slower (a `Map.get` costs what the switch's first comparisons did
  not), and cost no longer depends on where a property sits in a file.
  The aggregate is the number that matters, since `style()` with no
  argument reads every property of the group: **19.95 → 15.71 µs on a
  node (1.27×) and 30.87 → 20.92 µs on an edge (1.48×)** — edges gain
  more because edge properties sat at the back.

  **Verification**: typecheck, lint, **2662 Node tests** (2508 + the
  154 characterization specs), 77 module tests, JSDoc 100% with
  `@throws` 16/16 and `@param` 221/221, throw coverage 0 dead,
  `test:types:surface` clean (1098 doc blocks; the `.d.ts` gained only the
  private `readCtx` line), and **168/168 browser specs** against a
  hand-rebuilt bundle with goldens byte-stable and parity scenes at
  their recorded values.
  **The same shape exists in the write path and is deliberately left
  alone.**  `applyProp` — the constant-resolution half of the engine —
  is a 147-case switch of exactly the same kind.

  It is *not* hot: it
  runs from `resolveConst`, which is called three times at construction
  and once per group per `cy.style( sheet )`, not per element and not
  per read.  33.3 measured a whole sheet compile at **27.7 µs**, so the
  switch there costs a handful of dispatches per sheet swap against
  ~6000 per whole-object read on the other side.  Recorded so the next
  reader does not pattern-match the shape and "fix" the one that never
  mattered — the read path earned the change because of how often it
  runs, not because a big switch is wrong on sight.
  **Round 35 is complete.**

**Risks tracked**: a mis-transcribed case silently returning the wrong
value (mitigated by 35.1, which is written and seen passing against the
*old* implementation first); `this` capture inside reader bodies (each
becomes an explicit `engine` parameter); and the megamorphic call site
defeating inlining, which is why the round measures rather than assumes.
