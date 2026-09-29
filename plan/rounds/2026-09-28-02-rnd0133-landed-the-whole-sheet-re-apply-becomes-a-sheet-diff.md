## The whole-sheet re-apply becomes a sheet diff

Ledger item 67, taken as a round.  There was no plan file: the spec is
the item's text in `PLAN.md` and its line in the eleventh sitting's
note
(`2026-09-28-01-rnd0000-note-the-eleventh-design-sitting-the-open-calls-one-by-one.md`).

The item (logged 2026-09-18 from round 110.1's census): sixty
re-applies of a sheet whose only change was one node `background-color`
constant cost **198 ms each** on ndex-x-large in the browser, of which
22 ms was the 60 MB upload of every dirtied column; the rest was the
style path recomputing channels that did not change.  A sheet diff —
apply only the properties whose compiled value differs from the
installed sheet's, per group — would make the row read as a one-channel
restyle.  **First measurement**: the same sixty applies with the diff
simulated by hand (`cy.nodes().style(...)` of the one property), which
is the target.

**Call taken (2026-09-28, the eleventh sitting): go, before alpha**,
keeping the bypass-clearing rule of a sheet replace.  An alpha round,
because Cytoscape Web depends on it.  Behaviour unchanged: this is a
performance change, and its proof is end-state equivalence — a diffed
re-apply equals a full re-apply, column for column — with a control.

### The round, as carried out (2026-09-28)

Landed the same day as the sitting, on its call.  Measured on the
i9-9900K (16 threads, 63 GiB; machine 5cf3f79c), Node 24.18, through
the built bundles; the browser rows on the RX 580 (`npm run gpu`:
HARDWARE).

| # | Commit | What landed |
| --- | --- | --- |
| 133.1 | `482f427a` | `benchmark/sheet-diff.mjs`: the full re-apply and the item's hand-diff target, before any diff code existed |
| 133.2 | `9b0d7145` | the diff (`src/style/engine-diff.mts`, `GroupDef.decl`, `StyleEngine.applySheet`/`sheetDiff`/`pendingSheet`, `store.styleTouched`, `endBatch`'s flush), `test/sheet-diff.mjs`, the docs |
| 133.3 | `d7fc5aa2` | the after rows, headless and in the browser |
| 133.4 | this commit | the close |

**Measure first.**  Headless, the census sheet on ndex-x-large (19,607
nodes, 464,657 edges) from the wire form, 60 operations per row, median
per operation, and the dirty bytes each left on the store's dirty stream
(a registered consumer — what a renderer uploads):

| row | ms per op | dirty per op |
| --- | --: | --: |
| full re-apply | 250.9 | 59.55 MB |
| hand diff, `cy.nodes().style( 'background-color', c )` | 70.7 | 0.08 MB |

59.55 MB is the census's 59.6.  The hand diff is the item's target; it
still pays a bypass and a whole single-element write per node, so it
bounds the narrow path from above rather than below.

**The diff, and the after rows** (same bench, same fixture):

| row | ms per op | dirty per op |
| --- | --: | --: |
| full re-apply (the diff off) | 249.7 | 59.55 MB |
| hand diff | 73.0 | 0.08 MB |
| **sheet diff, one node colour** | **1.53** | 0.08 MB |
| sheet diff, identical sheet | 0.06 | 0 |
| sheet diff, constant ↔ `case` mapper | 2.51 | 0.08 MB |
| sheet diff, one edge `line-color` (464,657 narrow writes) | 35.5 | 1.86 MB |
| sheet diff, edge `width` (no narrow writer: edges full, nodes skipped) | 235.4 | 59.48 MB |

Every diff row compares its end state with the same sheets through the
whole-sheet pass, every column of both tables, and exits non-zero on a
difference; all agree.  The target was beaten by 46×: the diff writes
one column through the fill writer, where the hand diff writes whole
elements through the bypass funnel.

In the browser, round 110.1's own row (`benchmark/copy-census.mjs`: 60
replaces, one per frame), the pre-round tree (stashed and rebuilt)
against this one:

| host | before | after |
| --- | --: | --: |
| same-thread: `writeBuffer` bytes, time | 1.79 GB, 658 ms | 2.36 MB, 0.6 ms |
| same-thread: wall for the 60 | 11,956 ms (199 ms each — the census's 198) | 1,000 ms (the frame rate) |
| worker host: posted | 3.57 GB | 4.71 MB |
| worker host: wall for the 60 | 15,245 ms | 1,000 ms |

**What the diff is.**  Each compiled group def (`nodes`, `edges`, the
`parents` overlay) keeps `decl`: a snapshot of the declarations it
compiled from, normalized, the later declaration of a prop winning as
in `resolveConst`.  `setSheet` folds the per-prop difference against
the installed defs into `engine.pendingSheet`; `applySheet()` re-writes
only the changed props through the round-61 narrow writers
(`fastStateWriter`), each slot's writers reading the slot's own
resolved record — the partition cache, the constants, or a per-slot
mapper evaluation with round 66.1's state hoist — so a mapped fold
partner (a data-driven `background-opacity` beside a changed
`background-color`) folds exactly as the full pass folds it.  A group
whose defs all diff to nothing walks no slots.

**What it keeps** — everything the whole-sheet pass re-derived for a
reason other than the sheet's text:

- a prop with no narrow writer sends its def through the full pass; the
  other defs still diff;
- **the bypass-clearing rule**: every slot bypassed under the old sheet
  or the new takes the full write, so a cleared bypass returns its slot
  to the sheet and a new one merges, as before;
- a group an animation has written since its last whole-group pass
  (`store.styleTouched`, new — set per write per tick by the animation
  apply and at a GPU tween's registration, cleared by the whole-group
  passes) takes the full pass, because the full pass always overwrote
  the animated values;
- a live `transition-*` spec on the def, an open transition capture and
  a demoted group take the full pass;
- props the GPU kernel owned count as changed (their stored bytes are
  stale);
- a live auto-domain extent that moved since the columns were derived
  counts its prop as changed;
- inside a batch the changes accumulate from the sheet the columns were
  derived under; the batch's additions take the full write, and
  `endBatch` now runs the batch's deferred data refreshes after a diff
  (the whole-sheet pass used to subsume them, and still does when the
  diff falls back to it);
- a sheet object mutated in place and set again diffs against the
  snapshot, not itself.

**Calls taken in-round**:

- *Diff the declarations, not the compiled records.*  `applyProp` reads
  no sibling field (checked at round 63.2), so equal declarations
  compile equal except where the result depends on data — the
  auto-domain extents and the kernel-owned bytes, both handled
  explicitly — and a declaration is keyed by the prop, which is what the
  narrow writers are keyed by.  A record-level diff would need a
  field→writer table, which drifts from the writers the first time a
  writer folds a new field.  The price: a textual change with an equal
  compiled value (`#fff` for `white`) re-writes its channel — correct,
  and cheap.
- *No new narrow writers.*  The diff uses exactly round 61's set, whose
  invariant (a writer writes every column its prop affects) the state
  refresh already depends on and `test/sheet-diff.mjs` now pins per
  prop.  Widening it to size, labels and the edge-opacity fold is a
  follow-up hook in `src/README.md`.
- *No per-slot styled-mark scan.*  The first version found unstyled
  slots by scanning every live slot's styled mark; on the identical
  sheet that scan and the live-slot array cost 17 ms of nothing.
  Outside a batch every live element is styled on add (the invariant
  the transition marks already rely on), so the only unstyled slots are
  a batch's additions, which `endBatch` passes in — 17 ms → 0.06 ms.
- *The first apply is always full.*  The constructor's empty sheet
  leaves a pending change with nothing to diff against: an engine-only
  store may already hold elements no sheet has styled, which
  `test/bulk-load.mjs` caught when the first version assumed otherwise.
- *`update()` stays the whole-sheet pass* — its job is re-snapshotting
  the live extents over everything.
- *The flag for animations is conservative.*  It fires for a finished
  transition too, whose values equal the sheet's; distinguishing
  would mean tracking which slots and channels an animation left
  off-sheet, for a case that costs one full pass.

**Controls.**  `test/sheet-diff.mjs` builds every scenario twice, one
instance with `sheetDiff = false`, and compares every column of both
tables, the four blob pools and every element's read-back style; the
narrow-path specs also assert the diff dirtied that one column and no
other, since a comparison between two full passes would pass too.  Ten
mutations of the implementation, one per clause, were run against the
file:

| mutation | result |
| --- | --- |
| bypassed slots not given the full write | red: both bypass specs |
| kernel-owned props not counted as changed | red: the kernel-owned spec |
| the auto-domain extent check off | red: the extent spec |
| `styleTouched` ignored | red: the animated-value spec |
| no accumulation across a batch's sheets | **green at first**, then red |
| `endBatch` skips the data refresh after a diff | red: the batch spec |
| no declaration snapshot | **green at first**, then red |
| narrow writers read the constants record | red: 21 specs |
| a batch's unstyled additions dropped | red: the batch spec |
| a compound-record change not forcing the parents | red: the padding spec |

The two that stayed green were findings about the specs.  The
accumulation spec's second sheet re-declared the first one's change, so
the last diff alone covered it — it now sets a second sheet that
*keeps* the first one's change while changing something else.  The
mutation spec mutated a primitive, which the declaration map copies by
construction; it now mutates a mapper object in place.  Both turn red
under their mutations.

**Also checked**: the Node tier (`test:node:quiet`) green; the renderer
and worker-renderer Playwright files (151 passed, 1 skipped) and the
visual project (102 passed) against the rebuilt bundle; and a scripted
Chromium page on the hardware adapter that runs four replaces — a
node colour, node and edge colours, a `bypasses` section, back to the
base — on a compound graph with a mapped fold partner and a selection,
once with the diff and once without: `png()` identical at every step.
`test/bulk-style-apply.mjs`'s re-apply spec now switches the diff off,
since re-setting an identical sheet is an empty diff and not the route
it tests.

**Deferred**: narrow writers for the full-pass props (above).  Nothing
else in the item is open; it is closed in `PLAN.md`.
